#!/usr/bin/env node
/**
 * Workflow policy guard.
 * Keeps GitHub Actions aligned with the local publication-quality gates so
 * future agents cannot silently weaken CI by editing YAML.
 */
'use strict';
const fs = require('fs');
const path = require('path');
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
mustScript(scripts, 'strangler:deploy-readiness', /astro:audit:about/, 'must include about pilot audit');
mustScript(scripts, 'strangler:deploy-readiness', /astro:audit:article-mdx:strict/, 'must include strict article MDX shadow audit');
mustScript(scripts, 'strangler:deploy-readiness', /strangler:audit:production-like/, 'must include production-like strangler audit');

const deploy = read('.github/workflows/deploy.yml');
must('.github/workflows/deploy.yml', deploy, /node-version:\s*['"]?22['"]?/, 'deploy must use Node 22+ for Astro toolchain compatibility');
must('.github/workflows/deploy.yml', deploy, /npm ci/, 'deploy must install dependencies via npm ci');
must('.github/workflows/deploy.yml', deploy, /npm run validate:static-publication/, 'deploy must run validate:static-publication');
must('.github/workflows/deploy.yml', deploy, /^concurrency:\s*$/m, 'deploy must keep concurrency');
must('.github/workflows/deploy.yml', deploy, /actions\/upload-pages-artifact@v3/, 'deploy must upload a Pages artifact');

// Strangler safety rail: production currently uploads the legacy repository root.
// If a future commit switches the Pages artifact to dist, it must also switch
// Pagefind, IndexNow key placement, .nojekyll placement and deploy-like dist audits
// in the same small PR. This prevents a half-switched workflow.
const deployUploadsDist = /^\s*path:\s*['"]?(?:\.\/)?dist\/?['"]?\s*$/m.test(deploy);
if (deployUploadsDist) {
  must('.github/workflows/deploy.yml', deploy, /npm run strangler:build:production-like/, 'dist deploy must build production-like strangler dist');
  must('.github/workflows/deploy.yml', deploy, /npm run page-ownership:dist:production-like|check-page-ownership\.js[^\n]*--dist[^\n]*--production-like/, 'dist deploy must verify page ownership against production-like dist');
  must('.github/workflows/deploy.yml', deploy, /npm run pagefind:build:dist/, 'dist deploy must build Pagefind into dist/pagefind');
  must('.github/workflows/deploy.yml', deploy, /dist-publication-audit\.js[^\n]*--require-pagefind[^\n]*--forbid-dev|npm run strangler:audit:production-like/, 'dist deploy must run production-like dist publication audit with Pagefind required and dev route forbidden');
  must('.github/workflows/deploy.yml', deploy, /sw:dist:audit:deploy-switch|sw-dist-readiness-audit\.js[^\n]*--require-cache-bump/, 'dist deploy must enforce service-worker cache-version bump');
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
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/articles\/dzhon-gill-spravochnik\/index\.html/, 'dist dry run must assert Gill reference shadow article route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/articles\/dzhon-gill-istoricheskiy-kontekst\/index\.html/, 'dist dry run must assert Gill context shadow article route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/articles\/rimlyanam-7-veruyushchiy-ili-neveruyushchiy\/index\.html/, 'dist dry run must assert Romans 7 shadow article route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/articles\/kod-da-vinchi\/index\.html/, 'dist dry run must assert Kod da Vinci shadow article route exists');
must('.github/workflows/dist-dry-run.yml', distDryRun, /test -f dist\/articles\/dzhon-gill-chast-1-chelovek\/index\.html/, 'dist dry run must assert Gill part 1 shadow article route exists');
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
must('.github/workflows/indexnow.yml', indexnow, /npm run validate:static-publication/, 'indexnow must run validate:static-publication before metadata commit');
must('.github/workflows/indexnow.yml', indexnow, /contents:\s*write/, 'indexnow needs contents: write for metadata commit');

const sourceLinks = read('.github/workflows/source-links.yml');
must('.github/workflows/source-links.yml', sourceLinks, /workflow_dispatch:/, 'source link audit must be manually runnable');
must('.github/workflows/source-links.yml', sourceLinks, /schedule:/, 'source link audit must be scheduled');
must('.github/workflows/source-links.yml', sourceLinks, /npm run source:links/, 'source link audit must run npm run source:links');
must('.github/workflows/source-links.yml', sourceLinks, /^concurrency:\s*$/m, 'source link audit must keep concurrency');

const interactive = read('.github/workflows/interactive-audit.yml');
must('.github/workflows/interactive-audit.yml', interactive, /workflow_dispatch:/, 'interactive audit must be manually runnable');
must('.github/workflows/interactive-audit.yml', interactive, /schedule:/, 'interactive audit must be scheduled');
must('.github/workflows/interactive-audit.yml', interactive, /playwright install --with-deps chromium/, 'interactive audit must install Chromium with deps');
must('.github/workflows/interactive-audit.yml', interactive, /python3 -m http\.server 8080 --bind 127\.0\.0\.1/, 'interactive audit must start local server');
must('.github/workflows/interactive-audit.yml', interactive, /npm run interactive-audit/, 'interactive audit must run npm run interactive-audit');
must('.github/workflows/interactive-audit.yml', interactive, /AUDIT_BASE:\s*http:\/\/127\.0\.0\.1:8080/, 'interactive audit must set AUDIT_BASE');
must('.github/workflows/interactive-audit.yml', interactive, /^concurrency:\s*$/m, 'interactive audit must keep concurrency');

const notify = read('.github/workflows/notify-on-failure.yml');
must('.github/workflows/notify-on-failure.yml', notify, /Source Link Audit/, 'notify workflow must listen for Source Link Audit');
must('.github/workflows/notify-on-failure.yml', notify, /Runtime Interactive Audit/, 'notify workflow must listen for Runtime Interactive Audit');
must('.github/workflows/notify-on-failure.yml', notify, /source-link|Source Link|hard-broken/i, 'notify issue body must explain source link failures');
must('.github/workflows/notify-on-failure.yml', notify, /interactive|Runtime Interactive/i, 'notify issue body must explain runtime audit failures');

console.log('\nGB WORKFLOW POLICY CHECK');
if (issues.length) {
  console.log(`❌ ${issues.length} issue(s):`);
  issues.forEach(i => console.log(`- ${i}`));
  process.exit(1);
}
console.log('✅ Workflow policy passed');
