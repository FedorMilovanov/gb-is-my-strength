import { chromium } from 'playwright';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=browser.contexts()[0];
const p=await ctx.newPage();await p.setViewportSize({width:1024,height:900});
await p.goto('http://127.0.0.1:8080/articles/diotrefy-nashego-vremeni/',{waitUntil:'load'});await p.waitForTimeout(800);
console.log(await p.evaluate(`(()=>{const m=document.querySelector('main');const chain=[];let e=m;while(e&&e!==document.body){chain.push(e.tagName+(e.id?'#'+e.id:'')+(e.className?'.'+String(e.className).split(' ').slice(0,3).join('.'):''));e=e.parentElement;}return chain.join(' < ');})()`));
console.log(await p.evaluate(`(()=>{const m=document.querySelector('main');const cs=getComputedStyle(m);return JSON.stringify({w:cs.width,maxW:cs.maxWidth,ml:cs.marginLeft,mr:cs.marginRight,disp:cs.display,pos:cs.position});})()`));
// which stylesheet rule sets the width? match candidates
console.log(await p.evaluate(`(()=>{const m=document.querySelector('main');const out=[];for(const sh of document.styleSheets){let rules;try{rules=sh.cssRules}catch(e){continue}const walk=rs=>{for(const r of rs){if(r.cssRules){walk(r.cssRules);continue}if(r.selectorText&&/main/.test(r.selectorText)&&/width/.test(r.cssText))out.push(r.selectorText+' { '+r.style.cssText.slice(0,90)+' }');}};walk(rules);}return out.slice(0,14).join('\\n');})()`));
await p.close();await browser.close();
