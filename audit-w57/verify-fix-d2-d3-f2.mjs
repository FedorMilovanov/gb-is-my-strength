import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const BASE = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/';
const out = {};

// ---------- D2: mobile 390x844 font panel + ghost strip ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '?reader-pilot=1&paper=space', { waitUntil: 'domcontentloaded' });
  /* Head 47e394c gates the opt-in W57 pilot to (min-width:1121px): на мобильном
     каноном владеет нативная панель, пилотной разметки там больше нет. D2 как
     воспроизводимый дефект на мобильном снят — проверяем, что пилот действительно
     не монтируется, и не ждём его панель. */
  const pilotMounted = await page.evaluate(() => !!document.getElementById('npUEdgeToggle') || document.querySelectorAll('[class^="np-u-"]').length > 0);
  if (!pilotMounted) {
    out.d2 = { status: 'skipped: W57 pilot не монтируется при 390 на этом head (порог 1121px), мобильный канон нативный' };
    out.d2Opened = null;
  } else {
  await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  // open mobile TOC, then settings — the path from the living comment
  await page.evaluate(() => document.getElementById('npUOpenToc')?.click());
  await page.waitForTimeout(1200);
  const fontBtn = await page.$('#npUOutline .np-u-type-options button, #npUOutline [data-np-u-type-font]');
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('#npUOutline button')]
      .find((x) => /Аа|Шрифт|Настройки/.test(x.textContent) || x.classList.contains('np-u-type-open'));
    if (b) { b.click(); return b.textContent.trim(); }
    return null;
  });
  await page.waitForTimeout(1200);
  out.d2Opened = opened;
  out.d2 = await page.evaluate(() => {
    const box = (el) => el ? (({ x, y, width, height }) => ({
      x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(el.getBoundingClientRect()) : null;
    const panel = document.getElementById('npUFontPanel');
    const card = document.querySelector('.np-u-audio-card');
    const scrim = document.getElementById('npUFontScrim');
    const vw = innerWidth;
    const cs = card ? getComputedStyle(card) : null;
    return {
      viewport: vw,
      panel: box(panel), panelHidden: panel ? panel.hidden : null,
      audioCard: box(card), audioOpacity: cs ? cs.opacity : null, audioVisibility: cs ? cs.visibility : null,
      scrimHidden: scrim ? scrim.hidden : null,
      rightGap: panel ? Math.round(vw - panel.getBoundingClientRect().right) : null,
      groups: panel ? [...panel.querySelectorAll('.np-u-type-group > span')].map((s) => s.textContent.trim()) : [],
    };
  });
  await page.screenshot({ path: '/tmp/audit-shots/FIX_d2_mobile_font_panel.png' });
  await ctx.close();
  }
}

// ---------- D3: 1440 / 1360 / 1280 settings owners ----------
{
  out.d3 = {};
  for (const w of [1920, 1440, 1360, 1280]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + '?reader-pilot=1&paper=space', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 30000 });
    await page.waitForTimeout(2000);
    const before = await page.evaluate(() => {
      const vis = (el) => { if (!el) return false; const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
        return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 4 && r.height > 4; };
      const native = [...document.querySelectorAll('[data-gill-settings-open], #railSettingsBtn')].filter(vis);
      return { nativeTriggers: native.length,
        nativeIds: native.map((e) => e.id || e.className.toString().slice(0, 20)),
        w57Trigger: vis(document.querySelector('.np-u-type-open')) || vis(document.querySelector('.np-u-type-compact')) };
    });
    // click the native-looking settings trigger (now re-bound to the W57 panel)
    const clicked = await page.evaluate(() => {
      const el = [...document.querySelectorAll('[data-gill-settings-open], #railSettingsBtn, .np-u-type-open, .np-u-type-compact')]
        .find((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4; });
      if (!el) return null;
      el.click();
      return el.id || el.className;
    });
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => {
      const p = document.getElementById('npUFontPanel');
      const r = p ? p.getBoundingClientRect() : null;
      const h1 = document.querySelector('article h1');
      const hr = h1 ? h1.getBoundingClientRect() : null;
      const overlap = r && hr ? Math.max(0, Math.min(r.right, hr.right) - Math.max(r.left, hr.left))
        * Math.max(0, Math.min(r.bottom, hr.bottom) - Math.max(r.top, hr.top)) : 0;
      return {
        panelOpen: p ? !p.hidden : null,
        panelBox: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
        groups: p ? [...p.querySelectorAll('.np-u-type-group > span')].map((s) => s.textContent.trim()) : [],
        hasFontFamily: p ? !!p.querySelector('[data-np-u-type-font]') : null,
        hasTheme: p ? !!p.querySelector('[data-np-u-type-theme]') : null,
        h1OverlapPct: r && hr ? Math.round((overlap / (hr.width * hr.height)) * 100) : null,
        nativeSheetOpen: !!document.querySelector('#gillSettingsOverlay.is-open, #gillSettingsOverlay[aria-hidden="false"]'),
      };
    });
    await page.screenshot({ path: `/tmp/audit-shots/FIX_d3_${w}.png` });
    out.d3[w] = { before, clicked, after };
    await ctx.close();
  }
}

// ---------- F2: glossary tooltip vs toolbar ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '?reader-pilot=1&paper=space', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => localStorage.clear());
  const setup = await page.evaluate(() => {
    const p = document.getElementById('gill-search-p-012');
    p.querySelector('abbr.gterm').scrollIntoView({ block: 'center', behavior: 'instant' });
    return p.id;
  });
  await page.waitForTimeout(1200);
  const pts = await page.evaluate((blockId) => {
    const p = document.getElementById(blockId);
    const abbr = p.querySelector('abbr.gterm');
    const t = abbr.getClientRects()[0];
    const y = Math.round(t.top + t.height / 2);
    let prev = abbr.previousSibling, next = abbr.nextSibling;
    while (prev && prev.nodeType !== 3) prev = prev.previousSibling;
    while (next && next.nodeType !== 3) next = next.previousSibling;
    const findX = (node, offset) => { let best = null;
      for (let x = Math.round(t.left) - 320; x <= t.right + 320; x += 1) {
        const c = document.caretRangeFromPoint(x, y);
        if (!c || c.startContainer !== node) continue;
        const d = Math.abs(c.startOffset - offset);
        if (!best || d < best.d) best = { x, d }; if (!d) break; }
      return best ? best.x : undefined; };
    return { y, x1: findX(prev, Math.max(0, prev.nodeValue.length - 40)),
      x2: findX(next, Math.min(next.nodeValue.length, 40)),
      termCx: Math.round(t.left + t.width / 2), termCy: y };
  }, setup);
  await page.mouse.move(pts.x1, pts.y); await page.mouse.down();
  for (let i = 1; i <= 35; i++) { await page.mouse.move(pts.x1 + ((pts.x2 - pts.x1) * i) / 35, pts.y); await page.waitForTimeout(8); }
  await page.mouse.up(); await page.waitForTimeout(400);
  await page.mouse.move(pts.termCx, pts.termCy, { steps: 10 });   // the exact gesture that used to kill the toolbar
  await page.waitForTimeout(1400);
  const blocked = await page.evaluate(() => {
    const tb = document.getElementById('npW57SelectionToolbar');
    const tip = document.querySelector('.gb-floating-tip.is-open');
    const tr = tb && !tb.hidden ? tb.getBoundingClientRect() : null;
    const tipR = tip ? tip.getBoundingClientRect() : null;
    const acts = tb && !tb.hidden ? [...tb.querySelectorAll('[data-w57-action]')].map((b) => {
      const r = b.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { a: b.dataset.w57Action, ok: el === b || b.contains(el),
        blocker: el && !b.contains(el) ? String(el.className).split(' ').slice(0, 2).join('.') : null };
    }) : [];
    return { tipExists: !!tip, tipVisibility: tip ? getComputedStyle(tip).visibility : null,
      tipPointer: tip ? getComputedStyle(tip).pointerEvents : null,
      toolbarVisible: !!tr, actions: acts, blocked: acts.filter((a) => !a.ok).length };
  });
  let saveResult = null;
  if (blocked.toolbarVisible) {
    const q = await page.evaluate(() => { const b = document.querySelector('#npW57SelectionToolbar [data-w57-action="marker"]');
      if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    if (q) {
      await page.mouse.move(q.x, q.y, { steps: 8 });
      await page.mouse.click(q.x, q.y);
      await page.waitForTimeout(1300);
      saveResult = await page.evaluate(() => ({
        stored: JSON.parse(localStorage.getItem('gb-highlights-v1') || '[]').length,
        status: document.getElementById('npW57NotesStatus')?.textContent.trim() }));
    }
  }
  out.f2 = { blocked, saveResult };
  await page.screenshot({ path: '/tmp/audit-shots/FIX_f2_toolbar_over_tip.png' });
  await ctx.close();
}

console.log(JSON.stringify(out, null, 1));
await browser.close();
