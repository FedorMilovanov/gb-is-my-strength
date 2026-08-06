#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
BASE = "8a51db9a2df74fa615a3eaca698144302e47e332"


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 exact occurrence, found {count}")
    return text.replace(old, new, 1)


def sub_once(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return updated


helper = r'''(() => {
  'use strict';

  const LABEL = 'Поиск по всему сайту';
  const SELECTOR = [
    '#gbSearchBtn',
    '[data-gbs2-search]',
    '[data-fc-action="search"]',
    '[data-action="open-search"]',
    '.gb-nav-search-icon',
    '.gb-search-btn',
    '[data-search-shortcut]',
  ].join(',');

  const platformValue = () => String(
    navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || ''
  );

  const modifier = () => /Mac|iPhone|iPad|iPod/i.test(platformValue()) ? '⌘' : 'Ctrl';
  const shortcut = () => `${modifier()}+K`;

  const collect = (root) => {
    const nodes = [];
    if (root instanceof Element && root.matches(SELECTOR)) nodes.push(root);
    const scope = root?.querySelectorAll ? root : document;
    scope.querySelectorAll(SELECTOR).forEach((node) => nodes.push(node));
    return [...new Set(nodes)];
  };

  const sync = (root = document) => {
    const key = shortcut();
    const mod = modifier();
    const nodes = collect(root);

    nodes.forEach((control) => {
      control.setAttribute('data-search-shortcut', '');
      control.setAttribute('data-search-shortcut-label', LABEL);
      control.setAttribute('aria-label', `${LABEL} (${key})`);
      control.setAttribute('title', `${LABEL} ${key}`);
      control.setAttribute('data-search-label-ready', key);

      control.querySelectorAll('[data-search-shortcut-value], .kb').forEach((hint) => {
        hint.textContent = key;
      });
      control.querySelectorAll('[data-search-shortcut-modifier]').forEach((hint) => {
        hint.textContent = mod;
      });
    });

    return nodes.length;
  };

  const api = Object.freeze({
    version: 1,
    label: LABEL,
    selector: SELECTOR,
    platformValue,
    modifier,
    shortcut,
    sync,
  });

  window.GBSearchTriggerLabels = api;
  const run = () => api.sync(document);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
  window.addEventListener('pageshow', run);
})();
'''
write("js/search-trigger-labels.js", helper)

assets = read("scripts/cache-bust-assets.js")
assets = replace_once(
    assets,
    "  'js/search.js',\n",
    "  'js/search-trigger-labels.js',\n  'js/search.js',\n",
    "cache-bust asset registration",
)
write("scripts/cache-bust-assets.js", assets)

reader = read("src/components/reader-platform/ReaderPreferencesHead.astro")
reader = replace_once(
    reader,
    "const readerStateSrc = assetUrl('js/reader-state.js');\n",
    "const readerStateSrc = assetUrl('js/reader-state.js');\nconst searchTriggerLabelsSrc = assetUrl('js/search-trigger-labels.js');\n",
    "ReaderPreferencesHead source declaration",
)
reader = replace_once(
    reader,
    "<script is:inline defer src={readerStateSrc}></script>\n",
    "<script is:inline defer src={readerStateSrc}></script>\n<script is:inline defer src={searchTriggerLabelsSrc} data-gb-search-trigger-labels></script>\n",
    "ReaderPreferencesHead helper script",
)
write("src/components/reader-platform/ReaderPreferencesHead.astro", reader)

home = read("src/components/home/HomePageChrome.astro")
home = replace_once(home, 'aria-label="Поиск (Ctrl+K)"', 'aria-label="Поиск по всему сайту"', "Home initial aria label")
home = replace_once(home, 'title="Поиск Ctrl+K"', 'title="Поиск по всему сайту"', "Home initial title")
home = replace_once(home, 'data-search-shortcut-label="Поиск"', 'data-search-shortcut-label="Поиск по всему сайту"', "Home shortcut base label")
home = sub_once(
    home,
    r'''<script is:inline>\n  \(\(\) => \{\n    const platform = navigator\.userAgentData\?\.platform \|\| navigator\.platform \|\| navigator\.userAgent \|\| '';\n    const modifier = /Mac\|iPhone\|iPad\|iPod/i\.test\(platform\) \? '⌘' : 'Ctrl';\n    const shortcut = `\$\{modifier\}\+K`;\n\n    document\.querySelectorAll\('\[data-search-shortcut\]'\)\.forEach\(\(control\) => \{\n      const label = control\.getAttribute\('data-search-shortcut-label'\) \|\| 'Поиск';\n      control\.setAttribute\('aria-label', `\$\{label\} \(\$\{shortcut\}\)`\);\n      control\.setAttribute\('title', `\$\{label\} \$\{shortcut\}`\);\n    \}\);\n    document\.querySelectorAll\('\[data-search-shortcut-modifier\]'\)\.forEach\(\(hint\) => \{\n      hint\.textContent = modifier;\n    \}\);\n  \}\)\(\);\n</script>\n''',
    "",
    "remove Home duplicate platform helper",
)
write("src/components/home/HomePageChrome.astro", home)

app = read("src/components/search/AppSearchSurface.astro")
app = replace_once(app, 'aria-label="Поиск по всему сайту (Ctrl+K)"', 'aria-label="Поиск по всему сайту"', "App initial aria label")
app = replace_once(app, 'title="Поиск по всему сайту Ctrl+K"', 'title="Поиск по всему сайту"', "App initial title")
app = sub_once(
    app,
    r'''    const platform = navigator\.userAgentData\?\.platform \|\| navigator\.platform \|\| navigator\.userAgent \|\| '';\n    const modifier = /Mac\|iPhone\|iPad\|iPod/i\.test\(platform\) \? '⌘' : 'Ctrl';\n    const label = `Поиск по всему сайту \(\$\{modifier\}\+K\)`;\n    trigger\.setAttribute\('aria-label', label\);\n    trigger\.setAttribute\('title', `Поиск по всему сайту \$\{modifier\}\+K`\);\n\n''',
    "",
    "remove App duplicate platform helper",
)
write("src/components/search/AppSearchSurface.astro", app)

search = read("js/search.js")
prefix = '!function(){"use strict";if(!window.__gbSearchBootRequested){var __gbSearchSrc=(document.currentScript&&document.currentScript.src)||"/js/search.js";'
replacement = '!function(){"use strict";function __gbSyncSearchTriggerLabels(e){var t=window.GBSearchTriggerLabels;t&&"function"==typeof t.sync&&t.sync(e||document)}function __gbEnsureSearchTriggerLabels(){if(window.GBSearchTriggerLabels)return void __gbSyncSearchTriggerLabels(document);if(document.querySelector("script[data-gb-search-trigger-labels]"))return;var e=document.createElement("script");e.defer=true,e.src="/js/search-trigger-labels.js",e.setAttribute("data-gb-search-trigger-labels",""),e.onload=function(){__gbSyncSearchTriggerLabels(document)},document.head.appendChild(e)}__gbEnsureSearchTriggerLabels();if(!window.__gbSearchBootRequested){var __gbSearchSrc=(document.currentScript&&document.currentScript.src)||"/js/search.js";'
search = replace_once(search, prefix, replacement, "search helper bootstrap")
search = search.replace('Поиск (⌘K)', 'Поиск по всему сайту')
search = search.replace('Поиск ⌘K', 'Поиск по всему сайту')
search = replace_once(
    search,
    '<span>Поиск</span><span class="kb">⌘K</span>',
    '<span>Поиск по сайту</span><span class="kb" data-search-shortcut-value>Ctrl/⌘ K</span>',
    "search visible shortcut fallback",
)
pattern = re.compile(r'([a-z])\.id="gbSearchBtn",\1\.setAttribute\("aria-label","Поиск по всему сайту"\),\1\.setAttribute\("title","Поиск по всему сайту"\)')
search, trigger_count = pattern.subn(
    lambda match: f'{match.group(1)}.id="gbSearchBtn",{match.group(1)}.setAttribute("data-search-shortcut",""),{match.group(1)}.setAttribute("data-search-shortcut-label","Поиск по всему сайту"),{match.group(1)}.setAttribute("aria-label","Поиск по всему сайту"),{match.group(1)}.setAttribute("title","Поиск по всему сайту")',
    search,
)
if trigger_count != 5:
    raise SystemExit(f"search fallback trigger count: expected 5, found {trigger_count}")
search = replace_once(
    search,
    'function Te(){document.querySelectorAll("#gbSearchBtn").forEach(function(e){e.addEventListener("click",ne)})}',
    'function Te(){__gbSyncSearchTriggerLabels(document),document.querySelectorAll("#gbSearchBtn").forEach(function(e){e.addEventListener("click",ne)})}',
    "search post-injection label sync",
)
for forbidden in ('Поиск (⌘K)', 'Поиск ⌘K', '<span class="kb">⌘K</span>'):
    if forbidden in search:
        raise SystemExit(f"search Mac-only label survived: {forbidden}")
write("js/search.js", search)

source_contract = r'''#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const files = {
  helper: read('js/search-trigger-labels.js'),
  search: read('js/search.js'),
  home: read('src/components/home/HomePageChrome.astro'),
  app: read('src/components/search/AppSearchSurface.astro'),
  readerHead: read('src/components/reader-platform/ReaderPreferencesHead.astro'),
  assets: read('scripts/cache-bust-assets.js'),
  workflow: read('.github/workflows/search-modal-contract.yml'),
};

let passed = 0;
const check = (condition, message) => { assert.ok(condition, message); passed += 1; };

for (const marker of [
  "const LABEL = 'Поиск по всему сайту'",
  "navigator.userAgentData?.platform || navigator.platform || navigator.userAgent",
  "? '⌘' : 'Ctrl'",
  "control.setAttribute('aria-label', `${LABEL} (${key})`)",
  "control.setAttribute('title', `${LABEL} ${key}`)",
  "control.setAttribute('data-search-label-ready', key)",
  "[data-action=\"open-search\"]",
  "[data-fc-action=\"search\"]",
  "window.GBSearchTriggerLabels = api",
]) check(files.helper.includes(marker), `helper marker missing: ${marker}`);

check(files.search.includes('function __gbEnsureSearchTriggerLabels()'), 'search helper loader missing');
check(files.search.includes('__gbSyncSearchTriggerLabels(document)'), 'search injected-trigger sync missing');
check(files.search.includes('data-search-shortcut-label'), 'search fallback label metadata missing');
check(!files.search.includes('Поиск (⌘K)'), 'Mac-only aria label survived');
check(!files.search.includes('Поиск ⌘K'), 'Mac-only title survived');
check(!files.search.includes('<span class="kb">⌘K</span>'), 'Mac-only visible hint survived');

check(files.home.includes('data-search-shortcut-label="Поиск по всему сайту"'), 'Home unified base label missing');
check(files.home.includes('aria-label="Поиск по всему сайту"'), 'Home neutral initial label missing');
check(!files.home.includes("const platform = navigator.userAgentData?.platform"), 'Home duplicate platform helper survived');
check(files.app.includes('data-search-shortcut-label="Поиск по всему сайту"'), 'App unified base label missing');
check(files.app.includes('aria-label="Поиск по всему сайту"'), 'App neutral initial label missing');
check(!files.app.includes("const platform = navigator.userAgentData?.platform"), 'App duplicate platform helper survived');

check(files.readerHead.includes("assetUrl('js/search-trigger-labels.js')"), 'shared head helper asset missing');
check(files.readerHead.includes('data-gb-search-trigger-labels'), 'shared head helper ownership marker missing');
check(files.assets.includes("'js/search-trigger-labels.js'"), 'cache-bust asset registration missing');

for (const marker of [
  'js/search-trigger-labels.js',
  'scripts/search-trigger-label-source-contract.mjs',
  'scripts/search-trigger-label-browser-contract.mjs',
  'node scripts/search-trigger-label-source-contract.mjs',
  'node scripts/search-trigger-label-browser-contract.mjs',
]) check(files.workflow.includes(marker), `workflow marker missing: ${marker}`);

check(!files.workflow.includes('name: Search Trigger Labels'), 'no new permanent workflow may be introduced');
console.log(`SEARCH TRIGGER LABEL SOURCE CONTRACT: ${passed}/${passed} PASS`);
'''
write("scripts/search-trigger-label-source-contract.mjs", source_contract)

browser_contract = r'''#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { chromium, webkit } from 'playwright';

const options = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, ...value] = argument.replace(/^--/, '').split('=');
  return [key, value.join('=') || true];
}));
const dist = path.resolve(String(options.dist || 'dist'));
const reportDir = path.resolve(String(options.report || 'reports/search-modal-contract/trigger-labels'));
const selector = '#gbSearchBtn,[data-gbs2-search],[data-fc-action="search"],[data-action="open-search"],.gb-nav-search-icon,.gb-search-btn,[data-search-shortcut]';
const routes = [
  { family: 'home', path: '/' },
  { family: 'article', path: '/articles/krajne-li-isporcheno-serdce/' },
  { family: 'series', path: '/hermenevtika/' },
  { family: 'strict-native-app', path: '/karty/avraam/' },
];
const scenarios = [
  { name: 'chromium-windows', browserType: chromium, platform: 'Win32', uaPlatform: 'Windows', shortcut: 'Ctrl+K' },
  { name: 'webkit-macos', browserType: webkit, platform: 'MacIntel', uaPlatform: 'macOS', shortcut: '⌘+K' },
];

function mime(file) {
  return ({
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.woff2': 'font/woff2',
  })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function staticServer(root) {
  return http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
    let file = path.join(root, pathname.replace(/^\/+/, ''));
    if (pathname.endsWith('/')) file = path.join(file, 'index.html');
    if (!path.extname(file) && !fs.existsSync(file)) file = path.join(file, 'index.html');
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': mime(file), 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  });
}

function ignorableConsoleError(text) {
  return /Failed to load resource|ERR_|mc\.yandex|Content Security Policy|Refused to (connect|load|frame)|favicon/i.test(text);
}

async function runCase(scenario, route, port) {
  const browser = await scenario.browserType.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  await context.addInitScript(({ platform, uaPlatform }) => {
    try { Object.defineProperty(navigator, 'platform', { configurable: true, get: () => platform }); } catch {}
    try {
      if (navigator.userAgentData) {
        Object.defineProperty(navigator.userAgentData, 'platform', { configurable: true, get: () => uaPlatform });
      } else {
        Object.defineProperty(navigator, 'userAgentData', { configurable: true, get: () => ({ platform: uaPlatform }) });
      }
    } catch {}
  }, { platform: scenario.platform, uaPlatform: scenario.uaPlatform });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (!ignorableConsoleError(text)) consoleErrors.push(text);
  });
  const id = `${scenario.name}-${route.family}`;

  try {
    await page.goto(`http://127.0.0.1:${port}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(({ selector, shortcut }) => {
      const controls = [...document.querySelectorAll(selector)];
      return controls.length > 0 && controls.every((control) => control.getAttribute('data-search-label-ready') === shortcut);
    }, { selector, shortcut: scenario.shortcut }, { timeout: 30_000 });

    const labels = await page.evaluate(({ selector, shortcut }) => [...document.querySelectorAll(selector)].map((control) => ({
      tag: control.tagName,
      id: control.id,
      aria: control.getAttribute('aria-label'),
      title: control.getAttribute('title'),
      ready: control.getAttribute('data-search-label-ready'),
      hints: [...control.querySelectorAll('[data-search-shortcut-value], .kb')].map((hint) => hint.textContent?.trim()),
      expectedAria: `Поиск по всему сайту (${shortcut})`,
      expectedTitle: `Поиск по всему сайту ${shortcut}`,
    })), { selector, shortcut: scenario.shortcut });

    assert.ok(labels.length > 0, `${id}: trigger inventory`);
    for (const label of labels) {
      assert.equal(label.aria, label.expectedAria, `${id}: aria ${label.id || label.tag}`);
      assert.equal(label.title, label.expectedTitle, `${id}: title ${label.id || label.tag}`);
      assert.equal(label.ready, scenario.shortcut, `${id}: ready marker`);
      label.hints.forEach((hint) => assert.equal(hint, scenario.shortcut, `${id}: visible shortcut hint`));
    }

    const trigger = page.locator('#gbSearchBtn').first();
    await trigger.waitFor({ state: 'visible', timeout: 15_000 });
    await trigger.click();
    await page.waitForFunction(() => document.querySelector('.cp-backdrop')?.classList.contains('is-open'), null, { timeout: 30_000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.cp-backdrop')?.classList.contains('is-open'));

    assert.deepEqual(pageErrors, [], `${id}: page errors`);
    assert.deepEqual(consoleErrors, [], `${id}: console errors`);
    return { id, scenario: scenario.name, family: route.family, path: route.path, labels, status: 'PASS' };
  } catch (error) {
    fs.mkdirSync(reportDir, { recursive: true });
    await page.screenshot({ path: path.join(reportDir, `${id}.png`), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

assert.ok(fs.existsSync(dist), `dist missing: ${dist}`);
fs.mkdirSync(reportDir, { recursive: true });
const server = staticServer(dist);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const results = [];
try {
  for (const scenario of scenarios) {
    for (const route of routes) results.push(await runCase(scenario, route, port));
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify({ schemaVersion: 1, results }, null, 2));
console.log(`SEARCH TRIGGER LABEL BROWSER CONTRACT: ${results.length}/${results.length} PASS`);
'''
write("scripts/search-trigger-label-browser-contract.mjs", browser_contract)

workflow = read(".github/workflows/search-modal-contract.yml")
workflow, count = re.subn(
    r"      - 'js/search\.js'\n",
    "      - 'js/search.js'\n      - 'js/search-trigger-labels.js'\n",
    workflow,
)
if count != 2:
    raise SystemExit(f"workflow js path insertion count: expected 2, found {count}")
workflow, count = re.subn(
    r"      - 'scripts/app-search-surface-browser-contract\.mjs'\n",
    "      - 'scripts/app-search-surface-browser-contract.mjs'\n      - 'scripts/search-trigger-label-source-contract.mjs'\n      - 'scripts/search-trigger-label-browser-contract.mjs'\n      - 'scripts/cache-bust-assets.js'\n      - 'src/components/reader-platform/ReaderPreferencesHead.astro'\n      - 'src/components/home/HomePageChrome.astro'\n",
    workflow,
)
if count != 2:
    raise SystemExit(f"workflow contract path insertion count: expected 2, found {count}")
workflow = replace_once(
    workflow,
    "          node --check js/search.js\n          node --check scripts/search-modal-browser-contract.mjs\n",
    "          node --check js/search.js\n          node --check js/search-trigger-labels.js\n          node --check scripts/search-modal-browser-contract.mjs\n",
    "workflow helper syntax",
)
workflow = replace_once(
    workflow,
    "          node --check scripts/app-search-surface-browser-contract.mjs\n          node scripts/app-search-surface-source-contract.mjs\n          npm run astro:check\n",
    "          node --check scripts/app-search-surface-browser-contract.mjs\n          node --check scripts/search-trigger-label-source-contract.mjs\n          node --check scripts/search-trigger-label-browser-contract.mjs\n          node scripts/app-search-surface-source-contract.mjs\n          node scripts/search-trigger-label-source-contract.mjs\n          node scripts/cache-bust.js\n          npm run astro:check\n",
    "workflow source label contract",
)
workflow = replace_once(
    workflow,
    "          node scripts/app-search-surface-browser-contract.mjs --dist=dist --report=reports/search-modal-contract/app-surfaces\n",
    "          node scripts/app-search-surface-browser-contract.mjs --dist=dist --report=reports/search-modal-contract/app-surfaces\n          node scripts/search-trigger-label-browser-contract.mjs --dist=dist --report=reports/search-modal-contract/trigger-labels\n",
    "workflow label browser contract",
)
write(".github/workflows/search-modal-contract.yml", workflow)

# Transport must not survive the final tree.
(ROOT / ".github/workflows/tmp-search-trigger-labels-p3-01.yml").unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)

print("SEARCH TRIGGER LABEL WRITER: PASS")
print(f"base={BASE}")
