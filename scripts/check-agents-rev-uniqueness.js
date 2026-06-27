#!/usr/bin/env node
/**
 * check-agents-rev-uniqueness.js
 *
 * Гарантирует, что каждый `AGENTS-rNNN` в таблице ревизий AGENTS.md уникален.
 * Дубликаты разных commit-сообщений под одним номером ломают traceability.
 *
 * Inline references вида "См. AGENTS-r252" не считаются дубликатами —
 * проверяем только записи таблицы (формат `| **AGENTS-rNNN** |`).
 *
 * Closes BUG-B3 / AuditRepo recommendation 2026-06-26.
 *
 * Запуск: node scripts/check-agents-rev-uniqueness.js
 * Exit 0 = clean, exit 1 = duplicates found.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AGENTS_MD = path.join(ROOT, 'AGENTS.md');

if (!fs.existsSync(AGENTS_MD)) {
  console.error('❌ AGENTS.md not found at', AGENTS_MD);
  process.exit(1);
}

const src = fs.readFileSync(AGENTS_MD, 'utf8');

// Match only table-row entries, not inline references
const entryRe = /\|\s*\*\*AGENTS-r(\d+)\*\*\s*\|/g;
const counts = new Map();
let m;
while ((m = entryRe.exec(src)) !== null) {
  const id = m[1];
  counts.set(id, (counts.get(id) || 0) + 1);
}

const dups = [...counts.entries()].filter(([, n]) => n > 1);

if (dups.length === 0) {
  console.log('✅ AGENTS-rNNN entries are unique (' + counts.size + ' total)');
  process.exit(0);
}

console.error('❌ AGENTS-rNNN duplicate entries found:');
for (const [id, n] of dups.sort()) {
  console.error(`   r${id}: ${n} entries`);
}
console.error('');
console.error('Fix: renumber the later occurrence(s) to the next free `r{N+1}` value');
console.error('     and add a note "(was duplicate of rNNN)" in the new entry.');
process.exit(1);
