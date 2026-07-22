#!/usr/bin/env node
'use strict';
const fs = require('fs');
const assert = require('assert/strict');
const parts = [1, 2, 3, 4, 5];
for (const part of parts) {
  const file = `src/components/nagornaya/chast-${part}/NagornayaChast${part}PageChrome.astro`;
  const source = fs.readFileSync(file, 'utf8');
  const tags = source.match(/<button[^>]+class="gb-ember nag-sidebar-ember"[^>]*>/g) || [];
  assert.equal(tags.length, 1, `${file}: expected exactly one Nagornaya Play control`);
  assert.match(tags[0], /aria-haspopup="dialog"/, `${file}: Play control must expose speed-dialog semantics`);
  assert.match(tags[0], /aria-expanded="false"/, `${file}: Play control must declare its initial closed state`);
}
console.log('✅ Nagornaya PremiumControls ARIA source contract passed (parts I–V)');
