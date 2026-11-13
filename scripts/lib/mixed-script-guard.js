'use strict';

/**
 * Shared Unicode-aware mixed-script contamination detector
 * (SYS-PUBLICATION-MIXED-SCRIPT-SURFACE-COVERAGE).
 *
 * Catches ANY single Latin character (including precomposed accented Latin vowels
 * such as á, é, ó) mixed into a Cyrillic word and ANY single Cyrillic character
 * mixed into a Latin word — across prose, JSON map/genealogy/glossary payloads,
 * quiz/metadata strings, ARIA labels, and final publication HTML.
 *
 * Preserves URLs, mailto: query encodings, code blocks, citations, and an
 * explicit reviewable allowlist of hyphenated Latin-prefix compounds (e.g.
 * `PDF-архив`, `3D-карта`, `QR-код`, `GPS-карта`, `Telegram-канал`).
 */

const SUBTOKEN_RE = /[\p{Script=Latin}\p{Script=Cyrillic}\p{M}]+/gu;
const HYPHEN_COMPOUND_RE = /[\p{Script=Latin}\p{Script=Cyrillic}\p{N}\p{M}]+(?:-[\p{Script=Latin}\p{Script=Cyrillic}\p{N}\p{M}]+)+/gu;
const HAS_CYRILLIC_RE = /\p{Script=Cyrillic}/u;
const HAS_LATIN_RE = /\p{Script=Latin}/u;

// Reviewable allowlist of intentional hyphenated prefixes/suffixes where one
// hyphen-segment is pure Latin/alphanumeric and the adjacent segment is pure Cyrillic.
const APPROVED_LATIN_SEGMENTS = new Set([
  '3d',
  '2d',
  'a',
  'b',
  'q',
  'ai',
  'bas',
  'bwa',
  'css',
  'dom',
  'gps',
  'gty',
  'html',
  'json',
  'ld',
  'md',
  'og',
  'pdf',
  'qr',
  'rss',
  'ssr',
  'svg',
  'tmsj',
  'tts',
  'ui',
  'url',
  'ux',
  'wcag',
  'wifi',
  'wi',
  'fi',
  'xml',
  'yec',
  'airburst',
  'authority',
  'bespoke',
  'billboards',
  'city',
  'complementary',
  'concursus',
  'content',
  'contents',
  'core',
  'dallas',
  'data',
  'desktop',
  'div',
  'draft',
  'exit',
  'facsimile',
  'farnell',
  'flagship',
  'folio',
  'gill',
  'hero',
  'i',
  'ii',
  'iii',
  'iv',
  'v',
  'vi',
  'vii',
  'viii',
  'ix',
  'x',
  'implicit',
  'independence',
  'ipsissima',
  'layout',
  'legacy',
  'levirate',
  'locator',
  'page',
  'play',
  'publishable',
  'readerstate',
  'reference',
  'research',
  'safeguarding',
  'scoped',
  'scroll',
  'sectioning',
  'sensitive',
  'supralapsarian',
  'telegram',
  'thomas',
  'tulip',
  'urim',
  'verba',
  'view',
  'vox',
]);

function stripAllowedUrlAndCode(input) {
  return String(input || '')
    .replace(/https?:\/\/[^\s"'<>)]+/giu, ' ')
    .replace(/mailto:[^\s"'<>)]+/giu, ' ')
    .replace(/%[0-9A-Fa-f]{2}/gu, ' ');
}

function sanitizeMarkupForMixedScript(html, { includeMetaAndAria = true } = {}) {
  const raw = String(html || '');
  const extras = [];

  if (includeMetaAndAria) {
    for (const m of raw.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/giu)) {
      extras.push(m[1]);
    }
    for (const m of raw.matchAll(
      /<meta\b[^>]*\b(?:name|property)=["'](?:description|og:title|og:description|twitter:title|twitter:description)["'][^>]*\bcontent=["']([^"']+)["']/giu,
    )) {
      extras.push(m[1]);
    }
    for (const m of raw.matchAll(
      /<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\b(?:name|property)=["'](?:description|og:title|og:description|twitter:title|twitter:description)["']/giu,
    )) {
      extras.push(m[1]);
    }
    for (const m of raw.matchAll(/\b(?:aria-label|alt|title)=["']([^"']+)["']/giu)) {
      extras.push(m[1]);
    }
  }

  const visible = raw
    .replace(/^---[\s\S]*?---/u, ' ')
    .replace(/<!--[\s\S]*?-->/gu, ' ')
    .replace(/<script[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style[\s\S]*?<\/style>/giu, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/giu, ' ')
    .replace(/<code[\s\S]*?<\/code>/giu, ' ')
    .replace(/<pre[\s\S]*?<\/pre>/giu, ' ')
    .replace(/`[^`]*`/gu, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/gu, (m) => m.replace(/\([^)]*\)$/u, ' '))
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;|&#160;/giu, ' ')
    .replace(/&[a-z0-9#]+;/giu, ' ');

  return stripAllowedUrlAndCode(`${visible} ${extras.join(' ')}`);
}

function findMixedScriptTokens(text, { checkHyphenCompounds = true } = {}) {
  const cleaned = stripAllowedUrlAndCode(text);
  const violations = [];
  const seen = new Set();

  // 1. Every unhyphenated subtoken mixing ANY Latin + ANY Cyrillic character is homoglyph corruption.
  for (const tok of cleaned.match(SUBTOKEN_RE) || []) {
    if (HAS_CYRILLIC_RE.test(tok) && HAS_LATIN_RE.test(tok)) {
      if (!seen.has(tok)) {
        seen.add(tok);
        violations.push({ token: tok, kind: 'subtoken-mixed-script' });
      }
    }
  }

  // 2. Hyphenated compounds mixing Latin and Cyrillic segments must either use an approved Latin segment or fail.
  if (checkHyphenCompounds) {
    for (const compound of cleaned.match(HYPHEN_COMPOUND_RE) || []) {
      if (!HAS_CYRILLIC_RE.test(compound) || !HAS_LATIN_RE.test(compound)) continue;
      const parts = compound.split('-').filter(Boolean);
      // Skip if already reported via subtoken violation
      if (parts.some((p) => HAS_CYRILLIC_RE.test(p) && HAS_LATIN_RE.test(p))) continue;
      const latinParts = parts.filter((p) => HAS_LATIN_RE.test(p));
      const unapproved = latinParts.filter((p) => !APPROVED_LATIN_SEGMENTS.has(p.toLowerCase()));
      if (unapproved.length > 0 && !seen.has(compound)) {
        seen.add(compound);
        violations.push({ token: compound, kind: 'unapproved-hyphen-hybrid' });
      }
    }
  }

  return violations;
}

function collectJsonStringValues(value, out = []) {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectJsonStringValues(item, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      collectJsonStringValues(v, out);
    }
  }
  return out;
}

module.exports = {
  APPROVED_LATIN_SEGMENTS,
  collectJsonStringValues,
  findMixedScriptTokens,
  sanitizeMarkupForMixedScript,
  stripAllowedUrlAndCode,
};
