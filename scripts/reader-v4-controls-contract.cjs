// V4 mobile reader regression on production-like dist. Run after build; no network and no mutations.
'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist');
const {chromium,webkit}=require('playwright');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,'');
 let f=path.join(root,rel);if(!f.startsWith(root)){res.writeHead(403).end();return;}
 if(f.endsWith(path.sep)||(fs.existsSync(f)&&fs.statSync(f).isDirectory()))f=path.join(f,'index.html');
 if(!fs.existsSync(f)){res.writeHead(404).end('missing');return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});
 fs.createReadStream(f).pipe(res);
});
const route='/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
async function check(name,driver,width,base){
 const browser=await driver.launch({headless:true});
 try{
 const ctx=await browser.newContext({viewport:{width,height:844},locale:'ru-RU',serviceWorkers:'block'});
 try{
 const p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});
 await p.locator('#hmSearchTrigger').waitFor({state:'visible',timeout:12000});
 await p.locator('#gb-hl-fab').waitFor({state:'visible',timeout:12000});
 const layout=await p.evaluate(()=>{
   const icons=['#hmSettingsBtn','#gb-hl-fab','#hmShareBtn','.hmbar-btn.gb-theme-toggle'];
   const measured=icons.map(q=>{const el=document.querySelector(q),r=el.getBoundingClientRect(),svg=el.querySelector('svg'),s=getComputedStyle(svg);return{q,x:r.x,y:r.y,w:r.width,h:r.height,svgW:parseFloat(s.width),stroke:s.strokeWidth,color:getComputedStyle(el).color}});
   const play=document.querySelector('.hm-ember').getBoundingClientRect(),rate=document.querySelector('#hmSpdBadge').getBoundingClientRect();
   const top=document.querySelector('.hmtop').getBoundingClientRect();
   const bottom=document.querySelector('.hmbar').getBoundingClientRect();
   const section=document.querySelector('#hmSectionBtn').getBoundingClientRect();
   const name=document.querySelector('#hmSectionName').getBoundingClientRect();
   const search=document.querySelector('#hmSearchTrigger').getBoundingClientRect();
   return{innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,measured,
     topHeight:top.height,bottomHeight:bottom.height,sectionHeight:section.height,sectionTextBottom:name.bottom,bottomEdge:bottom.bottom,
     sectionLabelVisible:getComputedStyle(document.querySelector('.hmbar-section-label')).display!=='none',searchHeight:search.height,
     readingViewport:innerHeight-top.height-bottom.height,rateDistanceX:rate.x-play.x,rateDistanceY:rate.y-play.y};
 });
 assert(layout.overflow<=1,JSON.stringify(layout));
 assert(layout.topHeight>=44&&layout.topHeight<=52,'Top bar must fit compact chrome budget: '+JSON.stringify(layout));
 assert(layout.bottomHeight>=44&&layout.bottomHeight<=52,'Bottom bar must fit compact chrome budget: '+JSON.stringify(layout));
 assert(layout.searchHeight>=43.5&&layout.sectionHeight>=43.5,'Search/context tap areas must stay >=44px');
 assert(layout.sectionTextBottom<=layout.bottomEdge-1,'Chapter title clipped by compact bottom bar: '+JSON.stringify(layout));
 assert.equal(layout.sectionLabelVisible,width>360,'Redundant context label must only disappear on very narrow screens');
 assert(layout.readingViewport>=740,'Reader viewport gained insufficient vertical space');
 assert(layout.measured.every(x=>x.w>=43.5&&x.h>=43.5),'hit box too small '+JSON.stringify(layout));
 assert(layout.measured.every(x=>x.svgW>=18&&x.svgW<=21),'inconsistent svg size '+JSON.stringify(layout));
 const colors=new Set(layout.measured.map(x=>x.color));assert(colors.size===1,'different colors in footer '+JSON.stringify(layout));
 assert(layout.rateDistanceX>=15&&layout.rateDistanceX<=32,'speed not attached to Play');
 await p.locator('#hmSearchTrigger').click();
 await p.locator('#hmSheet.is-open .hmsheet-panel').waitFor({state:'visible'});
 await p.waitForFunction(()=>document.activeElement?.id==='hmSheetSearch');
 await p.locator('#hmSheetClose').click();
 await p.locator('#hmSpdBadge').click();
 await p.locator('.hmtop.speed-open').waitFor();
 assert.equal(await p.locator('.hm-spd').count(),6,'v4 has six rates');
 await p.locator('.hm-spd[data-speed="1.5"]').click();
 await p.waitForTimeout(350);
 assert(!await p.locator('.hmtop').evaluate(el=>el.classList.contains('speed-open')),'Speed rail failed to close');
 assert.equal(await p.locator('#hmSpdBadge').textContent(),'1.5×');
 assert.equal(await p.evaluate(()=>localStorage.getItem('gb:audio:rate')),'1.5');
 await p.locator('#hmSettingsBtn').click();
 await p.locator('#hmSettings.is-open .hmsheet-panel').waitFor({state:'visible'});
 const settingsGeometry=await p.evaluate(()=>{
   const sheet=document.querySelector('#hmSettings .hmsheet-panel');
   const header=document.querySelector('#hmSettings .hmsheet-head');
   const footer=document.querySelector('#hmSettings .hmset-footer');
   const group=document.querySelector('#hmSettings .hmset-group');
   const button=document.querySelector('#hmSettings .hmset-btn');
   return{sheetHeight:sheet.getBoundingClientRect().height,headerHeight:header.getBoundingClientRect().height,
     footerHeight:footer.getBoundingClientRect().height,groupPadding:getComputedStyle(group).paddingTop,
     buttonHeight:button.getBoundingClientRect().height,overflow:document.documentElement.scrollWidth-innerWidth};
 });
 assert(settingsGeometry.overflow<=1,'Settings horizontal overflow '+JSON.stringify(settingsGeometry));
 assert(settingsGeometry.headerHeight<=84,'Settings header too tall '+JSON.stringify(settingsGeometry));
 assert(settingsGeometry.footerHeight<=70,'Settings footer too tall '+JSON.stringify(settingsGeometry));
 assert(parseFloat(settingsGeometry.groupPadding)<=9,'Settings group spacing exceeded compact design token');
 assert(settingsGeometry.buttonHeight>=43.5,'Settings segmented controls must retain 44px targets');
 await p.locator('[data-hm-theme="sepia"]').click();
 assert.equal(await p.evaluate(()=>document.documentElement.getAttribute('data-reader-theme')),'sepia');
 await p.locator('[data-hm-measure="narrow"]').click();
 await p.locator('[data-hm-line="relaxed"]').click();
 await p.locator('#hmSettingsReset').click();
 await p.locator('#hmSettingsDone').click();
 await p.waitForFunction(()=>!document.querySelector('#hmSettings')?.classList.contains('is-open'));
 await p.locator('#gb-hl-fab').click();
 await p.locator('#gb-hl-panel').waitFor({state:'visible'});
 const libraryGeometry=await p.evaluate(()=>{
   const rect=(q)=>document.querySelector(q)?.getBoundingClientRect();
   const row=document.querySelector('.gb-hl-item');
   return{headerHeight:rect('#gb-hl-header').height,tabsHeight:rect('#gb-hl-tabs').height,
      tabHeight:rect('#gb-hl-tabs button').height,searchHeight:rect('#gb-hl-search').height,
      sourceHeight:rect('#gb-hl-source').height,closeHeight:rect('#gb-hl-close').height,
      itemPad:row?getComputedStyle(row).paddingTop:null,overflow:document.documentElement.scrollWidth-innerWidth};
 });
 assert(libraryGeometry.headerHeight<=64,'Library header too tall '+JSON.stringify(libraryGeometry));
 for(const key of ['tabHeight','searchHeight','sourceHeight','closeHeight'])
   assert(libraryGeometry[key]>=43.5,'Library tap target '+key+' below 44px: '+JSON.stringify(libraryGeometry));
 if(libraryGeometry.itemPad)assert(parseFloat(libraryGeometry.itemPad)<=10,'Library card padding too large');
 assert(libraryGeometry.overflow<=1,'Library horizontal overflow '+JSON.stringify(libraryGeometry));
 await p.locator('#gb-hl-close').click();
 assert.deepEqual(errors,[],'page errors '+errors);
 console.log('PASS '+name+' '+width+' v4 top search, six speeds, themed settings, legacy theme toggle, normalized library icon, hitbox');
 }finally{await ctx.close();}
 }finally{await browser.close();}
}
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port;
 try{
 for(const [name,driver] of [['chromium',chromium],['webkit',webkit]])
 for(const width of [320,390])await check(name,driver,width,base);
 console.log('V4 chrome functional contract 4/4 PASS');
 }finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
