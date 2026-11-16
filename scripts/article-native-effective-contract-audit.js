#!/usr/bin/env node
'use strict';

/*
 * Compatibility entrypoint: enforce Bible rights before the native article
 * audit. The audit itself imports effective-route-registry, so no module-cache
 * replacement or implicit registration order is necessary.
 */

const { assertApiBibleRightsContract } = require('./lib/api-bible-rights-contract');
const { assertTmsjTranslationRightsContract } = require('./lib/tmsj-translation-rights-contract');

assertApiBibleRightsContract();
assertTmsjTranslationRightsContract();

// Preserve this entrypoint for established CI commands and rights gates.
require('./article-native-contract-audit');
