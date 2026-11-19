#!/usr/bin/env node
/**
 * Selected Agent8 public Journal + existing catalog + compatible SEO handoff.
 * Adapted from Agent1 #2340 exact1979ef2e transfer discipline; no UI imported. Reads pinned Git objects and writes ONE new,
 * ignored artifact directory. Never applies a patch, edits a ref/index, builds,
 * commits, pushes or grants publication permission. Verification is read-only.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TRANSFER_FILES = Object.freeze(['scripts/journal-document-metadata-test.mjs',
  'scripts/journal-editorial-browser.mjs',
  'scripts/journal-editorial-contract.mjs',
  'scripts/lib/journal-print-pdf.py',
  'scripts/lib/seo-route-contract.js',
  'scripts/seo-route-contract-test.js',
  'src/components/journal/G3Dossier.astro',
  'src/components/journal/JournalArticleHeader.astro',
  'src/components/journal/JournalContents.astro',
  'src/components/journal/JournalDataFigure.astro',
  'src/components/journal/JournalDocumentHead.astro',
  'src/components/journal/JournalFontPreloads.astro',
  'src/components/journal/JournalLanding.astro',
  'src/components/journal/JournalMasthead.astro',
  'src/components/journal/JournalSourceReturn.astro',
  'src/components/journal/journalDocumentMetadata.ts',
  'src/components/journal/journalEditorial.css',
  'src/data/journal/g3EditorialMedia.ts',
  'src/pages/journal/index.astro',
  'src/pages/journal/dossiers/g3/index.astro',
  // Explicit owner-approved existing /articles/ consumer; not a new portal.
  'src/components/journal/JournalEditorialShell.astro',
  'src/components/articles/ArticlesPageChrome.astro',
  'src/components/articles/ArticlesMain.astro',
  'src/components/articles/ArticlesPageFooter.astro',
  'src/components/articles/ArticlesHeroSection.astro',
  'src/components/articles/ArticlesLibrarySection.astro',
  'src/components/articles/ArticlesRefutationsSection.astro',
  'src/components/articles/articlesEditorial.css',
  'src/pages/articles/index.astro',
  'scripts/articles-visual-parity-audit.js',
  'scripts/articles-editorial-contract.mjs',
  'scripts/articles-editorial-contract-test.mjs',
  'scripts/articles-editorial-browser.mjs',
  'scripts/articles-editorial-native-diagnostic.mjs',
  'scripts/lib/articles-print-pdf.py']);
export const GUARD_PATH = 'src/components/journal/G3HistoryFeature.astro';
export function projectHistoryGuard(baseline, proposed) {
  const guard = "if (import.meta.env.PROD) {\n  throw new Error('G3 history feature PUBLICATION_HOLD: a signed history handoff is required');\n}";
  assert.ok(proposed.includes(guard), 'Source feature must contain the known fail-closed production guard');
  if (/if\s*\(import\.meta\.env\.PROD\)\s*\{\s*throw new Error\([^;]*PUBLICATION_HOLD/s.test(baseline)) return null;
  assert.ok(baseline.startsWith('---\n'), 'Expected canonical Astro frontmatter');
  const content = baseline.replace(/^---\n/, `---\n${guard}\n\n`);
  assert.equal(content.replace(`${guard}\n\n`, ''), baseline, 'Only the safety guard may be added, never history narrative');
  return { content, guard };
}
const sharedOwners = ['css', 'js', 'fonts', 'icons', 'public', 'src/layouts', 'src/components/reader-platform', 'src/components/article-pilots/_shared', 'src/lib/asset-version.js'];
const authorityOwners = [
  'package.json', 'package-lock.json', 'migration/page-ownership.json',
  'data/route-profiles/journal.json', 'data/route-profiles/journal-dossiers-g3.json',
  'data/search-manifest.json', 'data/route-profiles/articles.json',
  'src/components/journal/JournalEditorialRail.astro',
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
  assert.equal(manifest.version, 2, 'Unsupported transfer manifest');
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
  if (manifest.prerequisite) {
    const p = manifest.prerequisite;
    assert.equal(p.path, GUARD_PATH, 'Only the direct history-feature guard may be a prerequisite');
    assert.equal(p.patch, 'history-production-guard.patch');
    assert.deepEqual(p.before, manifest.preserved.find((entry) => entry.path === GUARD_PATH)?.state, 'Prerequisite must start at the pinned baseline');
    assert.ok(p.after && p.after.mode === p.before.mode && p.after.mode !== '120000');
    assert.match(p.after.blob || '', /^[a-f0-9]{40}$/);
    assert.match(p.patchSha256 || '', /^[a-f0-9]{64}$/);
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
  const baselineFeature = git(repo, ['show', `${base}:${GUARD_PATH}`]).toString();
  const projection = projectHistoryGuard(baselineFeature, git(repo, ['show', `${source}:${GUARD_PATH}`]).toString());
  let prerequisite = null, prerequisitePatch = null;
  if (projection) {
    const beforeState = state(before.get(GUARD_PATH));
    const afterState = { mode: beforeState.mode, blob: objectId(Buffer.from(projection.content)) };
    const context = baselineFeature.split('\n').slice(0, 3);
    prerequisitePatch = Buffer.from([`diff --git a/${GUARD_PATH} b/${GUARD_PATH}`, `index ${beforeState.blob}..${afterState.blob} ${beforeState.mode}`, `--- a/${GUARD_PATH}`, `+++ b/${GUARD_PATH}`, '@@ -1,3 +1,7 @@', ` ${context[0]}`, ...projection.guard.split('\n').map((line) => `+${line}`), '+', ...context.slice(1).map((line) => ` ${line}`), ''].join('\n'));
    prerequisite = { path: GUARD_PATH, before: beforeState, after: afterState, patch: 'history-production-guard.patch', patchSha256: sha256(prerequisitePatch), scope: 'Guard-only insertion into baseline; all historical prose/locators remain byte-for-byte baseline.' };
  }
  const technicalBuildInstant = git(repo, ['show', '-s', '--format=%cI', source]).toString().trim();
  const baselineSourceContent = Object.fromEntries(['src/components/journal/G3Dossier.astro', ...['g3ProductMetadata', 'g3PublicationHandoff', 'g3SourceBibliography', 'journalProductMetadata'].map((name) => `src/data/journal/${name}.ts`)].map((name) => [name, git(repo, ['show', `${base}:${name}`]).toString()]));
  const manifest = { version: 2, baselineSourceContent, base, source, technicalBuildInstant, prerequisite, patch: 'public-editorial.patch', patchSha256: sha256(patch), files, preserved, excludedAdded, excludedChanges, scope: 'Selected Journal/dossier and existing /articles/ presentation/tests ONLY; catalog membership/roles/metadata authorities and shared owners remain baseline-owned. The articles consumer extends the same shell and active-section API, not the visual system. #2345 safeguards and the separately pinned guard-only prerequisite remain explicit.', publication: '16 approved claims / 21 sources; nine history gates HOLD / NOT_ISSUED. Not a publication approval.', appliedByGenerator: false };
  validateManifest(manifest);
  const readme = `# Selected Agent8 → canonical public-only transfer\n\nBase: ${base}\nSource: ${source}\n\nExactly ${files.length} allowlisted public presentation/SEO/test files. This generator never applies/builds/commits/pushes; no canonical HEAD change is claimed. Adapted from Agent1's pinned-object transfer discipline, not its visual design. The compatible SEO delta is from #2345 with Agent8 FontPreloads retained and explicit runtime validation. All ${preserved.length} other baseline files are pinned. Full held history, its data/CSS and local review route are excluded; a direct-feature guard-only prerequisite is separately pinned.\n\nUse this same source version of scripts/journal-editorial-transfer.mjs to verify the NEW gitless export in phases base, applied and guarded. Verify --manifest via --verify /absolute/kit/transfer.json --target /absolute/export --phase base|applied|guarded. Do not use a different/newer base or 3way. Before git apply in nested scratch, clear ambient GIT_DIR/GIT_WORK_TREE/GIT_INDEX_FILE/GIT_COMMON_DIR, set GIT_CEILING_DIRECTORIES to the PARENT and confirm git rev-parse fails. Only then check/apply public-editorial.patch, verify applied, check/apply the separate history-production-guard.patch if emitted, verify guarded. The latter adds only a throw, not history prose/imports/authority.\n\nBefore build reuse installed dependencies, and run the existing Scripture occurrence generator; record only its derived change separately (do not copy source-side generated data). For gitless builds use the existing supported technical input GB_BUILD_INSTANT=${JSON.stringify(technicalBuildInstant)}; this is NOT an article date. Run the canonical production-like build, Pagefind, SEO/metadata/search/feed/sitemap/ownership/runtime/token contracts. Then:\n\nnode scripts/journal-editorial-contract.mjs --public-only --transfer=/absolute/kit/transfer.json --probe-hold --output=reports/review\nnode --test scripts/journal-document-metadata-test.mjs\n\nPublic-only omits ONLY checks of the excluded, unmounted held presentation (its extra source module and stylesheet). The default contract still checks both. Exact16claims/21sources,9held candidates,two production guards,no route/discovery,37factual paragraphs,source-word/DOM parity and real Pagefind remain mandatory. The embedded baseline comparison sources are checked against their pinned Git blob IDs, not handwritten facts. Default source contract remains strict and requires source-only manuscript dependencies.\n\nFor browser/PDF checks run the transferred journal-editorial-browser.mjs with --public-only=true --transfer=/absolute/kit/transfer.json --origin=URL and explicit axe/browser environment; never pass a history-origin. Its head/worktree are null and composite provenance records base/source rather than fabricating a canonical commit. Capture responsive320/390/768/1440 light/dark, source/citation/direct returns, keyboard/mobile,16actualPDF A4/Letter/JS/noJS. Generated file changes and actual exits must be preserved separately. A new integration commit requires its own exact-head CI.\n\nThe existing /articles/ catalog is an additional explicit consumer of the selected edition shell. Its published set is derived dynamically from unchanged search-manifest + page-ownership, not a hardcoded count. Run node --test scripts/articles-editorial-contract-test.mjs; node scripts/articles-visual-parity-audit.js --require-dist; node scripts/articles-editorial-contract.mjs --transfer=/absolute/kit/transfer.json; and the scoped articles-editorial-browser.mjs against the built composite. Its print/full suite requires the existing PyMuPDF environment (optionally --pdf-python=PATH) and reads all actual PDF title/summary pagination; generation alone is not acceptance. The separate articles-editorial-native-diagnostic.mjs --origin=URL --output=NEW_DIR --transfer=/absolute/kit/transfer.json compares actual hash/nohash history with neutral QA-only fixtures; exit0 means collection, never a waiver of the strict Back gate. Route-owned ArticlesPageChrome metadata remains its single owner. No shared Search/OverlayRuntime/fonts/SW/package changes or history release. One visual/navigation owner. No merge/deploy/Research-write. Missing engines/devices/physical-print/trueUIzoom remain explicit.\n`;
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, manifest.patch), patch, { flag: 'wx' });
  if (prerequisitePatch) fs.writeFileSync(path.join(out, prerequisite.patch), prerequisitePatch, { flag: 'wx' });
  fs.writeFileSync(path.join(out, 'transfer.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(out, 'README.md'), readme, { flag: 'wx' });
  return { base, source, technicalBuildInstant, files: files.length, preserved: preserved.length, guardOnlyPrerequisite: Boolean(prerequisite), excludedChanges, out };
}

export function verifyTransfer({ manifestPath, target, phase }) {
  assert.ok(['base', 'applied', 'guarded'].includes(phase), 'Set --phase base, applied or guarded');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  validateManifest(manifest);
  assert.equal(manifest.patch, 'public-editorial.patch', 'Unexpected patch path');
  const patch = fs.readFileSync(path.join(path.dirname(manifestPath), manifest.patch));
  assert.equal(sha256(patch), manifest.patchSha256, 'Transfer patch digest mismatch');
  if (manifest.prerequisite) assert.equal(sha256(fs.readFileSync(path.join(path.dirname(manifestPath), manifest.prerequisite.patch))), manifest.prerequisite.patchSha256, 'Safety prerequisite patch digest mismatch');
  target = fs.realpathSync(target);
  const guarded = phase === 'guarded' && manifest.prerequisite;
  const preserved = manifest.preserved.map((entry) => guarded && entry.path === GUARD_PATH ? { path: entry.path, state: guarded.after } : entry);
  const records = [...manifest.files.map((entry) => ({ path: entry.path, state: phase === 'base' ? entry.before : entry.after })), ...preserved, ...manifest.excludedAdded];
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
  return { phase, base: manifest.base, source: manifest.source, checked: records.length, transferred: manifest.files.length, preserved: manifest.preserved.length - (guarded ? 1 : 0), guardOnlyPrerequisitesApplied: guarded ? 1 : 0, excludedNewFilesAbsent: manifest.excludedAdded.length, patchSha256: manifest.patchSha256, writes: 0 };
}

function main(argv) {
  if (argv.length === 1 && argv[0] === '--help') {
    console.log('Generate: --base SHA40 --source SHA40 --out NEW_IGNORED_DIR\nRead-only verify: --verify transfer.json --target DIRECTORY --phase base|applied|guarded');
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
