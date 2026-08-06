#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const REPORTS = path.join(ROOT, 'reports');
const ROUTE = '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const MARKER = '[data-audit-footnote="40"]';
const FOOT_TIP = '.tooltip.gb-floating-tip.is-open';
const GLOSSARY = '[data-audit-glossary]';
const GLOSSARY_TIP = '.gtip.gb-floating-tip.is-open';
const OWNED = ['.gterm', '.fn-marker', '.bref[data-ref]'];
const MIME = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.bin':'application/octet-stream' };
fs.mkdirSync(REPORTS, { recursive: true });
assert.ok(fs.existsSync(DIST), 'production-like dist is required');

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const pathname = decodeURIComponent((request.url || '/').split('?')[0]);
      let target = path.join(DIST, pathname.replace(/^\/+/, ''));
      if (pathname.endsWith('/') || !path.extname(target)) target = path.join(target, 'index.html');
      if (!target.startsWith(DIST) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        response.writeHead(404); response.end('not found'); return;
      }
      response.writeHead(200, { 'content-type': MIME[path.extname(target)] || 'application/octet-stream', 'cache-control':'no-store' });
      fs.createReadStream(target).pipe(response);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, origin:`http://127.0.0.1:${server.address().port}` }));
  });
}

const checks = [];
const record = (id, description, pass, evidence = null) => checks.push({ id, area:'tooltip-handoff', description, pass:Boolean(pass), evidence });
const twoFrames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function instrumentFootnote(page) {
  return page.evaluate(() => {
    const direct = (el) => Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent || '').join('').replace(/\s+/g, '').trim();
    const marker = Array.from(document.querySelectorAll('.fn-marker')).find((el) => direct(el) === '40');
    if (!marker) return false;
    marker.dataset.auditFootnote = '40';
    return marker.querySelector('.tooltip') instanceof Element;
  });
}

async function instrumentGlossary(page) {
  return page.evaluate(() => {
    const term = Array.from(document.querySelectorAll('.article-body .gterm')).find((el) => !el.closest('.summary-card') && el.querySelector('.gtip [data-gtip-expand]') && el.querySelector('.gtip .gtip-detail-wrap') && el.querySelector('.gtip .gtip-papyrus'));
    if (!term) return false;
    term.dataset.auditGlossary = '1';
    return true;
  });
}

async function quiet(page, quietMs = 350, timeoutMs = 5000) {
  return page.evaluate(({ quietMs, timeoutMs }) => new Promise((resolve) => {
    let quietTimer = 0; let timeoutTimer = 0;
    const finish = (isQuiet) => { clearTimeout(quietTimer); clearTimeout(timeoutTimer); removeEventListener('gb:reader-projection-ready', arm); resolve({ quiet:isQuiet, count:window.__projectionEvents.length, events:window.__projectionEvents.slice(-12) }); };
    const arm = () => { clearTimeout(quietTimer); quietTimer = setTimeout(() => finish(true), quietMs); };
    addEventListener('gb:reader-projection-ready', arm); timeoutTimer = setTimeout(() => finish(false), timeoutMs); arm();
  }), { quietMs, timeoutMs });
}

async function footState(page) {
  return page.evaluate(({ markerSelector, tipSelector }) => {
    const direct = (el) => Array.from(el?.childNodes || []).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent || '').join('').replace(/\s+/g, '').trim();
    const marker = document.querySelector(markerSelector); const tip = document.querySelector(tipSelector); const open = document.querySelector('.fn-marker[aria-expanded="true"]');
    const rect = tip?.getBoundingClientRect() || null; const style = tip ? getComputedStyle(tip) : null;
    const hit = rect ? document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) : null;
    return {
      markerOpen:marker?.getAttribute('aria-expanded') === 'true', openNumber:direct(open), tipOpen:Boolean(tip), hovered:Boolean(tip?.matches(':hover')),
      hit:Boolean(tip && hit && (tip === hit || tip.contains(hit))), eventCount:window.__projectionEvents.length,
      tip:tip && rect && style ? { position:style.position, display:style.display, visibility:style.visibility, pointerEvents:style.pointerEvents, width:rect.width, height:rect.height, left:rect.left, top:rect.top, right:rect.right, bottom:rect.bottom, centerX:rect.left + rect.width / 2, centerY:rect.top + rect.height / 2, inViewport:rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1 } : null,
    };
  }, { markerSelector:MARKER, tipSelector:FOOT_TIP });
}

async function glossaryState(page) {
  return page.evaluate(({ anchorSelector, tipSelector }) => {
    const anchor = document.querySelector(anchorSelector); const tip = document.querySelector(tipSelector);
    const frame = tip?.querySelector(':scope > .gtip-luxury'); const expand = tip?.querySelector('[data-gtip-expand]'); const detail = tip?.querySelector('.gtip-detail-wrap'); const papyrus = tip?.querySelector('.gtip-papyrus');
    const rect = (el) => { const r = el?.getBoundingClientRect(); return r ? { left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height } : null; };
    const tr = rect(tip); const fr = rect(frame); const pr = rect(papyrus); const style = tip ? getComputedStyle(tip) : null; const ps = papyrus ? getComputedStyle(papyrus) : null;
    const hasScrollbar = Boolean(tip && tip.scrollHeight > tip.clientHeight + 1); const overflowY = style?.overflowY || '';
    return {
      anchorOpen:anchor?.getAttribute('aria-expanded') === 'true', tipOpen:Boolean(tip), expanded:Boolean(tip?.classList.contains('gtip--expanded')),
      expandAria:expand?.getAttribute('aria-expanded') || '', expandLabel:expand?.getAttribute('aria-label') || '', detailHidden:detail?.getAttribute('aria-hidden') || '',
      tip:tr, papyrus:pr, papyrusOpacity:Number(ps?.opacity || 0), overflowY, hasScrollbar,
      overflowMatchesContent:hasScrollbar ? ['auto','scroll'].includes(overflowY) : !['auto','scroll'].includes(overflowY),
      blankTail:tr && fr ? Math.max(0, tr.bottom - fr.bottom) : null,
      inViewport:Boolean(tr && tr.left >= -1 && tr.top >= -1 && tr.right <= innerWidth + 1 && tr.bottom <= innerHeight + 1),
    };
  }, { anchorSelector:GLOSSARY, tipSelector:GLOSSARY_TIP });
}

const { server, origin } = await serve();
const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ viewport:{ width:1280, height:850 } });
await context.addInitScript(() => {
  window.__projectionEvents = [];
  addEventListener('gb:reader-projection-ready', (event) => window.__projectionEvents.push({ reason:String(event.detail?.reason || ''), t:Math.round(performance.now()) }));
});
const page = await context.newPage(); const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));

try {
  await page.goto(`${origin}${ROUTE}`, { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForFunction(() => window.GBReaderProjection?.version === 1 && window.GBArticleTooltips?.version >= 14, null, { timeout:15000 });

  const footReady = await instrumentFootnote(page); const marker = page.locator(MARKER).first();
  record('RPH-01','Hermenevtika static footnote marker exists with inline tooltip',footReady && await marker.count() === 1,{ footReady });
  record('RPH-02','ReaderProjection v1 is installed',await page.evaluate(() => window.GBReaderProjection?.version === 1));
  record('RPH-03','Article tooltip owner v14 is installed',await page.evaluate(() => window.GBArticleTooltips?.version >= 14));
  await marker.scrollIntoViewIfNeeded(); const quiescence = await quiet(page); const baseline = quiescence.count;
  record('RPH-04','reader projection reaches event quiescence after viewport activation',quiescence.quiet,quiescence);
  const markerBox = await marker.boundingBox(); assert.ok(markerBox,'footnote marker must have geometry');

  await marker.hover({ force:true }); await page.waitForFunction((s) => Boolean(document.querySelector(s)), FOOT_TIP, { timeout:3000 }); await twoFrames(page);
  const opened = await footState(page);
  record('RPH-05','hover opens the static footnote tooltip',opened.tipOpen,opened);
  record('RPH-06','hover keeps marker aria-expanded truthful',opened.markerOpen && opened.openNumber === '40',opened);
  record('RPH-07','desktop tooltip is fixed, visible and hit-testable',opened.tip?.position === 'fixed' && opened.tip.display !== 'none' && opened.tip.visibility !== 'hidden' && opened.tip.pointerEvents !== 'none' && opened.hit,opened);
  record('RPH-08','desktop tooltip remains inside the viewport',Boolean(opened.tip?.inViewport && opened.tip.width > 20 && opened.tip.height > 20),opened);
  record('RPH-09','tooltip extraction does not trigger a projection refresh',opened.eventCount === baseline,{ baseline, opened });

  const from = { x:markerBox.x + markerBox.width / 2, y:markerBox.y + markerBox.height / 2 }; const to = { x:opened.tip.centerX, y:opened.tip.centerY };
  await page.mouse.move(to.x,to.y,{ steps:12 }); await twoFrames(page); const immediate = await footState(page);
  record('RPH-10','pointer handoff immediately keeps the original tooltip open',immediate.tipOpen && immediate.markerOpen && immediate.openNumber === '40',immediate);
  record('RPH-11','tooltip center owns pointer hit-test after handoff',immediate.hit && immediate.hovered,immediate);
  record('RPH-12','pointer handoff does not trigger a projection refresh',immediate.eventCount === baseline,{ baseline, immediate });
  await page.waitForTimeout(700); const held = await footState(page);
  record('RPH-13','tooltip stays open beyond the 520ms hover transit window',held.tipOpen && held.hovered && held.markerOpen && held.openNumber === '40',held);
  record('RPH-14','held tooltip does not trigger a projection refresh',held.eventCount === baseline,{ baseline, held });
  await page.mouse.move(from.x,from.y,{ steps:12 }); await twoFrames(page); const returned = await footState(page);
  record('RPH-15','returning from tooltip to the original marker keeps the same tooltip open',returned.tipOpen && returned.markerOpen && returned.openNumber === '40',returned);
  await page.mouse.move(4,4,{ steps:8 }); await page.waitForFunction((s) => !document.querySelector(s), FOOT_TIP, { timeout:3000 }); const closed = await footState(page);
  record('RPH-16','leaving both marker and tooltip closes the tooltip',!closed.tipOpen && !closed.markerOpen,closed);

  const commentBaseline = closed.eventCount;
  await page.evaluate(() => window.GBReaderProjection.getRoot().appendChild(document.createComment('gb-inline-tooltip-contract'))); await twoFrames(page); const afterComment = await footState(page);
  record('RPH-17','comment placeholders are ignored by the projection observer',afterComment.eventCount === commentBaseline,{ commentBaseline, afterComment });
  const semanticBaseline = afterComment.eventCount;
  await page.evaluate(() => { const p=document.createElement('p'); p.id='reader-projection-semantic-addition'; p.textContent='СЕМАНТИЧЕСКОЕ ДОБАВЛЕНИЕ ПРОЕКЦИИ'; window.GBReaderProjection.getRoot().appendChild(p); });
  await page.waitForFunction((count) => window.__projectionEvents.length > count && window.GBReaderProjection.getTtsSegments().some((s) => s.text === 'СЕМАНТИЧЕСКОЕ ДОБАВЛЕНИЕ ПРОЕКЦИИ'), semanticBaseline, { timeout:3000 });
  const semantic = await footState(page);
  record('RPH-18','real semantic additions still trigger projection refresh',semantic.eventCount > semanticBaseline,{ semanticBaseline, semantic });

  const ownership = await page.evaluate((owned) => ({ canonicalVersion:Number(window.GBArticleTooltips?.version || 0), legacy:(Array.isArray(window.SiteUtils?._tooltipControllers) ? window.SiteUtils._tooltipControllers.map((c) => String(c?.anchorSel || '')).filter((s) => owned.includes(s)) : []) }), OWNED);
  record('RPH-20','canonical tooltip owner retires every overlapping legacy selector',ownership.canonicalVersion >= 14 && ownership.legacy.length === 0,ownership);

  const glossaryReady = await instrumentGlossary(page); const glossary = page.locator(GLOSSARY).first();
  record('RPH-21','Hermenevtika exposes an expandable glossary term with papyrus detail',glossaryReady && await glossary.count() === 1,{ glossaryReady });
  assert.ok(glossaryReady,'expandable glossary term must exist');
  await glossary.scrollIntoViewIfNeeded(); await glossary.click({ force:true }); await page.waitForFunction((s) => Boolean(document.querySelector(s)), GLOSSARY_TIP, { timeout:3000 }); await twoFrames(page);
  const compact = await glossaryState(page);
  record('RPH-22','compact glossary opens at natural height without a fake scrollbar',compact.tipOpen && compact.anchorOpen && compact.overflowMatchesContent && !compact.hasScrollbar,compact);
  record('RPH-23','compact glossary has no detached white tail',compact.blankTail !== null && compact.blankTail <= 2,compact);

  const expand = page.locator(`${GLOSSARY_TIP} [data-gtip-expand]`).first(); await expand.click({ force:true });
  await page.waitForFunction((s) => document.querySelector(s)?.classList.contains('gtip--expanded'), GLOSSARY_TIP, { timeout:3000 }); await page.waitForTimeout(500);
  const expanded = await glossaryState(page);
  record('RPH-24','Подробнее activates the canonical papyrus state and truthful ARIA',expanded.expanded && expanded.expandAria === 'true' && expanded.expandLabel === 'Кратко' && expanded.detailHidden === 'false' && expanded.papyrusOpacity >= .9 && expanded.papyrus?.height > 30,expanded);
  record('RPH-25','expanded glossary stays inside the viewport and scrolls only on real overflow',expanded.inViewport && expanded.overflowMatchesContent && expanded.blankTail !== null && expanded.blankTail <= 2,expanded);

  await expand.click({ force:true }); await page.waitForFunction((s) => !document.querySelector(s)?.classList.contains('gtip--expanded'), GLOSSARY_TIP, { timeout:3000 }); await page.waitForTimeout(500);
  const collapsed = await glossaryState(page);
  record('RPH-26','Кратко restores compact natural geometry without a scrollbar',!collapsed.expanded && collapsed.expandAria === 'false' && collapsed.detailHidden === 'true' && collapsed.overflowMatchesContent && !collapsed.hasScrollbar && Math.abs((collapsed.tip?.height || 0) - (compact.tip?.height || 0)) <= 3,{ compact, collapsed });
  await page.keyboard.press('Escape'); await page.waitForFunction((s) => !document.querySelector(s), GLOSSARY_TIP, { timeout:3000 }); const glossaryClosed = await glossaryState(page);
  record('RPH-27','Escape closes the glossary and restores truthful anchor state',!glossaryClosed.tipOpen && !glossaryClosed.anchorOpen,glossaryClosed);
  record('RPH-19','tooltip handoff contract has no uncaught page errors',pageErrors.length === 0,pageErrors);
  await page.screenshot({ path:path.join(REPORTS,'reader-projection-tooltip-handoff.png'), fullPage:false });
} finally {
  await context.close(); await browser.close(); await new Promise((resolve) => server.close(resolve));
}

assert.equal(new Set(checks.map((c) => c.id)).size, checks.length, 'tooltip handoff check IDs must be unique');
assert.ok(checks.length >= 27, `tooltip handoff contract requires at least 27 checks, got ${checks.length}`);
const failed = checks.filter((c) => !c.pass); const summary = { sha:process.env.GITHUB_SHA || null, checks:checks.length, passed:checks.length - failed.length, failed:failed.length };
fs.writeFileSync(path.join(REPORTS,'reader-projection-tooltip-handoff-contract.json'),JSON.stringify({ summary, checks },null,2));
fs.writeFileSync(path.join(REPORTS,'reader-projection-tooltip-handoff-contract.md'),['# ReaderProjection tooltip handoff contract','',`- SHA: \`${summary.sha || 'local'}\``,`- Checks: **${summary.checks}**`,`- Passed: **${summary.passed}**`,`- Failed: **${summary.failed}**`,'','| ID | Result | Description |','|---|---|---|',...checks.map((c) => `| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.description.replace(/\|/g,'\\|')} |`)].join('\n'));
checks.forEach((c) => console.log(`[READER-PROJECTION-HANDOFF] ${c.pass ? 'PASS' : 'FAIL'} ${c.id} :: ${c.description}`));
console.log('[READER-PROJECTION-HANDOFF-SUMMARY]',JSON.stringify(summary));
assert.equal(failed.length,0,`ReaderProjection tooltip handoff contract failed: ${failed.map((c) => c.id).join(', ')}`);
console.log('ReaderProjection tooltip handoff contract: PASS');
