// Audit only: two tabs of a temporary context, no real origin/profile or storage writes by the test.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = process.env.W57_EVIDENCE_DIR;
if (out) await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const url = 'http://127.0.0.1:19061/articles/kod-da-vinchi/';
const original = 'Исходная заметка', draft = 'Черновик вкладки А', revision = 'Опубликованная правка Б';
const results = [];
const notes = p => p.evaluate(() => JSON.parse(localStorage.getItem('gb-reader-notes-v1') || '[]').map(({id,text}) => ({id,text})));
const saveButton = p => p.locator('#gb-hl-editor [type="submit"]');
const field = p => p.locator('#gb-hl-note-text');
const action = (p, id, name) => p.locator(`#gb-hl-list [data-type="note"][data-id="${id}"] [data-library-action="${name}"]`);
async function open(p, pilot) {
  assert.equal((await p.goto(url + (pilot ? '?reader-pilot=1&panel=open' : ''))).status(), 200);
  if (pilot) await p.waitForFunction(() => window.__NP_W57_ANNOTATIONS__?.ready);
  await p.locator(pilot ? '#npULibraryButton' : '#gb-hl-fab').click();
  await p.locator('#gb-hl-panel [data-library-tab="note"]').click();
}
async function create(p,text) {
  await p.locator('#gb-hl-new-note').click(); await field(p).fill(text); await saveButton(p).click();
  const rec=(await notes(p)).find(r=>r.text===text); assert.ok(rec); return rec.id;
}
try {
  for (const scenario of ['no-conflict','other-record','same-record','deleted-record']) {
    const ctx = await browser.newContext({locale:'ru-RU', viewport:{width:1440,height:900}, reducedMotion:'reduce'});
    ctx.setDefaultTimeout(7000);
    try {
      const a=await ctx.newPage(), b=await ctx.newPage();
      await open(a,true);
      const id=await create(a,original), otherId=await create(a,'Контрольная запись');
      await open(b,false);
      await action(a,id,'edit-note').click(); assert.equal(await field(a).inputValue(),original);
      await field(a).fill(draft);
      if (scenario==='deleted-record') await action(b,id,'delete').click();
      if (scenario==='other-record'||scenario==='same-record') {
        await action(b,scenario==='other-record'?otherId:id,'edit-note').click();
        await field(b).fill(revision); await saveButton(b).click();
      }
      const before=await notes(a); assert.deepEqual(before,await notes(b));
      const bValue=before.find(r=>r.id===id)?.text ?? null;
      assert.equal(bValue,scenario==='deleted-record'?null:scenario==='same-record'?revision:original);
      assert.equal(before.find(r=>r.id===otherId)?.text,scenario==='other-record'?revision:'Контрольная запись');
      await saveButton(a).click();
      const editorVisible=await field(a).isVisible(), textInField=await field(a).inputValue();
      const status=await a.locator('#gb-hl-status').innerText();
      await b.reload(); const stored=await notes(b), value=stored.find(r=>r.id===id)?.text ?? null;
      const conflict=scenario==='same-record'||scenario==='deleted-record';
      const expected=before.map(r=>r.id===id && !conflict?{...r,text:draft}:r);
      const diskOK=JSON.stringify(stored)===JSON.stringify(expected);
      const editorOK=conflict ? editorVisible && textInField===draft : !editorVisible;
      const announced= /обновлена|успешно сохранена/iu.test(status);
      const noticeOK=conflict ? !announced && /измен|удал|конфликт|устар|другой вкладке/iu.test(status) : announced;
      if(out && conflict) await a.screenshot({path:join(out,scenario+'.jpg'),quality:85,animations:'disabled'});
      let recovered = null;
      if (conflict && editorVisible) {
        // Prove the draft is recoverable using normal controls, not only present in a hidden input.
        await a.bringToFront();
        await field(a).press('Control+a'); await field(a).press('Control+c');
        await a.locator('#gb-hl-note-cancel').click(); await a.locator('#gb-hl-new-note').click();
        await field(a).press('Control+v'); recovered = await field(a).inputValue() === draft;
        assert.deepEqual(await notes(a), stored, 'manual copy must not write a new note');
      }
      results.push({scenario,pass:diskOK&&editorOK&&noticeOK&&(!conflict||recovered===true),recovered,beforeSaveA:bValue,afterReloadB:value,
        remainingRecords:stored.length,otherRecord:stored.find(r=>r.id===otherId)?.text,editorVisible,status,diskOK,editorOK,noticeOK});
    } finally { await ctx.close(); }
  }
} finally {await browser.close();console.log(JSON.stringify(results,null,2));}
if(results.some(r=>!r.pass)) process.exitCode=1;
