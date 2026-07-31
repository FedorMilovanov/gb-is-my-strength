'use strict';

const fs = require('fs');
const path = require('path');

const SITE_ORIGIN = 'https://gospod-bog.ru';
const APPROVED_SOCIAL_IMAGE_PROFILES = Object.freeze([
  Object.freeze({ width: 1200, height: 630, name: 'open-graph-1.91' }),
  Object.freeze({ width: 1200, height: 675, name: 'editorial-16-9' }),
]);

function getMeta(html, attr, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re1 = new RegExp(`<meta[^>]+${attr}=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${escaped}["'][^>]*>`, 'i');
  return html.match(re1)?.[1] || html.match(re2)?.[1] || '';
}

function getLink(html, relName) {
  const escaped = String(relName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.match(new RegExp(`<link[^>]+rel=["']${escaped}["'][^>]+href=["']([^"']+)["']`, 'i'))?.[1]
    || html.match(new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+rel=["']${escaped}["'][^>]*>`, 'i'))?.[1]
    || '';
}

function normalizeAbsoluteUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw, `${SITE_ORIGIN}/`);
    parsed.hash = '';
    parsed.search = '';
    if (parsed.origin !== SITE_ORIGIN) return parsed.href;
    if (!parsed.pathname.endsWith('/') && !path.posix.extname(parsed.pathname)) parsed.pathname += '/';
    return parsed.href;
  } catch {
    return '';
  }
}

function isApprovedSocialImageDimensions(width, height) {
  const w = Number(width);
  const h = Number(height);
  return APPROVED_SOCIAL_IMAGE_PROFILES.some((profile) => profile.width === w && profile.height === h);
}

function approvedSocialImageProfileLabel() {
  return APPROVED_SOCIAL_IMAGE_PROFILES.map((profile) => `${profile.width}x${profile.height}`).join(' or ');
}

function collectCanonicalOgImages(htmlFiles) {
  const images = new Map();
  const sources = new Map();
  const errors = [];
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    if (!/<head\b/i.test(html)) continue;
    const robots = getMeta(html, 'name', 'robots').toLowerCase();
    if (/\bnoindex\b/.test(robots)) continue;
    const canonical = normalizeAbsoluteUrl(getLink(html, 'canonical'));
    const ogImage = normalizeAbsoluteUrl(getMeta(html, 'property', 'og:image'));
    if (!canonical) continue;
    if (new URL(canonical).origin !== SITE_ORIGIN) {
      errors.push(`${canonical}: canonical is not on ${SITE_ORIGIN}`);
      continue;
    }
    if (!ogImage) {
      errors.push(`${canonical}: indexable canonical page has no og:image (${file})`);
      continue;
    }
    if (new URL(ogImage).origin !== SITE_ORIGIN) {
      errors.push(`${canonical}: og:image is not on ${SITE_ORIGIN}: ${ogImage}`);
      continue;
    }
    if (images.has(canonical) && images.get(canonical) !== ogImage) {
      errors.push(`${canonical}: conflicting og:image values ${images.get(canonical)} and ${ogImage}`);
      continue;
    }
    images.set(canonical, ogImage);
    sources.set(canonical, file);
  }
  return { images, sources, errors };
}

function sitemapUrlBlocks(xml) {
  return [...String(xml).matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => ({
    full: match[0],
    body: match[1],
    index: match.index,
  }));
}

function imageLocations(blockBody) {
  return [...String(blockBody).matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map((match) => normalizeAbsoluteUrl(match[1]));
}

function projectBlockImage(block, expectedImage) {
  const imageBlocks = [...block.matchAll(/<image:image>[\s\S]*?<\/image:image>/g)];
  if (imageBlocks.length > 1) throw new Error('sitemap URL block has more than one image:image');
  if (imageBlocks.length === 1) {
    const current = imageBlocks[0][0];
    const locs = imageLocations(current);
    if (locs.length > 1) throw new Error('sitemap image:image has more than one image:loc');
    const replacement = locs.length
      ? current.replace(/<image:loc>[^<]*<\/image:loc>/, `<image:loc>${expectedImage}</image:loc>`)
      : current.replace(/<image:image>/, `<image:image><image:loc>${expectedImage}</image:loc>`);
    return block.replace(current, replacement);
  }
  const close = block.lastIndexOf('</url>');
  if (close === -1) throw new Error('sitemap URL block has no closing url tag');
  const multiline = block.includes('\n');
  const indent = block.match(/\n([ \t]*)<\/url>/)?.[1] || '  ';
  const insertion = multiline
    ? `\n${indent}<image:image><image:loc>${expectedImage}</image:loc></image:image>`
    : `<image:image><image:loc>${expectedImage}</image:loc></image:image>`;
  return `${block.slice(0, close)}${insertion}${multiline ? '\n' + indent : ''}${block.slice(close)}`;
}

function projectSitemapImages({ root, htmlFiles, dryRun = false }) {
  const sitemapPath = path.join(root, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) throw new Error(`Missing sitemap.xml in ${root}`);
  const collected = collectCanonicalOgImages(htmlFiles);
  if (collected.errors.length) throw new Error(`Canonical OG image census failed:\n${collected.errors.join('\n')}`);
  const original = fs.readFileSync(sitemapPath, 'utf8');
  let updated = original;
  let inserted = 0;
  let replaced = 0;
  let unchanged = 0;
  const missingPages = [];
  for (const { full, body } of sitemapUrlBlocks(original)) {
    const loc = normalizeAbsoluteUrl(body.match(/<loc>([^<]+)<\/loc>/)?.[1]);
    if (!loc) throw new Error('sitemap URL block has no valid loc');
    const expectedImage = collected.images.get(loc);
    if (!expectedImage) {
      missingPages.push(loc);
      continue;
    }
    const before = imageLocations(body);
    const nextBlock = projectBlockImage(full, expectedImage);
    if (!before.length) inserted += 1;
    else if (before[0] !== expectedImage) replaced += 1;
    else unchanged += 1;
    updated = updated.replace(full, nextBlock);
  }
  if (missingPages.length) {
    throw new Error(`Sitemap URLs have no indexable canonical OG owner:\n${missingPages.join('\n')}`);
  }
  if (!dryRun && updated !== original) fs.writeFileSync(sitemapPath, updated, 'utf8');
  return {
    sitemapPath,
    changed: updated !== original,
    inserted,
    replaced,
    unchanged,
    canonicalPages: collected.images.size,
  };
}

function readImageDimensions(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length >= 24 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    const type = bytes.toString('ascii', 12, 16);
    if (type === 'VP8X' && bytes.length >= 30) {
      return {
        width: 1 + bytes.readUIntLE(24, 3),
        height: 1 + bytes.readUIntLE(27, 3),
        type: 'image/webp',
      };
    }
    if (type === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
      const packed = bytes.readUInt32LE(21);
      return {
        width: 1 + (packed & 0x3fff),
        height: 1 + ((packed >>> 14) & 0x3fff),
        type: 'image/webp',
      };
    }
    if (type === 'VP8 ') {
      const marker = bytes.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20);
      if (marker !== -1 && marker + 7 <= bytes.length) {
        return {
          width: bytes.readUInt16LE(marker + 3) & 0x3fff,
          height: bytes.readUInt16LE(marker + 5) & 0x3fff,
          type: 'image/webp',
        };
      }
    }
    throw new Error(`Unsupported or corrupt WebP header: ${file}`);
  }
  if (bytes.length >= 24 && bytes.toString('ascii', 1, 4) === 'PNG') {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), type: 'image/png' };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5), type: 'image/jpeg' };
      }
      const length = bytes.readUInt16BE(offset + 2);
      if (!Number.isFinite(length) || length < 2) break;
      offset += 2 + length;
    }
    throw new Error(`Unsupported or corrupt JPEG header: ${file}`);
  }
  throw new Error(`Unsupported social image format: ${file}`);
}

function auditSitemapImages({ root, htmlFiles }) {
  const sitemapPath = path.join(root, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) return { errors: [`missing sitemap.xml in ${root}`], counts: {} };
  const collected = collectCanonicalOgImages(htmlFiles);
  const errors = [...collected.errors];
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  let entries = 0;
  for (const { body } of sitemapUrlBlocks(xml)) {
    entries += 1;
    const loc = normalizeAbsoluteUrl(body.match(/<loc>([^<]+)<\/loc>/)?.[1]);
    const expected = collected.images.get(loc);
    const actual = imageLocations(body);
    if (!expected) {
      errors.push(`${loc || '<invalid loc>'}: no canonical OG owner`);
      continue;
    }
    if (actual.length !== 1) {
      errors.push(`${loc}: expected exactly one sitemap image, found ${actual.length}`);
      continue;
    }
    if (actual[0] !== expected) errors.push(`${loc}: sitemap image ${actual[0]} != page og:image ${expected}`);
  }
  return {
    errors,
    counts: { entries, canonicalPages: collected.images.size },
    images: collected.images,
    sources: collected.sources,
  };
}

module.exports = {
  SITE_ORIGIN,
  APPROVED_SOCIAL_IMAGE_PROFILES,
  getMeta,
  getLink,
  normalizeAbsoluteUrl,
  isApprovedSocialImageDimensions,
  approvedSocialImageProfileLabel,
  collectCanonicalOgImages,
  projectSitemapImages,
  auditSitemapImages,
  readImageDimensions,
};
