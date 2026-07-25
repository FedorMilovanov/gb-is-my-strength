#!/usr/bin/env node
/**
 * Repository workflow policy guard.
 * Keeps publication, diagnostic and control-plane workflows aligned with the
 * build-once release architecture and the existing quality gates.
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
  const absolute = path.join(ROOT, rel);
  if (!fs.existsSync(absolute)) {
    issues.push(`${rel}: missing`);
    return '';
  }
  return fs.readFileSync(absolute, 'utf8');
}
function must(file, text, pattern, message) {
  if (!pattern.test(text)) issues.push(`${file}: ${message}`);
}
function mustNot(file, text, pattern, message) {
  if (pattern.test(text)) issues.push(`${file}: ${message}`);
}
function mustScript(scripts, name, pattern, message) {
  const value = scripts && scripts[name];
  if (typeof value !== 'string') issues.push(`package.json scripts.${name}: missing`);
  else if (!pattern.test(value)) issues.push(`package.json scripts.${name}: ${message}`);
}
function count(text, pattern) { return (text.match(pattern) || []).length; }
function jobSection(workflow, name, nextName = null) {
  const marker = `\n  ${name}:\n`;
  const start = workflow.indexOf(marker);
  if (start < 0) return '';
  const offset = start + marker.length;
  if (!nextName) return workflow.slice(offset);
  const end = workflow.indexOf(`\n  ${nextName}:\n`, offset);
  return end < 0 ? workflow.slice(offset) : workflow.slice(offset, end);
}
function mustAllWorkflowsHaveBasics() {
  const directory = path.join(ROOT, '.github/workflows');
  for (const name of fs.readdirSync(directory).filter((file) => /\.ya?ml$/.test(file))) {
    const rel = `.github/workflows/${name}`;
    const text = read(rel);
    must(rel, text, /^name:\s*.+/m, 'missing workflow name');
    must(rel, text, /^on:\s*$/m, 'missing on: block');
    must(rel, text, /^permissions:\s*$/m, 'missing top-level permissions block');
  }
}

mustAllWorkflowsHaveBasics();

let pkg = { scripts: {} };
try { pkg = JSON.parse(read('package.json')); }
catch (error) { issues.push(`package.json: invalid JSON: ${error.message}`); }
const scripts = pkg.scripts || {};
for (const [name, pattern, message] of [
  ['validate:static-publication', /page-ownership:check/, 'must include page-ownership manifest/source guard'],
  ['strangler:validate', /page-ownership:dist/, 'must verify ownership after building strangler dist'],
  ['strangler:audit', /page-ownership:dist/, 'must verify ownership before dist publication audit'],
  ['strangler:audit:pagefind', /page-ownership:dist/, 'must verify ownership before Pagefind/dist audit'],
  ['strangler:audit:production-like', /page-ownership:dist:production-like/, 'must verify production-like ownership'],
  ['strangler:audit:production-like', /contract:compare:dist/, 'must compare public URL contract'],
  ['strangler:audit:production-like', /dist:jsonld:audit/, 'must parse JSON-LD'],
  ['strangler:audit:production-like', /schema:rich-results:audit:dist|schema-rich-results-audit\.js[^\n]*--root\s+dist/, 'must audit rich-results schema'],
  ['strangler:audit:production-like', /audit:premium-controls|premium-controls-rollout-audit\.js/, 'must enforce PremiumControls rollout'],
  ['dist:jsonld:audit', /dist-jsonld-audit\.js[^\n]*--root\s+dist/, 'must audit JSON-LD in dist'],
  ['schema:rich-results:audit:dist', /schema-rich-results-audit\.js[^\n]*--root\s+dist/, 'must audit rich-results schema in dist'],
  ['strangler:deploy-readiness', /astro:audit:about/, 'must include about pilot audit'],
  ['strangler:deploy-readiness', /astro:audit:article-mdx:strict/, 'must include strict article MDX audit'],
  ['strangler:deploy-readiness', /strangler:audit:production-like/, 'must include production-like strangler audit'],
  ['strangler:deploy-readiness', /visual:parity:production|visual-parity-contract\.js/, 'must include visual parity'],
]) mustScript(scripts, name, pattern, message);

const deployPath = '.github/workflows/deploy.yml';
const deploy = read(deployPath);
const releaseReadiness = jobSection(deploy, 'readiness', 'deploy');
const releaseDeploy = jobSection(deploy, 'deploy');
must(deployPath, deploy, /push:\s*\n\s*branches:\s*\[main\][\s\S]{0,100}- '\*\*'/, 'must own every main push through catch-all coverage');
must(deployPath, deploy, /workflow_dispatch:/, 'must keep manual rollback/recovery entry');
must(deployPath, deploy, /^permissions:\s*\n\s*contents:\s*read\s*$/m, 'top-level permissions must remain read-only');
must(deployPath, deploy, /^concurrency:\s*$/m, 'must keep concurrency');
must(deployPath, releaseReadiness, /permissions:\s*\n\s*contents:\s*read/, 'candidate readiness job must remain read-only');
must(deployPath, releaseReadiness, /node-version:\s*['"]22\.12\.0['"]/, 'candidate job must use exact Node 22.12.0');
must(deployPath, releaseReadiness, /persist-credentials:\s*false/, 'candidate checkout must drop credentials');
must(deployPath, releaseReadiness, /npm run validate:static-publication/, 'candidate job must run full static publication gates');
must(deployPath, releaseReadiness, /npm run strangler:build:production-like/, 'candidate job must build production-like dist');
must(deployPath, releaseReadiness, /npm run page-ownership:dist:production-like|check-page-ownership\.js[^\n]*--dist[^\n]*--production-like/, 'candidate job must verify page ownership');
must(deployPath, releaseReadiness, /npm run pagefind:build:dist/, 'candidate job must build Pagefind');
must(deployPath, releaseReadiness, /npm run visual:parity:production|visual-parity-contract\.js/, 'candidate job must run visual parity');
must(deployPath, releaseReadiness, /dist-publication-audit\.js[^\n]*--require-pagefind[^\n]*--forbid-dev|npm run strangler:audit:production-like/, 'candidate job must run strict dist publication audit');
must(deployPath, releaseReadiness, /contract:compare:dist/, 'candidate job must compare public URL contract');
must(deployPath, releaseReadiness, /dist:jsonld:audit|dist-jsonld-audit\.js[^\n]*--root\s+dist/, 'candidate job must parse JSON-LD');
must(deployPath, releaseReadiness, /schema:rich-results:audit:dist|schema-rich-results-audit\.js[^\n]*--root\s+dist/, 'candidate job must audit rich-results schema');
must(deployPath, releaseReadiness, /audit:premium-controls|premium-controls-rollout-audit\.js/, 'candidate job must enforce PremiumControls rollout');
must(deployPath, releaseReadiness, /playwright install --with-deps chromium/, 'candidate job must install Chromium before route audits');
must(deployPath, releaseReadiness, /gill:mobile-layout:audit|gill-mobile-layout-audit\.js/, 'candidate job must run Gill mobile layout audit');
must(deployPath, releaseReadiness, /gill:pre-v16-submenu:audit|gill-pre-v16-submenu-regression-audit\.js/, 'candidate job must run Gill submenu regression audit');
must(deployPath, releaseReadiness, /dist-smoke-audit\.js[^\n]*--no-build[^\n]*--production-like/, 'candidate job must run broad runtime smoke');
must(deployPath, releaseReadiness, /sw:dist:audit:deploy-switch|sw-dist-readiness-audit\.js[^\n]*--require-cache-bump/, 'candidate job must enforce service-worker readiness');
must(deployPath, releaseReadiness, />\s*"?dist\/\$\{KEY\}\.txt"?/, 'candidate job must write IndexNow key into dist');
must(deployPath, releaseReadiness, /touch\s+dist\/\.nojekyll/, 'candidate job must create dist/.nojekyll');
must(deployPath, releaseReadiness, /write-deployment-provenance\.mjs/, 'candidate job must write generic provenance');
must(deployPath, releaseReadiness, /verify-release-candidate\.mjs/, 'candidate job must verify the prepared candidate');
must(deployPath, releaseReadiness, /actions\/upload-artifact@[a-f0-9]{40}/, 'candidate job must upload immutable evidence with a pinned action');
must(deployPath, releaseDeploy, /needs:\s*readiness/, 'privileged deploy must depend on candidate readiness');
must(deployPath, releaseDeploy, /permissions:\s*\n\s*actions:\s*read\s*\n\s*contents:\s*read\s*\n\s*pages:\s*write\s*\n\s*id-token:\s*write/, 'privileged deploy permissions must be exact');
must(deployPath, releaseDeploy, /actions\/download-artifact@[a-f0-9]{40}/, 'privileged deploy must download the exact candidate');
must(deployPath, releaseDeploy, /verify-release-candidate\.mjs[\s\S]*actions\/upload-pages-artifact@[a-f0-9]{40}/, 'candidate verification must precede pinned Pages packaging');
must(deployPath, releaseDeploy, /actions\/upload-pages-artifact@[a-f0-9]{40}\s+# v3/, 'Pages packaging action must be pinned');
must(deployPath, releaseDeploy, /actions\/deploy-pages@[a-f0-9]{40}\s+# v4/, 'Pages deployment action must be pinned');
must(deployPath, releaseDeploy, /live-release-contract\.mjs[\s\S]*tts-live-deployment-contract\.mjs/, 'generic live witness must precede TTS capability witness');
mustNot(deployPath, releaseDeploy, /actions\/checkout@|\bnpm ci\b|strangler:build|cache-bust\.js|validate:static-publication|pagefind:build/, 'privileged deploy must not checkout, install, validate or build source');
mustNot(deployPath, deploy, /uses:\s*actions\/(?:checkout|setup-node|upload-artifact|download-artifact|upload-pages-artifact|deploy-pages)@v\d+/i, 'release workflow must not use mutable action tags');
if (count(deploy, /actions\/checkout@/g) !== 1) issues.push(`${deployPath}: exactly one checkout is allowed`);
if (count(deploy, /\bnpm ci\b/g) !== 1) issues.push(`${deployPath}: exactly one npm ci is allowed`);
if (count(deploy, /npm run strangler:build:production-like/g) !== 1) issues.push(`${deployPath}: exactly one production-like build is allowed`);
if (count(deploy, /actions\/deploy-pages@/g) !== 1) issues.push(`${deployPath}: exactly one Pages deployment is allowed`);

const distDryRunPath = '.github/workflows/dist-dry-run.yml';
const distDryRun = read(distDryRunPath);
for (const [pattern, message] of [
  [/workflow_dispatch:/, 'must be manually runnable only'],
  [/node-version:\s*['"]?22['"]?/, 'must use Node 22+'],
  [/npm ci/, 'must install dependencies via npm ci'],
  [/playwright install --with-deps chromium/, 'must install Chromium'],
  [/npm run ci:check/, 'must run root publication gates'],
  [/npm run astro:audit:about:shots/, 'must generate about screenshots'],
  [/npm run strangler:deploy-readiness/, 'must run production-like readiness'],
  [/actions\/upload-artifact@v4/, 'must upload review artifacts without deploying'],
]) must(distDryRunPath, distDryRun, pattern, message);
const expectedDryRunRoutes = [
  'articles/index.html', 'biografii/index.html', 'hard-texts/index.html', 'pastor-series/index.html',
  'rodosloviye/index.html', 'nagornaya/index.html', 'nagornaya/seriya/index.html',
  'nagornaya/istochniki/index.html', 'nagornaya/nakhodki/index.html', 'karty/index.html',
  'karty/avraam/index.html', 'karty/ishod/index.html', 'konfessii/index.html',
  'konfessii/russkij-baptizm/index.html', 'map/index.html', 'nagornaya/chast-1/index.html',
  'nagornaya/chast-2/index.html', 'nagornaya/chast-3/index.html', 'nagornaya/chast-4/index.html',
  'nagornaya/chast-5/index.html', 'articles/dzhon-gill-spravochnik/index.html',
  'articles/dzhon-gill-istoricheskiy-kontekst/index.html',
  'articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/index.html',
  'articles/kod-da-vinchi/index.html', 'articles/dzhon-gill-chast-1-chelovek/index.html',
  'articles/dzhon-gill-chast-2-uchenyi/index.html', 'articles/dzhon-gill-chast-3-nasledie/index.html',
  'articles/dzhon-gill-chast-4-ekzeget/index.html', 'articles/krajne-li-isporcheno-serdce/index.html',
  'articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/index.html',
  'articles/20-antisovetov-pastoru/index.html',
];
for (const route of expectedDryRunRoutes) must(distDryRunPath, distDryRun, new RegExp(`test -f dist/${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `must assert ${route}`);
for (const route of ['dev/astro-test/index.html', 'dev/article-mdx-pilot/index.html']) must(distDryRunPath, distDryRun, new RegExp(`test ! -e dist/${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `must reject ${route}`);
mustNot(distDryRunPath, distDryRun, /actions\/deploy-pages|actions\/upload-pages-artifact|pages:\s*write|id-token:\s*write/, 'must not own Pages capability');
mustNot(distDryRunPath, distDryRun, /\bpush:|\bschedule:|workflow_run:/, 'must remain workflow_dispatch-only');

const diagnosticsPath = '.github/workflows/indexnow.yml';
const diagnostics = read(diagnosticsPath);
must(diagnosticsPath, diagnostics, /push:\s*\n\s*branches:\s*\[main\][\s\S]{0,100}- '\*\*'/, 'must retain catch-all main diagnostics');
must(diagnosticsPath, diagnostics, /^permissions:\s*\n\s*contents:\s*read\s*$/m, 'must remain read-only');
must(diagnosticsPath, diagnostics, /editorial-metadata-registry\.js --check/, 'must validate metadata registry');
must(diagnosticsPath, diagnostics, /node scripts\/cache-bust\.js/, 'must check source revisions without writing');
mustNot(diagnosticsPath, diagnostics, /\bnpm ci\b|strangler:build|pagefind:build|dist-publication-audit|playwright install/, 'must not duplicate release installation or dist build');
mustNot(diagnosticsPath, diagnostics, /pages:\s*write|id-token:\s*write|actions\/deploy-pages|actions\/upload-pages-artifact/, 'must not own Pages publication');
must(deployPath, deploy, /build-indexnow-urls\.js[^\n]*--base/, 'release candidate must precompute IndexNow URL list');

const sourceLinksPath = '.github/workflows/source-links.yml';
const sourceLinks = read(sourceLinksPath);
must(sourceLinksPath, sourceLinks, /workflow_dispatch:/, 'must be manually runnable');
must(sourceLinksPath, sourceLinks, /schedule:/, 'must be scheduled');
must(sourceLinksPath, sourceLinks, /npm run strangler:build:production-like/, 'must build production-like dist first');
must(sourceLinksPath, sourceLinks, /source-link-audit\.js[^\n]*--root\s+dist/, 'must audit production-like dist');
must(sourceLinksPath, sourceLinks, /^concurrency:\s*$/m, 'must keep concurrency');

const interactivePath = '.github/workflows/interactive-audit.yml';
const interactive = read(interactivePath);
must(interactivePath, interactive, /workflow_dispatch:/, 'must be manually runnable');
must(interactivePath, interactive, /schedule:/, 'must be scheduled');
must(interactivePath, interactive, /playwright install --with-deps chromium/, 'must install Chromium');
must(interactivePath, interactive, /npm run strangler:build:production-like/, 'must build production-like dist first');
must(interactivePath, interactive, /npm run pagefind:build:dist/, 'must build Pagefind');
must(interactivePath, interactive, /python3 -m http\.server 8080 --bind 127\.0\.0\.1 -d dist/, 'must serve dist');
must(interactivePath, interactive, /npm run interactive-audit/, 'must execute interactive audit');
must(interactivePath, interactive, /AUDIT_BASE:\s*http:\/\/127\.0\.0\.1:8080/, 'must set local audit base');
must(interactivePath, interactive, /^concurrency:\s*$/m, 'must keep concurrency');

const notifyPath = '.github/workflows/notify-on-failure.yml';
const notify = read(notifyPath);
for (const workflowName of ['Source Link Audit', 'Runtime Interactive Audit', 'Dist Strangler Dry Run', 'Visual Parity Guard', 'Shared Files Guard']) must(notifyPath, notify, new RegExp(workflowName), `must listen for ${workflowName}`);
must(notifyPath, notify, /source-link|Source Link|hard-broken/i, 'must explain source-link failures');
must(notifyPath, notify, /interactive|Runtime Interactive/i, 'must explain runtime audit failures');
must(notifyPath, notify, /dist strangler|production-like dist|Dist Strangler/i, 'must explain dist dry-run failures');

const visualPath = '.github/workflows/visual-parity.yml';
const visual = read(visualPath);
must(visualPath, visual, /^name:\s*.+/m, 'must have a name');
must(visualPath, visual, /^on:\s*$/m, 'must have an on block');
must(visualPath, visual, /visual-parity-screenshots\.js/, 'must run screenshots');

const sharedPath = '.github/workflows/shared-files-guard.yml';
const shared = read(sharedPath);
must(sharedPath, shared, /^name:\s*.+/m, 'must have a name');
must(sharedPath, shared, /guard-shared-files\.js/, 'must run shared-files guard');

const workflowDirectory = path.join(ROOT, '.github/workflows');
const workflowTexts = Object.fromEntries(
  fs.readdirSync(workflowDirectory)
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => {
      const rel = `.github/workflows/${name}`;
      return [rel, fs.readFileSync(path.join(workflowDirectory, name), 'utf8')];
    }),
);
const cacheBustPolicyInput = {
  sharedFiles: shared,
  readiness: diagnostics,
  deploy,
  cacheBust: read('scripts/cache-bust.js'),
  workflowTexts,
};
for (const issue of validateCacheBustWorkflowPolicy(cacheBustPolicyInput)) issues.push(`cache-bust fail-closed policy: ${issue}`);
for (const issue of runCacheBustWorkflowPolicyMutationSuite(cacheBustPolicyInput)) issues.push(`cache-bust policy mutation: ${issue}`);

console.log('\nGB WORKFLOW POLICY CHECK');
if (issues.length) {
  console.log(`❌ ${issues.length} issue(s):`);
  issues.forEach((issue) => console.log(`- ${issue}`));
  process.exit(1);
}
console.log('✅ Workflow policy passed');
console.log('✅ One automatic production build; metadata diagnostics remain read-only and build-free');
console.log('✅ Privileged Pages actions are pinned to full commit SHAs');
console.log('NOTE: actionlint separately validates YAML syntax, expressions and shell fragments.');
