#!/usr/bin/env node
/** Read-only transfer/contract regressions. All mutations are disposable fixtures. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildTransfer, verifyTransfer, TRANSFER_FILES, GUARD_PATH, projectHistoryGuard, assertCatalogReturnProjection, SHARED_CATALOG_RETURN_PATH } from './journal-editorial-transfer.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = 'b2ae614730b0c2e164d3b07453797074253d9698';
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const blob = (bytes) => createHash('sha1').update(`blob ${Buffer.byteLength(bytes)}\0`).update(bytes).digest('hex');
fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
function temporary(t) {
  const directory = fs.mkdtempSync(path.join(root, '.cache/journal-transfer-unit-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function fixture(t, phase = 'applied') {
  const directory = temporary(t), target = path.join(directory, 'target'), kit = path.join(directory, 'kit');
  fs.mkdirSync(target); fs.mkdirSync(kit);
  const patch = 'fixture patch bytes; not an application claim\n';
  const files = TRANSFER_FILES.map((name, index) => ({ path: name, before: index === 0 ? { mode: '100644', blob: blob('before\n') } : null, after: { mode: '100644', blob: blob(`after:${name}\n`) } }));
  const protectedPath = 'src/data/journal/g3ProductMetadata.ts';
  const excludedPath = 'src/data/journal/g3HistoryDraftSources.ts';
  const manifest = { version: 2, base, source: head, patch: 'public-editorial.patch', patchSha256: sha256(patch), files, preserved: [{ path: protectedPath, state: { mode: '100644', blob: blob('baseline date owner\n') } }], excludedAdded: [{ path: excludedPath, state: null }] };
  const write = (name, bytes) => { const file = path.join(target, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
  if (phase === 'applied') for (const name of TRANSFER_FILES) write(name, `after:${name}\n`);
  else write(TRANSFER_FILES[0], 'before\n');
  write(protectedPath, 'baseline date owner\n');
  fs.writeFileSync(path.join(kit, 'public-editorial.patch'), patch);
  const manifestPath = path.join(kit, 'transfer.json');
  const save = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest)); save();
  return { target, kit, manifest, manifestPath, write, save, protectedPath, excludedPath, verify: () => verifyTransfer({ manifestPath, target, phase }) };
}

test('public transfer is exactly40 files: accepted public35 plus bounded catalog navigation/SSR return;no other held/shared owners', () => {
  assert.equal(TRANSFER_FILES.length, 40);
  assert.equal(new Set(TRANSFER_FILES).size, 40);
  for (const name of ['scripts/lib/articles-print-pdf.py', 'scripts/articles-editorial-native-diagnostic.mjs']) assert.ok(TRANSFER_FILES.includes(name));
  assert.deepEqual(TRANSFER_FILES.filter((name) => name.startsWith('src/components/article-pilots/_shared/')), [SHARED_CATALOG_RETURN_PATH]);
  assert.ok(TRANSFER_FILES.every((name) => !/G3History|g3History|package|^css\/|^js\/|^fonts\/|^public\/|^migration\//.test(name)));
});
test('base verification accepts exact baseline bytes and writes nothing', (t) => {
  const f = fixture(t, 'base'), before = fs.readFileSync(f.manifestPath);
  assert.equal(f.verify().checked, 42); assert.equal(f.verify().writes, 0);
  assert.deepEqual(fs.readFileSync(f.manifestPath), before);
});
test('applied verification accepts exact allowlisted bytes', (t) => {
  assert.equal(fixture(t).verify().transferred, 40);
});
test('selected-file drift fails closed', (t) => {
  const f = fixture(t); f.write(TRANSFER_FILES[0], 'wrong\n');
  assert.throws(f.verify, /Pinned content mismatch/);
});
test('preserved date-owner drift fails closed', (t) => {
  const f = fixture(t); f.write(f.protectedPath, 'overwritten date owner\n');
  assert.throws(f.verify, /Pinned content mismatch: src\/data\/journal\/g3ProductMetadata/);
});
test('excluded new history data must stay absent', (t) => {
  const f = fixture(t); f.write(f.excludedPath, 'unexpected history import\n');
  assert.throws(f.verify, /Must remain absent/);
});
test('patch tampering fails before target verification', (t) => {
  const f = fixture(t); fs.appendFileSync(path.join(f.kit, 'public-editorial.patch'), 'changed');
  assert.throws(f.verify, /patch digest mismatch/);
});
test('manifest path traversal is refused', (t) => {
  const f = fixture(t); f.manifest.preserved[0].path = '../outside'; f.save();
  assert.throws(f.verify, /Unsafe\/duplicate manifest path/);
});
test('a reduced allowlist is refused', (t) => {
  const f = fixture(t); f.manifest.files.pop(); f.save();
  assert.throws(f.verify, /Transfer allowlist changed/);
});
test('missing selected file fails closed', (t) => {
  const f = fixture(t); fs.unlinkSync(path.join(f.target, TRANSFER_FILES[0]));
  assert.throws(f.verify, /Missing pinned file/);
});
for (const name of ['scripts/lib/articles-print-pdf.py', 'scripts/articles-editorial-native-diagnostic.mjs']) {
  test(`missing catalog diagnostic dependency fails closed: ${name}`, (t) => {
    const f = fixture(t); fs.unlinkSync(path.join(f.target, name));
    assert.throws(f.verify, /Missing pinned file/);
  });
}
test('unexpected symlink cannot substitute for a transferred regular file', (t) => {
  const f = fixture(t), file = path.join(f.target, TRANSFER_FILES[0]);
  fs.unlinkSync(file); fs.symlinkSync(f.protectedPath, file);
  assert.throws(f.verify, /Unexpected symlink mode/);
});
test('unpinned branch names are refused without creating an artifact', (t) => {
  const out = path.join(temporary(t), 'out');
  assert.throws(() => buildTransfer({ repo: root, base: 'HEAD', source: head, out }), /full pinned 40-character/);
  assert.ok(!fs.existsSync(out));
});
test('unknown and mixed CLI options are refused', () => {
  for (const args of [['--apply', 'anything'], ['--base', base, '--verify', 'anything']]) {
    const result = spawnSync(process.execPath, ['scripts/journal-editorial-transfer.mjs', ...args], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /Journal transfer FAIL/);
  }
});
test('public-only contract rejects typos instead of silently ignoring options', () => {
  const result = spawnSync(process.execPath, ['scripts/journal-editorial-contract.mjs', '--public-onyl'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Unknown option/);
});

// The public-only adapter skips only held presentation dependencies, not gates.
function isolatedContract(t, shape = 'legacy') {
  const directory = temporary(t);
  const names = ['scripts/journal-editorial-contract.mjs',
    ...['g3PublicationHandoff.ts', 'g3SourceBibliography.ts', 'g3ProductMetadata.ts', 'journalProductMetadata.ts', 'g3HistoryDraftMetadata.ts'].map((name) => `src/data/journal/${name}`),
    ...['G3Dossier.astro', 'JournalLanding.astro', 'JournalEditorialShell.astro', 'JournalMasthead.astro', 'G3HistoryArticle.astro', 'G3HistoryFeature.astro', 'journalEditorial.css', 'g3History.css'].map((name) => `src/components/journal/${name}`)];
  for (const name of names) { const p = path.join(directory, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.copyFileSync(path.join(root, name), p); }
  // Test both unchanged authority representations; this writes TEST FIXTURES only.
  const historyFile = path.join(directory, 'src/data/journal/g3HistoryDraftMetadata.ts');
  let historyMetadata = fs.readFileSync(historyFile, 'utf8').replace(/(?:approval|candidate)ClaimIds:/, `${shape === 'modern' ? 'candidate' : 'approval'}ClaimIds:`).replace(/^  handoffStatus: '[^']*',\n/m, '');
  if (shape === 'modern') historyMetadata = historyMetadata.replace("  publicationStatus: 'PUBLICATION_HOLD',", "  publicationStatus: 'PUBLICATION_HOLD',\n  handoffStatus: 'NOT_ISSUED',");
  fs.writeFileSync(historyFile, historyMetadata);
  for (const name of ['migration/page-ownership.json', 'data/route-search-policy.json', 'data/search-manifest.json', 'sitemap.xml', 'feed.xml']) {
    const p = path.join(directory, name); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, '{}');
  }
  fs.mkdirSync(path.join(directory, 'src/pages'), { recursive: true });
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
  const comparisonNames = ['src/components/journal/G3Dossier.astro', ...['g3ProductMetadata', 'g3PublicationHandoff', 'g3SourceBibliography', 'journalProductMetadata'].map((name) => `src/data/journal/${name}.ts`)];
  const baselineSourceContent = Object.fromEntries(comparisonNames.map((name) => [name, execFileSync('git', ['show', `${base}:${name}`], { cwd: root, encoding: 'utf8' })]));
  const manifest = { version: 2, base, source: head, baselineSourceContent, files: [], preserved: comparisonNames.map((name) => ({ path: name, state: { blob: blob(baselineSourceContent[name]) } })) };
  const mf = path.join(directory, 'comparison.json'); fs.writeFileSync(mf, JSON.stringify(manifest));
  const replace = (name, from, to) => { const p = path.join(directory, name), content = fs.readFileSync(p, 'utf8'); assert.ok(content.includes(from)); fs.writeFileSync(p, content.replace(from, to)); };
  const run = (flags = ['--source-only', '--public-only', `--transfer=${mf}`]) => spawnSync(process.execPath, ['scripts/journal-editorial-contract.mjs', ...flags], { cwd: directory, encoding: 'utf8' });
  return { directory, replace, run, manifest, mf };
}
test('public-only operates without copying the held presentation-source module', (t) => {
  const result = isolatedContract(t).run(); assert.equal(result.status, 0, result.stderr);
});
for (const [title, name, from, to, error] of [
  ['HOLD', 'src/data/journal/g3HistoryDraftMetadata.ts', "publicationStatus: 'PUBLICATION_HOLD'", "publicationStatus: 'RELEASED'", /PUBLICATION_HOLD/],
  ['candidate set', 'src/data/journal/g3HistoryDraftMetadata.ts', "'G3-HIST-PUB-09'", "'G3-HIST-PUB-10'", /G3-HIST-PUB-/],
  ['inferred handoff', 'src/data/journal/g3HistoryDraftMetadata.ts', 'approvalClaimIds:', "handoffStatus: 'ISSUED', approvalClaimIds:", /infer\/issue/],
  ['approved scope', 'src/data/journal/g3PublicationHandoff.ts', "'G3-PUB-016'", "'G3-PUB-017'", /unchanged authority owner/],
  ['article guard', 'src/components/journal/G3HistoryArticle.astro', 'if (import.meta.env.PROD)', 'if (false)', /G3HistoryArticle must fail closed/],
  ['feature guard', 'src/components/journal/G3HistoryFeature.astro', 'if (import.meta.env.PROD)', 'if (false)', /G3HistoryFeature must fail closed/],
]) {
  test(`public-only rejects changed ${title}`, (t) => { const f = isolatedContract(t); f.replace(name, from, to); const r = f.run(); assert.notEqual(r.status, 0); assert.match(r.stderr, error); assert.doesNotMatch(r.stderr, /ERR_MODULE_NOT_FOUND/); });
}
test('public-only rejects a held public page import', (t) => {
  const f = isolatedContract(t); fs.writeFileSync(path.join(f.directory, 'src/pages/bad.astro'), 'import History from "G3HistoryFeature.astro";');
  const r = f.run(); assert.notEqual(r.status, 0); assert.match(r.stderr, /Held history activated/);
});
test('baseline comparison text cannot change without its pinned blob changing', (t) => {
  const f = isolatedContract(t); f.manifest.baselineSourceContent['src/components/journal/G3Dossier.astro'] += 'changed'; fs.writeFileSync(f.mf, JSON.stringify(f.manifest));
  const r = f.run(); assert.notEqual(r.status, 0); assert.match(r.stderr, /Baseline source blob mismatch/);
});
test('default strict mode still requires the held manuscript dependencies', (t) => {
  const r = isolatedContract(t).run(['--source-only']); assert.notEqual(r.status, 0); assert.match(r.stderr, /ERR_MODULE_NOT_FOUND/); assert.match(r.stderr, /g3HistoryDraftSources/);
});

test('public-only excludes preserved unmounted held CSS, not public CSS', (t) => {
  const f = isolatedContract(t); fs.appendFileSync(path.join(f.directory, 'src/components/journal/g3History.css'), '\n.legacy-held { color: black !important; }\n');
  const r = f.run(); assert.equal(r.status, 0, r.stderr);
  fs.appendFileSync(path.join(f.directory, 'src/components/journal/journalEditorial.css'), '\n.public { color: black !important; }\n');
  const bad = f.run(); assert.notEqual(bad.status, 0); assert.match(bad.stderr, /route-local cascade/);
});
test('default strict mode still audits held CSS when its dependencies exist', (t) => {
  const f = isolatedContract(t); fs.writeFileSync(path.join(f.directory, 'src/data/journal/g3HistoryDraftSources.ts'), execFileSync('git', ['show', '18d567b3e4c01cce194b9ffccfb8d8948b024ec7:src/data/journal/g3HistoryDraftSources.ts'], {cwd:root}));
  fs.appendFileSync(path.join(f.directory, 'src/components/journal/g3History.css'), '\n.legacy-held { color: black !important; }\n');
  const r = f.run(['--source-only']); assert.notEqual(r.status, 0); assert.match(r.stderr, /route-local cascade/);
});
test('real PROD probes use a root-relative Astro config option', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/journal-editorial-contract.mjs'), 'utf8');
  assert.match(source, /'--config', path\.relative\(root, config\)/);
  assert.match(source, /log\.includes\(expectedGuard\)/);
});

const proposedFeature = fs.readFileSync(path.join(root, GUARD_PATH), 'utf8');
const baselineFeatureFixture = '---\n/**\n * unchanged held narrative\n */\nconst locator = "baseline";\n---\n<p>Unchanged historical prose.</p>\n';
test('safety projection preserves every byte of baseline historical prose/imports', () => {
  const p = projectHistoryGuard(baselineFeatureFixture, proposedFeature);
  assert.equal(p.content.replace(`${p.guard}\n\n`, ''), baselineFeatureFixture);
  assert.ok(!p.content.includes('historySourceHref'));
});
test('an already guarded baseline needs no second guard', () => {
  const p = projectHistoryGuard(baselineFeatureFixture, proposedFeature);
  assert.equal(projectHistoryGuard(p.content, proposedFeature), null);
});
test('a source without the known production guard cannot generate a prerequisite', () => {
  assert.throws(() => projectHistoryGuard(baselineFeatureFixture, baselineFeatureFixture), /known fail-closed production guard/);
});
test('guarded verification admits only the separately pinned safety blob, not another owner', (t) => {
  const f = fixture(t), before = 'baseline feature\n', after = 'guard\nbaseline feature\n', safetyPatch = 'fixture safety patch\n';
  f.manifest.preserved.push({ path: GUARD_PATH, state: { mode: '100644', blob: blob(before) } });
  f.manifest.prerequisite = { path: GUARD_PATH, before: { mode: '100644', blob: blob(before) }, after: { mode: '100644', blob: blob(after) }, patch: 'history-production-guard.patch', patchSha256: sha256(safetyPatch) };
  fs.writeFileSync(path.join(f.kit, 'history-production-guard.patch'), safetyPatch); f.write(GUARD_PATH, before); f.save();
  const verify = () => verifyTransfer({ manifestPath: f.manifestPath, target: f.target, phase: 'guarded' });
  assert.throws(verify, /Pinned content mismatch/); f.write(GUARD_PATH, after);
  assert.equal(verify().guardOnlyPrerequisitesApplied, 1);
  f.manifest.prerequisite.path = f.protectedPath; f.save();
  assert.throws(verify, /Only the direct history-feature guard/);
});

let exportSkip = false;
try {
  execFileSync('git', ['cat-file', '-e', `${base}^{commit}`], { cwd: root, stdio: 'ignore' });
  const contract = execFileSync('git', ['show', `${head}:scripts/journal-editorial-contract.mjs`], { cwd: root, encoding: 'utf8' });
  if (!contract.includes("args.has('--public-only')")) exportSkip = 'HEAD predates public-only support; rerun on the committed final head';
} catch { exportSkip = 'Pinned canonical/source objects unavailable in this checkout'; }
test('pinned Git-object export contains only the allowlist and refuses overwrite', { skip: exportSkip }, (t) => {
  const out = path.join(temporary(t), 'export');
  const result = buildTransfer({ repo: root, base, source: head, out });
  assert.equal(result.files, 40); assert.ok(result.preserved > 1000);
  const patch = fs.readFileSync(path.join(out, 'public-editorial.patch'), 'utf8');
  const names = [...patch.matchAll(/^diff --git a\/(\S+) b\/\1$/gm)].map((match) => match[1]);
  assert.deepEqual(names.sort(), [...TRANSFER_FILES].sort());
  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'transfer.json')));
  assert.ok(Number.isFinite(Date.parse(manifest.technicalBuildInstant)));
  assert.ok(fs.readFileSync(path.join(out, 'README.md'), 'utf8').includes(`GB_BUILD_INSTANT=${JSON.stringify(manifest.technicalBuildInstant)}`));
  assert.equal(manifest.prerequisite.path, GUARD_PATH);
  assert.ok(fs.readFileSync(path.join(out, manifest.prerequisite.patch), 'utf8').includes('+if (import.meta.env.PROD)'));
  assert.ok(!fs.readFileSync(path.join(out, manifest.prerequisite.patch), 'utf8').includes('historySourceHref'));
  assert.ok(manifest.excludedChanges.includes('src/components/journal/G3HistoryArticle.astro'));
  assert.ok(manifest.excludedChanges.includes('data/scripture-search-index.json'));
  assert.throws(() => buildTransfer({ repo: root, base, source: head, out }), /overwrite an existing/);
  assert.throws(() => buildTransfer({ repo: root, base, source: head, out: 'src/not-an-artifact' }), /Output must be inside ignored/);
});

const sharedBase = execFileSync('git', ['show', `${base}:${SHARED_CATALOG_RETURN_PATH}`], {cwd:root,encoding:'utf8'});
const sharedProposed = fs.readFileSync(path.join(root, SHARED_CATALOG_RETURN_PATH), 'utf8');
test('shared return projection admits exactly two SSR lines, no runtime/asset changes',()=>{
  assert.equal(assertCatalogReturnProjection(sharedBase,sharedProposed).path,SHARED_CATALOG_RETURN_PATH);
  for(const bad of [sharedProposed.replace('e7d193e0','bad-version'),sharedProposed.replace('<ReaderActionsRuntime />','<div />'),sharedProposed.replace('<ArticlesCatalogReturn />','<ArticlesCatalogReturn /><script>bad()</script>')]){
    assert.throws(()=>assertCatalogReturnProjection(sharedBase,bad),/ONLY the conditional SSR/);
  }
});

test('public-only also accepts the unchanged modern NOT_ISSUED held schema',t=>{const r=isolatedContract(t,'modern').run();assert.equal(r.status,0,r.stderr);});
for(const [from,to,reason] of [["handoffStatus: 'NOT_ISSUED'","handoffStatus: 'ISSUED'",/NOT_ISSUED/],["'G3-HIST-PUB-09'","'G3-HIST-PUB-10'",/G3-HIST-PUB/],["candidateClaimIds:","approvalClaimIds: [], candidateClaimIds:",/Ambiguous history/]]){
  test('modern held metadata still fails closed: '+reason,t=>{const f=isolatedContract(t,'modern');f.replace('src/data/journal/g3HistoryDraftMetadata.ts',from,to);const r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,reason);});
}
