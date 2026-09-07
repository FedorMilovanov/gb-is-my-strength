#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { DOCUMENT_CSP } = require('./security-document-policy.js');
const { REQUIRED_TRANSPORT_HEADERS } = require('./security-transport-policy.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const REPORTS = path.join(ROOT, 'reports');
const POSTBUILD = path.join(ROOT, 'scripts', 'astro-cache-bust-postbuild.js');
const LIVE_BASE_URL = String(process.env.SECURITY_LIVE_BASE_URL || 'https://gospod-bog.ru').replace(/\/+$/, '');
const requireDist = process.argv.includes('--dist');
const requireLive = process.argv.includes('--live');

function normalize(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cspMetaTags(html) {
  return (String(html).match(/<meta\b[^>]*>/gi) || [])
    .filter((tag) => /http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(tag));
}

function cspContent(tag) {
  const match = String(tag).match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i);
  return match ? match[2] : '';
}

function walkHtml(dir, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(absolute, output);
    else if (entry.isFile() && entry.name.endsWith('.html')) output.push(absolute);
  }
  return output;
}

assert.ok(DOCUMENT_CSP.length > 0, 'document CSP authority is empty');
assert.match(DOCUMENT_CSP, /(?:^|;)\s*default-src\s+'self'/, 'document CSP must own default-src');
assert.match(DOCUMENT_CSP, /(?:^|;)\s*object-src\s+'none'/, 'document CSP must own object-src');
assert.match(DOCUMENT_CSP, /(?:^|;)\s*base-uri\s+'self'/, 'document CSP must own base-uri');
assert.match(DOCUMENT_CSP, /(?:^|;)\s*form-action\s+'self'/, 'document CSP must own form-action');
assert.equal(/x-content-type-options/i.test(DOCUMENT_CSP), false, 'transport-only nosniff leaked into document policy');
assert.equal(REQUIRED_TRANSPORT_HEADERS['x-content-type-options'], 'nosniff', 'transport authority must own nosniff');

const postbuildSource = fs.readFileSync(POSTBUILD, 'utf8');
assert.match(postbuildSource, /security-document-policy\.js/, 'postbuild does not consume document-policy authority');
assert.equal(postbuildSource.includes('DEFAULT_DIST_CSP'), false, 'legacy inline CSP authority still exists in postbuild');
assert.match(postbuildSource, /DOCUMENT_CSP/, 'postbuild does not project canonical document CSP');

const report = {
  documentPolicy: {
    owner: 'scripts/security-document-policy.js',
    artifactProjector: 'scripts/astro-cache-bust-postbuild.js',
    csp: DOCUMENT_CSP,
  },
  transportPolicy: {
    owner: 'scripts/security-transport-policy.js',
    runtimeOwner: 'GitHub Pages',
    requiredHeaders: REQUIRED_TRANSPORT_HEADERS,
  },
  dist: null,
  live: null,
};

if (requireDist) {
  assert.equal(fs.existsSync(DIST), true, 'dist/ is required for --dist');
  const files = walkHtml(DIST);
  assert.ok(files.length > 0, 'dist contains no HTML files');
  const failures = [];
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    if (!/<html\b/i.test(html) || !/<head\b/i.test(html)) continue;
    const tags = cspMetaTags(html);
    const relative = path.relative(DIST, file).replace(/\\/g, '/');
    if (tags.length !== 1) {
      failures.push(`${relative}: expected exactly one CSP meta, found ${tags.length}`);
      continue;
    }
    if (normalize(cspContent(tags[0])) !== normalize(DOCUMENT_CSP)) {
      failures.push(`${relative}: CSP differs from canonical document authority`);
    }
  }
  assert.deepEqual(failures, [], `document-policy artifact drift:\n${failures.join('\n')}`);
  report.dist = { htmlFiles: files.length, result: 'PASS' };
}

if (requireLive) {
  const target = new URL('/', `${LIVE_BASE_URL}/`);
  target.searchParams.set('security_contract', `${Date.now()}`);
  const response = await fetch(target, {
    cache: 'no-store',
    redirect: 'follow',
    headers: {
      'cache-control': 'no-cache, no-store, max-age=0',
      pragma: 'no-cache',
      'user-agent': 'gb-security-ownership-contract/1.0',
    },
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.ok, true, `live security probe returned HTTP ${response.status}`);
  const observed = {};
  for (const [name, expected] of Object.entries(REQUIRED_TRANSPORT_HEADERS)) {
    const actual = response.headers.get(name);
    observed[name] = actual;
    assert.equal(normalize(actual).toLowerCase(), normalize(expected).toLowerCase(), `live ${name} header drift`);
  }
  report.live = { url: response.url, runtimeOwner: 'GitHub Pages', headers: observed, result: 'PASS' };
}

fs.mkdirSync(REPORTS, { recursive: true });
fs.writeFileSync(path.join(REPORTS, 'security-ownership-contract.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Security ownership contract: PASS${requireDist ? ' + dist' : ''}${requireLive ? ' + live transport' : ''}.`);
