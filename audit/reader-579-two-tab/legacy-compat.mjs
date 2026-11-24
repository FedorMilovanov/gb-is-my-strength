// Legacy compatibility: pre-existing notes (no revision/provenance fields,
// old one-way quote link) must keep rendering and stay byte-identical except
// for the text the reader actually edits.
import { chromium } from '/tmp/arena-browser/node_modules/playwright/index.mjs';
const BASE = process.env.QA_BASE || 'http://127.0.0.1:19226';
const URL_ = BASE + '/articles/dzhon-gill-chast-2-uchenyi/?reader-pilot=1&paper=space&panel=open';
const browser = await chromium.launch({ executablePath: '/tmp/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU' });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => {
  window.__trace = [];
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (k === 'gb-reader-notes-v1') window.__trace.push({ op: 'set', raw: String(v).slice(0, 160), stack: (new Error().stack || '').split('\n').slice(2, 6).join(' | ') });
    return set.call(this, k, v);
  };
});
await p.addInitScript(() => {
  // Read the editor's own draft object once the module is live.
  const iv = setInterval(() => {
    const ta = document.querySelector('#gb-hl-note-text');
    if (ta && ta.closest('#gb-hl-editor')) { /* module scope not reachable; use DOM truth */ }
  }, 100);
  setTimeout(() => clearInterval(iv), 3000);
});
await p.goto(URL_, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => Boolean(window.__NP_W57_ANNOTATIONS__?.ready), null, { timeout: 30000 });

// A legacy note exactly as older builds stored it: no revision, no annotation
// version, link only through quoteId (the one-way relation W57 repairs).
const legacy = [{
  id: 'note-legacy-1', text: 'Старая заметка, записанная прежней версией',
  quoteId: 'quote-legacy-1', articleTitle: 'fixture', url: 'x', savedAt: 1700000000000,
}];
const out = await p.evaluate(async (legacy) => {
  localStorage.setItem('gb-reader-notes-v1', JSON.stringify(legacy));
  const report = { steps: [] };
  // 1. open the note editor from the Product Library on the legacy record
  document.querySelector('#gb-hl-fab').click();
  await new Promise((r) => setTimeout(r, 600));
  report.steps.push({ step: 'library-opened', visible: !!document.querySelector('#gb-hl-panel')?.offsetParent });
  const card = document.querySelector('#gb-hl-list article.gb-hl-item[data-type="note"]');
  report.cardText = card?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) || null;
  card.querySelector('[data-library-action="edit-note"]').click();
  await new Promise((r) => setTimeout(r, 300));
  report.editorValue = document.querySelector('#gb-hl-note-text').value;
  // Typing through the real input path, not a bare .value assignment.
  const ta = document.querySelector('#gb-hl-note-text');
  ta.value = 'Старая заметка, отредактированная сейчас';
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#gb-hl-editor button[type="submit"]').click();
  await new Promise((r) => setTimeout(r, 700));
  const after = JSON.parse(localStorage.getItem('gb-reader-notes-v1') || '[]');
  report.after = after;
  report.status = (document.querySelector('#gb-hl-status')?.textContent || '').trim();
  report.draftAfter = window.__probeDraft ? window.__probeDraft() : null;
  return report;
}, legacy);
const changed = out.after[0];
const keysBefore = Object.keys(legacy[0]).sort();
const keysAfter = Object.keys(changed).sort();
console.log(JSON.stringify({
  trace: await p.evaluate(() => window.__trace),
  legacyRendered: out.cardText,
  editorOpenedWithLegacyText: out.editorValue,
  savedStatus: out.status,
  textUpdated: changed.text === 'Старая заметка, отредактированная сейчас',
  otherFieldsUntouched: changed.id === legacy[0].id && changed.quoteId === legacy[0].quoteId && changed.savedAt === legacy[0].savedAt,
  noNewFieldsInvented: JSON.stringify(keysBefore) === JSON.stringify(keysAfter),
  keysBefore, keysAfter,
  pageErrors: errs,
}, null, 2));
await browser.close();
