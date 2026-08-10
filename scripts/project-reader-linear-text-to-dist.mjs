#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const rootIndex = process.argv.indexOf('--root');
const DIST = path.resolve(ROOT, rootIndex >= 0 ? (process.argv[rootIndex + 1] || 'dist') : 'dist');
const DRY_RUN = process.argv.includes('--dry-run');
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const RAW = new Set(['script','style']);
const POPUP_CLASSES = new Map([
  ['gtip', { kind: 'definition', label: 'определение' }],
  ['tooltip', { kind: 'footnote', label: 'сноска' }],
  ['btip', { kind: 'scripture', label: 'цитата' }],
]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, out);
    else if (entry.isFile() && file.endsWith('.html')) out.push(file);
  }
  return out;
}

function readTagEnd(html, start) {
  let quote = '';
  for (let i = start + 1; i < html.length; i += 1) {
    const ch = html[i];
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '>') return i + 1;
  }
  return html.length;
}

function tagInfo(raw) {
  const closing = /^<\s*\//.test(raw);
  const match = raw.match(/^<\s*\/?\s*([A-Za-z][A-Za-z0-9:-]*)/);
  if (!match) return null;
  const name = match[1].toLowerCase();
  return { name, closing, selfClosing: /\/\s*>$/.test(raw) || VOID.has(name) };
}

function attrValue(raw, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = raw.match(new RegExp(`(?:\\s|<)${escaped}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+)))?`, 'i'));
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? '';
}

function hasAttr(raw, name) { return attrValue(raw, name) !== null; }
function classSet(raw) { return new Set(String(attrValue(raw, 'class') || '').split(/\s+/).filter(Boolean)); }

function scanElements(html) {
  const nodes = [];
  const stack = [];
  const lower = html.toLowerCase();
  let cursor = 0;

  while (cursor < html.length) {
    const top = stack[stack.length - 1];
    let start;
    if (top && RAW.has(top.name)) {
      start = lower.indexOf(`</${top.name}`, cursor);
      if (start < 0) break;
    } else {
      start = html.indexOf('<', cursor);
      if (start < 0) break;
    }

    if (html.startsWith('<!--', start)) {
      const end = html.indexOf('-->', start + 4);
      cursor = end < 0 ? html.length : end + 3;
      continue;
    }
    if (/^<![^-]/.test(html.slice(start, start + 4)) || html.startsWith('<?', start)) {
      cursor = readTagEnd(html, start);
      continue;
    }

    const end = readTagEnd(html, start);
    const raw = html.slice(start, end);
    const info = tagInfo(raw);
    if (!info) { cursor = Math.max(end, start + 1); continue; }

    if (info.closing) {
      let matchIndex = -1;
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        if (stack[index].name === info.name) { matchIndex = index; break; }
      }
      if (matchIndex >= 0) {
        const node = stack[matchIndex];
        node.endTagStart = start;
        node.end = end;
        stack.length = matchIndex;
      }
      cursor = end;
      continue;
    }

    const node = {
      name: info.name,
      start,
      startTagEnd: end,
      startRaw: raw,
      endTagStart: info.selfClosing ? end : null,
      end: info.selfClosing ? end : null,
      parent: stack[stack.length - 1] || null,
    };
    nodes.push(node);
    if (!info.selfClosing) stack.push(node);
    cursor = end;
  }

  for (const node of stack) {
    if (node.end == null) {
      node.endTagStart = html.length;
      node.end = html.length;
    }
  }
  return nodes;
}

function inside(node, ancestor) {
  return node !== ancestor && node.start > ancestor.start && node.end <= ancestor.end;
}

function popupKind(node) {
  const classes = classSet(node.startRaw);
  for (const [token, descriptor] of POPUP_CLASSES) if (classes.has(token)) return descriptor;
  return null;
}

function addAttributes(raw, attrs) {
  let next = raw;
  for (const [name, value] of Object.entries(attrs)) {
    if (hasAttr(next, name)) continue;
    const serialized = value === '' ? ` ${name}` : ` ${name}="${String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;
    next = next.replace(/\s*(\/?>)$/, `${serialized}$1`);
  }
  return next;
}

function decodeText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function marker(position, label) {
  const text = position === 'start' ? ` ⟦${label}: ` : '⟧ ';
  return `<span hidden aria-hidden="true" data-pagefind-ignore data-reader-linear-boundary="${position}">${text}</span>`;
}

function applyOperations(html, operations) {
  const sorted = operations.sort((a, b) => b.start - a.start || b.end - a.end);
  let output = html;
  for (const op of sorted) output = `${output.slice(0, op.start)}${op.text}${output.slice(op.end)}`;
  return output;
}

function projectFile(file) {
  const html = fs.readFileSync(file, 'utf8');
  const nodes = scanElements(html);
  const head = nodes.find(node => node.name === 'head' && node.endTagStart != null);
  if (!head) return { changed: false, articles: 0, metadata: 0, popups: 0 };

  const articles = nodes.filter(node => node.name === 'article' && hasAttr(node.startRaw, 'data-pagefind-body'));
  if (!articles.length) return { changed: false, articles: 0, metadata: 0, popups: 0 };

  const operations = [];
  const headMeta = [];
  let metadataCount = 0;
  let popupCount = 0;

  for (const article of articles) {
    const descendants = nodes.filter(node => node.end != null && inside(node, article));
    for (const node of descendants) {
      if (hasAttr(node.startRaw, 'data-pagefind-meta') && node.endTagStart != null) {
        const key = attrValue(node.startRaw, 'data-pagefind-meta');
        const value = decodeText(html.slice(node.startTagEnd, node.endTagStart));
        if (key && value) headMeta.push(`<meta data-pagefind-meta="${escapeAttr(key)}" content="${escapeAttr(value)}" data-reader-meta-projected="true">`);
        operations.push({ start: node.start, end: node.end, text: '' });
        metadataCount += 1;
        continue;
      }

      const descriptor = popupKind(node);
      if (!descriptor || node.endTagStart == null || hasAttr(node.startRaw, 'data-reader-linear-aux')) continue;
      const startTag = addAttributes(node.startRaw, {
        'data-pagefind-ignore': '',
        'data-reader-linear-aux': descriptor.kind,
      });
      operations.push({
        start: node.start,
        end: node.startTagEnd,
        text: `${startTag}${marker('start', descriptor.label)}`,
      });
      operations.push({ start: node.endTagStart, end: node.endTagStart, text: marker('end', descriptor.label) });
      popupCount += 1;
    }
  }

  if (headMeta.length) {
    operations.push({
      start: head.endTagStart,
      end: head.endTagStart,
      text: `\n${headMeta.join('\n')}\n`,
    });
  }

  if (!operations.length) return { changed: false, articles: articles.length, metadata: 0, popups: 0 };
  const projected = applyOperations(html, operations);
  if (projected === html) return { changed: false, articles: articles.length, metadata: metadataCount, popups: popupCount };
  if (!DRY_RUN) fs.writeFileSync(file, projected, 'utf8');
  return { changed: true, articles: articles.length, metadata: metadataCount, popups: popupCount };
}

if (!fs.existsSync(DIST)) throw new Error(`reader linear-text projector root missing: ${DIST}`);
const files = walk(DIST);
const totals = { files: files.length, changed: 0, articles: 0, metadata: 0, popups: 0 };
for (const file of files) {
  const result = projectFile(file);
  if (result.changed) totals.changed += 1;
  totals.articles += result.articles;
  totals.metadata += result.metadata;
  totals.popups += result.popups;
}

console.log(`Reader linear-text projection${DRY_RUN ? ' [DRY RUN]' : ''}: ${totals.changed} file(s), ${totals.articles} article(s), ${totals.metadata} metadata field(s), ${totals.popups} popup payload(s)`);
if (!totals.articles) throw new Error('reader linear-text projector found no data-pagefind-body article surfaces');
if (!totals.metadata && !totals.popups && !DRY_RUN) throw new Error('reader linear-text projector made no semantic projection claims');
if (DRY_RUN && totals.changed) throw new Error(`reader linear-text projector dry-run detected ${totals.changed} file(s) with semantic drift`);
