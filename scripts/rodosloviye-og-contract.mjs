#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const SOURCE_HEAD = 'src/components/rodosloviye/RodosloviyePageHead.astro';
const DIST_ROUTE = 'rodosloviye/index.html';
const ASSET = 'images/og-rodosloviye-1200x630.webp';
const CANONICAL_URL = 'https://gospod-bog.ru/images/og-rodosloviye-1200x630.webp';
const WIDTH = 1200;
const HEIGHT = 630;

function fail(message) {
  throw new Error(`RODOSLOVIYE OG CONTRACT: ${message}`);
}

function attrs(tag) {
  const result = new Map();
  const re = /([:\w-]+)\s*=\s*(["'])(.*?)\2/gs;
  let match;
  while ((match = re.exec(tag))) result.set(match[1].toLowerCase(), match[3]);
  return result;
}

function metaContent(html, key, value) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const map = attrs(tag);
    if ((map.get(key) || '').toLowerCase() === value.toLowerCase()) return map.get('content') || '';
  }
  return '';
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function webpDimensions(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    fail('asset is not a RIFF/WEBP file');
  }
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + size > buffer.length) fail(`truncated ${type} chunk`);
    if (type === 'VP8X') {
      if (size < 10) fail('invalid VP8X chunk');
      return { width: 1 + readUInt24LE(buffer, data + 4), height: 1 + readUInt24LE(buffer, data + 7) };
    }
    if (type === 'VP8 ') {
      if (size < 10 || buffer[data + 3] !== 0x9d || buffer[data + 4] !== 0x01 || buffer[data + 5] !== 0x2a) fail('invalid VP8 frame header');
      return { width: buffer.readUInt16LE(data + 6) & 0x3fff, height: buffer.readUInt16LE(data + 8) & 0x3fff };
    }
    if (type === 'VP8L') {
      if (size < 5 || buffer[data] !== 0x2f) fail('invalid VP8L frame header');
      const bits = buffer.readUInt32LE(data + 1);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
    }
    offset = data + size + (size & 1);
  }
  fail('no VP8/VP8L/VP8X image chunk found');
}

function validateMetadata(html, label) {
  const og = metaContent(html, 'property', 'og:image');
  const twitter = metaContent(html, 'name', 'twitter:image');
  const ogWidth = metaContent(html, 'property', 'og:image:width');
  const ogHeight = metaContent(html, 'property', 'og:image:height');
  const ogType = metaContent(html, 'property', 'og:image:type');
  const ogAlt = metaContent(html, 'property', 'og:image:alt');
  const twitterAlt = metaContent(html, 'name', 'twitter:image:alt');

  if (og !== CANONICAL_URL) fail(`${label}: og:image must be ${CANONICAL_URL}, got ${og || '<missing>'}`);
  if (twitter !== CANONICAL_URL) fail(`${label}: twitter:image must equal route-owned OG URL`);
  if (html.includes('og-karty-1200x630.webp')) fail(`${label}: Karty social-image identity leaked into Rodosloviye`);
  if (ogWidth !== String(WIDTH) || ogHeight !== String(HEIGHT) || ogType !== 'image/webp') {
    fail(`${label}: OG dimensions/type contract is not ${WIDTH}x${HEIGHT} image/webp`);
  }
  if (!/родослов|генеалог/i.test(ogAlt) || !/родослов|генеалог/i.test(twitterAlt)) {
    fail(`${label}: social-image alt text must describe genealogy`);
  }
}

function validateAsset(assetPath, label) {
  if (!fs.existsSync(assetPath)) fail(`${label}: missing ${ASSET}`);
  const asset = fs.readFileSync(assetPath);
  const dimensions = webpDimensions(asset);
  if (dimensions.width !== WIDTH || dimensions.height !== HEIGHT) {
    fail(`${label}: asset is ${dimensions.width}x${dimensions.height}, expected ${WIDTH}x${HEIGHT}`);
  }
  return { asset, dimensions };
}

const sourceHeadPath = path.join(ROOT, SOURCE_HEAD);
if (!fs.existsSync(sourceHeadPath)) fail(`source: missing native metadata owner ${SOURCE_HEAD}`);
const sourceHead = fs.readFileSync(sourceHeadPath, 'utf8');
validateMetadata(sourceHead, 'source native head');
const source = validateAsset(path.join(ROOT, ASSET), 'source');

if (process.argv.includes('--require-dist')) {
  const distRoot = path.join(ROOT, 'dist');
  const distRoutePath = path.join(distRoot, DIST_ROUTE);
  if (!fs.existsSync(distRoutePath)) fail(`dist: missing ${DIST_ROUTE}`);
  validateMetadata(fs.readFileSync(distRoutePath, 'utf8'), 'dist');
  const dist = validateAsset(path.join(distRoot, ASSET), 'dist');
  if (!source.asset.equals(dist.asset)) fail('dist asset is not byte-identical to the route-owned source asset');
}

console.log(JSON.stringify({
  ok: true,
  route: '/rodosloviye/',
  sourceOwner: SOURCE_HEAD,
  asset: ASSET,
  url: CANONICAL_URL,
  width: WIDTH,
  height: HEIGHT,
  dist: process.argv.includes('--require-dist'),
}));
