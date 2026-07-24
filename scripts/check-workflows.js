#!/usr/bin/env node
/**
 * Workflow policy guard.
 * Keeps GitHub Actions aligned with the local publication-quality gates so
 * future agents cannot silently weaken CI by editing YAML.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const {
  validateCacheBustWorkflowPolicy,
  runCacheBustWorkflowPolicyMutationSuite,
} = require('./lib/cache-bust-workflow-policy');
const ROOT = path.resolve(__dirname, '..');
const issues = [];
function read(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    issues.push(`${rel}: missing`);
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}
function must(file, text, rx, msg) {
  if (!rx.test(text)) issues.push(`${file}: ${msg}`);
}
function mustNot(file, text, rx, msg) {
  if (rx.test(text)) issues.push(`${file}: ${msg}`);
}
function pushPathRx(glob) {
  const escaped = glob.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`-\\s*['"]${escaped}['"]`);
}
function mustScript(scripts, name, rx, msg) {
  const value = scripts && scripts[name];
  if (typeof value !== 'string') {
    issues.push(`package.json scripts.${name}: missing`);
    return;
  }
  if (!rx.test(value)) issues.push(`package.json scripts.${name}: ${msg}`);
}
function mustAllWorkflowsHaveBasics() {
  const dir = path.join(ROOT, '.github/workflows');
  for (const name of fs.readdirSync(dir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))) {
    const rel = `.github/workflows/${name}`;
    const txt = read(rel);
    must(rel, txt, /^name:\s*.+/m, 'missing workflow name');
    must(rel, txt, /^on:\s*$/m, 'missing on: block');
    must(rel, txt, /^permissions:\s*$/m, 'missing top-level permissions block');
  }
}

mustAllWorkflowsHaveBasics();

let pkg = { scripts: {} };
try { pkg = JSON.parse(read('package.json')); }
catch (e) { issues.push(`package.json: invalid JSON: ${e.message}`); }
const scripts = pkg.scripts || {};
mustScript(scripts, 'validate:static-publication', /page-ownership:check/, 'must include page-ownership manifest/source guard');
mustScript(scripts, 'strangler:validate', /page-ownership:dist/, 'must verify ownership after building strangler dist');
mustScript(scripts, 'strangler:audit', /page-ownership:dist/, 'must verify ownership before dist publication audit');
mustScript(scripts, 'strangler:audit:pagefind', /page-ownership:dist/, 'must verify ownership before Pagefind/dist audit');
mustScript(scripts, 'strangler:audit:production-like', /page-ownership:dist:production-like/, 'must verify production-like ownership before Pagefind/dist audit');
mustScript(scripts, 'strangler:audit:production-like', /contract:compare:dist/, 'must compare public URL contract against production-like dist');
mustScript(scripts, 'strangler:audit:production-like', /dist:jsonld:audit/, 'must parse JSON-LD in production-like dist');
mustScript(scripts, 'strangler:audit:production-like', /schema:rich-results:audit:dist|schema-rich-results-audit\.js[^\n]*--root\s+dist/, 'must semantically audit rich-results schema in production-like dist');
mustScript(scripts, 'strangler:audit:production-like', /audit:premium-controls|premium-controls-rollout-audit\.js/, 'must enforce PremiumControls rollout contract on production-like dist');
mustScript(scripts, 'dist:jsonld:audit', /dist-jsonld-audit\.js[^\n]*--root\s+dist/, 'must audit JSON-LD in dist artifact');
mustScript(scripts, 'schema:rich-results:audit:dist', /schema-rich-results-audit\.js[^\n]*--root\s+dist/, 'must semantically audit rich-results schema in dist artifact');
mustScript(scripts, 'strangler:deploy-readiness', /astro:audit:about/, 'must include about pilot audit');
mustScript(scripts, 'strangler:deploy-readiness', /astro:audit:article-mdx:strict/, 'must include strict article MDX shadow audit');
mustScript(scripts, 'strangler:deploy-readiness', /strangler:audit:production-like/, 'must include production-like strangler audit');
mustScript(scripts, 'strangler:deploy-readiness', /visual:parity:production|visual-parity-contract\.js/, 'must include route-specific visual parity contract');

const deploy = read('.github/workflows/deploy.yml');
must('.github/workflows/deploy.yml', deploy, /node-version:\s*['"]?22['"]?/, 'deploy must use Node 22+ for Astro toolchain compatibility');
must('.github/workflows/deploy.yml', deploy, /npm ci/, 'deploy must install dependencies via npm ci');
must('.github/workflows/deploy.yml', deploy, /npm run validate:static-publication/, 'deploy must run validate:static-publication');
must('.github/workflows/deploy.yml', deploy, /^concurrency:\s*$/m, 'deploy must keep concurrency');
must('.github/workflows/deploy.yml', deploy, /actions\/upload-pages-artifact@v3/, 'deploy must upload a Pages artifact');

// Strangler safety rail: production now uploads the Astro/strangler dist artifact.
// If anyone rolls back to root, the workflow must be internally consistent;
// if it stays on dist, Pagefind, IndexNow key placement, .nojekyll placement
// and deploy-like dist audits must remain coupled.
const deployUploadsDist = /^\s*path:\s*['"]?(?:\.\/)?dist\/?['"]?\s*$/m.test(deploy);
if (deployUploadsDist) {
  must('.github/workflows/deploy.yml', deploy, /npm run strangler:build:production-like/, 'dist deploy must build production-like strangler dist');
  must('.github/workflows/deploy.yml', deploy, /npm run page-ownership:dist:production-like|check-page-ownership\.js[^\n]*--dist[^\n]*--production-like/, 'dist deploy must verify page ownership against production-like dist');
  must('.github/workflows/deploy.yml', deploy, /npm run pagefind:build:dist/, 'dist deploy must build Pagefind into dist/pagefind');
  must('.github/workflows/deploy.yml', deploy, /npm run visual:parity:production|visual-parity-contract\.js/, 'dist deploy must run route-specific visual parity contract, not only SEO/text parity');
  must('.github/workflows/deploy.yml', deploy, /dist-publication-audit\.js[^\n]*--require-pagefind[^\n]*--forbid-dev|npm run strangler:audit:production-like/, 'dist deploy must run production-like dist publication audit with Pagefind required and dev route forbidden');
  must('.github/workflows/deploy.yml', deploy, /contract:extract:dist[^\n]*&&[^\n]*contract:compare:dist|contract:compare:dist/, 'dist deploy must compare public URL contract against dist artifact');
  must('.github/workflows/deploy.yml', deploy, /dist:jsonld:audit|dist-jsonld-audit\.js[^\n]*--root\s+dist/, 'dist deploy must parse JSON-LD in the dist artifact');
  must('.github/workflows/deploy.yml', deploy, /schema:rich-results:audit:dist|schema-rich-results-audit\.js[^\n]*--root\s+dist/, 'dist deploy must semantically audit rich-results schema in the dist artifact');
  must('.github/workflows/deploy.yml', deploy, /audit:premium-controls|premium-controls-rollout-audit\.js/, 'dist deploy must enforce PremiumControls rollout contract on the dist artifact');
  must('.github/workflows/deploy.yml', deploy, /playwright install --with-deps chromium/, 'deploy must install Playwright Chromium before mobile smoke/layout tests (regression guard: Deploy #1241 root cause)');
  must('.github/workflows/deploy.yml', deploy, /gill:mobile-layout:audit|gill-mobile-layout-audit\.js/, 'dist deploy must run Gill mobile reference layout audit (PC-CURRENT-06 guard)');
  must('.github/workflows/deploy.yml', deploy, /gill:pre-v16-submenu:audit|gill-pre-v16-submenu-regression-audit\.js/, 'dist deploy must run Gill pre-v16 desktop submenu regression audit');
  must('.github/workflows/deploy.yml', deploy, /dist-smoke-audit\.js[^\n]*--no-build[^\n]*--production-like/, 'dist deploy must run broad production-like browser runtime smoke (NEW-64 guard)');
  must('.github/workflows/deploy.yml', deploy, /sw:dist:audit:deploy-switch|sw-dist-readiness-audit\.js[^\n]*--require-cache-bump/, 'dist deploy must enforce service-worker cache-version bump');
  // BUG-S1 / PFV-008 guard: dist artifact must be JSON-LD parse-clean.
  // Keep this through the canonical npm script, not a second inline parser.
  must('.github/workflows/deploy.yml', deploy, /npm run dist:jsonld:audit|dist-jsonld-audit\.js[^\n]*--root\s+dist/, 'dist deploy must parse and validate every <script type="application/ld+json"> in dist/**/*.html');
  // BUG-A9 guard: dist URL contract must be checked at deploy time.
  must('.github/workflows/deploy.yml', deploy, /contract:compare:dist/, 'dist deploy must run contract:compare:dist against baseline');
  must('.github/workflows/deploy.yml', deploy, />\s*"?dist\/\$\{KEY\}\.txt"?/, 'dist deploy must write IndexNow key file into dist (not repository root)');
  must('.github/workflows/deploy.yml', deploy, /touch\s+dist\/\.nojekyll/, 'dist deploy must create dist/.nojekyll');
} else {
  must('.github/workflows/deploy.yml', deploy, /^\s*path:\s*['"]?\.['"]?\s*$/m, 'root deploy must upload repository root until explicit dist switch');
  must('.github/workflows/deploy.yml', deploy, /npm run pagefind:build(?!:dist)/, 'root deploy must build Pagefind at repository root');
  if (/npm run pagefind:build:dist|npm run strangler:build|sw:dist:audit:deploy-switch/.test(deploy)) {
    issues.push('.github/workflows/deploy.yml: root deploy contains partial dist-deploy commands; switch all deploy steps atomically');
  }
}

const distDryRun = read('.github/workflows/dist-dry-run.yml');
must('.github/workflows/dist-dry-run.yml', distDryRun, /workflow_dispatch:/, 'dist dry run must be manually runnable only');
must('.github/workflows/dist-dry-run.yml', distDryRun, /node-version:\s*['"]?22['"]?/, 'dist dry run must use Node 22+ for Astro toolchain compatibility');
must('.github/workflows/dist-dry-run.yml', distDryRun, /npm ci/, 'dist dry run must install dependencies via npm ci');
must('.github/workflows/dist-dry-run.yml', distDryRun, /playwright install --with-deps chromium/, 'dist dry run must install Chromium for visual/about audits');
must('.github/workflows/dist-dry-run.yml', distDryRun, /npm run ci:check/, 'dist dry run must run root publication gates');
must('.github/workflows/dist-dry-run.yml', distDryRun, /npm run astro:audit:about:shots/, 'dist dry run must generate about visual review screenshots');
must('.github/workflows/dist-dry-run.yml', distDryRun, /npm run strangler:deploy-readiness/, 'dist dry run must run production-like strangler readiness');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/articles\/index\.html/, 'dist dry run must assert articles index shadow route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/biografii\/index\.html/, 'dist dry run must assert biografii shadow landing exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/hard-texts\/index\.html/, 'dist dry run must assert hard-texts shadow landing exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/pastor-series\/index\.html/, 'dist dry run must assert pastor-series shadow landing exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/rodosloviye\/index\.html/, 'dist dry run must assert genealogy interactive route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/nagornaya\/index\.html/, 'dist dry run must assert nagornaya shadow landing exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/nagornaya\/seriya\/index\.html/, 'dist dry run must assert nagornaya series shadow landing exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/nagornaya\/istochniki\/index\.html/, 'dist dry run must assert nagornaya sources shadow landing exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/nagornaya\/nakhodki\/index\.html/, 'dist dry run must assert nagornaya findings shadow landing exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/karty\/index\.html/, 'dist dry run must assert karty shadow landing exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/karty\/avraam\/index\.html/, 'dist dry run must assert Avraam shadow route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/karty\/ishod\/index\.html/, 'dist dry run must assert Ishod shadow route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/konfessii\/index\.html/, 'dist dry run must assert konfessii shadow landing exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/konfessii\/russkij-baptizm\/index\.html/, 'dist dry run must assert Russian Baptist wrapper shadow route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/map\/index\.html/, 'dist dry run must assert map shadow route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/nagornaya\/chast-1\/index\.html/, 'dist dry run must assert nagornaya part 1 shadow route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/nagornaya\/chast-2\/index\.html/, 'dist dry run must assert nagornaya part 2 shadow route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/nagornaya\/chast-3\/index\.html/, 'dist dry run must assert nagornaya part 3 shadow route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/nagornaya\/chast-4\/index\.html/, 'dist dry run must assert nagornaya part 4 shadow route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/nagornaya\/chast-5\/index\.html/, 'dist dry run must assert nagornaya part 5 shadow route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/articles\/dzhon-gill-spravochnik\/index\.html/, 'dist dry run must assert Gill reference shadow article route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/articles\/dzhon-gill-istoricheskiy-kontekst\/index\.html/, 'dist dry run must assert Gill context shadow article route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/articles\/rimlyanam-7-veruyushchiy-ili-neveruyushchiy\/index\.html/, 'dist dry run must assert Romans 7 shadow article route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/articles\/kod-da-vinchi\/index\.html/, 'dist dry run must assert Kod da Vinci shadow article route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/articles\/dzhon-gill-chast-1-chelovek\/index\.html/, 'dist dry run must assert Gill part 1 shadow article route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/articles\/dzhon-gill-chast-2-uchenyi\/index\.html/, 'dist dry run must assert Gill part 2 shadow article route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/articles\/dzhon-gill-chast-3-nasledie\/index\.html/, 'dist dry run must assert Gill part 3 shadow article route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/articles\/dzhon-gill-chast-4-ekzeget\/index\.html/, 'dist dry run must assert Gill part 4 shadow article route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/articles\/krajne-li-isporcheno-serdce\/index\.html/, 'dist dry run must assert Jeremiah 17 shadow article route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/articles\/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki\/index\.html/, 'dist dry run must assert hermeneutics shadow article route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/articles\/20-antisovetov-pastoru\/index\.html/, 'dist dry run must assert pastor anti-advice shadow article route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test ! -e dist\/dev\/astro-test\/index\.html/, 'dist dry run must assert build-only astro-test route is absent');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test ! -e dist\/dev\/article-mdx-pilot\/index\.html/, 'dist dry run must assert build-only article MDX preview is absent');
must('.github/workflows/dist-dry-run.yml', distDryRun, /actions\/upload-artifact@v4/, 'dist dry run must upload review artifacts without deploying');
if (/actions\/deploy-pages|actions\/upload-pages-artifact|pages:\s*write|id-token:\s*write/.test(distDryRun)) {
  issues.push('.github/workflows/dist-dry-run.yml: dry run must not request Pages deploy permissions or deploy/upload a Pages artifact');
}
if (/\bpush:|\bschedule:|workflow_run:/.test(distDryRun)) {
  issues.push('.github/workflows/dist-dry-run.yml: dry run must stay workflow_dispatch-only');
}

const indexnow = read('.github/workflows/indexnow.yml');
must('.github/workflows/indexnow.yml', indexnow, /npm run validate:static-publication/, 'indexnow readiness gate must run validate:static-publication');
must('.github/workflows/indexnow.yml', indexnow, /contents:\s*read/, 'indexnow is a read-only readiness gate: contents: read (least-privilege — cache-bust is validated here, not committed; IndexNow submission + deploy moved to deploy.yml in NEW-53)');
must('.github/workflows/deploy.yml', deploy, /build-indexnow-urls\.js[^\n]*--base/, 'deploy must map src/MDX changes through scripts/build-indexnow-urls.js (moved from indexnow.yml in NEW-53 fix)');

const sourceLinks = read('.github/workflows/source-links.yml');
must('.github/workflows/source-links.yml', sourceLinks, /workflow_dispatch:/, 'source link audit must be manually runnable');
must('.github/workflows/source-links.yml', sourceLinks, /schedule:/, 'source link audit must be scheduled');
must('.github/workflows/source-links.yml', sourceLinks, /npm run strangler:build:production-like/, 'source link audit must build the production-like dist artifact first');
must('.github/workflows/source-links.yml', sourceLinks, /source-link-audit\.js[^\n]*--root\s+dist/, 'source link audit must check production-like dist, not stale legacy root');
must('.github/workflows/source-links.yml', sourceLinks, /^concurrency:\s*$/m, 'source link audit must keep concurrency');

const interactive = read('.github/workflows/interactive-audit.yml');
must('.github/workflows/interactive-audit.yml', interactive, /workflow_dispatch:/, 'interactive audit must be manually runnable');
must('.github/workflows/interactive-audit.yml', interactive, /schedule:/, 'interactive audit must be scheduled');
must('.github/workflows/interactive-audit.yml', interactive, /playwright install --with-deps chromium/, 'interactive audit must install Chromium with deps');
must('.github/workflows/interactive-audit.yml', interactive, /npm run strangler:build:production-like/, 'interactive audit must build the production-like dist artifact first');
must('.github/workflows/interactive-audit.yml', interactive, /npm run pagefind:build:dist/, 'interactive audit must build Pagefind into dist before runtime search checks');
must('.github/workflows/interactive-audit.yml', interactive, /python3 -m http\.server 8080 --bind 127\.0\.0\.1 -d dist/, 'interactive audit must serve production-like dist, not stale legacy root');
must('.github/workflows/interactive-audit.yml', interactive, /npm run interactive-audit/, 'interactive audit must run npm run interactive-audit');
must('.github/workflows/interactive-audit.yml', interactive, /AUDIT_BASE:\s*http:\/\/127\.0\.0\.1:8080/, 'interactive audit must set AUDIT_BASE');
must('.github/workflows/interactive-audit.yml', interactive, /^concurrency:\s*$/m, 'interactive audit must keep concurrency');

const notify = read('.github/workflows/notify-on-failure.yml');
must('.github/workflows/notify-on-failure.yml', notify, /Source Link Audit/, 'notify workflow must listen for Source Link Audit');
must('.github/workflows/notify-on-failure.yml', notify, /Runtime Interactive Audit/, 'notify workflow must listen for Runtime Interactive Audit');
must('.github/workflows/notify-on-failure.yml', notify, /Dist Strangler Dry Run/, 'notify workflow must listen for Dist Strangler Dry Run');
must('.github/workflows/notify-on-failure.yml', notify, /source-link|Source Link|hard-broken/i, 'notify issue body must explain source link failures');
must('.github/workflows/notify-on-failure.yml', notify, /interactive|Runtime Interactive/i, 'notify issue body must explain runtime audit failures');
must('.github/workflows/notify-on-failure.yml', notify, /dist strangler|production-like dist|Dist Strangler/i, 'notify issue body must explain dist dry run failures');

// Source/build changes have exactly one trigger owner: readiness. Deploy then
// follows through workflow_run. Keeping the same path in deploy.push creates two
// concurrent Pages runs; one cancels the other and the workflow_run job may skip.
const readinessOnlyPushPaths = [
  'src/**',
  'data/**',
  'baptisty-rossii/**',
  'scripts/**',
  'css/**',
  'js/**',
  'sitemap.xml',
  'feed.xml',
  'astro.config.mjs',
  'tsconfig.json',
  'migration/**',
  'package.json',
  'package-lock.json',
];
for (const glob of readinessOnlyPushPaths) {
  must('.github/workflows/indexnow.yml', indexnow, pushPathRx(glob), `readiness paths must include ${glob}`);
  mustNot('.github/workflows/deploy.yml', deploy, pushPathRx(glob), `direct deploy paths must exclude readiness-owned ${glob}`);
}

// Visual parity and shared-files guards must exist and stay well-formed, and the
// failure notifier must listen for them. Previously only 3 of 7 workflows were
// validated by this policy check — the two heaviest real gates were unchecked.
const visualParity = read('.github/workflows/visual-parity.yml');
must('.github/workflows/visual-parity.yml', visualParity, /^name:\s*.+/m, 'visual-parity must have a name');
must('.github/workflows/visual-parity.yml', visualParity, /^on:\s*$/m, 'visual-parity must have an on: block');
must('.github/workflows/visual-parity.yml', visualParity, /visual-parity-screenshots\.js/, 'visual-parity must run screenshots');

const sharedFiles = read('.github/workflows/shared-files-guard.yml');
must('.github/workflows/shared-files-guard.yml', sharedFiles, /^name:\s*.+/m, 'shared-files-guard must have a name');
must('.github/workflows/shared-files-guard.yml', sharedFiles, /guard-shared-files\.js/, 'shared-files-guard must run guard-shared-files.js');

const workflowDir = path.join(ROOT, '.github/workflows');
const workflowTexts = Object.fromEntries(
  fs.readdirSync(workflowDir)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => {
      const rel = `.github/workflows/${name}`;
      return [rel, fs.readFileSync(path.join(workflowDir, name), 'utf8')];
    })
);
const cacheBustPolicyInput = {
  sharedFiles,
  readiness: indexnow,
  deploy,
  cacheBust: read('scripts/cache-bust.js'),
  workflowTexts,
};
for (const issue of validateCacheBustWorkflowPolicy(cacheBustPolicyInput)) {
  issues.push(`cache-bust fail-closed policy: ${issue}`);
}
for (const issue of runCacheBustWorkflowPolicyMutationSuite(cacheBustPolicyInput)) {
  issues.push(`cache-bust policy mutation: ${issue}`);
}

must('.github/workflows/notify-on-failure.yml', notify, /Visual Parity Guard/, 'notify workflow must listen for Visual Parity Guard');
must('.github/workflows/notify-on-failure.yml', notify, /Shared Files Guard/, 'notify workflow must listen for Shared Files Guard');

console.log('\nGB WORKFLOW POLICY CHECK');
if (issues.length) {
  console.log(`❌ ${issues.length} issue(s):`);
  issues.forEach(i => console.log(`- ${i}`));
  process.exit(1);
}
console.log('✅ Workflow policy passed');
console.log('\nNOTE: For GitHub Actions YAML syntax/expression validation,');
console.log('also run the repository-pinned actionlint v1.7.7 binary.');
console.log('actionlint catches expression syntax, missing inputs, shell errors in run commands.');
console.log('Shared Files Guard installs and runs the pinned binary on main and PRs.');
