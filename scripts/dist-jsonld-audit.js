#!/usr/bin/env node
/**
 * dist-jsonld-audit.js — parse every JSON-LD block in a built artifact and
 * run the canonical registry-driven SEO audit over the same production root.
 *
 * Why this exists: root/source SEO checks can pass while Astro-owned dist pages
 * ship malformed inline JSON-LD strings or disappear from SEO coverage. The
 * production artifact is `dist/`, so deployment readiness must validate every
 * registered production route in that artifact directly.
 *
 * Usage:
 *   node scripts/dist-jsonld-audit.js [--root dist]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const rootArg = process.argv.includes('--root')
  ? process.argv[process.argv.indexOf('--root') + 1]
  : 'dist';
const auditRoot = path.resolve(ROOT, rootArg || 'dist');
const errors = [];
let htmlFiles = 0;
let blocks = 0;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && p.endsWith('.html')) out.push(p);
  }
  return out;
}

function rel(file) {
  return path.relative(auditRoot, file).replace(/\\/g, '/');
}

if (!fs.existsSync(auditRoot)) {
  console.error(`❌ dist JSON-LD audit root missing: ${path.relative(ROOT, auditRoot)}`);
  process.exit(1);
}

for (const file of walk(auditRoot)) {
  htmlFiles++;
  const html = fs.readFileSync(file, 'utf8');
  const matches = [...html.matchAll(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  matches.forEach((m, idx) => {
    blocks++;
    const raw = m[1].trim();
    if (!raw) {
      errors.push(`${rel(file)} block ${idx + 1}: empty JSON-LD block`);
      return;
    }
    try {
      JSON.parse(raw);
    } catch (e) {
      const snippet = raw.slice(0, 420).replace(/\s+/g, ' ');
      errors.push(`${rel(file)} block ${idx + 1}: ${e.message}\n  ${snippet}`);
    }
  });
}

console.log(`DIST JSON-LD AUDIT (${path.relative(ROOT, auditRoot) || '.'})`);
console.log(`HTML files scanned: ${htmlFiles}`);
console.log(`JSON-LD blocks: ${blocks}`);

const seoAudit = spawnSync(
  process.execPath,
  [path.join(ROOT, 'scripts/seo-audit.js'), '--root', auditRoot, '--registry'],
  { cwd: ROOT, stdio: 'inherit' }
);
if (seoAudit.error) {
  errors.push(`registry SEO audit could not start: ${seoAudit.error.message}`);
} else if (seoAudit.status !== 0) {
  errors.push(`registry SEO audit exited with status ${seoAudit.status}`);
}

if (errors.length) {
  console.error(`\n❌ Dist JSON-LD/SEO audit failed: ${errors.length} issue(s)`);
  errors.forEach((e) => console.error(`- ${e}`));
  process.exit(1);
}

console.log('\n✅ Dist JSON-LD/SEO audit passed');
