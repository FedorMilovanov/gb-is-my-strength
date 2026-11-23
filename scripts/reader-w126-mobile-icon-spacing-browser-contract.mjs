import fs from 'node:fs';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
const BASE=process.env.AUDIT_BASE||'http://127.0.0.1:8618';
const ARTICLE='/articles/dzhon-gill-chast-2-uchenyi/';
const OUT=path.join('reports','w126-mobile-toolbar');
fs.mkdirSync(OUT,{recursive:true});
let count=0;const failures=[];
function ck(label,pass,info=''){count++;console.log((pass?'PASS ':'FAIL ')+label+(info?' :: '+info:''));if(!pass)failures.push({label,info});}
const close=(a,b,eps=.51)=>typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<=eps;
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});
 try{
  for(const [width,theme] of [[320,'light'],[360,'light'],[375,'light'],[390,'light'],[390,'dark'],[400,'light'],[430,'light'],[439,'light'],[440,'light'],[480,'light'],[525,'light'],[768,'light'],[1120,'light']]){
   const tag=name+' '+width+' '+theme;
   const context=await browser.newContext({viewport:{width,height:844},colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block'});
   await context.route(/^https:\/\/mc\.yandex\.(?:ru|com)\//i,r=>r.fulfill({status:200,body:'',contentType:'text/plain'}));
   const page=await context.newPage();const errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   try{
    const response=await page.goto(BASE+ARTICLE,{waitUntil:'domcontentloaded',timeout:25000});
    ck(tag+' HTTP200',response?.status()===200);
    await page.locator('.mobile-top-bar .reader-mobile-top-search').waitFor({timeout:13000});
    const m=await page.evaluate(()=>{
      const bar=document.querySelector('.mobile-top-bar'),lower=document.querySelector('.mobile-bottom-bar');
      const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,right:r.right,center:r.x+r.width/2,width:r.width,height:r.height};};
      const boxesSelectors={play:'.reader-mobile-play',search:'.reader-mobile-top-search',settings:'#mobSettingsBtn',save:'.mobile-top-save'};
      const inkSelectors={play:'.reader-mobile-play .gb-ember__ring-svg',search:'.reader-mobile-top-search svg',settings:'#mobSettingsBtn svg',save:'.mobile-top-save svg'};
      const boxes=Object.fromEntries(Object.entries(boxesSelectors).map(([k,s])=>[k,rect(bar.querySelector(s)||lower?.querySelector(s))]));
      const ink=Object.fromEntries(Object.entries(inkSelectors).map(([k,s])=>[k,rect(bar.querySelector(s)||lower?.querySelector(s))]));
      const style=Object.fromEntries(Object.entries(inkSelectors).map(([k,s])=>{
        const e=bar.querySelector(s);return[k,e?{translate:getComputedStyle(e).translate,transform:getComputedStyle(e).transform}:null];
      }));
      return{boxes,ink,style,saveTop:!!bar.querySelector('.mobile-top-save'),
        saveBottom:!!lower?.querySelector('.reader-mobile-action-cluster>.mobile-top-save'),
        saveCount:document.querySelectorAll('.mobile-top-save').length,
        searchCount:bar.querySelectorAll('.reader-mobile-top-search').length,
        xOverflow:document.documentElement.scrollWidth-innerWidth};
    });
    ck(tag+' only one Save and Search',m.saveCount===1&&m.searchCount===1);
    ck(tag+' independent 44px targets',['play','search','settings','save'].every(k=>m.boxes[k]?.width>=44&&m.boxes[k]?.height>=44));
    ck(tag+' no horizontal overflow',m.xOverflow<=1,'overflow='+m.xOverflow);
    const pitchPS=m.ink.search.center-m.ink.play.center;
    const pitchSS=m.ink.settings.center-m.ink.search.center;
    ck(tag+' centre pitch Play/Search = Search/Settings',close(pitchPS,pitchSS,.55),pitchPS.toFixed(2)+' / '+pitchSS.toFixed(2));
    ck(tag+' Search/Settings glyphs centred in hit targets',['search','settings'].every(k=>close(m.ink[k].center,m.boxes[k].center,.55)));
    ck(tag+' adjacent tap targets do not overlap',m.boxes.play.right<=m.boxes.search.x+1&&m.boxes.search.right<=m.boxes.settings.x+1);
    if(width>=440){
      ck(tag+' Save remains on top',m.saveTop&&!m.saveBottom);
      const pitches=[pitchPS,pitchSS,m.ink.save.center-m.ink.settings.center];
      const gapSS=m.ink.settings.x-m.ink.search.right,gapSF=m.ink.save.x-m.ink.settings.right;
      ck(tag+' all 4 icon centres uniform',Math.max(...pitches)-Math.min(...pitches)<=.55,JSON.stringify(pitches.map(x=>+x.toFixed(2))));
      ck(tag+' visible gaps Search/Settings and Settings/Save match',close(gapSS,gapSF,.7),gapSS.toFixed(2)+' / '+gapSF.toFixed(2));
      ck(tag+' no individual Save glyph nudge',close(m.ink.save.center,m.boxes.save.center,.55),JSON.stringify(m.style.save));
      ck(tag+' no SVG translation overrides',m.style.search.translate==='none'&&['none','0px'].includes(m.style.settings.translate)&&m.style.save.translate==='none');
    }else{
      ck(tag+' Save moves to lower row without copy',m.saveBottom&&!m.saveTop);
    }
    ck(tag+' no uncaught page errors',errors.length===0,errors.join('|').slice(0,140));
    if((width===390||width===440||width===525)&&theme==='light'){
      await page.screenshot({path:path.join(OUT,name+'-'+width+'-topbar.png')});
      await page.locator('.reader-mobile-top-search').click();
      ck(tag+' Search opens one Pagefind palette',await page.locator('.cp-backdrop.is-open').waitFor({timeout:11000}).then(()=>true).catch(()=>false));
      await page.keyboard.press('Escape');
      await page.locator('#mobSettingsBtn').click();
      ck(tag+' Settings opens',await page.locator('#gillSettingsOverlay.is-open').count()===1);
    }
   }catch(e){ck(tag+' unexpected exception',false,String(e).slice(0,350));}
   finally{await context.close();}
  }
 }finally{await browser.close();}
}
fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify({count,failures},null,2));
console.log('W126_QA '+(count-failures.length)+'/'+count+' PASS');
if(failures.length)process.exitCode=1;
