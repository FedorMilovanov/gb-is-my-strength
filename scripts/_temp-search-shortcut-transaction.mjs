#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const SEARCH = path.join(ROOT, 'js/search.js');
const HOME_HEAD = path.join(ROOT, 'src/components/home/HomeProgressiveEnhancementHead.astro');
const HOME_BROWSER = path.join(ROOT, 'scripts/home-browser-contract.mjs');
const LEDGER_MANIFEST = path.join(ROOT, 'data/legacy-reference-ledger/manifest.json');

const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, value) => fs.writeFileSync(file, value, 'utf8');
const count = (source, token) => source.split(token).length - 1;

function applySourceRepair() {
  let search = read(SEARCH);
  const bootstrapPredicate = '(e.metaKey||e.ctrlKey)&&String(e.key).toLowerCase()==="k"';
  const runtimePredicate = '(e.metaKey||e.ctrlKey)&&"k"===String(e.key).toLowerCase()';
  assert.equal(count(search, 'function __gbSearchCanonicalShortcut'), 0, 'canonical shortcut helper already exists');
  assert.equal(count(search, bootstrapPredicate), 1, 'bootstrap shortcut predicate drifted');
  assert.equal(count(search, runtimePredicate), 1, 'loaded shortcut predicate drifted');

  const helperAnchor = 'function __gbSyncSearchTriggerLabels(e)';
  assert.equal(count(search, helperAnchor), 1, 'search helper insertion anchor drifted');
  const helper = 'function __gbSearchEditableTarget(e){var t=e&&e.target;return!!(t&&1===t.nodeType&&t.closest&&t.closest(\'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]\'))}function __gbSearchCanonicalShortcut(e){return String(e&&e.key||"").toLowerCase()==="k"&&Number(!!e.ctrlKey)+Number(!!e.metaKey)===1&&!e.altKey&&!e.shiftKey&&!e.isComposing&&!__gbSearchEditableTarget(e)}';
  search = search.replace(helperAnchor, helper + helperAnchor);
  search = search.replace(bootstrapPredicate, '__gbSearchCanonicalShortcut(e)');
  search = search.replace(runtimePredicate, '__gbSearchCanonicalShortcut(e)');
  assert.equal(count(search, '__gbSearchCanonicalShortcut(e)&&'), 2, 'both shortcut owners must delegate to one predicate');
  assert.equal(count(search, bootstrapPredicate), 0, 'broad bootstrap shortcut survived');
  assert.equal(count(search, runtimePredicate), 0, 'broad loaded shortcut survived');
  write(SEARCH, search);

  let home = read(HOME_HEAD);
  const marker = '// search.js owns the canonical Ctrl/Command+K action.';
  assert.equal(count(home, marker), 1, 'Home shortcut workaround marker drifted');
  const markerAt = home.indexOf(marker);
  const blockStart = home.lastIndexOf('<script is:inline>', markerAt);
  const blockEndStart = home.indexOf('</script>', markerAt);
  assert.ok(blockStart >= 0 && blockEndStart > markerAt, 'Home shortcut workaround script boundary missing');
  home = `${home.slice(0, blockStart)}${home.slice(blockEndStart + '</script>'.length)}`.replace(/\n{3,}/g, '\n\n');
  assert.equal(home.includes('stopImmediatePropagation'), false, 'Home route-local shortcut gate survived');
  write(HOME_HEAD, home);

  let browser = read(HOME_BROWSER);
  const rootAnchor = "const ROOT = path.resolve(process.cwd());\n";
  assert.equal(count(browser, rootAnchor), 1, 'Home browser source-contract anchor drifted');
  const sourceContract = `const SEARCH_SOURCE = fs.readFileSync(path.join(ROOT, 'js/search.js'), 'utf8');\nconst HOME_PROGRESSIVE_SOURCE = fs.readFileSync(path.join(ROOT, 'src/components/home/HomeProgressiveEnhancementHead.astro'), 'utf8');\nassert.equal((SEARCH_SOURCE.match(/function __gbSearchCanonicalShortcut\\(/g) || []).length, 1, 'Search must expose one canonical shortcut predicate');\nassert.equal((SEARCH_SOURCE.match(/__gbSearchCanonicalShortcut\\(e\\)&&/g) || []).length, 2, 'bootstrap and loaded Search owners must share the canonical predicate');\nassert.equal(SEARCH_SOURCE.includes('(e.metaKey||e.ctrlKey)&&String(e.key).toLowerCase()===\\"k\\"'), false, 'broad bootstrap shortcut owner returned');\nassert.equal(SEARCH_SOURCE.includes('(e.metaKey||e.ctrlKey)&&\\"k\\"===String(e.key).toLowerCase()'), false, 'broad loaded shortcut owner returned');\nassert.equal(HOME_PROGRESSIVE_SOURCE.includes('stopImmediatePropagation'), false, 'Home must not shadow shared Search shortcut ownership');\n`;
  browser = browser.replace(rootAnchor, rootAnchor + sourceContract);

  const testStart = "    await page.keyboard.press('Alt+Control+K');\n";
  const testEnd = '    const hebrew = page.locator';
  const start = browser.indexOf(testStart);
  const end = browser.indexOf(testEnd, start);
  assert.ok(start >= 0 && end > start, 'Home browser Search test block drifted');
  const replacement = `    const assertInvalidSearchShortcut = async (label, press) => {\n      await press();\n      await page.waitForTimeout(120);\n      await assertSearchClosed(page, label);\n    };\n    const dispatchComposingCtrlK = () => page.evaluate(() => {\n      const event = new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true, cancelable: true });\n      Object.defineProperty(event, 'isComposing', { value: true });\n      document.activeElement?.dispatchEvent(event);\n    });\n    const focusContractTextbox = (id, contentEditable = false) => page.evaluate(({ targetId, editable }) => {\n      let target = document.getElementById(targetId);\n      if (!target) {\n        target = document.createElement('div');\n        target.id = targetId;\n        target.tabIndex = 0;\n        target.setAttribute('role', 'textbox');\n        if (editable) target.contentEditable = 'true';\n        target.textContent = targetId;\n        document.body.appendChild(target);\n      }\n      target.focus();\n    }, { targetId: id, editable: contentEditable });\n\n    await assertInvalidSearchShortcut('bootstrap Alt+Ctrl+K', () => page.keyboard.press('Alt+Control+K'));\n    await assertInvalidSearchShortcut('bootstrap Shift+Ctrl+K', () => page.keyboard.press('Shift+Control+K'));\n    await assertInvalidSearchShortcut('bootstrap Ctrl+Meta+K', () => page.keyboard.press('Control+Meta+K'));\n    await focusContractTextbox('home-contract-editable', true);\n    await assertInvalidSearchShortcut('bootstrap editable Ctrl+K', () => page.keyboard.press('Control+K'));\n    await page.locator('body').click({ position: { x: 1, y: 1 } });\n    await assertInvalidSearchShortcut('bootstrap composing Ctrl+K', dispatchComposingCtrlK);\n\n    await page.keyboard.press('Control+K');\n    const searchInput = page.locator('.cp-input');\n    await searchInput.waitFor({ state: 'visible' });\n    await page.waitForFunction(() => {\n      const input = document.querySelector('.cp-input');\n      return input !== null && input === document.activeElement && window.GBSearch?.__ready === true;\n    });\n    assert.equal(await searchInput.evaluate((element) => element === document.activeElement), true, 'canonical Ctrl+K did not focus search input');\n    assert.equal(await page.locator('.cp-backdrop').count(), 1, 'search initialized more than once');\n    await page.keyboard.press('Escape');\n    await page.waitForFunction(() => {\n      const overlay = document.querySelector('.cp-backdrop');\n      return !overlay || getComputedStyle(overlay).display === 'none' || !overlay.classList.contains('open');\n    });\n\n    await page.locator('body').click({ position: { x: 1, y: 1 } });\n    await assertInvalidSearchShortcut('loaded Alt+Ctrl+K', () => page.keyboard.press('Alt+Control+K'));\n    await assertInvalidSearchShortcut('loaded Shift+Ctrl+K', () => page.keyboard.press('Shift+Control+K'));\n    await assertInvalidSearchShortcut('loaded Ctrl+Meta+K', () => page.keyboard.press('Control+Meta+K'));\n    await focusContractTextbox('home-contract-role-textbox', false);\n    await assertInvalidSearchShortcut('loaded role=textbox Ctrl+K', () => page.keyboard.press('Control+K'));\n    await page.locator('body').click({ position: { x: 1, y: 1 } });\n    await assertInvalidSearchShortcut('loaded composing Ctrl+K', dispatchComposingCtrlK);\n\n    await page.keyboard.press('Control+K');\n    await searchInput.waitFor({ state: 'visible' });\n    assert.equal(await page.locator('.cp-backdrop').count(), 1, 'loaded canonical Ctrl+K duplicated the search overlay');\n    await page.keyboard.press('Escape');\n    await page.waitForFunction(() => {\n      const overlay = document.querySelector('.cp-backdrop');\n      return !overlay || getComputedStyle(overlay).display === 'none' || !overlay.classList.contains('open');\n    });\n\n`;
  browser = `${browser.slice(0, start)}${replacement}${browser.slice(end)}`;
  write(HOME_BROWSER, browser);
  console.log('Search exact-shortcut source repair applied.');
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
  const manifest = JSON.parse(read(LEDGER_MANIFEST));
  manifest.auditedAtCommit = sourceSha;
  for (const shardRel of manifest.referenceShards || []) {
    const shardPath = path.join(ROOT, shardRel);
    const shard = JSON.parse(read(shardPath));
    for (const entry of shard.entries || []) {
      const bytes = fs.readFileSync(path.join(ROOT, entry.legacyPath));
      const next = htmlMetrics(bytes.toString('utf8'), bytes);
      assert.equal(next.normalizedTextSha256, entry.normalizedTextSha256, `${entry.legacyPath}: normalized text changed during asset projection`);
      assert.equal(next.wordCount, entry.wordCount, `${entry.legacyPath}: word count changed during asset projection`);
      assert.equal(next.h1Count, entry.h1Count, `${entry.legacyPath}: h1 count changed during asset projection`);
      assert.equal(next.h2Count, entry.h2Count, `${entry.legacyPath}: h2 count changed during asset projection`);
      Object.assign(entry, next, { sourceCommit: sourceSha });
    }
    write(shardPath, `${JSON.stringify(shard, null, 2)}\n`);
  }
  write(LEDGER_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Legacy reference ledger refreshed for ${sourceSha}.`);
}

const [mode, value] = process.argv.slice(2);
if (mode === '--apply') applySourceRepair();
else if (mode === '--refresh-ledger') refreshLedger(String(value || '').trim().toLowerCase());
else throw new Error('Usage: node scripts/_temp-search-shortcut-transaction.mjs --apply | --refresh-ledger <sha>');
