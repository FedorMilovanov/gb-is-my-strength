'use strict';

const basePath = require.resolve('./lib/route-source-contract');
const effective = require('./lib/effective-route-registry');
require.cache[basePath].exports = effective;
