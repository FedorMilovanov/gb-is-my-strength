// Build-time authority for Reader downloadable PDF artifacts. No runtime print fallback.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';

const SHA256 = /^[a-f0-9]{64}$/;
const REVISION = /^[a-f0-9]{40}$/;
const ROUTE = /^\/(?:[a-z0-9-]+\/)+$/;
const FILE = /^[a-z0-9][a-z0-9-]*\.pdf$/;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function validateReaderPdfManifest({ manifest, registry, approvals, revision, distRoot }) {
  assert(REVISION.test(revision), 'exact source revision required');
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.sourceRevision, revision, 'stale PDF manifest');
  assert.equal(manifest.rendererProfile, 'reader-native-a4-v1');
  assert(Array.isArray(registry.entries) && Array.isArray(registry.errors));
  assert.equal(registry.errors.length, 0, 'invalid public surface registry');
  assert(Array.isArray(approvals), 'explicit PDF rights approvals required');
  assert(lstatSync(distRoot).isDirectory() && !lstatSync(distRoot).isSymbolicLink(), 'invalid PDF dist root');
  assert(Array.isArray(manifest.entries), 'PDF entries must be an array');
  const routes = new Map(registry.entries.map(entry => [entry.route, entry]));
  assert.equal(routes.size, registry.entries.length, 'duplicate registry routes');
  const rights = new Map();
  for (const grant of approvals) {
    assert(ROUTE.test(grant.route) && !rights.has(grant.route), 'invalid or duplicate approval route');
    assert.equal(grant.scope, 'standalone-pdf-distribution');
    assert.equal(grant.status, 'approved');
    assert(typeof grant.evidence === 'string' && grant.evidence.trim(), 'rights evidence required');
    rights.set(grant.route, grant);
  }
  const seen = new Set();
  const artifacts = new Set();
  for (const entry of manifest.entries) {
    const { route, url, filename, sha256, bytes } = entry;
    assert(ROUTE.test(route) && !seen.has(route), 'invalid or duplicate PDF route');
    seen.add(route);
    const surface = routes.get(route);
    assert(surface?.routeRole === 'reading' && surface.owner === 'astro' &&
      surface.status === 'production-dist', 'not an eligible public reader route');
    assert(rights.has(route), 'no explicit standalone PDF distribution approval');
    assert(SHA256.test(sha256), 'invalid PDF digest');
    assert(FILE.test(filename), 'invalid download filename');
    assert.equal(url, '/reader-pdf/' + sha256 + '/' + filename, 'invalid content-addressed PDF URL');
    assert(!artifacts.has(url), 'duplicate artifact URL');
    artifacts.add(url);
    assert(Number.isSafeInteger(bytes) && bytes > 4, 'invalid PDF size');
    const dir = join(distRoot, 'reader-pdf', sha256);
    const file = join(dir, filename);
    // Never resolve an untrusted manifest path or follow symlinks out of dist.
    for (const candidate of [join(distRoot, 'reader-pdf'), dir, file]) {
      assert(!lstatSync(candidate).isSymbolicLink(), 'symlink PDF artifact rejected');
    }
    assert(lstatSync(file).isFile(), 'not a regular PDF file');
    const content = readFileSync(file);
    assert.equal(content.subarray(0, 5).toString('ascii'), '%PDF-');
    assert.equal(content.length, bytes, 'PDF byte count mismatch');
    assert.equal(digest(content), sha256, 'PDF digest mismatch');
  }
  // A stale or unlisted artifact must not silently be published by Pages.
  const root = join(distRoot, 'reader-pdf');
  let directories;
  try { directories = readdirSync(root, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT' && artifacts.size === 0) return { routes: 0, artifacts: 0 }; throw error; }
  assert(!lstatSync(root).isSymbolicLink(), 'symlink PDF root rejected');
  for (const item of directories) {
    if (item.name === 'manifest.json' && item.isFile()) continue;
    assert(item.isDirectory() && SHA256.test(item.name), 'unlisted PDF output');
    const files = readdirSync(join(root, item.name), { withFileTypes: true });
    assert(files.length > 0, 'empty PDF output directory');
    for (const f of files) {
      assert(f.isFile() && artifacts.has('/reader-pdf/' + item.name + '/' + f.name), 'unlisted PDF artifact');
    }
  }
  return { routes: seen.size, artifacts: artifacts.size };
}
