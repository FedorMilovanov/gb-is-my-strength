#!/usr/bin/env node
'use strict';

/** Static ownership guard for the physical print-fragmentation fallback. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const GEOMETRY_PATH = 'src/runtime/print-pagination-geometry.js';
const COMPOSITION_PATH = 'src/components/reader-platform/ReaderActionsRuntime.astro';
const geometry = fs.readFileSync(path.join(ROOT, GEOMETRY_PATH), 'utf8');
const composition = fs.readFileSync(path.join(ROOT, COMPOSITION_PATH), 'utf8');
const failures = [];

function requireContract(name, condition) {
  if (condition) console.log(`✅ Print geometry · ${name}`);
  else {
    failures.push(name);
    console.error(`❌ Print geometry · ${name}`);
  }
}

const geometryImport = "import '../../runtime/print-pagination-geometry.js';";
const actionsImport = "import '../../runtime/reader-actions.js';";
requireContract('geometry is composed before reader actions',
  composition.indexOf(geometryImport) >= 0
  && composition.indexOf(actionsImport) > composition.indexOf(geometryImport));
requireContract('semantic classifier remains the upstream owner',
  geometry.includes('window.GBPrintPagination')
  && geometry.includes("api.version !== 1")
  && geometry.includes('originalPrepare'));
requireContract('physical fallback is print-media only',
  geometry.includes("matchMedia?.('print').matches")
  && geometry.includes("window.addEventListener('beforeprint'")
  && geometry.includes("window.addEventListener('afterprint'"));
requireContract('fallback consumes the canonical atomic contract',
  geometry.includes('[data-print-flow="atomic"]')
  && geometry.includes('data-print-keep-next')
  && geometry.includes('.gb-print-closing-group'));
requireContract('short atomics use browser-owned monolithic fragmentation',
  geometry.includes("setProperty('display', 'inline-block', 'important')")
  && geometry.includes("strategy: 'short-atomic-inline-block'")
  && geometry.includes('MAX_ATOMIC_PX'));
requireContract('manual page arithmetic and forced breaks stay absent',
  !geometry.includes('break-before')
  && !geometry.includes('page-break-before')
  && !geometry.includes('pageOffset')
  && !geometry.includes('alignToNextPage')
  && !geometry.includes('modulo('));
requireContract('implementation is route and article agnostic',
  !/novoe-serdce|quote-box|dzhon-gill|heart-book|kod-da-vinchi|hermenevtika/i.test(geometry));
requireContract('reset restores every inline property and marker',
  geometry.includes('const PROPERTIES =')
  && geometry.includes('restoreProperty')
  && geometry.includes('clearGeometry')
  && geometry.includes("removeAttribute('data-gb-print-monolith')"));
requireContract('repeated prepare and beforeprint are idempotent',
  geometry.includes('preparedForPrint && lastReport')
  && geometry.includes('preparedForPrint = true')
  && geometry.includes('lastReport = null'));

const syntax = spawnSync(process.execPath, ['--check', path.join(ROOT, GEOMETRY_PATH)], { encoding: 'utf8' });
requireContract('geometry module parses as JavaScript', syntax.status === 0);
if (syntax.status !== 0) console.error((syntax.stderr || syntax.stdout || '').trim());

if (failures.length) {
  console.error(`\n❌ print geometry contract — ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('\n✅ print geometry contract — ownership, lifecycle and reversibility intact');
