import { chromium } from 'playwright';
import fs from 'fs';
const BASE='http://127.0.0.1:8080';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
{ // the 649 group: centring + cap source
  const p=await ctx.newPage();await p.setViewportSize({width:1024,height:900});
  await p.goto(BASE+'/articles/podrostok-za-kadrom-chto-delat-tserkvi/',{waitUntil:'load'});await p.waitForTimeout(800);
  const r=await p.evaluate(`(()=>{const vw=document.documentElement.clientWidth;
    const ps=[...document.querySelectorAll('article p, main p')].filter(x=>x.getBoundingClientRect().width>60);
    const rr=ps.map(x=>x.getBoundingClientRect());
    const wr=document.querySelector('.page-wrap'), m=document.querySelector('main');
    return {vw, minL:+Math.min(...rr.map(x=>x.left)).toFixed(0), maxR:+Math.max(...rr.map(x=>x.right)).toFixed(0),
      drift:+(((Math.max(...rr.map(x=>x.right))+Math.min(...rr.map(x=>x.left)))/2)-vw/2).toFixed(0),
      wrap:wr?+wr.getBoundingClientRect().width.toFixed(0)+' left='+wr.getBoundingClientRect().left.toFixed(0):null,
      mainCls:m?.className, gillv16:!!document.querySelector('[data-gill-v16]'),
      gbMeasure:getComputedStyle(document.documentElement).getPropertyValue('--gb-measure').trim(),
      gbs2Measure:getComputedStyle(document.documentElement).getPropertyValue('--gbs2-article-measure').trim()};})()`);
  console.log('649-group probe:',JSON.stringify(r));
  await p.close();
}
{ // after shots
  const shots=[
    ['fix-b-1024','/articles/serdce-i-duh/',1024,900],
    ['fix-b-1280','/articles/serdce-i-duh/',1280,900],
    ['fix-a-1920','/articles/dzhon-gill-chast-1-chelovek/',1920,1000],
    ['fix-b-mobile-narrow','/articles/serdce-i-duh/',390,844],
    ['fix-hrail-sepia','/articles/lot-i-sodom/',1280,900],
  ];
  for(const [name,url,w,h] of shots){
    const p=await ctx.newPage();await p.setViewportSize({width:w,height:900});
    await p.setViewportSize({width:w,height:h});
    await p.goto(BASE+url,{waitUntil:'load'});await p.waitForTimeout(900);
    if(name==='fix-b-mobile-narrow'){await p.evaluate(`GBReaderPreferences.set({measure:'narrow'})`);await p.waitForTimeout(300);}
    if(name==='fix-hrail-sepia'){await p.evaluate(`GBReaderPreferences.set({theme:'sepia'})`);await p.waitForTimeout(300);
      await p.evaluate(`document.getElementById('hmSettingsBtn')?.click()||document.querySelector('[data-hm-open-settings],.hm-setbtn')?.click()`);await p.waitForTimeout(500);}
    await p.screenshot({path:'shots/'+name+'.png'});
    if(name==='fix-b-mobile-narrow'||name==='fix-hrail-sepia'){await p.evaluate(`GBReaderPreferences.set({measure:'normal',theme:'light'})`);}
    console.log('shot',name);
    await p.close();
  }
}
await browser.close();
