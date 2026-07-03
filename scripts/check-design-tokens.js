#!/usr/bin/env node
/* Design token governance check (v21). */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const site = fs.readFileSync(path.join(root, 'css/site.css'), 'utf8');

const required = [
  '--color-canvas', '--color-surface', '--color-surface-muted', '--color-surface-quote',
  '--color-text', '--color-text-primary', '--color-text-secondary', '--color-text-muted', '--color-text-faint',
  '--color-border', '--color-border-strong', '--color-accent', '--color-accent-soft', '--color-accent-strong', '--color-link',
  '--color-success-bg', '--color-success-border', '--color-warning-bg', '--color-warning-border',
  '--color-danger-bg', '--color-danger-border', '--color-fact-bg', '--color-fact-border',
  '--color-tooltip-bg', '--color-tooltip-text'
];

const aliases = {
  '--bg': '--color-canvas', '--bg-elevated': '--color-surface', '--text': '--color-text', '--muted': '--color-text-muted',
  '--border': '--color-border', '--accent': '--color-accent',
  '--accent-soft': '--color-accent-soft'
};

/* Some legacy aliases were removed from :root in earlier refactors.
   They are tracked here so that if anyone re-adds a var() reference
   to them, the ratchet check below will catch it.
   --border-strong is defined in @media(prefers-contrast:more) as a
   literal value (#666/#aaa), not a var() alias — that's intentional. */
const removedAliases = [
  '--border-strong', '--accent-strong', '--link', '--note-bg', '--quote-bg',
  '--text-primary', '--text-secondary', '--text-muted', '--fg', '--fg-secondary'
];

function esc(s) { return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'); }
let errors = 0;
for (const token of required) {
  if (!new RegExp(`${esc(token)}\\s*:`).test(site)) {
    console.error(`❌ Missing canonical token: ${token}`);
    errors++;
  }
}
for (const [legacy, canonical] of Object.entries(aliases)) {
  const re = new RegExp(`${esc(legacy)}\\s*:\\s*var\\(${esc(canonical)}\\)`);
  if (!re.test(site)) {
    console.error(`❌ Legacy alias not mapped: ${legacy} → ${canonical}`);
    errors++;
  }
}
if (errors) process.exit(1);

/* Ratchet: legacy usages may go down, but must not increase.
   Update this baseline only when a migration patch reduces the count. */
const MAX_LEGACY_USES = 0;

const cssFiles = fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css'));
const legacyNames = Object.keys(aliases).concat(removedAliases).sort((a, b) => b.length - a.length);
let legacyUses = 0;
for (const file of cssFiles) {
  const css = fs.readFileSync(path.join(root, 'css', file), 'utf8');
  for (const legacy of legacyNames) {
    const matches = css.match(new RegExp(`var\\(${esc(legacy)}[),]`, 'g'));
    if (matches) legacyUses += matches.length;
  }
}
if (legacyUses > MAX_LEGACY_USES) {
  console.error(`❌ Legacy var() references increased: ${legacyUses} > ${MAX_LEGACY_USES}`);
  process.exit(1);
}
console.log('✅ Design token foundation OK');
console.log(`ℹ️ Legacy var() references remaining during staged migration: ${legacyUses} / ${MAX_LEGACY_USES}`);
