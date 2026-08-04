/* Persistent Vosk TTS worker.
 *
 * Owns every heavyweight operation: model download, SHA-256 verification,
 * archive extraction, IndexedDB cache access, ONNX session creation and
 * inference. The document receives only status messages and a transferable WAV
 * buffer, so neither cold start nor synthesis can block reader interaction.
 */
'use strict';

var CORE_SRC = '/js/vosk-tts-core.js';
var STRESS_LOOKUP_SRC = '/js/vosk-stress-lookup.js';
var CUSTOM_TERMS_URL = '/js/vosk-custom-terms.json';
var STRESS_MARKER_URL = '/js/vosk-stress-marker.bin';
var ORT_SRC = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort.min.js';
var FFLATE_SRC = 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js';
var MODEL_URL = 'https://huggingface.co/CurtMil/gb-vosk-tts-model/resolve/main/model-quant.zip';
var EXPECTED_MODEL_SHA256 = '34e742ce9bb3c1ae86679d5974d2496b9fae50f0629f51bb4f5edfadc5ff3d71';
var NEEDED = ['model.onnx', 'dictionary', 'config.json', 'bert/model.onnx', 'bert/vocab.txt'];
var DB_NAME = 'gb-vosk-tts';
var SAMPLE_RATE = 22050;

var state = {
  dependencies: null,
  loading: null,
  ready: false,
  config: null,
  dic: null,
  tok: null,
  sess: null,
  bertSess: null,
  stressLookup: null,
  loadController: null,
  cancelledJobs: new Set(),
  warnedUnknownModelType: false
};

function post(type, detail, transfer) {
  var payload = Object.assign({ type: type }, detail || {});
  self.postMessage(payload, transfer || []);
}

function status(phase, detail) {
  post('status', Object.assign({ phase: phase, ready: state.ready }, detail || {}));
}

function errorPayload(error) {
  return {
    name: error && error.name ? error.name : 'Error',
    message: error && error.message ? error.message : String(error || 'unknown error'),
    userCancelled: !!(error && error.userCancelled)
  };
}

function createCancelledError(message) {
  var error;
  try { error = new DOMException(message || 'cancelled', 'AbortError'); }
  catch (_) { error = new Error(message || 'cancelled'); error.name = 'AbortError'; }
  error.userCancelled = true;
  return error;
}

function ensureDependencies() {
  if (state.dependencies) return state.dependencies;
  state.dependencies = Promise.resolve().then(function () {
    importScripts(CORE_SRC, STRESS_LOOKUP_SRC, FFLATE_SRC, ORT_SRC);
    if (!self.VoskTTSCore || !self.VoskStressLookup || !self.fflate || !self.ort) {
      throw new Error('Vosk worker dependencies did not initialize');
    }
    self.ort.env.wasm.numThreads = 1;
    self.ort.env.wasm.proxy = false;
    status('dependencies-ready');
    return true;
  });
  return state.dependencies;
}

function idbOpen() {
  return new Promise(function (resolve, reject) {
    var request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = function () {
      if (!request.result.objectStoreNames.contains('files')) request.result.createObjectStore('files');
    };
    request.onsuccess = function () { resolve(request.result); };
    request.onerror = function () { reject(request.error); };
  });
}

function idbGet(key) {
  return idbOpen().then(function (db) {
    return new Promise(function (resolve, reject) {
      var transaction = db.transaction('files', 'readonly');
      var request = transaction.objectStore('files').get(key);
      request.onsuccess = function () { resolve(request.result || null); };
      request.onerror = function () { reject(request.error); };
      transaction.oncomplete = function () { db.close(); };
      transaction.onabort = transaction.onerror = function () { try { db.close(); } catch (_) {} };
    });
  });
}

function idbSet(key, value) {
  return idbOpen().then(function (db) {
    return new Promise(function (resolve, reject) {
      var transaction = db.transaction('files', 'readwrite');
      var request = transaction.objectStore('files').put(value, key);
      request.onsuccess = function () { resolve(); };
      request.onerror = function () { reject(request.error); };
      transaction.oncomplete = function () { db.close(); };
      transaction.onabort = transaction.onerror = function () { try { db.close(); } catch (_) {} };
    });
  });
}

function bytesHex(buffer) {
  var bytes = new Uint8Array(buffer);
  var out = '';
  for (var index = 0; index < bytes.length; index += 1) out += bytes[index].toString(16).padStart(2, '0');
  return out;
}

function verifyIntegrity(buffer) {
  if (!(self.crypto && self.crypto.subtle && self.crypto.subtle.digest)) return Promise.resolve();
  return self.crypto.subtle.digest('SHA-256', buffer).then(function (hash) {
    var actual = bytesHex(hash);
    if (actual !== EXPECTED_MODEL_SHA256) {
      throw new Error('model integrity check failed: sha256 ' + actual.slice(0, 12) + '...');
    }
  });
}

function extractZip(buffer) {
  var unpacked = self.fflate.unzipSync(new Uint8Array(buffer), {
    filter: function (file) {
      return NEEDED.some(function (name) { return file.name === name || file.name.endsWith('/' + name); });
    }
  });
  var ordered = NEEDED.slice().sort(function (a, b) { return b.length - a.length; });
  var files = {};
  Object.keys(unpacked).forEach(function (path) {
    for (var index = 0; index < ordered.length; index += 1) {
      var expected = ordered[index];
      if (path === expected || path.endsWith('/' + expected)) {
        files[expected] = unpacked[path];
        break;
      }
    }
  });
  if (!files['model.onnx'] || !files.dictionary || !files['config.json']) {
    throw new Error('vosk model archive is incomplete');
  }
  return files;
}

function fetchModelFiles() {
  return idbGet(MODEL_URL).catch(function (error) {
    status('cache-unavailable', { reason: 'indexeddb-read', message: errorPayload(error).message });
    return null;
  }).then(function (cached) {
    if (cached) {
      status('cache-hit');
      return cached;
    }

    state.loadController = typeof AbortController === 'function' ? new AbortController() : null;
    status('loading');
    return fetch(MODEL_URL, state.loadController ? { signal: state.loadController.signal } : undefined)
      .then(function (response) {
        if (!response.ok) throw new Error('model download HTTP ' + response.status);
        return response.arrayBuffer();
      })
      .then(function (buffer) {
        status('verifying');
        return verifyIntegrity(buffer).then(function () {
          status('extracting');
          return extractZip(buffer);
        });
      })
      .then(function (files) {
        return idbSet(MODEL_URL, files).catch(function (error) {
          status('cache-unavailable', { reason: 'indexeddb-write', message: errorPayload(error).message });
        }).then(function () { return files; });
      })
      .finally(function () { state.loadController = null; });
  });
}

function fetchStressLookup() {
  return Promise.all([
    fetch(CUSTOM_TERMS_URL, { cache: 'force-cache' }).then(function (response) { return response.ok ? response.json() : {}; }).catch(function () { return {}; }),
    fetch(STRESS_MARKER_URL, { cache: 'force-cache' }).then(function (response) { return response.ok ? response.arrayBuffer() : null; }).catch(function () { return null; })
  ]).then(function (results) {
    var custom = results[0] || {};
    delete custom._comment;
    var customTerms = new Map(Object.entries(custom));
    return {
      lookup: new self.VoskStressLookup.StressLookup({ customTerms: customTerms, markerDictBuffer: results[1] || undefined }),
      customTerms: customTerms
    };
  });
}

function sourceBuffer(value) {
  if (value instanceof ArrayBuffer) return value;
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
}

function ensureLoaded() {
  if (state.ready) return Promise.resolve(true);
  if (state.loading) return state.loading;
  status('preparing');
  state.loading = ensureDependencies().then(function () {
    return Promise.all([fetchModelFiles(), fetchStressLookup()]);
  }).then(function (results) {
    var files = results[0];
    var stress = results[1];
    var decoder = new TextDecoder('utf-8');
    state.config = JSON.parse(decoder.decode(files['config.json']));
    state.dic = self.VoskTTSCore.parseDictionary(decoder.decode(files.dictionary));
    stress.customTerms.forEach(function (_, word) { state.dic.delete(word); });
    state.stressLookup = stress.lookup;
    var hasBert = !!(files['bert/model.onnx'] && files['bert/vocab.txt']);
    status('initializing');
    return Promise.all([
      self.ort.InferenceSession.create(sourceBuffer(files['model.onnx']), { executionProviders: ['wasm'] }),
      hasBert
        ? self.ort.InferenceSession.create(sourceBuffer(files['bert/model.onnx']), { executionProviders: ['wasm'] })
        : Promise.resolve(null)
    ]).then(function (sessions) {
      state.sess = sessions[0];
      state.bertSess = sessions[1];
      state.tok = state.bertSess ? new self.VoskTTSCore.WordPieceTokenizer(decoder.decode(files['bert/vocab.txt'])) : null;
      state.ready = true;
      status('ready');
      return true;
    });
  }).catch(function (error) {
    state.ready = false;
    status(error && error.name === 'AbortError' ? 'cancelled' : 'error', errorPayload(error));
    throw error;
  }).finally(function () {
    state.loading = null;
  });
  return state.loading;
}

function i64(values, dimensions) {
  return new self.ort.Tensor('int64', BigInt64Array.from(values, function (value) { return BigInt(value); }), dimensions);
}

function f32(values, dimensions) {
  return new self.ort.Tensor('float32', Float32Array.from(values), dimensions);
}

function bertRows(text, noPunctuation) {
  var encoded = state.tok.encode(text);
  var length = encoded.ids.length;
  var feeds = {
    input_ids: i64(encoded.ids, [1, length]),
    attention_mask: i64(encoded.attention_mask, [1, length]),
    token_type_ids: i64(encoded.type_ids, [1, length])
  };
  var available = state.bertSess.inputNames;
  Object.keys(feeds).forEach(function (name) { if (available.indexOf(name) === -1) delete feeds[name]; });
  return state.bertSess.run(feeds).then(function (output) {
    var tensor = output[state.bertSess.outputNames[0]];
    var dimensions = tensor.dims.slice();
    if (dimensions.length === 3 && dimensions[0] === 1) dimensions = dimensions.slice(1);
    var hidden = dimensions[1];
    var selection = self.VoskTTSCore.selectBertRows(encoded.tokens, noPunctuation);
    var rows = [];
    for (var index = 0; index < selection.length; index += 1) {
      var start = selection[index] * hidden;
      rows.push(tensor.data.subarray(start, start + hidden));
    }
    return { rows: rows, hidden: hidden };
  });
}

var SITE_ABBREVIATIONS = [
  ['1 Цар.', 'первая книга Царств'], ['1 Пет.', 'первое послание Петра'],
  ['Быт.', 'Бытие'], ['Исх.', 'Исход'], ['Лев.', 'Левит'], ['Втор.', 'Второзаконие'],
  ['Суд.', 'Судей'], ['Пс.', 'Псалом'], ['Ис.', 'Исаии'], ['Иер.', 'Иеремии'],
  ['Иез.', 'Иезекииля'], ['Мал.', 'Малахии'], ['Лк.', 'Луки'], ['Ин.', 'Иоанна'],
  ['Рим.', 'Римлянам'], ['Откр.', 'Откровение'],
  ['т.е.', 'то есть'], ['Т.е.', 'То есть'], ['т.д.', 'так далее'], ['Т.д.', 'Так далее'],
  ['т.п.', 'тому подобное'], ['Т.п.', 'Тому подобное'], ['см.', 'смотри'], ['См.', 'Смотри']
];
var ROMAN_ORDER = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
var ROMAN_VALUES = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
var ORDINAL_UNITS = ['', 'первый', 'второй', 'третий', 'четвёртый', 'пятый', 'шестой', 'седьмой', 'восьмой', 'девятый'];
var ORDINAL_TEENS = ['десятый', 'одиннадцатый', 'двенадцатый', 'тринадцатый', 'четырнадцатый', 'пятнадцатый', 'шестнадцатый', 'семнадцатый', 'восемнадцатый', 'девятнадцатый'];
var ORDINAL_TENS = { 2: 'двадцатый', 3: 'тридцатый', 4: 'сороковой', 5: 'пятидесятый', 6: 'шестидесятый', 7: 'семидесятый', 8: 'восьмидесятый', 9: 'девяностый' };
var CARDINAL_TENS = { 2: 'двадцать', 3: 'тридцать', 4: 'сорок', 5: 'пятьдесят', 6: 'шестьдесят', 7: 'семьдесят', 8: 'восемьдесят', 9: 'девяносто' };
var VEK_CASE = { век: 'nom', века: 'gen', веку: 'dat', веком: 'instr', веке: 'prep' };

function romanToArabic(value) {
  var index = 0;
  var number = 0;
  while (index < value.length) {
    var matched = false;
    for (var order = 0; order < ROMAN_ORDER.length; order += 1) {
      var symbol = ROMAN_ORDER[order];
      if (value.slice(index, index + symbol.length) === symbol) {
        number += ROMAN_VALUES[symbol];
        index += symbol.length;
        matched = true;
        break;
      }
    }
    if (!matched) return null;
  }
  return number;
}

function arabicToRoman(number) {
  var output = '';
  var rest = number;
  for (var index = 0; index < ROMAN_ORDER.length; index += 1) {
    var symbol = ROMAN_ORDER[index];
    while (rest >= ROMAN_VALUES[symbol]) { output += symbol; rest -= ROMAN_VALUES[symbol]; }
  }
  return output;
}

function ordinalNominative(number) {
  if (number <= 0 || number > 99) return null;
  if (number < 10) return ORDINAL_UNITS[number];
  if (number < 20) return ORDINAL_TEENS[number - 10];
  var tens = Math.floor(number / 10);
  var units = number % 10;
  return units === 0 ? ORDINAL_TENS[tens] : CARDINAL_TENS[tens] + ' ' + ORDINAL_UNITS[units];
}

function declineOrdinal(phrase, caseCode) {
  if (!caseCode || caseCode === 'nom') return phrase;
  var parts = phrase.split(' ');
  var last = parts[parts.length - 1];
  if (last === 'третий') last = { gen: 'третьего', dat: 'третьему', instr: 'третьим', prep: 'третьем' }[caseCode] || last;
  else last = last.slice(0, -2) + ({ gen: 'ого', dat: 'ому', instr: 'ым', prep: 'ом' }[caseCode] || '');
  parts[parts.length - 1] = last;
  return parts.join(' ');
}

function expandSiteAbbreviations(text) {
  var output = text;
  for (var index = 0; index < SITE_ABBREVIATIONS.length; index += 1) {
    output = output.split(SITE_ABBREVIATIONS[index][0]).join(SITE_ABBREVIATIONS[index][1]);
  }
  output = output.replace(/\b([IVXLCDM]{1,7})(\s+)(век[а-яё]*)/g, function (whole, roman, spacing, form) {
    var number = romanToArabic(roman);
    if (!number || number > 99 || arabicToRoman(number) !== roman) return whole;
    return declineOrdinal(ordinalNominative(number), VEK_CASE[form.toLowerCase()] || 'nom') + spacing + form;
  });
  return output.replace(/\b[IVXLCDM]{1,15}\b/g, function (roman) {
    var number = romanToArabic(roman);
    return number && number <= 3999 && arabicToRoman(number) === roman ? String(number) : roman;
  });
}

function injectCustomStress(text) {
  if (!state.stressLookup) return text;
  return text.replace(/[а-яё]+/gi, function (word) {
    var marked = state.stressLookup.getPlusForm(word.toLowerCase());
    return marked || word;
  });
}

function synthChunk(chunk, rate, speakerId, jobId) {
  var config = state.config;
  var inference = config.inference || {};
  var noise = inference.noise_level !== undefined ? inference.noise_level : 0.8;
  var durationNoise = inference.duration_noise_level !== undefined ? inference.duration_noise_level : 0.8;
  var scale = inference.scale !== undefined ? inference.scale : 1;
  var speechRate = rate * (inference.speech_rate !== undefined ? inference.speech_rate : 1);
  chunk = injectCustomStress(chunk.trim().replace(/—/g, '-'));
  var modelType = config.model_type || '';

  function runSession(feeds) {
    if (state.cancelledJobs.has(jobId)) throw createCancelledError('synthesis cancelled');
    var available = state.sess.inputNames;
    Object.keys(feeds).forEach(function (name) { if (available.indexOf(name) === -1) delete feeds[name]; });
    return state.sess.run(feeds).then(function (output) {
      if (state.cancelledJobs.has(jobId)) throw createCancelledError('synthesis cancelled');
      return self.VoskTTSCore.floatToInt16(output[state.sess.outputNames[0]].data, scale);
    });
  }

  if (state.tok && (modelType === 'multistream_v3' || modelType === 'multistream_v2' || modelType === 'multistream_v1')) {
    var version3 = modelType === 'multistream_v3';
    var wordPosition = modelType !== 'multistream_v1';
    post('synth-progress', { id: jobId, value: 0.18 });
    return bertRows(version3 ? chunk.toLowerCase().replace(/[+_]/g, '') : chunk.replace(/[+_]/g, ''), version3).then(function (bert) {
      if (state.cancelledJobs.has(jobId)) throw createCancelledError('synthesis cancelled');
      var g2p = self.VoskTTSCore.g2pMultistream(chunk, config, state.dic, { wordPos: wordPosition, scales: version3 });
      var length = g2p.streams.length;
      var flat = new Array(5 * length);
      for (var stream = 0; stream < 5; stream += 1) for (var item = 0; item < length; item += 1) flat[stream * length + item] = g2p.streams[item][stream];
      var hidden = bert.hidden;
      var bertFlat = new Float32Array(hidden * length);
      for (var position = 0; position < length; position += 1) {
        var rowIndex = Math.min(g2p.bertIndex[position], bert.rows.length - 1);
        var row = bert.rows[rowIndex < 0 ? bert.rows.length - 1 : rowIndex];
        for (var cell = 0; cell < hidden; cell += 1) bertFlat[cell * length + position] = row[cell];
      }
      var feeds = {
        input: i64(flat, [1, 5, length]),
        input_lengths: i64([length], [1]),
        scales: f32([noise, 1 / speechRate, durationNoise], [3]),
        sid: i64([speakerId], [1]),
        bert: new self.ort.Tensor('float32', bertFlat, [1, hidden, length])
      };
      if (version3) feeds.phone_duration_extra = f32(g2p.durationExtra, [1, length]);
      post('synth-progress', { id: jobId, value: 0.52 });
      return runSession(feeds);
    });
  }

  if (state.tok && !state.warnedUnknownModelType) {
    state.warnedUnknownModelType = true;
    post('warning', { message: 'Unknown Vosk model type; BERT stress disambiguation skipped' });
  }
  var ids = self.VoskTTSCore.g2pNoembed(chunk, config, state.dic);
  post('synth-progress', { id: jobId, value: 0.42 });
  return runSession({
    input: i64(ids, [1, ids.length]),
    input_lengths: i64([ids.length], [1]),
    scales: f32([noise, 1 / speechRate, durationNoise], [3]),
    sid: i64([speakerId], [1])
  });
}

function synthesize(message) {
  var id = message.id;
  state.cancelledJobs.delete(id);
  return ensureLoaded().then(function () {
    if (state.cancelledJobs.has(id)) throw createCancelledError('synthesis cancelled');
    var normalized = self.VoskTTSCore.normalizeText(expandSiteAbbreviations(String(message.text || '')));
    if (!normalized) return new ArrayBuffer(0);
    post('synth-progress', { id: id, value: 0.05 });
    return synthChunk(normalized, Number(message.rate) || 1, Number(message.speakerId) || 0, id).then(function (pcm) {
      post('synth-progress', { id: id, value: 0.92 });
      return self.VoskTTSCore.int16ToWav(pcm, SAMPLE_RATE);
    });
  }).then(function (wav) {
    if (state.cancelledJobs.has(id)) throw createCancelledError('synthesis cancelled');
    var buffer = wav instanceof ArrayBuffer ? wav : wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength);
    post('audio', { id: id, wav: buffer }, [buffer]);
  }).catch(function (error) {
    if (!state.cancelledJobs.has(id)) post('synth-error', Object.assign({ id: id }, errorPayload(error)));
  }).finally(function () {
    state.cancelledJobs.delete(id);
  });
}

self.onmessage = function (event) {
  var message = event.data || {};
  if (message.type === 'ensure') {
    ensureLoaded().then(function () { post('ready', { id: message.id }); }).catch(function (error) {
      post('load-error', Object.assign({ id: message.id }, errorPayload(error)));
    });
    return;
  }
  if (message.type === 'speak') {
    synthesize(message);
    return;
  }
  if (message.type === 'cancel') {
    state.cancelledJobs.add(message.id);
    return;
  }
  if (message.type === 'cancel-load') {
    try { state.loadController && state.loadController.abort(); } catch (_) {}
  }
};
