// Prepare a publication overlay from freshly revalidated PDF stages.
// Never mutate the served dist or infer rights from article publication.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, lstatSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { prepareReaderPdfBundle } from './reader-pdf-bundle.mjs';
import { validateReaderPdfManifest } from './reader-pdf-manifest.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const routePattern = /^\/(?:[a-z0-9-]+\/)+$/;
const revisionPattern = /^[a-f0-9]{40}$/;
const pdfUrlPattern = /^\/reader-pdf\/[a-f0-9]{64}\/[a-z0-9][a-z0-9-]*\.pdf$/;
const marker = 'gb-reader-pdf';

function routeFile(root, route) {
  assert(routePattern.test(route), 'invalid projection route');
  let file = resolve(root);
  const base = lstatSync(file);
  assert(base.isDirectory() && !base.isSymbolicLink(), 'invalid source dist');
  for (const segment of route.split('/').filter(Boolean)) {
    file = join(file, segment);
    const info = lstatSync(file);
    assert(info.isDirectory() && !info.isSymbolicLink(), 'invalid route directory');
  }
  file = join(file, 'index.html');
  const info = lstatSync(file);
  assert(info.isFile() && !info.isSymbolicLink(), 'invalid route HTML');
  return file;
}

export function injectReaderPdfMetadata(html, entry, revision) {
  assert(revisionPattern.test(revision), 'invalid source revision');
  assert(routePattern.test(entry.route), 'invalid projection route');
  assert(pdfUrlPattern.test(entry.url), 'invalid PDF URL');
  assert.equal(entry.url, '/reader-pdf/' + entry.sha256 + '/' + entry.filename);
  assert(Number.isSafeInteger(entry.bytes) && entry.bytes > 4, 'invalid PDF bytes');
  assert(!new RegExp(marker, 'i').test(html), 'duplicate PDF metadata');
  // The canonical build emits a normal HTML head. Fail closed on ambiguous HTML.
  const heads = [...html.matchAll(/<\/head\s*>/gi)];
  assert.equal(heads.length, 1, 'exactly one closing head required');
  const metadata = '<meta name="' + marker + '" content="' + entry.url
    + '" data-route="' + entry.route + '" data-revision="' + revision
    + '" data-bytes="' + entry.bytes + '">';
  const at = heads[0].index;
  return html.slice(0, at) + metadata + '\n' + html.slice(at);
}

export function prepareReaderPdfProjection(input) {
  const { sourceDist, registry, approvals, revision } = input;
  assert(revisionPattern.test(revision), 'invalid source revision');
  // Check source path ownership before the staging validator reads it.
  for (const stageDir of input.stages) {
    const receipt = JSON.parse(readFileSync(join(stageDir, 'receipt.json'), 'utf8'));
    routeFile(sourceDist, receipt.route);
  }
  const bundle = prepareReaderPdfBundle(input);
  try {
    const { dir, manifest } = bundle;
    const routes = [];
    for (const entry of manifest.entries) {
      const source = readFileSync(routeFile(sourceDist, entry.route));
      const stageDir = input.stages.find(s => JSON.parse(readFileSync(join(s,'receipt.json'),'utf8')).route === entry.route);
      const receipt = JSON.parse(readFileSync(join(stageDir, 'receipt.json'), 'utf8'));
      assert.equal(digest(source), receipt.sourceHash, 'source HTML changed since staging');
      const output = Buffer.from(injectReaderPdfMetadata(source.toString('utf8'), entry, revision), 'utf8');
      const file = join(dir, entry.route, 'index.html');
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, output, { flag: 'wx' });
      routes.push({ route: entry.route, sourceHash: digest(source), projectedHash: digest(output), url: entry.url });
    }
    const result = validateReaderPdfManifest({ manifest, registry, approvals, revision, distRoot: dir });
    const receipt = { schemaVersion: 1, sourceRevision: revision, scope: 'unserved-publication-overlay', routes, artifacts: result.artifacts };
    writeFileSync(join(dir, 'projection-receipt.json'), JSON.stringify(receipt, null, 2) + '\n', {flag:'wx'});
    return { dir, manifest, receipt };
  } catch (error) {
    rmSync(bundle.dir, { recursive: true, force: true });
    throw error;
  }
}
