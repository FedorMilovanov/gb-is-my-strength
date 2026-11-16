#!/usr/bin/env node
'use strict';

// Real runtime executed in a bounded DOM fixture, not a mirrored copyText
// implementation. The test fails if a failing legacy copy leaks its textarea.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const RUNTIME = fs.readFileSync(path.join(ROOT, 'src/runtime/reader-actions.js'), 'utf8');
const URL_TO_COPY = 'https://gospod-bog.ru/articles/example/';

function makeFixture(testCase) {
  const attached = [];
  const errors = [];
  const counters = { textareas: 0, selections: 0, copyCommands: 0, delegates: 0, clipboard: 0, nativeShare: 0 };
  let toast = null;

  function throwConfigured() {
    if (testCase.outcome === 'throw') throw new Error('synthetic copy failure');
    if (testCase.outcome === 'abort') {
      const error = new Error('share cancelled');
      error.name = 'AbortError';
      throw error;
    }
    return testCase.outcome !== 'false';
  }

  const document = {
    title: 'Reader fixture',
    documentElement: { dataset: {} },
    body: { appendChild(node) { attached.push(node); return node; } },
    addEventListener() {},
    querySelector(selector) { return selector === '.gb-fc-toast' ? toast : null; },
    execCommand(command) {
      assert.equal(command, 'copy', 'only legacy copy is allowed');
      counters.copyCommands += 1;
      return throwConfigured();
    },
    createElement(tagName) {
      if (tagName === 'textarea') {
        counters.textareas += 1;
        const area = {
          tagName: 'TEXTAREA',
          value: '',
          style: {},
          setAttribute() {},
          select() {
            counters.selections += 1;
            if (testCase.outcome === 'select-throw') throw new Error('synthetic selection failure');
          },
          remove() {
            const index = attached.indexOf(area);
            if (index !== -1) attached.splice(index, 1);
          },
        };
        return area;
      }
      if (tagName === 'div') {
        const label = { textContent: '' };
        const icon = { style: {} };
        const classes = new Set();
        toast = {
          tagName: 'DIV',
          className: '',
          innerHTML: '',
          setAttribute() {},
          classList: { add(name) { classes.add(name); }, remove(name) { classes.delete(name); } },
          querySelector(selector) {
            if (selector === 'span') return label;
            if (selector === 'svg') return icon;
            return null;
          },
          get message() { return label.textContent; },
          get isOpen() { return classes.has('is-open'); },
        };
        return toast;
      }
      throw new Error('unexpected element: ' + tagName);
    },
  };
  const navigator = {};
  const window = {
    SITE_CONFIG: { page: { title: 'Reader fixture' } },
    addEventListener() {},
    dispatchEvent() {},
    clearTimeout() {},
    setTimeout() { return 1; },
    print() {},
  };
  if (testCase.mode === 'delegate') {
    window.SiteUtils = {
      async copyText(value) {
        assert.equal(value, URL_TO_COPY);
        counters.delegates += 1;
        return throwConfigured();
      },
    };
  } else if (testCase.mode === 'clipboard') {
    navigator.clipboard = {
      async writeText(value) {
        assert.equal(value, URL_TO_COPY);
        counters.clipboard += 1;
        throwConfigured();
      },
    };
  } else if (testCase.mode === 'native') {
    navigator.share = async (payload) => {
      assert.equal(payload.url, URL_TO_COPY);
      counters.nativeShare += 1;
      throwConfigured();
    };
  }
  const context = {
    window, document, navigator,
    location: { href: URL_TO_COPY, origin: 'https://gospod-bog.ru' },
    history: { length: 1, back() {} },
    console: { error(...args) { errors.push(args); } },
    CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    Element: class Element {},
    URL,
  };
  vm.runInNewContext(RUNTIME, context, { filename: 'src/runtime/reader-actions.js', timeout: 2000 });
  assert.equal(window.GBReaderActions?.version, 1, 'reader runtime installed');
  return { document, window, attached, errors, counters, toast: () => toast };
}

const cases = [
  { mode: 'legacy', outcome: 'true', expected: 'copied', textareas: 1, errors: 0 },
  { mode: 'legacy', outcome: 'false', expected: 'failed', textareas: 1, errors: 0 },
  { mode: 'legacy', outcome: 'throw', expected: 'failed', textareas: 1, errors: 1 },
  { mode: 'legacy', outcome: 'select-throw', expected: 'failed', textareas: 1, errors: 1 },
  { mode: 'delegate', outcome: 'true', expected: 'copied', textareas: 0, errors: 0 },
  { mode: 'delegate', outcome: 'false', expected: 'failed', textareas: 0, errors: 0 },
  { mode: 'delegate', outcome: 'throw', expected: 'failed', textareas: 0, errors: 1 },
  { mode: 'clipboard', outcome: 'true', expected: 'copied', textareas: 0, errors: 0 },
  { mode: 'clipboard', outcome: 'throw', expected: 'failed', textareas: 0, errors: 1 },
  { mode: 'native', outcome: 'true', expected: 'shared', textareas: 0, errors: 0 },
  { mode: 'native', outcome: 'throw', expected: 'failed', textareas: 0, errors: 1 },
  { mode: 'native', outcome: 'abort', expected: undefined, textareas: 0, errors: 0 },
];

(async () => {
  for (const item of cases) {
    const fixture = makeFixture(item);
    const trigger = { dataset: {} };
    await fixture.window.GBReaderActions.share(trigger);
    const caseName = item.mode + '/' + item.outcome;
    assert.equal(trigger.dataset.shareStatus, item.expected, caseName + ': outcome');
    assert.equal(fixture.counters.textareas, item.textareas, caseName + ': test path reached');
    assert.equal(fixture.errors.length, item.errors, caseName + ': error ownership');
    assert.equal(fixture.attached.filter(node => node.tagName === 'TEXTAREA').length, 0, caseName + ': leaked textarea');
    if (item.textareas) {
      assert.equal(fixture.counters.selections, 1, caseName + ': fallback selection executed');
      assert.equal(fixture.counters.copyCommands, item.outcome === 'select-throw' ? 0 : 1, caseName + ': copy attempt count');
    } else {
      assert.equal(fixture.counters.copyCommands, 0, caseName + ': legacy fallback not called');
    }
    if (item.expected === 'copied') {
      assert.equal(fixture.toast()?.message, 'Ссылка скопирована', caseName + ': success message');
      assert.equal(fixture.toast()?.isOpen, true, caseName + ': visible feedback');
    }
    if (item.expected === 'failed') {
      assert.notEqual(fixture.toast()?.message, 'Ссылка скопирована', caseName + ': no false-success message');
    }
  }
  console.log('Reader share/copy outcome contract: ' + cases.length + '/' + cases.length + ' scenarios PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
