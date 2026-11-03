(function () {
'use strict';
var VERSION = 2;
var WORKER_SRC = '/js/vosk-tts-worker.js?v=fd24d222';
// A shared worker cannot answer a new client while it is inside one inference.
// Documents therefore read the worker's "sessions parsed and live" flag from
// IndexedDB instead of waiting for the worker's event loop.
var READY_MARKER_URL = '/__gb-vosk-sessions-ready';
var READY_MARKER_TTL_MS = 600000;
var NOTICE_CSS_URL = '/css/tts-download-notice.css?v=b9ef192f';
var MODEL_DOWNLOAD_OPTOUT_KEY = 'gbx-vosk-warmup';
var CLIENT_ID = (window.crypto && typeof window.crypto.randomUUID === 'function')
? window.crypto.randomUUID()
: 'gb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
if (window.VoskTTSEngine && window.VoskTTSEngine.version === VERSION) return;
var state = {
worker: null,
workerMode: null,
heartbeatTimer: 0,
ready: false,
loading: null,
loadSequence: 0,
speakSequence: 0,
disconnectSequence: 0,
loadRequests: new Map(),
speakRequests: new Map(),
cacheRequests: new Map(),
cacheSequence: 0,
cacheProbe: null,
disconnectRequests: new Map(),
workerTimeline: [],
clientTimeline: [],
retirementPromise: null,
audio: null,
audioHandleId: null,
objectUrl: null,
notice: null,
noticeTimer: 0,
status: { phase: 'idle', ready: false, loading: false, optedOut: false, workerMode: null },
readySource: null
};
function modelDownloadOptedOut() {
try { return localStorage.getItem(MODEL_DOWNLOAD_OPTOUT_KEY) === 'off'; }
catch (_) { return false; }
}
function setModelDownloadOptOut(disabled) {
try {
if (disabled) localStorage.setItem(MODEL_DOWNLOAD_OPTOUT_KEY, 'off');
else localStorage.removeItem(MODEL_DOWNLOAD_OPTOUT_KEY);
} catch (_) {}
}
function createError(payload, fallback) {
var error;
var message = payload && payload.message ? payload.message : fallback || 'Vosk worker failed';
try {
error = payload && payload.name === 'AbortError'
? new DOMException(message, 'AbortError')
: new Error(message);
} catch (_) {
error = new Error(message);
if (payload && payload.name) error.name = payload.name;
}
if (payload && payload.name && error.name !== payload.name) {
try { error.name = payload.name; } catch (_) {}
}
if (payload && payload.userCancelled) error.userCancelled = true;
return error;
}
function createCancelledError(message) {
return createError({ name: 'AbortError', message: message || 'enhanced voice cancelled', userCancelled: true });
}
function normalizeContextText(value) {
return String(value || '').replace(/(^|[^А-Яа-яЁё])Господа(?=$|[^А-Яа-яЁё])/g, '$1Г+оспода');
}
// Bounded, timestamped breadcrumbs: a red real-model run can otherwise only say
// "it took 29 s", never which side of the port the delay came from.
function markTimeline(list, entry) {
if (list.length >= 60) list.shift();
list.push(entry);
return list;
}
function dispatchStatus(phase, detail) {
var next = Object.assign({
phase: phase,
ready: !!state.ready,
loading: !!state.loading,
optedOut: modelDownloadOptedOut(),
workerMode: state.workerMode
}, detail || {});
state.status = next;
markTimeline(state.clientTimeline, { at: Math.round(performance.now()), phase: phase, ready: next.ready, loading: next.loading });
try { window.dispatchEvent(new CustomEvent('gb:vosk-status', { detail: next })); } catch (_) {}
return next;
}
function getStatus() {
return Object.assign({}, state.status, {
ready: !!state.ready,
loading: !!state.loading,
optedOut: modelDownloadOptedOut(),
workerMode: state.workerMode,
readySource: state.readySource || null,
workerClients: typeof state.workerClients === 'number' ? state.workerClients : null,
workerEpoch: typeof state.workerEpoch === 'number' ? state.workerEpoch : null,
workerTimeline: state.workerTimeline.slice(-30),
clientTimeline: state.clientTimeline.slice(-30)
});
}
function ensureNoticeStyles() {
if (document.querySelector('link[data-gb-tts-download-notice]')) return;
var link = document.createElement('link');
link.rel = 'stylesheet';
link.href = NOTICE_CSS_URL;
link.setAttribute('data-gb-tts-download-notice', 'true');
document.head.appendChild(link);
}
function setNoticeAction(element, mode, label, ariaLabel) {
var action = element.querySelector('.gb-tts-download-notice__action');
if (!action) return;
action.hidden = !mode;
action.dataset.action = mode || '';
action.textContent = label || '';
action.setAttribute('aria-label', ariaLabel || label || '');
}
function bindNoticeAction(element) {
var action = element && element.querySelector('.gb-tts-download-notice__action');
if (!action || action.dataset.gbTtsActionBound === 'true') return;
action.dataset.gbTtsActionBound = 'true';
action.addEventListener('click', function () {
var mode = action.dataset.action || '';
if (mode === 'cancel') {
cancelLoading({ persist: true });
return;
}
if (mode === 'switch') {
var switchDetail = { handled: false };
try { window.dispatchEvent(new CustomEvent('gb:vosk-switch-request', { detail: switchDetail })); } catch (_) {}
return;
}
if (mode === 'retry' || mode === 'enable' || mode === 'manual') {
var retryDetail = { mode: mode, handled: false };
try { window.dispatchEvent(new CustomEvent('gb:vosk-retry-request', { detail: retryDetail })); } catch (_) {}
if (!retryDetail.handled) void retryLoading({ clearOptOut: true });
}
});
}
function getNotice() {
if (state.notice && document.documentElement.contains(state.notice)) return state.notice;
var existing = document.querySelector('.gb-tts-download-notice');
if (existing) {
state.notice = existing;
bindNoticeAction(existing);
return existing;
}
var element = document.createElement('div');
element.className = 'gb-tts-download-notice';
element.setAttribute('role', 'status');
element.setAttribute('aria-live', 'polite');
element.setAttribute('aria-atomic', 'true');
element.innerHTML =
'<span class="gb-tts-download-notice__icon" aria-hidden="true"></span>' +
'<span class="gb-tts-download-notice__copy">' +
'<strong class="gb-tts-download-notice__title"></strong>' +
'<span class="gb-tts-download-notice__meta"></span>' +
'</span>' +
'<button class="gb-tts-download-notice__action" type="button" hidden></button>';
document.body.appendChild(element);
state.notice = element;
bindNoticeAction(element);
return element;
}
function hideNotice(delay) {
clearTimeout(state.noticeTimer);
state.noticeTimer = setTimeout(function () {
if (!state.notice) return;
state.notice.classList.remove('is-visible');
var doomed = state.notice;
setTimeout(function () {
if (doomed.parentNode) doomed.parentNode.removeChild(doomed);
if (state.notice === doomed) state.notice = null;
}, 360);
}, Math.max(0, Number(delay) || 0));
}
function showStatus(name, options) {
options = options || {};
ensureNoticeStyles();
clearTimeout(state.noticeTimer);
var element = getNotice();
var title = '';
var meta = '';
var action = null;
var actionLabel = '';
var actionAria = '';
var stateName = name;
if (name === 'browser') {
title = 'Сейчас системный голос';
meta = 'Улучшенный голос проверяется в фоне';
} else if (name === 'preparing' || name === 'dependencies-ready' || name === 'connected') {
stateName = 'preparing';
title = 'Проверяем улучшенный голос';
meta = 'Системный голос уже работает';
} else if (name === 'loading') {
title = 'Улучшенный голос загружается';
meta = 'Системный голос уже работает · около 280 МБ';
action = 'cancel';
actionLabel = 'Не загружать';
actionAria = 'Остановить загрузку улучшенного голоса';
} else if (name === 'verifying') {
stateName = 'initializing';
title = 'Проверяем модель';
meta = 'Контроль целостности выполняется локально';
} else if (name === 'extracting') {
stateName = 'initializing';
title = 'Распаковываем улучшенный голос';
meta = 'Работа выполняется вне основного потока';
} else if (name === 'cache-hit') {
stateName = 'initializing';
title = 'Улучшенный голос найден';
meta = 'Запускаем сохранённую модель';
} else if (name === 'initializing') {
title = 'Запускаем улучшенный голос';
meta = 'Создаём голосовые сессии в фоновом потоке';
} else if (name === 'ready' || name === 'success') {
stateName = 'ready';
title = 'Улучшенный голос готов';
meta = state.workerMode === 'shared'
? 'Готов между страницами · можно включить сейчас'
: 'Можно включить без перезагрузки страницы';
action = 'switch';
actionLabel = 'Включить сейчас';
actionAria = 'Перейти на улучшенный голос с текущего места';
} else if (name === 'selected') {
title = 'Работает улучшенный голос';
meta = 'Локальная модель · текст никуда не отправляется';
} else if (name === 'disabled') {
title = 'Улучшенный голос отключён';
meta = 'Сейчас используется системный голос';
action = 'enable';
actionLabel = 'Включить';
actionAria = 'Снова разрешить загрузку улучшенного голоса';
} else if (name === 'save-data') {
title = 'Включена экономия трафика';
meta = 'Системный голос работает · модель около 280 МБ';
action = 'manual';
actionLabel = 'Загрузить';
actionAria = 'Загрузить улучшенный голос несмотря на экономию трафика';
} else if (name === 'cancelled') {
title = 'Загрузка остановлена';
meta = 'Системный голос продолжает работать';
} else if (name === 'cache-unavailable') {
stateName = 'initializing';
title = 'Хранилище браузера недоступно';
meta = 'Голос работает в текущей вкладке без постоянного кэша';
} else {
stateName = 'error';
title = 'Улучшенный голос не запустился';
meta = 'Системный голос продолжает работать';
action = 'retry';
actionLabel = 'Повторить';
actionAria = 'Повторить запуск улучшенного голоса';
}
if (options.title) title = options.title;
if (options.meta) meta = options.meta;
if (options.actionMode !== undefined) action = options.actionMode;
if (options.actionLabel !== undefined) actionLabel = options.actionLabel;
if (options.actionAria !== undefined) actionAria = options.actionAria;
element.dataset.state = stateName;
var titleNode = element.querySelector('.gb-tts-download-notice__title');
var metaNode = element.querySelector('.gb-tts-download-notice__meta');
if (titleNode) titleNode.textContent = title;
if (metaNode) metaNode.textContent = meta;
setNoticeAction(element, action, actionLabel, actionAria);
element.classList.add('is-visible');
dispatchStatus(stateName, {
title: title,
message: meta,
action: action,
reason: options.reason || null
});
if (options.autoHide) hideNotice(options.autoHide);
return element;
}
function finishStatus(name) {
var autoHide = name === 'selected' ? 1800 : name === 'cancelled' ? 1900 : 0;
return showStatus(name, { autoHide: autoHide });
}
function getAudio() {
if (state.audio && state.audio.isConnected) return state.audio;
var audio = document.createElement('audio');
audio.hidden = true;
audio.preload = 'auto';
audio.setAttribute('data-gb-vosk-audio', 'true');
document.body.appendChild(audio);
state.audio = audio;
return audio;
}
function revokeObjectUrl() {
if (!state.objectUrl) return;
try { URL.revokeObjectURL(state.objectUrl); } catch (_) {}
state.objectUrl = null;
}
function stopAudio() {
var audio = state.audio;
if (audio) {
try {
audio.pause();
audio.removeAttribute('src');
audio.load();
} catch (_) {}
}
state.audioHandleId = null;
revokeObjectUrl();
}
function settleLoad(id, error) {
var pending = state.loadRequests.get(id);
if (!pending) return;
state.loadRequests.delete(id);
if (error) pending.reject(error);
else pending.resolve(true);
}
function settleAllLoads(error) {
Array.from(state.loadRequests.keys()).forEach(function (id) { settleLoad(id, error); });
}
function failSpeak(id, error) {
var entry = state.speakRequests.get(id);
if (!entry) return;
state.speakRequests.delete(id);
if (entry.blobUrl) {
try { URL.revokeObjectURL(entry.blobUrl); } catch (_) {}
entry.blobUrl = null;
}
if (!entry.handle.cancelled && typeof entry.onerror === 'function') entry.onerror(error);
}
function failAllSpeaks(error) {
Array.from(state.speakRequests.keys()).forEach(function (id) { failSpeak(id, error); });
}
function clearWorkerState(error) {
if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
state.heartbeatTimer = 0;
state.worker = null;
state.workerMode = null;
state.ready = false;
state.loading = null;
if (error) {
settleAllLoads(error);
failAllSpeaks(error);
}
}
function terminateWorker(error) {
var worker = state.worker;
if (worker) {
try { worker.terminate(); } catch (_) {}
}
clearWorkerState(error);
}
function retireWorker(reason) {
if (state.retirementPromise) return state.retirementPromise;
var error = createCancelledError(reason || 'document lifetime ended');
stopAudio();
state.speakRequests.forEach(function (entry) { entry.handle.cancelled = true; });
if (!state.worker) {
clearWorkerState(error);
return Promise.resolve(true);
}
if (state.workerMode !== 'shared') {
terminateWorker(error);
return Promise.resolve(true);
}
var channel = state.worker;
var id = ++state.disconnectSequence;
state.retirementPromise = new Promise(function (resolve) {
var settled = false;
var timer = setTimeout(function () {
if (settled) return;
settled = true;
state.disconnectRequests.delete(id);
resolve(false);
}, 300);
state.disconnectRequests.set(id, function () {
if (settled) return;
settled = true;
clearTimeout(timer);
state.disconnectRequests.delete(id);
resolve(true);
});
try {
channel.postMessage({ type: 'disconnect', clientId: CLIENT_ID, id: id });
} catch (_) {
clearTimeout(timer);
state.disconnectRequests.delete(id);
settled = true;
resolve(false);
}
}).finally(function () {
if (state.worker === channel) clearWorkerState(error);
state.retirementPromise = null;
});
return state.retirementPromise;
}
function retireDocumentClient() {
void retireWorker('document lifetime ended');
}
function startEntryPlayback(id, entry) {
if (!entry || entry.handle.cancelled || !entry.blobUrl) return;
stopAudio();
var audio = getAudio();
state.audioHandleId = id;
state.objectUrl = entry.blobUrl;
entry.blobUrl = null;
audio.src = state.objectUrl;
audio.playbackRate = 1;
audio.onended = function () {
var current = state.speakRequests.get(id);
state.speakRequests.delete(id);
state.audioHandleId = null;
revokeObjectUrl();
if (current && !current.handle.cancelled && typeof current.onend === 'function') current.onend();
};
audio.onerror = function (event) {
failSpeak(id, event instanceof Error ? event : new Error('Vosk audio playback failed'));
};
try {
var playback = audio.play();
if (playback && playback.catch) playback.catch(function (error) { failSpeak(id, error); });
} catch (error) {
failSpeak(id, error);
}
}
function handleWorkerMessage(message) {
var type = message.type;
if (type === 'disconnected') {
var disconnect = state.disconnectRequests.get(message.id);
if (disconnect) disconnect();
return;
}
if (type === 'status') {
if (message.phase === 'ready') state.ready = true;
if (typeof message.clients === 'number') state.workerClients = message.clients;
if (typeof message.epoch === 'number') state.workerEpoch = message.epoch;
markTimeline(state.workerTimeline, {
at: Math.round(performance.now()),
phase: message.phase || null,
ready: message.ready === true,
clients: typeof message.clients === 'number' ? message.clients : null,
reason: message.reason || null
});
if (!anyQuietLoad()) {
showStatus(message.phase || 'preparing', {
reason: message.reason || null,
meta: message.message || undefined
});
}
return;
}
if (type === 'ready') {
var quietReady = anyQuietLoad();
state.ready = true;
settleLoad(message.id);
if (!quietReady) finishStatus('ready');
return;
}
if (type === 'load-error') {
var loadError = createError(message, 'Vosk model failed to load');
state.ready = false;
state.readySource = null;
var quietError = anyQuietLoad();
settleLoad(message.id, loadError);
if (quietError) return;
if (loadError.name === 'AbortError') finishStatus('cancelled');
else showStatus('error', { reason: loadError.message });
return;
}
if (type === 'cache-status') {
var cacheResolve = state.cacheRequests.get(message.id);
if (!cacheResolve) return;
state.cacheRequests.delete(message.id);
cacheResolve(!!message.cached);
return;
}
if (type === 'synth-progress') {
try {
window.dispatchEvent(new CustomEvent('gb:vosk-synthesis-progress', {
detail: { id: message.id, value: Math.max(0, Math.min(1, Number(message.value) || 0)) }
}));
} catch (_) {}
return;
}
if (type === 'audio') {
var entry = state.speakRequests.get(message.id);
if (!entry || entry.handle.cancelled) return;
if (entry.blobUrl) {
try { URL.revokeObjectURL(entry.blobUrl); } catch (_) {}
}
entry.blobUrl = URL.createObjectURL(new Blob([message.wav], { type: 'audio/wav' }));
entry.ready = true;
// A prefetched fragment is synthesized ahead of time but must never interrupt
// the fragment that is already audible. It waits for an explicit play(handle).
if (!entry.playRequested) return;
startEntryPlayback(message.id, entry);
return;
}
if (type === 'synth-error') {
failSpeak(message.id, createError(message, 'Vosk synthesis failed'));
return;
}
if (type === 'warning') {
console.warn('[vosk-tts-worker]', message.message || message);
}
}
function bindWorker(raw, port, mode) {
var channel = {
raw: raw,
port: port,
mode: mode,
postMessage: function (message) { port.postMessage(message); },
terminate: function () {
if (mode === 'shared') {
try { port.postMessage({ type: 'disconnect', clientId: CLIENT_ID }); } catch (_) {}
} else {
try { raw.terminate(); } catch (_) {}
}
}
};
port.onmessage = function (event) { handleWorkerMessage(event.data || {}); };
port.onmessageerror = function () {
var error = new Error('Persistent Vosk worker returned an unreadable message');
showStatus('error', { reason: error.message });
terminateWorker(error);
};
if (mode === 'shared' && typeof port.start === 'function') port.start();
raw.onerror = function (event) {
var error = new Error(event.message || 'Persistent Vosk worker crashed');
console.error('[VoskTTSEngine]', error);
showStatus('error', { reason: error.message });
terminateWorker(error);
};
state.workerMode = mode;
state.worker = channel;
channel.postMessage({ type: 'hello', clientId: CLIENT_ID });
if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
state.heartbeatTimer = setInterval(function () {
if (!state.worker) return;
try { state.worker.postMessage({ type: 'ping', clientId: CLIENT_ID }); } catch (_) {}
}, 30000);
return channel;
}
function ensureWorker() {
if (state.worker) return state.worker;
if (!isSupported()) throw new Error('Persistent Vosk worker is not supported by this browser');
if (typeof SharedWorker === 'function') {
try {
var shared = new SharedWorker(WORKER_SRC, 'gb-vosk-tts');
return bindWorker(shared, shared.port, 'shared');
} catch (error) {
console.warn('[VoskTTSEngine] SharedWorker unavailable; using dedicated worker', error);
}
}
var dedicated = new Worker(WORKER_SRC, { name: 'gb-vosk-tts' });
return bindWorker(dedicated, dedicated, 'dedicated');
}
function isSupported() {
return (typeof SharedWorker === 'function' || typeof Worker === 'function')
&& !!window.indexedDB
&& !!window.WebAssembly
&& typeof window.fetch === 'function'
&& typeof window.TextDecoder === 'function';
}
function isReady() {
return !!state.ready;
}
function send(message) {
message.clientId = CLIENT_ID;
ensureWorker().postMessage(message);
}
function anyQuietLoad() {
var quiet = false;
state.loadRequests.forEach(function (entry) { if (entry.quiet) quiet = true; });
return quiet;
}
function readReadyMarker() {
// Cache Storage, not IndexedDB: the model store is owned by the worker, and the
// main thread must never open it (see the engine status contract).
if (typeof caches === 'undefined' || typeof caches.match !== 'function') return Promise.resolve(false);
return new Promise(function (resolve) {
var settled = false;
var timer = setTimeout(function () { finish(false); }, 800);
function finish(value) {
if (settled) return;
settled = true;
clearTimeout(timer);
resolve(value === true);
}
try {
caches.match(READY_MARKER_URL).then(function (response) {
if (!response) { finish(false); return null; }
return response.json().then(function (value) {
finish(!!value && value.ready === true && typeof value.at === 'number' && Date.now() - value.at < READY_MARKER_TTL_MS);
}, function () { finish(false); });
}).catch(function () { finish(false); });
} catch (_) { finish(false); }
});
}
function adoptReadyMarker(id, quiet) {
readReadyMarker().then(function (ready) {
if (!ready || state.ready) return;
state.ready = true;
state.readySource = 'marker';
settleLoad(id);
if (!quiet && !anyQuietLoad()) finishStatus('ready');
}).catch(function () {});
}
function ensureLoaded(options) {
options = options || {};
var quiet = options.quiet === true;
if (state.ready) return Promise.resolve(true);
if (modelDownloadOptedOut()) {
if (!quiet) showStatus('disabled', { reason: 'optout' });
return Promise.reject(createCancelledError('enhanced voice download disabled by user'));
}
if (state.loading) return state.loading;
var id = ++state.loadSequence;
if (!quiet) showStatus('preparing');
state.loading = new Promise(function (resolve, reject) {
state.loadRequests.set(id, { resolve: resolve, reject: reject, quiet: quiet });
try { send({ type: 'ensure', id: id }); }
catch (error) {
state.loadRequests.delete(id);
reject(error);
}
}).finally(function () {
state.loading = null;
});
if (state.workerMode === 'shared') adoptReadyMarker(id, quiet);
return state.loading;
}
function clearModelDownloadOptOut() {
setModelDownloadOptOut(false);
dispatchStatus('enabled');
}
function retryLoading(options) {
options = options || {};
if (options.clearOptOut !== false) clearModelDownloadOptOut();
if (!state.worker && state.loading) state.loading = null;
return ensureLoaded({ quiet: options.quiet === true });
}
function cancelLoading(options) {
var persist = !options || options.persist !== false;
if (persist) setModelDownloadOptOut(true);
var error = createCancelledError('enhanced voice download cancelled by user');
if (state.worker) {
try { send({ type: 'cancel-load' }); } catch (_) {}
}
terminateWorker(error);
finishStatus('cancelled');
try { window.dispatchEvent(new CustomEvent('gb:vosk-model-download-cancelled')); } catch (_) {}
return true;
}
function speak(text, rate, speakerId, onend, onerror, options) {
options = options || {};
var id = ++state.speakSequence;
var deferred = options.defer === true;
var handle = { engine: 'vosk', id: id, cancelled: false, deferred: deferred };
state.speakRequests.set(id, {
handle: handle,
onend: onend,
onerror: onerror,
deferred: deferred,
playRequested: !deferred,
ready: false,
blobUrl: null
});
try {
send({
type: 'speak',
id: id,
text: normalizeContextText(String(text || '')),
rate: Number(rate) || 1,
speakerId: Number(speakerId) || 0
});
} catch (error) {
failSpeak(id, error);
}
return handle;
}
// Starts (or schedules) playback of a fragment produced by speak(..., {defer:true}).
// If synthesis is still running, playback begins as soon as the worker delivers
// the audio, with these callbacks. Returns false when the handle is unknown.
function play(handle, onend, onerror) {
var id = handle && handle.id;
var entry = id ? state.speakRequests.get(id) : null;
if (!entry || entry.handle.cancelled) return false;
if (typeof onend === 'function') entry.onend = onend;
if (typeof onerror === 'function') entry.onerror = onerror;
entry.playRequested = true;
if (entry.ready) startEntryPlayback(id, entry);
return true;
}
function isPrepared(handle) {
var id = handle && handle.id;
var entry = id ? state.speakRequests.get(id) : null;
return !!(entry && entry.ready && !entry.handle.cancelled);
}
function cancel(handle) {
if (handle) handle.cancelled = true;
var id = handle && handle.id;
if (id && state.worker) {
try { send({ type: 'cancel', id: id }); } catch (_) {}
}
if (id) {
var entry = state.speakRequests.get(id);
if (entry && entry.blobUrl) {
try { URL.revokeObjectURL(entry.blobUrl); } catch (_) {}
}
state.speakRequests.delete(id);
}
if (!id || state.audioHandleId === id) stopAudio();
}
// Cheap cache probe: the Worker owns the IndexedDB model store, so ask it
// whether the archive key exists without reading the ~280 MB value or
// triggering a download. Used to warm a model that is already on disk without
// touching the network.
function hasCachedModel() {
if (state.ready) return Promise.resolve(true);
if (state.cacheProbe) return state.cacheProbe;
state.cacheProbe = new Promise(function (resolve) {
var id = ++state.cacheSequence;
var settled = false;
function finish(value) {
if (settled) return;
settled = true;
state.cacheRequests.delete(id);
resolve(value);
}
state.cacheRequests.set(id, finish);
try { send({ type: 'cache-status', id: id }); }
catch (_) { finish(false); return; }
setTimeout(function () { finish(false); }, 5000);
}).finally(function () { state.cacheProbe = null; });
return state.cacheProbe;
}
window.addEventListener('pagehide', retireDocumentClient);
window.VoskTTSEngine = Object.freeze({
version: VERSION,
isSupported: isSupported,
isReady: isReady,
getStatus: getStatus,
showStatus: showStatus,
ensureLoaded: ensureLoaded,
retryLoading: retryLoading,
clearModelDownloadOptOut: clearModelDownloadOptOut,
cancelLoading: cancelLoading,
retire: retireWorker,
hasCachedModel: hasCachedModel,
speak: speak,
play: play,
isPrepared: isPrepared,
cancel: cancel
});
})();
