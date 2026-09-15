import { chromium } from 'playwright';
import fs from 'fs';
const BASE='http://127.0.0.1:8080';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
const FAMS=[
  ['gillA-1280','/articles/dzhon-gill-chast-1-chelovek/',1280,'.article-body > p'],
  ['gillB-1280','/articles/serdce-i-duh/',1280,'main.article-main article > p'],
  ['hrail-1280','/articles/lot-i-sodom/',1280,'.article-body > p'],
  ['nagornaya-1280','/nagornaya/chast-1/',1280,'main p, article p'],
  ['gillA-390','/articles/dzhon-gill-chast-1-chelovek/',390,'.article-body > p'],
  ['gillB-390','/articles/serdce-i-duh/',390,'main.article-main article > p'],
  ['hrail-390','/articles/lot-i-sodom/',390,'.article-body > p'],
];
const probe=sel=>`(()=>{const scope=document.querySelector('[data-reader-root]')||document;
 const ps=[...document.querySelectorAll('${sel}')].filter(p=>p.getBoundingClientRect().width>150&&!p.closest('.hmsheet,.hrail,.summary-card,.toc-sheet'));
 const s=ps[4]||ps[0];const c=s?getComputedStyle(s):null;
 return {bg:getComputedStyle(document.body).backgroundColor,font:c?parseFloat(c.fontSize):null,
  ratio:c?+(parseFloat(c.lineHeight)/parseFloat(c.fontSize)).toFixed(2):null,
  col:s?+s.getBoundingClientRect().width.toFixed(0):null};})()`;
const out={};
for(const [name,url,vp,sel] of FAMS){
  const p=await ctx.newPage();
  const cdp=await p.context().newCDPSession(p);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,90)));
  await p.setViewportSize({width:vp,height:900});
  await p.goto(BASE+url,{waitUntil:'load'});await p.waitForTimeout(700);
  await p.evaluate(`window.GBReaderPreferences&&GBReaderPreferences.set({theme:'light',lineHeight:'normal',measure:'normal',fontScale:1})`);
  await p.reload({waitUntil:'load'});await p.waitForTimeout(800);
  const row={steps:{},errors:[]};
  row.opener=await p.evaluate(`(()=>{const c=[...document.querySelectorAll('button,[role=button]')].find(b=>/астройк/i.test(b.getAttribute('aria-label')||''));if(c){c.click();return true;}return false;})()`);
  await p.waitForTimeout(450);
  if(!row.opener){out[name]=row;await p.close();continue;}
  const click=async(l)=>{const ok=await p.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].filter(x=>x.offsetParent).find(x=>(x.textContent||'').trim()==='${l}');if(b){b.click();return true;}return false;})()`);await p.waitForTimeout(320);return ok;};
  row.steps.base=await p.evaluate(probe(sel));
  row.steps['sepia']=await click('Сепия')?await p.evaluate(probe(sel)):'no-btn';
  row.steps['night']=await click('Ночь')?await p.evaluate(probe(sel)):'no-btn';
  await click('День');await p.waitForTimeout(220);
  row.steps['line-dense']=await click('Плотный')?await p.evaluate(probe(sel)):'no-btn';
  await click('Обычный');await p.waitForTimeout(200);
  row.steps['measure-narrow']=await click('Узкая')?await p.evaluate(probe(sel)):'no-btn';
  await click('Обычная');await p.waitForTimeout(200);
  await p.evaluate(`(()=>{const b=[...document.querySelectorAll('button')].filter(x=>x.offsetParent).find(x=>/увеличить/i.test(x.getAttribute('aria-label')||''));b&&b.click();})()`);
  await p.waitForTimeout(320);
  row.steps['font+1']=await p.evaluate(probe(sel));
  row.errors=errs;
  out[name]=row;
  await p.evaluate(`GBReaderPreferences.set({theme:'light',lineHeight:'normal',measure:'normal',fontScale:1})`);
  await p.close();
}
fs.writeFileSync('r-matrix.json',JSON.stringify(out,null,1));
for(const [k,v] of Object.entries(out)){
  if(!v.opener){console.log(k,'→ NO SETTINGS UI');continue;}
  const s=v.steps;
  console.log(k, '| base',JSON.stringify(s.base),'| sepia bg',s.sepia.bg,'| night bg',s.night.bg,'| dense ratio',s['line-dense'].ratio,'| narrow col',s['measure-narrow'].col,'| font+1',s['font+1'].font, v.errors.length?'ERR:'+v.errors:'');
}
await browser.close();
