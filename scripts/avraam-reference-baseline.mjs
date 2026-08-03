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

const SOURCE_ROUTE_PATH=path.resolve('karty/avraam/route.json');
const SOURCE_ROUTE=JSON.parse(fs.readFileSync(SOURCE_ROUTE_PATH,'utf8'));
function sourceDataAudit(route){
  const places=Array.isArray(route.places)?route.places:[],stages=Array.isArray(route.stages)?route.stages:[],stories=Array.isArray(route.stories)?route.stories:[],ctx=Array.isArray(route.ctx)?route.ctx:[];
  const routePlaces=places.filter(place=>Number.isInteger(place.stage));
  const contextPlaces=places.filter(place=>!Number.isInteger(place.stage));
  const photos=routePlaces.reduce((sum,place)=>sum+(Array.isArray(place.photos)?place.photos.length:0),0);
  const scientificVariants=Object.values(route.scientific_variants||{}).reduce((sum,value)=>sum+(Array.isArray(value)?value.length:0),0);
  const stats=route.meta?.stats||{},failures=[];
  const expect=(label,actual,expected)=>{if(actual!==expected)failures.push(`${label}: ${actual} != ${expected}`)};
  expect('stats.places',stats.places,routePlaces.length);
  expect('stats.route_places',stats.route_places,routePlaces.length);
  expect('stats.context_places',stats.context_places,contextPlaces.length);
  expect('stats.stages',stats.stages,stages.length);
  expect('stats.stories',stats.stories,stories.length);
  expect('stats.ctx_points',stats.ctx_points,ctx.length);
  expect('stats.photos',stats.photos,photos);
  expect('stats.verified_waypoints',stats.verified_waypoints,(route.verified_waypoints||[]).length);
  expect('stats.scientific_variants',stats.scientific_variants,scientificVariants);
  expect('places_index length',(route.places_index||[]).length,routePlaces.length);
  const ids=places.map(place=>place.id),idSet=new Set(ids);
  if(idSet.size!==ids.length)failures.push(`duplicate place ids: ${ids.length-idSet.size}`);
  routePlaces.forEach(place=>{if(place.stage<0||place.stage>=stages.length)failures.push(`invalid stage ${place.id}: ${place.stage}`)});
  stories.forEach(story=>{
    const storyIds=new Set(story.places||[]),focusIds=story.focus_places||story.focusPlaceIds||[],contextIds=story.context_places||story.contextPlaceIds||[];
    (story.places||[]).forEach(id=>{if(!idSet.has(id))failures.push(`story ${story.id} missing place: ${id}`)});
    [...focusIds,...contextIds].forEach(id=>{if(!storyIds.has(id))failures.push(`story ${story.id} role place outside story: ${id}`)});
    focusIds.forEach(id=>{if(contextIds.includes(id))failures.push(`story ${story.id} focus/context overlap: ${id}`)});
    (story.stages||[]).forEach(stage=>{if(!Number.isInteger(stage)||stage<0||stage>=stages.length)failures.push(`story ${story.id} invalid stage: ${stage}`)});
  });
  return{counts:{places:places.length,routePlaces:routePlaces.length,contextPlaces:contextPlaces.length,stages:stages.length,stories:stories.length,ctx:ctx.length,photos,verifiedWaypoints:(route.verified_waypoints||[]).length,scientificVariants},failures};
}
const SOURCE_DATA_AUDIT=sourceDataAudit(SOURCE_ROUTE);
function routeVisualMass(geometry){
  const boxes=(geometry.routes||[]).map(route=>route.screenBox).filter(Boolean);
  if(!boxes.length)return null;
  const left=Math.min(...boxes.map(box=>box.left)),top=Math.min(...boxes.map(box=>box.top)),right=Math.max(...boxes.map(box=>box.right)),bottom=Math.max(...boxes.map(box=>box.bottom));
  const width=Math.max(0,right-left),height=Math.max(0,bottom-top),vw=geometry.viewport.width,vh=geometry.viewport.height;
  return{left,top,right,bottom,width,height,widthRatio:width/vw,heightRatio:height/vh,centerXRatio:(left+right)/(2*vw),centerYRatio:(top+bottom)/(2*vh)};
}

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
    const describe=(el)=>({tag:el.tagName.toLowerCase(),id:el.id||null,className:typeof el.className==='string'?el.className:el.className?.baseVal||null,text:(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,160),placeId:el.getAttribute('data-place-id'),storyActive:el.getAttribute('data-story-active'),storyRole:el.getAttribute('data-story-role'),story:el.getAttribute('data-story'),tab:el.getAttribute('data-tab'),ariaLabel:el.getAttribute('aria-label')});
    const width=innerWidth,height=innerHeight,html=document.documentElement;
    const map=document.querySelector('.me-map,#mapRoot'),canvas=document.querySelector('.me-canvas'),svg=document.querySelector('.me-canvas svg,.me-map svg,#mapRoot svg');
    const allLabels=[...document.querySelectorAll('svg text')].filter(isVisible).map((el,index)=>({index,...describe(el),box:rect(el)}));
    const labels=allLabels.filter(({box})=>box.right>0&&box.bottom>0&&box.left<width&&box.top<height);
    const visibleBaseDetailLabels=[...document.querySelectorAll('#me-base-geo .lbl-z2')].filter(isVisible);
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
    const offscreenControls=controls.filter(({box,scrollReachable,placeId})=>!placeId&&!scrollReachable&&(box.left<-1||box.top<-1||box.right>width+1||box.bottom>height+1));
    const markers=[...document.querySelectorAll('[data-place-id]')].filter(isVisible).map(el=>{
      const label=el.querySelector('.me-place-label'),bg=el.querySelector('.me-place-label-bg'),dot=el.querySelector('.me-marker-dot');
      return{...describe(el),box:rect(el),labelOpacity:label?Number(getComputedStyle(label).opacity):null,labelFontSize:label?parseFloat(getComputedStyle(label).fontSize):null,labelBgOpacity:bg?Number(getComputedStyle(bg).opacity):null,dotRadius:dot?Number(dot.getAttribute('r')):null};
    });
    const routes=[...document.querySelectorAll('.me-route-main,.me-route-underlay,[data-route-segment]')].filter(isVisible).map(el=>{
      let svgBox=null;try{const b=el.getBBox();svgBox={x:b.x,y:b.y,width:b.width,height:b.height}}catch{}
      return{...describe(el),screenBox:rect(el),svgBox};
    });
    const activeStory=document.querySelector('.me-story-chip--active,[aria-selected="true"].me-story-chip,[aria-pressed="true"].me-story-chip');
    return{
      stateId,url:location.href,title:document.title,activeStory:activeStory?.getAttribute('data-story')||null,
      motion:{prefersReducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,smilAnimations:svg?svg.querySelectorAll('animate,animateTransform,animateMotion,set').length:0,smilPaused:svg?.getAttribute('data-smil-paused')==='1'},
      viewport:{width,height,devicePixelRatio,scrollX,scrollY},
      document:{clientWidth:html.clientWidth,scrollWidth:html.scrollWidth,horizontalOverflow:html.scrollWidth-html.clientWidth,clientHeight:html.clientHeight,scrollHeight:html.scrollHeight},
      map:{box:map?rect(map):null,canvasBox:canvas?rect(canvas):null,svgBox:svg?rect(svg):null,viewBox:svg?.getAttribute('viewBox')||null,zoomBucket:svg?.getAttribute('data-zoom-bucket')||null,canvasTransform:canvas?getComputedStyle(canvas).transform:null,svgTransform:svg?getComputedStyle(svg).transform:null},
      counts:{labels:labels.length,baseDetailLabels:visibleBaseDetailLabels.length,markers:markers.length,controls:controls.length,routes:routes.length,offscreenLabels:offscreenLabels.length,labelOverlaps:labelOverlaps.length,undersizedControls:undersizedControls.length,offscreenControls:offscreenControls.length,scrollReachableControls:controls.filter(control=>control.scrollReachable).length},
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
  const result={viewport,route:ROUTE_URL,sourceData:SOURCE_DATA_AUDIT,introDismissed:false,overview:null,surfaces:{},stories:[],places:[],tabs:[],keyboard:{},verificationFailures:[...SOURCE_DATA_AUDIT.failures.map(failure=>`source data: ${failure}`)],consoleEvents,failedRequests,fatal:null};
  try{
    await waitForMap(page);
    await screenshot(page,dir,'00-intro.png');
    result.introDismissed=await dismissIntro(page);
    if(!result.introDismissed)result.verificationFailures.push('intro did not dismiss');
    await closePanel(page);
    await screenshot(page,dir,'01-overview.png');
    result.overview=await collectGeometry(page,`${viewport.id}:overview`);
    if(result.overview.map.zoomBucket!=='overview')result.verificationFailures.push(`unexpected overview zoom bucket: ${result.overview.map.zoomBucket}`);
    const clippedOverviewLabels=result.overview.offscreenLabels.filter(label=>String(label.className||'').split(/\s+/).includes('lbl-overview'));
    if(clippedOverviewLabels.length)result.verificationFailures.push(`overview labels outside safe area: ${clippedOverviewLabels.map(label=>label.text||label.id||label.index).join(', ')}`);
    if(result.overview.motion.prefersReducedMotion&&result.overview.motion.smilAnimations>0&&!result.overview.motion.smilPaused)result.verificationFailures.push('reduced motion did not pause SVG animations');

    const themeButton=page.locator('.me-theme-btn').first();
    if(await themeButton.isVisible().catch(()=>false)){
      await themeButton.evaluate(el=>el.click());await page.waitForTimeout(1350);
      await screenshot(page,dir,'02-theme-alt.png');
      result.surfaces.themeAlternative=await collectGeometry(page,`${viewport.id}:theme-alt`);
      result.surfaces.themeAlternative.theme=await page.locator('.me-map').first().getAttribute('data-map-theme');
      if(result.surfaces.themeAlternative.theme!=='light')result.verificationFailures.push(`theme toggle did not reach light palette: ${result.surfaces.themeAlternative.theme}`);
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
        const visualMass=routeVisualMass(geometry);
        result.stories.push({...story,...selection,file,geometry,visualMass});
        if(!selection.active||geometry.activeStory!==story.id)result.verificationFailures.push(`story activation failed: ${story.id}; active=${geometry.activeStory}`);
        if(selection.rail?.present&&!selection.rail.fullyVisible)result.verificationFailures.push(`active story clipped in rail: ${story.id}`);
        if(story.id!=='main'&&geometry.counts.routes===0)result.verificationFailures.push(`story route missing: ${story.id}`);
        const irrelevantMarkers=story.id==='main'?[]:geometry.markers.filter(marker=>marker.storyActive==='0');
        if(irrelevantMarkers.length)result.verificationFailures.push(`story irrelevant markers ${story.id}: ${irrelevantMarkers.map(marker=>marker.placeId||marker.text||marker.id).join(', ')}`);
        const sourceStory=(SOURCE_ROUTE.stories||[]).find(item=>item.id===story.id);
        const sourcePlaces=new Map((SOURCE_ROUTE.places||[]).map(place=>[place.id,place]));
        const requiredStoryPlaces=(sourceStory?.places||sourceStory?.place_ids||[]).filter(id=>sourcePlaces.get(id)?.type!=='cand');
        const visibleStoryPlaces=new Set(geometry.markers.map(marker=>marker.placeId).filter(Boolean));
        const missingStoryPlaces=story.id==='main'?[]:requiredStoryPlaces.filter(id=>!visibleStoryPlaces.has(id));
        if(missingStoryPlaces.length)result.verificationFailures.push(`story required markers missing ${story.id}: ${missingStoryPlaces.join(', ')}`);
        const markerById=new Map(geometry.markers.map(marker=>[marker.placeId,marker]));
        const focusIds=sourceStory?.focus_places||sourceStory?.focusPlaceIds||requiredStoryPlaces;
        const contextIds=sourceStory?.context_places||sourceStory?.contextPlaceIds||[];
        const focusRoleMismatch=story.id==='main'?[]:focusIds.filter(id=>markerById.get(id)?.storyRole!=='focus');
        if(focusRoleMismatch.length)result.verificationFailures.push(`story focus role mismatch ${story.id}: ${focusRoleMismatch.join(', ')}`);
        const contextRoleMismatch=story.id==='main'?[]:contextIds.filter(id=>markerById.get(id)?.storyRole!=='context');
        if(contextRoleMismatch.length)result.verificationFailures.push(`story context role mismatch ${story.id}: ${contextRoleMismatch.join(', ')}`);
        const candidateRoleMismatch=story.id==='main'?[]:(sourceStory?.places||[]).filter(id=>sourcePlaces.get(id)?.type==='cand'&&markerById.get(id)?.storyRole!=='candidate');
        if(candidateRoleMismatch.length)result.verificationFailures.push(`story candidate role mismatch ${story.id}: ${candidateRoleMismatch.join(', ')}`);
        const focusVisuals=focusIds.map(id=>markerById.get(id)).filter(Boolean),secondaryVisuals=[...contextIds,...(sourceStory?.places||[]).filter(id=>sourcePlaces.get(id)?.type==='cand')].map(id=>markerById.get(id)).filter(Boolean);
        if(focusVisuals.length&&secondaryVisuals.length&&Math.min(...focusVisuals.map(marker=>marker.labelOpacity??0))<=Math.max(...secondaryVisuals.map(marker=>marker.labelOpacity??0)))result.verificationFailures.push(`story visual hierarchy failed ${story.id}`);
        if(story.id!=='main'&&geometry.counts.baseDetailLabels>0)result.verificationFailures.push(`story forensic background labels ${story.id}: ${geometry.counts.baseDetailLabels}`);
        if(story.id!=='main'&&visualMass){
          const dominant=Math.max(visualMass.widthRatio,visualMass.heightRatio);
          if(dominant<.16)result.verificationFailures.push(`story route visual mass too small ${story.id}: ${dominant.toFixed(3)}`);
          if(visualMass.centerXRatio<.25||visualMass.centerXRatio>.75||visualMass.centerYRatio<.18||visualMass.centerYRatio>.82)result.verificationFailures.push(`story route visual mass off-center ${story.id}: ${visualMass.centerXRatio.toFixed(3)},${visualMass.centerYRatio.toFixed(3)}`);
        }
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
