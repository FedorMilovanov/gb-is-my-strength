import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {chromium,firefox,webkit} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist'),out=path.join(root,'reports','grok-summary-motion');
fs.mkdirSync(out,{recursive:true});
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
const s=http.createServer((req,res)=>{try{let n=decodeURIComponent((req.url||'/').split('?')[0]);let f=path.resolve(dist,n.replace(/^\/+/,''));if(!path.extname(f))f=path.join(f,'index.html');const rel=path.relative(dist,f);if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);}catch{res.writeHead(400);res.end();}});
await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+s.address().port;
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);return e.isDirectory()?walk(p):e.name==='index.html'?[p]:[];});}
const routes=walk(dist).filter(p=>{const h=fs.readFileSync(p,'utf8');return /summary-card__head[^>]*>\s*Коротко\s*</i.test(h);}).map(p=>'/'+path.relative(dist,p).replaceAll('\\','/').replace(/index\.html$/,''));
const checks=[];
const add=(engine,route,name,pass,evidence)=>{checks.push({engine,route,name,pass:Boolean(pass),evidence});if(!pass)throw new Error(engine+' '+route+' '+name+' '+JSON.stringify(evidence));};
async function prep(page){await page.route('**/*',r=>/(^|\.)(yandex\.(ru|com)|yastatic\.net)$/.test(new URL(r.request().url()).hostname)?r.fulfill({status:200,body:''}):r.continue());}
async function visit(type,engine,route,size,full){
 const p=await type.newPage({viewport:size,reducedMotion:'no-preference',serviceWorkers:'block'});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await prep(p);
  await p.goto(origin+route,{waitUntil:'domcontentloaded',timeout:25000});
  await p.waitForFunction(()=>window.GBSummaryDisclosure?.version===1,{timeout:10000});
  const card=p.locator('.summary-card[data-gb-summary-owner="1"]').first();
  await card.waitFor({timeout:10000});
  const btn=card.locator('.gb-summary-toggle'),motion=card.locator('.gb-summary-motion');
  const initial=await card.evaluate(el=>({open:el.dataset.gbSummaryOpen,
    toggle:el.querySelector('.gb-summary-toggle')?.getAttribute('aria-expanded'),
    bodyHeight:el.querySelector('.gb-summary-motion')?.getBoundingClientRect().height,
    inert:el.querySelector('.gb-summary-motion')?.inert,
    duplicate:!!el.nextElementSibling?.matches('.gb-mobile-expand-btn'),
    bodyCount:el.querySelectorAll('.summary-card__body').length,
    overflow:document.documentElement.scrollWidth-innerWidth
  }));
  add(engine,route,'default closed, accessible, no duplicate',initial.open==='false'&&initial.toggle==='false'&&initial.inert&&initial.bodyHeight<=2&&!initial.duplicate&&initial.bodyCount===1&&initial.overflow<=2,initial);
  // Premium disclosure acceptance: no nested rectangular hover paint. The
  // single card edge and the small circular chevron carry the interaction.
  const idleSkin=await card.evaluate(el=>({
    edge:getComputedStyle(el).borderTopColor,
    labelSize:parseFloat(getComputedStyle(el.querySelector('.gb-summary-toggle')).fontSize)
  }));
  await btn.hover();await p.waitForTimeout(320);
  const hoverSkin=await card.evaluate(el=>{
    const button=el.querySelector('.gb-summary-toggle');
    const chevron=el.querySelector('.gb-summary-toggle__chevron');
    const skin=getComputedStyle(button);
    return {edge:getComputedStyle(el).borderTopColor,buttonBg:skin.backgroundColor,
      buttonBgImage:skin.backgroundImage,chevronBg:getComputedStyle(chevron).backgroundColor,
      chevronShape:getComputedStyle(chevron).borderRadius,
      chevronWidth:chevron.getBoundingClientRect().width};
  });
  add(engine,route,'premium summary hover lights only card edge and round chevron',
    idleSkin.labelSize>=10.5 && hoverSkin.edge!==idleSkin.edge &&
    ['transparent','rgba(0, 0, 0, 0)'].includes(hoverSkin.buttonBg) &&
    hoverSkin.buttonBgImage==='none'&&
    hoverSkin.chevronShape==='50%'&&hoverSkin.chevronWidth>=28&&
    !['transparent','rgba(0, 0, 0, 0)'].includes(hoverSkin.chevronBg),{idleSkin,hoverSkin});
  await btn.click();await p.waitForTimeout(460);
  const expanded=await card.evaluate(el=>({open:el.dataset.gbSummaryOpen,aria:el.querySelector('button')?.getAttribute('aria-expanded'),h:el.querySelector('.gb-summary-motion')?.getBoundingClientRect().height,inert:el.querySelector('.gb-summary-motion')?.inert,body:el.querySelector('.summary-card__body')?.textContent?.trim().length}));
  add(engine,route,'real content opens',expanded.open==='true'&&expanded.aria==='true'&&!expanded.inert&&expanded.h>30&&expanded.body>20,expanded);
  const openedSkin=await card.evaluate(el=>{
    const body=el.querySelector('.gb-summary-motion > .summary-card__body'),css=getComputedStyle(body);
    const chevron=getComputedStyle(el.querySelector('.gb-summary-toggle__chevron'));
    return {padding:parseFloat(css.paddingTop),rule:css.borderTopColor,ruleWidth:css.borderTopWidth,
      chevronTransform:chevron.transform,buttonBg:getComputedStyle(el.querySelector('.gb-summary-toggle')).backgroundColor};
  });
  add(engine,route,'expanded summary has a quiet editorial divider, no header flood fill',
    openedSkin.padding>=14&&openedSkin.ruleWidth==='1px'&&
    !['transparent','rgba(0, 0, 0, 0)'].includes(openedSkin.rule)&&
    openedSkin.chevronTransform!=='none'&&
    ['transparent','rgba(0, 0, 0, 0)'].includes(openedSkin.buttonBg),openedSkin);
  if(full && /hermenevticheskaya|dzhon-gill-chast-1|nagornaya\/chast-1/.test(route)){
    await card.screenshot({path:path.join(out,engine+'-'+route.replaceAll('/','_')+'-open.png')});
  }
  await btn.click();await p.waitForTimeout(460);
  const closed=await card.evaluate(el=>({open:el.dataset.gbSummaryOpen,h:el.querySelector('.gb-summary-motion')?.getBoundingClientRect().height,inert:el.querySelector('.gb-summary-motion')?.inert}));
  add(engine,route,'closes smoothly',closed.open==='false'&&closed.inert&&closed.h<=2,closed);
  if(full&&/hermenevticheskaya|dzhon-gill-chast-1|nagornaya\/chast-1/.test(route))await card.screenshot({path:path.join(out,engine+'-'+route.replaceAll('/','_')+'-closed.png')});
  if(full){
   await btn.focus();await p.keyboard.press('Enter');add(engine,route,'keyboard Enter opens',await btn.getAttribute('aria-expanded')==='true');
   await p.emulateMedia({media:'print'});await p.waitForTimeout(430);await p.waitForFunction(()=>{const el=document.querySelector('.summary-card[data-gb-summary-owner="1"] .gb-summary-motion');return !!el&&getComputedStyle(el).opacity==='1'&&el.getBoundingClientRect().height>30},{timeout:1600});
   const printed=await motion.evaluate(el=>({h:el.getBoundingClientRect().height,opacity:getComputedStyle(el).opacity}));
   add(engine,route,'printed summary fully visible',printed.h>30&&printed.opacity==='1',printed);
  }
  add(engine,route,'no runtime JS errors',errors.length===0,errors);
  if(route.includes('hermenevticheskaya')&&size.width>=1200){
   const gaps=await p.evaluate(()=>{const e=document.querySelector('.article-byline'),prev=e?.previousElementSibling,next=e?.nextElementSibling;return{top:e.getBoundingClientRect().top-prev.getBoundingClientRect().bottom,bottom:next.getBoundingClientRect().top-e.getBoundingClientRect().bottom};});
   add(engine,route,'byline optically centered between rules',Math.abs(gaps.top-gaps.bottom)<=2,gaps);
   if(full){
    await p.emulateMedia({media:'screen'});
    const rail=p.locator('.hrail--grok');await rail.waitFor();
    const toggle=p.locator('#hrailLayoutToggle');
    await p.evaluate(()=>window.scrollTo(0,2500));
    // Interrogate the exact CSS transition at deterministic timeline points.
    // Headless WebKit coalesces requestAnimationFrame callbacks, which made
    // frame-distance/velocity sampling dependent on machine load. Drive the
    // canonical CSSTransition objects at known times without replacing
    // production behavior, then resume and verify a fully settled DOM.
    const trace=await p.evaluate(()=>{
      const r=document.querySelector('.hrail--grok'),b=document.querySelector('#hrailLayoutToggle'),meta=document.querySelector('.hrail-meta');
      const sample=t=>{const tr=b.getBoundingClientRect(),box=r.getBoundingClientRect(),style=getComputedStyle(meta);
        return {t,x:tr.left,width:box.width,metaOpacity:Number(style.opacity),metaVisibility:style.visibility,
          switching:r.classList.contains('grok-rail-switching')};};
      const before=sample(0);
      b.click();
      const railAnims=r.getAnimations(),toggleAnims=b.getAnimations();
      const widthAnim=railAnims.find(a=>a.transitionProperty==='width');
      const leftAnim=toggleAnims.find(a=>a.transitionProperty==='left');
      if(!widthAnim||!leftAnim)return {before,missingAnimation:true,frames:[]};
      const both=[...railAnims,...toggleAnims];
      for(const a of both)a.pause();
      const frames=[];
      for(const t of [0,55,125,250,375,475,520]){
        for(const a of both)a.currentTime=t;
        frames.push(sample(t));
      }
      // Continue the real CSS animation and preserve the existing controller.
      for(const a of both){a.currentTime=0;a.play();}
      return {before,missingAnimation:false,duration:widthAnim.effect.getTiming().duration,frames};
    });
    await p.waitForTimeout(700);
    const frames=trace.frames||[];
    const maxEdgeDrift=frames.length?Math.max(...frames.map(f=>Math.abs((f.width-f.x)-52))):Infinity;
    const monotonic=frames.length===7&&frames.every((f,i)=>!i||
      (f.width<=frames[i-1].width+.2&&f.x<=frames[i-1].x+.2));
    const intermediate=frames.filter(f=>f.width>69&&f.width<trace.before.width-1).length;
    const invisible=frames.length===7&&frames.every(f=>f.switching&&
      f.metaOpacity<.01&&f.metaVisibility==='hidden');
    const travel=frames.length?frames[0].width-frames.at(-1).width:0;
    const compact=await rail.evaluate(e=>({mode:e.classList.contains('hrail--compact'),switching:e.classList.contains('grok-rail-switching'),width:e.getBoundingClientRect().width,controls:e.querySelectorAll('#gbFloatingControls').length}));
    add(engine,route,'rail collapses with no teleport and settles',
      !trace.missingAnimation&&Number(trace.duration)>=500&&
      compact.mode&&!compact.switching&&Math.abs(compact.width-68)<1&&
      travel>200&&maxEdgeDrift<=2&&monotonic&&intermediate>=4&&invisible,
      {duration:trace.duration,maxEdgeDrift,monotonic,intermediate,invisible,travel,compact,frames});
    await rail.screenshot({path:path.join(out,engine+'-compact.png')});
    await toggle.click();await p.waitForTimeout(820);
    const restored=await rail.evaluate(e=>({compact:e.classList.contains('hrail--compact'),switching:e.classList.contains('grok-rail-switching'),width:e.getBoundingClientRect().width,controls:document.querySelectorAll('#gbFloatingControls').length}));
    add(engine,route,'rail expands, original four controls unique',!restored.compact&&!restored.switching&&restored.width>250&&restored.controls===1,restored);
    await toggle.click();await p.waitForTimeout(70);await toggle.click();await p.waitForTimeout(820);
    const repeat=await rail.evaluate(e=>({compact:e.classList.contains('hrail--compact'),switching:e.classList.contains('grok-rail-switching'),aria:e.querySelector('#hrailLayoutToggle')?.getAttribute('aria-expanded')}));
    add(engine,route,'rapid repeated toggles leave stable expanded rail',!repeat.compact&&!repeat.switching&&repeat.aria==='true',repeat);
    await p.screenshot({path:path.join(out,engine+'-expanded.png')});
   }
  }
 }catch(error){checks.push({engine,route,name:'ERROR',pass:false,evidence:String(error)});}
 finally{await p.close();}
}
for(const [engine,type] of Object.entries({chromium,firefox,webkit})){
 if(process.env.GB_SUMMARY_ONLY_ENGINE && process.env.GB_SUMMARY_ONLY_ENGINE!==engine)continue;
 const reps=engine==='chromium'?routes:[
  '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',
  '/articles/dzhon-gill-chast-1-chelovek/',
  '/nagornaya/chast-1/',
 ].filter(x=>routes.includes(x));
 const browser=await type.launch({headless:true});
 const selected=process.env.GB_SUMMARY_ONLY_ROUTE?reps.filter(x=>x.includes(process.env.GB_SUMMARY_ONLY_ROUTE)):reps;
 for(const route of selected)await visit(browser,engine,route,{width:1440,height:900},selected.length<=3||route.includes('hermenevticheskaya'));
 if(process.env.GB_SUMMARY_ONLY_ROUTE){await browser.close();continue;}
 await visit(browser,engine,'/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',{width:390,height:844},false);
 // A search result can link directly to an item inside a closed summary.
 // Initial fragment and subsequent hashchange must expose the target.
 const anchorRoute='/articles/chto-bibliya-nazyvaet-serdcem/';
 const deep=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 try {
   await deep.goto(origin+anchorRoute+'#gb-summary-body-1',{waitUntil:'domcontentloaded'});
   await deep.waitForFunction(()=>document.querySelector('.summary-card[data-gb-summary-owner="1"]')?.dataset.gbSummaryOpen==='true');
   const initial=await deep.evaluate(()=>{
     const target=document.getElementById('gb-summary-body-1');
     return {visible:!!target&&getComputedStyle(target.closest('.gb-summary-motion')).opacity==='1',
       open:target?.closest('.summary-card')?.dataset.gbSummaryOpen,
       fragment:location.hash,focusable:!target?.closest('.gb-summary-motion')?.inert};
   });
   add(engine,anchorRoute,'initial deep-link opens hidden summary',initial.open==='true'&&initial.focusable,initial);
   await deep.locator('.gb-summary-toggle').first().click();
   await deep.waitForTimeout(430);
   await deep.evaluate(()=>{history.replaceState(null,'',location.pathname);location.hash='gb-summary-body-1';});
   await deep.waitForTimeout(480);
   const changed=await deep.evaluate(()=>{
     const target=document.getElementById('gb-summary-body-1');
     return {open:target?.closest('.summary-card')?.dataset.gbSummaryOpen,
       aria:document.querySelector('.gb-summary-toggle')?.getAttribute('aria-expanded'),
       top:target?.getBoundingClientRect().top,
       inert:target?.closest('.gb-summary-motion')?.inert};
   });
   add(engine,anchorRoute,'hashchange deep-link reveals collapsed summary',
     changed.open==='true'&&changed.aria==='true'&&!changed.inert,changed);
 }catch(e){checks.push({engine,route:anchorRoute,name:'DEEP-LINK ERROR',pass:false,evidence:String(e)});}
 finally{await deep.close();}
 await browser.close();
}
await new Promise(resolve=>s.close(resolve));
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({routes,checks},null,2),'utf8');
console.log(JSON.stringify({eligibleRoutes:routes.length,checks:checks.length,passed:checks.filter(x=>x.pass).length,failed:checks.filter(x=>!x.pass).slice(0,15)},null,2));
if(!checks.length||checks.some(x=>!x.pass))process.exitCode=1;
