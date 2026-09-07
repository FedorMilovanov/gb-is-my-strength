'use strict';

/**
 * Canonical transport-layer security expectations for the production origin.
 *
 * gospod-bog.ru is deployed through GitHub Pages. These values are therefore
 * verified against real HTTP response headers; they must never be represented
 * as HTML meta pragmas merely to satisfy a source-level audit.
 */
const REQUIRED_TRANSPORT_HEADERS = Object.freeze({
  'x-content-type-options': 'nosniff',
});

module.exports = Object.freeze({
  REQUIRED_TRANSPORT_HEADERS,
});
