import { chromium } from 'playwright';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
const p=await ctx.newPage();await p.setViewportSize({width:1024,height:900});
await p.goto('http://127.0.0.1:8080/articles/podrostok-za-kadrom-chto-delat-tserkvi/',{waitUntil:'load'});await p.waitForTimeout(800);
console.log(await p.evaluate(`(()=>{const w=document.querySelector('.page-wrap');const out=[];for(const sh of document.styleSheets){let rules;try{rules=sh.cssRules}catch(e){continue}const walk=(rs,ctxq)=>{for(const r of rs){if(r.cssRules){walk(r.cssRules,(ctxq||'')+(r.conditionText?'@'+r.conditionText.slice(0,40):'@layer'));continue}if(r.selectorText&&/page-wrap/.test(r.selectorText)&&(r.style.maxWidth||r.style.width||r.style.marginLeft))out.push((ctxq||'')+' '+r.selectorText.slice(0,80)+' { '+r.style.cssText.slice(0,110)+' }');}};walk(rules,'');}return out.join('\\n');})()`));
console.log('---inline/vars---');
console.log(await p.evaluate(`(()=>{const w=document.querySelector('.page-wrap');const cs=getComputedStyle(w);return JSON.stringify({maxW:cs.maxWidth,ml:cs.marginLeft,vars:[...new Set(['--gb-measure','--series-wrap','--wrap-max','--gbs2-article-measure','--gb-reader-measure'])].map(v=>v+'='+cs.getPropertyValue(v).trim()).join(' '), inline:w.getAttribute('style'), parent:w.parentElement.className});})()`));
await p.close();await browser.close();
