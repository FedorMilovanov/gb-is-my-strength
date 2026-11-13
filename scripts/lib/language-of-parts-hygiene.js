'use strict';
/**
 * SYS-PUBLICATION-LANGUAGE-OF-PARTS-CONTRACT:
 * Shared AST audit and surgical offset-based projection for WCAG 3.1.2
 * Language of Parts across built publication HTML (`grc` for Greek/Polytonic
 * Greek runs, `he` + `dir="rtl"` for Hebrew runs).
 */
const parse5 = require('parse5');

const GREEK_CHAR_RE = /[\u0370-\u03FF\u1F00-\u1FFF]/u;
const HEBREW_CHAR_RE = /[\u0590-\u05FF\uFB1D-\uFB4F]/u;
const GREEK_LANG_RE = /^(?:el|grc)(?:-|$)/i;
const HEBREW_LANG_RE = /^(?:he|iw|hbo)(?:-|$)/i;

// Contiguous multi-word or single-word Greek/Hebrew phrase runs (including
// combining diacritics/niqqud and internal spaces/hyphens/apostrophes/maqaf).
const GREEK_WORD_SOURCE = '(?:[\\u0370-\\u03FF\\u1F00-\\u1FFF][\\u0300-\\u036F]*)+';
const HEBREW_WORD_SOURCE = '(?:[\\u0590-\\u05FF\\uFB1D-\\uFB4F][\\u0591-\\u05C7]*)+';
const GREEK_PHRASE_RE = new RegExp(
  `${GREEK_WORD_SOURCE}(?:(?:[\\s·ʼ'’-]+|\\s*\\+\\s*(?=[\\u0370-\\u03FF\\u1F00-\\u1FFF]))${GREEK_WORD_SOURCE})*`,
  'gu',
);
const HEBREW_PHRASE_RE = new RegExp(
  `${HEBREW_WORD_SOURCE}(?:[\\s־'-]+${HEBREW_WORD_SOURCE})*`,
  'gu',
);

const SKIP_SUBTREES = new Set([
  'script',
  'style',
  'template',
  'svg',
  'math',
  'noscript',
  'textarea',
  'title',
]);

const NON_WRAPPABLE_PARENTS = new Set([
  'code',
  'pre',
  'kbd',
  'samp',
  'option',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

function getAttr(node, name) {
  if (!node || !node.attrs) return null;
  for (const attr of node.attrs) {
    if (attr.name === name) return attr.value;
  }
  return null;
}

function fullTextOf(node) {
  if (node.nodeName === '#text') return node.value || '';
  if (node.tagName && SKIP_SUBTREES.has(node.tagName)) return '';
  let out = '';
  for (const child of node.childNodes || []) out += fullTextOf(child);
  return out;
}

function collectUntaggedScriptNodes(document) {
  const issues = [];

  function visit(node, inheritedLang, parentNode, inNonWrappable) {
    if (node.tagName) {
      if (SKIP_SUBTREES.has(node.tagName)) return;
      const ownLang = getAttr(node, 'lang');
      const nextLang = ownLang && ownLang.trim() ? ownLang.trim() : inheritedLang;
      const nextNonWrappable = inNonWrappable || NON_WRAPPABLE_PARENTS.has(node.tagName);
      for (const child of node.childNodes || []) {
        visit(child, nextLang, node, nextNonWrappable);
      }
      return;
    }

    if (node.nodeName === '#text') {
      const value = node.value || '';
      const missingGreek = GREEK_CHAR_RE.test(value) && !GREEK_LANG_RE.test(inheritedLang);
      const missingHebrew = HEBREW_CHAR_RE.test(value) && !HEBREW_LANG_RE.test(inheritedLang);
      if (missingGreek || missingHebrew) {
        issues.push({
          node,
          parentNode,
          inheritedLang,
          missingGreek,
          missingHebrew,
          inNonWrappable,
          value,
        });
      }
      return;
    }

    for (const child of node.childNodes || []) {
      visit(child, inheritedLang, parentNode, inNonWrappable);
    }
  }

  visit(document, 'ru', null, false);
  return issues;
}

function wrapRawSegment(rawText, needGreek, needHebrew) {
  const replacements = [];
  if (needGreek) {
    GREEK_PHRASE_RE.lastIndex = 0;
    let m;
    while ((m = GREEK_PHRASE_RE.exec(rawText)) !== null) {
      const slice = m[0];
      if (slice.includes('<') || slice.includes('>') || slice.includes('&')) continue;
      replacements.push({
        start: m.index,
        end: m.index + slice.length,
        replacement: `<span lang="grc">${slice}</span>`,
      });
    }
  }
  if (needHebrew) {
    HEBREW_PHRASE_RE.lastIndex = 0;
    let m;
    while ((m = HEBREW_PHRASE_RE.exec(rawText)) !== null) {
      const slice = m[0];
      if (slice.includes('<') || slice.includes('>') || slice.includes('&')) continue;
      replacements.push({
        start: m.index,
        end: m.index + slice.length,
        replacement: `<span lang="he" dir="rtl">${slice}</span>`,
      });
    }
  }
  if (!replacements.length) return { changed: false, output: rawText, wrappedCount: 0 };

  replacements.sort((a, b) => b.start - a.start);
  let output = rawText;
  let lastStart = Infinity;
  let wrappedCount = 0;
  for (const item of replacements) {
    if (item.end > lastStart) continue;
    output = output.slice(0, item.start) + item.replacement + output.slice(item.end);
    lastStart = item.start;
    wrappedCount += 1;
  }
  return { changed: wrappedCount > 0, output, wrappedCount };
}

function projectLanguageOfPartsHtml(html, label = 'document') {
  const doc = parse5.parse(html, { sourceCodeLocationInfo: true });
  const untagged = collectUntaggedScriptNodes(doc);
  if (!untagged.length) {
    return { changed: false, html, wrappedRuns: 0, remainingUntagged: 0 };
  }

  const edits = [];
  let wrappedRuns = 0;

  for (const entry of untagged) {
    if (entry.inNonWrappable) continue;
    const loc = entry.node.sourceCodeLocation;
    if (!loc || typeof loc.startOffset !== 'number' || typeof loc.endOffset !== 'number') continue;
    const rawSlice = html.slice(loc.startOffset, loc.endOffset);
    const wrapped = wrapRawSegment(rawSlice, entry.missingGreek, entry.missingHebrew);
    if (wrapped.changed) {
      edits.push({
        startOffset: loc.startOffset,
        endOffset: loc.endOffset,
        replacement: wrapped.output,
      });
      wrappedRuns += wrapped.wrappedCount;
    }
  }

  if (!edits.length) {
    return {
      changed: false,
      html,
      wrappedRuns: 0,
      remainingUntagged: untagged.length,
    };
  }

  const expectedText = fullTextOf(doc);
  edits.sort((a, b) => b.startOffset - a.startOffset);
  let nextHtml = html;
  for (const edit of edits) {
    nextHtml = nextHtml.slice(0, edit.startOffset) + edit.replacement + nextHtml.slice(edit.endOffset);
  }

  const reparsed = parse5.parse(nextHtml, { sourceCodeLocationInfo: false });
  const actualText = fullTextOf(reparsed);
  if (actualText !== expectedText) {
    throw new Error(`${label}: language-of-parts projection altered visible document text`);
  }
  const remaining = collectUntaggedScriptNodes(reparsed);
  return {
    changed: true,
    html: nextHtml,
    wrappedRuns,
    remainingUntagged: remaining.length,
  };
}

function auditLanguageOfPartsHtml(html) {
  const doc = parse5.parse(html, { sourceCodeLocationInfo: false });
  return collectUntaggedScriptNodes(doc).map((entry) => ({
    parentTag: entry.parentNode?.tagName || 'root',
    inheritedLang: entry.inheritedLang,
    missingGreek: entry.missingGreek,
    missingHebrew: entry.missingHebrew,
    sample: entry.value.replace(/\s+/g, ' ').trim().slice(0, 120),
  }));
}

module.exports = {
  GREEK_CHAR_RE,
  HEBREW_CHAR_RE,
  GREEK_PHRASE_RE,
  HEBREW_PHRASE_RE,
  projectLanguageOfPartsHtml,
  auditLanguageOfPartsHtml,
};
