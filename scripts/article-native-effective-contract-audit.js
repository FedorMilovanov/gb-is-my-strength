#!/usr/bin/env node
'use strict';

/*
 * Install the normalized effective route registry for this process before the
 * existing article dist audit loads its source-contract dependency. This keeps
 * the large audit implementation focused on HTML/dist assertions while route
 * ownership is supplied by page-ownership + profiles + explicit matrix overrides.
 */

const { assertTmsjTranslationRightsContract } = require('./lib/tmsj-translation-rights-contract');
assertTmsjTranslationRightsContract();

const basePath = require.resolve('./lib/route-source-contract');
const effective = require('./lib/effective-route-registry');
require.cache[basePath].exports = effective;
require('./article-native-contract-audit');
