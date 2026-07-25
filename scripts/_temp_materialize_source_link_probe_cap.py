#!/usr/bin/env python3
from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'scripts/source-link-audit.js'
CONTRACT = ROOT / 'scripts/source-link-audit-contract-test.cjs'
SOURCE_CONTRACT = ROOT / 'scripts/source-link-audit-source-contract-test.cjs'
SELF = ROOT / 'scripts/_temp_materialize_source_link_probe_cap.py'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one exact anchor, found {count}')
    return text.replace(old, new, 1)


source = SOURCE.read_text(encoding='utf-8')
source = replace_once(
    source,
    """      const chunks = [];\n      let bytesRead = 0;\n      response.on('data', (chunk) => {\n        bytesRead += chunk.length;\n        if (bytesRead > maxProbeBytes) {\n          request.destroy(Object.assign(new Error(`response probe exceeded ${maxProbeBytes} bytes`), { code: 'RESPONSE_TOO_LARGE' }));\n          return;\n        }\n        chunks.push(chunk);\n      });\n      response.on('end', () => finish(null, {\n        status: response.statusCode,\n        location: headers.location || '',\n        headers,\n        method,\n        bodyPrefix: Buffer.concat(chunks),\n        bytesRead,\n      }));\n""",
    """      const chunks = [];\n      let bytesRead = 0;\n      let storedBytes = 0;\n      const snapshot = (truncated) => ({\n        status: response.statusCode,\n        location: headers.location || '',\n        headers,\n        method,\n        bodyPrefix: Buffer.concat(chunks),\n        bytesRead,\n        truncated,\n      });\n      response.on('data', (chunk) => {\n        bytesRead += chunk.length;\n        const remaining = maxProbeBytes - storedBytes;\n        if (remaining > 0) {\n          const prefix = chunk.subarray(0, remaining);\n          chunks.push(prefix);\n          storedBytes += prefix.length;\n        }\n        if (bytesRead > maxProbeBytes) {\n          finish(null, snapshot(true));\n          response.destroy();\n        }\n      });\n      response.on('end', () => finish(null, snapshot(false)));\n""",
    'replace oversized-body error with bounded prefix snapshot',
)
source = replace_once(
    source,
    """  if (/CERT|SSL|HOSTNAME|SELF_SIGNED|UNABLE_TO_VERIFY|DEPTH_ZERO|ENOTFOUND|EAI_AGAIN|INVALID_URL/i.test(code)) return 'hard';\n  if (/RESPONSE_TOO_LARGE/i.test(code)) return 'hard';\n  return 'warn';\n""",
    """  if (/CERT|SSL|HOSTNAME|SELF_SIGNED|UNABLE_TO_VERIFY|DEPTH_ZERO|ENOTFOUND|EAI_AGAIN|INVALID_URL/i.test(code)) return 'hard';\n  return 'warn';\n""",
    'remove obsolete response-too-large transport error',
)
source = replace_once(
    source,
    "if ([403, 405, 429].includes(status) || status >= 500) {",
    "if ([401, 403, 405, 418, 429].includes(status) || status >= 500) {",
    'classify bot and auth blocks as warnings',
)
source = replace_once(
    source,
    """  createPinnedLookup,\n  isForbiddenAddress,\n""",
    """  createPinnedLookup,\n  isForbiddenAddress,\n  requestOnce,\n""",
    'export bounded native request probe',
)
SOURCE.write_text(source, encoding='utf-8')

contract = CONTRACT.read_text(encoding='utf-8')
contract = replace_once(
    contract,
    """const fs = require('node:fs');\nconst path = require('node:path');\n""",
    """const fs = require('node:fs');\nconst http = require('node:http');\nconst path = require('node:path');\n""",
    'import local HTTP server',
)
contract = replace_once(
    contract,
    """  isSystemicTransportFailure,\n  sanitizeUrlForEvidence,\n""",
    """  isSystemicTransportFailure,\n  requestOnce,\n  sanitizeUrlForEvidence,\n""",
    'import bounded native request probe',
)
contract = replace_once(
    contract,
    """  await test('all pre-HTTP warnings invalidate network acceptance', async () => {\n    assert.equal(isSystemicTransportFailure([]), false);\n    assert.equal(isSystemicTransportFailure([{ result: 'warn', reason: 'ERR_INVALID_IP_ADDRESS', hops: [] }]), true);\n    assert.equal(isSystemicTransportFailure([{ result: 'warn', reason: 'timeout', status: 500, hops: [] }]), false);\n    assert.equal(isSystemicTransportFailure([{ result: 'pass', status: 200, final: 'https://example.com/', hops: [] }]), false);\n    assert.equal(isSystemicTransportFailure([{ result: 'warn', reason: 'timeout', hops: [{ status: 301 }] }]), false);\n  });\n\n  await test('approved HTTPS redirect records complete chain', async () => {\n""",
    """  await test('all pre-HTTP warnings invalidate network acceptance', async () => {\n    assert.equal(isSystemicTransportFailure([]), false);\n    assert.equal(isSystemicTransportFailure([{ result: 'warn', reason: 'ERR_INVALID_IP_ADDRESS', hops: [] }]), true);\n    assert.equal(isSystemicTransportFailure([{ result: 'warn', reason: 'timeout', status: 500, hops: [] }]), false);\n    assert.equal(isSystemicTransportFailure([{ result: 'pass', status: 200, final: 'https://example.com/', hops: [] }]), false);\n    assert.equal(isSystemicTransportFailure([{ result: 'warn', reason: 'timeout', hops: [{ status: 301 }] }]), false);\n  });\n\n  await test('native GET stores a bounded prefix instead of rejecting a large page', async () => {\n    const payload = Buffer.from(`<!doctype html><html><body>${'x'.repeat(128 * 1024)}</body></html>`);\n    const server = http.createServer((_request, response) => {\n      response.writeHead(200, { 'content-type': 'application/octet-stream' });\n      response.end(payload);\n    });\n    await new Promise((resolve, reject) => {\n      server.once('error', reject);\n      server.listen(0, '127.0.0.1', resolve);\n    });\n    try {\n      const port = server.address().port;\n      const result = await requestOnce(new URL(`http://probe.example:${port}/`), 'GET', {\n        address: { address: '127.0.0.1', family: 4 },\n        timeoutMs: 5000,\n        maxProbeBytes: 4096,\n      });\n      assert.equal(result.status, 200);\n      assert.equal(result.truncated, true);\n      assert.equal(result.bodyPrefix.length, 4096);\n      assert.equal(sniffContentType(result.bodyPrefix), 'text/html');\n    } finally {\n      await new Promise((resolve) => server.close(resolve));\n    }\n  });\n\n  await test('approved HTTPS redirect records complete chain', async () => {\n""",
    'add bounded native response fixture',
)
contract = replace_once(
    contract,
    """  await test('404 is hard while transient 500 is warning', async () => {\n""",
    """  await test('404 is hard while bot and transient statuses are warnings', async () => {\n""",
    'rename status classification fixture',
)
contract = replace_once(
    contract,
    """    assert.equal(server.result, 'warn');\n    assert.equal(server.status, 500);\n  });\n""",
    """    assert.equal(server.result, 'warn');\n    assert.equal(server.status, 500);\n\n    const botBlock = await auditUrl('https://allowed.example/bot', {\n      requestImpl: scripted({\n        'HEAD https://allowed.example/bot': response({ status: 418 }),\n      }),\n      lookupImpl: publicLookup,\n    });\n    assert.equal(botBlock.result, 'warn');\n    assert.equal(botBlock.status, 418);\n  });\n""",
    'add bot-block status fixture',
)
CONTRACT.write_text(contract, encoding='utf-8')

source_contract = SOURCE_CONTRACT.read_text(encoding='utf-8')
source_contract = replace_once(
    source_contract,
    """  must('systemic transport failure exits nonzero', source, /if \\(report\\.systemicTransportFailure\\)[\\s\\S]{0,220}process\\.exitCode = 1/);\n\n  must('workflow owns source contract path', workflow, /- 'scripts\\/source-link-audit-source-contract-test\\.cjs'/);\n""",
    """  must('systemic transport failure exits nonzero', source, /if \\(report\\.systemicTransportFailure\\)[\\s\\S]{0,220}process\\.exitCode = 1/);\n  must('native response probe caps stored bytes', source, /const remaining = maxProbeBytes - storedBytes;[\\s\\S]{0,300}finish\\(null, snapshot\\(true\\)\\);[\\s\\S]{0,80}response\\.destroy\\(\\)/);\n  mustNot('large response is treated as transport failure', source, /RESPONSE_TOO_LARGE/);\n  must('bot and auth response statuses remain warnings', source, /\\[401, 403, 405, 418, 429\\]\\.includes\\(status\\)/);\n\n  must('workflow owns source contract path', workflow, /- 'scripts\\/source-link-audit-source-contract-test\\.cjs'/);\n""",
    'add bounded probe source invariants',
)
source_contract = replace_once(
    source_contract,
    """  ['systemic failure nonzero guard removed', { source: source.replace(/  if \\(report\\.systemicTransportFailure\\) \\{[\\s\\S]*?\\n  \\}\\n  console\\.log\\('✅ Source links hard-check passed'\\);/, "  console.log('✅ Source links hard-check passed');"), workflow }],\n];\n""",
    """  ['systemic failure nonzero guard removed', { source: source.replace(/  if \\(report\\.systemicTransportFailure\\) \\{[\\s\\S]*?\\n  \\}\\n  console\\.log\\('✅ Source links hard-check passed'\\);/, "  console.log('✅ Source links hard-check passed');"), workflow }],\n  ['bounded prefix storage removed', { source: source.replace('const remaining = maxProbeBytes - storedBytes;', 'const remaining = chunk.length;'), workflow }],\n  ['large response transport error reintroduced', { source: source.replace('          finish(null, snapshot(true));\\n          response.destroy();', "          request.destroy(Object.assign(new Error('probe too large'), { code: 'RESPONSE_TOO_LARGE' }));"), workflow }],\n  ['HTTP 418 bot block made hard', { source: source.replace('[401, 403, 405, 418, 429]', '[401, 403, 405, 429]'), workflow }],\n];\n""",
    'add bounded probe adversarial mutations',
)
SOURCE_CONTRACT.write_text(source_contract, encoding='utf-8')

for relative in [
    'scripts/source-link-audit.js',
    'scripts/source-link-audit-contract-test.cjs',
    'scripts/source-link-audit-source-contract-test.cjs',
]:
    subprocess.run(['node', '--check', relative], cwd=ROOT, check=True)
subprocess.run(['node', 'scripts/source-link-audit-contract-test.cjs'], cwd=ROOT, check=True)
subprocess.run(['node', 'scripts/source-link-audit-source-contract-test.cjs'], cwd=ROOT, check=True)
subprocess.run(['node', 'scripts/run-actionlint.mjs', '-no-color', '.github/workflows/source-links.yml'], cwd=ROOT, check=True)

SELF.unlink()
subprocess.run([
    'git', 'add',
    'scripts/source-link-audit.js',
    'scripts/source-link-audit-contract-test.cjs',
    'scripts/source-link-audit-source-contract-test.cjs',
    'scripts/_temp_materialize_source_link_probe_cap.py',
], cwd=ROOT, check=True)
subprocess.run(['git', 'commit', '-m', 'fix(links): cap native response probes without false hard failures'], cwd=ROOT, check=True)
subprocess.run(['git', 'push', 'origin', 'HEAD'], cwd=ROOT, check=True)
