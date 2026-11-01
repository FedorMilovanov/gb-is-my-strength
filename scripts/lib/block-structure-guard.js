'use strict';
/**
 * block-structure-guard — source/render guards for
 * GBS-KRAJNE-FIGURE-PARAGRAPH-ORPHAN-TEXT.
 *
 * (1) A block-level <figure> must never be nested inside an open <p>: HTML
 *     parsers close the paragraph at the figure token, which orphans the
 *     following sentence as a direct text child of the article root.
 * (2) Canonical reader roots (<article data-pagefind-body>) must not carry
 *     substantive direct text nodes between block children — the rendered
 *     symptom of (1) or of any other parser-splitting nesting mistake.
 *
 * Deterministic token-depth scan over raw markup (authored .astro bodies and
 * machine-generated dist HTML alike). Comments and script/style/svg/noscript
 * payloads are stripped before scanning; void elements never enter the stack.
 */

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9:_-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

function clean(html) {
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
}

function isSelfClosed(attrs) {
  return /\/\s*$/.test(attrs || '');
}

function isSubstantive(segment) {
  const letters = segment.match(/[А-Яа-яЁёA-Za-z0-9]/g) || [];
  return letters.length >= 40;
}

function figureInParagraphs(text) {
  let count = 0;
  const stack = [];
  TAG_RE.lastIndex = 0;
  let m;
  while ((m = TAG_RE.exec(text))) {
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    const attrs = m[3] || '';
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i] === name) { stack.length = i; break; }
      }
      continue;
    }
    if (name === 'figure' && !isSelfClosed(attrs)) {
      if (stack.includes('p')) count += 1;
      stack.push('figure');
      continue;
    }
    if (isSelfClosed(attrs) || VOID.has(name)) continue;
    stack.push(name);
  }
  return count;
}

function orphanedDirectText(text) {
  const root = /<article\b[^>]*\bdata-pagefind-body\b[^>]*>/i.exec(text);
  if (!root) return 0;
  const start = root.index + root[0].length;
  const end = text.indexOf('</article>', start);
  const region = end === -1 ? text.slice(start) : text.slice(start, end);
  let count = 0;
  let depth = 0;
  let last = 0;
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(region))) {
    if (depth === 0 && isSubstantive(region.slice(last, m.index))) count += 1;
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    const attrs = m[3] || '';
    if (closing) depth = Math.max(0, depth - 1);
    else if (!isSelfClosed(attrs) && !VOID.has(name)) depth += 1;
    last = m.index + m[0].length;
  }
  if (depth === 0 && isSubstantive(region.slice(last))) count += 1;
  return count;
}

function scanBlockStructure(html) {
  const text = clean(html);
  return {
    figureInP: figureInParagraphs(text),
    directText: orphanedDirectText(text),
  };
}

module.exports = { scanBlockStructure };
