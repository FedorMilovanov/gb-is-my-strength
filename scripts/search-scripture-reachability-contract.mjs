#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_ROOT = path.join(ROOT, 'dist');
const SEARCH_JS_PATH = path.join(ROOT, 'js', 'search.js');
const INDEX_PATH = path.join(ROOT, 'data', 'scripture-search-index.json');

function createElement(tag, ownerDocument) {
  const listeners = new Map();
  const attributes = new Map();
  const classes = new Set();
  let innerHTMLValue = '';
  let textContentValue = '';
  const children = [];

  const classList = {
    add: (...names) => names.forEach((n) => n && classes.add(n)),
    remove: (...names) => names.forEach((n) => classes.delete(n)),
    toggle: (name, force) => {
      const next = force === undefined ? !classes.has(name) : Boolean(force);
      if (next) classes.add(name);
      else classes.delete(name);
      return next;
    },
    contains: (name) => classes.has(name),
  };

  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    ownerDocument,
    parentNode: null,
    children,
    style: { display: '', cssText: '', setProperty() {} },
    dataset: {},
    value: '',
    isConnected: true,
    classList,
    get className() {
      return [...classes].join(' ');
    },
    set className(val) {
      classes.clear();
      String(val || '').split(/\s+/u).filter(Boolean).forEach((c) => classes.add(c));
    },
    get innerHTML() {
      return innerHTMLValue;
    },
    set innerHTML(val) {
      innerHTMLValue = String(val || '');
      textContentValue = innerHTMLValue.replace(/<[^>]+>/gu, '');
      children.length = 0;
      ownerDocument.__syncHtmlChildren(el, innerHTMLValue);
    },
    get textContent() {
      return textContentValue;
    },
    set textContent(val) {
      textContentValue = String(val ?? '');
      innerHTMLValue = textContentValue;
      children.length = 0;
    },
    setAttribute(name, value) {
      const str = String(value);
      attributes.set(name, str);
      if (name === 'id') el.id = str;
      if (name === 'class') el.className = str;
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/gu, (_, ch) => ch.toUpperCase());
        el.dataset[key] = str;
      }
    },
    getAttribute(name) {
      if (name === 'id' && el.id) return el.id;
      if (name === 'class') return el.className;
      return attributes.has(name) ? attributes.get(name) : null;
    },
    removeAttribute(name) {
      attributes.delete(name);
      if (name === 'id') delete el.id;
    },
    appendChild(child) {
      child.parentNode = el;
      children.push(child);
      return child;
    },
    insertBefore(child, ref) {
      child.parentNode = el;
      const idx = children.indexOf(ref);
      if (idx >= 0) children.splice(idx, 0, child);
      else children.push(child);
      return child;
    },
    removeChild(child) {
      const idx = children.indexOf(child);
      if (idx >= 0) children.splice(idx, 1);
      child.parentNode = null;
      return child;
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatchEvent(evt) {
      const e = {
        preventDefault() {},
        stopPropagation() {},
        target: el,
        ...evt,
      };
      for (const fn of listeners.get(e.type) || []) fn(e);
    },
    focus() {
      ownerDocument.activeElement = el;
    },
    select() {},
    scrollIntoView() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 40 }),
    getClientRects: () => [{ left: 0, top: 0, width: 320, height: 40 }],
    contains: (other) => other === el || children.some((c) => c.contains && c.contains(other)),
    closest: () => null,
    querySelector(sel) {
      return el.querySelectorAll(sel)[0] || null;
    },
    querySelectorAll(sel) {
      const out = [];
      const visit = (node) => {
        for (const child of node.children || []) {
          if (matchesSelector(child, sel)) out.push(child);
          visit(child);
        }
      };
      visit(el);
      return out;
    },
  };
  return el;
}

function matchesSelector(el, selector) {
  return String(selector)
    .split(',')
    .map((s) => s.trim())
    .some((sel) => {
      if (sel.startsWith('#')) return el.id === sel.slice(1);
      if (sel === '.cp-item.is-active') return el.classList.contains('cp-item') && el.classList.contains('is-active');
      if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
      if (sel === '[data-action="clear-history"]') return el.getAttribute('data-action') === 'clear-history';
      if (sel === '[data-search-shortcut]') return el.getAttribute('data-search-shortcut') !== null;
      return false;
    });
}

function parseTopLevelTags(html, ownerDocument, parent) {
  // Lightweight parser for search.js generated palette/list/preview markup so event wiring & assertions inspect real nodes.
  const stack = [parent];
  const tagRe = /<\/?([a-z0-9-]+)([^>]*)>/giu;
  const voidTags = new Set(['img', 'input', 'br', 'hr', 'line', 'circle', 'path', 'polyline', 'polygon', 'rect']);
  let lastIdx = 0;
  let match;
  while ((match = tagRe.exec(html)) !== null) {
    const textChunk = html.slice(lastIdx, match.index);
    if (textChunk && stack.length > 1) {
      const top = stack[stack.length - 1];
      top._rawText = (top._rawText || '') + textChunk;
    }
    lastIdx = tagRe.lastIndex;
    const full = match[0];
    const tag = match[1].toLowerCase();
    const attrPart = match[2] || '';
    if (full.startsWith('</')) {
      if (stack.length > 1) {
        const closed = stack.pop();
        if (closed._rawText && closed.children.length === 0) {
          closed.textContent = closed._rawText;
        }
      }
      continue;
    }
    const child = createElement(tag, ownerDocument);
    const attrRe = /([a-zA-Z0-9_:-]+)(?:="([^"]*)")?/gu;
    let am;
    while ((am = attrRe.exec(attrPart)) !== null) {
      child.setAttribute(am[1], am[2] ?? '');
    }
    stack[stack.length - 1].appendChild(child);
    if (!voidTags.has(tag) && !full.endsWith('/>')) {
      stack.push(child);
    }
  }
}

function bootSearchVm({ indexPayload, historyRaw = null, throwOnSetItem = false } = {}) {
  const storage = new Map();
  if (historyRaw !== null) storage.set('gb-cp-history', historyRaw);

  let doc;
  doc = {
    readyState: 'complete',
    activeElement: null,
    __syncHtmlChildren(parent, html) {
      parseTopLevelTags(html, doc, parent);
    },
    createElement: (tag) => createElement(tag, doc),
    getElementById(id) {
      return doc.body.querySelector(`#${id}`) || doc.head.querySelector(`#${id}`) || null;
    },
    querySelector(sel) {
      return doc.body.querySelector(sel) || doc.head.querySelector(sel) || null;
    },
    querySelectorAll(sel) {
      return [...doc.head.querySelectorAll(sel), ...doc.body.querySelectorAll(sel)];
    },
    addEventListener() {},
    contains: () => true,
  };
  doc.documentElement = createElement('html', doc);
  doc.head = createElement('head', doc);
  doc.body = createElement('body', doc);
  const trigger = createElement('button', doc);
  trigger.setAttribute('id', 'gbSearchBtn');
  trigger.setAttribute('data-search-shortcut', '');
  doc.body.appendChild(trigger);
  doc.activeElement = trigger;

  const locationState = { pathname: '/', href: 'https://gospod-bog.ru/' };
  const win = {
    __gbSearchBootRequested: true,
    __pagefindFailed__: true,
    location: locationState,
    navigator: { platform: 'Linux x86_64', userAgent: 'NodeContract' },
    document: doc,
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => {
        if (throwOnSetItem) throw new Error('QuotaExceededError');
        storage.set(k, String(v));
      },
      removeItem: (k) => storage.delete(k),
    },
    fetch: async (url) => {
      if (String(url).includes('scripture-search-index.json')) {
        return { ok: true, json: async () => indexPayload };
      }
      if (String(url).includes('search-manifest.json')) {
        return { ok: true, json: async () => ({ items: [] }) };
      }
      return { ok: false, json: async () => null };
    },
    requestAnimationFrame: (fn) => fn(),
    cancelAnimationFrame() {},
    setTimeout: (fn) => {
      fn();
      return 1;
    },
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    addEventListener() {},
    console,
  };
  win.window = win;

  const code = fs.readFileSync(SEARCH_JS_PATH, 'utf8');
  vm.runInNewContext(code, win, { filename: 'js/search.js' });
  return { win, doc, locationState, storage };
}

async function flushMicrotasks() {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}

function verifyAllIndexedAnchorsInDist(indexData, distRoot) {
  const htmlCache = new Map();
  const missing = [];
  let checkedAnchored = 0;

  for (const ref of indexData.references || []) {
    for (const occ of ref.occurrences || []) {
      if (!occ.anchor) continue;
      checkedAnchored += 1;
      const relHtml = path.join(distRoot, String(occ.url || '').replace(/^\//u, ''), 'index.html');
      if (!htmlCache.has(relHtml)) {
        htmlCache.set(relHtml, fs.existsSync(relHtml) ? fs.readFileSync(relHtml, 'utf8') : null);
      }
      const html = htmlCache.get(relHtml);
      if (!html) {
        missing.push(`${ref.label}: missing route HTML for ${occ.url}#${occ.anchor}`);
        continue;
      }
      const escaped = occ.anchor.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      const idRe = new RegExp(`\\bid=["']${escaped}["']`, 'u');
      if (!idRe.test(html)) {
        missing.push(`${ref.label}: missing id="${occ.anchor}" in ${occ.url}`);
      }
    }
  }
  return { checkedAnchored, missing };
}

async function runQuery(env, query) {
  env.win.GBSearch.open();
  await flushMicrotasks();
  const scriptureChip = env.doc.querySelectorAll('.cp-scope-chip').find((c) => c.dataset.scope === 'scripture');
  assert(scriptureChip, 'missing scripture scope chip');
  scriptureChip.dispatchEvent({ type: 'click' });
  await flushMicrotasks();
  const input = env.doc.querySelector('.cp-input');
  input.value = query;
  input.dispatchEvent({ type: 'input' });
  await flushMicrotasks();

  const groups = env.doc.querySelectorAll('.cp-group').map((group) => {
    const hdSpans = group.querySelector('.cp-group-hd')?.children || [];
    const name = hdSpans[0]?.textContent || '';
    const items = group.querySelectorAll('.cp-item').map((item) => ({
      title: item.querySelector('.cp-item-title')?.textContent || '',
      meta: item.querySelector('.cp-item-meta')?.textContent || '',
      tags: item.querySelectorAll('.cp-item-tag').map((t) => t.textContent),
    }));
    return { name, items };
  });
  const readBtn = env.doc.getElementById('cp-read-btn');
  const status = env.doc.getElementById('cp-status')?.textContent || '';
  return { groups, previewHref: readBtn?.getAttribute('href') || null, status, input };
}

async function main() {
  const indexData = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

  // 1. Verify mixed anchored+unanchored Scripture queries rank exact anchored destinations first
  const env = bootSearchVm({ indexPayload: indexData });
  for (const query of ['Бытие 2:7', 'Евреям 6', 'Иеремия 17:9']) {
    const res = await runQuery(env, query);
    assert(res.groups.length >= 1, `expected Scripture groups for ${query}`);
    assert.equal(res.groups[0].name, 'Точные вхождения', `${query}: anchored occurrences must render first`);
    assert(res.groups[0].items.length > 0, `${query}: expected anchored items in first group`);
    for (const item of res.groups[0].items) {
      assert(item.tags.includes('Точное вхождение'), `${query}: anchored item must carry "Точное вхождение" tag`);
      assert(!item.tags.includes('Материал с упоминанием'), `${query}: anchored item must not carry mention tag`);
      assert.match(item.meta, /^Якорь · /u, `${query}: anchored item meta must start with "Якорь · "`);
    }
    assert.match(res.previewHref || '', /#.+/u, `${query}: first active preview link must carry a real #anchor (${res.previewHref})`);
    assert.match(res.status, /\d+\s+вх\./u, `${query}: status must preserve occurrence counter (${res.status})`);

    // Expand window if needed so unanchored mentions are also visible and verified
    let moreBtn = env.doc.querySelector('.cp-more');
    while (moreBtn) {
      moreBtn.dispatchEvent({ type: 'click' });
      await flushMicrotasks();
      moreBtn = env.doc.querySelector('.cp-more');
    }
    const expandedGroups = env.doc.querySelectorAll('.cp-group').map((group) => ({
      name: group.querySelector('.cp-group-hd')?.children?.[0]?.textContent || '',
      items: group.querySelectorAll('.cp-item').map((item) => ({
        meta: item.querySelector('.cp-item-meta')?.textContent || '',
        tags: item.querySelectorAll('.cp-item-tag').map((t) => t.textContent),
      })),
    }));
    assert.deepEqual(
      expandedGroups.map((g) => g.name),
      ['Точные вхождения', 'Материалы с упоминанием'],
      `${query}: expected exact occurrences followed by route-level mentions`,
    );
    for (const mention of expandedGroups[1].items) {
      assert(mention.tags.includes('Материал с упоминанием'), `${query}: unanchored mention must carry "Материал с упоминанием"`);
      assert(!mention.tags.includes('Точное вхождение'), `${query}: unanchored mention must NEVER promise "Точное вхождение"`);
      assert.match(mention.meta, /^Упоминание · /u, `${query}: unanchored mention meta must start with "Упоминание · "`);
    }
  }

  // 2. Verify all-unanchored reference preserves discovery honestly without claiming exact occurrence
  const unanchoredOnlyRef = indexData.references.find(
    (r) => Array.isArray(r.occurrences) && r.occurrences.length > 0 && r.occurrences.every((o) => !o.anchor),
  );
  assert(unanchoredOnlyRef, 'expected at least one unanchored-only reference in index');
  const mentionRes = await runQuery(env, unanchoredOnlyRef.label);
  assert.deepEqual(
    mentionRes.groups.map((g) => g.name),
    ['Материалы с упоминанием'],
    `${unanchoredOnlyRef.label}: unanchored-only reference must render under "Материалы с упоминанием"`,
  );
  assert(
    mentionRes.groups[0].items.every((item) => item.tags.includes('Материал с упоминанием') && !item.tags.includes('Точное вхождение')),
    `${unanchoredOnlyRef.label}: unanchored-only items must never promise "Точное вхождение"`,
  );

  // 3. Verify corrupted localStorage history shapes & throwing setItem never break Enter navigation
  for (const corrupted of ['{}', '42', 'null', '[null, 99, "Иер 17:9"]', '{bad-json']) {
    const badEnv = bootSearchVm({ indexPayload: indexData, historyRaw: corrupted, throwOnSetItem: true });
    const navRes = await runQuery(badEnv, 'Бытие 2:7');
    navRes.input.dispatchEvent({ type: 'keydown', key: 'Enter' });
    assert.match(
      badEnv.locationState.href,
      /^\/articles\/.+#.+/u,
      `corrupted history (${corrupted}) must not block Enter navigation to exact anchor`,
    );
  }

  // 4. Verify 100% of anchored Scripture occurrences in data/scripture-search-index.json resolve in dist/
  if (fs.existsSync(DIST_ROOT)) {
    const distCheck = verifyAllIndexedAnchorsInDist(indexData, DIST_ROOT);
    assert(distCheck.checkedAnchored > 1000, `expected >1000 anchored Scripture occurrences, got ${distCheck.checkedAnchored}`);
    assert.equal(distCheck.missing.length, 0, `broken Scripture anchors in dist:\n${distCheck.missing.slice(0, 15).join('\n')}`);

    // Negative fixture: broken anchor must fail closed
    const mutated = {
      references: [
        {
          label: 'Бытие 2:7',
          occurrences: [{ url: '/articles/chto-bibliya-nazyvaet-serdcem/', anchor: 'nonexistent-synthetic-anchor-xyz' }],
        },
      ],
    };
    const negCheck = verifyAllIndexedAnchorsInDist(mutated, DIST_ROOT);
    assert.equal(negCheck.missing.length, 1, 'negative fixture must detect missing anchor in dist/');
    console.log(
      `Scripture reachability contract passed: ${distCheck.checkedAnchored} anchored destinations verified in dist/, exact/mention ranking & history isolation verified.`,
    );
  } else {
    console.log('Scripture reachability runtime contract passed (dist/ skipped because dist/ is absent).');
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
