#!/usr/bin/env node
/** Pure test-driver fixtures; no server, browser, repository source or refs written. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createVerifiedArtifactTransport } from './lib/acceptance-artifact-transport.mjs';

const ORIGIN = 'https://candidate.invalid', BYTES = Buffer.from('exact artifact bytes');
const tick = () => new Promise(setImmediate);
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function routeFixture({ url = ORIGIN + '/css/reader.css', type = 'stylesheet', status = 200, bytes = BYTES, body, fetchError, abortError } = {}) {
  const calls = [], response = { status: () => status, body: async () => body ? body : bytes };
  return { calls, route: {
    request: () => ({ url: () => url, resourceType: () => type }),
    fetch: async (options) => { calls.push(['fetch', options]); if (fetchError) throw fetchError; return response; },
    fulfill: async (options) => { calls.push(['fulfill', options]); },
    abort: async () => { calls.push(['abort']); if (abortError) throw abortError; },
    continue: async () => { calls.push(['continue']); },
  } };
}
function fixture({ concurrency = 6, onPin } = {}) {
  const pins = [], errors = [];
  let handler;
  const options = { origin: ORIGIN, concurrency,
    readArtifact: (name) => { assert.equal(name, 'css/reader.css'); return BYTES; },
    onPin: (pin) => { pins.push(pin); onPin?.(pin); }, onError: (error) => errors.push(error) };
  const transport = createVerifiedArtifactTransport(options);
  const context = { route: async (pattern, callback) => { assert.equal(pattern, '**/*'); handler = callback; },
    on: () => { throw Error('CDP/page-response listener must not be used'); } };
  return { transport, pins, errors, options, context, handle: (route) => handler(route) };
}

test('both opt-in runners install/drain the common HTTP transport, never page response.body capture', () => {
  for (const file of ['journal-integrator-acceptance.mjs', 'articles-catalog-coverage.mjs']) {
    const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /createVerifiedArtifactTransport/);
    assert.match(source, /transport\.install\(/); assert.match(source, /transport\.drain\(/);
    assert.doesNotMatch(source, /\.on\(['"]response['"]/);
    assert.doesNotMatch(source, /response\.body\(/);
  }
});
test('in-flight HTTP API bytes are pinned before fulfill and drained before context disposal', async () => {
  const f = fixture(), body = deferred(), asset = routeFixture({ body: body.promise });
  await f.transport.install(f.context, 'journal-390-dark');
  const handled = f.handle(asset.route); assert.equal(f.transport.pending, 1);
  let drained = false;
  const drain = f.transport.drain().then(() => { drained = true; });
  await tick(); assert.equal(drained, false); assert.equal(f.pins.length, 0);
  body.resolve(BYTES); await handled; await drain;
  assert.equal(f.transport.pending, 0); assert.equal(f.errors.length, 0); assert.equal(f.pins.length, 1);
  assert.deepEqual(asset.calls.map((c) => c[0]), ['fetch', 'fulfill']);
  assert.deepEqual(asset.calls[0][1], { timeout: 15000, maxRedirects: 0 });
  assert.deepEqual(asset.calls[1][1].body, BYTES);
});
test('controller actually applies FIFO concurrency to all installed request handlers', async () => {
  const f = fixture({ concurrency: 2 }), gates = Array.from({ length: 4 }, deferred);
  const assets = gates.map((g, i) => routeFixture({ url: ORIGIN + `/css/reader.css?i=${i}`, body: g.promise }));
  await f.transport.install(f.context, 'catalog-no-js');
  const handled = assets.map((a) => f.handle(a.route));
  assert.equal(f.transport.pending, 4);
  assert.deepEqual(assets.map((a) => a.calls.length), [1, 1, 0, 0]);
  for (const [i, gate] of gates.entries()) {
    gate.resolve(BYTES); await tick();
    if (i === 0) assert.equal(assets[2].calls[0][0], 'fetch');
  }
  await Promise.all(handled); await f.transport.drain();
  assert.equal(f.transport.pending, 0); assert.equal(f.pins.length, 4); assert.equal(f.errors.length, 0);
});
test('HTTP200 with a different body is reported once with exact label/URL and never fulfilled', async () => {
  const f = fixture(), asset = routeFixture({ bytes: Buffer.from('wrong artifact') });
  await f.transport.install(f.context, 'dossier-1440-light');
  await f.handle(asset.route); await f.transport.drain();
  assert.equal(f.errors.length, 1); assert.equal(f.errors[0].label, 'dossier-1440-light');
  assert.equal(f.errors[0].url, ORIGIN + '/css/reader.css');
  assert.match(f.errors[0].error.message, /Served asset differs/);
  assert.deepEqual(asset.calls.map((c) => c[0]), ['fetch', 'abort']); assert.equal(f.pins.length, 0);
});
for (const status of [404, 302]) test(`HTTP${status} cannot become an artifact pin or a silently followed redirect`, async () => {
  const f = fixture(), asset = routeFixture({ status }); await f.transport.install(f.context, 'negative-http');
  await f.handle(asset.route); await f.transport.drain();
  assert.equal(f.errors.length, 1); assert.match(f.errors[0].error.message, /Asset HTTP failure/);
  assert.equal(f.pins.length, 0); assert.equal(asset.calls.some((c) => c[0] === 'fulfill'), false);
});
test('a timeout remains the original failure even if abort also fails after disposal', async () => {
  const original = new Error('synthetic API fetch timed out');
  const f = fixture(), asset = routeFixture({ fetchError: original, abortError: new Error('context already disposed') });
  await f.transport.install(f.context, 'direct-source-load'); await f.handle(asset.route); await f.transport.drain();
  assert.equal(f.errors.length, 1); assert.equal(f.errors[0].error, original); assert.equal(f.pins.length, 0);
  assert.equal(f.transport.pending, 0);
});
test('external requests are blocked and HTML navigation remains native, not synthesized asset evidence', async () => {
  const f = fixture(); await f.transport.install(f.context, 'native-navigation');
  for (const [input, expected] of [[{ url: 'https://analytics.invalid/pixel' }, 'abort'], [{ type: 'document' }, 'continue']]) {
    const asset = routeFixture(input); await f.handle(asset.route);
    assert.deepEqual(asset.calls.map((c) => c[0]), [expected]);
  }
  await f.transport.drain(); assert.equal(f.pins.length, 0); assert.equal(f.errors.length, 0);
});
test('drain also waits for a request queued during completion of its initial snapshot', async () => {
  const late = deferred(), first = deferred(); let secondHandled;
  const secondAsset = routeFixture({ url: ORIGIN + '/css/reader.css?phase=second', body: late.promise });
  const f = fixture({ onPin: (pin) => { if (pin.url.endsWith('phase=first')) secondHandled = f.handle(secondAsset.route); } });
  await f.transport.install(f.context, 'completion-race');
  const firstHandled = f.handle(routeFixture({ url: ORIGIN + '/css/reader.css?phase=first', body: first.promise }).route);
  let drained = false;
  const drain = f.transport.drain().then(() => { drained = true; });
  first.resolve(BYTES); await tick(); assert.ok(secondHandled); assert.equal(drained, false);
  assert.equal(f.transport.pending, 1); late.resolve(BYTES);
  await Promise.all([firstHandled, secondHandled, drain]); assert.equal(f.pins.length, 2); assert.equal(f.errors.length, 0);
});
test('drain itself is bounded and fails closed instead of hanging or returning a false zero', async () => {
  const f = fixture(), body = deferred(); await f.transport.install(f.context, 'stalled-api');
  const handled = f.handle(routeFixture({ body: body.promise }).route);
  await assert.rejects(() => f.transport.drain({ timeout: 5 }), /drain timed out with 1 pending/);
  assert.equal(f.transport.pending, 1); body.resolve(BYTES); await handled; await f.transport.drain();
  assert.equal(f.transport.pending, 0);
  await assert.rejects(() => f.transport.drain({ timeout: 0 }), /Positive drain timeout/);
});
test('unsafe configuration or installing a second capture owner fails before navigation', async () => {
  const f = fixture();
  for (const origin of ['about:blank', 'https://candidate.invalid/', 'https://user:password@candidate.invalid']) assert.throws(() => createVerifiedArtifactTransport({ ...f.options, origin }));
  for (const key of ['readArtifact', 'onPin', 'onError']) assert.throws(() => createVerifiedArtifactTransport({ ...f.options, [key]: null }));
  await f.transport.install(f.context, 'once'); await assert.rejects(() => f.transport.install(f.context, 'twice'), /already installed/);
});
