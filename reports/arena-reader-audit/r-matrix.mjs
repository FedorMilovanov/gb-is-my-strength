import { chromium } from 'playwright';
import fs from 'fs';
const BASE='http://127.0.0.1:8080';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
const FAMS=[
  ['gillA-1280','/articles/dzhon-gill-chast-1-chelovek/',1280,'.article-body > p'],
  ['gillB-1280','/articles/serdce-i-duh/',1280,'main.article-main article > p'],
  ['hrail-1280','/articles/lot-i-sodom/',1280,'.article-body > p, main p'],
  ['nagornaya-1280','/nagornaya/chast-1/',1280,'main p, article p'],
  ['gillA-390','/articles/dzhon-gill-chast-1-chelovek/',390,'.article-body > p'],
  ['gillB-390','/articles/serdce-i-duh/',390,'main.article-main article > p'],
  ['hrail-390','/articles/lot-i-sodom/',390,'.article-body > p, main p'],
];
const probe=sel=>`(()=>{const ps=[...document.querySelectorAll('${sel}')].filter(p=>p.getBoundingClientRect().width>80);
 const s=ps[4]||ps[0];const c=s?getComputedStyle(s):null;
 return {bg:getComputedStyle(document.body).backgroundColor,
  font:c?parseFloat(c.fontSize):null, ratio:c?+(parseFloat(c.lineHeight)/parseFloat(c.fontSize)).toFixed(2):null,
  col:s?+s.getBoundingClientRect().width.toFixed(0):null};})()`;
const out={};
for(const [name,url,vp,sel] of FAMS){
  const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,90)));
  await p.setViewportSize({width:vp,height:900});
  await p.goto(BASE+url,{waitUntil:'load'});await p.waitForTimeout(900);
  const row={open:null,steps:{},errors:[]};
  // find opener
  const opener=await p.evaluate(`(()=>{const c=[...document.querySelectorAll('button,[role=button]')].find(b=>/астройк|reading settings/i.test((b.getAttribute('aria-label')||'')));if(c){c.click();return (c.getAttribute('aria-label')||c.className).slice(0,40);}return null;})()`);
  row.open=opener;
  await p.waitForTimeout(500);
  if(!opener){out[name]=row;await p.close();continue;}
  const click=async(label)=>{const ok=await p.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].filter(x=>x.offsetParent).find(x=>(x.textContent||'').trim()==='${label}');if(b){b.click();return true;}return false;})()`);await p.waitForTimeout(350);return ok;};
  row.steps.base=await p.evaluate(probe(sel));
  row.steps.sepia=await click('Сепия')?await p.evaluate(probe(sel)):'no-btn';
  row.steps.night=await click('Ночь')?await p.evaluate(probe(sel)):'no-btn';
  await click('День');await p.waitForTimeout(250);
  row.steps.dense=await click('Плотный')?await p.evaluate(probe(sel)):'no-btn';
  await click('Обычный');await p.waitForTimeout(200);
  row.steps.narrow=await click('Узкая')?await p.evaluate(probe(sel)):'no-btn';
  await click('Обычная');await p.waitForTimeout(200);
  row.steps.fontPlus=await p.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].filter(x=>x.offsetParent).find(x=>/увеличить|крупнее/i.test(x.getAttribute('aria-label')||''));if(b){b.click();return true;}return false;})()`);
  await p.waitForTimeout(350);row.steps.afterFont=await p.evaluate(probe(sel));
  row.errors=errs;
  out[name]=row;
  await p.evaluate(`window.GBReaderPreferences&&GBReaderPreferences.set({theme:'light',lineHeight:'normal',measure:'normal',fontScale:1})`);
  await p.close();
}
fs.writeFileSync('r-matrix.json',JSON.stringify(out,null,1));
for(const [k,v] of Object.entries(out)){
  console.log('==',k,'opener:',v.open);
  if(!v.open){console.log('   NO SETTINGS UI');continue;}
  for(const [s,r] of Object.entries(v.steps))console.log('  ',s,JSON.stringify(r));
  if(v.errors.length)console.log('   errors:',v.errors);
}
await browser.close();
