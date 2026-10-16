'use strict';

// Единый классификатор внешнего сетевого шума для браузерных гейтов.
//
// Зачем модуль: контракт главной страницы (scripts/home-browser-contract.mjs)
// собирал ошибки рантайма сам и падал на «Failed to load resource:
// net::ERR_CERT_AUTHORITY_INVALID» из CI, где запрос к Метрике (mc.yandex.ru)
// не проходит из-за egress-фильтра раннера. Это шум внешней телеметрии, а не
// дефект сайта, и в репозитории уже был свой классификатор — в
// scripts/home-progressive-enhancement-browser-test.js. Теперь он один, здесь,
// и используется браузерными контрактами главной страницы.
//
// Принципы (ничего не глушится «по тексту ошибки»):
// 1. Анонимное консольное «Failed to load resource» НЕ судится по тексту (в нём
//    нет URL) — оно передаётся структурным событиям page.on('response') и
//    page.on('requestfailed'), где URL есть. Там отсеивается только внешняя
//    телеметрия (Метрика), а same-origin и ошибки приложения остаются
//    фатальными.
// 2. Отдельный подтверждённый случай (scripts/home-browser-lifecycle-contract.mjs):
//    Chromium отдаёт net::ERR_ABORTED для HEAD-пробы Pagefind уже ПОСЛЕ того,
//    как успешный ответ (200) предъявлен fetch(). Исключение привязывается к
//    конкретному объекту запроса с успешным ответом — по одному тексту ошибки
//    ничего не прощается.

const assert = require('node:assert/strict');

function isExternalTelemetryNetworkNoise(text) {
  const value = String(text || '');
  const yandexTelemetryHost = /(?:https?|wss):\/\/(?:(?:[^/\s'"]+\.)?mc\.yandex\.(?:com|ru)|(?:hdrc|mdd)\.yandex\.net)(?:[/:]|$)/i.test(value);
  const networkFailure = /(?:WebSocket connection|Failed to load resource|net::ERR_|handshake|response code:\s*[45]\d\d|status(?: code)?[=:]?\s*[45]\d\d|HTTP\s+[45]\d\d|REQUEST\s)/i.test(value);
  return yandexTelemetryHost && networkFailure;
}

function isGenericResourceConsoleError(text) {
  return /^Failed to load resource:/i.test(String(text || '').trim());
}

function createSuccessfulHeadRegistry() {
  const successfulHeadResponses = new WeakSet();
  return {
    noteResponse(response) {
      const request = response.request();
      if (request.method() === 'HEAD' && response.status() < 400) successfulHeadResponses.add(request);
    },
    isKnownSuccessfulHeadAbort(request) {
      const failure = request.failure();
      return request.method() === 'HEAD'
        && failure?.errorText === 'net::ERR_ABORTED'
        && successfulHeadResponses.has(request);
    },
  };
}

function monitorRuntime(page, bucket, options = {}) {
  const isIgnoredConsole = typeof options.isIgnoredConsole === 'function' ? options.isIgnoredConsole : () => false;
  const headRegistry = createSuccessfulHeadRegistry();
  page.on('pageerror', (error) => bucket.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    headRegistry.noteResponse(response);
    if (response.status() < 400) return;
    const detail = `HTTP ${response.status()} ${response.request().resourceType()} ${response.url()}`;
    if (!isExternalTelemetryNetworkNoise(detail)) bucket.push(`response: ${detail}`);
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    const detail = `REQUEST ${(failure && failure.errorText) || 'failed'} ${request.resourceType()} ${request.url()}`;
    if (isExternalTelemetryNetworkNoise(detail)) return;
    if (headRegistry.isKnownSuccessfulHeadAbort(request)) {
      if (Array.isArray(options.clientAborts)) options.clientAborts.push(detail);
      return;
    }
    bucket.push(`requestfailed: ${detail}`);
  });
  page.on('console', (message) => {
    const text = message.text();
    if (isGenericResourceConsoleError(text)) return;
    if (isExternalTelemetryNetworkNoise(text)) return;
    if (isIgnoredConsole(text, message)) return;
    bucket.push(`console: ${text}`);
  });
}

// Самотесты: выполняются при каждом подключении модуля, поэтому ослабление
// правила ломает гейт сразу, а не молча пропускает шум или дефект.
assert.equal(isExternalTelemetryNetworkNoise('HTTP 500 image https://mc.yandex.ru/watch/123'), true,
  'structured Yandex HTTP failures must be classified as external telemetry noise');
assert.equal(isExternalTelemetryNetworkNoise('HTTP 500 script http://127.0.0.1:4321/js/app.js'), false,
  'same-origin HTTP failures must remain fatal');
assert.equal(isExternalTelemetryNetworkNoise('Uncaught TypeError: application crashed at https://mc.yandex.com/runtime.js'), false,
  'application errors must remain fatal even when text mentions Yandex');
assert.equal(isExternalTelemetryNetworkNoise('REQUEST net::ERR_CERT_AUTHORITY_INVALID xhr https://hdrc.yandex.net/'), true,
  'Yandex Metrica hdrc transport failures must be classified as external telemetry noise');
assert.equal(isExternalTelemetryNetworkNoise('REQUEST net::ERR_CERT_AUTHORITY_INVALID xhr https://mdd.yandex.net/'), true,
  'Yandex Metrica mdd transport failures must be classified as external telemetry noise');
assert.equal(isExternalTelemetryNetworkNoise('REQUEST net::ERR_CERT_AUTHORITY_INVALID xhr https://api.yandex.net/'), false,
  'unrelated yandex.net application requests must remain fatal');
assert.equal(isExternalTelemetryNetworkNoise('REQUEST net::ERR_CERT_AUTHORITY_INVALID script http://127.0.0.1:4321/pagefind/pagefind.js'), false,
  'same-origin transport failures must remain fatal');
assert.equal(isGenericResourceConsoleError('Failed to load resource: the server responded with a status of 500 ()'), true,
  'anonymous resource console failures must be delegated to structured network events');
assert.equal(isGenericResourceConsoleError('Failed to load resource: net::ERR_CERT_AUTHORITY_INVALID'), true,
  'anonymous transport console failures must be delegated to structured network events');
assert.equal(isGenericResourceConsoleError('Uncaught TypeError: Failed to load resource is not a function'), false,
  'application errors must never be delegated away');

{
  const registry = createSuccessfulHeadRegistry();
  const makeRequest = (method, errorText) => ({ method: () => method, failure: () => ({ errorText }) });
  const headOk = makeRequest('HEAD', 'net::ERR_ABORTED');
  registry.noteResponse({ request: () => headOk, status: () => 200 });
  assert.equal(registry.isKnownSuccessfulHeadAbort(headOk), true,
    'a HEAD probe with a successful response may be reported as a spurious abort');
  assert.equal(registry.isKnownSuccessfulHeadAbort(makeRequest('HEAD', 'net::ERR_ABORTED')), false,
    'a HEAD abort without a successful response must remain fatal');
  const getAbort = makeRequest('GET', 'net::ERR_ABORTED');
  registry.noteResponse({ request: () => getAbort, status: () => 200 });
  assert.equal(registry.isKnownSuccessfulHeadAbort(getAbort), false,
    'a GET abort must remain fatal even when a response was seen');
  const headTransport = makeRequest('HEAD', 'net::ERR_CONNECTION_CLOSED');
  registry.noteResponse({ request: () => headTransport, status: () => 200 });
  assert.equal(registry.isKnownSuccessfulHeadAbort(headTransport), false,
    'transport failures must remain fatal');
  const headErrorStatus = makeRequest('HEAD', 'net::ERR_ABORTED');
  registry.noteResponse({ request: () => headErrorStatus, status: () => 503 });
  assert.equal(registry.isKnownSuccessfulHeadAbort(headErrorStatus), false,
    'a HEAD abort after an error status must remain fatal');
}

module.exports = {
  isExternalTelemetryNetworkNoise,
  isGenericResourceConsoleError,
  createSuccessfulHeadRegistry,
  monitorRuntime,
};
