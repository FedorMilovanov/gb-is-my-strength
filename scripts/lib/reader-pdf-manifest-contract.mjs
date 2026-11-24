import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateReaderPdfManifest } from './reader-pdf-manifest.mjs';

const dir = mkdtempSync(join(tmpdir(), 'gb-reader-pdf-contract-'));
try {
  const revision = 'a'.repeat(40);
  const route = '/articles/fixture/';
  const registry = { errors: [], entries: [{ route, routeRole: 'reading', owner: 'astro', status: 'production-dist' }] };
  const approvals = [{ route, scope: 'standalone-pdf-distribution', status: 'approved', evidence: 'TEST FIXTURE ONLY' }];
  // Synthetic signature fixture tests byte/manifest authority, not PDF quality or rights.
  const content = Buffer.from('%PDF-1.7\nfixture\n%%EOF\n');
  const sha256 = createHash('sha256').update(content).digest('hex');
  const filename = 'fixture.pdf';
  const url = '/reader-pdf/' + sha256 + '/' + filename;
  const entry = { route, url, filename, sha256, bytes: content.length };
  const manifest = { schemaVersion: 1, sourceRevision: revision, rendererProfile: 'reader-native-a4-v1', entries: [entry] };
  const base = { manifest, registry, approvals, revision, distRoot: dir };
  const withEntry = patch => ({ ...manifest, entries: [{ ...entry, ...patch }] });
  const check = patch => validateReaderPdfManifest({ ...base, ...patch });
  mkdirSync(join(dir, 'reader-pdf', sha256), { recursive: true });
  const file = join(dir, 'reader-pdf', sha256, filename);
  writeFileSync(file, content);
  assert.deepEqual(check({}), { routes: 1, artifacts: 1 });
  const negatives = [
    ['no rights', { approvals: [] }, /no explicit/],
    ['wrong scope', { approvals: [{ ...approvals[0], scope: 'html' }] }, /Expected values/],
    ['missing evidence', { approvals: [{ ...approvals[0], evidence: '' }] }, /rights evidence/],
    ['stale revision', { revision: 'b'.repeat(40) }, /stale/],
    ['duplicate registry route', { registry: { errors: [], entries: [...registry.entries, ...registry.entries] } }, /duplicate registry/],
    ['invalid registry', { registry: { ...registry, errors: ['fixture'] } }, /invalid public/],
    ['hold route', { registry: { errors: [], entries: [{ ...registry.entries[0], status: 'hold' }] } }, /not an eligible/],
    ['external URL', { manifest: withEntry({ url: 'https://example.com/file.pdf' }) }, /invalid content-addressed/],
    ['traversal', { manifest: withEntry({ filename: '../fixture.pdf' }) }, /invalid download/],
    ['wrong length', { manifest: withEntry({ bytes: content.length + 1 }) }, /byte count mismatch/],
    ['duplicate route', { manifest: { ...manifest, entries: [entry, entry] } }, /duplicate PDF route/],
  ];
  for (const [name, patch, message] of negatives) assert.throws(() => check(patch), message, name);
  writeFileSync(file, Buffer.from(content.toString().replace('fixture', 'changed')));
  assert.throws(() => check({}), /digest mismatch/);
  writeFileSync(file, content);
  writeFileSync(join(dir, 'reader-pdf', sha256, 'unlisted.pdf'), content);
  assert.throws(() => check({}), /unlisted PDF artifact/);
  rmSync(join(dir, 'reader-pdf'), { recursive: true });
  assert.deepEqual(check({ manifest: { ...manifest, entries: [] }, approvals: [] }), { routes: 0, artifacts: 0 });
  console.log('Reader PDF publication boundary: 2 positive + 13 negative cases PASS');
} finally { rmSync(dir, { recursive: true, force: true }); }
