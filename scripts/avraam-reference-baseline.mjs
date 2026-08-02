#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const OUT_ROOT = path.resolve(process.env.AVRAAM_BASELINE_OUT || 'reports/atlas/avraam-reference-baseline');
const HEAD_SHA = process.env.HEAD_SHA || process.env.GITHUB_SHA || 'local';
const RUN_ID = process.env.GITHUB_RUN_ID || 'local';
const ROUTE_URL = `${BASE_URL}/karty/avraam/`;
const VIEWPORTS = [
  ['desktop-1920x1080',1920,1080],['desktop-1440x900',1440,900],
  ['desktop-1366x768',1366,768],['tablet-1024x768',1024,768],
  ['mobile-430x932',430,932],['mobile-390x844',390,844],['mobile-360x800',360,800],
].map(([id,width,height])=>({id,width,height}));
const KEY_PLACES = ['ur','harran','shechem','bethel','egypt','hebron','sodom','dan','beersheba','salem'];

const mkdir=(dir)=>fs.mkdirSync(dir,{recursive:true});
const writeJson=(file,value)=>fs.writeFileSync(file,`${JSON.stringify(value,null,2)}\n`,'utf8');
const safeName=(value)=>String(value||'unknown').trim().toLowerCase().replace(/[^a-z0-9а-яё_-]+/giu,'-').replace(/^-+|-+$/g,'');
const panelSelector='.me-panel:visible,.me-place-panel:visible,[data-map-panel]:visible';

async function waitForMap(page){
  page.setDefaultTimeout(5000);
  await page.goto(ROUTE_URL,{waitUntil:'networkidle',timeout:120000});
  await page.waitForFunction(()=>{
    const stage=document.querySelector('[data-map-stage]');
    return Boolean(document.querySelector('.me-map,#mapRoot')&&document.querySelector('.me-canvas svg,.me-map svg,#mapRoot svg')&&(stage?.getAttribute('data-map-state')==='ready'||!stage));
  },{timeout:60000});
  await page.addStyleTag({content:'*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;caret-color:transparent!important}html{scroll-behavior:auto!important}'});
  await page.waitForTimeout(300);
}

async function dismissIntro(page){
  const intro=page.locator('.me-intro');
  const start=page.getByRole('button',{name:/Начать изучение/i});
  if(await start.isVisible().catch(()=>false)){
    await start.evaluate(el=>el.click());
    await intro.waitFor({state:'detached',timeout:1600}).catch(()=>{});
  }
  return (await intro.count())===0;
}

async function closePanel(page){
  for(let pass=0;pass<3;pass+=1){
    const close=page.locator('.me-panel__close:visible').first();
    if(await close.count()){
      await close.click({force:true,timeout:1500}).catch(()=>{});
      await page.waitForTimeout(80);
    }
    await page.keyboard.press('Escape').catch(()=>{});
    await page.waitForTimeout(60);
    if(!(await page.locator(panelSelector).count()))break;
  }
}

async function collectGeometry(page,stateId){
  return page.evaluate(({stateId})=>{
    const isVisible=(el)=>{
      const style=getComputedStyle(el),r=el.getBoundingClientRect();
      return !el.hidden&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity||1)>.02&&r.width>.5&&r.height>.5;
    };
    const rect=(el)=>{const r=el.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const describe=(el)=>({tag:el.tagName.toLowerCase(),id:el.id||null,className:typeof el.className==='string'?el.className:el.className?.baseVal||null,text:(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,160),placeId:el.getAttribute('data-place-id'),story:el.getAttribute('data-story'),tab:el.getAttribute('data-tab'),ariaLabel:el.getAttribute('aria-label')});
    const width=innerWidth,height=innerHeight,html=document.documentElement;
    const map=document.querySelector('.me-map,#mapRoot'),canvas=document.querySelector('.me-canvas'),svg=document.querySelector('.me-canvas svg,.me-map svg,#mapRoot svg');
    const allLabels=[...document.querySelectorAll('svg text')].filter(isVisible).map((el,index)=>({index,...describe(el),box:rect(el)}));
    const labels=allLabels.filter(({box})=>box.right>0&&box.bottom>0&&box.left<width&&box.top<height);
    const offscreenLabels=labels.filter(({box})=>box.left<-1||box.top<-1||box.right>width+1||box.bottom>height+1);
    const labelOverlaps=[];
    for(let i=0;i<labels.length;i+=1)for(let j=i+1;j<labels.length;j+=1){
      const a=labels[i],b=labels[j];
      const ow=Math.max(0,Math.min(a.box.right,b.box.right)-Math.max(a.box.left,b.box.left));
      const oh=Math.max(0,Math.min(a.box.bottom,b.box.bottom)-Math.max(a.box.top,b.box.top));
      const area=ow*oh;
      if(area>=8)labelOverlaps.push({a:{index:a.index,text:a.text,box:a.box},b:{index:b.index,text:b.text,box:b.box},area});
    }
    const controls=[...document.querySelectorAll('button,a,[role="button"],[tabindex]:not([tabindex="-1"])')].filter(isVisible).map(el=>{
      const box=rect(el),scroller=el.closest('[data-horizontal-scroll]'),scrollBox=scroller?rect(scroller):null;
      const scrollReachable=Boolean(scroller&&scroller.scrollWidth>scroller.clientWidth+1&&scrollBox&&box.bottom>scrollBox.top&&box.top<scrollBox.bottom);
      return{...describe(el),box,scrollReachable};
    });
    const undersizedControls=controls.filter(({box})=>box.width<44||box.height<44);
    const offscreenControls=controls.filter(({box,scrollReachable})=>!scrollReachable&&(box.left<-1||box.top<-1||box.right>width+1||box.bottom>height+1));
    const markers=[...document.querySelectorAll('[data-place-id]')].filter(isVisible).map(el=>({...describe(el),box:rect(el)}));
    const routes=[...document.querySelectorAll('.me-route-main,.me-route-underlay,[data-route-segment]')].filter(isVisible).map(el=>{
      let svgBox=null;try{const b=el.getBBox();svgBox={x:b.x,y:b.y,width:b.width,height:b.height}}catch{}
      return{...describe(el),screenBox:rect(el),svgBox};
    });
    const activeStory=document.querySelector('.me-story-chip--active,[aria-selected="true"].me-story-chip,[aria-pressed="true"].me-story-chip');
    return{
      stateId,url:location.href,title:document.title,activeStory:activeStory?.getAttribute('data-story')||null,
      viewport:{width,height,devicePixelRatio,scrollX,scrollY},
      document:{clientWidth:html.clientWidth,scrollWidth:html.scrollWidth,horizontalOverflow:html.scrollWidth-html.clientWidth,clientHeight:html.clientHeight,scrollHeight:html.scrollHeight},
      map:{box:map?rect(map):null,canvasBox:canvas?rect(canvas):null,svgBox:svg?rect(svg):null,viewBox:svg?.getAttribute('viewBox')||null,zoomBucket:svg?.getAttribute('data-zoom-bucket')||null,canvasTransform:canvas?getComputedStyle(canvas).transform:null,svgTransform:svg?getComputedStyle(svg).transform:null},
      counts:{labels:labels.length,markers:markers.length,controls:controls.length,routes:routes.length,offscreenLabels:offscreenLabels.length,labelOverlaps:labelOverlaps.length,undersizedControls:undersizedControls.length,offscreenControls:offscreenControls.length,scrollReachableControls:controls.filter(control=>control.scrollReachable).length},
      offscreenLabels:offscreenLabels.slice(0,120),labelOverlaps:labelOverlaps.sort((a,b)=>b.area-a.area).slice(0,180),undersizedControls:undersizedControls.slice(0,120),offscreenControls:offscreenControls.slice(0,120),markers,routes,
    };
  },{stateId});
}

const screenshot=(page,dir,file)=>page.screenshot({path:path.join(dir,file),animations:'disabled'});

async function storyMetadata(page){
  return page.locator('.me-story-chip').evaluateAll(nodes=>nodes.map((node,index)=>({index,id:node.getAttribute('data-story')||`story-${index+1}`,label:(node.textContent||'').replace(/\s+/g,' ').trim()})));
}

async function selectStory(page,story){
  await closePanel(page);
  const svg=page.locator('.me-canvas svg,.me-map svg,#mapRoot svg').first();
  const before=await svg.getAttribute('viewBox');
  let target=page.locator(`.me-story-chip[data-story="${story.id}"]`).first();
  if(!(await target.count()))target=page.getByRole('button',{name:story.label,exact:true}).first();
  if(!(await target.count()))throw new Error(`story chip not found: ${story.id}`);
  await target.evaluate(el=>el.click());
  await page.waitForTimeout(850);
  let active=await target.evaluate(el=>el.classList.contains('me-story-chip--active')||el.getAttribute('aria-selected')==='true'||el.getAttribute('aria-pressed')==='true');
  if(!active){
    await target.evaluate(el=>el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
    await page.waitForTimeout(850);
    active=await target.evaluate(el=>el.classList.contains('me-story-chip--active')||el.getAttribute('aria-selected')==='true'||el.getAttribute('aria-pressed')==='true');
  }
  const rail=await target.evaluate(el=>{const scroller=el.closest('[data-horizontal-scroll]');if(!scroller)return{present:false,fullyVisible:true};const a=el.getBoundingClientRect(),b=scroller.getBoundingClientRect();return{present:true,fullyVisible:a.left>=b.left-1&&a.right<=b.right+1,scrollLeft:scroller.scrollLeft,scrollWidth:scroller.scrollWidth,clientWidth:scroller.clientWidth}});
  return{active,before,after:await svg.getAttribute('viewBox'),panelVisible:Boolean(await page.locator(panelSelector).count()),rail};
}

async function runViewport(browser,viewport){
  const dir=path.join(OUT_ROOT,viewport.id);mkdir(dir);
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1,reducedMotion:'reduce',colorScheme:'light'});
  const page=await context.newPage();
  const consoleEvents=[],failedRequests=[];
  page.on('console',msg=>consoleEvents.push({type:msg.type(),text:msg.text().slice(0,1000)}));
  page.on('pageerror',err=>consoleEvents.push({type:'pageerror',text:err.message.slice(0,1000)}));
  page.on('requestfailed',req=>failedRequests.push({url:req.url(),method:req.method(),error:req.failure()?.errorText||'unknown'}));
  const result={viewport,route:ROUTE_URL,introDismissed:false,overview:null,surfaces:{},stories:[],places:[],tabs:[],keyboard:{},verificationFailures:[],consoleEvents,failedRequests,fatal:null};
  try{
    await waitForMap(page);
    await screenshot(page,dir,'00-intro.png');
    result.introDismissed=await dismissIntro(page);
    if(!result.introDismissed)result.verificationFailures.push('intro did not dismiss');
    await closePanel(page);
    await screenshot(page,dir,'01-overview.png');
    result.overview=await collectGeometry(page,`${viewport.id}:overview`);
    if(result.overview.map.zoomBucket!=='overview')result.verificationFailures.push(`unexpected overview zoom bucket: ${result.overview.map.zoomBucket}`);

    const themeButton=page.locator('.me-theme-btn').first();
    if(await themeButton.isVisible().catch(()=>false)){
      await themeButton.evaluate(el=>el.click());await page.waitForTimeout(1350);
      await screenshot(page,dir,'02-theme-alt.png');
      result.surfaces.themeAlternative=await collectGeometry(page,`${viewport.id}:theme-alt`);
      if(result.surfaces.themeAlternative.counts.offscreenControls>0)result.verificationFailures.push(`theme-alt offscreen controls: ${result.surfaces.themeAlternative.counts.offscreenControls}`);
      if(result.surfaces.themeAlternative.counts.undersizedControls>0)result.verificationFailures.push(`theme-alt controls <44px: ${result.surfaces.themeAlternative.counts.undersizedControls}`);
      await themeButton.evaluate(el=>el.click());await page.waitForTimeout(1350);
    }else result.verificationFailures.push('theme toggle missing');

    const layerSummary=page.locator('.me-layers__summary').first();
    if(await layerSummary.isVisible().catch(()=>false)){
      await layerSummary.evaluate(el=>el.click());await page.waitForTimeout(160);
      await screenshot(page,dir,'03-layers-expanded.png');
      result.surfaces.layersExpanded=await collectGeometry(page,`${viewport.id}:layers-expanded`);
      if(result.surfaces.layersExpanded.counts.offscreenControls>0)result.verificationFailures.push(`layers offscreen controls: ${result.surfaces.layersExpanded.counts.offscreenControls}`);
      if(result.surfaces.layersExpanded.counts.undersizedControls>0)result.verificationFailures.push(`layers controls <44px: ${result.surfaces.layersExpanded.counts.undersizedControls}`);
      await layerSummary.evaluate(el=>el.click());await page.waitForTimeout(120);
    }else result.verificationFailures.push('layers summary missing');

    const stories=await storyMetadata(page);
    if(!stories.length)result.verificationFailures.push('no story chips found');
    for(let i=0;i<stories.length;i+=1){
      const story=stories[i],id=safeName(story.id||story.label||`story-${i+1}`);
      try{
        const selection=await selectStory(page,story),file=`story-${String(i+1).padStart(2,'0')}-${id}.png`;
        await screenshot(page,dir,file);
        const geometry=await collectGeometry(page,`${viewport.id}:story:${story.id}`);
        result.stories.push({...story,...selection,file,geometry});
        if(!selection.active||geometry.activeStory!==story.id)result.verificationFailures.push(`story activation failed: ${story.id}; active=${geometry.activeStory}`);
        if(selection.rail?.present&&!selection.rail.fullyVisible)result.verificationFailures.push(`active story clipped in rail: ${story.id}`);
        if(story.id!=='main'&&geometry.counts.routes===0)result.verificationFailures.push(`story route missing: ${story.id}`);
        const overlapLimit=viewport.width<=560?4:6;
        const clippedLimit=viewport.width<=560?4:6;
        if(geometry.counts.labelOverlaps>overlapLimit)result.verificationFailures.push(`story label overlaps ${story.id}: ${geometry.counts.labelOverlaps}>${overlapLimit}`);
        if(geometry.counts.offscreenLabels>clippedLimit)result.verificationFailures.push(`story clipped labels ${story.id}: ${geometry.counts.offscreenLabels}>${clippedLimit}`);
      }catch(error){result.stories.push({...story,error:error.message});result.verificationFailures.push(`story error ${story.id}: ${error.message}`)}
    }

    const main=stories.find(story=>story.id==='main')||stories[0];
    if(main)await selectStory(page,main).catch(error=>result.verificationFailures.push(`main reset failed: ${error.message}`));
    await closePanel(page);

    for(const placeId of KEY_PLACES){
      const marker=page.locator(`[data-place-id="${placeId}"]`).first();
      if(!(await marker.count())){result.places.push({id:placeId,present:false});result.verificationFailures.push(`missing place marker: ${placeId}`);continue}
      try{
        await marker.evaluate(el=>el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
        await page.waitForTimeout(260);
        const panel=page.locator(panelSelector).first(),panelVisible=Boolean(await panel.count());
        let heading='';
        if(panelVisible){
          const headingNode=panel.locator('.me-panel__name,h1,h2,h3').first();
          if(await headingNode.count())heading=((await headingNode.textContent())||'').replace(/\s+/g,' ').trim();
        }
        const tabs=await page.locator('.me-tab[data-tab]:visible').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-tab')));
        const file=`place-${placeId}.png`;await screenshot(page,dir,file);
        result.places.push({id:placeId,present:true,panelVisible,heading,tabs,file});
        if(!panelVisible)result.verificationFailures.push(`place panel did not open: ${placeId}`);
      }catch(error){result.places.push({id:placeId,present:true,error:error.message});result.verificationFailures.push(`place error ${placeId}: ${error.message}`)}
    }

    const tabIds=await page.locator('.me-tab[data-tab]:visible').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-tab')));
    for(const tabId of tabIds){
      const tab=page.locator(`.me-tab[data-tab="${tabId}"]:visible`).first();
      try{
        await tab.evaluate(el=>el.click());await page.waitForTimeout(120);
        const active=await tab.evaluate(el=>el.classList.contains('me-tab--active')||el.getAttribute('aria-selected')==='true');
        result.tabs.push({id:tabId,active});if(!active)result.verificationFailures.push(`tab activation failed: ${tabId}`);
      }catch(error){result.tabs.push({id:tabId,error:error.message});result.verificationFailures.push(`tab error ${tabId}: ${error.message}`)}
    }
    await page.keyboard.press('Escape').catch(()=>{});await page.waitForTimeout(100);
    result.keyboard.escapeClosedPanel=!(await page.locator('.me-panel--open').count());
    if(!result.keyboard.escapeClosedPanel)result.verificationFailures.push('Escape did not close panel');
    writeJson(path.join(dir,'geometry.json'),result.overview);writeJson(path.join(dir,'result.json'),result);
  }catch(error){result.fatal={message:error.message,stack:error.stack};await page.screenshot({path:path.join(dir,'FATAL.png'),fullPage:true}).catch(()=>{});writeJson(path.join(dir,'result.json'),result)}
  finally{await context.close()}
  return result;
}

function buildSummary(results){
  const rows=results.map(result=>{const c=result.overview?.counts||{};return`| ${result.viewport.id} | ${result.fatal?'FATAL':'captured'} | ${c.offscreenLabels??'—'} | ${c.labelOverlaps??'—'} | ${c.undersizedControls??'—'} | ${result.verificationFailures.length} | ${result.consoleEvents.filter(e=>e.type==='error'||e.type==='pageerror').length} | ${result.failedRequests.length} |`});
  const fatal=results.filter(r=>r.fatal),failed=results.filter(r=>r.verificationFailures.length);
  return`# Avraam reference baseline\n\n- Branch head SHA: \`${HEAD_SHA}\`\n- Workflow run: \`${RUN_ID}\`\n- Route: \`${ROUTE_URL}\`\n- Captured at: ${new Date().toISOString()}\n- Purpose: current-state evidence only; findings are not silently accepted as golden.\n\n| Viewport | State | Offscreen labels | Label overlaps | Controls <44px | Verification failures | Console errors | Failed requests |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n\n## Fatal viewports\n\n${fatal.length?fatal.map(r=>`- ${r.viewport.id}: ${r.fatal.message}`).join('\n'):'- none'}\n\n## Verification failures\n\n${failed.length?failed.map(r=>`- ${r.viewport.id}: ${r.verificationFailures.join('; ')}`).join('\n'):'- none'}\n`;
}

mkdir(OUT_ROOT);
const browser=await chromium.launch({headless:true}),results=[];
try{for(const viewport of VIEWPORTS){console.log(`Capturing ${viewport.id}...`);results.push(await runViewport(browser,viewport))}}finally{await browser.close()}
const summary={headSha:HEAD_SHA,runId:RUN_ID,route:ROUTE_URL,capturedAt:new Date().toISOString(),viewports:results.map(result=>({id:result.viewport.id,fatal:result.fatal,counts:result.overview?.counts||null,verificationFailures:result.verificationFailures,stories:result.stories.map(story=>({id:story.id,label:story.label,active:story.active,activeStory:story.geometry?.activeStory,viewBox:story.geometry?.map?.viewBox,error:story.error})),places:result.places,consoleErrors:result.consoleEvents.filter(e=>e.type==='error'||e.type==='pageerror'),failedRequests:result.failedRequests}))};
writeJson(path.join(OUT_ROOT,'summary.json'),summary);fs.writeFileSync(path.join(OUT_ROOT,'SUMMARY.md'),buildSummary(results),'utf8');
const fatalCount=results.filter(r=>r.fatal).length,verificationFailureCount=results.reduce((sum,r)=>sum+r.verificationFailures.length,0);
console.log(`Avraam baseline captured: ${results.length-fatalCount}/${results.length} viewports; verificationFailures=${verificationFailureCount}; output=${OUT_ROOT}`);
if(fatalCount||verificationFailureCount)process.exitCode=1;
