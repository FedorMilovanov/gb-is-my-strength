#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const EXPECTED_BRANCH = 'lane/system-gill-readerstate-deploy-unblock-2026-07-25';
const CONTROLLER = path.join(ROOT, 'js/floating-cluster-controller.js');
const RECONCILIATION = path.join(ROOT, 'data/gill-submenu-anchor-reconciliation.json');
const PERMANENT_WORKFLOW = path.join(ROOT, '.github/workflows/gill-pre-v16-submenu.yml');

function fail(message) {
  throw new Error(message);
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) fail(`Missing expected ${label} source block`);
  if (source.indexOf(before, first + before.length) >= 0) fail(`Expected one ${label} block, found multiple`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function assertBranch() {
  const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || '';
  if (branch !== EXPECTED_BRANCH) fail(`Ref guard rejected ${branch || '<empty>'}; expected ${EXPECTED_BRANCH}`);
}

function patchController() {
  let source = fs.readFileSync(CONTROLLER, 'utf8');
  const ttsMarkers = [
    'Сейчас системный голос',
    'gb:vosk-switch-request',
    'vosk-tts-engine.js?v=87bfc44a',
  ];
  for (const marker of ttsMarkers) {
    if (!source.includes(marker)) fail(`Current TTS controller marker missing before Gill patch: ${marker}`);
  }

  source = replaceOnce(
    source,
`        var activeIdx = -1;
        for (var ri = 0; ri < represented.length; ri++) {
          if (represented[ri].id === reader.sectionId) { activeIdx = ri; break; }
        }
        represented.forEach(function (row, idx) {
          var isActive = phase === 'active-section' && idx === activeIdx;
          var isPassed = phase === 'after-content' || (activeIdx >= 0 && idx < activeIdx);`,
`        // ReaderState remains the sole scroll/rAF owner, but its global heading
        // selector is intentionally broader than the historical Gill rail: the
        // rail is a curated subset and may target a paragraph. Derive the rail
        // index from its own real targets and the shared scroll snapshot instead
        // of requiring reader.sectionId to be one of the represented rows.
        // 140px is the canonical Gill anchor offset used by rail navigation and
        // the pre-v16 live traversal contract.
        var railLine = scrollY + 140;
        var activeIdx = phase === 'after-content' ? represented.length - 1 : 0;
        if (phase !== 'before-content' && phase !== 'after-content') {
          for (var ri = 0; ri < represented.length; ri++) {
            var targetTop = represented[ri].target.getBoundingClientRect().top + (window.scrollY || 0);
            if (targetTop <= railLine + 2) activeIdx = ri;
            else break;
          }
        }
        represented.forEach(function (row, idx) {
          var isActive = idx === activeIdx;
          var isPassed = idx < activeIdx;`,
    'curated active-index',
  );

  source = replaceOnce(
    source,
`        if (activeGrp !== _gbs2ActiveGrp) {`,
`        var activeGroupChanged = activeGrp !== _gbs2ActiveGrp;
        if (activeGroupChanged) {`,
    'active-group transition',
  );

  source = replaceOnce(
    source,
`        var countEl = qs('#gbs2Count');
        if (countEl) countEl.textContent = phase === 'before-content'
          ? 'Введение'
          : phase === 'after-content'
            ? 'Готово'
            : (activeIdx + 1) + ' / ' + represented.length;`,
`        var countEl = qs('#gbs2Count');
        if (countEl) countEl.textContent = (activeIdx + 1) + ' / ' + represented.length;`,
    'initial/final counter',
  );

  source = replaceOnce(
    source,
`        var activeRow = activeIdx >= 0 ? represented[activeIdx] : null;
        var scroller = qs('.gbs2-tocscroll');
        if (activeRow && scroller) {
          var ar = activeRow.a.getBoundingClientRect();
          var sr = scroller.getBoundingClientRect();
          if (ar.top < sr.top + 18 || ar.bottom > sr.bottom - 18) {
            var desired = activeRow.a.offsetTop - scroller.clientHeight / 2 + activeRow.a.offsetHeight / 2;
            scroller.scrollTo({ top: Math.max(0, desired), behavior: 'smooth' });
          }
        }`,
`        var activeRow = activeIdx >= 0 ? represented[activeIdx] : null;
        var scroller = qs('.gbs2-tocscroll');
        function keepActiveRowVisible(behavior) {
          if (!activeRow || !scroller) return;
          var ar = activeRow.a.getBoundingClientRect();
          var sr = scroller.getBoundingClientRect();
          if (ar.top < sr.top + 18 || ar.bottom > sr.bottom - 18) {
            var desired = activeRow.a.offsetTop - scroller.clientHeight / 2 + activeRow.a.offsetHeight / 2;
            scroller.scrollTo({ top: Math.max(0, desired), behavior: behavior || 'auto' });
          }
        }
        if (activeRow && scroller) {
          keepActiveRowVisible('smooth');
          // Expanding the new sub-group and collapsing the previous one can
          // move the active row after the immediate scroll has completed.
          // Re-check once the 560ms rail follow loop has settled, but only
          // if this row is still the canonical active row.
          if (activeGroupChanged) window.setTimeout(function () {
            if (activeRow.a.classList.contains('gbs2-active')) keepActiveRowVisible('auto');
          }, 620);
        }`,
    'active-row visibility',
  );

  source = replaceOnce(
    source,
`          qsa('.toc-part-item').forEach(function (el, idx) {
            var isActive = phase === 'active-section' && idx === activeIdx;
            var isPassed = phase === 'after-content' || (activeIdx >= 0 && idx < activeIdx);`,
`          qsa('.toc-part-item').forEach(function (el, idx) {
            var isActive = idx === activeIdx;
            var isPassed = idx < activeIdx;`,
    'part-toc active state',
  );

  for (const marker of ttsMarkers) {
    if (!source.includes(marker)) fail(`Gill patch removed TTS controller marker: ${marker}`);
  }
  if (!source.includes('var railLine = scrollY + 140;')) fail('Gill rail anchor was not installed');
  fs.writeFileSync(CONTROLLER, source, 'utf8');
}

function patchReconciliation() {
  const data = JSON.parse(fs.readFileSync(RECONCILIATION, 'utf8'));
  data.reconciledAt = '2026-07-25';
  data.policy = 'The pre-v16 GBS submenu reference at bcf6389f29ee0c89e9e96e7587e0226ecf251ae0 remains the immutable design witness for route coverage, item count, hierarchy and historical wording. Current submenu labels follow the owner-approved label-semantics rule and must match the current rendered target heading; every legitimate editorial change is recorded in the relabels map. Seven Astro migration anchor-ID renames remain documented separately in renames, while reorders record current document order required by the scrollspy.';
  data.relabelsPolicy = 'Owner decision 2026-07-05 (UI-GILL-SUBMENU-LABEL-SEMANTICS-09): a submenu label MUST match the CURRENT rendered target heading verbatim, or be its prefix for a decorated heading. The native Gill articles evolved editorially after the historical witness; 34/56 represented labels now differ from the historical wording and are explicitly reconciled here. Historical labels remain immutable in data/gill-pre-v16-submenu-reference.json; entries below document anchor-rename decisions.';
  data.relabels ||= {};

  const relabels = {
    'articles/dzhon-gill-istoricheskiy-kontekst/index.html': {
      '#sec-from-puritans-to-baptists': 'I. От пуританского спора к устойчивому миру диссента',
      '#sec-particular-vs-general': 'II. Партикулярные и генеральные баптисты: две традиции, а не две монолитные партии',
      '#sec-great-ejection': 'III. 1662 год и рождение устойчивого нонконформизма',
      '#sec-clarendon': 'IV. После терпимости: три разных стены',
      '#sec-academies': 'V. Диссентерские академии: не один подпольный университет, а целая экосистема',
      '#sec-salters-hall': 'VI. Солтерс-Холл, 1719: Троица, подписка и власть церковной формулы',
      '#sec-coffee-house': 'VII. Лондонские сети: кофейни, письма, фонды и лекции',
      '#sec-southwark': 'VIII. Саутварк: пасторство на южном берегу',
      '#sec-books': 'IX. Кеттерингская книжная лавка: что действительно сообщает Риппон',
      '#sec-conclusion': 'X. Итог: что исторический контекст объясняет — и чего не объясняет',
    },
    'articles/dzhon-gill-chast-1-chelovek/index.html': {
      '#part-calling': 'I. Становление и призвание',
      '#sec-intro': 'Самообразование вне университетской траектории',
      '#sec-birth-prophecy': 'Риппоновское предание об утре рождения',
      '#sec-education': 'Грамматическая школа, книжная лавка и самообразование',
      '#sec-evangelism': 'Евангельская активность: свидетельства и границы доказательства',
      '#sec-family-deep': 'Семья: дети, зять-издатель и богословие в деталях',
      '#sec-ordination-1720': 'Рукоположение 22 марта 1720 года: свидетельства Кросби и Риппона',
      '#sec-personal-credo': 'Личные высказывания: только с прослеживаемой передачей',
      '#sec-context-southwark': 'Кеттеринг, Саутварк и правовой мир диссентеров',
    },
    'articles/dzhon-gill-chast-2-uchenyi/index.html': {
      '#sec-hebrew': 'Раввинист — христианин с Мишной в руках',
      '#sec-canticles': 'Песнь Песней: самый личный труд Гилла',
      '#sec-systematics': '«Полный свод богословия» — первая баптистская сумма',
      '#sec-ordinances': 'Церковные установления: крещение и Вечеря',
    },
    'articles/dzhon-gill-chast-3-nasledie/index.html': {
      '#part-legacy': 'V. Историческое влияние и память',
      '#sec-church-gov': 'Управление церковью: один пастор и власть общины',
      '#sec-toplady-memoir': 'Топлэди о Гилле: Чёрный Принц и Мальборо',
      '#sec-church-gov-polity': 'О вступлении в членство и права поместной общины',
      '#sec-america': 'Влияние на Америку и Фонд партикулярных баптистов',
      '#sec-spurgeon-legacy': 'Сперджен — наследник и независимый критик',
      '#sec-gill-last-pages': 'Последние страницы: «10 000!» и Nunc Dimittis',
      '#sec-ordination-rippon': 'Риппон: «Столь великого плача в мире»',
      '#sec-gill-muller-rediscovery': 'Современное переиздание и новый этап исследований: «Проект Джона Гилла»',
      '#sec-contemporaries': 'Как современники видели Гилла: портрет из первых уст',
      '#sec-terms': 'Словарь эпохи: ключевые богословские понятия',
    },
  };

  for (const [route, labels] of Object.entries(relabels)) {
    data.relabels[route] = { ...(data.relabels[route] || {}), ...labels };
  }

  fs.writeFileSync(RECONCILIATION, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function writePermanentWorkflow() {
  const workflow = `name: Gill pre-v16 submenu contract

on:
  pull_request:
    branches: [main]
    paths:
      - 'js/floating-cluster-controller.js'
      - 'js/reader-state.js'
      - 'data/gill-pre-v16-submenu-reference.json'
      - 'data/gill-submenu-anchor-reconciliation.json'
      - 'src/components/article-pilots/gill-series/**'
      - 'src/components/article-pilots/gill-context/**'
      - 'src/components/article-pilots/gill-part1/**'
      - 'src/components/article-pilots/gill-part2/**'
      - 'src/components/article-pilots/gill-part3/**'
      - 'src/components/article-pilots/gill-spravochnik/**'
      - 'scripts/gill-pre-v16-submenu-regression-audit.js'
      - '.github/workflows/gill-pre-v16-submenu.yml'
  push:
    branches: [main]
    paths:
      - 'js/floating-cluster-controller.js'
      - 'js/reader-state.js'
      - 'data/gill-pre-v16-submenu-reference.json'
      - 'data/gill-submenu-anchor-reconciliation.json'
      - 'src/components/article-pilots/gill-series/**'
      - 'src/components/article-pilots/gill-context/**'
      - 'src/components/article-pilots/gill-part1/**'
      - 'src/components/article-pilots/gill-part2/**'
      - 'src/components/article-pilots/gill-part3/**'
      - 'src/components/article-pilots/gill-spravochnik/**'
      - 'scripts/gill-pre-v16-submenu-regression-audit.js'
      - '.github/workflows/gill-pre-v16-submenu.yml'
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: gill-pre-v16-submenu-\${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  live-submenu:
    runs-on: ubuntu-latest
    timeout-minutes: 35
    steps:
      - name: Checkout exact head
        uses: actions/checkout@v4
      - name: Set up Node 22.12
        uses: actions/setup-node@v4
        with:
          node-version: '22.12.0'
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Build production-like dist
        run: npm run strangler:build:production-like
      - name: Install Chromium
        run: npx playwright install --with-deps chromium
      - name: Require full live Gill traversal
        env:
          GILL_SUBMENU_REQUIRE_LIVE: '1'
        run: npm run gill:pre-v16-submenu:audit
      - name: Verify asset revisions remain read-only clean
        run: node scripts/cache-bust.js
      - name: Lint workflow
        run: node scripts/run-actionlint.mjs -no-color .github/workflows/gill-pre-v16-submenu.yml
      - name: Ensure proof is read-only
        run: git diff --exit-code
      - name: Upload machine-readable traversal facts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: gill-pre-v16-submenu-\${{ github.run_id }}
          path: reports/gill-pre-v16-submenu-audit/
          if-no-files-found: warn
          retention-days: 14
`;
  fs.writeFileSync(PERMANENT_WORKFLOW, workflow, 'utf8');
}

function validateDiff() {
  const changed = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
    .trim().split(/\r?\n/).filter(Boolean);
  const directAllowed = new Set([
    'js/floating-cluster-controller.js',
    'data/gill-submenu-anchor-reconciliation.json',
    'src/lib/asset-version.js',
    '.github/workflows/gill-pre-v16-submenu.yml',
  ]);
  for (const file of changed) {
    if (directAllowed.has(file)) continue;
    if (file.endsWith('.html') || file.endsWith('.astro')) {
      const diff = execFileSync('git', ['diff', '--unified=0', '--', file], { encoding: 'utf8' });
      const mutations = diff.split(/\r?\n/).filter((line) => /^[+-](?![+-])/.test(line));
      if (!mutations.length || mutations.some((line) => !line.includes('floating-cluster-controller.js?v='))) {
        fail(`Non-revision mutation detected in generated projection ${file}`);
      }
      continue;
    }
    fail(`Changed file outside clean Gill/cache-revision lane: ${file}`);
  }

  const controllerDiff = execFileSync('git', ['diff', '--', 'js/floating-cluster-controller.js'], { encoding: 'utf8' });
  if (!controllerDiff.includes('var railLine = scrollY + 140;')) fail('Controller diff lacks curated rail anchor');
  if (/^[+-](?![+-]).*(VOSK_ENGINE_SRC|gb:vosk|Сейчас системный голос)/m.test(controllerDiff)) {
    fail('Gill patch unexpectedly mutates TTS source lines');
  }
  execFileSync('git', ['diff', '--check'], { stdio: 'inherit' });
  console.log(`Clean Gill materialization validated: ${changed.length} changed files.`);
}

assertBranch();
patchController();
patchReconciliation();
writePermanentWorkflow();
execFileSync(process.execPath, ['scripts/cache-bust.js', '--write'], { cwd: ROOT, stdio: 'inherit' });
validateDiff();
