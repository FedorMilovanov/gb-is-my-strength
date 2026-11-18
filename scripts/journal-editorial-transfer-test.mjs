#!/usr/bin/env node
/** Read-only transfer/contract regressions. All mutations are disposable fixtures. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildTransfer, verifyTransfer, TRANSFER_FILES, GUARD_PATH, projectHistoryGuard } from './journal-editorial-transfer.mjs';

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
  const protectedPath = 'src/components/journal/JournalDocumentHead.astro';
  const excludedPath = 'src/data/journal/g3HistoryBibliography.ts';
  const manifest = { version: 1, base, source: head, patch: 'public-editorial.patch', patchSha256: sha256(patch), files, preserved: [{ path: protectedPath, state: { mode: '100644', blob: blob('baseline date owner\n') } }], excludedAdded: [{ path: excludedPath, state: null }] };
  const write = (name, bytes) => { const file = path.join(target, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); };
  if (phase === 'applied') for (const name of TRANSFER_FILES) write(name, `after:${name}\n`);
  else write(TRANSFER_FILES[0], 'before\n');
  write(protectedPath, 'baseline date owner\n');
  fs.writeFileSync(path.join(kit, 'public-editorial.patch'), patch);
  const manifestPath = path.join(kit, 'transfer.json');
  const save = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest)); save();
  return { target, kit, manifest, manifestPath, write, save, protectedPath, excludedPath, verify: () => verifyTransfer({ manifestPath, target, phase }) };
}

test('public transfer is exactly 11 files, not history or shared/date owners', () => {
  assert.equal(TRANSFER_FILES.length, 11);
  assert.equal(new Set(TRANSFER_FILES).size, 11);
  assert.ok(TRANSFER_FILES.every((name) => !/G3History|g3History|JournalDocumentHead|package|^css\/|^js\/|^fonts\/|^public\/|^migration\//.test(name)));
});
test('base verification accepts exact baseline bytes and writes nothing', (t) => {
  const f = fixture(t, 'base'), before = fs.readFileSync(f.manifestPath);
  assert.equal(f.verify().checked, 13); assert.equal(f.verify().writes, 0);
  assert.deepEqual(fs.readFileSync(f.manifestPath), before);
});
test('applied verification accepts exact allowlisted bytes', (t) => {
  assert.equal(fixture(t).verify().transferred, 11);
});
test('selected-file drift fails closed', (t) => {
  const f = fixture(t); f.write(TRANSFER_FILES[0], 'wrong\n');
  assert.throws(f.verify, /Pinned content mismatch/);
});
test('preserved date-owner drift fails closed', (t) => {
  const f = fixture(t); f.write(f.protectedPath, 'overwritten date owner\n');
  assert.throws(f.verify, /Pinned content mismatch: src\/components\/journal\/JournalDocumentHead/);
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
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Unknown Journal contract option/);
});

function isolatedContract(t) {
  const directory = temporary(t);
  for (const name of ['scripts/journal-editorial-contract.mjs', ...['g3PublicationHandoff.ts', 'g3SourceBibliography.ts', 'g3ProductMetadata.ts', 'g3HistoryDraftMetadata.ts'].map((file) => `src/data/journal/${file}`), ...['G3HistoryArticle.astro', 'G3HistoryFeature.astro'].map((file) => `src/components/journal/${file}`)]) {
    fs.mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
    fs.copyFileSync(path.join(root, name), path.join(directory, name));
  }
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
  const replace = (name, from, to) => {
    const file = path.join(directory, name), value = fs.readFileSync(file, 'utf8');
    assert.ok(value.includes(from)); fs.writeFileSync(file, value.replace(from, to));
  };
  const run = (flags = ['--public-only']) => spawnSync(process.execPath, ['scripts/journal-editorial-contract.mjs', ...flags], { cwd: directory, encoding: 'utf8' });
  return { directory, replace, run };
}
for (const [field, original, replacement] of [['publicationStatus', 'PUBLICATION_HOLD', 'RELEASED'], ['handoffStatus', 'NOT_ISSUED', 'ISSUED']]) {
  test(`public-only still rejects a changed history ${field}`, (t) => {
    const f = isolatedContract(t);
    f.replace('src/data/journal/g3HistoryDraftMetadata.ts', `${field}: '${original}'`, `${field}: '${replacement}'`);
    const result = f.run(); assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(original)); assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND/);
  });
}
test('public-only still rejects an expanded/unapproved public claim set', (t) => {
  const f = isolatedContract(t);
  f.replace('src/data/journal/g3PublicationHandoff.ts', "'G3-PUB-016'", "'G3-PUB-017'");
  const result = f.run(); assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must not expand the September claim set/);
});
test('public-only still requires the real history production guard', (t) => {
  const f = isolatedContract(t);
  f.replace('src/components/journal/G3HistoryArticle.astro', 'if (import.meta.env.PROD)', 'if (false)');
  const result = f.run(); assert.notEqual(result.status, 0);
  assert.match(result.stderr, /G3HistoryArticle.astro: production guard/);
});
test('public-only still rejects activation of a held history entrypoint', (t) => {
  const f = isolatedContract(t), pages = path.join(f.directory, 'src/pages'); fs.mkdirSync(pages, { recursive: true });
  fs.writeFileSync(path.join(pages, 'bad.astro'), 'import History from "G3HistoryArticle.astro";');
  const result = f.run(); assert.notEqual(result.status, 0);
  assert.match(result.stderr, /held history activation/);
});
test('default mode still requires the held presentation bibliography', (t) => {
  const result = isolatedContract(t).run([]); assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ERR_MODULE_NOT_FOUND/); assert.match(result.stderr, /g3HistoryBibliography/);
});
function legacyContract(t) {
  const f = isolatedContract(t), name = 'src/data/journal/g3HistoryDraftMetadata.ts';
  f.replace(name, 'candidateClaimIds:', 'approvalClaimIds:');
  f.replace(name, "  handoffStatus: 'NOT_ISSUED',\n", '');
  return { ...f, name };
}
test('legacy public-only still requires all nine held candidates', (t) => {
  const f = legacyContract(t); f.replace(f.name, "'G3-HIST-PUB-09'", "'G3-HIST-PUB-10'");
  const result = f.run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /Legacy held candidates must remain/);
});
test('legacy public-only still requires HOLD', (t) => {
  const f = legacyContract(t); f.replace(f.name, "publicationStatus: 'PUBLICATION_HOLD'", "publicationStatus: 'RELEASED'");
  const result = f.run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /PUBLICATION_HOLD/);
});
test('legacy public-only refuses an issued/mixed handoff field', (t) => {
  const f = legacyContract(t); f.replace(f.name, 'approvalClaimIds:', "handoffStatus: 'ISSUED', approvalClaimIds:");
  const result = f.run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /Legacy held labels must not carry/);
});
test('modern public-only refuses ambiguous legacy and current arrays', (t) => {
  const f = isolatedContract(t); f.replace('src/data/journal/g3HistoryDraftMetadata.ts', 'candidateClaimIds:', 'approvalClaimIds: [], candidateClaimIds:');
  const result = f.run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /Ambiguous history claim metadata/);
});
test('default mode does not silently normalize legacy metadata', (t) => {
  const result = legacyContract(t).run([]); assert.notEqual(result.status, 0); assert.match(result.stderr, /Ambiguous history claim metadata/);
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
  assert.equal(result.files, 11); assert.ok(result.preserved > 1000);
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
