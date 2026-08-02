#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GRAPH_FILE = path.join(ROOT, 'data/links-graph.json');
const MANIFEST_FILE = path.join(ROOT, 'data/search-manifest.json');

function parseArgs(argv = process.argv.slice(2)) {
  const options = { write: false, check: false };
  for (const arg of argv) {
    if (arg === '--write') options.write = true;
    else if (arg === '--check') options.check = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (options.write && options.check) throw new Error('use either --write or --check');
  if (!options.write) options.check = true;
  return options;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeGraph(graph, manifest) {
  const items = Array.isArray(manifest) ? manifest : manifest.items || [];
  const readTimeByUrl = new Map();
  for (const item of items) {
    if (!item?.url || !Number.isFinite(item.readTime)) continue;
    if (readTimeByUrl.has(item.url)) throw new Error(`${item.url}: duplicate search-manifest URL`);
    readTimeByUrl.set(item.url, item.readTime);
  }

  const seenIds = new Set();
  const seenUrls = new Set();
  let synchronized = 0;
  const normalized = {
    ...graph,
    nodes: (graph.nodes || []).map((node) => {
      if (!node?.id || !node?.url) throw new Error('every links-graph node requires id and url');
      if (seenIds.has(node.id)) throw new Error(`${node.id}: duplicate links-graph id`);
      if (seenUrls.has(node.url)) throw new Error(`${node.url}: duplicate links-graph URL`);
      seenIds.add(node.id);
      seenUrls.add(node.url);

      const canonical = readTimeByUrl.get(node.url);
      if (!Number.isFinite(canonical)) return node;
      synchronized += 1;
      return { ...node, readingTime: canonical };
    }),
  };

  const ids = new Set(normalized.nodes.map((node) => node.id));
  for (const [index, edge] of (normalized.edges || []).entries()) {
    if (!Array.isArray(edge) || edge.length !== 2) throw new Error(`edge ${index}: expected [source,target]`);
    if (!ids.has(edge[0]) || !ids.has(edge[1])) throw new Error(`edge ${index}: references unknown node`);
  }

  return { normalized, synchronized };
}

function render(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function main() {
  const options = parseArgs();
  const graph = readJson(GRAPH_FILE);
  const manifest = readJson(MANIFEST_FILE);
  const { normalized, synchronized } = normalizeGraph(graph, manifest);
  const expected = render(normalized);
  const current = fs.readFileSync(GRAPH_FILE, 'utf8');

  if (options.write) {
    if (current === expected) {
      console.log(`links graph already synchronized (${synchronized} manifest-backed node(s))`);
      return;
    }
    fs.writeFileSync(GRAPH_FILE, expected, 'utf8');
    console.log(`wrote links graph read times from search manifest (${synchronized} node(s))`);
    return;
  }

  if (current !== expected) {
    console.error('❌ data/links-graph.json differs from deterministic search-manifest read-time projection');
    console.error('Run: node scripts/links-graph-read-time-normalizer.js --write');
    process.exit(1);
  }
  console.log(`✅ links graph read times match search manifest (${synchronized} node(s))`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}

module.exports = { parseArgs, normalizeGraph, render };
