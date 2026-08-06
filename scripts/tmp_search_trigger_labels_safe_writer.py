#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
BASE = "3d907194d81eee1227a4fc9ad6f037773d19a1ec"

if "--write" not in sys.argv:
    raise SystemExit("explicit --write is required")


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


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


search = read("js/search.js")
prefix = '!function(){"use strict";if(!window.__gbSearchBootRequested){var __gbSearchSrc=(document.currentScript&&document.currentScript.src)||"/js/search.js";'
owner = '!function(){"use strict";function __gbSearchPlatformValue(){return String(navigator.userAgentData&&navigator.userAgentData.platform||navigator.platform||navigator.userAgent||"")}function __gbSearchShortcut(){return/Mac|iPhone|iPad|iPod/i.test(__gbSearchPlatformValue())?"⌘+K":"Ctrl+K"}function __gbSyncSearchTriggerLabels(e){var t=__gbSearchShortcut(),n=e&&e.querySelectorAll?e:document;return n.querySelectorAll("[data-search-shortcut]").forEach(function(e){var n=e.getAttribute("data-search-shortcut-label")||"Поиск по всему сайту";e.setAttribute("aria-label",n+" ("+t+")"),e.setAttribute("title",n+" "+t),e.setAttribute("data-search-label-ready",t),e.querySelectorAll("[data-search-shortcut-value],.kb").forEach(function(e){e.textContent=t})}),t}function __gbInitSearchTriggerLabels(){__gbSyncSearchTriggerLabels(document)}"loading"===document.readyState?document.addEventListener("DOMContentLoaded",__gbInitSearchTriggerLabels,{once:!0}):__gbInitSearchTriggerLabels(),window.addEventListener("pageshow",__gbInitSearchTriggerLabels);if(!window.__gbSearchBootRequested){var __gbSearchSrc=(document.currentScript&&document.currentScript.src)||"/js/search.js";'
search = replace_once(search, prefix, owner, "shared Search label owner")

bootstrap = 'window.GBSearch={open:function(){__gbLoadSearch(true)},close:function(){},__ready:false};'
bootstrap_new = 'window.GBSearch={open:function(){__gbLoadSearch(true)},close:function(){},syncTriggerLabels:__gbSyncSearchTriggerLabels,shortcut:__gbSearchShortcut,__ready:false};'
search = replace_once(search, bootstrap, bootstrap_new, "bootstrap API")

search = search.replace('Поиск (⌘K)', 'Поиск по всему сайту')
search = search.replace('Поиск ⌘K', 'Поиск по всему сайту')
search = replace_once(
    search,
    '<span>Поиск</span><span class="kb">⌘K</span>',
    '<span>Поиск по сайту</span><span class="kb" data-search-shortcut-value>Ctrl/⌘+K</span>',
    "visible fallback shortcut",
)

pattern = re.compile(
    r'([a-z])\.id="gbSearchBtn",\1\.setAttribute\("aria-label","Поиск по всему сайту"\),\1\.setAttribute\("title","Поиск по всему сайту"\)'
)
search, trigger_count = pattern.subn(
    lambda match: (
        f'{match.group(1)}.id="gbSearchBtn",'
        f'{match.group(1)}.setAttribute("data-search-shortcut",""),'
        f'{match.group(1)}.setAttribute("data-search-shortcut-label","Поиск по всему сайту"),'
        f'{match.group(1)}.setAttribute("aria-label","Поиск по всему сайту"),'
        f'{match.group(1)}.setAttribute("title","Поиск по всему сайту")'
    ),
    search,
)
if trigger_count != 5:
    raise SystemExit(f"fallback trigger metadata count: expected 5, found {trigger_count}")

hcp = 'var e=document.getElementById("hCpBtnNav");if(e&&!document.getElementById("gbSearchBtn"))return e.id="gbSearchBtn",void Te();'
hcp_new = 'var e=document.getElementById("hCpBtnNav");if(e&&!document.getElementById("gbSearchBtn"))return e.id="gbSearchBtn",e.setAttribute("data-search-shortcut",""),e.setAttribute("data-search-shortcut-label","Поиск по всему сайту"),void Te();'
search = replace_once(search, hcp, hcp_new, "existing Home command-palette trigger metadata")

te = 'function Te(){document.querySelectorAll("#gbSearchBtn").forEach(function(e){e.addEventListener("click",ne)})}'
te_new = 'function Te(){__gbSyncSearchTriggerLabels(document),document.querySelectorAll("#gbSearchBtn").forEach(function(e){e.addEventListener("click",ne)})}'
search = replace_once(search, te, te_new, "post-injection synchronization")

final_api = 'window.GBSearch={open:ne,close:re,__ready:true};'
final_api_new = 'window.GBSearch={open:ne,close:re,syncTriggerLabels:__gbSyncSearchTriggerLabels,shortcut:__gbSearchShortcut,__ready:true};'
search = replace_once(search, final_api, final_api_new, "ready API")

for forbidden in ('Поиск (⌘K)', 'Поиск ⌘K', '<span class="kb">⌘K</span>'):
    if forbidden in search:
        raise SystemExit(f"Mac-only label survived in search.js: {forbidden}")
write("js/search.js", search)

home = read("src/components/home/HomePageChrome.astro")
home = replace_once(
    home,
    'aria-label="Поиск (Ctrl+K)"',
    'aria-label="Поиск по всему сайту"',
    "Home neutral aria label",
)
home = replace_once(
    home,
    'title="Поиск Ctrl+K"',
    'title="Поиск по всему сайту"',
    "Home neutral title",
)
home = replace_once(
    home,
    'data-search-shortcut-label="Поиск"',
    'data-search-shortcut-label="Поиск по всему сайту"',
    "Home shared label metadata",
)
home = sub_once(
    home,
    r"""<script is:inline>\n  \(\(\) => \{\n    const platform = navigator\.userAgentData\?\.platform \|\| navigator\.platform \|\| navigator\.userAgent \|\| '';\n    const modifier = /Mac\|iPhone\|iPad\|iPod/i\.test\(platform\) \? '⌘' : 'Ctrl';\n    const shortcut = `\$\{modifier\}\+K`;\n\n    document\.querySelectorAll\('\[data-search-shortcut\]'\)\.forEach\(\(control\) => \{\n      const label = control\.getAttribute\('data-search-shortcut-label'\) \|\| 'Поиск';\n      control\.setAttribute\('aria-label', `\$\{label\} \(\$\{shortcut\}\)`\);\n      control\.setAttribute\('title', `\$\{label\} \$\{shortcut\}`\);\n    \}\);\n    document\.querySelectorAll\('\[data-search-shortcut-modifier\]'\)\.forEach\(\(hint\) => \{\n      hint\.textContent = modifier;\n    \}\);\n  \}\)\(\);\n</script>\n""",
    "",
    "remove Home duplicate platform helper",
)
write("src/components/home/HomePageChrome.astro", home)

app = read("src/components/search/AppSearchSurface.astro")
app = replace_once(
    app,
    'aria-label="Поиск по всему сайту (Ctrl+K)"',
    'aria-label="Поиск по всему сайту"',
    "App neutral aria label",
)
app = replace_once(
    app,
    'title="Поиск по всему сайту Ctrl+K"',
    'title="Поиск по всему сайту"',
    "App neutral title",
)
app = sub_once(
    app,
    r"""    const platform = navigator\.userAgentData\?\.platform \|\| navigator\.platform \|\| navigator\.userAgent \|\| '';\n    const modifier = /Mac\|iPhone\|iPad\|iPod/i\.test\(platform\) \? '⌘' : 'Ctrl';\n    const label = `Поиск по всему сайту \(\$\{modifier\}\+K\)`;\n    trigger\.setAttribute\('aria-label', label\);\n    trigger\.setAttribute\('title', `Поиск по всему сайту \$\{modifier\}\+K`\);\n\n""",
    "",
    "remove App duplicate platform helper",
)
write("src/components/search/AppSearchSurface.astro", app)

source = read("scripts/app-search-surface-source-contract.mjs")
source = replace_once(
    source,
    "import fs from 'node:fs';\n",
    "import fs from 'node:fs';\nimport crypto from 'node:crypto';\n",
    "source contract crypto import",
)
source = replace_once(
    source,
    "  surface: read('src/components/search/AppSearchSurface.astro'),\n",
    "  surface: read('src/components/search/AppSearchSurface.astro'),\n"
    "  search: read('js/search.js'),\n"
    "  home: read('src/components/home/HomePageChrome.astro'),\n"
    "  browser: read('scripts/app-search-surface-browser-contract.mjs'),\n",
    "source contract owned files",
)
source = replace_once(
    source,
    "check(files.head.includes('/js/search.js?v=ea540ce9'), 'current search revision missing');\n",
    "const searchHash = crypto.createHash('md5').update(files.search).digest('hex').slice(0, 8);\n"
    "check(files.head.includes(`/js/search.js?v=${searchHash}`), 'current search revision missing');\n",
    "dynamic search revision contract",
)
surface_marker = "check(files.surface.includes('event.stopImmediatePropagation()'), 'route shortcut arbitration missing');\n"
surface_checks = """check(files.surface.includes('event.stopImmediatePropagation()'), 'route shortcut arbitration missing');
check(files.surface.includes('data-search-shortcut-label=\"Поиск по всему сайту\"'), 'App shared label metadata missing');
check(files.surface.includes('aria-label=\"Поиск по всему сайту\"'), 'App neutral initial aria label missing');
check(files.surface.includes('title=\"Поиск по всему сайту\"'), 'App neutral initial title missing');
check(!files.surface.includes(\"const platform = navigator.userAgentData?.platform\"), 'App duplicate platform helper survived');

for (const marker of [
  'function __gbSearchPlatformValue()',
  'function __gbSearchShortcut()',
  'function __gbSyncSearchTriggerLabels(e)',
  'data-search-label-ready',
  'syncTriggerLabels:__gbSyncSearchTriggerLabels',
  'shortcut:__gbSearchShortcut',
]) check(files.search.includes(marker), `shared Search label owner marker missing: ${marker}`);
check(!files.search.includes('Поиск (⌘K)'), 'Mac-only fallback aria label survived');
check(!files.search.includes('Поиск ⌘K'), 'Mac-only fallback title survived');
check(!files.search.includes('<span class=\"kb\">⌘K</span>'), 'Mac-only visible fallback survived');

check(files.home.includes('data-search-shortcut-label=\"Поиск по всему сайту\"'), 'Home shared label metadata missing');
check(files.home.includes('aria-label=\"Поиск по всему сайту\"'), 'Home neutral initial aria label missing');
check(files.home.includes('title=\"Поиск по всему сайту\"'), 'Home neutral initial title missing');
check(!files.home.includes(\"const platform = navigator.userAgentData?.platform\"), 'Home duplicate platform helper survived');

for (const marker of [
  \"platform: 'Win32'\",
  \"platform: 'MacIntel'\",
  \"expectedShortcut: 'Ctrl+K'\",
  \"expectedShortcut: '⌘+K'\",
  \"shortcutPress: 'Control+K'\",
  \"shortcutPress: 'Meta+K'\",
  \"data-search-label-ready\",
]) check(files.browser.includes(marker), `browser platform-label contract missing: ${marker}`);
"""
source = replace_once(source, surface_marker, surface_checks, "source contract shared owner assertions")
workflow_marker = "  'src/components/search/AppSearchSurface.astro',\n"
source = replace_once(
    source,
    workflow_marker,
    workflow_marker + "  'src/components/home/HomePageChrome.astro',\n",
    "workflow Home path source contract",
)
write("scripts/app-search-surface-source-contract.mjs", source)

browser = read("scripts/app-search-surface-browser-contract.mjs")
browser = replace_once(
    browser,
    "  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });\n",
    """  const platformScenario = browserName === 'webkit'
    ? { platform: 'MacIntel', uaPlatform: 'macOS', expectedShortcut: '⌘+K', shortcutPress: 'Meta+K' }
    : { platform: 'Win32', uaPlatform: 'Windows', expectedShortcut: 'Ctrl+K', shortcutPress: 'Control+K' };
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  await page.addInitScript(({ platform, uaPlatform }) => {
    Object.defineProperty(navigator, 'platform', { configurable: true, get: () => platform });
    Object.defineProperty(navigator, 'userAgentData', {
      configurable: true,
      get: () => ({ platform: uaPlatform }),
    });
  }, platformScenario);
""",
    "browser platform scenarios",
)
browser = replace_once(
    browser,
    "    await trigger.waitFor({ state: 'visible', timeout: 30_000 });\n",
    """    await trigger.waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForFunction(({ expectedShortcut }) => {
      const node = document.getElementById('gbSearchBtn');
      return node?.getAttribute('data-search-label-ready') === expectedShortcut
        && node?.getAttribute('aria-label') === `Поиск по всему сайту (${expectedShortcut})`
        && node?.getAttribute('title') === `Поиск по всему сайту ${expectedShortcut}`;
    }, platformScenario, { timeout: 30_000 });
""",
    "browser exact label readiness",
)
browser = replace_once(
    browser,
    "        label: triggerNode?.getAttribute('aria-label') || '',\n",
    "        label: triggerNode?.getAttribute('aria-label') || '',\n"
    "        title: triggerNode?.getAttribute('title') || '',\n"
    "        readiness: triggerNode?.getAttribute('data-search-label-ready') || '',\n",
    "browser label geometry fields",
)
browser = replace_once(
    browser,
    "    assert.match(geometry.label, /Поиск по всему сайту/);\n",
    """    assert.equal(geometry.label, `Поиск по всему сайту (${platformScenario.expectedShortcut})`, `${id}: exact platform aria label`);
    assert.equal(geometry.title, `Поиск по всему сайту ${platformScenario.expectedShortcut}`, `${id}: exact platform title`);
    assert.equal(geometry.readiness, platformScenario.expectedShortcut, `${id}: label readiness`);
""",
    "browser exact label assertions",
)
browser = replace_once(
    browser,
    "    await page.keyboard.press('Control+K');\n",
    "    await page.keyboard.press(platformScenario.shortcutPress);\n",
    "platform shortcut press",
)
browser = replace_once(
    browser,
    "    return { id, browser: browserName, viewport: viewport.name, route: route.path, geometry, modalGeometry, pageErrors, consoleErrors, status: 'PASS' };\n",
    "    return { id, browser: browserName, viewport: viewport.name, route: route.path, expectedShortcut: platformScenario.expectedShortcut, geometry, modalGeometry, pageErrors, consoleErrors, status: 'PASS' };\n",
    "browser report platform evidence",
)
write("scripts/app-search-surface-browser-contract.mjs", browser)

workflow = read(".github/workflows/search-modal-contract.yml")
needle = "      - 'src/components/search/AppSearchSurface.astro'\n"
if workflow.count(needle) != 2:
    raise SystemExit(f"Search workflow App surface path count: expected 2, found {workflow.count(needle)}")
workflow = workflow.replace(
    needle,
    needle + "      - 'src/components/home/HomePageChrome.astro'\n",
)
write(".github/workflows/search-modal-contract.yml", workflow)

subprocess.run(["node", "scripts/cache-bust.js", "--write"], cwd=ROOT, check=True)
