#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_APP = 'konfessii/russkij-baptizm/_app';

function parseArgs(argv) {
  const args = { root: DEFAULT_ROOT, app: DEFAULT_APP, outJson: null, outMd: null, selfTest: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--root') args.root = path.resolve(argv[++index]);
    else if (value === '--app') args.app = argv[++index];
    else if (value === '--out-json') args.outJson = path.resolve(argv[++index]);
    else if (value === '--out-md') args.outMd = path.resolve(argv[++index]);
    else if (value === '--self-test') args.selfTest = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function normalize(value) {
  return String(value).replace(/\\/g, '/');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function walk(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) walk(absolute, output);
    else if (entry.isFile()) output.push(absolute);
  }
  return output;
}

function countMatches(text, regex) {
  return [...text.matchAll(regex)].length;
}

function sumCaptureBytes(text, regex) {
  let bytes = 0;
  for (const match of text.matchAll(regex)) bytes += Buffer.byteLength(match[1] || '', 'utf8');
  return bytes;
}

function localReferences(html) {
  const refs = [];
  const regex = /(?:src|href)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(regex)) {
    const value = match[1];
    if (!value || value.startsWith('#') || /^(?:https?:|data:|mailto:|tel:|javascript:)/i.test(value)) continue;
    refs.push(value.split(/[?#]/)[0]);
  }
  return [...new Set(refs)].sort();
}

function measure(root, appRelative) {
  const appRoot = path.resolve(root, appRelative);
  const rootPrefix = `${path.resolve(root)}${path.sep}`;
  if (!(appRoot === path.resolve(root) || appRoot.startsWith(rootPrefix))) throw new Error('App path escapes repository root');
  if (!fs.existsSync(appRoot) || !fs.statSync(appRoot).isDirectory()) throw new Error(`Built app directory missing: ${appRelative}`);

  const indexPath = path.join(appRoot, 'index.html');
  if (!fs.existsSync(indexPath)) throw new Error(`Built app entry missing: ${normalize(path.relative(root, indexPath))}`);

  const files = walk(appRoot).sort();
  const fileRows = files.map((filePath) => {
    const buffer = fs.readFileSync(filePath);
    return {
      path: normalize(path.relative(root, filePath)),
      bytes: buffer.length,
      sha256: sha256(buffer),
      extension: path.extname(filePath).toLowerCase() || '(none)',
    };
  });
  const totalBytes = fileRows.reduce((sum, row) => sum + row.bytes, 0);
  const indexBuffer = fs.readFileSync(indexPath);
  const html = indexBuffer.toString('utf8');
  const gzipBytes = zlib.gzipSync(indexBuffer, { level: 9 }).length;
  const brotliBytes = zlib.brotliCompressSync(indexBuffer, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length;
  const inlineScriptBytes = sumCaptureBytes(html, /<script\b[^>]*>([\s\S]*?)<\/script>/gi);
  const inlineStyleBytes = sumCaptureBytes(html, /<style\b[^>]*>([\s\S]*?)<\/style>/gi);
  const refs = localReferences(html);
  const ext = {};
  for (const row of fileRows) {
    ext[row.extension] ||= { files: 0, bytes: 0 };
    ext[row.extension].files += 1;
    ext[row.extension].bytes += row.bytes;
  }

  const inlineShare = indexBuffer.length ? (inlineScriptBytes + inlineStyleBytes) / indexBuffer.length : 0;
  const isMonolithic = indexBuffer.length >= 1_000_000 && inlineShare >= 0.65;
  const recommendation = isMonolithic
    ? 'SPLIT_CANDIDATE_PENDING_BROWSER_EVIDENCE'
    : indexBuffer.length >= 1_000_000
      ? 'LARGE_BUT_ALREADY_ASSET_SPLIT'
      : 'KEEP_CURRENT';

  return {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    app: normalize(appRelative),
    entry: normalize(path.relative(root, indexPath)),
    summary: {
      files: fileRows.length,
      totalBytes,
      indexBytes: indexBuffer.length,
      indexSharePct: +(indexBuffer.length / totalBytes * 100).toFixed(2),
      gzipBytes,
      brotliBytes,
      gzipRatioPct: +(gzipBytes / indexBuffer.length * 100).toFixed(2),
      brotliRatioPct: +(brotliBytes / indexBuffer.length * 100).toFixed(2),
      inlineScriptBytes,
      inlineStyleBytes,
      inlineSharePct: +(inlineShare * 100).toFixed(2),
      scriptTags: countMatches(html, /<script\b/gi),
      styleTags: countMatches(html, /<style\b/gi),
      domElementApprox: countMatches(html, /<[a-z][^!/?\s>]*(?:\s[^>]*)?>/gi),
      localReferenceCount: refs.length,
      recommendation,
      splitAuthorized: false,
    },
    extensionTotals: ext,
    localReferences: refs,
    files: fileRows,
    decisionBoundary: {
      currentDecision: recommendation,
      reason: isMonolithic
        ? 'The entry is over 1 MB and at least 65% of its bytes are inline script/style, so extraction may improve caching and parse cost.'
        : 'Static bytes alone do not justify a structural split.',
      requiredBeforeSplit: [
        'browser timing and long-task evidence',
        'preserved route/search/offline behavior',
        'a reversible extraction plan',
      ],
    },
  };
}

function renderMarkdown(report) {
  const s = report.summary;
  return `# Baptists 3D built-app measurement\n\n` +
    `- Entry: \`${report.entry}\`\n` +
    `- Files: **${s.files}**\n` +
    `- Total bytes: **${s.totalBytes}**\n` +
    `- Entry bytes: **${s.indexBytes}** (${s.indexSharePct}% of app)\n` +
    `- Gzip / Brotli: **${s.gzipBytes} / ${s.brotliBytes} bytes**\n` +
    `- Inline JS + CSS: **${s.inlineScriptBytes + s.inlineStyleBytes} bytes** (${s.inlineSharePct}% of entry)\n` +
    `- Approximate DOM elements: **${s.domElementApprox}**\n` +
    `- Local asset references: **${s.localReferenceCount}**\n` +
    `- Static recommendation: **${s.recommendation}**\n` +
    `- Split authorized by this measurement: **no**\n\n` +
    `A structural split requires browser timing/long-task evidence and preserved route, search and offline contracts.\n`;
}

function runSelfTest() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'baptists-built-app-'));
  try {
    const app = path.join(temp, 'app');
    fs.mkdirSync(app, { recursive: true });
    const inline = 'x'.repeat(1_100_000);
    fs.writeFileSync(path.join(app, 'index.html'), `<!doctype html><style>${'a'.repeat(50_000)}</style><main></main><script>${inline}</script>`);
    const report = measure(temp, 'app');
    if (report.summary.recommendation !== 'SPLIT_CANDIDATE_PENDING_BROWSER_EVIDENCE') {
      throw new Error(`unexpected recommendation: ${report.summary.recommendation}`);
    }
    if (report.summary.splitAuthorized !== false || report.summary.files !== 1) throw new Error('self-test boundary failed');
    console.log('✅ Baptists built-app measurement self-test passed');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.selfTest) {
  runSelfTest();
  process.exit(0);
}
const report = measure(args.root, args.app);
if (args.outJson) {
  fs.mkdirSync(path.dirname(args.outJson), { recursive: true });
  fs.writeFileSync(args.outJson, `${JSON.stringify(report, null, 2)}\n`);
}
if (args.outMd) {
  fs.mkdirSync(path.dirname(args.outMd), { recursive: true });
  fs.writeFileSync(args.outMd, renderMarkdown(report));
}
console.log(`✅ Baptists built app measured: ${report.summary.indexBytes} entry bytes; ${report.summary.recommendation}`);
