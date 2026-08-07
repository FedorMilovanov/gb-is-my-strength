#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(process.cwd());
const p = (rel) => path.join(ROOT, rel);
const read = (rel) => fs.readFileSync(p(rel), 'utf8');
const write = (rel, value) => fs.writeFileSync(p(rel), value, 'utf8');
const count = (source, token) => source.split(token).length - 1;
const require = createRequire(import.meta.url);

function replaceOnce(source, before, after, label) {
  assert.equal(count(source, before), 1, `${label}: expected one exact match`);
  return source.replace(before, after);
}

function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `${label}: range markers missing`);
  assert.equal(source.indexOf(startMarker, start + 1), -1, `${label}: duplicate start marker`);
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules', 'dist', 'out', 'build', 'coverage', 'reports', 'audit', '.astro'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (predicate(full)) out.push(full);
  }
  return out;
}

function rel(abs) {
  return path.relative(ROOT, abs).replace(/\\/g, '/');
}

function hasRawSearchShortcut(source) {
  const hasKeydown = /addEventListener\s*\(\s*['"]keydown['"]/.test(source);
  const hasModifier = /\b(?:ctrlKey|metaKey)\b/.test(source);
  const hasKeyK =
    /(?:String\s*\([^)]*\.key[^)]*\)\.toLowerCase\s*\(\)|\.key)\s*(?:===|==)\s*['"]k['"]/i.test(source) ||
    /['"]k['"]\s*(?:===|==)\s*(?:String\s*\([^)]*\.key[^)]*\)\.toLowerCase\s*\(\)|[^;\n]{0,80}\.key)/i.test(source) ||
    /toLowerCase\s*\(\)[\s\S]{0,80}['"]k['"]/i.test(source);
  return hasKeydown && hasModifier && hasKeyK;
}

function collectProductionHtml() {
  const { buildPublicSurfaceRegistry } = require('./lib/public-surface-registry');
  const { buildAuditProSourceCorpus } = require('./lib/audit-pro-source-corpus');
  const allHtmlFiles = walk(ROOT, (file) => file.endsWith('.html') && !/[\\/]scripts[\\/]/.test(file));
  const registry = buildPublicSurfaceRegistry();
  assert.deepEqual(registry.errors || [], [], `public surface registry errors: ${(registry.errors || []).join(' | ')}`);
  const corpus = buildAuditProSourceCorpus({ root: ROOT, entries: registry.entries, allHtmlFiles });
  return [...new Set([
    ...corpus.sourcePages.map((item) => item.file),
    p('404.html'),
  ].filter((file) => fs.existsSync(file)))];
}

const COMMON_LAZY_KEY =
  'function key(e){(e.metaKey||e.ctrlKey)&&String(e.key).toLowerCase()==="k"&&(e.preventDefault(),load(true))}';
const COMMON_LAZY_BIND = 'document.addEventListener("keydown",key,true);';

function retireCommonLazyKeyboardOwners(files) {
  const changed = [];
  for (const abs of files) {
    let source = fs.readFileSync(abs, 'utf8');
    const keyCount = count(source, COMMON_LAZY_KEY);
    const bindCount = count(source, COMMON_LAZY_BIND);
    if (!keyCount && !bindCount) continue;
    assert.equal(keyCount, bindCount, `${rel(abs)}: lazy key/bind count mismatch`);
    assert.ok(keyCount >= 1, `${rel(abs)}: key owner missing`);
    source = source.split(COMMON_LAZY_KEY).join('');
    source = source.split(COMMON_LAZY_BIND).join('');
    fs.writeFileSync(abs, source, 'utf8');
    changed.push({ file: rel(abs), owners: keyCount });
  }
  return changed;
}

function assertSoleRawOwner(productionHtml) {
  const candidates = [
    ...walk(p('js'), (file) => file.endsWith('.js')),
    ...walk(p('src'), (file) => file.endsWith('.astro')),
    ...productionHtml,
  ];
  const owners = [...new Set(candidates)]
    .filter((file) => hasRawSearchShortcut(fs.readFileSync(file, 'utf8')))
    .map(rel)
    .sort();
  assert.deepEqual(owners, ['js/site-utils.js'], `raw Ctrl/Meta+K owners drifted: ${owners.join(', ')}`);
}

function applyOwnerNormalization() {
  // 1) SiteUtils is the sole raw keyboard boundary.
  let siteUtils = read('js/site-utils.js');
  assert.equal(siteUtils.includes('function isCanonicalSearchShortcut('), false, 'SiteUtils Search owner already exists');
  const owner = `  function searchShortcutEditableTarget(event) {
    var target = event && event.target;
    return Boolean(
      target &&
      target.nodeType === 1 &&
      typeof target.closest === 'function' &&
      target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')
    );
  }

  function isCanonicalSearchShortcut(event) {
    var modifierCount = Number(Boolean(event && event.ctrlKey)) + Number(Boolean(event && event.metaKey));
    return String(event && event.key || '').toLowerCase() === 'k' &&
      modifierCount === 1 &&
      !event.altKey &&
      !event.shiftKey &&
      !event.isComposing &&
      !searchShortcutEditableTarget(event);
  }

  function handleSearchShortcut(event) {
    if (!isCanonicalSearchShortcut(event)) return;
    event.preventDefault();
    window.dispatchEvent(new CustomEvent('gb:openSearch', { detail: { source: 'keyboard' } }));
  }

`;
  siteUtils = replaceOnce(siteUtils, '  function protectedMethod(name, fn) {', `${owner}  function protectedMethod(name, fn) {`, 'SiteUtils Search owner insertion');
  siteUtils = replaceOnce(
    siteUtils,
    "  protectedMethod('lockScroll', lockScroll);",
    "  document.addEventListener('keydown', handleSearchShortcut, true);\n\n  protectedMethod('lockScroll', lockScroll);",
    'SiteUtils Search owner registration',
  );
  write('js/site-utils.js', siteUtils);

  // 2) Search owns modal behavior, never the global keyboard chord.
  let search = read('js/search.js');
  const bootstrapOwner = 'document.addEventListener("keydown",function(e){(e.metaKey||e.ctrlKey)&&String(e.key).toLowerCase()==="k"&&(e.preventDefault(),__gbLoadSearch(true))},true);';
  search = replaceOnce(search, bootstrapOwner, '', 'Search bootstrap keyboard owner retirement');
  const loadedOwner = 'document.addEventListener("keydown",function(e){(e.metaKey||e.ctrlKey)&&"k"===String(e.key).toLowerCase()&&(e.preventDefault(),k.classList.contains("is-open")?re():ne()),"Escape"===e.key&&k.classList.contains("is-open")&&re()})';
  const escapeOnly = 'document.addEventListener("keydown",function(e){"Escape"===e.key&&k.classList.contains("is-open")&&re()})';
  search = replaceOnce(search, loadedOwner, escapeOnly, 'Search loaded keyboard owner retirement');
  assert.equal(/\b(?:ctrlKey|metaKey)\b/.test(search), false, 'Search still parses global modifiers');
  assert.ok(search.includes('window.addEventListener("gb:openSearch",function(){ne()})'), 'Search open transport missing');
  write('js/search.js', search);

  // 3) Home no longer needs the capture workaround or route-local shortcut parser.
  let homeProgressive = read('src/components/home/HomeProgressiveEnhancementHead.astro');
  const progressiveGate = /<script is:inline>\n  \(\(\) => \{\n    const isEditable =[\s\S]*?document\.addEventListener\('keydown',[\s\S]*?\n  \}\)\(\);\n<\/script>\n\n/;
  assert.equal((homeProgressive.match(progressiveGate) || []).length, 1, 'Home progressive keyboard gate drifted');
  homeProgressive = homeProgressive.replace(progressiveGate, '');
  write('src/components/home/HomeProgressiveEnhancementHead.astro', homeProgressive);

  let homeChrome = read('src/components/home/HomePageChrome.astro');
  homeChrome = replaceRange(
    homeChrome,
    '    const onShortcut = (event) => {',
    '    const onSearchClick = (event) => {',
    '',
    'Home shortcut owner',
  );
  homeChrome = replaceOnce(
    homeChrome,
    "    document.addEventListener('keydown', onShortcut, true);\n",
    '',
    'Home shortcut registration',
  );
  assert.ok(homeChrome.includes("window.addEventListener('gb:openSearch', () => openSearch(document.activeElement));"), 'Home gb:openSearch orchestration missing');
  write('src/components/home/HomePageChrome.astro', homeChrome);

  // 4) BaseLayout preserves lazy loading but delegates keyboard intent to gb:openSearch.
  let baseLayout = read('src/layouts/BaseLayout.astro');
  const baseBootstrap = '!function(){var e=function(o){window.__gbSearchBootRequested=true,window.__gbSearchOpenAfterLoad=!!o;var t=document.createElement("script");t.defer=true,t.src=__gbSearchSrc,document.head.appendChild(t);e=function(){}};function u(o){e(o),document.removeEventListener("keydown",k),document.removeEventListener("click",c),document.removeEventListener("touchstart",c)}function k(n){(n.metaKey||n.ctrlKey)&&"k"===String(n.key).toLowerCase()&&(n.preventDefault(),u(true))}function c(){u(false)}document.addEventListener("keydown",k),document.addEventListener("click",c),document.addEventListener("touchstart",c)}();';
  const baseDelegated = '!function(){function u(o){if(window.GBSearch&&window.GBSearch.open&&window.GBSearch.__ready){o&&window.GBSearch.open();return}if(o)window.__gbSearchOpenAfterLoad=true;if(window.__gbSearchLoading)return;window.__gbSearchLoading=true,window.__gbSearchBootRequested=true;var t=document.createElement("script");t.defer=true,t.src=__gbSearchSrc,t.onload=function(){window.__gbSearchLoading=false,o&&window.GBSearch&&window.GBSearch.open&&window.GBSearch.open()},t.onerror=function(){window.__gbSearchLoading=false},document.head.appendChild(t)}function d(){document.removeEventListener("click",c),document.removeEventListener("touchstart",c)}function c(){d(),u(false)}document.addEventListener("click",c),document.addEventListener("touchstart",c),window.addEventListener("gb:openSearch",function(){d(),u(true)})}();';
  baseLayout = replaceOnce(baseLayout, baseBootstrap, baseDelegated, 'BaseLayout lazy Search owner');
  write('src/layouts/BaseLayout.astro', baseLayout);

  // 5) Strict-native app routes receive SiteUtils before Search; App surface retires keyboard arbitration.
  let appHead = read('src/components/search/AppSearchHead.astro');
  appHead = replaceOnce(
    appHead,
    '<link rel="stylesheet" href="/css/command-palette.css?v=c174cedb" />\n<script is:inline src="/js/search.js?v=78e5fd29" defer></script>',
    '<link rel="stylesheet" href="/css/command-palette.css?v=c174cedb" />\n<script is:inline src="/js/site-utils.js?v=30ed46cf" defer></script>\n<script is:inline src="/js/search.js?v=78e5fd29" defer></script>',
    'App Search shared runtime order',
  );
  write('src/components/search/AppSearchHead.astro', appHead);

  let appSurface = read('src/components/search/AppSearchSurface.astro');
  const appScriptStart = "<script is:inline>\n  (() => {\n    const trigger = document.querySelector('[data-app-search-trigger]');";
  const appScriptEnd = '</script>';
  const appStart = appSurface.indexOf(appScriptStart);
  const appEnd = appSurface.indexOf(appScriptEnd, appStart);
  assert.ok(appStart >= 0 && appEnd > appStart, 'AppSearchSurface keyboard script missing');
  appSurface = `${appSurface.slice(0, appStart)}${appSurface.slice(appEnd + appScriptEnd.length)}`.replace(/\n{3,}/g, '\n\n');
  assert.equal(appSurface.includes("window.addEventListener('keydown'"), false, 'App route-local keyboard owner survived');
  write('src/components/search/AppSearchSurface.astro', appSurface);

  // 6) Retire the repeated lazy keyboard parser from every native Astro owner.
  const astroOwners = retireCommonLazyKeyboardOwners(walk(p('src'), (file) => file.endsWith('.astro')));
  assert.ok(astroOwners.length >= 12, `too few Astro lazy owners retired: ${astroOwners.length}`);

  // 7) Rodosloviye lacked the shared dependency entirely.
  let rodosloviye = read('src/components/rodosloviye/RodosloviyeBody.astro');
  assert.equal(rodosloviye.includes('/js/site-utils.js'), false, 'Rodosloviye SiteUtils unexpectedly already present');
  rodosloviye = replaceOnce(
    rodosloviye,
    '  <script src="/js/site.js?v=8009e039" defer></script>',
    '  <script src="/js/site-utils.js?v=30ed46cf" defer></script>\n  <script src="/js/site.js?v=8009e039" defer></script>',
    'Rodosloviye SiteUtils dependency',
  );
  write('src/components/rodosloviye/RodosloviyeBody.astro', rodosloviye);

  // 8) Production committed HTML shadows/static routes must not retain a live raw owner.
  const productionHtml = collectProductionHtml();
  const htmlOwners = retireCommonLazyKeyboardOwners(productionHtml);
  assert.ok(htmlOwners.length >= 1, 'no production HTML lazy owners retired');

  // 9) App Search source contract now proves the class invariant, not a route-local implementation.
  let sourceContract = read('scripts/app-search-surface-source-contract.mjs');
  sourceContract = replaceOnce(
    sourceContract,
    "import fs from 'node:fs';\nimport crypto from 'node:crypto';",
    "import fs from 'node:fs';\nimport path from 'node:path';\nimport crypto from 'node:crypto';",
    'App source contract path import',
  );
  sourceContract = replaceOnce(
    sourceContract,
    "  search: read('js/search.js'),\n  home: read('src/components/home/HomePageChrome.astro'),",
    "  search: read('js/search.js'),\n  siteUtils: read('js/site-utils.js'),\n  baseLayout: read('src/layouts/BaseLayout.astro'),\n  home: read('src/components/home/HomePageChrome.astro'),\n  homeProgressive: read('src/components/home/HomeProgressiveEnhancementHead.astro'),\n  notFound: read('404.html'),\n  rodosloviye: read('src/components/rodosloviye/RodosloviyeBody.astro'),\n  auditPro: read('scripts/audit-pro.js'),",
    'App source contract shared owners',
  );
  sourceContract = replaceOnce(
    sourceContract,
    "check(files.head.includes(`/js/search.js?v=${searchHash}`), 'current search revision missing');\ncheck(files.head.includes('defer'), 'search bootstrap must remain deferred');",
    "check(files.head.includes(`/js/search.js?v=${searchHash}`), 'current search revision missing');\nconst siteUtilsHash = crypto.createHash('md5').update(files.siteUtils).digest('hex').slice(0, 8);\ncheck(files.head.includes(`/js/site-utils.js?v=${siteUtilsHash}`), 'current SiteUtils revision missing');\ncheck(files.head.indexOf('/js/site-utils.js') < files.head.indexOf('/js/search.js'), 'SiteUtils must load before Search');\ncheck(files.head.includes('defer'), 'search bootstrap must remain deferred');",
    'App source contract shared runtime hashes',
  );
  sourceContract = replaceOnce(
    sourceContract,
    "check(files.surface.includes(\"window.addEventListener('keydown'\"), 'route shortcut owner missing');\ncheck(files.surface.includes('event.stopImmediatePropagation()'), 'route shortcut arbitration missing');",
    "check(!files.surface.includes(\"window.addEventListener('keydown'\"), 'App route-local shortcut owner survived');\ncheck(!files.surface.includes('stopImmediatePropagation()'), 'App route-local shortcut arbitration survived');",
    'App source route owner retirement',
  );
  const sourceAnchor = "check(!files.search.includes('<span class=\"kb\">⌘K</span>'), 'Mac-only visible fallback survived');";
  const sourceExpansion = `${sourceAnchor}

for (const marker of [
  "String(event && event.key || '').toLowerCase() === 'k'",
  'modifierCount === 1',
  '!event.altKey',
  '!event.shiftKey',
  '!event.isComposing',
  'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]',
  "window.dispatchEvent(new CustomEvent('gb:openSearch'",
  "document.addEventListener('keydown', handleSearchShortcut, true)",
]) check(files.siteUtils.includes(marker), \`SiteUtils canonical shortcut marker missing: \${marker}\`);
check(!/\\b(?:ctrlKey|metaKey)\\b/.test(files.search), 'Search must not parse the global keyboard chord');
check(files.search.includes('window.addEventListener("gb:openSearch",function(){ne()})'), 'loaded Search gb:openSearch transport missing');
check(files.search.includes('window.addEventListener("gb:openSearch",function(){__gbLoadSearch(true)})'), 'bootstrap Search gb:openSearch transport missing');
check(!files.baseLayout.includes('ctrlKey') && !files.baseLayout.includes('metaKey'), 'BaseLayout raw shortcut parser survived');
check(files.baseLayout.includes('window.addEventListener("gb:openSearch"'), 'BaseLayout gb:openSearch loader missing');
check(!files.home.includes('const onShortcut'), 'Home route-local shortcut parser survived');
check(files.home.includes("window.addEventListener('gb:openSearch'"), 'Home gb:openSearch orchestration missing');
check(!files.homeProgressive.includes('stopImmediatePropagation'), 'Home progressive shortcut capture gate survived');
check(!files.notFound.includes('function key(e)') && files.notFound.includes('gb:openSearch'), '404 raw keyboard owner survived');
check(files.rodosloviye.includes('/js/site-utils.js') && files.rodosloviye.indexOf('/js/site-utils.js') < files.rodosloviye.indexOf('/js/site.js'), 'Rodosloviye shared runtime order missing');

const walkSource = (dir, predicate, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules', 'dist', 'reports', 'audit'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSource(full, predicate, out);
    else if (predicate(full)) out.push(full);
  }
  return out;
};
const hasRawSearchShortcut = (text) => {
  const keydown = /addEventListener\\s*\\(\\s*['"]keydown['"]/.test(text);
  const modifier = /\\b(?:ctrlKey|metaKey)\\b/.test(text);
  const keyK = /(?:String\\s*\\([^)]*\\.key[^)]*\\)\\.toLowerCase\\s*\\(\\)|\\.key)\\s*(?:===|==)\\s*['"]k['"]/i.test(text)
    || /['"]k['"]\\s*(?:===|==)\\s*(?:String\\s*\\([^)]*\\.key[^)]*\\)\\.toLowerCase\\s*\\(\\)|[^;\\n]{0,80}\\.key)/i.test(text)
    || /toLowerCase\\s*\\(\\)[\\s\\S]{0,80}['"]k['"]/i.test(text);
  return keydown && modifier && keyK;
};
const ownerCandidates = [
  ...walkSource('js', (file) => file.endsWith('.js')),
  ...walkSource('src', (file) => file.endsWith('.astro')),
  path.resolve('404.html'),
];
const rawOwners = ownerCandidates.filter((file) => hasRawSearchShortcut(fs.readFileSync(file, 'utf8')))
  .map((file) => path.relative(process.cwd(), file).replace(/\\\\/g, '/')).sort();
check(JSON.stringify(rawOwners) === JSON.stringify(['js/site-utils.js']), \`sole raw Search keyboard owner drifted: \${rawOwners.join(', ')}\`);
check(files.auditPro.includes('raw Ctrl/Meta+K owner'), 'audit-pro G112 semantic owner guard missing');`;
  sourceContract = replaceOnce(sourceContract, sourceAnchor, sourceExpansion, 'App source semantic Search owner checks');

  const workflowMarker = "  'js/search.js',\n  'scripts/app-search-surface-source-contract.mjs',";
  sourceContract = replaceOnce(
    sourceContract,
    workflowMarker,
    "  'js/search.js',\n  'js/site-utils.js',\n  '404.html',\n  'scripts/audit-pro.js',\n  'scripts/home-browser-contract.mjs',\n  'src/layouts/BaseLayout.astro',\n  'src/components/home/',\n  'src/components/rodosloviye/RodosloviyeBody.astro',\n  'scripts/app-search-surface-source-contract.mjs',",
    'App source workflow ownership markers',
  );
  write('scripts/app-search-surface-source-contract.mjs', sourceContract);

  // 10) App browser matrix rejects modified/editable/composing chords and proves open is idempotent.
  let appBrowser = read('scripts/app-search-surface-browser-contract.mjs');
  const shortcutAnchor = "    await page.keyboard.press(platformScenario.shortcutPress);\n    await page.waitForFunction(() => document.querySelector('.cp-backdrop')?.classList.contains('is-open'));";
  const shortcutChecks = `    const assertShortcutClosed = async (label, press) => {
      await press();
      await page.waitForTimeout(80);
      assert.equal(await page.locator('.cp-backdrop.is-open').count(), 0, \`\${id}: \${label} must not open Search\`);
    };
    const invalidAlt = browserName === 'webkit' ? 'Alt+Meta+K' : 'Alt+Control+K';
    const invalidShift = browserName === 'webkit' ? 'Shift+Meta+K' : 'Shift+Control+K';
    await assertShortcutClosed('Alt-modified shortcut', () => page.keyboard.press(invalidAlt));
    await assertShortcutClosed('Shift-modified shortcut', () => page.keyboard.press(invalidShift));
    await assertShortcutClosed('Ctrl+Meta+K', () => page.keyboard.press('Control+Meta+K'));
    await page.evaluate(() => {
      const editor = document.createElement('div');
      editor.id = 'app-search-contract-textbox';
      editor.tabIndex = 0;
      editor.setAttribute('role', 'textbox');
      editor.textContent = 'editor';
      document.body.appendChild(editor);
      editor.focus();
    });
    await assertShortcutClosed('role=textbox shortcut', () => page.keyboard.press(platformScenario.shortcutPress));
    await page.evaluate(() => {
      const editor = document.createElement('div');
      editor.id = 'app-search-contract-contenteditable';
      editor.contentEditable = 'true';
      editor.tabIndex = 0;
      editor.textContent = 'editable';
      document.body.appendChild(editor);
      editor.focus();
    });
    await assertShortcutClosed('contenteditable shortcut', () => page.keyboard.press(platformScenario.shortcutPress));
    await page.locator('#gbSearchBtn').focus();
    await assertShortcutClosed('IME composing shortcut', () => page.evaluate(({ isMac }) => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: !isMac,
        metaKey: isMac,
        bubbles: true,
        cancelable: true,
      });
      try { Object.defineProperty(event, 'isComposing', { configurable: true, value: true }); } catch {}
      document.activeElement?.dispatchEvent(event);
    }, { isMac: browserName === 'webkit' }));

    await page.keyboard.press(platformScenario.shortcutPress);
    await page.waitForFunction(() => document.querySelector('.cp-backdrop')?.classList.contains('is-open'));
    await page.keyboard.press(platformScenario.shortcutPress);
    await page.waitForTimeout(80);
    assert.equal(await page.locator('.cp-backdrop.is-open').count(), 1, \`\${id}: canonical shortcut must be idempotent-open while Search is already open\`);`;
  appBrowser = replaceOnce(appBrowser, shortcutAnchor, shortcutChecks, 'App browser shortcut matrix');
  write('scripts/app-search-surface-browser-contract.mjs', appBrowser);

  // 11) Home uses its existing invalid matrix and adds the route-specific menu transition witness.
  let homeBrowser = read('scripts/home-browser-contract.mjs');
  const homeCanonical = `    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await page.keyboard.press('Control+K');
    const searchInput = page.locator('.cp-input');
    await searchInput.waitFor({ state: 'visible' });`;
  const homeTransition = `    await menuButton.click();
    await waitForMenuState(page, true);
    await page.keyboard.press('Control+K');
    await waitForMenuState(page, false);
    await assertScrollUnlocked(page, 'canonical Search shortcut from mobile menu');
    const searchInput = page.locator('.cp-input');
    await searchInput.waitFor({ state: 'visible' });`;
  homeBrowser = replaceOnce(homeBrowser, homeCanonical, homeTransition, 'Home mobile menu Search transition');
  const homeOneDialog = "    assert.equal(await page.locator('.cp-backdrop').count(), 1, 'search initialized more than once');";
  homeBrowser = replaceOnce(
    homeBrowser,
    homeOneDialog,
    `${homeOneDialog}\n    await page.keyboard.press('Control+K');\n    await page.waitForTimeout(80);\n    assert.equal(await page.locator('.cp-backdrop.is-open').count(), 1, 'canonical Ctrl+K toggled an already-open Search closed');`,
    'Home idempotent Search open',
  );
  write('scripts/home-browser-contract.mjs', homeBrowser);

  // 12) audit-pro G112 guards the semantic class invariant across production source.
  let auditPro = read('scripts/audit-pro.js');
  const g112Start = '// G112. Search keyboard shortcuts contract.';
  const g113Start = '// G113. GBS series-world integrity contract.';
  const g112 = `// G112. Search keyboard ownership contract.
//   One raw global Ctrl/Meta+K boundary lives in js/site-utils.js.
//   Route/Search consumers receive gb:openSearch and must never re-parse the chord.
(function searchShortcutContractGuard() {
  const hasRawSearchShortcut = (source) => {
    const keydown = /addEventListener\\s*\\(\\s*['"]keydown['"]/.test(source);
    const modifier = /\\b(?:ctrlKey|metaKey)\\b/.test(source);
    const keyK = /(?:String\\s*\\([^)]*\\.key[^)]*\\)\\.toLowerCase\\s*\\(\\)|\\.key)\\s*(?:===|==)\\s*['"]k['"]/i.test(source)
      || /['"]k['"]\\s*(?:===|==)\\s*(?:String\\s*\\([^)]*\\.key[^)]*\\)\\.toLowerCase\\s*\\(\\)|[^;\\n]{0,80}\\.key)/i.test(source)
      || /toLowerCase\\s*\\(\\)[\\s\\S]{0,80}['"]k['"]/i.test(source);
    return keydown && modifier && keyK;
  };
  const candidates = [...new Set([
    ...allFiles.filter((file) => rel(file).startsWith('js/') && file.endsWith('.js')),
    ...allFiles.filter((file) => rel(file).startsWith('src/') && file.endsWith('.astro')),
    ...htmlPages,
    path.join(ROOT, '404.html'),
  ].filter((file) => fs.existsSync(file)))];
  const rawOwners = candidates.filter((file) => hasRawSearchShortcut(fs.readFileSync(file, 'utf8'))).map(rel).sort();

  if (rawOwners.length !== 1 || rawOwners[0] !== 'js/site-utils.js') {
    R.err(\`Search shortcuts: raw Ctrl/Meta+K owner set must be exactly js/site-utils.js; got: \${rawOwners.join(', ') || 'none'}\`);
    return;
  }

  const siteUtils = read('js/site-utils.js');
  const required = [
    "String(event && event.key || '').toLowerCase() === 'k'",
    'modifierCount === 1',
    '!event.altKey',
    '!event.shiftKey',
    '!event.isComposing',
    'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]',
    "window.dispatchEvent(new CustomEvent('gb:openSearch'",
    "document.addEventListener('keydown', handleSearchShortcut, true)",
  ];
  const missing = required.filter((marker) => !siteUtils.includes(marker));
  if (missing.length) {
    R.err(\`Search shortcuts: SiteUtils canonical boundary missing semantics: \${missing.join(' | ')}\`);
    return;
  }

  const searchJs = read('js/search.js');
  if (/\\b(?:ctrlKey|metaKey)\\b/.test(searchJs)) {
    R.err('Search shortcuts: js/search.js must consume gb:openSearch and never parse Ctrl/Meta');
    return;
  }
  if (!searchJs.includes('window.addEventListener("gb:openSearch"')) {
    R.err('Search shortcuts: js/search.js lost the gb:openSearch transport');
    return;
  }

  R.ok('Search shortcuts: sole SiteUtils Ctrl/Meta+K owner; invalid/editable/IME chords fail closed');
})();

`;
  auditPro = replaceRange(auditPro, g112Start, g113Start, g112, 'audit-pro G112');
  write('scripts/audit-pro.js', auditPro);

  // 13) Existing Search Modal workflow follows every permanent owner touched by the migration.
  let workflow = read('.github/workflows/search-modal-contract.yml');
  const triggerAnchor = "      - 'js/search.js'\n      - 'css/command-palette.css'";
  const triggerExpanded = "      - 'js/search.js'\n      - 'js/site-utils.js'\n      - '404.html'\n      - 'scripts/audit-pro.js'\n      - 'scripts/home-browser-contract.mjs'\n      - 'src/layouts/BaseLayout.astro'\n      - 'src/components/home/**'\n      - 'src/components/about/AboutPageChrome.astro'\n      - 'src/components/articles/ArticlesPageFooter.astro'\n      - 'src/components/article-pilots/**'\n      - 'src/components/baptisty-rossii/**'\n      - 'src/components/biografii/BiografiiPageFooter.astro'\n      - 'src/components/nagornaya/**'\n      - 'src/components/pastor-series/PastorSeriesPageChrome.astro'\n      - 'src/components/rodosloviye/RodosloviyeBody.astro'\n      - 'css/command-palette.css'";
  assert.equal(count(workflow, triggerAnchor), 2, 'Search workflow PR/push path anchors drifted');
  workflow = workflow.split(triggerAnchor).join(triggerExpanded);
  workflow = replaceOnce(
    workflow,
    '          node scripts/app-search-surface-source-contract.mjs\n          npm run astro:check',
    '          node scripts/app-search-surface-source-contract.mjs\n          node scripts/audit-pro.js\n          npm run astro:check',
    'Search workflow semantic audit',
  );
  write('.github/workflows/search-modal-contract.yml', workflow);

  // Final source-level proof before cache-bust projections.
  assertSoleRawOwner(productionHtml);
  assert.equal(read('src/components/home/HomeProgressiveEnhancementHead.astro').includes('stopImmediatePropagation'), false, 'Home progressive capture workaround survived');
  assert.equal(read('src/components/search/AppSearchSurface.astro').includes('stopImmediatePropagation'), false, 'App shortcut arbitration survived');

  console.log(`Retired Astro lazy keyboard owners: ${astroOwners.length}`);
  astroOwners.forEach((item) => console.log(`  - ${item.file} (${item.owners})`));
  console.log(`Retired production HTML lazy keyboard owners: ${htmlOwners.length}`);
  htmlOwners.forEach((item) => console.log(`  - ${item.file} (${item.owners})`));
  console.log('Search keyboard ownership migration applied.');
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
  const normalizedText = decodeEntities(
    raw.replace(/<!--[^]*?-->/g,' ')
      .replace(/<script\b[^>]*>[^]*?<\/script>/gi,' ')
      .replace(/<style\b[^>]*>[^]*?<\/style>/gi,' ')
      .replace(/<[^>]+>/g,' ')
  ).replace(/\s+/g,' ').trim();
  const words = normalizedText.match(/[0-9A-Za-zА-Яа-яЁё]+(?:[-'’][0-9A-Za-zА-Яа-яЁё]+)*/g) || [];
  return {
    gitBlobSha1: gitBlobSha1(bytes),
    byteSha256: sha256(bytes),
    normalizedTextSha256: sha256(Buffer.from(normalizedText)),
    bytes: bytes.length,
    wordCount: words.length,
    h1Count: (raw.match(/<h1\b/gi) || []).length,
    h2Count: (raw.match(/<h2\b/gi) || []).length,
  };
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
