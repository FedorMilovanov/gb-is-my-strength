import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/tmp/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const URL = 'http://127.0.0.1:19061/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space';
const out = {};

// A. 1280 H1 overlap + theme switching + Escape
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 30000 });
  await page.waitForTimeout(2000);
  const open = () => page.evaluate(() => {
    const el = [...document.querySelectorAll('.np-u-type-open, .np-u-type-compact, [data-gill-settings-open], #railSettingsBtn')]
      .find((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4; });
    if (el) { el.click(); return el.className; } return null;
  });
  out.opener = await open();
  await page.waitForTimeout(800);
  out.h1 = await page.evaluate(() => {
    const p = document.getElementById('npUFontPanel');
    const h1 = document.querySelector('h1');
    const pr = p ? p.getBoundingClientRect() : null, hr = h1 ? h1.getBoundingClientRect() : null;
    if (!pr || !hr) return null;
    const ox = Math.max(0, Math.min(pr.right, hr.right) - Math.max(pr.left, hr.left));
    const oy = Math.max(0, Math.min(pr.bottom, hr.bottom) - Math.max(pr.top, hr.top));
    return { panelRight: Math.round(pr.right), h1Left: Math.round(hr.left),
      overlapPx: Math.round(ox), overlapAreaPct: Math.round((ox * oy) / (hr.width * hr.height) * 100) };
  });
  // theme: click «Ночь», verify canonical preference applied
  const themeBefore = await page.evaluate(() => document.documentElement.getAttribute('data-reader-theme'));
  await page.evaluate(() => document.querySelector('#npUFontPanel [data-np-u-type-theme="dark"]')?.click());
  await page.waitForTimeout(900);
  out.theme = { before: themeBefore,
    after: await page.evaluate(() => ({
      attr: document.documentElement.getAttribute('data-reader-theme'),
      cls: document.documentElement.classList.contains('dark'),
      panelOpen: !document.getElementById('npUFontPanel')?.hidden })) };
  // escape closes
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  out.escape = await page.evaluate(() => ({
    panelHidden: document.getElementById('npUFontPanel')?.hidden,
    tocStillOpen: document.getElementById('npUOutline')?.classList.contains('np-u-show-left') }));
  // back to day
  await open(); await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('#npUFontPanel [data-np-u-type-theme="light"]')?.click());
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');
  await ctx.close();
}

// B. note edit conflict across two tabs (D5/D6 guard in js/highlights.js)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const a = await ctx.newPage();
  await a.goto(URL, { waitUntil: 'domcontentloaded' });
  await a.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 30000 });
  await a.evaluate(() => localStorage.setItem('gb-reader-notes-v1', JSON.stringify([
    { id: 'alpha', text: 'Original alpha', url: location.origin + location.pathname, savedAt: Date.now() },
    { id: 'beta', text: 'Original beta', url: location.origin + location.pathname, savedAt: Date.now() },
  ])));
  const b = await ctx.newPage();
  await Promise.all([a.reload({ waitUntil: 'domcontentloaded' }), b.goto(URL, { waitUntil: 'domcontentloaded' })]);
  await Promise.all([
    a.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 30000 }),
    b.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 30000 }),
  ]);
  await Promise.all([a.waitForTimeout(1800), b.waitForTimeout(1800)]);
  const openLib = (p) => p.evaluate(() => {
    const inline = document.getElementById('npULibraryButton');
    const fab = document.getElementById('gb-hl-fab');
    const t = inline && inline.getBoundingClientRect().width > 4 ? inline : fab;
    t && t.click();
  });
  await openLib(a); await a.waitForTimeout(1200);
  await openLib(b); await b.waitForTimeout(1200);
  const startEdit = (p) => p.evaluate(() => {
    const item = document.querySelector('#gb-hl-panel .gb-hl-item[data-id="alpha"]')
      || document.querySelector('#gb-hl-list .gb-hl-item');
    const btn = item && item.querySelector('[data-library-action="edit-note"]');
    if (btn) { btn.click(); return true; } return false;
  });
  const libOpen = async (p) => p.evaluate(() => {
    const panel = document.getElementById('gb-hl-panel');
    return !!(panel && panel.getBoundingClientRect().width > 50);
  });
  out.libPanel = { a: await libOpen(a), b: await libOpen(b) };
  out.editStartedA = await startEdit(a);
  await a.waitForTimeout(500);
  // B deletes the same note
  out.deletedInB = await b.evaluate(() => {
    const item = document.querySelector('#gb-hl-panel .gb-hl-item[data-id="alpha"]')
      || document.querySelector('#gb-hl-list .gb-hl-item');
    const btn = item && item.querySelector('[data-library-action="delete"]');
    if (btn) { btn.click(); return true; } return false;
  });
  await b.waitForTimeout(900);
  // A submits its stale draft
  out.draftTyped = await a.evaluate(() => {
    const ta = document.getElementById('gb-hl-note-text');
    if (!ta) return null;
    ta.focus(); ta.value = 'Черновик A — не должен затереть';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return ta.value;
  });
  out.submittedA = await a.evaluate(() => {
    const form = document.getElementById('gb-hl-editor');
    const btn = form && form.querySelector('[type=submit]');
    if (btn) { btn.click(); return true; } return false;
  });
  await a.waitForTimeout(1200);
  out.afterConflict = await a.evaluate(() => ({
    status: document.getElementById('gb-hl-status')?.textContent.trim()
      || document.getElementById('gb-hl-panel')?.textContent.match(/Заметка[^.]*\./g)?.join(' | '),
    draftVisible: (() => { const ta = document.getElementById('gb-hl-note-text');
      return ta ? { present: true, value: ta.value, visible: ta.getBoundingClientRect().width > 10 } : { present: false }; })(),
    notes: JSON.parse(localStorage.getItem('gb-reader-notes-v1') || '[]').map((n) => n.id),
  }));
  out.screens = '/tmp/audit-shots/FIX_conflict.png';
  await a.screenshot({ path: '/tmp/audit-shots/FIX_conflict.png' });
  await ctx.close();
}

// C. same-tab library commit → W57 list repaint (gb:library-committed)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => localStorage.clear());
  // real marker
  const g = await page.evaluate(() => {
    const p = [...document.querySelectorAll('article.article-body p')]
      .filter((x) => x.textContent.trim().length > 250 && !x.closest('.gill-card,details,aside'))[2];
    p.scrollIntoView({ block: 'center', behavior: 'instant' });
    const nodes = []; const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) nodes.push(n);
    const rr = document.createRange(); rr.setStart(nodes[0], 0); rr.setEnd(nodes[0], 1);
    const l0 = rr.getClientRects()[0]; const len = nodes[0].nodeValue.length;
    const r = document.createRange(); r.setStart(nodes[0], 5); r.setEnd(nodes[0], Math.min(len, 70));
    const rects = [...r.getClientRects()].filter((q) => Math.abs(q.top - l0.top) < 2);
    return { x1: l0.left + 2, x2: rects[rects.length - 1].right, y: l0.top + l0.height / 2 };
  });
  await page.mouse.move(g.x1, g.y); await page.mouse.down();
  await page.mouse.move((g.x1 + g.x2) / 2, g.y, { steps: 5 });
  await page.mouse.move(g.x2, g.y, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(600);
  await page.click('#npW57SelectionToolbar [data-w57-action="marker"]');
  await page.waitForTimeout(1200);
  out.beforeDelete = await page.evaluate(() => ({
    count: document.getElementById('npW57NotesCount')?.textContent,
    cards: document.querySelectorAll('#npW57NotesList li[data-id]').length,
    painted: (() => { let n = 0; if (window.CSS?.highlights) for (const [k, r] of CSS.highlights) if (k.startsWith('np-w57-')) n += r.size; return n; })(),
  }));
  // delete from the Product library panel and watch W57 without any click bubbling
  const del = await page.evaluate(() => {
    const inline = document.getElementById('npULibraryButton');
    const fab = document.getElementById('gb-hl-fab');
    const t = inline && inline.getBoundingClientRect().width > 4 ? inline : fab;
    t && t.click();
    return !!t;
  });
  await page.waitForTimeout(1300);
  out.libraryOpened = del;
  out.deleteClicked = await page.evaluate(() => {
    const item = document.querySelector('#gb-hl-panel .gb-hl-item[data-type="quote"], #gb-hl-list .gb-hl-item');
    const btn = item && item.querySelector('[data-library-action="delete"]');
    if (btn) { btn.click(); return true; } return false;
  });
  await page.waitForTimeout(1500);
  out.afterDelete = await page.evaluate(() => ({
    count: document.getElementById('npW57NotesCount')?.textContent,
    cards: document.querySelectorAll('#npW57NotesList li[data-id]').length,
    painted: (() => { let n = 0; if (window.CSS?.highlights) for (const [k, r] of CSS.highlights) if (k.startsWith('np-w57-')) n += r.size; return n; })(),
  }));
  await page.screenshot({ path: '/tmp/audit-shots/FIX_library_sync.png' });
  await ctx.close();
}

console.log(JSON.stringify(out, null, 1));
await browser.close();
