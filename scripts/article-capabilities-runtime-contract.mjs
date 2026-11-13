#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installArticleStrategicMap } from '../src/runtime/article-strategic-map.js';
import { installArticleFaqAccordions } from '../src/runtime/article-faq-accordion.js';
import { installArticleReadingTables } from '../src/runtime/article-reading-tables.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function makeMiniDom() {
  const byId = new Map();
  let activeElement = null;

  function makeNode(tag) {
    const attrs = new Map();
    const classes = new Set();
    const listeners = new Map();
    const children = [];
    const dataset = {};
    let text = '';

    const node = {
      tagName: String(tag).toUpperCase(),
      parentElement: null,
      children,
      dataset,
      style: { maxHeight: '', left: '', top: '' },
      hidden: false,
      inert: false,
      clientWidth: 320,
      scrollWidth: 320,
      scrollLeft: 0,
      scrollHeight: 160,
      get textContent() {
        return text || children.map((c) => c.textContent).join('');
      },
      set textContent(v) {
        text = String(v ?? '');
      },
      classList: {
        add: (...ns) => ns.forEach((n) => n && classes.add(n)),
        remove: (...ns) => ns.forEach((n) => classes.delete(n)),
        toggle: (n, force) => {
          const on = force === undefined ? !classes.has(n) : Boolean(force);
          if (on) classes.add(n);
          else classes.delete(n);
          return on;
        },
        contains: (n) => classes.has(n),
      },
      get className() {
        return [...classes].join(' ');
      },
      set className(v) {
        classes.clear();
        String(v || '').split(/\s+/u).filter(Boolean).forEach((c) => classes.add(c));
      },
      get id() {
        return attrs.get('id') || '';
      },
      set id(v) {
        node.setAttribute('id', v);
      },
      setAttribute(name, val) {
        const s = String(val);
        attrs.set(name, s);
        if (name === 'id') byId.set(s, node);
        if (name === 'class') node.className = s;
        if (name === 'inert') node.inert = true;
      },
      getAttribute(name) {
        return attrs.has(name) ? attrs.get(name) : null;
      },
      hasAttribute(name) {
        return attrs.has(name);
      },
      removeAttribute(name) {
        if (name === 'id') byId.delete(attrs.get('id'));
        if (name === 'inert') node.inert = false;
        attrs.delete(name);
      },
      appendChild(child) {
        child.parentElement = node;
        children.push(child);
        return child;
      },
      append(...items) {
        items.forEach((c) => node.appendChild(c));
      },
      replaceChildren(...items) {
        children.length = 0;
        items.forEach((c) => node.appendChild(c));
      },
      remove() {
        if (!node.parentElement) return;
        const idx = node.parentElement.children.indexOf(node);
        if (idx >= 0) node.parentElement.children.splice(idx, 1);
        node.parentElement = null;
      },
      cloneNode() {
        const copy = makeNode(tag);
        copy.textContent = node.textContent;
        return copy;
      },
      get nextElementSibling() {
        if (!node.parentElement) return null;
        const idx = node.parentElement.children.indexOf(node);
        return idx >= 0 ? node.parentElement.children[idx + 1] || null : null;
      },
      get previousElementSibling() {
        if (!node.parentElement) return null;
        const idx = node.parentElement.children.indexOf(node);
        return idx > 0 ? node.parentElement.children[idx - 1] || null : null;
      },
      closest(sel) {
        let cur = node;
        while (cur) {
          if (matches(cur, sel)) return cur;
          cur = cur.parentElement;
        }
        return null;
      },
      contains(other) {
        if (!other) return false;
        if (other === node) return true;
        return children.some((c) => c.contains(other));
      },
      focus() {
        activeElement = node;
      },
      click() {
        node.dispatchEvent({ type: 'click', target: node });
      },
      getBoundingClientRect: () => ({ left: 40, top: 120, bottom: 144, width: 24, height: 24 }),
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      removeEventListener(type, fn) {
        const arr = listeners.get(type) || [];
        const i = arr.indexOf(fn);
        if (i >= 0) arr.splice(i, 1);
      },
      dispatchEvent(evt) {
        let stopped = false;
        const e = {
          preventDefault() { e.defaultPrevented = true; },
          stopPropagation() { stopped = true; },
          currentTarget: node,
          target: evt.target || node,
          defaultPrevented: false,
          ...evt,
        };
        for (const fn of [...(listeners.get(e.type) || [])]) {
          fn(e);
          if (stopped) break;
        }
        return e;
      },
      querySelector(sel) {
        return node.querySelectorAll(sel)[0] || null;
      },
      querySelectorAll(sel) {
        const out = [];
        const visit = (cur) => {
          for (const ch of cur.children) {
            if (matches(ch, sel)) out.push(ch);
            visit(ch);
          }
        };
        visit(node);
        return out;
      },
    };
    return node;
  }

  function matches(el, selector) {
    return String(selector)
      .split(',')
      .map((s) => s.trim())
      .some((sel) => {
        if (sel === '.map-trigger[data-tip]') return el.classList.contains('map-trigger') && el.hasAttribute('data-tip');
        if (sel === '.gb-strategic-map-popover__close') return el.classList.contains('gb-strategic-map-popover__close');
        if (sel === '.gb-strategic-map-popover__body') return el.classList.contains('gb-strategic-map-popover__body');
        if (sel === '.faq-accordion__q') return el.classList.contains('faq-accordion__q');
        if (sel === '.faq-accordion__item') return el.classList.contains('faq-accordion__item');
        if (sel === '.faq-accordion__body-inner') return el.classList.contains('faq-accordion__body-inner');
        if (sel === '.faq-accordion') return el.classList.contains('faq-accordion');
        if (sel === 'caption') return el.tagName === 'CAPTION';
        if (sel === 'article table' || sel === 'main table') return el.tagName === 'TABLE';
        if (sel === '.manuscript-table') return el.classList.contains('manuscript-table');
        if (sel === '.compare-table') return el.classList.contains('compare-table');
        if (sel === '.heading-anchor' || sel === '[aria-hidden="true"]') return false;
        return false;
      });
  }

  const documentElement = makeNode('html');
  const body = makeNode('body');
  documentElement.appendChild(body);
  const docListeners = new Map();
  const winListeners = new Map();

  const documentObj = {
    documentElement,
    body,
    get activeElement() {
      return activeElement || body;
    },
    createElement: makeNode,
    getElementById: (id) => byId.get(id) || null,
    querySelector: (s) => body.querySelector(s),
    querySelectorAll: (s) => body.querySelectorAll(s),
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    dispatchEvent(evt) {
      const e = { preventDefault() {}, stopPropagation() {}, ...evt };
      for (const fn of docListeners.get(e.type) || []) fn(e);
    },
  };

  const windowObj = {
    innerWidth: 390,
    innerHeight: 844,
    getComputedStyle: (el) => ({ overflowX: el.dataset.computedOverflowX || '' }),
    requestAnimationFrame: (fn) => fn(),
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    dispatchEvent(evt) {
      for (const fn of winListeners.get(evt.type) || []) fn(evt);
    },
  };

  globalThis.document = documentObj;
  globalThis.window = windowObj;
  globalThis.requestAnimationFrame = windowObj.requestAnimationFrame;
  return { makeNode, documentObj, windowObj };
}

// 1. Static CSS contract for mobile coarse-pointer .fn-marker--dove map triggers & no-JS FAQ fallback
const capabilitiesCss = fs.readFileSync(path.join(ROOT, 'src/runtime/article-capabilities.css'), 'utf8');
assert.match(
  capabilitiesCss,
  /\.map-trigger\[data-gb-strategic-map-owner="native-v1"\]\.fn-marker--dove\s*\{[^}]*display:\s*inline-flex;[^}]*min-width:\s*1\.35rem;[^}]*min-height:\s*1\.35rem;/su,
  'strategic-map dove triggers must enforce positive inline-flex min dimensions',
);
assert.match(
  capabilitiesCss,
  /\.map-trigger\[data-gb-strategic-map-owner="native-v1"\]\.fn-marker--dove::before\s*\{[^}]*position:\s*static;/su,
  'strategic-map dove ::before must stay in normal flow on coarse-pointer mobile',
);
assert.match(
  capabilitiesCss,
  /\.faq-accordion:not\(\[data-gb-faq-enhanced="native-v1"\]\)\s+\.faq-accordion__body\s*\{[^}]*max-height:\s*none\s*!important;/su,
  'no-JS FAQ fallback must keep answers expanded until JS marks ownership',
);

// 2. Runtime behavior: Strategic map focus entry + Escape focus return
{
  const { makeNode, documentObj } = makeMiniDom();
  const dataScript = makeNode('script');
  dataScript.id = 'strategicMapData';
  dataScript.textContent = JSON.stringify({
    '1': { blocks: [{ type: 'biblical', title: 'Принцип', text: 'Проверка контекста.' }] },
  });
  const trigger = makeNode('span');
  trigger.className = 'fn-marker fn-marker--dove map-trigger';
  trigger.setAttribute('data-tip', '1');
  documentObj.body.append(dataScript, trigger);

  const api = installArticleStrategicMap();
  assert.equal(api.enabled, true);
  assert.equal(trigger.getAttribute('role'), 'button');
  assert.equal(trigger.getAttribute('tabindex'), '0');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');

  trigger.focus();
  trigger.dispatchEvent({ type: 'keydown', key: 'Enter' });
  const popover = documentObj.getElementById('gb-strategic-map-popover');
  const closeBtn = popover.querySelector('.gb-strategic-map-popover__close');
  assert.equal(popover.hidden, false);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(documentObj.activeElement, closeBtn, 'opening strategic map dialog must move focus inside dialog');

  documentObj.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert.equal(popover.hidden, true);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(documentObj.activeElement, trigger, 'Escape must restore focus to opening trigger');
}

// 3. Runtime behavior: FAQ collapsed inert + focus return on close
{
  const { makeNode, documentObj } = makeMiniDom();
  const root = makeNode('div');
  root.className = 'faq-accordion';
  const item = makeNode('div');
  item.className = 'faq-accordion__item';
  const btn = makeNode('button');
  btn.className = 'faq-accordion__q';
  btn.setAttribute('aria-controls', 'faq-body-1');
  const body = makeNode('div');
  body.id = 'faq-body-1';
  body.className = 'faq-accordion__body';
  const inner = makeNode('div');
  inner.className = 'faq-accordion__body-inner';
  const link = makeNode('a');
  link.setAttribute('href', '#ref');
  inner.appendChild(link);
  body.appendChild(inner);
  item.append(btn, body);
  root.appendChild(item);
  documentObj.body.appendChild(root);

  const faqApi = installArticleFaqAccordions();
  assert.equal(faqApi.enabled, true);
  assert.equal(root.dataset.gbFaqEnhanced, 'native-v1');
  assert.equal(btn.getAttribute('aria-expanded'), 'false');
  assert.equal(body.hasAttribute('inert'), true, 'collapsed FAQ panel must carry inert');

  btn.click();
  assert.equal(btn.getAttribute('aria-expanded'), 'true');
  assert.equal(body.hasAttribute('inert'), false, 'expanded FAQ panel must release inert');

  link.focus();
  assert.equal(documentObj.activeElement, link);
  btn.click();
  assert.equal(body.hasAttribute('inert'), true);
  assert.equal(documentObj.activeElement, btn, 'collapsing FAQ while focus is inside body must return focus to button');
}

// 4. Runtime behavior: Reading tables conditional keyboard scroll & reversibility
{
  const { makeNode, documentObj, windowObj } = makeMiniDom();
  const article = makeNode('article');
  const heading = makeNode('h3');
  heading.textContent = 'Сравнение источников';

  // Wrapped table (wrapper gets role="region" + tabindex="0" only when overflowing)
  const wrapper = makeNode('div');
  wrapper.className = 'table-scroll';
  wrapper.clientWidth = 320;
  wrapper.scrollWidth = 640;
  const wrappedTable = makeNode('table');
  wrappedTable.className = 'compare-table';
  wrapper.appendChild(wrappedTable);

  // Direct table (NEVER gets role="region"; gets tabindex="0" only when overflowing)
  const directTable = makeNode('table');
  directTable.className = 'manuscript-table';
  directTable.clientWidth = 320;
  directTable.scrollWidth = 580;

  // Author-owned static keyboard table (must preserve static tabindex="0" even when not overflowing)
  const staticTable = makeNode('table');
  staticTable.className = 'manuscript-table manuscript-table--keyboard-scroll';
  staticTable.setAttribute('tabindex', '0');
  staticTable.clientWidth = 600;
  staticTable.scrollWidth = 600;

  article.append(heading, wrapper, directTable, staticTable);
  documentObj.body.appendChild(article);

  const tablesApi = installArticleReadingTables();
  assert.equal(tablesApi.enabled, true);
  assert.equal(tablesApi.active, 2);

  assert.equal(wrapper.getAttribute('tabindex'), '0');
  assert.equal(wrapper.getAttribute('role'), 'region');
  assert.match(wrapper.getAttribute('aria-label') || '', /Таблица: Сравнение источников/u);
  assert.equal(wrappedTable.hasAttribute('role'), false, 'native <table> inside wrapper must keep table semantics');

  assert.equal(directTable.getAttribute('tabindex'), '0');
  assert.equal(directTable.hasAttribute('role'), false, 'direct <table> must NEVER receive role="region"');
  assert.match(directTable.getAttribute('aria-label') || '', /Таблица: Сравнение источников/u);

  assert.equal(staticTable.getAttribute('tabindex'), '0', 'author-set tabindex="0" must not be stripped');

  // Keyboard panning: ArrowRight, End, Home, ArrowLeft
  wrapper.dispatchEvent({ type: 'keydown', key: 'ArrowRight', target: wrapper });
  assert(wrapper.scrollLeft > 0, 'ArrowRight must pan overflowing table wrapper');
  wrapper.dispatchEvent({ type: 'keydown', key: 'End', target: wrapper });
  assert.equal(wrapper.scrollLeft, 320, 'End must jump to max horizontal scroll');
  wrapper.dispatchEvent({ type: 'keydown', key: 'ArrowLeft', target: wrapper });
  assert(wrapper.scrollLeft < 320, 'ArrowLeft must pan back left');
  wrapper.dispatchEvent({ type: 'keydown', key: 'Home', target: wrapper });
  assert.equal(wrapper.scrollLeft, 0, 'Home must jump to start');

  // Resize to desktop where tables fit: managed attributes clean up reversibly
  wrapper.clientWidth = 720;
  wrapper.scrollWidth = 640;
  directTable.clientWidth = 720;
  directTable.scrollWidth = 580;
  windowObj.dispatchEvent({ type: 'resize' });

  assert.equal(wrapper.hasAttribute('tabindex'), false, 'non-overflowing wrapper must release managed tabindex');
  assert.equal(wrapper.hasAttribute('role'), false, 'non-overflowing wrapper must release managed role');
  assert.equal(wrapper.hasAttribute('aria-label'), false, 'non-overflowing wrapper must release managed aria-label');
  assert.equal(directTable.hasAttribute('tabindex'), false, 'non-overflowing direct table must release managed tabindex');
  assert.equal(staticTable.getAttribute('tabindex'), '0', 'author-owned tabindex="0" remains preserved across resize');
}

console.log('Article capabilities runtime contract: PASS (strategic-map, faq-accordion, reading-tables)');
