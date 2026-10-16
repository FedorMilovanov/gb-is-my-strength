#!/usr/bin/env node
/**
 * gb-is-my-strength — арбитр восстановления маскированного текста серии «Баптисты России».
 *
 * Задача скрипта: отделить проверяемое от авторского. Порча (коммит 059b3024, PR #2028)
 * заменяла каждый НЕ-ASCII символ ровно одним символом маски (`?` в компонентах,
 * бэктик в реестре), сохраняя ASCII. Значит маска — это контрольная сумма:
 *
 *     mask(donor) === cell   ⟺   кандидат доказуемо совпадает с маской по каждому символу
 *
 * Только точное совпадение маски считается доказательством. Никаких «похоже по фактам»,
 * никакой генерации текста: неподтверждённые ячейки остаются авторской работой и лишь
 * перечисляются вместе с таблицей длин слов.
 *
 * Usage:
 *   node scripts/baptisty-mask-donor-check.mjs            # отчёт (exit 0)
 *   node scripts/baptisty-mask-donor-check.mjs --json      # тот же отчёт в JSON
 *   node scripts/baptisty-mask-donor-check.mjs --apply     # записать только доказанные ячейки
 *
 * Источник донора: data/baptisty-media-sources.json (живые метаданные Wikimedia Commons).
 * Реестр: baptisty-rossii/research/media-ledger.md — таблица, маска = бэктик.
 *
 * @module scripts/baptisty-mask-donor-check
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = path.join(ROOT, 'data/baptisty-media-sources.json');
const LEDGER = path.join(ROOT, 'baptisty-rossii/research/media-ledger.md');

const MODE = process.argv.includes('--apply') ? 'apply'
  : process.argv.includes('--json') ? 'json'
    : 'report';

/** Символ маски: `?` в компонентах, бэктик в реестре. */
const MASKS = ['?', '`'];

/** Маска не-ASCII символов — одна ячейка на каждый не-ASCII символ. */
function maskOf(text, maskChar) {
  let out = '';
  for (const ch of text) out += ch.codePointAt(0) > 127 ? maskChar : ch;
  return out;
}

/** Есть ли в строке признак маски: два и более подряд идущих маскировочных символа. */
function looksMasked(text) {
  return MASKS.some((m) => new RegExp(`${m === '`' ? '`' : '\\?'}{2,}`).test(text));
}

/** Строки маски «` `» → длины слов, чтобы автору было видно ограничение. */
function wordLengths(text) {
  return text.split(/\s+/).filter(Boolean).map((w) => {
    const masked = [...w].filter((ch) => ch.codePointAt(0) > 127).length;
    return masked ? `${masked}` : w;
  }).join(' ');
}

/**
 * Проверка кандидата против ячейки: маска кандидата обязана совпасть с ячейкой символ в символ.
 * @returns {{ok: boolean, mask: string, cell: string}}
 */
function maskedEquals(cell, candidate, maskChar) {
  const mask = maskOf(candidate, maskChar);
  return { ok: mask === cell, mask, cell };
}

/**
 * Точка расхождения маски кандидата и ячейки: сколько символов совпадает слева и что осталось.
 * Это информация для автора, а не попытка угадать текст: хвост кандидата никогда не применяется.
 */
function divergence(cell, candidate, maskChar) {
  const mask = maskOf(candidate, maskChar);
  let i = 0;
  while (i < mask.length && i < cell.length && mask[i] === cell[i]) i += 1;
  return {
    matchedPrefix: i,
    cellTail: cell.slice(i),
    donorTail: mask.slice(i),
    donorLength: mask.length,
    cellLength: cell.length,
  };
}

/** Ячейки строки markdown-таблицы (без крайних пустых). */
function splitRow(line) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

/** Кандидаты донора для ячейки реестра: описание и атрибуция из живых метаданных Commons. */
function donorCandidates(row, columnIndex) {
  const out = [];
  const push = (label, value) => {
    if (typeof value === 'string' && value.trim()) out.push({ label, value: value.trim() });
  };
  if (columnIndex === 3) {
    push('ImageDescription', row.imageDescription);
  }
  if (columnIndex === 5) {
    push('Credit', row.credit);
    push('Artist', row.artist);
    if (row.credit && row.artist) push('Credit · Artist', `${row.credit} · ${row.artist}`);
  }
  return out;
}

function loadSources() {
  const raw = JSON.parse(fs.readFileSync(SOURCES, 'utf8'));
  const byId = new Map();
  for (const row of raw.rows) byId.set(row.evidenceId, row);
  return byId;
}

/** Разбор реестра: строка = `| \`evidenceId\` | article | localFile | описание | url | атрибуция | ... |`. */
function scanLedger(sources) {
  const lines = fs.readFileSync(LEDGER, 'utf8').split('\n');
  const findings = [];
  lines.forEach((line, index) => {
    const idMatch = line.match(/^\|\s*`([a-z0-9-]+)`\s*\|/);
    if (!idMatch) return;
    const cells = splitRow(line);
    const row = sources.get(idMatch[1]);
    cells.forEach((cell, columnIndex) => {
      if (!cell || cell.startsWith('`' + '`')) return;
      if (!looksMasked(cell)) return;
      const donor = donorCandidates(row ?? {}, columnIndex);
      const matched = donor
        .map((c) => ({ ...c, ...maskedEquals(cell, c.value, '`') }))
        .filter((c) => c.ok);
      const near = donor
        .map((c) => ({ label: c.label, ...divergence(cell, c.value, '`') }))
        .filter((c) => c.matchedPrefix >= 12 && !matched.some((m) => m.label === c.label));
      findings.push({
        file: path.relative(ROOT, LEDGER),
        line: index + 1,
        evidenceId: idMatch[1],
        columnIndex,
        cell,
        wordLengths: wordLengths(cell),
        donorKnown: Boolean(row),
        matched,
        near,
        status: matched.length ? 'donor-mask-equal' : 'author-owned',
      });
    });
  });
  return { lines, findings };
}

/** Компоненты серии: маски в props и в объектах слайдов (`alt`/`title`/`meta`/`caption`). */
function scanComponents() {
  const dir = path.join(ROOT, 'src/components/baptisty-rossii');
  const findings = [];
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('Body.astro')).sort()) {
    const file = path.join(dir, name);
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      if (!looksMasked(line)) return;
      const fieldMatch = line.match(/([A-Za-z_][A-Za-z0-9_.]*)\s*[:=]\s*['"]/);
      const valueMatch = line.match(/['"]([^'"]*\?{2,}[^'"]*)['"]/);
      findings.push({
        file: path.relative(ROOT, file),
        line: index + 1,
        field: fieldMatch ? fieldMatch[1] : unknownLabel(line),
        cell: valueMatch ? valueMatch[1] : line.trim(),
        wordLengths: wordLengths(valueMatch ? valueMatch[1] : line.trim()),
        status: 'author-owned',
      });
    });
  }
  return findings;
}

function unknownLabel(line) {
  if (line.includes('<p>') || line.includes('<li>')) return 'prose';
  return 'structural';
}

function main() {
  if (!fs.existsSync(SOURCES)) {
    console.error(`❌ Нет датасета источников: ${path.relative(ROOT, SOURCES)}`);
    process.exit(1);
  }
  const sources = loadSources();
  const { lines, findings: ledgerFindings } = scanLedger(sources);
  const componentFindings = scanComponents();

  const donorProven = ledgerFindings.filter((f) => f.status === 'donor-mask-equal');
  const ledgerAuthor = ledgerFindings.filter((f) => f.status !== 'donor-mask-equal');

  if (MODE === 'apply') {
    if (!donorProven.length) {
      console.log('ℹ Доказанных ячеек нет — применять нечего (авторский текст не трогаем).');
      return;
    }
    const patched = lines.slice();
    for (const finding of donorProven) {
      const original = patched[finding.line - 1];
      const chosen = finding.matched[0];
      const escaped = finding.cell.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const next = original.replace(finding.cell, chosen.value);
      if (next === original) continue;
      const guard = new RegExp(escaped);
      if (!guard.test(original)) {
        console.error(`❌ Строка ${finding.line}: ячейка не найдена дословно — запись отменена.`);
        process.exit(1);
      }
      patched[finding.line - 1] = next;
    }
    fs.writeFileSync(LEDGER, patched.join('\n'));
    console.log(`✅ Записано доказанных ячеек: ${donorProven.length}`);
    for (const f of donorProven) {
      console.log(`   L${f.line} [${f.evidenceId}] ← ${f.matched[0].label}: ${f.matched[0].value.slice(0, 80)}`);
    }
    return;
  }

  const payload = {
    mask: 'не-ASCII → маска, ASCII сохраняется; проверка = равенство маски кандидата ячейке',
    ledger: { proven: donorProven.length, authorOwned: ledgerAuthor.length, findings: ledgerFindings },
    components: { authorOwned: componentFindings.length, findings: componentFindings },
  };

  if (MODE === 'json') {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log('Маска как контрольная сумма: арбитр восстановления (Баптисты России)\n');
  console.log(`Реестр ${path.relative(ROOT, LEDGER)}: доказано донором ${donorProven.length}, авторских ${ledgerAuthor.length}`);
  for (const f of donorProven) {
    console.log(`  ✔ L${f.line} [${f.evidenceId}] ← ${f.matched[0].label}`);
    console.log(`      было : ${f.cell}`);
    console.log(`      станет: ${f.matched[0].value}`);
  }
  if (ledgerAuthor.length) {
    console.log('\n  Авторские ячейки реестра (маска ≠ дословный донор):');
    for (const f of ledgerAuthor) {
      console.log(`  · L${f.line} [${f.evidenceId}] колонка ${f.columnIndex}: длины — ${f.wordLengths}`);
      for (const n of f.near) {
        console.log(`      ↳ ${n.label}: совпадает ${n.matchedPrefix} символов из ${n.cellLength} (донор ${n.donorLength}); расхождение — «${n.cellTail.slice(0, 40)}» против «${n.donorTail.slice(0, 40)}»`);
      }
    }
  }
  console.log(`\nКомпоненты серии: авторских строк ${componentFindings.length} (текст не восстанавливается автоматически).`);
  console.log('Доказательство — только точное равенство маски; всё остальное помечено как авторское.');
}

main();
