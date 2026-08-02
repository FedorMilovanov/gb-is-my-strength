#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'links-graph.json');
const WRITE = process.argv.includes('--write');
const ROUTE = '/pastor-series/';
const EXPECTED_READING_TIME = 102;

function normalize(source) {
  const graph = JSON.parse(source);
  const matches = (graph.nodes || []).filter((node) => node.url === ROUTE);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${ROUTE} node, found ${matches.length}`);
  }
  const node = matches[0];
  const changed = node.readingTime !== EXPECTED_READING_TIME;
  node.readingTime = EXPECTED_READING_TIME;
  return {
    output: `${JSON.stringify(graph, null, 2)}\n`,
    changed,
  };
}

function main() {
  const source = fs.readFileSync(FILE, 'utf8');
  const result = normalize(source);
  console.log(`Pastor-series links graph: readingTime=${EXPECTED_READING_TIME}; changed=${result.changed}`);
  if (WRITE && result.output !== source) {
    fs.writeFileSync(FILE, result.output, 'utf8');
    return;
  }
  if (!WRITE && result.output !== source) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
} else {
  module.exports = { normalize, ROUTE, EXPECTED_READING_TIME };
}
