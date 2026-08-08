#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';

const write = process.argv.includes('--write');
const searchPath = 'js/search.js';
const cssPath = 'css/command-palette.css';
const browserPath = 'scripts/search-modal-browser-contract.mjs';

function fail(message) {
  throw new Error(`[search-continuation] ${message}`);
}

function countOf(text, needle) {
  if (!needle) return 0;
  return text.split(needle).length - 1;
}

function replaceOnce(text, needle, replacement, label) {
  const count = countOf(text, needle);
  if (count !== 1) fail(`${label}: expected exactly one match, got ${count}`);
  return text.replace(needle, replacement);
}

function replaceRange(text, startMarker, endMarker, transform, label) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) fail(`${label}: range markers not found`);
  const before = text.slice(0, start);
  const range = text.slice(start, end);
  const after = text.slice(end);
  return before + transform(range) + after;
}

function patchSearch(source) {
  source = replaceOnce(
    source,
    '<div class="cp-list" id="cp-listbox" role="listbox" aria-label="Результаты поиска"></div><div class="cp-footer">',
    '<div class="cp-list" id="cp-listbox" role="listbox" aria-label="Результаты поиска"></div><div class="cp-more-wrap" id="cp-more-wrap"></div><div class="cp-footer">',
    'continuation container',
  );

  source = replaceOnce(
    source,
    'S=document.getElementById("cp-listbox"),T=document.getElementById("cp-status"),B=document.getElementById("cp-preview-col"),',
    'S=document.getElementById("cp-listbox"),More=document.getElementById("cp-more-wrap"),T=document.getElementById("cp-status"),B=document.getElementById("cp-preview-col"),',
    'continuation owner handle',
  );

  source = replaceOnce(source, 'function ae(e){var t=[];', 'function ae(e){__gbClearMore();var t=[];', 'render clears stale continuation');

  const helpers = 'var __gbSearchPageSize=12;function __gbClearMore(){More&&(More.innerHTML="")}function __gbGroupTotal(e){return(e||[]).reduce(function(e,t){return e+(t&&Array.isArray(t.items)?t.items.length:0)},0)}function __gbSliceGroups(e,t){var n=t,r=[];return(e||[]).forEach(function(e){if(n>0&&e&&Array.isArray(e.items)){var t=e.items.slice(0,n);t.length&&(r.push({name:e.name,items:t}),n-=t.length)}}),r}function __gbRenderWindow(e,t,n){var r=__gbGroupTotal(e),a=Math.min(Number(t)||__gbSearchPageSize,r),o=_;ae(__gbSliceGroups(e,a)),o>0&&j.length&&oe(Math.min(o,j.length-1),!1),T.textContent=r>a?"Показано "+a+" из "+r+" "+(n||"рез."):r+" "+(n||"рез.");if(r>a&&More){More.innerHTML=\'<button type="button" class="cp-more">Показать ещё</button>\';var c=More.querySelector(".cp-more");c&&(c.setAttribute("aria-label","Показать ещё результаты. Показано "+a+" из "+r),c.addEventListener("click",function(){var t=Math.min(a+__gbSearchPageSize,r);__gbRenderWindow(e,t,n),requestAnimationFrame(function(){var e=More&&More.querySelector(".cp-more");(e||E).focus()})}))}return r}';
  source = replaceOnce(source, 'function oe(e,t){', helpers + 'function oe(e,t){', 'pagination helpers');

  for (const [needle, replacement, label] of [
    ['function re(){k.classList', 'function re(){__gbClearMore();k.classList', 'close clears continuation'],
    ['function le(){var e=se.map', 'function le(){__gbClearMore();var e=se.map', 'empty state clears continuation'],
    ['function we(){if("authors"!==C)', 'function we(){__gbClearMore();if("authors"!==C)', 'default state clears continuation'],
    ['function ke(){S.innerHTML=', 'function ke(){__gbClearMore();S.innerHTML=', 'default hint clears continuation'],
    ['function xe(e){if(e&&!(e.length<2))', 'function xe(e){__gbClearMore();if(e&&!(e.length<2))', 'query clears stale continuation'],
  ]) source = replaceOnce(source, needle, replacement, label);

  source = replaceRange(source, 'function ye(e){', 'function be(e){', (range) => {
    const capCount = countOf(range, '.slice(0,12)');
    if (capCount !== 1) fail(`fallback cap: expected one slice(0,12), got ${capCount}`);
    range = range.replace('.slice(0,12)', '');
    range = replaceOnce(
      range,
      'void ae(r.map(function(e){return{name:e,items:n[e]}}))',
      'void __gbRenderWindow(r.map(function(e){return{name:e,items:n[e]}}),__gbSearchPageSize)',
      'fallback author continuation',
    );
    range = replaceOnce(
      range,
      'ae([{name:"scripture"===C?"Ссылки в материалах":"Материалы",items:i}])',
      '__gbRenderWindow([{name:"scripture"===C?"Ссылки в материалах":"Материалы",items:i}],__gbSearchPageSize)',
      'fallback material continuation',
    );
    return range;
  }, 'fallback search');

  source = replaceRange(source, 'function Ee(e){', 'var __gbLegacySearch=xe', (range) => {
    range = replaceOnce(range, 'i.results.slice(0,10)', 'i.results', 'Pagefind pre-hydration cap removal');
    range = replaceOnce(range, 'ae(h)}else le()', '__gbRenderWindow(h,__gbSearchPageSize)}else le()', 'Pagefind continuation render');
    return range;
  }, 'Pagefind search');

  const exactStart = source.indexOf('function __gbRenderExactScripture(e,t){');
  const exactEnd = source.indexOf('function __gbSearchExactScripture(e){', exactStart);
  if (exactStart < 0 || exactEnd < 0) fail('exact Scripture function markers missing');
  const oldExact = source.slice(exactStart, exactEnd);
  if (countOf(oldExact, 'n=n.slice(0,12)') !== 1) fail('exact Scripture old cap missing or duplicated');
  const newExact = 'function __gbRenderExactScripture(e,t){var i={},n=[];return(t.occurrences||[]).forEach(function(r,a){var o=r.url+"#"+(r.anchor||"");i[o]||(i[o]=!0,n.push(__gbScriptureOccurrenceItem(t,r,a,e)))}),!!n.length&&(__gbRenderWindow([{name:"Точные вхождения",items:n}],__gbSearchPageSize,"вх."),!0)}';
  source = source.slice(0, exactStart) + newExact + source.slice(exactEnd);

  return source;
}

function patchCss(source) {
  const marker = '.cp-more-wrap:empty';
  if (source.includes(marker)) fail('continuation CSS already exists before transaction');
  return source + '\n.cp-more-wrap{flex:0 0 auto;padding:7px 14px 10px;border-top:1px solid var(--cp-border-soft);background:color-mix(in srgb,var(--cp-bg-surface) 38%,var(--cp-bg-card))}.cp-more-wrap:empty{display:none}.cp-more{display:flex;align-items:center;justify-content:center;width:100%;min-height:44px;border:1px solid color-mix(in srgb,var(--cp-accent) 22%,var(--cp-border));border-radius:10px;background:var(--cp-bg-card);color:var(--cp-accent);font-family:var(--cp-font-ui);font-size:12px;font-weight:700;letter-spacing:.03em;cursor:pointer;transition:background .18s var(--cp-ease),border-color .18s var(--cp-ease),transform .18s var(--cp-ease),box-shadow .18s var(--cp-ease);touch-action:manipulation}.cp-more:hover{background:var(--cp-accent-soft);border-color:color-mix(in srgb,var(--cp-accent) 42%,var(--cp-border))}.cp-more:active{transform:scale(.985)}.cp-more:focus-visible{outline:0;box-shadow:0 0 0 3px var(--cp-accent-soft);border-color:var(--cp-accent)}\n';
}

const continuationBrowserHelper = String.raw`
async function runContinuationContract(browserType, browserName, port) {
  const browser = await browserType.launch({ headless: true });
  const summary = { browser: browserName, pagefind: null, fallback: null, scripture: null };

  async function openFixture(configure) {
    const context = await browser.newContext({ viewport: { width: 960, height: 760 } });
    const page = await context.newPage();
    if (configure) await configure(page);
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => window.GBSearch && typeof window.GBSearch.open === 'function');
    await page.evaluate(() => window.GBSearch.open());
    await page.waitForFunction(
      () => window.GBSearch?.__ready === true && document.querySelector('.cp-backdrop')?.classList.contains('is-open'),
      null,
      { timeout: 30_000 },
    );
    return { context, page, input: page.locator('.cp-input') };
  }

  async function assertPaged(page, total, label) {
    await page.waitForFunction(({ total, label }) => {
      const status = document.getElementById('cp-status')?.textContent || '';
      return document.querySelectorAll('.cp-item[role="option"]').length === 12 &&
        status === `Показано 12 из ${total} ${label}` &&
        !!document.querySelector('#cp-more-wrap > .cp-more');
    }, { total, label }, { timeout: 30_000 });
    assert.equal(await page.locator('#cp-listbox .cp-more').count(), 0, 'continuation button must stay outside listbox');
    await page.locator('#cp-more-wrap > .cp-more').click();
    await page.waitForFunction(({ total, label }) => {
      const status = document.getElementById('cp-status')?.textContent || '';
      return document.querySelectorAll('.cp-item[role="option"]').length === total &&
        status === `${total} ${label}` &&
        !document.querySelector('#cp-more-wrap > .cp-more');
    }, { total, label }, { timeout: 30_000 });
    const ids = await page.locator('.cp-item[role="option"]').evaluateAll((nodes) => nodes.map((node) => node.id));
    assert.equal(new Set(ids).size, total, 'continued options must keep unique ids');
    return { initial: 12, total };
  }

  try {
    {
      const { context, page, input } = await openFixture();
      await page.evaluate(() => {
        const urls = Array.from({ length: 16 }, (_, index) => index < 2 ? '/fixture/pagefind-duplicate/' : `/fixture/pagefind-${index}/`);
        window.__pagefind__ = {
          search: async () => ({
            results: urls.map((url, index) => ({
              data: async () => ({
                url,
                meta: { title: `Fixture Pagefind ${index}`, author: '', readTime: '1', category: 'Fixture', scripture: '' },
                excerpt: `Fixture Pagefind excerpt ${index}`,
              }),
            })),
          }),
        };
        window.__pagefindReady__ = true;
        window.__pagefindFailed__ = false;
      });
      await input.fill('fixture-pagefind');
      summary.pagefind = await assertPaged(page, 15, 'рез.');
      await context.close();
    }

    {
      const manifest = {
        items: Array.from({ length: 16 }, (_, index) => ({
          id: `fallback-${index}`,
          type: 'article',
          url: `/fixture/fallback-${index}/`,
          title: `fixturefallback ${index}`,
          description: `fixturefallback material ${index}`,
          section: 'Fixture',
          author: 'Fixture Author',
          priority: 100 - index,
          tags: ['fixturefallback'],
        })),
      };
      const { context, page, input } = await openFixture(async (fixturePage) => {
        await fixturePage.route('**/pagefind/pagefind.js', async (route) => {
          await route.fulfill({ status: 404, contentType: 'text/plain', body: 'missing in fallback fixture' });
        });
        await fixturePage.route('**/data/search-manifest.json', async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(manifest) });
        });
      });
      await input.fill('fixturefallback');
      summary.fallback = await assertPaged(page, 16, 'рез.');
      await context.close();
    }

    {
      const scriptureIndex = {
        schemaVersion: 1,
        references: [{
          id: 'jer-17-9-fixture',
          label: 'Иер 17:9',
          occurrences: Array.from({ length: 15 }, (_, index) => ({
            url: `/fixture/scripture-${index}/`,
            anchor: `fixture-${index}`,
            title: `Fixture Scripture ${index}`,
            context: `Fixture context ${index}`,
            topics: ['fixture'],
          })),
        }],
      };
      const { context, page, input } = await openFixture(async (fixturePage) => {
        await fixturePage.route('**/data/scripture-search-index.json', async (route) => {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(scriptureIndex) });
        });
      });
      await page.locator('[data-scope="scripture"]').click();
      await input.fill('Иер 17:9');
      summary.scripture = await assertPaged(page, 15, 'вх.');
      await context.close();
    }

    return { continuation: summary };
  } finally {
    await browser.close();
  }
}
`;

function patchBrowser(source) {
  source = replaceOnce(
    source,
    "  assert.match(cssSource, /\\.gb-nav-search-icon\\{[^}]*width:44px;[^}]*height:44px;/, '44px search trigger missing');\n}",
    "  assert.match(cssSource, /\\.gb-nav-search-icon\\{[^}]*width:44px;[^}]*height:44px;/, '44px search trigger missing');\n  for (const marker of ['id=\\\"cp-more-wrap\\\"', 'class=\\\"cp-more\\\"', 'Показано ']) assert.ok(jsSource.includes(marker), `missing continuation JS marker: ${marker}`);\n  assert.ok(!jsSource.includes('i.results.slice(0,10)'), 'Pagefind pre-hydration cap survived');\n  for (const marker of ['.cp-more-wrap:empty', '.cp-more:focus-visible']) assert.ok(cssSource.includes(marker), `missing continuation CSS marker: ${marker}`);\n}",
    'Search source validation extension',
  );

  source = replaceOnce(source, 'const matrix = [', continuationBrowserHelper + '\nconst matrix = [', 'continuation browser helper');
  source = replaceOnce(
    source,
    "  for (let index = 0; index < matrix.length; index += 1) {\n    const [browserType, browserName, viewport] = matrix[index];\n    results.push(await runCase(browserType, browserName, viewport, port, index + 1));\n  }\n} finally {",
    "  for (let index = 0; index < matrix.length; index += 1) {\n    const [browserType, browserName, viewport] = matrix[index];\n    results.push(await runCase(browserType, browserName, viewport, port, index + 1));\n  }\n  results.push(await runContinuationContract(chromium, 'chromium', port));\n  results.push(await runContinuationContract(webkit, 'webkit', port));\n} finally {",
    'continuation browser execution',
  );
  return source;
}

function validateFinal(search, css, browser) {
  const requiredSearch = [
    'id="cp-more-wrap"',
    'class="cp-more"',
    'var __gbSearchPageSize=12',
    'Показано ',
    '__gbRenderWindow(h,__gbSearchPageSize)',
    '__gbRenderWindow([{name:"Точные вхождения",items:n}],__gbSearchPageSize,"вх.")',
  ];
  for (const marker of requiredSearch) if (!search.includes(marker)) fail(`final search missing marker: ${marker}`);
  if (search.includes('i.results.slice(0,10)')) fail('final search still caps Pagefind before hydration');
  const fallbackRange = search.slice(search.indexOf('function ye(e){'), search.indexOf('function be(e){'));
  if (fallbackRange.includes('.slice(0,12)')) fail('final fallback search still caps at 12 before continuation');
  const exactRange = search.slice(search.indexOf('function __gbRenderExactScripture'), search.indexOf('function __gbSearchExactScripture'));
  if (exactRange.includes('slice(0,12)')) fail('final exact Scripture still caps before continuation');
  for (const marker of ['.cp-more-wrap:empty', '.cp-more:focus-visible']) if (!css.includes(marker)) fail(`final CSS missing marker: ${marker}`);
  for (const marker of ['runContinuationContract', 'Pagefind pre-hydration cap survived', "assertPaged(page, 16, 'рез.')", "assertPaged(page, 15, 'вх.')"]) if (!browser.includes(marker)) fail(`final browser contract missing marker: ${marker}`);
}

let search = fs.readFileSync(searchPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');
let browser = fs.readFileSync(browserPath, 'utf8');

if (write) {
  search = patchSearch(search);
  css = patchCss(css);
  browser = patchBrowser(browser);
  validateFinal(search, css, browser);
  fs.writeFileSync(searchPath, search);
  fs.writeFileSync(cssPath, css);
  fs.writeFileSync(browserPath, browser);
  console.log('[search-continuation] applied exact-count source/runtime/browser changes');
} else {
  validateFinal(search, css, browser);
  console.log('[search-continuation] final contract OK');
}
