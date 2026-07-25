#!/usr/bin/env node
/**
 * External source-link audit with explicit redirect-chain policy.
 *
 * Publication-blocking conditions:
 * - invalid/non-HTTP URL, credentials, forbidden host/port/scheme;
 * - private/reserved address at any resolved hop;
 * - HTTPS downgrade, redirect loop/overflow/missing Location;
 * - 404/410 or unusable final content.
 *
 * Bot blocks, rate limits, timeouts and 5xx remain warnings because they do not
 * prove that a reader-facing source is permanently invalid.
 */
'use strict';

const crypto = require('node:crypto');
const dns = require('node:dns').promises;
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const BAD_HOSTS = new Set(['arthistoryresources.net']);
const HTTP_ALLOW = [/^http:\/\/www\.w3\.org\//i, /^http:\/\/web\.archive\.org\//i, /^http:\/\/viaf\.org\//i];
const IGNORE_HOSTS = [/^gospod-bog\.ru$/i, /(^|\.)yandex\./i, /^mc\.yandex\./i];
const SKIP_DIRS = new Set(['.git', 'node_modules', 'reports', '.astro', 'pagefind']);
const MAX_REDIRECTS = Number(process.env.SOURCE_LINK_MAX_REDIRECTS || 5);
const TIMEOUT_MS = Number(process.env.SOURCE_LINK_TIMEOUT_MS || 10000);
const CONCURRENCY = Number(process.env.SOURCE_LINK_CONCURRENCY || 6);
const MAX_PROBE_BYTES = Number(process.env.SOURCE_LINK_MAX_PROBE_BYTES || 65536);

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const AUDIT_ROOT = path.resolve(REPO_ROOT, argValue('--root', '.'));
const JSON_OUT = argValue('--json-out', '');

class LinkPolicyError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LinkPolicyError';
    this.code = code;
    this.details = details;
  }
}

function normalizeHost(hostname) {
  const normalized = String(hostname || '').trim().replace(/\.$/, '').toLowerCase();
  return normalized.startsWith('[') && normalized.endsWith(']')
    ? normalized.slice(1, -1)
    : normalized;
}

function sanitizeUrlForEvidence(value) {
  const raw = String(value ?? '');
  try {
    const url = new URL(raw);
    url.username = '';
    url.password = '';
    url.hash = '';
    if (url.search) url.search = '?redacted=1';
    return url.href;
  } catch {
    const digest = crypto.createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 32);
    return `invalid-url:sha256:${digest}:bytes:${Buffer.byteLength(raw, 'utf8')}`;
  }
}

function isForbiddenIPv4(address) {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isForbiddenAddress(address) {
  const normalized = String(address || '').toLowerCase().split('%')[0];
  const family = net.isIP(normalized);
  if (family === 4) return isForbiddenIPv4(normalized);
  if (family !== 6) return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    return net.isIP(mapped) !== 4 || isForbiddenIPv4(mapped);
  }
  return (
    normalized === '::' ||
    normalized === '::1' ||
    /^f[cd]/.test(normalized) ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:') ||
    normalized === '2001:db8::'
  );
}

function httpAllowed(url) {
  return HTTP_ALLOW.some((pattern) => pattern.test(url));
}

function shouldIgnore(url) {
  return IGNORE_HOSTS.some((pattern) => pattern.test(normalizeHost(url.hostname)));
}

async function defaultLookup(hostname) {
  return dns.lookup(hostname, { all: true, verbatim: true });
}

async function validateUrlPolicy(value, {
  lookupImpl = defaultLookup,
  previousUrl = null,
} = {}) {
  let url;
  try {
    url = value instanceof URL ? new URL(value.href) : new URL(value);
  } catch {
    throw new LinkPolicyError('invalid-url', `invalid URL: ${sanitizeUrlForEvidence(value)}`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new LinkPolicyError('forbidden-scheme', `non-HTTP(S) scheme is forbidden: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new LinkPolicyError('credentials-forbidden', 'URL credentials/userinfo are forbidden');
  }
  if (url.port && !((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80'))) {
    throw new LinkPolicyError('forbidden-port', `non-default port is forbidden: ${url.port}`);
  }

  const hostname = normalizeHost(url.hostname);
  if (!hostname) throw new LinkPolicyError('missing-host', 'URL host is missing');
  if (BAD_HOSTS.has(hostname)) throw new LinkPolicyError('forbidden-host', `known browser-bad/SSL-bad host: ${hostname}`);
  if (previousUrl && previousUrl.protocol === 'https:' && url.protocol === 'http:') {
    throw new LinkPolicyError('https-downgrade', 'HTTPS redirect downgrade to HTTP is forbidden');
  }
  if (url.protocol === 'http:' && !httpAllowed(url.href)) {
    throw new LinkPolicyError('plain-http', 'plain HTTP is not allowlisted');
  }

  let addresses;
  if (net.isIP(hostname)) {
    addresses = [{ address: hostname, family: net.isIP(hostname) }];
  } else {
    try {
      addresses = await lookupImpl(hostname);
    } catch (error) {
      error.code ||= 'DNS_LOOKUP_FAILED';
      throw error;
    }
  }
  if (!Array.isArray(addresses)) addresses = [addresses];
  if (!addresses.length) throw new LinkPolicyError('dns-empty', `DNS returned no addresses for ${hostname}`);

  const normalizedAddresses = addresses.map((entry) => ({
    address: String(entry && entry.address || ''),
    family: Number(entry && entry.family) || net.isIP(String(entry && entry.address || '')),
  }));
  const blocked = normalizedAddresses.filter((entry) => isForbiddenAddress(entry.address));
  if (blocked.length) {
    throw new LinkPolicyError('blocked-address', `private/reserved destination is forbidden for ${hostname}`, {
      families: blocked.map((entry) => entry.family),
    });
  }

  return { url, hostname, addresses: normalizedAddresses };
}

function createPinnedLookup(record) {
  const address = String(record && record.address || '');
  const family = Number(record && record.family);
  const detectedFamily = net.isIP(address);
  if (!detectedFamily || ![4, 6].includes(family) || family !== detectedFamily) {
    throw new TypeError('pinned DNS address record is invalid');
  }
  return (_hostname, options, callback) => {
    if (options && options.all) {
      callback(null, [{ address, family }]);
      return;
    }
    callback(null, address, family);
  };
}

function requestOnce(url, method, {
  address,
  timeoutMs = TIMEOUT_MS,
  maxProbeBytes = MAX_PROBE_BYTES,
} = {}) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'http:' ? http : https;
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(value);
    };

    const request = client.request(url, {
      method,
      timeout: timeoutMs,
      lookup: createPinnedLookup(address),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GBSourceAudit/2.0; +https://gospod-bog.ru)',
        Accept: 'text/html,application/xhtml+xml,application/pdf,application/json,text/plain,image/*;q=0.8,*/*;q=0.2',
        ...(method === 'GET' ? { Range: 'bytes=0-4095' } : {}),
      },
    }, (response) => {
      const headers = Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value.join(', ') : String(value || '')]));
      if (method === 'HEAD') {
        response.resume();
        finish(null, { status: response.statusCode, location: headers.location || '', headers, method, bodyPrefix: Buffer.alloc(0), bytesRead: 0 });
        return;
      }
      const chunks = [];
      let bytesRead = 0;
      let storedBytes = 0;
      const snapshot = (truncated) => ({
        status: response.statusCode,
        location: headers.location || '',
        headers,
        method,
        bodyPrefix: Buffer.concat(chunks),
        bytesRead,
        truncated,
      });
      response.on('data', (chunk) => {
        bytesRead += chunk.length;
        const remaining = maxProbeBytes - storedBytes;
        if (remaining > 0) {
          const prefix = chunk.subarray(0, remaining);
          chunks.push(prefix);
          storedBytes += prefix.length;
        }
        if (bytesRead > maxProbeBytes) {
          finish(null, snapshot(true));
          response.destroy();
        }
      });
      response.on('end', () => finish(null, snapshot(false)));
    });
    request.on('timeout', () => request.destroy(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })));
    request.on('error', (error) => finish(error));
    request.end();
  });
}

function normalizeContentType(value) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

function sniffContentType(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) return '';
  if (bytes.subarray(0, 4).toString('ascii') === '%PDF') return 'application/pdf';
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  const sample = bytes.subarray(0, 4096).toString('utf8').trimStart();
  if (/^(?:<!doctype\s+html|<html\b|<head\b|<body\b)/i.test(sample)) return 'text/html';
  if (/^[\[{]/.test(sample)) return 'application/json';
  if (sample && !sample.includes('\uFFFD')) return 'text/plain';
  return '';
}

function usableContentType(contentType) {
  return (
    contentType.startsWith('text/') ||
    contentType.startsWith('image/') ||
    [
      'application/pdf',
      'application/json',
      'application/xml',
      'application/xhtml+xml',
      'application/rtf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ].includes(contentType)
  );
}

function classifyTransportError(error) {
  const code = String(error && (error.code || error.name || error.message) || 'ERROR');
  if (/CERT|SSL|HOSTNAME|SELF_SIGNED|UNABLE_TO_VERIFY|DEPTH_ZERO|ENOTFOUND|EAI_AGAIN|INVALID_URL/i.test(code)) return 'hard';
  return 'warn';
}

function isSystemicTransportFailure(results) {
  const entries = Array.isArray(results) ? results : [];
  return entries.length > 0 && entries.every((entry) => (
    entry &&
    entry.result === 'warn' &&
    !Number.isInteger(entry.status) &&
    !entry.final &&
    (!Array.isArray(entry.hops) || entry.hops.length === 0)
  ));
}

async function auditUrl(source, {
  requestImpl = requestOnce,
  lookupImpl = defaultLookup,
  maxRedirects = MAX_REDIRECTS,
} = {}) {
  const evidence = {
    source: sanitizeUrlForEvidence(source),
    hops: [],
    result: 'hard',
  };
  let current;
  try {
    current = new URL(source);
  } catch {
    return { ...evidence, reason: 'invalid URL' };
  }
  const seen = new Set();
  let previousUrl = null;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const canonical = current.href;
    if (seen.has(canonical)) {
      return { ...evidence, reason: 'redirect loop detected', code: 'redirect-loop' };
    }
    seen.add(canonical);

    let policy;
    try {
      policy = await validateUrlPolicy(current, { lookupImpl, previousUrl });
    } catch (error) {
      if (error instanceof LinkPolicyError) {
        return { ...evidence, reason: error.message, code: error.code };
      }
      return { ...evidence, result: classifyTransportError(error), reason: String(error.code || error.message || error).slice(0, 180) };
    }

    let response;
    try {
      response = await requestImpl(policy.url, 'HEAD', { address: policy.addresses[0] });
      if (response.status === 405) response = await requestImpl(policy.url, 'GET', { address: policy.addresses[0] });
    } catch (headError) {
      try {
        response = await requestImpl(policy.url, 'GET', { address: policy.addresses[0] });
      } catch (getError) {
        return { ...evidence, result: classifyTransportError(getError), reason: String(getError.code || getError.message || getError).slice(0, 180) };
      }
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      if (!response.location) return { ...evidence, reason: `HTTP ${response.status} redirect lacks Location`, code: 'missing-location' };
      if (hop === maxRedirects) return { ...evidence, reason: `redirect chain exceeded ${maxRedirects} hops`, code: 'redirect-overflow' };
      let next;
      try {
        next = new URL(response.location, policy.url);
      } catch {
        return { ...evidence, reason: `HTTP ${response.status} redirect has invalid Location`, code: 'invalid-location' };
      }
      evidence.hops.push({
        status: response.status,
        from: sanitizeUrlForEvidence(policy.url),
        to: sanitizeUrlForEvidence(next),
        policy: 'pass',
      });
      previousUrl = policy.url;
      current = next;
      continue;
    }

    const status = Number(response.status || 0);
    if (status === 404 || status === 410) return { ...evidence, final: sanitizeUrlForEvidence(policy.url), status, reason: `HTTP ${status}` };
    if ([401, 403, 405, 418, 429].includes(status) || status >= 500) {
      return { ...evidence, result: 'warn', final: sanitizeUrlForEvidence(policy.url), status, reason: `HTTP ${status}` };
    }
    if (status < 200 || status >= 400) return { ...evidence, final: sanitizeUrlForEvidence(policy.url), status, reason: `unusable HTTP ${status}` };

    let contentType = normalizeContentType(response.headers && response.headers['content-type']);
    let inspected = response;
    if (!usableContentType(contentType)) {
      try {
        inspected = response.method === 'GET' ? response : await requestImpl(policy.url, 'GET', { address: policy.addresses[0] });
      } catch (error) {
        return { ...evidence, result: classifyTransportError(error), final: sanitizeUrlForEvidence(policy.url), status, reason: String(error.code || error.message || error).slice(0, 180) };
      }
      contentType = normalizeContentType(inspected.headers && inspected.headers['content-type']);
      if (!usableContentType(contentType)) contentType = sniffContentType(inspected.bodyPrefix);
    }
    if (!usableContentType(contentType)) {
      return { ...evidence, final: sanitizeUrlForEvidence(policy.url), status, reason: `unusable final content type: ${contentType || '(missing/unknown)'}`, code: 'unusable-content' };
    }

    return {
      ...evidence,
      result: 'pass',
      final: sanitizeUrlForEvidence(policy.url),
      status,
      contentType,
      method: inspected.method,
    };
  }

  return { ...evidence, reason: `redirect chain exceeded ${maxRedirects} hops`, code: 'redirect-overflow' };
}

function walk(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (entry.name === 'dist' && path.resolve(directory) === REPO_ROOT && AUDIT_ROOT === REPO_ROOT) continue;
      walk(path.join(directory, entry.name), output);
    } else if (entry.isFile()) {
      output.push(path.join(directory, entry.name));
    }
  }
  return output;
}

function relative(filePath) {
  return path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
}

function extractLinks() {
  const files = walk(AUDIT_ROOT).filter((file) => file.endsWith('.html'));
  const links = new Map();
  const pattern = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = pattern.exec(html))) {
      const raw = match[1].replace(/&amp;/g, '&').trim();
      if (!/^https?:\/\//i.test(raw)) continue;
      let url;
      try {
        url = new URL(raw);
      } catch {
        const key = `invalid:${raw}`;
        if (!links.has(key)) links.set(key, { url: raw, files: new Set(), invalid: true });
        links.get(key).files.add(relative(file));
        continue;
      }
      if (shouldIgnore(url)) continue;
      if (!links.has(url.href)) links.set(url.href, { url: url.href, files: new Set(), invalid: false });
      links.get(url.href).files.add(relative(file));
    }
  }
  return [...links.values()].map((entry) => ({ ...entry, files: [...entry.files].sort() }));
}

async function runPool(items, worker) {
  let index = 0;
  async function next() {
    while (index < items.length) await worker(items[index++]);
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, next));
}

async function main() {
  if (AUDIT_ROOT !== REPO_ROOT && !AUDIT_ROOT.startsWith(`${REPO_ROOT}${path.sep}`)) {
    console.error('source-link-audit --root must stay inside repository');
    process.exitCode = 2;
    return;
  }

  const links = extractLinks();
  const results = [];
  await runPool(links, async (item) => {
    const result = item.invalid
      ? { source: sanitizeUrlForEvidence(item.url), hops: [], result: 'hard', reason: 'invalid URL' }
      : await auditUrl(item.url);
    results.push({ ...result, files: item.files });
  });
  results.sort((left, right) => left.source.localeCompare(right.source));

  const hard = results.filter((entry) => entry.result === 'hard');
  const warn = results.filter((entry) => entry.result === 'warn');
  const report = {
    schemaVersion: 2,
    auditRoot: relative(AUDIT_ROOT) || '.',
    generatedAt: new Date().toISOString(),
    checked: results.length,
    passed: results.filter((entry) => entry.result === 'pass').length,
    warnings: warn.length,
    hardErrors: hard.length,
    systemicTransportFailure: isSystemicTransportFailure(results),
    results,
  };

  if (JSON_OUT) {
    const outputPath = path.resolve(REPO_ROOT, JSON_OUT);
    if (outputPath !== REPO_ROOT && !outputPath.startsWith(`${REPO_ROOT}${path.sep}`)) throw new Error('--json-out must stay inside repository');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  console.log('\nGB SOURCE LINK AUDIT');
  console.log(`Audit root: ${report.auditRoot}`);
  console.log(`Checked external links: ${report.checked}`);
  if (warn.length) {
    console.log(`⚠️ Warnings (${warn.length}) — bot blocks/rate limits/timeouts, review if persistent:`);
    for (const entry of warn.slice(0, 40)) console.log(`- ${entry.reason}: ${entry.source} (${entry.files.slice(0, 3).join(', ')})`);
  }
  if (hard.length) {
    console.log(`❌ Hard errors (${hard.length}):`);
    for (const entry of hard) console.log(`- ${entry.reason}: ${entry.source} (${entry.files.slice(0, 4).join(', ')})`);
    process.exitCode = 1;
    return;
  }
  if (report.systemicTransportFailure) {
    console.log('❌ Every external link failed before an HTTP response; network acceptance is invalid');
    process.exitCode = 1;
    return;
  }
  console.log('✅ Source links hard-check passed');
}

module.exports = {
  LinkPolicyError,
  auditUrl,
  createPinnedLookup,
  isForbiddenAddress,
  requestOnce,
  isSystemicTransportFailure,
  sanitizeUrlForEvidence,
  sniffContentType,
  usableContentType,
  validateUrlPolicy,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}
