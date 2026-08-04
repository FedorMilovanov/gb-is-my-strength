(() => {
  'use strict';

  const VERSION = 1;
  const MODEL_URL = 'https://huggingface.co/CurtMil/gb-vosk-tts-model/resolve/main/model-quant.zip';
  const FFLATE_URL = 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js';
  const NEEDED = ['model.onnx', 'dictionary', 'config.json', 'bert/model.onnx', 'bert/vocab.txt'];

  if (window.__gbVoskDownloadWorkerVersion === VERSION) return;
  if (typeof Worker !== 'function' || typeof Blob !== 'function' || !URL?.createObjectURL) return;

  const nativeFetch = window.fetch.bind(window);
  let jobSequence = 0;

  function requestedUrl(input) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    if (typeof Request === 'function' && input instanceof Request) return input.url;
    return String(input?.url || '');
  }

  function requestedMethod(input, init) {
    return String(init?.method || input?.method || 'GET').toUpperCase();
  }

  function abortError() {
    try {
      return new DOMException('model download cancelled', 'AbortError');
    } catch {
      const error = new Error('model download cancelled');
      error.name = 'AbortError';
      return error;
    }
  }

  function workerSource() {
    return `
      'use strict';
      const FFLATE_URL = ${JSON.stringify(FFLATE_URL)};
      const NEEDED = ${JSON.stringify(NEEDED)};
      let controller = null;

      self.onmessage = async (event) => {
        const message = event.data || {};
        if (message.type === 'cancel') {
          try { controller?.abort(); } catch (_) {}
          return;
        }
        if (message.type !== 'start') return;

        controller = typeof AbortController === 'function' ? new AbortController() : null;
        try {
          importScripts(FFLATE_URL);
          const response = await fetch(message.url, controller ? { signal: controller.signal } : undefined);
          if (!response.ok) {
            self.postMessage({ type: 'http-error', status: response.status, statusText: response.statusText });
            return;
          }

          const raw = await response.arrayBuffer();
          const unzipped = self.fflate.unzipSync(new Uint8Array(raw), {
            filter(file) {
              return NEEDED.some((name) => file.name.endsWith('/' + name) || file.name === name);
            }
          });

          const files = {};
          const transfers = [raw];
          Object.keys(unzipped).forEach((name) => {
            const bytes = unzipped[name];
            const exact = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
              ? bytes
              : bytes.slice();
            files[name] = exact;
            transfers.push(exact.buffer);
          });

          self.postMessage({
            type: 'ready',
            raw,
            files,
            status: response.status,
            statusText: response.statusText,
            headers: Array.from(response.headers.entries())
          }, transfers);
        } catch (error) {
          self.postMessage({
            type: 'error',
            name: error?.name || 'Error',
            message: error?.message || String(error)
          });
        }
      };
    `;
  }

  function makeResponseLike(payload) {
    const headers = typeof Headers === 'function' ? new Headers(payload.headers || []) : payload.headers || [];
    let raw = payload.raw;
    return {
      ok: true,
      status: payload.status || 200,
      statusText: payload.statusText || 'OK',
      headers,
      redirected: true,
      type: 'cors',
      url: MODEL_URL,
      arrayBuffer() {
        const value = raw;
        raw = null;
        return Promise.resolve(value);
      },
      clone() {
        throw new TypeError('The Vosk worker response is a single-use body');
      }
    };
  }

  function installOneShotUnzip(files, rawByteLength) {
    const library = window.fflate;
    if (!library || typeof library.unzipSync !== 'function') {
      throw new Error('fflate was not ready when the model worker completed');
    }
    const original = library.unzipSync;
    let consumed = false;
    library.unzipSync = function readerWorkerUnzip(input, options) {
      if (!consumed && input?.byteLength === rawByteLength) {
        consumed = true;
        library.unzipSync = original;
        return files;
      }
      return original.call(this, input, options);
    };
  }

  function fetchModelInWorker(signal) {
    return new Promise((resolve, reject) => {
      const id = ++jobSequence;
      const blobUrl = URL.createObjectURL(new Blob([workerSource()], { type: 'text/javascript' }));
      const worker = new Worker(blobUrl, { name: `gb-vosk-model-${id}` });
      let settled = false;

      const cleanup = () => {
        signal?.removeEventListener?.('abort', onAbort);
        try { worker.terminate(); } catch {}
        URL.revokeObjectURL(blobUrl);
      };
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback(value);
      };
      const onAbort = () => {
        try { worker.postMessage({ type: 'cancel' }); } catch {}
        finish(reject, abortError());
      };

      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener?.('abort', onAbort, { once: true });

      worker.onerror = (event) => {
        finish(reject, new Error(event.message || 'Vosk model worker failed'));
      };
      worker.onmessage = (event) => {
        const payload = event.data || {};
        if (payload.type === 'http-error') {
          finish(resolve, {
            ok: false,
            status: payload.status || 500,
            statusText: payload.statusText || 'Model download failed',
            headers: typeof Headers === 'function' ? new Headers() : [],
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
          });
          return;
        }
        if (payload.type === 'error') {
          const error = new Error(payload.message || 'Vosk model worker failed');
          error.name = payload.name || 'Error';
          finish(reject, error);
          return;
        }
        if (payload.type !== 'ready') return;
        try {
          installOneShotUnzip(payload.files || {}, payload.raw?.byteLength || 0);
          finish(resolve, makeResponseLike(payload));
        } catch (error) {
          finish(reject, error);
        }
      };

      worker.postMessage({ type: 'start', url: MODEL_URL });
    });
  }

  window.fetch = function readerVoskFetch(input, init) {
    const url = requestedUrl(input);
    if (url !== MODEL_URL || requestedMethod(input, init) !== 'GET') {
      return nativeFetch(input, init);
    }

    const signal = init?.signal || (typeof Request === 'function' && input instanceof Request ? input.signal : null);
    return fetchModelInWorker(signal).catch((error) => {
      if (error?.name === 'AbortError') throw error;
      console.warn('[GBReaderTTS] model worker unavailable; falling back to the standard download path', error);
      return nativeFetch(input, init);
    });
  };

  Object.defineProperty(window, '__gbVoskDownloadWorkerVersion', { value: VERSION });
})();
