#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {
  auditUrl,
  createPinnedLookup,
  isForbiddenAddress,
  isSystemicTransportFailure,
  requestOnce,
  sanitizeUrlForEvidence,
  sniffContentType,
  usableContentType,
  validateUrlPolicy,
} = require('./source-link-audit.js');

const ROOT = path.resolve(__dirname, '..');
const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];
const response = ({
  status = 200,
  location = '',
  contentType = 'text/html',
  method = 'HEAD',
  body = Buffer.alloc(0),
} = {}) => ({
  status,
  location,
  method,
  headers: contentType ? { 'content-type': contentType } : {},
  bodyPrefix: Buffer.isBuffer(body) ? body : Buffer.from(body),
  bytesRead: Buffer.byteLength(body),
});

function scripted(entries, calls = []) {
  const queues = new Map(
    Object.entries(entries).map(([key, value]) => [key, Array.isArray(value) ? [...value] : [value]]),
  );
  return async (url, method, options) => {
    const key = `${method} ${url.href}`;
    calls.push({ key, address: options && options.address });
    const queue = queues.get(key);
    assert.ok(queue && queue.length, `unexpected request: ${key}`);
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next;
  };
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

async function main() {
  await test('pinned lookup supports scalar and all-address callback shapes', async () => {
    const lookup = createPinnedLookup({ address: '93.184.216.34', family: 4 });
    const scalar = await new Promise((resolve, reject) => {
      lookup('allowed.example', { all: false }, (error, address, family) => {
        if (error) reject(error);
        else resolve({ address, family });
      });
    });
    assert.deepEqual(scalar, { address: '93.184.216.34', family: 4 });

    const all = await new Promise((resolve, reject) => {
      lookup('allowed.example', { all: true }, (error, addresses) => {
        if (error) reject(error);
        else resolve(addresses);
      });
    });
    assert.deepEqual(all, [{ address: '93.184.216.34', family: 4 }]);

    assert.throws(() => createPinnedLookup({ address: '', family: 4 }), /pinned DNS address record is invalid/);
    assert.throws(() => createPinnedLookup({ address: '93.184.216.34', family: 6 }), /pinned DNS address record is invalid/);
  });

  await test('all pre-HTTP warnings invalidate network acceptance', async () => {
    assert.equal(isSystemicTransportFailure([]), false);
    assert.equal(isSystemicTransportFailure([{ result: 'warn', reason: 'ERR_INVALID_IP_ADDRESS', hops: [] }]), true);
    assert.equal(isSystemicTransportFailure([{ result: 'warn', reason: 'timeout', status: 500, hops: [] }]), false);
    assert.equal(isSystemicTransportFailure([{ result: 'pass', status: 200, final: 'https://example.com/', hops: [] }]), false);
    assert.equal(isSystemicTransportFailure([{ result: 'warn', reason: 'timeout', hops: [{ status: 301 }] }]), false);
  });

  await test('native GET stores a bounded prefix instead of rejecting a large page', async () => {
    const payload = Buffer.from(`<!doctype html><html><body>${'x'.repeat(128 * 1024)}</body></html>`);
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/octet-stream' });
      response.end(payload);
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    try {
      const port = server.address().port;
      const result = await requestOnce(new URL(`http://probe.example:${port}/`), 'GET', {
        address: { address: '127.0.0.1', family: 4 },
        timeoutMs: 5000,
        maxProbeBytes: 4096,
      });
      assert.equal(result.status, 200);
      assert.equal(result.truncated, true);
      assert.equal(result.bodyPrefix.length, 4096);
      assert.equal(sniffContentType(result.bodyPrefix), 'text/html');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  await test('approved HTTPS redirect records complete chain', async () => {
    const calls = [];
    const requestImpl = scripted({
      'HEAD https://allowed.example/start': response({ status: 301, location: '/final' }),
      'HEAD https://allowed.example/final': response({ status: 200, contentType: 'text/html' }),
    }, calls);
    const result = await auditUrl('https://allowed.example/start', { requestImpl, lookupImpl: publicLookup });
    assert.equal(result.result, 'pass');
    assert.equal(result.final, 'https://allowed.example/final');
    assert.deepEqual(result.hops, [{
      status: 301,
      from: 'https://allowed.example/start',
      to: 'https://allowed.example/final',
      policy: 'pass',
    }]);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].address.address, '93.184.216.34', 'request is pinned to validated DNS result');
  });

  await test('allowed host redirect to forbidden host blocks before request', async () => {
    const calls = [];
    const requestImpl = scripted({
      'HEAD https://allowed.example/start': response({ status: 302, location: 'https://arthistoryresources.net/source' }),
    }, calls);
    const result = await auditUrl('https://allowed.example/start', { requestImpl, lookupImpl: publicLookup });
    assert.equal(result.result, 'hard');
    assert.equal(result.code, 'forbidden-host');
    assert.equal(calls.length, 1, 'forbidden destination is never requested');
  });

  await test('HTTPS to HTTP downgrade blocks even for legacy allowlist', async () => {
    const requestImpl = scripted({
      'HEAD https://allowed.example/start': response({ status: 301, location: 'http://www.w3.org/TR/example' }),
    });
    const result = await auditUrl('https://allowed.example/start', { requestImpl, lookupImpl: publicLookup });
    assert.equal(result.result, 'hard');
    assert.equal(result.code, 'https-downgrade');
  });

  await test('relative multi-hop redirects resolve safely', async () => {
    const requestImpl = scripted({
      'HEAD https://allowed.example/a/start': response({ status: 302, location: '../b' }),
      'HEAD https://allowed.example/b': response({ status: 307, location: './final' }),
      'HEAD https://allowed.example/final': response({ status: 200, contentType: 'application/pdf' }),
    });
    const result = await auditUrl('https://allowed.example/a/start', { requestImpl, lookupImpl: publicLookup });
    assert.equal(result.result, 'pass');
    assert.equal(result.hops.length, 2);
    assert.equal(result.final, 'https://allowed.example/final');
  });

  await test('redirect loop is blocking', async () => {
    const requestImpl = scripted({
      'HEAD https://allowed.example/a': response({ status: 302, location: '/b' }),
      'HEAD https://allowed.example/b': response({ status: 302, location: '/a' }),
    });
    const result = await auditUrl('https://allowed.example/a', { requestImpl, lookupImpl: publicLookup });
    assert.equal(result.result, 'hard');
    assert.equal(result.code, 'redirect-loop');
  });

  await test('redirect hop overflow is blocking', async () => {
    const requestImpl = scripted({
      'HEAD https://allowed.example/a': response({ status: 302, location: '/b' }),
      'HEAD https://allowed.example/b': response({ status: 302, location: '/c' }),
    });
    const result = await auditUrl('https://allowed.example/a', {
      requestImpl,
      lookupImpl: publicLookup,
      maxRedirects: 1,
    });
    assert.equal(result.result, 'hard');
    assert.equal(result.code, 'redirect-overflow');
  });

  await test('redirect without Location is blocking', async () => {
    const result = await auditUrl('https://allowed.example/a', {
      requestImpl: scripted({
        'HEAD https://allowed.example/a': response({ status: 301, location: '' }),
      }),
      lookupImpl: publicLookup,
    });
    assert.equal(result.result, 'hard');
    assert.equal(result.code, 'missing-location');
  });

  await test('redirect with invalid Location is blocking', async () => {
    const result = await auditUrl('https://allowed.example/a', {
      requestImpl: scripted({
        'HEAD https://allowed.example/a': response({ status: 302, location: 'http://[' }),
      }),
      lookupImpl: publicLookup,
    });
    assert.equal(result.result, 'hard');
    assert.equal(result.code, 'invalid-location');
  });

  await test('private DNS answer blocks before request', async () => {
    let requested = false;
    const result = await auditUrl('https://allowed.example/a', {
      lookupImpl: async () => [{ address: '10.20.30.40', family: 4 }],
      requestImpl: async () => {
        requested = true;
        throw new Error('must not request');
      },
    });
    assert.equal(result.result, 'hard');
    assert.equal(result.code, 'blocked-address');
    assert.equal(requested, false);
  });

  await test('literal localhost and private addresses are blocking', async () => {
    for (const url of ['https://127.0.0.1/a', 'https://[::1]/a', 'https://169.254.1.1/a']) {
      const result = await auditUrl(url, { requestImpl: async () => assert.fail('must not request') });
      assert.equal(result.result, 'hard', url);
      assert.equal(result.code, 'blocked-address', url);
    }
  });

  await test('credentials and non-http schemes fail policy', async () => {
    await assert.rejects(
      validateUrlPolicy('https://user:secret@allowed.example/a', { lookupImpl: publicLookup }),
      /credentials\/userinfo are forbidden/,
    );
    await assert.rejects(
      validateUrlPolicy('file:///etc/passwd', { lookupImpl: publicLookup }),
      /non-HTTP\(S\) scheme is forbidden/,
    );
  });

  await test('404 is hard while bot and transient statuses are warnings', async () => {
    const missing = await auditUrl('https://allowed.example/missing', {
      requestImpl: scripted({
        'HEAD https://allowed.example/missing': response({ status: 404 }),
      }),
      lookupImpl: publicLookup,
    });
    assert.equal(missing.result, 'hard');
    assert.equal(missing.status, 404);

    const server = await auditUrl('https://allowed.example/server', {
      requestImpl: scripted({
        'HEAD https://allowed.example/server': response({ status: 500 }),
      }),
      lookupImpl: publicLookup,
    });
    assert.equal(server.result, 'warn');
    assert.equal(server.status, 500);

    const botBlock = await auditUrl('https://allowed.example/bot', {
      requestImpl: scripted({
        'HEAD https://allowed.example/bot': response({ status: 418 }),
      }),
      lookupImpl: publicLookup,
    });
    assert.equal(botBlock.result, 'warn');
    assert.equal(botBlock.status, 418);
  });

  await test('unusable final content blocks', async () => {
    const invalidBytes = Buffer.from([0xff, 0xfe, 0xfd, 0xfc]);
    const result = await auditUrl('https://allowed.example/binary', {
      requestImpl: scripted({
        'HEAD https://allowed.example/binary': response({ status: 200, contentType: 'application/octet-stream' }),
        'GET https://allowed.example/binary': response({ status: 200, contentType: 'application/octet-stream', method: 'GET', body: invalidBytes }),
      }),
      lookupImpl: publicLookup,
    });
    assert.equal(result.result, 'hard');
    assert.equal(result.code, 'unusable-content');
  });

  await test('missing content type may be proven by PDF magic', async () => {
    const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n');
    const result = await auditUrl('https://allowed.example/document', {
      requestImpl: scripted({
        'HEAD https://allowed.example/document': response({ status: 200, contentType: '' }),
        'GET https://allowed.example/document': response({ status: 200, contentType: '', method: 'GET', body: pdf }),
      }),
      lookupImpl: publicLookup,
    });
    assert.equal(result.result, 'pass');
    assert.equal(result.contentType, 'application/pdf');
  });

  await test('evidence strips credentials, fragments and sensitive query values', async () => {
    const sanitized = sanitizeUrlForEvidence('https://user:secret@allowed.example/a?token=secret&x=1#fragment');
    assert.equal(sanitized, 'https://allowed.example/a?redacted=1');
    assert.ok(!sanitized.includes('secret'));
  });

  await test('private and reserved address classifier covers critical ranges', async () => {
    for (const address of ['0.0.0.0', '10.0.0.1', '100.64.0.1', '127.0.0.1', '169.254.1.1', '172.16.0.1', '192.168.1.1', '198.18.0.1', '203.0.113.1', '224.0.0.1', '::', '::1', 'fc00::1', 'fe80::1', '2001:db8::1']) {
      assert.equal(isForbiddenAddress(address), true, address);
    }
    for (const address of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111']) {
      assert.equal(isForbiddenAddress(address), false, address);
    }
  });

  await test('content sniffing and allowlist are explicit', async () => {
    assert.equal(sniffContentType(Buffer.from('%PDF-1.4')), 'application/pdf');
    assert.equal(sniffContentType(Buffer.from('<!doctype html><html>')), 'text/html');
    assert.equal(usableContentType('application/pdf'), true);
    assert.equal(usableContentType('application/octet-stream'), false);
  });

  await test('workflow keeps PR contract separate from scheduled network audit', async () => {
    const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/source-links.yml'), 'utf8');
    assert.match(workflow, /pull_request:\s*\n\s*paths:/);
    assert.match(workflow, /contract:\s*\n/);
    assert.match(workflow, /if: github\.event_name == 'pull_request'/);
    assert.match(workflow, /source-links:\s*\n\s*if: github\.event_name != 'pull_request'/);
    assert.match(workflow, /node scripts\/source-link-audit-contract-test\.cjs/);
    assert.match(workflow, /--json-out reports\/source-links\/report\.json/);
    assert.match(workflow, /Upload source-link chain evidence/);
    assert.match(workflow, /if: always\(\)/);
  });

  console.log('SOURCE LINK REDIRECT POLICY CONTRACT: PASS');
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
