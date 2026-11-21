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
  'scripts/lib/articles-print-pdf.py',
  // Owner7053771242: catalog-only PE and a strictly additive, conditional SSR return.
  'src/components/articles/articlesCatalogNavigation.ts',
  'src/components/articles/ArticlesCatalogReturn.astro',
  'src/components/article-pilots/_shared/series/SeriesReaderChrome.astro',
  'scripts/articles-catalog-navigation-test.mjs',
  'scripts/articles-catalog-navigation-browser.mjs']);
export const SHARED_CATALOG_RETURN_PATH = 'src/components/article-pilots/_shared/series/SeriesReaderChrome.astro';
export function assertCatalogReturnProjection(baseline, proposed) {
  const anchor = "import ReaderActionsRuntime from '@/components/reader-platform/ReaderActionsRuntime.astro';\n";
  const addition = "import ArticlesCatalogReturn from '@/components/articles/ArticlesCatalogReturn.astro';\n";
  const slot = '    <slot />\n';
  assert.equal(baseline.split(anchor).length, 2, 'Unknown shared chrome import owner');
  assert.equal(baseline.split(slot).length, 2, 'Unknown shared chrome slot owner');
  assert.ok(!baseline.includes(addition), 'Shared return already present: reconcile the new exact base');
  const projected = baseline.replace(anchor, anchor + addition).replace(slot, '    <ArticlesCatalogReturn />\n' + slot);
  assert.equal(proposed, projected, 'Shared chrome delta must be ONLY the conditional SSR import + mount; preserve Reader/runtime/asset owners');
  return { path: SHARED_CATALOG_RETURN_PATH, scope: 'Two additive SSR lines only;no Reader runtime,assets,controls,configuration or handlers changed' };
}
export const GUARD_PATH = 'src/components/journal/G3HistoryFeature.astro';
export function projectHistoryGuard(baseline, proposed) {
  const guard = "if (import.meta.env.PROD) {\n  throw new Error('G3 history feature PUBLICATION_HOLD: a signed history handoff is required');\n}";
  assert.match(proposed, /if\s*\(import\.meta\.env\.PROD\)\s*\{\s*throw new Error\('G3 history feature PUBLICATION_HOLD:/, 'Source feature must contain the known fail-closed production guard');
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
  const protectedDelta = git(repo, ['diff', '--no-ext-diff', '--name-only', base, source, '--', ...sharedOwners, ...authorityOwners]).toString().trim().split('\n').filter(Boolean);
  assert.deepEqual(protectedDelta.filter((name) => name !== SHARED_CATALOG_RETURN_PATH), [], 'Shared/date/publication owners differ; stop and re-scope the handoff');
  const sharedSSRReturn = assertCatalogReturnProjection(git(repo, ['show', `${base}:${SHARED_CATALOG_RETURN_PATH}`]).toString(), git(repo, ['show', `${source}:${SHARED_CATALOG_RETURN_PATH}`]).toString());
  for (const name of authorityOwners) assert.ok(before.has(name), `Missing baseline owner: ${name}`);
  for (const name of ['JournalContents.astro', 'G3Dossier.astro']) {
    const file = `src/components/journal/${name}`;
    assert.ok(git(repo, ['show', `${source}:${file}`]).equals(git(repo, ['show', `18d567b3e4c01cce194b9ffccfb8d8948b024ec7:${file}`])), `Accepted18d G3 source drift: ${file}`);
  }
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
  const manifest = { version: 2, baselineSourceContent, sharedSSRReturn, base, source, technicalBuildInstant, prerequisite, patch: 'public-editorial.patch', patchSha256: sha256(patch), files, preserved, excludedAdded, excludedChanges, scope: 'Selected Journal/dossier and existing /articles/ presentation/tests ONLY; catalog membership/roles/metadata authorities and shared owners remain baseline-owned. The articles consumer extends the same shell and active-section API, not the visual system. #2345 safeguards and the separately pinned guard-only prerequisite remain explicit.', publication: '16 approved claims / 21 sources; nine history gates HOLD / NOT_ISSUED. Not a publication approval.', appliedByGenerator: false };
  validateManifest(manifest);
  const readme = `# Agent1 — exact selective technical handoff (Owner7053771242)

Canonical base: ${base}
Source: ${source}
Technical build instant: ${technicalBuildInstant}

Exactly ${files.length} allowlisted public files; NOT whole PR2340 and NOT a merge/deploy/publication approval. The previously accepted Product18d G3 TOC is preserved. Held history narrative/data/CSS, registries, global CSS/JS/fonts/SW/packages and all other baseline owners are excluded and pinned. One shared exception is independently checked: SeriesReaderChrome receives ONLY an SSR return component import + mount. The component renders only for an existing published article from manifest ∩ route authority with both HOLD vetoes. Reader runtime/assets/controls remain byte-identical to the pinned base.

## Read-only verify and fresh rehearsal

Use this exact source version of scripts/journal-editorial-transfer.mjs. In a NEW gitless export of the exact canonical base, verify --verify KIT/transfer.json --target EXPORT --phase base. Check/apply public-editorial.patch, verify --phase applied, then separately check/apply history-production-guard.patch if emitted and verify --phase guarded. The latter adds ONLY the missing direct-feature production throw; never history prose or publication authority. Clear ambient Git variables and set GIT_CEILING_DIRECTORIES to the export parent so nested git apply cannot discover another checkout. This generator itself NEVER applies, builds, writes refs, commits, pushes or grants authority.

Source-only three-way analysis is required for current canonical/shared owners before selection. If SYS2348 or main moves, retain its asset/runtime ownership and generate/recheck a NEW exact combined source; do not copy this older shared file blindly. The two-line SSR projection is fail-closed, not an exception for arbitrary shared edits.

After byte verification, regenerate data/scripture-search-index.json with the canonical generator; record that derived diff separately, never copy it from source. Reuse existing dependencies. For the gitless build set GB_BUILD_INSTANT=${JSON.stringify(technicalBuildInstant)} (technical input, NOT an article date). Run production-like build, Pagefind, publication/content/HOLD/HTTP, catalog membership/metadata and targeted source/SEO contracts against that exact export.

    node --test scripts/articles-catalog-navigation-test.mjs scripts/articles-editorial-contract-test.mjs scripts/journal-document-metadata-test.mjs
    node scripts/journal-editorial-contract.mjs --public-only --transfer=KIT/transfer.json --probe-hold --output=NEW_OUTPUT
    node scripts/articles-editorial-contract.mjs --transfer=KIT/transfer.json
    node scripts/articles-catalog-navigation-browser.mjs ORIGIN SOURCE_SHA NEW_OUTPUT CHROMIUM_EXECUTABLE

## Acceptance distinction

JS-on: native catalog40 → actual article200 → browserBack → visible origin, native scroll/rect preserved, accessible original-link focus, FIRST Tab to catalog41. No href/modified-click/Back/Tab interception; no timers/rAF/scroll writes/manual restoration/router. Namespaced history identity is saved on actual pagehide only, preserving foreign state.

Actual noJS native Back is measured and reported separately; no exact keyboard-resume guarantee without retained browser state. Ordinary SSR article → exact item-fragment return must independently show origin visible and firstTab next. It is NOT browser Back. Report hash reload and modified-link parent/native child observations separately. If a real full browser without BFCache delegate is unavailable, state that ceiling; do not fabricate BFCache proof or universal impossibility. Owner must explicitly accept the precise revised noJS criterion; NO_GO is not self-released.

Do NOT repeat accepted54CLS/36visual/PDF. Capture only the two bounded JS-return / noJS-SSR-return states. Current old collector/safety exits and coverage ceilings remain retained, not silently green.

Technical READY is distinct from publication GO. Preserve16 claims/21 sources, nine history groups HOLD and BOTH production guards. No Research writes, held routes/discovery, canonical/main/peer mutation, merge or deploy. Current writer is Agent1 on its own fixed branch only; a canonical writer/lease and Owner merge/deploy authority are NOT granted by this kit.
`;
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
