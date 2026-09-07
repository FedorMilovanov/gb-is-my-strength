'use strict';

/**
 * Canonical document-layer security policy.
 *
 * This file owns the Content-Security-Policy that is projected into every
 * production HTML artifact. Transport-only controls (for example
 * X-Content-Type-Options) deliberately do not belong here.
 */
const DOCUMENT_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com https://cdn.jsdelivr.net; img-src 'self' https://gospod-bog.ru https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com https://commons.wikimedia.org https://upload.wikimedia.org https://cdn.loc.gov https://tile.loc.gov https://www.ritmeyer.com https://*.nasa.gov https://bibleplaces.photoshelter.com data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com wss://mc.yandex.ru wss://*.yandex.ru wss://mc.yandex.com wss://*.yandex.com https://huggingface.co https://*.aws.cdn.hf.co https://cdn.jsdelivr.net; frame-src 'self' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';";

module.exports = Object.freeze({
  DOCUMENT_CSP,
});
