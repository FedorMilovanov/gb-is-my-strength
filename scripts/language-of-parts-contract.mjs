#!/usr/bin/env node
/**
 * Adversarial contract test for SYS-PUBLICATION-LANGUAGE-OF-PARTS-CONTRACT.
 *
 * Verifies:
 *   1. All built HTML pages in `dist/` (excluding `pagefind/`) have 0 untagged
 *      Greek (`grc`/`el`) or Hebrew (`he`/`iw`/`hbo`) text nodes.
 *   2. `projectLanguageOfPartsHtml` is idempotent across all `dist/` HTML files.
 *   3. Negative fixtures with untagged single-word and multi-word Greek/Hebrew
 *      runs are detected by `auditLanguageOfPartsHtml` and deterministically
 *      repaired by `projectLanguageOfPartsHtml` without altering visible text.
 *   4. `installArticleStrategicMap()` renders Greek/Hebrew terms inside popover
 *      bodies with `<span lang="grc">` / `<span lang="he" dir="rtl">`.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  auditLanguageOfPartsHtml,
  projectLanguageOfPartsHtml,
} = require('./lib/language-of-parts-hygiene.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

assert.equal(fs.existsSync(DIST), true, 'dist/ must exist before running language-of-parts contract');

function walkHtml(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'pagefind') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

// 1. Full dist/ corpus check + idempotence check.
const htmlFiles = walkHtml(DIST);
assert.equal(htmlFiles.length >= 110, true, `expected >= 110 dist HTML files, found ${htmlFiles.length}`);

let totalUntagged = 0;
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const issues = auditLanguageOfPartsHtml(html);
  if (issues.length > 0) {
    totalUntagged += issues.length;
    assert.fail(`${path.relative(DIST, file)}: found untagged foreign script run: ${JSON.stringify(issues[0])}`);
  }
  const secondPass = projectLanguageOfPartsHtml(html, path.relative(DIST, file));
  assert.equal(secondPass.changed, false, `${path.relative(DIST, file)}: projection must be idempotent`);
}
assert.equal(totalUntagged, 0);

// 2. Negative & positive AST fixtures.
{
  const fixture =
    '<!doctype html><html lang="ru"><body>' +
    '<p>Греческое выражение (τὰ περὶ ἑαυτοῦ) и древнееврейское слово שָׁמִיר требуют явного lang.</p>' +
    '<p>Уже размечено: <span lang="grc">λόγος</span> и <span lang="he" dir="rtl">לֵב</span>.</p>' +
    '</body></html>';
  const before = auditLanguageOfPartsHtml(fixture);
  assert.equal(before.length, 1, 'expected 1 untagged text node containing both Greek and Hebrew runs');
  assert.equal(before[0].missingGreek, true);
  assert.equal(before[0].missingHebrew, true);

  const projected = projectLanguageOfPartsHtml(fixture, 'fixture.html');
  assert.equal(projected.changed, true);
  assert.equal(projected.wrappedRuns, 2);
  assert.equal(projected.remainingUntagged, 0);
  assert.match(projected.html, /<span lang="grc">τὰ περὶ ἑαυτοῦ<\/span>/);
  assert.match(projected.html, /<span lang="he" dir="rtl">שָׁמִיר<\/span>/);
  assert.equal(auditLanguageOfPartsHtml(projected.html).length, 0);
}

// 3. Strategic map runtime DOM tagging check (no innerHTML).
{
  class MiniElement {
    constructor(tagName) {
      this.tagName = String(tagName).toUpperCase();
      this.id = '';
      this.className = '';
      this.dataset = {};
      this.style = {};
      this.hidden = false;
      this.lang = '';
      this.dir = '';
      this.type = '';
      this.attributes = new Map();
      this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      this.children = [];
      this._text = '';
      this.listeners = new Map();
    }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name === 'id') this.id = String(value);
      if (name === 'lang') this.lang = String(value);
      if (name === 'dir') this.dir = String(value);
    }
    getAttribute(name) {
      return this.attributes.has(name) ? this.attributes.get(name) : null;
    }
    hasAttribute(name) {
      return this.attributes.has(name);
    }
    removeAttribute(name) {
      this.attributes.delete(name);
    }
    appendChild(child) {
      this.children.push(child);
      return child;
    }
    append(...nodes) {
      for (const n of nodes) this.appendChild(n);
    }
    replaceChildren(...nodes) {
      this.children = [...nodes];
    }
    get textContent() {
      if (this.tagName === '#TEXT') return this._text;
      if (this.children.length === 0) return this._text;
      return this.children.map((c) => c.textContent).join('');
    }
    set textContent(v) {
      this._text = String(v);
      this.children = [];
    }
    querySelector(sel) {
      if (sel === '.gb-strategic-map-popover__body') {
        return this.children.find((c) => c.className === 'gb-strategic-map-popover__body') || null;
      }
      if (sel === '.gb-strategic-map-popover__close') {
        return this.children.find((c) => c.className.includes('gb-strategic-map-popover__close')) || null;
      }
      return null;
    }
    getBoundingClientRect() {
      return { left: 100, top: 200, right: 130, bottom: 230, width: 30, height: 30 };
    }
    addEventListener(type, fn) {
      const list = this.listeners.get(type) || [];
      list.push(fn);
      this.listeners.set(type, list);
    }
    contains(other) {
      if (other === this) return true;
      return this.children.some((c) => c.contains?.(other));
    }
    focus() {}
  }

  const trigger = new MiniElement('span');
  trigger.className = 'fn-marker map-trigger';
  trigger.setAttribute('data-tip', '11');

  const dataScript = new MiniElement('script');
  dataScript.id = 'strategicMapData';
  dataScript.textContent = JSON.stringify({
    '11': {
      blocks: [
        {
          type: 'greek',
          title: 'Термин ὑπόκρισις',
          text: 'Лицемерие (ὑπόκρισις) и камень שָׁמִיר в контексте.',
        },
      ],
    },
  });

  const body = new MiniElement('body');
  const docEl = new MiniElement('html');
  const byId = new Map([['strategicMapData', dataScript]]);
  const origDoc = globalThis.document;
  const origWin = globalThis.window;
  const origRaf = globalThis.requestAnimationFrame;

  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener() {},
    requestAnimationFrame: (cb) => cb(),
  };
  globalThis.requestAnimationFrame = globalThis.window.requestAnimationFrame;
  globalThis.document = {
    documentElement: docEl,
    body,
    activeElement: trigger,
    getElementById: (id) => byId.get(id) || body.children.find((c) => c.id === id) || null,
    querySelectorAll: (sel) => (sel === '.map-trigger[data-tip]' ? [trigger] : []),
    createElement: (tag) => new MiniElement(tag),
    createTextNode: (txt) => {
      const node = new MiniElement('#text');
      node._text = String(txt);
      return node;
    },
    addEventListener() {},
  };

  try {
    const { installArticleStrategicMap } = await import('../src/runtime/article-strategic-map.js');
    const res = installArticleStrategicMap();
    assert.equal(res.enabled, true);
    const clickHandlers = trigger.listeners.get('click') || [];
    assert.equal(clickHandlers.length, 1);
    clickHandlers[0]({ preventDefault() {}, stopPropagation() {} });

    const popover = body.children.find((c) => c.id === 'gb-strategic-map-popover');
    assert.ok(popover, 'popover should be created');
    const popBody = popover.querySelector('.gb-strategic-map-popover__body');
    const section = popBody.children[0];
    const paragraph = section.children[1];
    const taggedSpans = paragraph.children.filter((c) => c.tagName === 'SPAN');
    assert.equal(taggedSpans.length, 2, 'expected 2 language-tagged spans (grc + he)');
    assert.equal(taggedSpans[0].lang, 'grc');
    assert.equal(taggedSpans[0].textContent, 'ὑπόκρισις');
    assert.equal(taggedSpans[1].lang, 'he');
    assert.equal(taggedSpans[1].dir, 'rtl');
    assert.equal(taggedSpans[1].textContent, 'שָׁמִיר');
  } finally {
    globalThis.document = origDoc;
    globalThis.window = origWin;
    globalThis.requestAnimationFrame = origRaf;
  }
}

console.log(`✅ Language-of-parts contract: PASS (${htmlFiles.length} dist routes, 0 untagged Greek/Hebrew runs, idempotent + runtime verified)`);
