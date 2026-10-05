#!/usr/bin/env node
/**
 * Regression test for mobile chrome invariants:
 * - leaked nav list under header when closed
 * - ghost text "Господь Бог — Сила Моя"
 * - search/back/buttons vertical bloat
 * - second floating row conflict (z-index/sticky/hydration)
 * - bottom bar too tall >96px
 * - Play/TTS badge not compact
 * - H1 clipped by sticky UI
 * - horizontal overflow
 *
 * This is NOT a screenshot-baseline acceptance test — it checks invariants.
 * Fails if any invariant is violated.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const DIST = join(process.cwd(), 'dist');
function routeFile(p){ const clean = decodeURIComponent(p.split('?')[0]).replace(/^\/+/,''); return join(DIST, clean, 'index.html'); }
async function serve(){
  const server = createServer(async (req,res)=>{
    try{
      const url = new URL(req.url||'/', 'http://127.0.0.1');
      let pathname = url.pathname;
      let file;
      if (pathname.startsWith('/_astro/') || pathname.startsWith('/css/') || pathname.startsWith('/fonts/') || pathname.startsWith('/js/') || pathname.startsWith('/images/') || pathname.startsWith('/icons/')) {
        file = join(DIST, pathname.replace(/^\/+/, ''));
        if (!existsSync(file)) { const alt = join(process.cwd(), pathname.replace(/^\/+/, '')); if(existsSync(alt)) file=alt; else { res.writeHead(404); res.end('not found '+pathname); return; } }
      } else {
        file = routeFile(pathname);
        try{ if((await stat(file)).isDirectory()) file=join(file,'index.html'); }catch{}
        if(!existsSync(file)){ const alt=join(DIST, pathname.replace(/^\/+/, '')); if(existsSync(alt)) file=alt; else { res.writeHead(404); res.end('not found '+pathname); return; } }
      }
      const data = await readFile(file);
      const ext = pathname.split('.').pop();
      let ct='text/html';
      if(ext==='css') ct='text/css';
      else if(ext==='js') ct='application/javascript';
      else if(ext==='woff2') ct='font/woff2';
      res.writeHead(200, {'content-type': ct, 'cache-control':'no-store'});
      res.end(data);
    }catch(e){ res.writeHead(500); res.end(String(e)); }
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return { server, origin:`http://127.0.0.1:${server.address().port}` };
}

const VIEWPORTS = [
  {w:320,h:760},
  {w:390,h:844},
  {w:430,h:932},
  {w:844,h:390},
];
const ROUTES = [
  '/articles/steven-lawson-samoobman-i-publichnyy-golos/',
  '/articles/kod-da-vinchi/',
  '/articles/lot-i-sodom/',
];

let failures = [];

const { server, origin } = await serve();
const browser = await chromium.launch({ executablePath:'/tmp/chrome.sh', args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] });

for (const route of ROUTES) {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport:{width:vp.w,height:vp.h}, isMobile:true, hasTouch:true });
    const page = await context.newPage();
    await page.goto(origin+route, {waitUntil:'networkidle'});
    await page.waitForTimeout(600);
    const result = await page.evaluate(()=>{
      const hmtop = document.querySelector('.hmtop');
      const hmbar = document.querySelector('.hmbar');
      const play = document.querySelector('.hm-ember');
      const badge = document.querySelector('.hm-spdbadge');
      const astroHeader = document.querySelector('.astro-header');
      const leakedNav = document.querySelector('.h-nav-links, .astro-header__nav');
      const hero = document.querySelector('h1');
      const floater = document.querySelector('.gb-floater');
      const fallback = document.querySelector('.gb-mobile-fallback-controls');
      const getRect = el=>el?el.getBoundingClientRect():null;
      const topRect = getRect(hmtop);
      const bottomRect = getRect(hmbar);
      const playRect = getRect(play);
      const badgeRect = getRect(badge);
      const heroRect = getRect(hero);
      const leakedRect = leakedNav?getRect(leakedNav):null;
      const floaterRect = floater?getRect(floater):null;
      const fallbackRect = fallback?getRect(fallback):null;

      const errors = [];

      // 1. Leaked nav list under header when closed
      if (leakedNav) {
        const style = getComputedStyle(leakedNav);
        if (style.display!=='none' && leakedRect && leakedRect.height>0 && leakedRect.width>0) {
          // Check if it's under header and visible
          if (leakedRect.top < 100) errors.push(`leaked nav visible: display=${style.display} h=${leakedRect.height} top=${leakedRect.top}`);
        }
      }

      // 2. Ghost text "Господь Бог — Сила Моя" - astro-header brand should be hidden on mobile when hmtop exists
      if (hmtop && astroHeader) {
        const style = getComputedStyle(astroHeader);
        const rect = getRect(astroHeader);
        if (style.display!=='none' && rect.width>0 && rect.height>0) {
          errors.push(`ghost astro-header visible: display=${style.display} h=${rect.height}`);
        }
      }

      // 3. Search/back/buttons vertical bloat - top bar height should be <=96, bottom <=96
      if (topRect && topRect.height>96) errors.push(`top bar too tall: ${topRect.height}px >96`);
      if (bottomRect && bottomRect.height>96) errors.push(`bottom bar too tall: ${bottomRect.height}px >96`);

      // 4. Second floating row conflict
      if (floaterRect && floater) {
        const style = getComputedStyle(floater);
        if (style.display!=='none' && floaterRect.width>0 && floaterRect.height>0) {
          errors.push(`second floating row .gb-floater visible: ${floaterRect.width}x${floaterRect.height}`);
        }
      }
      if (fallbackRect && fallback) {
        const style = getComputedStyle(fallback);
        if (style.display!=='none' && fallbackRect.width>0 && fallbackRect.height>0) {
          errors.push(`second floating row .gb-mobile-fallback-controls visible: ${fallbackRect.width}x${fallbackRect.height}`);
        }
      }

      // 5. Play/TTS badge not compact
      if (playRect && badgeRect) {
        const gap = Math.abs(badgeRect.left - playRect.right);
        if (gap>=60) errors.push(`badge not compact: gap ${gap}px >=60`);
        if (playRect.width<30 || playRect.height<30) errors.push(`play too small: ${playRect.width}x${playRect.height}`);
        if (badgeRect.width>50 || badgeRect.height>35) errors.push(`badge too large: ${badgeRect.width}x${badgeRect.height}`);
      } else {
        // These routes should have play+ badge — check if play element exists at all
        const hasPlay = !!document.querySelector('.hm-ember, .gb-ember');
        if (!hasPlay) errors.push('play missing');
      }

      // 6. H1 clipped
      if (heroRect && topRect) {
        if (heroRect.top < topRect.bottom -5) errors.push(`H1 clipped: hero top ${heroRect.top} < topbar bottom ${topRect.bottom}`);
      }

      // 7. Horizontal overflow
      if (document.documentElement.scrollWidth > window.innerWidth + 2) {
        errors.push(`horizontal overflow: scrollWidth ${document.documentElement.scrollWidth} > innerWidth ${window.innerWidth}`);
      }

      // 8. Sticky overlap
      if (topRect && bottomRect) {
        if (topRect.bottom + 10 >= bottomRect.top) errors.push(`sticky overlap: top bottom ${topRect.bottom} >= bottom top ${bottomRect.top}`);
      }

      return { errors, topH: topRect?.height, bottomH: bottomRect?.height, playW: playRect?.width, badgeGap: playRect&&badgeRect?Math.abs(badgeRect.left-playRect.right):null };
    });

    if (result.errors.length>0) {
      failures.push({route, viewport:`${vp.w}x${vp.h}`, errors: result.errors, metrics: result});
      console.error(`❌ FAIL ${route} ${vp.w}x${vp.h}: ${result.errors.join('; ')} | topH=${result.topH} bottomH=${result.bottomH} playW=${result.playW} gap=${result.badgeGap}`);
    } else {
      console.log(`✅ PASS ${route} ${vp.w}x${vp.h} topH=${result.topH} bottomH=${result.bottomH} playW=${result.playW} gap=${result.badgeGap}`);
    }
    await context.close();
  }
}

await browser.close();
server.close();

if (failures.length>0) {
  console.error(`\n${failures.length} invariant failures`);
  process.exit(1);
} else {
  console.log('\nAll invariants PASS — no leaked menu, no ghost text, no oversized chrome, no second row, compact playback, no H1 clip, no overflow');
  process.exit(0);
}
