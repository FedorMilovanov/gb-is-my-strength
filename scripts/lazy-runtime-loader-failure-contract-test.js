'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const MOBILE_PATH = 'src/components/article-pilots/_shared/MobileChromePage.astro';
const READER_PATH = 'src/runtime/reader-tts.js';
const FLOATING_PATH = 'js/floating-cluster-controller.js';

const mobileSource = fs.readFileSync(MOBILE_PATH, 'utf8');
const readerSource = fs.readFileSync(READER_PATH, 'utf8');
const floatingSource = fs.readFileSync(FLOATING_PATH, 'utf8');

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist`);
  const open = source.indexOf('{', start);
  assert.notEqual(open, -1, `${name} must have a body`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unclosed function ${name}`);
}

class FakeScript {
  constructor(src = '') {
    this.src = src;
    this.defer = false;
    this.dataset = {};
    this.parentNode = null;
    this.listeners = new Map();
  }

  addEventListener(type, listener, options = {}) {
    const entries = this.listeners.get(type) || [];
    entries.push({ listener, once: options?.once === true });
    this.listeners.set(type, entries);
  }

  dispatch(type) {
    const entries = [...(this.listeners.get(type) || [])];
    for (const entry of entries) {
      entry.listener({ type, target: this });
      if (entry.once) {
        const current = this.listeners.get(type) || [];
        this.listeners.set(type, current.filter((candidate) => candidate !== entry));
      }
    }
  }

  remove() {
    if (this.parentNode?.removeChild) this.parentNode.removeChild(this);
  }
}

function createDocument() {
  const scripts = [];
  const appended = [];
  const head = {
    appendChild(node) {
      if (!scripts.includes(node)) scripts.push(node);
      node.parentNode = head;
      appended.push(node);
      return node;
    },
    removeChild(node) {
      const index = scripts.indexOf(node);
      if (index >= 0) scripts.splice(index, 1);
      node.parentNode = null;
      return node;
    },
  };
  return {
    scripts,
    appended,
    head,
    createElement(tag) {
      assert.equal(tag, 'script', 'loader contract may create only script elements');
      return new FakeScript();
    },
  };
}

function compileReaderLoader(document, window) {
  const state = { engineScriptPromise: null };
  const ensureVoskScript = extractFunction(readerSource, 'ensureVoskScript');
  const context = vm.createContext({
    Array,
    Error,
    Promise,
    document,
    window,
    state,
    ENGINE_SRC: '/js/vosk-tts-engine.js',
  });
  vm.runInContext(`${ensureVoskScript}\nglobalThis.__loader = ensureVoskScript;`, context);
  return { load: context.__loader, state, source: ensureVoskScript };
}

function compileFloatingLoader(document, window) {
  const findVoskEngineScript = extractFunction(floatingSource, 'findVoskEngineScript');
  const loadVoskEngineScript = extractFunction(floatingSource, 'loadVoskEngineScript');
  const context = vm.createContext({
    Array,
    Error,
    Promise,
    document,
    window,
    _voskEngineScriptPromise: null,
    VOSK_ENGINE_SRC: '/js/vosk-tts-engine.js?v=contract',
  });
  vm.runInContext(
    `${findVoskEngineScript}\n${loadVoskEngineScript}\nglobalThis.__loader = loadVoskEngineScript;`,
    context,
  );
  return { load: context.__loader, context, source: loadVoskEngineScript };
}

function assertSearchFailureStateContract() {
  assert.match(
    mobileSource,
    /__gbSearchLoadState\?: 'idle' \| 'loading' \| 'ready' \| 'failed';/,
    'mobile search loader must expose explicit terminal acquisition states',
  );
  assert.match(mobileSource, /w\.__gbSearchLoadState \|\|= 'idle';/);
  assert.match(mobileSource, /w\.__gbSearchLoadState = 'loading';/);
  assert.match(mobileSource, /w\.__gbSearchLoadState = 'ready';/);
  assert.match(
    mobileSource,
    /s\.onerror = \(\) => \{[\s\S]*?w\.__gbSearchLoading = false;[\s\S]*?w\.__gbSearchBootRequested = false;[\s\S]*?w\.__gbSearchLoadState = 'failed';[\s\S]*?s\.remove\(\);[\s\S]*?\};/,
    'terminal network failure must clear boot intent, publish failed and discard the failed script',
  );
  assert.match(
    mobileSource,
    /s\.onload = \(\) => \{[\s\S]*?w\.__gbSearchLoadState = 'ready';[\s\S]*?w\.__gbSearchLoadState = 'failed';[\s\S]*?w\.__gbSearchBootRequested = false;[\s\S]*?s\.remove\(\);[\s\S]*?\};/,
    'a loaded script that did not initialize GBSearch must also settle as failed',
  );
}

async function assertReaderRetryContract() {
  const document = createDocument();
  const window = {};
  const stale = new FakeScript('/js/vosk-tts-engine.js?v=old');
  stale.dataset.gbVoskEngineState = 'failed';
  document.head.appendChild(stale);
  document.appended.length = 0;

  const reader = compileReaderLoader(document, window);
  assert.doesNotMatch(reader.source, /setTimeout|setInterval/, 'Reader acquisition must not depend on timing guesses');

  const first = reader.load();
  assert.equal(document.scripts.length, 1);
  const replacement = document.scripts[0];
  assert.notEqual(replacement, stale, 'Reader must replace a terminal failed script');
  assert.equal(replacement.dataset.gbVoskEngineState, 'loading');
  assert.equal(document.appended.length, 1);

  replacement.dispatch('error');
  await assert.rejects(first, /Vosk engine script failed/);
  await Promise.resolve();
  assert.equal(replacement.dataset.gbVoskEngineState, 'failed');
  assert.equal(reader.state.engineScriptPromise, null, 'Reader promise must clear after terminal failure');

  const retry = reader.load();
  const retryScript = document.scripts[0];
  assert.notEqual(retryScript, replacement, 'retry must create a fresh acquisition');
  assert.equal(retryScript.dataset.gbVoskEngineState, 'loading');
  window.VoskTTSEngine = { isSupported: () => true };
  retryScript.dispatch('load');
  assert.equal(await retry, window.VoskTTSEngine);
  assert.equal(retryScript.dataset.gbVoskEngineState, 'ready');
}

async function assertReaderAdoptsInFlightContract() {
  const document = createDocument();
  const window = {};
  const inFlight = new FakeScript('/js/vosk-tts-engine.js?v=current');
  inFlight.dataset.gbVoskEngineState = 'loading';
  document.head.appendChild(inFlight);
  document.appended.length = 0;
  const reader = compileReaderLoader(document, window);

  const first = reader.load();
  const second = reader.load();
  assert.equal(first, second, 'Reader must deduplicate its own in-flight acquisition');
  assert.equal(document.appended.length, 0, 'Reader must adopt an existing shared loading script');
  assert.equal(document.scripts[0], inFlight);

  window.VoskTTSEngine = { isSupported: () => true };
  inFlight.dispatch('load');
  assert.equal(await first, window.VoskTTSEngine);
  assert.equal(inFlight.dataset.gbVoskEngineState, 'ready');
}

async function assertFloatingRetryContract() {
  const document = createDocument();
  const window = {};
  const floating = compileFloatingLoader(document, window);
  assert.doesNotMatch(floating.source, /setTimeout|setInterval/, 'Floating acquisition must not depend on timing guesses');

  const first = floating.load();
  const duplicate = floating.load();
  assert.equal(first, duplicate, 'Floating loader must deduplicate its own in-flight acquisition');
  assert.equal(document.scripts.length, 1);
  const firstScript = document.scripts[0];
  assert.equal(firstScript.dataset.gbVoskEngineState, 'loading');

  firstScript.dispatch('error');
  await assert.rejects(first, /load failed/);
  assert.equal(firstScript.dataset.gbVoskEngineState, 'failed');
  assert.equal(floating.context._voskEngineScriptPromise, null);

  const retry = floating.load();
  const retryScript = document.scripts[0];
  assert.notEqual(retryScript, firstScript, 'Floating retry must replace its failed script');
  assert.equal(retryScript.dataset.gbVoskEngineState, 'loading');
  window.VoskTTSEngine = { isSupported: () => true };
  retryScript.dispatch('load');
  await retry;
  assert.equal(retryScript.dataset.gbVoskEngineState, 'ready');
}

async function assertCrossLoaderDedupContract() {
  const document = createDocument();
  const window = {};
  const floating = compileFloatingLoader(document, window);
  const reader = compileReaderLoader(document, window);

  const floatingPromise = floating.load();
  const sharedScript = document.scripts[0];
  assert.equal(sharedScript.dataset.gbVoskEngineState, 'loading');
  const readerPromise = reader.load();

  assert.equal(document.scripts.length, 1, 'Reader and Floating must share one in-flight Vosk script');
  assert.equal(document.appended.length, 1, 'cross-loader race must not append a duplicate script');

  window.VoskTTSEngine = { isSupported: () => true };
  sharedScript.dispatch('load');
  await Promise.all([floatingPromise, readerPromise]);
  assert.equal(sharedScript.dataset.gbVoskEngineState, 'ready');
}

async function main() {
  assertSearchFailureStateContract();
  await assertReaderRetryContract();
  await assertReaderAdoptsInFlightContract();
  await assertFloatingRetryContract();
  await assertCrossLoaderDedupContract();
  console.log('Lazy runtime loader failure-state contract: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
