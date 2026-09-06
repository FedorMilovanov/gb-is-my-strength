#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function stripLeadingIife(source) {
  return source
    .replace(/^\s*\(\(\)\s*=>\s*\{\s*'use strict';/, "'use strict';")
    .replace(/\}\)\(\);\s*$/, '');
}

function extractNamedFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`could not find function ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated function ${name}`);
}

class FakeScript {
  constructor(src = '') {
    this.src = src;
    this.defer = false;
    this.dataset = {};
    this.parentNode = null;
    this.listeners = { load: [], error: [] };
  }

  addEventListener(type, handler) {
    this.listeners[type].push(handler);
  }

  remove() {
    this.parentNode?.removeChild(this);
  }

  emit(type) {
    const handlers = this.listeners[type].slice();
    this.listeners[type] = [];
    handlers.forEach((handler) => handler());
  }
}

class FakeDocument {
  constructor() {
    this.scripts = [];
    this.appended = 0;
    this.removed = 0;
    this.head = {
      appendChild: (script) => {
        this.appended += 1;
        script.parentNode = this.head;
        this.scripts.push(script);
      },
      removeChild: (script) => {
        const index = this.scripts.indexOf(script);
        if (index >= 0) this.scripts.splice(index, 1);
        script.parentNode = null;
        this.removed += 1;
      },
    };
  }

  createElement(tag) {
    if (tag !== 'script') throw new Error(`unexpected element ${tag}`);
    return new FakeScript();
  }
}

const api = {
  isSupported: () => true,
  isReady: () => true,
  ensureLoaded: () => Promise.resolve(),
};

async function runReaderAttempt(failMode) {
  const path = 'src/runtime/reader-tts.js';
  const source = fs.readFileSync(path, 'utf8');
  const code = stripLeadingIife(source);
  const document = new FakeDocument();
  const context = { console, Promise, setTimeout, clearTimeout, document, window: {} };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(code.slice(0, code.indexOf('function withModelLock')), context, { filename: path });

  const first = context.ensureVoskScript();
  const concurrent = context.ensureVoskScript();
  if (concurrent !== first) fail(`reader-tts ${failMode}: concurrent requests must share one in-flight promise`);
  if (document.appended !== 1) fail(`reader-tts ${failMode}: concurrent requests appended more than one script`);

  const active = document.scripts[0];
  if (failMode === 'load-without-api') active.emit('load');
  else active.emit('error');

  const firstError = await first.then(() => null, (error) => error);
  if (!firstError) fail(`reader-tts ${failMode}: terminal failure unexpectedly resolved`);
  await Promise.resolve();
  if (context.state.engineScriptPromise !== null) fail(`reader-tts ${failMode}: rejected promise stayed sticky`);
  if (active.dataset.gbVoskEngineState !== 'failed') fail(`reader-tts ${failMode}: failed script was not marked failed`);

  const second = context.ensureVoskScript();
  if (document.appended !== 2 || document.removed < 1) {
    fail(`reader-tts ${failMode}: retry did not replace the failed script`);
  }
  context.window.VoskTTSEngine = api;
  const retryScript = document.scripts.find((script) => script.dataset.gbVoskEngineState === 'loading');
  if (!retryScript) fail(`reader-tts ${failMode}: retry script was not marked loading`);
  retryScript.emit('load');
  if ((await second) !== api) fail(`reader-tts ${failMode}: retry did not recover`);
  if (retryScript.dataset.gbVoskEngineState !== 'ready') fail(`reader-tts ${failMode}: recovered script was not marked ready`);
}

async function testReaderTts() {
  await runReaderAttempt('load-without-api');
  await runReaderAttempt('script-error');
}

async function runFloatingVoskAttempt(failMode) {
  const path = 'js/floating-cluster-controller.js';
  const source = fs.readFileSync(path, 'utf8');
  const snippet = [
    "var VOSK_ENGINE_SRC = '/js/vosk-tts-engine.js?v=test';",
    'var _voskEngineScriptPromise = null;',
    extractNamedFunction(source, 'findVoskEngineScript'),
    extractNamedFunction(source, 'loadVoskEngineScript'),
  ].join('\n');

  const document = new FakeDocument();
  const context = { console, Promise, document, window: {} };
  vm.createContext(context);
  vm.runInContext(snippet, context, { filename: path });

  const first = context.loadVoskEngineScript();
  const concurrent = context.loadVoskEngineScript();
  if (concurrent !== first) fail(`floating Vosk ${failMode}: concurrent requests were not deduplicated`);
  if (document.appended !== 1) fail(`floating Vosk ${failMode}: concurrent requests appended more than one script`);

  const active = document.scripts[0];
  if (failMode === 'load-without-api') active.emit('load');
  else active.emit('error');

  const firstError = await first.then(() => null, (error) => error);
  if (!firstError) fail(`floating Vosk ${failMode}: terminal failure unexpectedly resolved`);
  if (context._voskEngineScriptPromise !== null) fail(`floating Vosk ${failMode}: rejected promise stayed sticky`);
  if (active.dataset.gbVoskEngineState !== 'failed') fail(`floating Vosk ${failMode}: failed script was not marked failed`);

  const second = context.loadVoskEngineScript();
  if (document.appended !== 2 || document.removed < 1) {
    fail(`floating Vosk ${failMode}: retry did not replace the failed script`);
  }
  context.window.VoskTTSEngine = api;
  const retryScript = document.scripts.find((script) => script.dataset.gbVoskEngineState === 'loading');
  if (!retryScript) fail(`floating Vosk ${failMode}: retry script was not marked loading`);
  retryScript.emit('load');
  await second;
  if (retryScript.dataset.gbVoskEngineState !== 'ready') fail(`floating Vosk ${failMode}: recovered script was not marked ready`);
}

async function testFloatingVosk() {
  await runFloatingVoskAttempt('load-without-api');
  await runFloatingVoskAttempt('script-error');
}

async function main() {
  await testReaderTts();
  await testFloatingVosk();
  console.log('Vosk loader retry contract: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
