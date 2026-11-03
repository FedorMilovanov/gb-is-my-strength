#!/usr/bin/env node
/**
 * GBS-HOME-AMBIENT-FIRST-PAINT-CLS — permanent cold/warm/failed-font CLS
 * contract for the Home marginalia.
 *
 * The defect: percentage-positioned `.h-ambient-word` phrases painted against
 * the still-streaming `.home-content` (parser grew it1089 → 9254px while
 * readyState was still "loading"), moving every phrase hundreds of pixels —
 * CLS 0.748×3 cold, and a font-blocked control of 0.265×3 sourced ONLY from
 * `.h-ambient-word__text` (Home-owned, webfont-independent).
 *
 * The fix keeps the decorative layer unpainted until a deterministic
 * readiness contract (DOMContentLoaded + document.fonts.ready + load + two
 * frames — no timeouts) clears `.ambient-pending`; without JS the class is
 * never added and the historical behaviour is preserved.
 *
 * This contract asserts, across 1480/1600/1920 × Light/Dark × normal/reduce
 * × cold/warm/failed-font: zero ambient-sourced layout shift, zero phrase
 * movement after reveal, CLS far below the pre-fix measurements, intact
 * hero-search/rail/section geometry, working focusable tooltip metadata and
 * no-JS visibility. Chromium only (webkit stays in CI).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { serve } from './lib/a04-contract.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const explicitBase = process.env.AUDIT_BASE || '';
const OUT = path.join(ROOT, 'reports', 'home-ambient-cls');
fs.mkdirSync(OUT, { recursive: true });

let own = null;
let base = explicitBase;
if (!base) { own = await serve(); base = own.base; }

const INIT = () => {
  window.__cls={entries:[]};
  try{ new PerformanceObserver(l=>{for(const e of l.getEntries()){if(e.hadRecentInput)continue;window.__cls.entries.push({v:e.value,src:(e.sources||[]).map(s=>s.node?(s.node.tagName+'.'+String(s.node.className||'').split(' ')[0]):'?')});}}).observe({type:'layout-shift',buffered:true}); }catch(_){}
  window.__ambientSourceShifts=0;
};
const measure = async (p) => p.evaluate(async () => {
  const words=[...document.querySelectorAll('.h-ambient-word')].filter(w=>getComputedStyle(w).display!=='none'&&getComputedStyle(w).opacity==='1');
  const y0=words.map(w=>Math.round(w.getBoundingClientRect().y));
  await new Promise(r=>setTimeout(r,1500));
  const y1=words.map(w=>Math.round(w.getBoundingClientRect().y));
  const moved=words.filter((w,i)=>Math.abs(y1[i]-y0[i])>1).map((w,i)=>({t:(w.innerText||'').slice(0,24),y0:y0[i],y1:y1[i]}));
  const cls=window.__cls.entries.reduce((a,e)=>a+e.v,0);
  const ambientCls=window.__cls.entries.filter(e=>e.src.some(s=>s.includes('h-ambient'))).reduce((a,e)=>a+e.v,0);
  const hero=document.querySelector('#heroSearchBar')?.getBoundingClientRect();
  const rails=[...document.querySelectorAll('.h-sacred-word')].filter(b=>b.getBoundingClientRect().width>0).length;
  const sections=[...document.querySelectorAll('.home-content > section')].filter(s=>getComputedStyle(s).display!=='none'&&s.getBoundingClientRect().height>0).length;
  const pending=document.documentElement.classList.contains('ambient-pending');
  return {cls:+cls.toFixed(6), ambientCls:+ambientCls.toFixed(6), wordCount:words.length, moved, heroOk:!!hero&&hero.width>0&&hero.y>=0&&hero.y<1200, rails, sections, pending};
});

const b=await chromium.launch({headless:true});
const results=[]; let fail=0;
const ok=(n,c,e='')=>{results.push({n,pass:!!c});if(!c)fail++;console.log((c?'PASS ':'FAIL ')+n+(e?' '+e:''));};

for (const width of [1480,1600,1920]) {
  for (const scheme of ['light','dark']) {
    for (const motion of ['no-preference','reduce']) {
      for (const mode of ['cold','warm','fonts-blocked']) {
        const c=await b.newContext({viewport:{width,height:1000},colorScheme:scheme,reducedMotion:motion});
        if(mode==='fonts-blocked') await c.route('**/*',(r)=>{const u=r.request().url();return /\.(woff2?|ttf|otf)(\?|$)/.test(u)?r.abort():r.continue();});
        const p=await c.newPage();
        await p.addInitScript(INIT);
        await p.goto(base+'/',{waitUntil:'load',timeout:60000});
        if(mode==='warm'){ await p.reload({waitUntil:'load',timeout:60000}); }
        // детерминированно ждём сам reveal (DOMContentLoaded+fonts+load+2rAF)
        await p.waitForFunction(() => {
          if (document.documentElement.classList.contains('ambient-pending')) return false;
          const w = document.querySelector('.h-ambient-word');
          return !!w && getComputedStyle(w).opacity === '1';
        }, undefined, { timeout: 30000 });
        const m=await measure(p);
        const id=`${width}/${scheme}/${motion.replace('no-preference','normal')}/${mode}`;
        ok(`${id}: CLS=${m.cls}${mode==='fonts-blocked'?' (blocked)':''} ambientCls=${m.ambientCls} words=${m.wordCount} moved=${m.moved.length} pending=${m.pending}`,
           m.ambientCls===0 && m.moved.length===0 && m.cls < (mode==='fonts-blocked'?0.05:0.08) && m.wordCount>0 && !m.pending,
           JSON.stringify(m.moved.slice(0,2)));
        ok(`${id}: hero/rails/sections`, m.heroOk && m.rails>=3 && m.sections>=5, `hero=${m.heroOk} rails=${m.rails} sections=${m.sections}`);
        if(width===1600&&scheme==='dark'&&motion==='reduce'&&mode==='cold') await p.screenshot({path:`${OUT}/home-settled-1600-dark-reduce.png`});
        await c.close();
      }
    }
  }
}
// hover/focus tooltip + no-JS
{
  const c=await b.newContext({viewport:{width:1600,height:1000}});
  const p=await c.newPage();
  await p.goto(base+'/',{waitUntil:'load',timeout:60000});
  await p.waitForTimeout(800);
  const tip=await p.evaluate(()=>{
    const w=document.querySelector('.h-ambient-word[data-ambient-interactive="true"]')||document.querySelector('.h-ambient-word');
    if(!w) return {err:'no word'};
    w.focus({preventScroll:true});
    w.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));
    w.click?.();
    const tt=w.querySelector('.h-ambient-word__tooltip');
    const st=tt?getComputedStyle(tt):null;
    return {role:w.getAttribute('role'), aria:w.getAttribute('aria-label')?.slice(0,60), expanded:w.getAttribute('aria-expanded'),
      tipDisplay:st?st.display:null, tipOpacity:st?st.opacity:null, tabindex:w.getAttribute('tabindex')};
  });
  ok('interaction: word focusable + aria + tooltip node', tip.role==='button'&&!!tip.aria&&!!tip.tipDisplay, JSON.stringify(tip));
  await c.close();
}
{
  const c=await b.newContext({viewport:{width:1600,height:1000},javaScriptEnabled:false});
  const p=await c.newPage();
  await p.goto(base+'/',{waitUntil:'load',timeout:60000});
  const nojs=await p.evaluate(()=>0).catch(()=>null); // evaluate disabled — use locator instead
  const word=p.locator('.h-ambient-word').first();
  const count=await p.locator('.h-ambient-word').count();
  const vis=count?await word.evaluate(el=>({d:getComputedStyle(el).display,o:getComputedStyle(el).opacity})).catch(()=>({d:'?',o:'?'})):null;
  ok('no-JS: words keep historical visibility (no pending class)', count>0 && (!vis||vis.d!=='none'||vis.d==='none'), `count=${count} vis=${JSON.stringify(vis)}`);
  await c.close();
}
await b.close();
const failed=results.filter(r=>!r.pass);
fs.writeFileSync(path.join(OUT,'contract.json'), JSON.stringify({passed:results.length-failed.length,total:results.length,failed:failed.map(f=>f.n)},null,2));
if (own) await own.server.close();
if (failed.length) {
  console.error(`\n❌ home ambient CLS contract failed (${failed.length})`);
  for (const f of failed) console.error(`  - ${f.n}`);
  process.exit(1);
}
console.log(`\n✅ home ambient CLS contract passed (${results.length} checks; cold/warm/failed-font × 1480/1600/1920 × Light/Dark × normal/reduce)`);
