#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { chromium, firefox, webkit } = require('playwright');

const root = path.resolve(__dirname, '..');
const html = [
  '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Статья для теста · Господь Бог — Сила Моя</title>',
  '<style>body{margin:0;background:#faf6ef;color:#332a25;font:18px/1.7 Georgia,serif}',
  'main{max-width:640px;margin:60px auto;padding:20px}article p{max-width:100%}',
  '.hmbar{position:fixed;bottom:0;left:0;right:0;background:#24171b;color:#e9cfbd;display:flex;align-items:center;justify-content:end;gap:5px;height:52px;padding:0 12px}',
  '.hmbar button{width:36px;height:36px;color:inherit;background:none;border:0}',
  '@media(min-width:1200px){.hmbar{display:none}}',
  '#selection-share-popup{position:fixed;top:15px;left:12px;background:#342229;color:white;display:flex;z-index:900;padding:5px;border-radius:9px}',
  '</style></head><body>',
  '<main><article data-pagefind-body><h1>Статья для теста</h1><p id="demo">Размышление о богословском тексте и изучении Писания.</p>',
  '<p id="more">Достаточно длинный фрагмент для проверки сохранения выделенного текста.</p></article></main>',
  '<div id="selection-share-popup" role="toolbar" aria-hidden="false"></div>',
  '<div class="hmbar"><button class="gb-save" data-fc-action="save" aria-label="Сохранить статью" type="button">☆</button>',
  '<button id="hmShareBtn" type="button">↗</button></div>',
  '<script>window.SITE_CONFIG={version:"reader-library-test",site:{id:"gb"},page:{title:"Статья для теста"}};</script>',
  '<script type="module" src="/src/runtime/favorite-store.js"></script>',
  '<script src="/js/highlights.js"></script>',
  '</body></html>',
].join('');
const gbsHtml = html.replace('</head>',
  '<style>.hmbar{display:none!important}.gbs2-bbar{position:fixed;bottom:12px;left:12px;right:12px;min-height:62px;padding:10px 12px;background:#fff4e9;z-index:2000;border:1px solid #a77d67;border-radius:22px;display:block}.gb-mobile-fallback-controls{position:fixed!important;left:50%!important;bottom:90px!important;z-index:2102!important;display:flex!important;align-items:center!important;gap:4px!important;transform:translateX(-50%)!important;min-height:44px;padding:4px 8px;background:#f7f0e9;border-radius:999px}@media(min-width:900px){.gb-mobile-fallback-controls{display:none!important}}@media(min-width:1200px){.gbs2-bbar{display:none}}</style></head>')
  .replace('</body>', '<button type="button" id="gbs2Bbar" class="gbs2-bbar">Оглавление серии</button><div class="gb-mobile-fallback-controls" data-fc-root role="region" aria-label="Быстрые действия чтения"><button type="button" class="gb-ember" aria-label="Слушать">▶</button><button type="button" class="gb-save" aria-label="Сохранить">☆</button></div></body>');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/js/highlights.js' || url.pathname === '/css/highlights-runtime.css' ||
      url.pathname === '/src/runtime/favorite-store.js' || url.pathname === '/js/reader-library-presenter.js' ||
      url.pathname === '/js/reader-library-storage.js' || url.pathname === '/js/reader-library-v3.js' || url.pathname === '/js/reader-library-dock.js' ||
      url.pathname === '/js/reader-library-record-transactions.js' || url.pathname === '/js/reader-library-selection.js') {
    const file = path.join(root, url.pathname.replace(/^\//, ''));
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8');
    res.end(fs.readFileSync(file));
  } else {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const transientHtml = html.replace('</head>', '<style>#selection-share-popup[aria-hidden="true"]{display:none}</style></head>').replace('<main>', '<button id="qa-unrelated" type="button">Другое действие</button><main>');
    res.end(url.pathname === '/baptisty-rossii/' ? gbsHtml :
      url.pathname === '/articles/selection-native/' ? transientHtml :
      url.pathname === '/articles/selection-fallback/' ? transientHtml.replace('<div id="selection-share-popup" role="toolbar" aria-hidden="false"></div>', '') : html);
  }
});
const longQuote = 'Длинная выдержка из первой статьи для исследования, '.repeat(16);
const storedQuote = { id: 'old-quote', text: longQuote, url: '/articles/first/#:~:text=example', articleTitle: 'Первый материал', savedAt: 1700000000000 };
const storedNote = { id: 'old-note', text: 'Личная заметка к первой статье', articleTitle: 'Первый материал', url: '/articles/first/', savedAt: 1700000000010 };
function initStorage() {
  localStorage.setItem('gb-highlights-v1', JSON.stringify([storedQuote]));
  localStorage.setItem('gb-reader-notes-v1', JSON.stringify([storedNote]));
  localStorage.setItem('gb-favorites', JSON.stringify([{ path: '/articles/another', title: 'Второй материал', addedAt: 1700000000020 }]));
}

async function check(browserName, driver, url, width) {
  const browser = await driver.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width, height: 720 }, acceptDownloads: true });
  await context.addInitScript(({ quote, note }) => {
    localStorage.setItem('gb-highlights-v1', JSON.stringify([quote]));
    localStorage.setItem('gb-reader-notes-v1', JSON.stringify([note]));
    localStorage.setItem('gb-favorites', JSON.stringify([{ path: '/articles/another', title: 'Второй материал', addedAt: 1700000000020 }]));
  }, { quote: storedQuote, note: storedNote });
  const page = await context.newPage();
  try {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('#gb-hl-fab').waitFor();
  assert.equal(await page.locator('#gb-hl-fab.gb-hl-fab--docked').count(), 1, 'bottom bar hosts shared library');
  assert.equal(await page.locator('.gb-save').count(), 1, 'original SaveButton must remain intact');
  assert.equal(await page.locator('#gb-hl-fab').isVisible(), true, 'library remains visible with existing data');

  await page.locator('#gb-hl-fab').click();
  await page.locator('.gb-hl-item').first().waitFor();
  assert.equal(await page.locator('#gb-hl-backdrop').getAttribute('aria-hidden'), 'false');
  assert.equal(await page.locator('#gb-hl-item').count(), 0, 'no competing legacy item container');
  assert.equal(await page.locator('.gb-hl-item').count(), 3, 'legacy quotes, notes and favorites are united');
  assert.equal(await page.locator('#gb-hl-count').textContent(), '· 3');
  const overflow = await page.evaluate(() => ({ sheet: document.querySelector('#gb-hl-panel').scrollWidth, viewport: innerWidth }));
  assert(overflow.sheet <= overflow.viewport, 'library must fit narrow viewport');
  const longBody = page.locator('.gb-hl-item[data-type="quote"] .gb-hl-quote').first();
  assert(await longBody.evaluate((el) => el.classList.contains('is-collapsed')), 'long quote is collapsed');
  const expand = page.locator('.gb-hl-item[data-type="quote"] .gb-hl-expand').first();
  await expand.click();
  assert.equal(await expand.getAttribute('aria-expanded'), 'true');
  await expand.click();
  assert.equal(await expand.getAttribute('aria-expanded'), 'false');

  await page.locator('[data-library-tab="note"]').click();
  assert.equal(await page.locator('.gb-hl-item').count(), 1);
  await page.locator('[data-library-action="edit-note"]').click();
  assert.equal(await page.locator('#gb-hl-editor').isVisible(), true);
  await page.locator('#gb-hl-note-text').fill('Личная заметка изменена');
  await page.locator('#gb-hl-editor button[type="submit"]').click();
  await page.locator('#gb-hl-editor').waitFor({state:'hidden'});
  assert((await page.locator('.gb-hl-note').textContent()).includes('изменена'));

  await page.locator('#gb-hl-new-note').click();
  await page.locator('#gb-hl-note-text').fill('Вторая заметка текущей статьи');
  await page.locator('#gb-hl-editor button[type="submit"]').click();
  await page.locator('#gb-hl-editor').waitFor({state:'hidden'});
  assert.equal(await page.locator('.gb-hl-item[data-type="note"]').count(), 2);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gb-reader-notes-v1')).length), 2);

  await page.locator('[data-library-tab="favorite"]').click();
  assert.equal(await page.locator('.gb-hl-item').count(), 1);
  await page.locator('#gb-hl-close').click();
  assert.equal(await page.locator('#gb-hl-backdrop').getAttribute('inert'), '');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'gb-hl-fab', 'focus returns to opener');

  const result = await page.evaluate(() => window.GBFavoriteStore.add({ path: '/articles/third', title: 'Третий материал' }));
  assert.equal(result.saved, true);
  await page.locator('#gb-hl-fab').click();
  await page.locator('.gb-hl-item').first().waitFor();
  await page.locator('[data-library-tab="favorite"]').click();
  assert.equal(await page.locator('.gb-hl-item').count(), 2, 'favorite store additions are live');
  await page.locator('[data-library-tab="all"]').click();
  await page.locator('#gb-hl-search').fill('Третий');
  assert.equal(await page.locator('.gb-hl-item').count(), 1);
  await page.locator('#gb-hl-search').fill('');
  await page.locator('#gb-hl-source').selectOption('Первый материал');
  assert.equal(await page.locator('.gb-hl-item').count(), 2, 'source filter selects quote and note');
  await page.locator('#gb-hl-source').selectOption('all');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#gb-hl-export').click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'gb-moya-biblioteka.md');
  await page.locator('#gb-hl-close').click();
  await page.evaluate(() => {
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('more'));
    const selection = getSelection();
    selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await page.locator('#ss-save').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('gb-highlights-v1')||'[]').length===2);
  const length = await page.evaluate(() => JSON.parse(localStorage.getItem('gb-highlights-v1')).length);
  assert.equal(length, 2, 'selection saved under existing quote key');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gb-highlights-v1'))[0].url.includes('#more:~:text=')), true,
    'saved quote source points to native text fragment at its section anchor');
  await page.locator('#ss-note').click();
  await page.locator('#gb-hl-editor').waitFor({state:'visible'});
  assert.equal(await page.locator('#gb-hl-editor').isVisible(), true);
  await page.locator('#gb-hl-note-text').fill('Заметка к новой цитате');
  await page.locator('#gb-hl-editor button[type="submit"]').click();
  await page.locator('#gb-hl-editor').waitFor({state:'hidden'});
  const linked = await page.evaluate(() => JSON.parse(localStorage.getItem('gb-reader-notes-v1')).some((x) => x.quoteText && x.quoteText.includes('Достаточно')));
  assert.equal(linked, true, 'notes can attach to selected quotes');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#gb-hl-backdrop').getAttribute('aria-hidden'), 'true');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(() => !document.getElementById('gb-hl-fab').classList.contains('gb-hl-fab--docked'));
  assert.equal(await page.locator('#gb-hl-fab').isVisible(), true, 'desktop fallback remains visible while mobile bar is hidden');
  assert.equal(await page.locator('#gb-hl-fab').evaluate((el) => el.parentElement === document.body), true, 'desktop book belongs to body, not hidden chrome');
  await page.locator('#gb-hl-fab').click();
  assert.equal(await page.locator('#gb-hl-panel').isVisible(), true, 'desktop floating book opens the same unified library');
  await page.locator('#gb-hl-close').click();
  await page.setViewportSize({ width, height: 720 });
  await page.waitForFunction(() => document.getElementById('gb-hl-fab').classList.contains('gb-hl-fab--docked'));
  assert.equal(await page.locator('#gb-hl-fab').isVisible(), true, 'book returns to mobile bar after resize');
  assert.deepEqual(errors, [], 'no client-side JS errors');
  console.log('PASS', browserName, width, 'legacy quote/favorite data, notes, expand, search, export, selection, accessibility');
  } finally { await browser.close(); }
}

async function checkGbs2(name, driver, url) {
  const browser = await driver.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 320, height: 720 } });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'load' });
    await page.locator('#gb-hl-fab').waitFor({ state: 'visible' });
    for (const width of [320, 390, 1440, 390]) {
      await page.setViewportSize({ width, height: 720 });
      await page.waitForTimeout(80);
      const geometry = await page.evaluate(() => {
        const fab = document.getElementById('gb-hl-fab');
        const bar = document.getElementById('gbs2Bbar');
        const f = fab.getBoundingClientRect(), b = bar.getBoundingClientRect();
        const top = document.elementFromPoint(f.left + f.width / 2, f.top + f.height / 2);
        return {
          docked: fab.classList.contains('gb-hl-fab--docked'),
          barVisible: bar.getClientRects().length > 0,
          gap: b.top - f.bottom,
          hittable: top === fab || fab.contains(top),
          width: f.width,
          topElement: top && (top.id || top.className || top.tagName),
          fabBottom: getComputedStyle(fab).bottom,
        };
      });
      assert.equal(geometry.hittable, true, 'book must receive a real pointer hit at ' + width + ': ' + JSON.stringify(geometry));
      assert(geometry.width >= 43.5, 'GBS2 book hit box must be at least 44px');
      if (width < 900) {
        assert.equal(geometry.docked, true, 'book must join existing GBS2 reader control cluster');
        assert.equal(geometry.barVisible, true);
      } else {
        assert.equal(geometry.docked, false, 'book uses a floating desktop action');
      }
      await page.locator('#gb-hl-fab').click();
      await page.locator('#gb-hl-panel').waitFor({ state: 'visible' });
      await page.locator('#gb-hl-close').click();
    }
    console.log('PASS', name, 'GBS2 footer clearance 320/390/1440/390, real pointer hit');
  } finally {
    await browser.close();
  }
}


// Exercise actual touch activation on both transient surfaces, with a controlled
// first presenter request. Selection range setup is deterministic, not a claim
// of OS-native long-press selection or physical Android/iOS coverage.
async function checkTransientFocus(name,driver,base) {
  const browser=await driver.launch({headless:true}), failures=[];
  const cases=['close','cancel','failure','unrelated-escape','unrelated-reject','unrelated-resolve','note-B','fab'];
  let passes=0;
  try {
    for(const surface of ['native','fallback']) for(const termination of cases) {
      const label=name+' '+surface+' '+termination;
      const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});
      const page=await context.newPage();
      let release, signalRequest, requested=0, timer;
      const gate=new Promise(resolve=>{release=resolve});
      const requestSeen=new Promise(resolve=>{signalRequest=resolve});
      const errors=[],moduleRequests=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/js/reader-library-'))moduleRequests.push(path);});
      const rejected=['failure','unrelated-reject'].includes(termination);
      const unrelated=termination.startsWith('unrelated-');
      const select=async id=>page.evaluate(id=>{
        const range=document.createRange();range.selectNodeContents(document.getElementById(id));
        const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
        const popup=document.getElementById('selection-share-popup');
        if(popup){popup.classList.add('ss-visible');popup.setAttribute('aria-hidden','false');}
        document.dispatchEvent(new Event('selectionchange'));
      },id);
      try {
        await page.route('**/js/reader-library-presenter.js?*',async route=>{
          requested++;signalRequest();await gate;
          if(rejected) await route.abort('failed'); else await route.continue();
        });
        await page.goto(base+'/articles/selection-'+surface+'/',{waitUntil:'load'});
        await page.locator('#gb-hl-fab.gb-hl-fab--docked').waitFor({state:'visible'});
        // Cold fixture has no reading-resume state and no user selection.
        assert.equal(moduleRequests.filter(p=>/reader-library-(selection|presenter|record-transactions|v3)\.js$/.test(p)).length,0,'cold page must not request action/presenter modules before selection');
        await page.locator('#demo').click();
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        assert.equal(moduleRequests.filter(p=>p.endsWith('/reader-library-selection.js')).length,0,'ordinary mouse click does not request selection actions');
        await select('more');
        const note=page.locator(surface==='native'?'#ss-note':'#gb-hl-selbar-note');
        await note.waitFor({state:'visible'});
        assert.equal(moduleRequests.filter(p=>p.endsWith('/reader-library-selection.js')).length,1,'first selection loads one action module');
        assert.equal(moduleRequests.filter(p=>p.endsWith('/reader-library-presenter.js')).length,0,'selection alone does not load presenter');
        const before=await page.evaluate(()=>scrollY);
        await note.tap();
        await page.waitForFunction(()=>document.getElementById('gb-hl-fab')?.getAttribute('aria-busy')==='true');
        await Promise.race([requestSeen,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+': presenter request never intercepted')),10000);})]);
        clearTimeout(timer);
        assert.equal(requested,1,'one real presenter request');
        if(unrelated){
          await page.locator('#qa-unrelated').click();
          await page.waitForFunction(()=>document.activeElement?.id==='qa-unrelated');
          if(termination==='unrelated-escape'){
            await page.evaluate(()=>window.addEventListener('keydown',e=>{if(e.key==='Escape')window.qaEscapePrevented=e.defaultPrevented;},{once:true}));
            await page.keyboard.press('Escape');
            assert.equal(await page.evaluate(()=>window.qaEscapePrevented),false,'unrelated Escape not consumed');
          }
          const failedRequest=rejected?page.waitForEvent('requestfailed',{predicate:req=>req.url().includes('/js/reader-library-presenter.js?')}):null;
          release();
          if(failedRequest)await failedRequest;
          else await page.locator('#gb-hl-backdrop[inert]').waitFor({state:'attached'});
          await page.waitForFunction(()=>document.getElementById('gb-hl-fab')?.getAttribute('aria-busy')!=='true');
          assert.equal(await page.evaluate(()=>document.activeElement.id),'qa-unrelated');
          assert.equal(await page.locator('#gb-hl-panel').isVisible(),false);
        } else if(termination==='cancel') {
          await page.keyboard.press('Escape');
          await page.waitForFunction(()=>document.getElementById('gb-hl-fab')?.getAttribute('aria-busy')!=='true');
          release();
          await page.locator('#gb-hl-backdrop[inert]').waitFor({state:'attached'});
        } else {
          if(termination==='note-B'){
            await select('demo');await note.waitFor({state:'visible'});await note.tap();
          } else if(termination==='fab') await page.locator('#gb-hl-fab').tap();
          release();
          if(rejected) await page.waitForFunction(()=>document.getElementById('gb-hl-toast')?.dataset.open==='true');
          else {
            await page.locator('#gb-hl-panel').waitFor({state:'visible'});
            if(termination==='fab')assert.equal(await page.locator('#gb-hl-editor').isVisible(),false,'obsolete note must not open editor');
            else {
              await page.locator('#gb-hl-editor').waitFor({state:'visible'});
              if(termination==='note-B')assert.match(await page.locator('#gb-hl-note-context').textContent(),/Размышление/,'latest selected text owns editor');
            }
            await page.locator('#gb-hl-close').tap();
          }
        }
        await page.waitForFunction(()=>document.getElementById('gb-hl-fab')?.getAttribute('aria-busy')!=='true'&&!document.getElementById('gb-hl-backdrop')?.classList.contains('is-open'));
        const after=await page.evaluate(()=>({id:document.activeElement.id,tag:document.activeElement.tagName,scroll:scrollY,
          visible:document.activeElement.getClientRects().length>0&&!document.activeElement.closest('[hidden],[inert],[aria-hidden="true"]'),
          lock:document.body.classList.contains('no-scroll'),expanded:document.getElementById('gb-hl-fab').getAttribute('aria-expanded'),
          busy:[...document.querySelectorAll('#ss-note,#gb-hl-selbar-note,#gb-hl-fab')].some(e=>e.getAttribute('aria-busy')==='true')}));
        assert.equal(after.visible,true);assert.equal(after.lock,false);assert.equal(after.expanded,'false');assert.equal(after.busy,false);
        if(unrelated)assert.equal(after.id,'qa-unrelated');
        else if(termination==='fab')assert.equal(after.id,'gb-hl-fab');
        else if(termination==='note-B')assert.equal(after.id,'demo','latest text owns return focus');
        else assert.ok(after.id==='more'||after.tag==='H1','stable authored reading target: '+JSON.stringify(after));
        if(!unrelated)assert.ok(Math.abs(after.scroll-before)<=1,'no scroll jump');
        assert.equal(requested,1,'one presenter import across intents');
        assert.equal(moduleRequests.filter(p=>p.endsWith('/reader-library-selection.js')).length,1,'warm actions reuse selection module');
        assert.equal(moduleRequests.filter(p=>p.endsWith('/reader-library-record-transactions.js')).length,0,'opening unsaved editor must not load transaction module');
        assert.deepEqual(errors,[]);
        passes++;console.log('PASS',label,'transient selection focus');
      } catch(error){failures.push(label+': '+error.message);console.error('FAIL',label,error.message);}
      finally {clearTimeout(timer);release();await context.close();}
    }
  } finally {await browser.close();}
  console.log(name+' transient focus: '+passes+'/'+(2*cases.length));
  assert.deepEqual(failures,[],'transient focus failures');
}

(async () => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = 'http://127.0.0.1:' + server.address().port + '/articles/sample/';
  try {
    const failures=[];let passed=0,total=0;
    const run=async(label,fn)=>{total++;try{await fn();passed++;}catch(error){failures.push(label+': '+error.message);console.error('FAIL',label,error.message);}};
    for (const [name, browser] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
      for (const width of [320, 390]) await run(name+' '+width,()=>check(name,browser,url,width));
      await run(name+' GBS2',()=>checkGbs2(name,browser,url.replace('/articles/sample/','/baptisty-rossii/')));
      if(name!=='firefox') await run(name+' transient focus',()=>checkTransientFocus(name,browser,new URL(url).origin));
    }
    console.log('Reader Library browser groups: '+passed+'/'+total);
    assert.deepEqual(failures,[],'browser integration failures');
  } finally { server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; server.close(); });
