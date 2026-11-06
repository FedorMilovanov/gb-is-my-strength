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
   const lower=['#hmBottomBtn','#hmSectionBtn','.hmbar-btn.gb-theme-toggle','#hmSettingsBtn','#gb-hl-fab','#hmShareBtn'].map(q=>{const r=document.querySelector(q).getBoundingClientRect();return{q,x:r.x,w:r.width,h:r.height};});
   const group=document.querySelector('.hmbar-actions'), groupControls=Array.from(group?.children||[]).map(el=>el.id||el.getAttribute('data-fc-action'));
   const bar=document.querySelector('.hmbar'),section=document.querySelector('#hmSectionBtn'),label=section.querySelector('.hmbar-section-label');
   return{innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,measured,lower,groupControls,groupGap:getComputedStyle(group).gap,barGap:getComputedStyle(bar).gap,sectionPadding:getComputedStyle(section).padding,labelVisible:label.getBoundingClientRect().height>0,topHeight:document.querySelector('.hmtop').getBoundingClientRect().height,bottomHeight:bar.getBoundingClientRect().height,rateDistanceX:rate.x-play.x,rateDistanceY:rate.y-play.y};
 });
 assert(layout.overflow<=1,JSON.stringify(layout));
 assert(layout.topHeight>=55,'upper v4 chrome was changed outside lower-bar scope '+JSON.stringify(layout));
 assert(layout.bottomHeight>=56&&layout.bottomHeight<=65,'left side bar geometry should be restored to original v4 '+JSON.stringify(layout));
 assert.deepEqual(layout.groupControls,['theme','hmSettingsBtn','gb-hl-fab','hmShareBtn'],'only the four actions must be grouped');
 assert(layout.groupGap==='0px','right action cluster must be compact '+JSON.stringify(layout));
 assert(layout.barGap===(width<=360?'2px':'8px'),'global bar gap must be preserved '+JSON.stringify(layout));
 assert(layout.labelVisible,'original now-reading label must be visible on narrow screens');
 assert(layout.lower.filter(x=>x.q!=='#hmSectionBtn').every(x=>x.w>=43.5&&x.h>=43.5),'progress or right action tap target too small '+JSON.stringify(layout));
 assert(layout.lower.find(x=>x.q==='#hmSectionBtn').h>=34,'original now-reading control unexpectedly contracted '+JSON.stringify(layout));
 assert(layout.lower.slice(1).every((x,i)=>x.x>=layout.lower[i].x+layout.lower[i].w-.5),'overlapping lower controls '+JSON.stringify(layout));
 assert(layout.measured.every(x=>x.w>=43.5&&x.h>=43.5),'hit box too small '+JSON.stringify(layout));
 assert(layout.measured.every(x=>x.svgW>=18&&x.svgW<=21),'inconsistent svg size '+JSON.stringify(layout));
 const colors=new Set(layout.measured.map(x=>x.color));assert(colors.size===1,'different colors in footer '+JSON.stringify(layout));
 assert(layout.rateDistanceX>=15&&layout.rateDistanceX<=32,'speed not attached to Play');
 await p.locator('#hmSearchTrigger').click();
 await p.locator('#hmSheet.is-open .hmsheet-panel').waitFor({state:'visible'});
 await p.waitForFunction(()=>document.activeElement?.id==='hmSheetSearch');
 await p.locator('#hmSheetClose').click();
 await p.locator('.hm-ember[data-fc-action="play"]').click({trial:true});
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
 await p.locator('[data-hm-theme="sepia"]').click();
 assert.equal(await p.evaluate(()=>document.documentElement.getAttribute('data-reader-theme')),'sepia');
 await p.locator('[data-hm-measure="narrow"]').click();
 await p.locator('[data-hm-line="relaxed"]').click();
 await p.locator('#hmSettingsReset').click();
 await p.locator('#hmSettingsDone').click();
 await p.waitForFunction(()=>!document.querySelector('#hmSettings')?.classList.contains('is-open'));
 await p.locator('#gb-hl-fab').click();
 await p.locator('#gb-hl-panel').waitFor({state:'visible'});
 await p.locator('#gb-hl-close').click();
 await p.locator('#gb-hl-fab').focus();
 await p.evaluate(()=>window.dispatchEvent(new Event('resize')));
 assert.equal(await p.evaluate(()=>document.activeElement?.id),'gb-hl-fab','resize docking must preserve library opener focus');
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
