// Prepare a verified PDF publication bundle outside the served dist.
// Promotion into a deployment is a separate release step.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateReaderPdfManifest } from './reader-pdf-manifest.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = /^[a-f0-9]{64}$/;
const routePattern = /^\/(?:[a-z0-9-]+\/)+$/;
const regular = file => { const s = lstatSync(file); assert(s.isFile() && !s.isSymbolicLink(), 'regular artifact required'); return readFileSync(file); };

export function prepareReaderPdfBundle({ stages, registry, approvals, reviews, revision, sourceDist }) {
  assert(/^[a-f0-9]{40}$/.test(revision), 'exact revision required');
  assert(Array.isArray(stages) && Array.isArray(approvals) && Array.isArray(reviews));
  assert.deepEqual(registry.errors, []);
  assert(Array.isArray(registry.entries));
  const dir = mkdtempSync(join(tmpdir(), 'gb-reader-pdf-bundle-'));
  try {
    const manifest = { schemaVersion: 1, sourceRevision: revision, rendererProfile: 'reader-native-a4-v1', entries: [] };
    for (const stageDir of stages) {
      assert(lstatSync(stageDir).isDirectory() && !lstatSync(stageDir).isSymbolicLink());
      const receipt = JSON.parse(regular(join(stageDir, 'receipt.json')));
      const { route, results } = receipt;
      assert(routePattern.test(route), 'invalid staged route');
      assert.equal(receipt.scope, 'private-qa-only');
      assert.equal(receipt.revision, revision, 'stale staged revision');
      assert.equal(receipt.rendererProfile, manifest.rendererProfile);
      assert(approvals.some(a => a.route === route && a.status === 'approved' && a.scope === 'standalone-pdf-distribution' && typeof a.evidence === 'string' && a.evidence.trim()), 'no explicit PDF approval');
      assert(registry.entries.some(e => e.route === route && e.routeRole === 'reading' && e.owner === 'astro' && e.status === 'production-dist'), 'not a public reading route');
      const review = reviews.filter(r => r.route === route);
      assert.equal(review.length, 1, 'exactly one independent text review required');
      assert(sha.test(review[0].textHash) && typeof review[0].evidence === 'string' && review[0].evidence.trim(), 'text review required');
      assert.equal(receipt.sourceHash, hash(regular(join(sourceDist, route, 'index.html'))), 'stale staged HTML');
      assert(Array.isArray(results) && results.length === 2 && results.some(r => r.width === 390) && results.some(r => r.width === 1440), 'required viewport pair missing');
      assert(Number.isSafeInteger(results[0].pages) && results[0].pages > 0 && results[0].pages === results[1].pages, 'page parity failed');
      let selected;
      for (const result of results) {
        assert.equal(result.textHash, review[0].textHash, 'reviewed text hash mismatch');
        const bytes = regular(join(stageDir, result.width + '.pdf'));
        assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
        assert.equal(bytes.length, result.bytes, 'staged byte mismatch');
        assert.equal(hash(bytes), result.sha256, 'staged digest mismatch');
        if (result.width === 1440) selected = bytes;
      }
      const sha256 = hash(selected);
      const filename = route.split('/').filter(Boolean).join('-') + '.pdf';
      const target = join(dir, 'reader-pdf', sha256);
      mkdirSync(target, { recursive: true });
      writeFileSync(join(target, filename), selected, { flag: 'wx' });
      manifest.entries.push({ route, url: '/reader-pdf/' + sha256 + '/' + filename, filename, sha256, bytes: selected.length });
    }
    manifest.entries.sort((a, b) => a.route.localeCompare(b.route));
    mkdirSync(join(dir, 'reader-pdf'), { recursive: true });
    writeFileSync(join(dir, 'reader-pdf', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    const result = validateReaderPdfManifest({ manifest, registry, approvals, revision, distRoot: dir });
    return { dir, manifest, result };
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}
