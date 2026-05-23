process.env.PLAYWRIGHT_BROWSERS_PATH = require('path').join(process.cwd(), '.playwright-browsers');
const {chromium} = require('playwright');
const fs = require('fs');
const path = require('path');

const PAGES = [
  '/', '/about/', '/articles/', '/articles/kod-da-vinchi/',
  '/nagornaya/', '/nagornaya/chast-1/', '/pastor-series/', '/404.html'
];
const BASE = process.env.AUDIT_BASE || 'https://gospod-bog.ru';

(async ()=>{
  const b = await chromium.launch({args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const results = [];

  for (const vp of [{name:'mobile',w:375,h:812},{name:'desktop',w:1440,h:900}]) {
    for (const u of PAGES) {
      const ctx = await b.newContext({viewport:{width:vp.w,height:vp.h}});
      const p = await ctx.newPage();
      try {
        await p.goto(BASE+u,{waitUntil:'domcontentloaded',timeout:25000});
        await p.waitForTimeout(2000);
        const checks = await p.evaluate(()=>{
          const out = [];
          // 1) skip-link visible above the fold
          const sl = document.querySelector('.skip-link');
          if (sl) {
            const r = sl.getBoundingClientRect();
            const cs = getComputedStyle(sl);
            // visible if any portion is on-screen and not focused
            if (r.bottom > 0 && r.top < window.innerHeight && document.activeElement !== sl) {
              out.push({k:'skip-link-leak',d:`top=${cs.top} but rect=${JSON.stringify({t:Math.round(r.top),h:Math.round(r.height)})} (bottom=${Math.round(r.bottom)})`});
            }
          }
          // 2) elements with NaN positioning
          document.querySelectorAll('*').forEach(el=>{
            const r = el.getBoundingClientRect();
            if (isNaN(r.width) || isNaN(r.height)) out.push({k:'NaN-layout',d:el.tagName});
          });
          // 3) negative-top elements that are partially visible (other than .skip-link)
          document.querySelectorAll('body *').forEach(el=>{
            if (el.classList.contains('skip-link')) return;
            const cs = getComputedStyle(el);
            if (cs.position === 'absolute' || cs.position === 'fixed') {
              const r = el.getBoundingClientRect();
              if (r.top < 0 && r.bottom > 0 && r.height < 100 && r.width > 20) {
                // is it actually visible (not hidden via clip/overflow)?
                const parent = el.parentElement;
                const pcs = parent && getComputedStyle(parent);
                if (!pcs || pcs.overflow === 'visible') {
                  // ignore tiny decorative or aria-hidden things
                  if (cs.opacity === '0' || cs.visibility === 'hidden') return;
                  if (el.getAttribute('aria-hidden') === 'true') return;
                  out.push({k:'partial-top-leak',d:`${el.tagName}.${(el.className||'').toString().slice(0,40)} top=${Math.round(r.top)} bottom=${Math.round(r.bottom)}`});
                }
              }
            }
          });
          // 4) viewport sizing issues — body width > viewport
          if (document.body.scrollWidth > window.innerWidth + 1) {
            out.push({k:'body-overflow',d:`body=${document.body.scrollWidth} win=${window.innerWidth}`});
          }
          // 5) sticky elements that have z-index 0 / unset
          // 6) elements with position:sticky but no top set (silent no-op)
          document.querySelectorAll('*').forEach(el=>{
            const cs = getComputedStyle(el);
            if (cs.position === 'sticky') {
              if (cs.top === 'auto' && cs.bottom === 'auto' && cs.left === 'auto' && cs.right === 'auto') {
                out.push({k:'sticky-noop',d:`${el.tagName}.${(el.className||'').toString().slice(0,40)} sticky but no inset`});
              }
            }
          });
          // 7) duplicate IDs
          const ids = {};
          document.querySelectorAll('[id]').forEach(el=>{ids[el.id]=(ids[el.id]||0)+1;});
          Object.entries(ids).forEach(([id,n])=>{if(n>1) out.push({k:'dup-id',d:`#${id} ×${n}`});});
          // 8) images without alt
          document.querySelectorAll('img').forEach(img=>{
            if (!img.hasAttribute('alt')) out.push({k:'img-no-alt',d:(img.currentSrc||img.src).slice(0,80)});
          });
          // 9) buttons without accessible name
          document.querySelectorAll('button').forEach(btn=>{
            const r = btn.getBoundingClientRect();
            if (r.width < 4 && r.height < 4) return; // hidden
            const cs = getComputedStyle(btn);
            if (cs.display === 'none' || cs.visibility === 'hidden') return;
            const name = (btn.innerText||'').trim() || btn.getAttribute('aria-label') || btn.getAttribute('title');
            if (!name && !btn.querySelector('svg,img[alt]')) {
              out.push({k:'btn-no-name',d:btn.outerHTML.slice(0,100)});
            }
          });
          // 10) tiny click targets in main content (< 32px)
          document.querySelectorAll('a,button').forEach(el=>{
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            if (cs.display==='none'||cs.visibility==='hidden') return;
            if (r.width===0 && r.height===0) return;
            // ignore inline links inside paragraphs
            const parent = el.closest('p,li,blockquote,td,th');
            if (parent) return;
            if (r.height > 0 && r.height < 24) {
              // ignore footnote markers etc by class
              if (/fn|hb-w|emoji/i.test(el.className.toString())) return;
              out.push({k:'tiny-target',d:`${el.tagName}.${(el.className||'').toString().slice(0,40)} ${Math.round(r.width)}×${Math.round(r.height)}`});
            }
          });
          // 11) hardcoded http:// links
          document.querySelectorAll('a[href^="http://"], img[src^="http://"]').forEach(el=>{
            out.push({k:'mixed-content',d:el.getAttribute('href')||el.getAttribute('src')});
          });
          return out;
        });
        if (checks.length) {
          checks.forEach(c=>results.push({page:u,viewport:vp.name,...c}));
        }
      } catch (e) {
        results.push({page:u,viewport:vp.name,k:'crash',d:e.message.slice(0,200)});
      }
      await p.close();
      await ctx.close();
    }
  }
  await b.close();
  // dedupe identical findings
  const seen = new Set();
  const unique = results.filter(r=>{
    const k = `${r.page}|${r.viewport}|${r.k}|${r.d}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  fs.writeFileSync('deep-check.json', JSON.stringify(unique,null,2));
  console.log(`Total findings: ${unique.length}`);
  // Group by kind
  const byKind = {};
  unique.forEach(u=>{byKind[u.k]=(byKind[u.k]||0)+1;});
  console.log('By kind:', byKind);
  // Print first 5 of each kind
  Object.keys(byKind).forEach(k=>{
    console.log(`\n[${k}]`);
    unique.filter(u=>u.k===k).slice(0,3).forEach(u=>{
      console.log(`  ${u.viewport.padEnd(7)} ${u.page} :: ${u.d}`);
    });
  });
})();
