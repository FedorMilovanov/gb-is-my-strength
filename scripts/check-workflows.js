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

const deploy = read('.github/workflows/deploy.yml');
must('.github/workflows/deploy.yml', deploy, /npm run validate:static-publication/, 'deploy must run validate:static-publication');
must('.github/workflows/deploy.yml', deploy, /^concurrency:\s*$/m, 'deploy must keep concurrency');

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
