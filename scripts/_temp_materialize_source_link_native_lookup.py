#!/usr/bin/env python3
from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts/source-link-audit.js"
CONTRACT = ROOT / "scripts/source-link-audit-contract-test.cjs"
SOURCE_CONTRACT = ROOT / "scripts/source-link-audit-source-contract-test.cjs"
SELF = ROOT / "scripts/_temp_materialize_source_link_native_lookup.py"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one exact anchor, found {count}")
    return text.replace(old, new, 1)


source = SOURCE.read_text(encoding="utf-8")
source = replace_once(
    source,
    """  return { url, hostname, addresses: normalizedAddresses };\n}\n\nfunction requestOnce(url, method, {\n""",
    """  return { url, hostname, addresses: normalizedAddresses };\n}\n\nfunction createPinnedLookup(record) {\n  const address = String(record && record.address || '');\n  const family = Number(record && record.family);\n  const detectedFamily = net.isIP(address);\n  if (!detectedFamily || ![4, 6].includes(family) || family !== detectedFamily) {\n    throw new TypeError('pinned DNS address record is invalid');\n  }\n  return (_hostname, options, callback) => {\n    if (options && options.all) {\n      callback(null, [{ address, family }]);\n      return;\n    }\n    callback(null, address, family);\n  };\n}\n\nfunction requestOnce(url, method, {\n""",
    "insert dual-shape pinned lookup",
)
source = replace_once(
    source,
    "lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),",
    "lookup: createPinnedLookup(address),",
    "wire pinned lookup into native request",
)
source = replace_once(
    source,
    """function classifyTransportError(error) {\n  const code = String(error && (error.code || error.name || error.message) || 'ERROR');\n  if (/CERT|SSL|HOSTNAME|SELF_SIGNED|UNABLE_TO_VERIFY|DEPTH_ZERO|ENOTFOUND|EAI_AGAIN|INVALID_URL/i.test(code)) return 'hard';\n  if (/RESPONSE_TOO_LARGE/i.test(code)) return 'hard';\n  return 'warn';\n}\n\nasync function auditUrl(source, {\n""",
    """function classifyTransportError(error) {\n  const code = String(error && (error.code || error.name || error.message) || 'ERROR');\n  if (/CERT|SSL|HOSTNAME|SELF_SIGNED|UNABLE_TO_VERIFY|DEPTH_ZERO|ENOTFOUND|EAI_AGAIN|INVALID_URL/i.test(code)) return 'hard';\n  if (/RESPONSE_TOO_LARGE/i.test(code)) return 'hard';\n  return 'warn';\n}\n\nfunction isSystemicTransportFailure(results) {\n  const entries = Array.isArray(results) ? results : [];\n  return entries.length > 0 && entries.every((entry) => (\n    entry &&\n    entry.result === 'warn' &&\n    !Number.isInteger(entry.status) &&\n    !entry.final &&\n    (!Array.isArray(entry.hops) || entry.hops.length === 0)\n  ));\n}\n\nasync function auditUrl(source, {\n""",
    "insert systemic transport failure classifier",
)
source = replace_once(
    source,
    """    warnings: warn.length,\n    hardErrors: hard.length,\n    results,\n""",
    """    warnings: warn.length,\n    hardErrors: hard.length,\n    systemicTransportFailure: isSystemicTransportFailure(results),\n    results,\n""",
    "record systemic transport failure in report",
)
source = replace_once(
    source,
    """  if (hard.length) {\n    console.log(`❌ Hard errors (${hard.length}):`);\n    for (const entry of hard) console.log(`- ${entry.reason}: ${entry.source} (${entry.files.slice(0, 4).join(', ')})`);\n    process.exitCode = 1;\n    return;\n  }\n  console.log('✅ Source links hard-check passed');\n""",
    """  if (hard.length) {\n    console.log(`❌ Hard errors (${hard.length}):`);\n    for (const entry of hard) console.log(`- ${entry.reason}: ${entry.source} (${entry.files.slice(0, 4).join(', ')})`);\n    process.exitCode = 1;\n    return;\n  }\n  if (report.systemicTransportFailure) {\n    console.log('❌ Every external link failed before an HTTP response; network acceptance is invalid');\n    process.exitCode = 1;\n    return;\n  }\n  console.log('✅ Source links hard-check passed');\n""",
    "fail closed on all pre-http warnings",
)
source = replace_once(
    source,
    """module.exports = {\n  LinkPolicyError,\n  auditUrl,\n  isForbiddenAddress,\n""",
    """module.exports = {\n  LinkPolicyError,\n  auditUrl,\n  createPinnedLookup,\n  isForbiddenAddress,\n  isSystemicTransportFailure,\n""",
    "export native lookup contracts",
)
SOURCE.write_text(source, encoding="utf-8")

contract = CONTRACT.read_text(encoding="utf-8")
contract = replace_once(
    contract,
    """const {\n  auditUrl,\n  isForbiddenAddress,\n  sanitizeUrlForEvidence,\n""",
    """const {\n  auditUrl,\n  createPinnedLookup,\n  isForbiddenAddress,\n  isSystemicTransportFailure,\n  sanitizeUrlForEvidence,\n""",
    "import native lookup contracts",
)
contract = replace_once(
    contract,
    """async function main() {\n  await test('approved HTTPS redirect records complete chain', async () => {\n""",
    """async function main() {\n  await test('pinned lookup supports scalar and all-address callback shapes', async () => {\n    const lookup = createPinnedLookup({ address: '93.184.216.34', family: 4 });\n    const scalar = await new Promise((resolve, reject) => {\n      lookup('allowed.example', { all: false }, (error, address, family) => {\n        if (error) reject(error);\n        else resolve({ address, family });\n      });\n    });\n    assert.deepEqual(scalar, { address: '93.184.216.34', family: 4 });\n\n    const all = await new Promise((resolve, reject) => {\n      lookup('allowed.example', { all: true }, (error, addresses) => {\n        if (error) reject(error);\n        else resolve(addresses);\n      });\n    });\n    assert.deepEqual(all, [{ address: '93.184.216.34', family: 4 }]);\n\n    assert.throws(() => createPinnedLookup({ address: '', family: 4 }), /pinned DNS address record is invalid/);\n    assert.throws(() => createPinnedLookup({ address: '93.184.216.34', family: 6 }), /pinned DNS address record is invalid/);\n  });\n\n  await test('all pre-HTTP warnings invalidate network acceptance', async () => {\n    assert.equal(isSystemicTransportFailure([]), false);\n    assert.equal(isSystemicTransportFailure([{ result: 'warn', reason: 'ERR_INVALID_IP_ADDRESS', hops: [] }]), true);\n    assert.equal(isSystemicTransportFailure([{ result: 'warn', reason: 'timeout', status: 500, hops: [] }]), false);\n    assert.equal(isSystemicTransportFailure([{ result: 'pass', status: 200, final: 'https://example.com/', hops: [] }]), false);\n    assert.equal(isSystemicTransportFailure([{ result: 'warn', reason: 'timeout', hops: [{ status: 301 }] }]), false);\n  });\n\n  await test('approved HTTPS redirect records complete chain', async () => {\n""",
    "add runtime native lookup regressions",
)
CONTRACT.write_text(contract, encoding="utf-8")

source_contract = SOURCE_CONTRACT.read_text(encoding="utf-8")
source_contract = replace_once(
    source_contract,
    "const { sanitizeUrlForEvidence } = require('./source-link-audit.js');",
    "const { createPinnedLookup, isSystemicTransportFailure, sanitizeUrlForEvidence } = require('./source-link-audit.js');",
    "import source lookup contracts",
)
source_contract = replace_once(
    source_contract,
    """  mustNot('malformed URL fallback returns raw input', source, /catch\\s*\\{\\s*return\\s+(?:raw|String\\(value)/);\n\n  must('workflow owns source contract path', workflow, /- 'scripts\\/source-link-audit-source-contract-test\\.cjs'/);\n""",
    """  mustNot('malformed URL fallback returns raw input', source, /catch\\s*\\{\\s*return\\s+(?:raw|String\\(value)/);\n  must('pinned lookup supports Node all-address mode', source, /function createPinnedLookup[\\s\\S]{0,500}options && options\\.all[\\s\\S]{0,180}callback\\(null, \\[\\{ address, family \\}\\]\\)/);\n  must('native request uses validated pinned lookup', source, /lookup: createPinnedLookup\\(address\\)/);\n  must('report records systemic transport failure', source, /systemicTransportFailure: isSystemicTransportFailure\\(results\\)/);\n  must('systemic transport failure exits nonzero', source, /if \\(report\\.systemicTransportFailure\\)[\\s\\S]{0,220}process\\.exitCode = 1/);\n\n  must('workflow owns source contract path', workflow, /- 'scripts\\/source-link-audit-source-contract-test\\.cjs'/);\n""",
    "add source lookup invariants",
)
source_contract = replace_once(
    source_contract,
    """assert.equal(\n  sanitizeUrlForEvidence('https://user:secret@example.com/path?token=value#fragment'),\n  'https://example.com/path?redacted=1',\n);\n\nconst mutations = [\n""",
    """assert.equal(\n  sanitizeUrlForEvidence('https://user:secret@example.com/path?token=value#fragment'),\n  'https://example.com/path?redacted=1',\n);\n\nconst pinnedLookup = createPinnedLookup({ address: '93.184.216.34', family: 4 });\npinnedLookup('example.com', { all: true }, (error, addresses) => {\n  assert.ifError(error);\n  assert.deepEqual(addresses, [{ address: '93.184.216.34', family: 4 }]);\n});\nassert.throws(() => createPinnedLookup({ address: '93.184.216.34', family: 6 }), /pinned DNS address record is invalid/);\nassert.equal(isSystemicTransportFailure([{ result: 'warn', reason: 'ERR_INVALID_IP_ADDRESS', hops: [] }]), true);\nassert.equal(isSystemicTransportFailure([{ result: 'pass', status: 200, final: 'https://example.com/', hops: [] }]), false);\n\nconst mutations = [\n""",
    "add executable source lookup fixtures",
)
source_contract = replace_once(
    source_contract,
    """  ['evidence upload made optional', { source, workflow: workflow.replace('if-no-files-found: error', 'if-no-files-found: warn') }],\n];\n""",
    """  ['evidence upload made optional', { source, workflow: workflow.replace('if-no-files-found: error', 'if-no-files-found: warn') }],\n  ['all-address lookup support removed', { source: source.replace(\n    "if (options && options.all) {\\n      callback(null, [{ address, family }]);\\n      return;\\n    }",\n    "if (false) {\\n      callback(null, [{ address, family }]);\\n      return;\\n    }",\n  ), workflow }],\n  ['request bypasses pinned lookup helper', { source: source.replace('lookup: createPinnedLookup(address)', 'lookup: (_hostname, _options, callback) => callback(null, address.address, address.family)'), workflow }],\n  ['systemic failure report field removed', { source: source.replace('    systemicTransportFailure: isSystemicTransportFailure(results),\\n', ''), workflow }],\n  ['systemic failure nonzero guard removed', { source: source.replace(/  if \\(report\\.systemicTransportFailure\\) \\{[\\s\\S]*?\\n  \\}\\n  console\\.log\\('✅ Source links hard-check passed'\\);/, "  console.log('✅ Source links hard-check passed');"), workflow }],\n];\n""",
    "add native lookup adversarial mutations",
)
SOURCE_CONTRACT.write_text(source_contract, encoding="utf-8")

for relative in [
    "scripts/source-link-audit.js",
    "scripts/source-link-audit-contract-test.cjs",
    "scripts/source-link-audit-source-contract-test.cjs",
]:
    subprocess.run(["node", "--check", relative], cwd=ROOT, check=True)
subprocess.run(["node", "scripts/source-link-audit-contract-test.cjs"], cwd=ROOT, check=True)
subprocess.run(["node", "scripts/source-link-audit-source-contract-test.cjs"], cwd=ROOT, check=True)
subprocess.run(["node", "scripts/run-actionlint.mjs", "-no-color", ".github/workflows/source-links.yml"], cwd=ROOT, check=True)

SELF.unlink()
subprocess.run([
    "git", "add",
    "scripts/source-link-audit.js",
    "scripts/source-link-audit-contract-test.cjs",
    "scripts/source-link-audit-source-contract-test.cjs",
    "scripts/_temp_materialize_source_link_native_lookup.py",
], cwd=ROOT, check=True)
subprocess.run(["git", "commit", "-m", "fix(links): repair pinned DNS lookup on modern Node"], cwd=ROOT, check=True)
subprocess.run(["git", "push", "origin", "HEAD"], cwd=ROOT, check=True)
