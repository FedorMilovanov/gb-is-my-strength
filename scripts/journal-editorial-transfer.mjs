#!/usr/bin/env node
/**
 * Agent 1 public Journal handoff. Reads pinned Git objects and writes ONE new,
 * ignored artifact directory. Never applies a patch, edits a ref/index, builds,
 * commits, pushes or grants publication permission. Verification is read-only.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TRANSFER_FILES = Object.freeze([
  'scripts/journal-editorial-browser-test.mjs',
  'scripts/journal-editorial-contract.mjs',
  'src/components/journal/G3Dossier.astro',
  'src/components/journal/JournalArticleOpening.astro',
  'src/components/journal/JournalBibliography.astro',
  'src/components/journal/JournalContents.astro',
  'src/components/journal/JournalLanding.astro',
  'src/components/journal/JournalMasthead.astro',
  'src/components/journal/JournalSeriesNav.astro',
  'src/components/journal/journalEditorial.css',
  'src/data/journal/g3EditorialPresentation.ts',
]);
const sharedOwners = ['css', 'js', 'fonts', 'icons', 'public', 'src/layouts', 'src/components/reader-platform', 'src/components/article-pilots/_shared', 'src/lib/asset-version.js'];
const authorityOwners = [
  'package.json', 'package-lock.json', 'migration/page-ownership.json',
  'data/route-profiles/journal.json', 'data/route-profiles/journal-dossiers-g3.json',
  'src/pages/journal/index.astro', 'src/pages/journal/dossiers/g3/index.astro',
  'src/components/journal/JournalDocumentHead.astro',
  'src/components/journal/JournalEditorialShell.astro', 'src/components/journal/JournalEditorialRail.astro',
  'src/data/journal/g3ProductMetadata.ts', 'src/data/journal/journalProductMetadata.ts',
  'src/data/journal/g3PublicationHandoff.ts', 'src/data/journal/g3SourceBibliography.ts',
];
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const objectId = (value) => createHash('sha1').update(`blob ${value.length}\0`).update(value).digest('hex');
const git = (repo, args) => execFileSync('git', ['--no-optional-locks', ...args], { cwd: repo, maxBuffer: 32 * 1024 * 1024 });
const safePath = (name) => typeof name === 'string' && !path.posix.isAbsolute(name) && !name.includes('\\') && name.split('/').every((p) => p && !['.', '..', '.git'].includes(p));
function pinnedCommit(repo, value) {
  assert.match(value || '', /^[a-f0-9]{40}$/, 'Use a full pinned 40-character commit SHA, not a branch or HEAD');
  assert.equal(git(repo, ['cat-file', '-t', value]).toString().trim(), 'commit', 'Anchor must be a commit object');
  return value;
}
function inventory(repo, commit) {
  return git(repo, ['ls-tree', '-r', '-z', '--full-tree', commit]).toString().split('\0').filter(Boolean).map((record) => {
    const [header, name] = [record.slice(0, record.indexOf('\t')), record.slice(record.indexOf('\t') + 1)];
    const [mode, type, blob] = header.split(' ');
    assert.ok(safePath(name) && type === 'blob' && ['100644', '100755', '120000'].includes(mode), `Unsupported tree entry: ${name}`);
    return { path: name, mode, blob };
  });
}
function validateManifest(manifest) {
  assert.equal(manifest.version, 1, 'Unsupported transfer manifest');
  assert.match(manifest.base || '', /^[a-f0-9]{40}$/);
  assert.match(manifest.source || '', /^[a-f0-9]{40}$/);
  assert.deepEqual(manifest.files.map((entry) => entry.path), [...TRANSFER_FILES], 'Transfer allowlist changed');
  const seen = new Set();
  for (const entry of [...manifest.files, ...manifest.preserved, ...manifest.excludedAdded]) {
    assert.ok(safePath(entry.path) && !seen.has(entry.path), `Unsafe/duplicate manifest path: ${entry.path}`);
    seen.add(entry.path);
    for (const state of manifest.files.includes(entry) ? [entry.before, entry.after] : [entry.state]) {
      if (state === null) continue;
      assert.ok(state && ['100644', '100755', '120000'].includes(state.mode), `Invalid file mode: ${entry.path}`);
      assert.match(state.blob || '', /^[a-f0-9]{40}$/);
    }
  }
}

export function buildTransfer({ repo = repoRoot, base, source, out }) {
  repo = fs.realpathSync(repo);
  assert.equal(fs.realpathSync(git(repo, ['rev-parse', '--show-toplevel']).toString().trim()), repo, 'Use the repository root');
  base = pinnedCommit(repo, base); source = pinnedCommit(repo, source);
  assert.ok(out, 'Set --out to a NEW ignored artifact directory');
  out = path.resolve(repo, out);
  const relative = path.relative(repo, out).split(path.sep).join('/');
  assert.ok(safePath(relative) && (relative.startsWith('reports/g3-editorial-wave/') || relative.startsWith('.cache/')), 'Output must be inside ignored reports/g3-editorial-wave/ or .cache/');
  assert.ok(!fs.existsSync(out), 'Refusing to overwrite an existing output directory');
  for (let current = out; current !== repo; current = path.dirname(current)) {
    try { assert.ok(!fs.lstatSync(current).isSymbolicLink(), `Output traverses a symlink: ${current}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  git(repo, ['check-ignore', '-q', '--', relative]);
  const before = new Map(inventory(repo, base).map((entry) => [entry.path, entry]));
  const after = new Map(inventory(repo, source).map((entry) => [entry.path, entry]));
  // A new shared/date/authority delta requires a fresh owner decision, not an
  // old source copy being advertised as compatible with the newer baseline.
  assert.equal(git(repo, ['diff', '--no-ext-diff', '--name-only', base, source, '--', ...sharedOwners, ...authorityOwners]).toString().trim(), '', 'Shared/date/publication owners differ; stop and re-scope the handoff');
  for (const name of authorityOwners) assert.ok(before.has(name), `Missing baseline owner: ${name}`);
  const contract = git(repo, ['show', `${source}:scripts/journal-editorial-contract.mjs`]).toString();
  assert.ok(contract.includes("args.has('--public-only')"), 'Source contract lacks the explicit --public-only transfer mode');
  const state = (entry) => entry ? { mode: entry.mode, blob: entry.blob } : null;
  const files = TRANSFER_FILES.map((name) => {
    assert.ok(after.has(name) && after.get(name).mode !== '120000', `Missing/non-regular public transfer: ${name}`);
    return { path: name, before: state(before.get(name)), after: state(after.get(name)) };
  });
  const preserved = [...before.values()].filter((entry) => !TRANSFER_FILES.includes(entry.path)).map((entry) => ({ path: entry.path, state: state(entry) }));
  const excludedAdded = [...after.values()].filter((entry) => !before.has(entry.path) && !TRANSFER_FILES.includes(entry.path)).map((entry) => ({ path: entry.path, state: null }));
  const excludedChanges = git(repo, ['diff', '--no-ext-diff', '--no-renames', '--name-only', '-z', base, source]).toString().split('\0').filter((name) => name && !TRANSFER_FILES.includes(name));
  const patch = git(repo, ['diff', '--no-ext-diff', '--no-textconv', '--binary', '--full-index', '--no-renames', base, source, '--', ...TRANSFER_FILES]);
  assert.ok(patch.length, 'No public transfer delta');
  const technicalBuildInstant = git(repo, ['show', '-s', '--format=%cI', source]).toString().trim();
  const manifest = { version: 1, base, source, technicalBuildInstant, patch: 'public-editorial.patch', patchSha256: sha256(patch), files, preserved, excludedAdded, excludedChanges, scope: 'Public Journal/dossier presentation and tests ONLY; history, date-head, shared runtime/fonts/assets/package/registries remain baseline-owned.', publication: '16 approved claims / 21 sources; nine history gates HOLD / NOT_ISSUED. Not a publication approval.', appliedByGenerator: false };
  validateManifest(manifest);
  const readme = `# Agent 1 — selective public Journal transfer\n\nBase: \`${base}\`\nSource: \`${source}\`\n\nThis is an optional extraction for the canonical owner, not a merge or an approved final design. The generator did NOT apply/build/commit/push anything. Exactly ${files.length} allowlisted files; all ${preserved.length} other baseline tracked files are pinned and checked by the read-only verifier. Excluded source-side changes are listed in transfer.json, including the held manuscript, its bibliography/metadata, generated index and documentation/tooling.\n\n## Verify before doing any integration\n\nUse the generator at the exact source commit:\n\n    node scripts/journal-editorial-transfer.mjs --verify /absolute/kit/transfer.json --target /absolute/fresh-base-export --phase base\n\nOnly the canonical owner chooses whether to apply the patch. For an isolated rehearsal, export the exact base into a NEW scratch directory (no branch/checkout change), then run git apply --check --whitespace=error and git apply there. IMPORTANT: when scratch is INSIDE another Git checkout, set GIT_CEILING_DIRECTORIES to its PARENT, clear ambient GIT_DIR/GIT_WORK_TREE/GIT_INDEX_FILE/GIT_COMMON_DIR, and first confirm git rev-parse --show-toplevel exits nonzero. Otherwise git may discover the outer checkout. Do not apply in the Agent 1 working tree. No --3way, reset, clean, force or automatic ref operations.\n\nAfter applying, run:\n\n    node scripts/journal-editorial-transfer.mjs --verify /absolute/kit/transfer.json --target /absolute/applied-export --phase applied\n\nThe verifier checks patch integrity, all transferred bytes/modes, every preserved tracked file and absence of excluded new files. It does not write target files. Run it BEFORE build generators modify derived files. It is an exact-state check, not an arbitrary newer-head compatibility claim.\n\n## Acceptance after application\n\nReuse the matching installed dependencies without modifying package files. Run the repository's canonical Scripture occurrence generator (four added Astro presentation files affect scannedSourceFiles), then its production-like build / asset-revision flow and relevant generated-output checks. Record that derived diff separately; the data file is deliberately NOT in this patch.\n\n    node scripts/journal-editorial-contract.mjs --public-only --probe-hold\n\nThis explicit mode omits ONLY the held manuscript's presentation-bibliography uniqueness check. All 16 public claims, 21 sources, nine history gates, production guards and no-history-route/discovery checks remain mandatory. Default mode remains strict and still requires the history bibliography.\n\nRun the existing browser witness against fresh HTTP output, with JOURNAL_HISTORY_URL unset, JOURNAL_BASE_URL, JOURNAL_BROWSER and JOURNAL_AXE_PATH set; provide the matching Chromium executable if needed. Capture 390/1440 light/dark, keyboard/source/return/reflow and public print. New integrated source has no inherited green status. Firefox/WebKit/device/UI-zoom/physical-print/Owner visual signoff need their own witnesses.\n\n## Boundaries\n\nJournalDocumentHead (including any future SEO safeguard) is never copied. Changed shared/date/publication owners make generation fail closed rather than overwrite a newer owner. No history implementation/data/route is copied. Shared Journal CSS can affect a future dev-only manuscript; this public-only kit does not accept or publish that surface. Series navigation contains a non-link pending-manuscript label, not a public history href. Native TOC must not be combined with another scrollspy owner. No runtime/font/SW/package/media claim or Research approval is included.\n`;
  const buildInstantHint = `\n## Gitless build timestamp\n\nThis scratch export deliberately has no Git repository. The existing metadata projector otherwise cannot obtain its deterministic technical build instant. Before the build, use the source commit timestamp recorded in transfer.json:\n\n    export GB_BUILD_INSTANT=${JSON.stringify(technicalBuildInstant)}\n\nThis is the existing supported build input, NOT an article publication/modification date. Do not substitute wall-clock time, edit route metadata or let the build discover the outer checkout. It is unnecessary to rerun a completed typecheck just to resume failed build/postbuild stages. Record each stage's actual exit status.\n`;
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, manifest.patch), patch, { flag: 'wx' });
  fs.writeFileSync(path.join(out, 'transfer.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(out, 'README.md'), readme + buildInstantHint, { flag: 'wx' });
  return { base, source, technicalBuildInstant, files: files.length, preserved: preserved.length, excludedChanges, out };
}

export function verifyTransfer({ manifestPath, target, phase }) {
  assert.ok(['base', 'applied'].includes(phase), 'Set --phase base or applied');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  validateManifest(manifest);
  assert.equal(manifest.patch, 'public-editorial.patch', 'Unexpected patch path');
  const patch = fs.readFileSync(path.join(path.dirname(manifestPath), manifest.patch));
  assert.equal(sha256(patch), manifest.patchSha256, 'Transfer patch digest mismatch');
  target = fs.realpathSync(target);
  const records = [...manifest.files.map((entry) => ({ path: entry.path, state: phase === 'base' ? entry.before : entry.after })), ...manifest.preserved, ...manifest.excludedAdded];
  for (const { path: name, state } of records) {
    const file = path.join(target, name);
    let stat;
    try { stat = fs.lstatSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (state === null) { assert.ok(!stat, `Must remain absent: ${name}`); continue; }
    assert.ok(stat, `Missing pinned file: ${name}`);
    assert.equal(stat.isSymbolicLink(), state.mode === '120000', `Unexpected symlink mode: ${name}`);
    assert.ok(stat.isFile() || stat.isSymbolicLink(), `Not a pinned file: ${name}`);
    const bytes = stat.isSymbolicLink() ? Buffer.from(fs.readlinkSync(file)) : fs.readFileSync(file);
    assert.equal(objectId(bytes), state.blob, `Pinned content mismatch: ${name}`);
    if (state.mode !== '120000') assert.equal(Boolean(stat.mode & 0o111), state.mode === '100755', `Executable mode mismatch: ${name}`);
  }
  return { phase, base: manifest.base, source: manifest.source, checked: records.length, transferred: manifest.files.length, preserved: manifest.preserved.length, excludedNewFilesAbsent: manifest.excludedAdded.length, patchSha256: manifest.patchSha256, writes: 0 };
}

function main(argv) {
  if (argv.length === 1 && argv[0] === '--help') {
    console.log('Generate: --base SHA40 --source SHA40 --out NEW_IGNORED_DIR\nRead-only verify: --verify transfer.json --target DIRECTORY --phase base|applied');
    return;
  }
  const options = {};
  assert.equal(argv.length % 2, 0, 'Options require values');
  for (let i = 0; i < argv.length; i += 2) {
    assert.ok(['--base', '--source', '--out', '--verify', '--target', '--phase'].includes(argv[i]) && !Object.hasOwn(options, argv[i]), `Unknown/duplicate option: ${argv[i]}`);
    options[argv[i]] = argv[i + 1];
  }
  const verifying = Object.hasOwn(options, '--verify');
  assert.deepEqual(Object.keys(options).sort(), (verifying ? ['--verify', '--target', '--phase'] : ['--base', '--source', '--out']).sort(), 'Supply exactly one complete generate or verify command');
  const result = verifying ? verifyTransfer({ manifestPath: options['--verify'], target: options['--target'], phase: options['--phase'] }) : buildTransfer({ base: options['--base'], source: options['--source'], out: options['--out'] });
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`Journal transfer FAIL: ${error.message}`); process.exitCode = 1; }
}
