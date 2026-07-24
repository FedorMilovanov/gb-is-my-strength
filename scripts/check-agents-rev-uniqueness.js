#!/usr/bin/env node
/**
 * check-agents-rev-uniqueness.js
 *
 * Permanent governance guard:
 * - every `AGENTS-rNNN` table entry is unique;
 * - AGENTS / WORK_MODES / LANE_LOCK_POLICY / OWNER_INVARIANTS agree on the
 *   current FAST / LANE / SYSTEM branch+PR model;
 * - the concrete stale instructions retired by owner issue #219 cannot return.
 *
 * Inline references such as "См. AGENTS-r252" do not count as table entries.
 *
 * Run: node scripts/check-agents-rev-uniqueness.js
 * Exit 0 = clean, exit 1 = governance drift.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILES = {
  agents: path.join(ROOT, 'AGENTS.md'),
  workModes: path.join(ROOT, 'docs', 'WORK_MODES.md'),
  lanePolicy: path.join(ROOT, 'docs', 'LANE_LOCK_POLICY.md'),
  owner: path.join(ROOT, 'docs', 'OWNER-INVARIANTS.md'),
};

const errors = [];
const sources = {};

for (const [key, filePath] of Object.entries(FILES)) {
  if (!fs.existsSync(filePath)) {
    errors.push(`${key}: missing ${path.relative(ROOT, filePath)}`);
    continue;
  }
  sources[key] = fs.readFileSync(filePath, 'utf8');
}

const agents = sources.agents || '';

// Match only table-row entries, not inline references.
const entryRe = /\|\s*\*\*AGENTS-r(\d+)\*\*\s*\|/g;
const counts = new Map();
let match;
while ((match = entryRe.exec(agents)) !== null) {
  const id = match[1];
  counts.set(id, (counts.get(id) || 0) + 1);
}

for (const [id, count] of [...counts.entries()].filter(([, n]) => n > 1).sort()) {
  errors.push(`AGENTS-r${id}: ${count} table entries`);
}

const required = {
  agents: [
    'Канонические режимы: `FAST`, `LANE`, `SYSTEM`',
    'Любая mutation выполняется в отдельной ветке и PR',
    '`migration/route-migration-matrix.json` — производный артефакт',
    'checksum-verified actionlint',
    'live-discovery в текущей сессии',
    '| **AGENTS-r324** |',
  ],
  workModes: [
    '# Work Modes — FAST / LANE / SYSTEM',
    'All repository changes use a branch and PR.',
    'A docs file is not automatically safe',
  ],
  lanePolicy: [
    '# Lane Lock Policy — FAST / LANE / SYSTEM',
    'Direct changes to `main` are not a normal FAST path.',
    'No temporary workflow, trigger, writer or patcher survives',
  ],
  owner: [
    'PremiumControls / Floating Cluster / Gill остаются owner-sensitive',
    'исторический `pre-v16` submenu',
    'Среда определяется live-discovery',
    'Временная автоматика не переживает свою транзакцию',
  ],
};

for (const [key, snippets] of Object.entries(required)) {
  const source = sources[key] || '';
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      errors.push(`${key}: required governance text missing: ${JSON.stringify(snippet)}`);
    }
  }
}

const forbidden = {
  agents: [
    'SOLO/MULTI-AGENT/HIGH-RISK/EMERGENCY',
    'Один → SOLO (main разрешён',
    '**Всегда разрешено:** docs/',
    'actionlint, osv-scanner — известные проблемы',
    '2 CPU ~2 GB RAM',
    'Файлы сохраняются между сессиями (ext4)',
    'native / native-with-legacy-head / strict-native',
    '10-14 day freeze after sign-off',
  ],
  owner: [
    'Исторический pre-v16 submenu-контракт и rounded frame охраняются',
    'Каноническая правда аудита — AuditRepo (`MASTER_BUG_MATRIX.md` +',
  ],
};

for (const [key, snippets] of Object.entries(forbidden)) {
  const source = sources[key] || '';
  for (const snippet of snippets) {
    if (source.includes(snippet)) {
      errors.push(`${key}: retired governance text returned: ${JSON.stringify(snippet)}`);
    }
  }
}

if (errors.length > 0) {
  console.error('❌ Governance contract drift detected:');
  for (const error of errors) console.error(`   - ${error}`);
  process.exit(1);
}

console.log(`✅ Governance contract is consistent; AGENTS revisions unique (${counts.size} total)`);
