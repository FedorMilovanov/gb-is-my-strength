#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
const WORKER_SOURCE = fs.readFileSync(path.join(ROOT, 'js/vosk-tts-worker.js'), 'utf8');
fs.mkdirSync(REPORTS, { recursive: true });

function createPort(name) {
  return {
    name,
    messages: [],
    closed: false,
    onmessage: null,
    onmessageerror: null,
    postMessage(payload) { this.messages.push(payload); },
    start() {},
    close() { this.closed = true; },
  };
}

function createWorkerContext() {
  const self = {
    onconnect: null,
    postMessage() {},
    crypto: {},
  };
  const context = vm.createContext({
    self,
    console,
    Map,
    Set,
    Promise,
    ArrayBuffer,
    Uint8Array,
    Int16Array,
    Float32Array,
    BigInt64Array,
    DataView,
    TextDecoder,
    DOMException,
    Error,
    Object,
    String,
    Number,
    Math,
    Date,
    AbortController,
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout,
    clearTimeout,
    fetch: () => Promise.reject(new Error('unexpected fetch in lifecycle contract')),
    indexedDB: {},
    importScripts: () => { throw new Error('unexpected importScripts in lifecycle contract'); },
  });
  vm.runInContext(WORKER_SOURCE, context, { filename: 'js/vosk-tts-worker.js' });
  assert.equal(typeof context.self.onconnect, 'function', 'actual worker did not enter SharedWorker scope');
  return context;
}

function attach(context, name) {
  const port = createPort(name);
  context.self.onconnect({ ports: [port] });
  assert.equal(typeof port.onmessage, 'function', `${name} was not attached`);
  return port;
}

function send(port, data) {
  port.onmessage({ data });
}

function terminalMessages(port) {
  return port.messages.filter((message) => message.type === 'audio' || message.type === 'synth-error');
}

async function testLoadRetirement() {
  const context = createWorkerContext();
  const first = attach(context, 'first');
  const second = attach(context, 'second');
  let aborts = 0;
  context.state.loading = new Promise(() => {});
  context.state.loadController = { abort() { aborts += 1; } };

  send(first, { type: 'ensure', id: 1, clientId: 'first-client' });
  send(second, { type: 'ensure', id: 2, clientId: 'second-client' });
  assert.equal(context.state.loadClients.size, 2, 'both live load owners must be registered');
  assert.equal(context.clients.size, 2, 'both live ports must be registered');

  send(first, { type: 'disconnect', clientId: 'first-client' });
  assert.equal(context.clients.size, 1, 'first client was not retired');
  assert.equal(context.state.loadClients.size, 1, 'first load owner was not retired');
  assert.equal(aborts, 0, 'shared load was aborted while a live waiter remained');
  assert.equal(first.closed, true, 'retired SharedWorker port was not closed');
  assert.equal(second.closed, false, 'live peer was closed with retired client');

  send(second, { type: 'disconnect', clientId: 'second-client' });
  assert.equal(context.clients.size, 0, 'last client was not retired');
  assert.equal(context.state.loadClients.size, 0, 'last load owner was not retired');
  assert.equal(aborts, 1, 'orphaned model load was not aborted exactly once');
  assert.equal(second.closed, true, 'last retired SharedWorker port was not closed');

  return { aborts, clients: context.clients.size, loadClients: context.state.loadClients.size };
}

async function testQueuedSpeechRetirement() {
  const context = createWorkerContext();
  const departing = attach(context, 'departing');
  const survivor = attach(context, 'survivor');
  let releaseQueue;
  context.state.synthQueue = new Promise((resolve) => { releaseQueue = resolve; });

  send(departing, { type: 'speak', id: 11, clientId: 'departing-client', text: 'Первое задание' });
  send(departing, { type: 'speak', id: 12, clientId: 'departing-client', text: 'Второе задание' });

  const departingEntry = Array.from(context.clients.values()).find((entry) => entry.port === departing);
  const survivorEntry = Array.from(context.clients.values()).find((entry) => entry.port === survivor);
  assert.ok(departingEntry, 'departing client entry missing before retirement');
  assert.ok(survivorEntry, 'survivor entry missing before retirement');
  assert.equal(departingEntry.jobs.size, 2, 'queued jobs were not owned by departing port');
  assert.equal(survivorEntry.jobs.size, 0, 'survivor inherited another client jobs');

  const beforeTerminalCount = terminalMessages(departing).length;
  send(departing, { type: 'disconnect', clientId: 'departing-client' });
  assert.equal(context.clients.size, 1, 'disconnect did not retire only the departing client');
  assert.equal(survivor.closed, false, 'disconnect closed the surviving client');
  assert.equal(context.state.cancelledJobs.size, 2, 'all queued jobs for retired client were not cancelled');

  releaseQueue();
  await context.state.synthQueue;
  assert.equal(terminalMessages(departing).length, beforeTerminalCount, 'retired queued job emitted audio/error');
  assert.equal(context.state.cancelledJobs.size, 0, 'completed cancelled jobs leaked cancellation markers');
  assert.equal(context.clients.size, 1, 'surviving client was disturbed while retired queue drained');

  send(survivor, { type: 'disconnect', clientId: 'survivor-client' });
  return { queuedJobs: 2, survivorPreserved: true, terminalAfterRetire: 0 };
}

async function testInFlightSuppression() {
  const context = createWorkerContext();
  const departing = attach(context, 'in-flight');
  context.state.ready = true;
  context.state.config = { model_type: '', inference: {} };
  context.state.dic = new Map();
  context.state.tok = null;

  context.self.ort = {
    Tensor: function Tensor(type, data, dims) {
      this.type = type;
      this.data = data;
      this.dims = dims;
    },
  };
  context.self.VoskTTSCore = {
    normalizeText: (value) => String(value || '').trim(),
    g2pNoembed: () => [1, 2, 3],
    floatToInt16: () => new Int16Array([1, 2, 3, 4]),
    int16ToWav: (pcm) => new Uint8Array(pcm.buffer.slice(0)),
  };

  let resolveRun;
  let markRunStarted;
  const runStarted = new Promise((resolve) => { markRunStarted = resolve; });
  context.state.sess = {
    inputNames: ['input', 'input_lengths', 'scales', 'sid'],
    outputNames: ['output'],
    run() {
      markRunStarted();
      return new Promise((resolve) => {
        resolveRun = () => resolve({ output: { data: new Float32Array([0.1, 0.2]) } });
      });
    },
  };

  send(departing, { type: 'speak', id: 21, clientId: 'in-flight-client', text: 'Активное задание' });
  await runStarted;
  const beforeTerminalCount = terminalMessages(departing).length;
  send(departing, { type: 'disconnect', clientId: 'in-flight-client' });
  assert.equal(context.clients.size, 0, 'in-flight client was not retired');
  assert.equal(context.state.cancelledJobs.size, 1, 'in-flight job was not marked cancelled');

  resolveRun();
  await context.state.synthQueue;
  assert.equal(terminalMessages(departing).length, beforeTerminalCount, 'retired in-flight inference emitted terminal audio/error');
  assert.equal(context.state.cancelledJobs.size, 0, 'in-flight cancellation marker leaked after settlement');

  return { inFlightSuppressed: true, terminalAfterRetire: 0 };
}

(async () => {
  const report = {
    loadRetirement: await testLoadRetirement(),
    queuedSpeechRetirement: await testQueuedSpeechRetirement(),
    inFlightSuppression: await testInFlightSuppression(),
  };
  fs.writeFileSync(path.join(REPORTS, 'tts-sharedworker-client-lifecycle-contract.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log('[TTS-SHAREDWORKER-LIFECYCLE]', JSON.stringify(report));
  console.log('SharedWorker client lifecycle source contract: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});