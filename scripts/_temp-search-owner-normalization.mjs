#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const p = (rel) => path.join(ROOT, rel);
const read = (rel) => fs.readFileSync(p(rel), 'utf8');
const write = (rel, value) => fs.writeFileSync(p(rel), value, 'utf8');
const count = (source, token) => source.split(token).length - 1;

function replaceOnce(source, before, after, label) {
  assert.equal(count(source, before), 1, `${label}: expected one exact owner`);
  return source.replace(before, after);
}
function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `${label}: range markers missing`);
  assert.equal(source.indexOf(startMarker, start + 1), -1, `${label}: duplicate start marker`);
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function applyOwnerNormalization() {
  // 1) One canonical shortcut predicate lives in existing shared SiteUtils.
  let siteUtils = read('js/site-utils.js');
  assert.equal(siteUtils.includes("protectedMethod('isCanonicalSearchShortcut'"), false, 'SiteUtils shortcut owner already exists');
  const siteOwner = `  function searchShortcutEditableTarget(event) {\n    var target = event && event.target;\n    return Boolean(\n      target &&\n      target.nodeType === 1 &&\n      typeof target.closest === 'function' &&\n      target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')\n    );\n  }\n\n  function isCanonicalSearchShortcut(event) {\n    return String(event && event.key || '').toLowerCase() === 'k' &&\n      Number(Boolean(event && event.ctrlKey)) + Number(Boolean(event && event.metaKey)) === 1 &&\n      !event.altKey &&\n      !event.shiftKey &&\n      !event.isComposing &&\n      !searchShortcutEditableTarget(event);\n  }\n\n`;
  siteUtils = replaceOnce(siteUtils, '  function protectedMethod(name, fn) {', `${siteOwner}  function protectedMethod(name, fn) {`, 'SiteUtils owner insertion');
  siteUtils = replaceOnce(siteUtils, "  protectedMethod('lockScroll', lockScroll);", "  protectedMethod('isCanonicalSearchShortcut', isCanonicalSearchShortcut);\n  protectedMethod('lockScroll', lockScroll);", 'SiteUtils public method');
  write('js/site-utils.js', siteUtils);

  // 2) search.js delegates both bootstrap and loaded runtime to SiteUtils, fail-closed if absent.
  let search = read('js/search.js');
  const searchStart = 'function __gbSearchEditableTarget(e)';
  const searchEnd = 'function __gbSyncSearchTriggerLabels(e)';
  assert.equal(count(search, searchStart), 1, 'Search old local editable helper count');
  const delegated = 'function __gbSearchCanonicalShortcut(e){return!!(window.SiteUtils&&"function"==typeof window.SiteUtils.isCanonicalSearchShortcut&&window.SiteUtils.isCanonicalSearchShortcut(e))}';
  search = replaceRange(search, searchStart, searchEnd, delegated, 'Search shortcut delegation');
  assert.equal(count(search, '__gbSearchCanonicalShortcut(e)&&'), 2, 'Search must retain two canonical consumers');
  assert.equal(search.includes('function __gbSearchEditableTarget'), false, 'Search local semantic duplicate survived');
  write('js/search.js', search);

  // 3) Home progressive capture workaround must stay retired.
  const homeProgressive = read('src/components/home/HomeProgressiveEnhancementHead.astro');
  assert.equal(homeProgressive.includes('stopImmediatePropagation'), false, 'Home progressive capture workaround returned');

  // 4) Home lazy bootstrap delegates pre-load semantics; loaded Search owns shortcut after ready.
  let homeChrome = read('src/components/home/HomePageChrome.astro');
  const homeShortcutStart = '    const onShortcut = (event) => {';
  const homeShortcutEnd = '    const onSearchClick = (event) => {';
  const homeShortcut = `    const onShortcut = (event) => {\n      const canonicalShortcut = window.SiteUtils?.isCanonicalSearchShortcut;\n      if (typeof canonicalShortcut !== 'function' || !canonicalShortcut(event)) return;\n      window.__gbHomeSearchOpener = stableOpener(document.activeElement);\n      if (window.GBSearch?.__ready) {\n        if (isMobileNavOpen()) window.closeMobileNav?.();\n        return;\n      }\n      event.preventDefault();\n      openSearch(document.activeElement);\n    };\n\n`;
  homeChrome = replaceRange(homeChrome, homeShortcutStart, homeShortcutEnd, homeShortcut, 'Home lazy shortcut');
  write('src/components/home/HomePageChrome.astro', homeChrome);

  // 5) BaseLayout lazy bootstrap delegates to SiteUtils.
  let baseLayout = read('src/layouts/BaseLayout.astro');
  const baseBroad = 'function k(n){(n.metaKey||n.ctrlKey)&&"k"===String(n.key).toLowerCase()&&(n.preventDefault(),u(true))}';
  const baseCanonical = 'function k(n){window.SiteUtils&&window.SiteUtils.isCanonicalSearchShortcut(n)&&(n.preventDefault(),u(true))}';
  baseLayout = replaceOnce(baseLayout, baseBroad, baseCanonical, 'BaseLayout lazy shortcut');
  write('src/layouts/BaseLayout.astro', baseLayout);

  // 6) Strict-native app routes load SiteUtils before search.js; AppSearchSurface no longer arbitrates keydown.
  let appHead = read('src/components/search/AppSearchHead.astro');
  const appHeadOld = '<link rel="stylesheet" href="/css/command-palette.css?v=c174cedb" />\n<script is:inline src="/js/search.js?v=d9de78e6" defer></script>';
  const appHeadNew = '<link rel="stylesheet" href="/css/command-palette.css?v=c174cedb" />\n<script is:inline src="/js/site-utils.js?v=30ed46cf" defer></script>\n<script is:inline src="/js/search.js?v=d9de78e6" defer></script>';
  appHead = replaceOnce(appHead, appHeadOld, appHeadNew, 'AppSearchHead shared utility order');
  write('src/components/search/AppSearchHead.astro', appHead);

  let appSurface = read('src/components/search/AppSearchSurface.astro');
  const appScriptStart = '<script is:inline>\n  (() => {\n    const trigger = document.querySelector(\'[data-app-search-trigger]\');';
  const appScriptEnd = '</script>';
  const appStart = appSurface.indexOf(appScriptStart);
  const appEnd = appSurface.indexOf(appScriptEnd, appStart);
  assert.ok(appStart >= 0 && appEnd > appStart, 'AppSearchSurface shortcut script missing');
  appSurface = `${appSurface.slice(0, appStart)}${appSurface.slice(appEnd + appScriptEnd.length)}`.replace(/\n{3,}/g, '\n\n');
  assert.equal(appSurface.includes("window.addEventListener('keydown'"), false, 'App route shortcut owner survived');
  assert.equal(appSurface.includes('stopImmediatePropagation'), false, 'App route shortcut arbitration survived');
  write('src/components/search/AppSearchSurface.astro', appSurface);

  // 7) Public static 404 lazy loader delegates before Search is ready; after ready, search.js owns keydown.
  let notFound = read('404.html');
  const notFoundBroad = 'function key(e){(e.metaKey||e.ctrlKey)&&String(e.key).toLowerCase()==="k"&&(e.preventDefault(),__gbLoadSearch(true))}';
  const notFoundCanonical = 'function key(e){if(window.GBSearch&&window.GBSearch.__ready)return;window.SiteUtils&&window.SiteUtils.isCanonicalSearchShortcut(e)&&(e.preventDefault(),__gbLoadSearch(true))}';
  notFound = replaceOnce(notFound, notFoundBroad, notFoundCanonical, '404 lazy shortcut');
  write('404.html', notFound);

  // 8) Class-level source contract owns every current global shortcut boundary.
  let sourceContract = read('scripts/app-search-surface-source-contract.mjs');
  sourceContract = replaceOnce(
    sourceContract,
    "  search: read('js/search.js'),",
    "  search: read('js/search.js'),\n  siteUtils: read('js/site-utils.js'),\n  baseLayout: read('src/layouts/BaseLayout.astro'),\n  homeChrome: read('src/components/home/HomePageChrome.astro'),\n  homeProgressive: read('src/components/home/HomeProgressiveEnhancementHead.astro'),\n  notFound: read('404.html'),",
    'source contract file owners',
  );
  sourceContract = replaceOnce(
    sourceContract,
    "check(files.head.includes(`/js/search.js?v=${searchHash}`), 'current search revision missing');\ncheck(files.head.includes('defer'), 'search bootstrap must remain deferred');",
    "check(files.head.includes(`/js/search.js?v=${searchHash}`), 'current search revision missing');\nconst siteUtilsHash = crypto.createHash('md5').update(files.siteUtils).digest('hex').slice(0, 8);\ncheck(files.head.includes(`/js/site-utils.js?v=${siteUtilsHash}`), 'current SiteUtils revision missing');\ncheck(files.head.indexOf('/js/site-utils.js') < files.head.indexOf('/js/search.js'), 'SiteUtils must load before Search');\ncheck(files.head.includes('defer'), 'search bootstrap must remain deferred');",
    'source contract app head hashes',
  );
  sourceContract = replaceOnce(
    sourceContract,
    "check(files.surface.includes(\"window.addEventListener('keydown'\"), 'route shortcut owner missing');\ncheck(files.surface.includes('event.stopImmediatePropagation()'), 'route shortcut arbitration missing');",
    "check(!files.surface.includes(\"window.addEventListener('keydown'\"), 'App route-local shortcut owner survived');\ncheck(!files.surface.includes('stopImmediatePropagation()'), 'App route-local shortcut arbitration survived');",
    'source contract route owner retirement',
  );
  const sharedMarker = "check(!files.search.includes('<span class=\"kb\">⌘K</span>'), 'Mac-only visible fallback survived');";
  const sharedChecks = `${sharedMarker}\n\nfor (const marker of [\n  \"protectedMethod('isCanonicalSearchShortcut', isCanonicalSearchShortcut)\",\n  \"target.closest('input,textarea,select,[contenteditable]:not([contenteditable=\\\"false\\\"]),[role=\\\"textbox\\\"]')\",\n  \"Number(Boolean(event && event.ctrlKey)) + Number(Boolean(event && event.metaKey)) === 1\",\n  \"!event.altKey\",\n  \"!event.shiftKey\",\n  \"!event.isComposing\",\n]) check(files.siteUtils.includes(marker), \`SiteUtils canonical shortcut marker missing: \${marker}\`);\ncheck(files.search.includes('window.SiteUtils.isCanonicalSearchShortcut&&window.SiteUtils.isCanonicalSearchShortcut(e)'), 'Search must delegate shortcut semantics to SiteUtils');\ncheck(!files.search.includes('function __gbSearchEditableTarget'), 'Search-local editable predicate survived');\ncheck(files.baseLayout.includes('window.SiteUtils&&window.SiteUtils.isCanonicalSearchShortcut(n)'), 'BaseLayout lazy bootstrap must delegate to SiteUtils');\ncheck(files.homeChrome.includes('window.SiteUtils?.isCanonicalSearchShortcut'), 'Home lazy bootstrap must delegate to SiteUtils');\ncheck(!files.homeProgressive.includes('stopImmediatePropagation'), 'Home progressive shortcut workaround survived');\ncheck(files.notFound.includes('window.SiteUtils.isCanonicalSearchShortcut(e)'), '404 lazy bootstrap must delegate to SiteUtils');\nfor (const owner of [files.search, files.baseLayout, files.homeChrome, files.notFound]) {\n  check(!owner.includes('(e.metaKey||e.ctrlKey)&&String(e.key).toLowerCase()===\\\"k\\\"'), 'broad Ctrl/Meta shortcut owner survived');\n  check(!owner.includes('(e.metaKey||e.ctrlKey)&&\\\"k\\\"===String(e.key).toLowerCase()'), 'broad reversed shortcut owner survived');\n}`;
  sourceContract = replaceOnce(sourceContract, sharedMarker, sharedChecks, 'source contract canonical shortcut class guard');
  write('scripts/app-search-surface-source-contract.mjs', sourceContract);

  // 9) Home source assertions now bind to SiteUtils rather than duplicating semantics inside search.js.
  let homeBrowser = read('scripts/home-browser-contract.mjs');
  const hbStart = "const SEARCH_SOURCE = fs.readFileSync(path.join(ROOT, 'js/search.js'), 'utf8');";
  const hbEnd = "const DIST = path.join(ROOT, 'dist');";
  const hbBlock = `const SEARCH_SOURCE = fs.readFileSync(path.join(ROOT, 'js/search.js'), 'utf8');\nconst SITE_UTILS_SOURCE = fs.readFileSync(path.join(ROOT, 'js/site-utils.js'), 'utf8');\nconst HOME_CHROME_SOURCE = fs.readFileSync(path.join(ROOT, 'src/components/home/HomePageChrome.astro'), 'utf8');\nconst HOME_PROGRESSIVE_SOURCE = fs.readFileSync(path.join(ROOT, 'src/components/home/HomeProgressiveEnhancementHead.astro'), 'utf8');\nassert.equal((SITE_UTILS_SOURCE.match(/function isCanonicalSearchShortcut\\(/g) || []).length, 1, 'SiteUtils must expose one canonical Search shortcut predicate');\nassert.equal(SITE_UTILS_SOURCE.includes(\"protectedMethod('isCanonicalSearchShortcut', isCanonicalSearchShortcut)\"), true, 'SiteUtils shortcut predicate must be protected shared API');\nassert.equal((SEARCH_SOURCE.match(/__gbSearchCanonicalShortcut\\(e\\)&&/g) || []).length, 2, 'bootstrap and loaded Search owners must share one delegated predicate');\nassert.equal(SEARCH_SOURCE.includes('window.SiteUtils.isCanonicalSearchShortcut&&window.SiteUtils.isCanonicalSearchShortcut(e)'), true, 'Search must delegate shortcut semantics to SiteUtils');\nassert.equal(HOME_CHROME_SOURCE.includes('window.SiteUtils?.isCanonicalSearchShortcut'), true, 'Home lazy bootstrap must delegate to SiteUtils');\nassert.equal(HOME_PROGRESSIVE_SOURCE.includes('stopImmediatePropagation'), false, 'Home progressive shortcut workaround must stay retired');\n`;
  homeBrowser = replaceRange(homeBrowser, hbStart, hbEnd, hbBlock, 'Home browser source contract');
  write('scripts/home-browser-contract.mjs', homeBrowser);

  // 10) App browser checks modified and editable chords after the eager shared runtime is ready.
  let appBrowser = read('scripts/app-search-surface-browser-contract.mjs');
  const shortcutAnchor = "    await page.keyboard.press(platformScenario.shortcutPress);\n    await page.waitForFunction(() => document.querySelector('.cp-backdrop')?.classList.contains('is-open'));";
  const shortcutChecks = `    const assertShortcutClosed = async (label, press) => {\n      await press();\n      await page.waitForTimeout(80);\n      assert.equal(await page.locator('.cp-backdrop.is-open').count(), 0, \`${'${id}'}: \${label} must not open Search\`);\n    };\n    const invalidAlt = browserName === 'webkit' ? 'Alt+Meta+K' : 'Alt+Control+K';\n    const invalidShift = browserName === 'webkit' ? 'Shift+Meta+K' : 'Shift+Control+K';\n    await assertShortcutClosed('Alt-modified shortcut', () => page.keyboard.press(invalidAlt));\n    await assertShortcutClosed('Shift-modified shortcut', () => page.keyboard.press(invalidShift));\n    await assertShortcutClosed('Ctrl+Meta+K', () => page.keyboard.press('Control+Meta+K'));\n    await page.evaluate(() => {\n      const editor = document.createElement('div');\n      editor.id = 'app-search-contract-textbox';\n      editor.tabIndex = 0;\n      editor.setAttribute('role', 'textbox');\n      editor.textContent = 'editor';\n      document.body.appendChild(editor);\n      editor.focus();\n    });\n    await assertShortcutClosed('editable shortcut', () => page.keyboard.press(platformScenario.shortcutPress));\n    await page.locator('#gbSearchBtn').focus();\n\n    await page.keyboard.press(platformScenario.shortcutPress);\n    await page.waitForFunction(() => document.querySelector('.cp-backdrop')?.classList.contains('is-open'));`;
  appBrowser = replaceOnce(appBrowser, shortcutAnchor, shortcutChecks, 'App browser shortcut matrix');
  write('scripts/app-search-surface-browser-contract.mjs', appBrowser);

  // 11) Existing Search Modal workflow follows every permanent owner used by its source contract.
  let workflow = read('.github/workflows/search-modal-contract.yml');
  const triggerAnchor = "      - 'js/search.js'\n      - 'css/command-palette.css'";
  const triggerExpanded = "      - 'js/search.js'\n      - 'js/site-utils.js'\n      - '404.html'\n      - 'src/layouts/BaseLayout.astro'\n      - 'src/components/home/HomePageChrome.astro'\n      - 'src/components/home/HomeProgressiveEnhancementHead.astro'\n      - 'css/command-palette.css'";
  assert.equal(count(workflow, triggerAnchor), 2, 'Search workflow PR/push trigger anchors drifted');
  workflow = workflow.split(triggerAnchor).join(triggerExpanded);
  write('.github/workflows/search-modal-contract.yml', workflow);

  // Static assertions before projection.
  for (const file of [
    'js/site-utils.js', 'js/search.js', 'src/components/home/HomePageChrome.astro',
    'src/layouts/BaseLayout.astro', 'src/components/search/AppSearchHead.astro',
    'src/components/search/AppSearchSurface.astro', 'scripts/app-search-surface-source-contract.mjs',
    'scripts/home-browser-contract.mjs', 'scripts/app-search-surface-browser-contract.mjs',
  ]) assert.equal(read(file).includes('\r\n'), false, `${file}: unexpected CRLF drift`);

  console.log('Search shortcut owner normalization applied.');
}

function decodeEntities(value) {
  const named = new Map([['amp','&'],['lt','<'],['gt','>'],['quot','"'],['apos',"'"],['nbsp',' '],['laquo','«'],['raquo','»'],['ndash','–'],['mdash','—'],['hellip','…']]);
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (full, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return named.get(entity.toLowerCase()) ?? full;
  });
}
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const gitBlobSha1 = (bytes) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');
function htmlMetrics(raw, bytes) {
  const normalizedText = decodeEntities(raw.replace(/<!--[^]*?-->/g,' ').replace(/<script\b[^>]*>[^]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[^]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
  const words = normalizedText.match(/[0-9A-Za-zА-Яа-яЁё]+(?:[-'’][0-9A-Za-zА-Яа-яЁё]+)*/g) || [];
  return { gitBlobSha1: gitBlobSha1(bytes), byteSha256: sha256(bytes), normalizedTextSha256: sha256(Buffer.from(normalizedText)), bytes: bytes.length, wordCount: words.length, h1Count: (raw.match(/<h1\b/gi)||[]).length, h2Count: (raw.match(/<h2\b/gi)||[]).length };
}
function refreshLedger(sourceSha) {
  assert.match(sourceSha, /^[0-9a-f]{40}$/, 'clean source SHA required');
  const manifestPath = 'data/legacy-reference-ledger/manifest.json';
  const manifest = JSON.parse(read(manifestPath));
  manifest.auditedAtCommit = sourceSha;
  for (const shardRel of manifest.referenceShards || []) {
    const shard = JSON.parse(read(shardRel));
    for (const entry of shard.entries || []) {
      const bytes = fs.readFileSync(p(entry.legacyPath));
      const next = htmlMetrics(bytes.toString('utf8'), bytes);
      assert.equal(next.normalizedTextSha256, entry.normalizedTextSha256, `${entry.legacyPath}: normalized text changed during projection`);
      assert.equal(next.wordCount, entry.wordCount, `${entry.legacyPath}: word count changed during projection`);
      assert.equal(next.h1Count, entry.h1Count, `${entry.legacyPath}: h1 count changed during projection`);
      assert.equal(next.h2Count, entry.h2Count, `${entry.legacyPath}: h2 count changed during projection`);
      Object.assign(entry, next, { sourceCommit: sourceSha });
    }
    write(shardRel, `${JSON.stringify(shard, null, 2)}\n`);
  }
  write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Legacy reference ledger refreshed for ${sourceSha}.`);
}

const [mode, value] = process.argv.slice(2);
if (mode === '--apply') applyOwnerNormalization();
else if (mode === '--refresh-ledger') refreshLedger(String(value || '').trim().toLowerCase());
else throw new Error('Usage: --apply | --refresh-ledger <sha>');
