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
import { readFile, stat, realpath } from 'node:fs/promises';
import { join, resolve, sep, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const DIST = resolve(process.cwd(), 'dist');
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
};
async function resolveRequest(requestUrl, physicalRoot) {
  const pathname = decodeURIComponent(new URL(requestUrl || '/', 'http://127.0.0.1').pathname);
  if (pathname.includes('\\') || pathname.includes('\0')) return null;
  const candidate = resolve(physicalRoot, '.' + pathname);
  if (candidate !== physicalRoot && !candidate.startsWith(physicalRoot + sep)) return null;
  for (const file of [candidate, join(candidate, 'index.html')]) {
    try {
      const physicalFile = await realpath(file);
      if (physicalFile !== physicalRoot && !physicalFile.startsWith(physicalRoot + sep)) return null;
      if ((await stat(physicalFile)).isFile()) return physicalFile;
    } catch (error) { if (!['ENOENT','ENOTDIR','ELOOP'].includes(error?.code)) throw error; }
  }
  return null;
}
async function serve() {
  const physicalRoot = await realpath(DIST);
  if (!(await stat(physicalRoot)).isDirectory()) throw new Error('dist is not a directory');
  const server = createServer(async (req, res) => {
    try {
      const file = await resolveRequest(req.url, physicalRoot);
      if (!file) { res.writeHead(404); res.end('Not found'); return; }
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': CONTENT_TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    } catch (error) {
      res.writeHead(error instanceof URIError ? 400 : 500);
      res.end('Static fixture request failed');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

async function closeServer(server) {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
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

export function inspectMobileChrome(lawson) {
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

      function inspectLawsonMobilePresence() {
        const errors = [];
        const one = (selector, name) => {
          const nodes = document.querySelectorAll(selector);
          if (nodes.length !== 1) { errors.push(name + ': expected exactly one, got ' + nodes.length); return null; }
          return nodes[0];
        };
        const shell = one('[data-mobile-chrome]', 'mobile shell');
        const top = one('.hmtop', 'top bar'), bottom = one('.hmbar', 'bottom bar');
        const play = one('.hm-ember', 'Play'), badge = one('.hm-spdbadge', 'speed badge'), hero = one('h1', 'H1');
        if (shell && shell.dataset.mobileChromeEngine !== 'article') errors.push('wrong mobile shell engine');
        for (const [el, attr] of [[top,'data-mobile-topbar'], [bottom,'data-mobile-bottombar']]) {
          if (el && (el.parentElement !== shell || !el.hasAttribute(attr))) errors.push(attr + ': wrong owner');
        }
        for (const [el,name] of [[play,'Play'],[badge,'speed badge']]) if (el && (!top || !top.contains(el))) errors.push(name + ': wrong owner');
        if (play && badge && (!play.closest('.reader-mobile-play-group') || play.closest('.reader-mobile-play-group') !== badge.closest('.reader-mobile-play-group'))) errors.push('Play and badge must share canonical group');
        const w = document.documentElement.clientWidth, h = window.innerHeight;
        function visible(el, name, full) {
          if (!el) return;
          const r = el.getBoundingClientRect(), css = getComputedStyle(el);
          let opacity = 1;
          for (let a=el; a; a=a.parentElement) opacity *= Number(getComputedStyle(a).opacity);
          if (!r.width || !r.height || css.visibility !== 'visible' || opacity <= 0 || el.closest('[hidden],[inert],[aria-hidden="true"]')) errors.push(name + ': not visible/available');
          if (!(r.left < w && r.right > 0 && r.top < h && r.bottom > 0)) errors.push(name + ': outside viewport');
          if (full && (r.left < -1 || r.right > w+1 || r.top < -1 || r.bottom > h+1)) errors.push(name + ': clipped by viewport');
        }
        for (const [el,name] of [[top,'top bar'],[bottom,'bottom bar'],[play,'Play'],[badge,'speed badge']]) visible(el,name,true);
        visible(hero,'H1',false);
        if (hero && !hero.textContent.trim()) errors.push('H1: empty');
        for (const [el,name] of [[play,'Play'],[badge,'speed badge']]) {
          if (!el) continue;
          if (el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true') errors.push(name + ': disabled');
          const r=el.getBoundingClientRect();
          if (r.width>0 && r.height>0) {
            const hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
            if (!hit || !el.contains(hit)) errors.push(name + ': pointer target blocked');
          }
        }
        return errors;
      }
      const errors = lawson ? inspectLawsonMobilePresence() : [];

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
      } else if (!lawson) {
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
}

// Reuse the existing dist server and regression runner for actual Lawson
// interaction evidence. No alternate production route or fixture renderer.
async function inspectLawsonCards(page, capture) {
  const result = [];
  for (const [kind, triggerSelector, cardSelector, destinationSelector] of [
    ['source', '.lawson-source-ref > button', '.lawson-source-popover', '.lawson-source-bibliography'],
    ['term', '.lawson-term[data-enhanced] > .lawson-term-label', '.lawson-term-popover', '.lawson-term-return'],
  ]) {
    const trigger = page.locator(triggerSelector).first();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    await trigger.press('Enter');
    const card = page.locator(cardSelector + ':not([hidden])');
    if (await card.count() !== 1 || !await card.isVisible()) throw new Error(kind + ': expected one open card');
    const metrics = await card.evaluate((el, selector) => {
      const r=el.getBoundingClientRect(), shell=document.querySelector('[data-mobile-chrome][data-mobile-chrome-engine="article"]');
      const top=shell?.querySelector('[data-mobile-topbar]'), bottom=shell?.querySelector('[data-mobile-bottombar]');
      const mobile=matchMedia('(max-width: 1199px)').matches;
      const link=el.querySelector(selector), dest=link&&document.getElementById(decodeURIComponent(link.hash.slice(1)));
      const heading=el.querySelector('strong')?.textContent?.trim();
      return {rect:r.toJSON(),viewport:{width:document.documentElement.clientWidth,height:document.documentElement.clientHeight},
        topClearance:mobile?(top?.offsetHeight??0):0,bottomClearance:mobile?(bottom?.offsetHeight??0):0,
        heading,href:link?.getAttribute('href'),destination:dest?.id,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight};
    },destinationSelector);
    const {rect:r,viewport:v}=metrics;
    if(!metrics.heading||!metrics.destination||r.width<=0||r.height<=0||
      r.left< -1||r.right>v.width+1||r.top<metrics.topClearance-1||r.bottom>v.height-metrics.bottomClearance+1)
      throw new Error(kind + ': card geometry or native destination: ' + JSON.stringify(metrics));
    const action = card.locator(destinationSelector);
    await action.scrollIntoViewIfNeeded();
    const hit=await action.evaluate(el=>{const r=el.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.height>=44&&!!h&&el.contains(h)});
    if(!hit)throw new Error(kind + ': destination action blocked or smaller than 44px');
    if(capture)await capture(kind);
    await action.focus();
    await page.keyboard.press('Escape');
    if(await card.count()!==0||!await trigger.evaluate(el=>el===document.activeElement))
      throw new Error(kind + ': Escape did not close and restore focus');
    await trigger.press('Enter');
    await page.locator(cardSelector + ':not([hidden])').locator(destinationSelector).click();
    await page.waitForFunction(id=>location.hash==='#'+id&&document.activeElement?.id===id,metrics.destination);
    if(await card.count()!==0)throw new Error(kind + ': destination left card open');
    result.push({kind,...metrics,hit,escape:true,destinationFocus:true});
  }
  return result;
}

async function main() {
  const failures = [];
  const { server, origin } = await serve();
  let browser;
  try {
    browser = await chromium.launch({ args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] });
    for (const route of ROUTES) {
      for (const vp of VIEWPORTS) {
        const context = await browser.newContext({ viewport:{width:vp.w,height:vp.h}, isMobile:true, hasTouch:true });
        try {
          const page = await context.newPage();
          const response = await page.goto(origin+route, {waitUntil:'networkidle'});
          if (!response?.ok()) throw new Error(`Route failed: ${route} (${response?.status()})`);
          await page.waitForTimeout(600);
          const result = await page.evaluate(inspectMobileChrome, route === ROUTES[0]);
          if (route === ROUTES[0] && result.errors.length === 0) {
            result.cards = await inspectLawsonCards(page);
          }
          if (result.errors.length>0) {
            failures.push({route, viewport:`${vp.w}x${vp.h}`, errors: result.errors, metrics: result});
            console.error(`❌ FAIL ${route} ${vp.w}x${vp.h}: ${result.errors.join('; ')} | topH=${result.topH} bottomH=${result.bottomH} playW=${result.playW} gap=${result.badgeGap}`);
          } else {
            console.log(`✅ PASS ${route} ${vp.w}x${vp.h} topH=${result.topH} bottomH=${result.bottomH} playW=${result.playW} gap=${result.badgeGap}`);
          }
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    try {
      await browser?.close();
    } finally {
      await closeServer(server);
    }
  }
  if (failures.length>0) {
    console.error(`\n${failures.length} invariant failures`);
    process.exitCode = 1;
  } else {
    console.log('\nAll invariants PASS — no leaked menu, no ghost text, no oversized chrome, no second row, compact playback, no H1 clip, no overflow');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
