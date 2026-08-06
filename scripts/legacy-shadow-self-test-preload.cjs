'use strict';

// The retirement audit self-test creates a synthetic `.mjs` inventory fixture
// that intentionally mirrors the historical CommonJS test body. Expose only
// `require` to that isolated child process through NODE_OPTIONS; production
// audits and repository runtime never load this compatibility preloader.
globalThis.require = require;
