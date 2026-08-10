#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  extractWriterLease,
  validateWriterLease,
  assertLeaseTransition,
  assertLeaseClaim,
} from './writer-lease.mjs';

const A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const C = 'c'.repeat(40);
const ownerA = 'agent-session-aaaaaaaa';
const ownerB = 'agent-session-bbbbbbbb';
const branch = 'lane/system-writer-lease-20260810';
const pr = 1701;
const base = {
  version: 1,
  laneId: 'system/writer-lease-20260810',
  pr,
  branch,
  ownerToken: ownerA,
  generation: 1,
  acquisitionSha: A,
  status: 'active',
  handoff: null,
  retirement: null,
};
const marker = (lease) => `body\n<!-- GB_WRITER_LEASE_V1\n${JSON.stringify(lease, null, 2)}\nGB_WRITER_LEASE_V1 -->\n`;

assert.deepEqual(validateWriterLease(extractWriterLease(marker(base)), { pr, branch }), base);
assert.throws(() => extractWriterLease('no lease'), /exactly one writer lease marker/);
assert.throws(() => extractWriterLease(marker(base) + marker(base)), /exactly one writer lease marker/);

// Two agents may share one GitHub login; machine ownership is the opaque lease token.
const sharedGithubLogin = 'FedorMilovanov';
assert.equal(sharedGithubLogin, sharedGithubLogin);
const foreignOwner = { ...base, ownerToken: ownerB };
assert.throws(() => assertLeaseClaim({ snapshotRaw: base, liveRaw: foreignOwner, expectedHead: A, liveHead: A, pr, branch }), /ownerToken changed/);

// A queued branch-ref writer must reject a foreign head move even when the lease body did not change.
assert.throws(() => assertLeaseClaim({ snapshotRaw: base, liveRaw: base, expectedHead: A, liveHead: B, pr, branch }), /live PR head/);

// Handoff is explicit, rotates owner token and increments generation by exactly one.
const handoff = {
  ...base,
  ownerToken: ownerB,
  generation: 2,
  acquisitionSha: B,
  handoff: {
    fromOwnerToken: ownerA,
    fromGeneration: 1,
    toOwnerToken: ownerB,
    toGeneration: 2,
    atHead: B,
  },
};
assert.deepEqual(assertLeaseTransition(base, handoff, B), handoff);
assert.throws(() => assertLeaseClaim({ snapshotRaw: base, liveRaw: handoff, expectedHead: B, liveHead: B, pr, branch }), /ownerToken changed|generation changed/);
assert.doesNotThrow(() => assertLeaseClaim({ snapshotRaw: handoff, liveRaw: handoff, expectedHead: B, liveHead: B, pr, branch }));

// Stale generation replay fails closed even if a caller copies the successor owner token.
const staleReplay = { ...handoff, generation: 1, handoff: null };
assert.throws(() => assertLeaseClaim({ snapshotRaw: staleReplay, liveRaw: handoff, expectedHead: B, liveHead: B, pr, branch }), /generation changed|handoff record changed/);

// Implicit stealing and skipped generations are invalid.
assert.throws(() => assertLeaseTransition(base, { ...handoff, generation: 3, handoff: { ...handoff.handoff, toGeneration: 3 } }, B), /current generation - 1|increment generation/);
assert.throws(() => assertLeaseTransition(base, { ...handoff, ownerToken: ownerA, handoff: { ...handoff.handoff, toOwnerToken: ownerA } }, B), /different owner token|rotate ownerToken/);
assert.throws(() => assertLeaseTransition(base, { ...handoff, acquisitionSha: C, handoff: { ...handoff.handoff, atHead: C } }, B), /current exact head/);

// Retirement is explicit, bounded by Branch Lifecycle v4 disposition, and never TTL/timestamp based.
const retired = {
  ...handoff,
  status: 'retired',
  retirement: {
    atHead: C,
    reason: 'successor merged and predecessor disposition recorded',
    disposition: 'SUPERSEDED_VERIFIED',
  },
};
assert.deepEqual(assertLeaseTransition(handoff, retired, C), retired);
assert.throws(() => assertLeaseClaim({ snapshotRaw: retired, liveRaw: retired, expectedHead: C, liveHead: C, pr, branch }), /active lease/);
const badDisposition = { ...retired, retirement: { ...retired.retirement, disposition: 'STALE_BY_AGE' } };
assert.throws(() => validateWriterLease(badDisposition), /not a final Branch Lifecycle v4 class/);
const ttlLease = { ...base, expiresAt: '2026-08-11T00:00:00Z' };
assert.throws(() => validateWriterLease(ttlLease), /keys must be exactly/);

// Read-only auditors do not invoke lease claims; lease library itself has no mutation side effect.
assert.equal(typeof assertLeaseClaim, 'function');
console.log('✅ Writer Lease v1 contract: owner identity, queued-head CAS, stale replay, handoff and retirement passed');
