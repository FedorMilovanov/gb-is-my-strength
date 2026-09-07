#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const ORG_ID = 'https://gospod-bog.ru/#organization';
const ORG_NAME = 'Господь Бог — Сила Моя';
const LOGO_URL = 'https://gospod-bog.ru/icons/icon-512.png';
const LOGO_ASSET = 'icons/icon-512.png';
const TARGETS = [
  {
    route: '/',
    source: 'src/components/home/HomePageHead.astro',
    dist: 'index.html',
  },
  {
    route: '/nagornaya/seriya/',
    source: 'src/components/nagornaya/seriya/NagornayaSeriyaPageHead.astro',
    dist: 'nagornaya/seriya/index.html',
  },
];

function fail(message) {
  throw new Error(`ORGANIZATION IMAGE CREATOR CONTRACT: ${message}`);
}

function asArray(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function hasType(node, wanted) {
  return node && typeof node === 'object' && asArray(node['@type']).includes(wanted);
}

function parseJsonLd(html, label) {
  const matches = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (!matches.length) fail(`${label}: no JSON-LD blocks found`);
  return matches.map((match, index) => {
    const raw = match[1].trim();
    try {
      return JSON.parse(raw);
    } catch (error) {
      fail(`${label}: JSON-LD block ${index + 1} is invalid JSON: ${error.message}`);
    }
  });
}

function graphNodes(blocks) {
  return blocks.flatMap((data) => Array.isArray(data?.['@graph']) ? data['@graph'] : [data]);
}

function walkObjects(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walkObjects(item, visit);
    return;
  }
  if (!value || typeof value !== 'object') return;
  visit(value);
  for (const child of Object.values(value)) walkObjects(child, visit);
}

function validateDocument(html, label) {
  const blocks = parseJsonLd(html, label);
  const nodes = graphNodes(blocks);
  const canonical = nodes.find((node) => node && typeof node === 'object' && node['@id'] === ORG_ID);
  if (!canonical) fail(`${label}: canonical ${ORG_ID} node missing`);
  if (!hasType(canonical, 'Organization')) fail(`${label}: canonical ${ORG_ID} is not Organization`);
  if (canonical.name !== ORG_NAME) fail(`${label}: canonical organization name drifted`);

  const logo = canonical.logo;
  if (!logo || typeof logo !== 'object') fail(`${label}: canonical Organization.logo must be ImageObject`);
  if (!hasType(logo, 'ImageObject')) fail(`${label}: canonical Organization.logo is not ImageObject`);
  if ((logo.url || logo.contentUrl) !== LOGO_URL) fail(`${label}: canonical Organization.logo URL must be ${LOGO_URL}`);
  if (Number(logo.width) !== 512 || Number(logo.height) !== 512) {
    fail(`${label}: canonical Organization.logo dimensions must be 512x512`);
  }

  const ownedImages = [];
  let anonymousOwnedOrganizations = 0;
  for (const block of blocks) {
    walkObjects(block, (node) => {
      if (hasType(node, 'Organization') && node.name === ORG_NAME && node['@id'] !== ORG_ID) {
        anonymousOwnedOrganizations += 1;
      }
      if (!hasType(node, 'ImageObject') || !node.creator || typeof node.creator !== 'object') return;
      const creator = node.creator;
      if (creator['@id'] === ORG_ID || creator.name === ORG_NAME) ownedImages.push(node);
    });
  }

  if (anonymousOwnedOrganizations) {
    fail(`${label}: found ${anonymousOwnedOrganizations} anonymous duplicate Organization node(s) for ${ORG_NAME}`);
  }
  if (!ownedImages.length) fail(`${label}: no site-owned ImageObject creator found`);
  for (const image of ownedImages) {
    const creator = image.creator;
    if (creator['@id'] !== ORG_ID) {
      fail(`${label}: ImageObject creator must resolve to canonical ${ORG_ID}`);
    }
    if (creator['@type'] && !hasType(creator, 'Organization')) {
      fail(`${label}: linked ImageObject creator has non-Organization @type`);
    }
    if (creator.name && creator.name !== ORG_NAME) {
      fail(`${label}: linked ImageObject creator name drifted`);
    }
  }

  return { ownedImages: ownedImages.length };
}

function validateLogoAsset(root) {
  const file = path.join(root, LOGO_ASSET);
  if (!fs.existsSync(file)) fail(`logo asset missing: ${path.relative(ROOT, file)}`);
  const buffer = fs.readFileSync(file);
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(pngSignature)) fail(`${LOGO_ASSET} is not a PNG`);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width !== 512 || height !== 512) fail(`${LOGO_ASSET} is ${width}x${height}, expected 512x512`);
}

validateLogoAsset(ROOT);
const result = { source: {}, dist: null };
for (const target of TARGETS) {
  const sourcePath = path.join(ROOT, target.source);
  if (!fs.existsSync(sourcePath)) fail(`source missing: ${target.source}`);
  result.source[target.route] = validateDocument(fs.readFileSync(sourcePath, 'utf8'), `source ${target.route}`);
}

if (process.argv.includes('--require-dist')) {
  const distRoot = path.join(ROOT, 'dist');
  validateLogoAsset(distRoot);
  result.dist = {};
  for (const target of TARGETS) {
    const distPath = path.join(distRoot, target.dist);
    if (!fs.existsSync(distPath)) fail(`dist missing: ${target.dist}`);
    result.dist[target.route] = validateDocument(fs.readFileSync(distPath, 'utf8'), `dist ${target.route}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  organizationId: ORG_ID,
  logo: LOGO_URL,
  ...result,
}, null, 2));
