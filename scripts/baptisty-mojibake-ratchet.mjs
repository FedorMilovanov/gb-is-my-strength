#!/usr/bin/env node
/**
 * baptisty-mojibake-ratchet.mjs — храповик на маскированные фрагменты серии
 * «Баптисты России».
 *
 * Контекст. В коммите 059b3024 (2026-09-13) в 10 файлов серии вошёл текст,
 * потерявший все не-ASCII символы: каждый из них заменён одним символом маски
 * (`?` в компонентах, `` ` `` в реестре медиа). ASCII (латиница, цифры,
 * пунктуация) уцелел, поэтому маска задаёт точную длину каждого слова.
 * Донора авторского текста нет: проверены 42 ветки, прод, Google Drive,
 * комментарии PR #2028 и внешний репозиторий — см.
 * `audit/BAPTISTY-MOJIBAKE-RECOVERY-PACK-2026-10-13.md`. Дописывать текст за
 * автора запрещено, поэтому единственный честный инженерный шаг — сделать
 * дефект ограниченным, учтённым и невоспроизводимым:
 *
 *   --check (по умолчанию)  три инварианта:
 *     1. инвентарь совпадает с источником: новый маскированный фрагмент или
 *        исчезновение зафиксированного (без обновления инвентаря) — провал;
 *     2. вне инвентаря нет маскированных фрагментов (`?{3,}` в .astro/.md;
 *        `??` — это nullish coalescing, он не считается);
 *     3. реестр медиа не содержит маскированных ячеек кроме зафиксированных.
 *
 *   --write   пересобрать инвентарь (только после осознанной правки: либо
 *             восстановлен фрагмент, либо дефект расширился и это записано).
 *   --report  рабочий лист для автора: файл, строка, поле, маска и длины слов
 *             каждого утраченного слова — по нему текст восстанавливается
 *             сверкой, без угадывания.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INVENTORY_PATH = path.join(ROOT, 'data', 'baptisty-mojibake-inventory.json');
const MODE = process.argv.includes('--write') ? 'write'
  : process.argv.includes('--report') ? 'report' : 'check';

/** Файлы серии, в которых живёт маскированный текст (закреплено инвентарём). */
const GUARDED_DIRS = ['src/components/baptisty-rossii', 'src/pages/baptisty-rossii', 'baptisty-rossii'];
/**
 * Семейство масок. Бэктик — маска только в реестре медиа: в остальных
 * markdown-файлах бэктики это разметка кода, а не потерянный текст.
 */
const MASK_FAMILIES = [
  { file: null, pattern: '\\?{2,}', mask: '?' },
  { file: 'baptisty-rossii/research/media-ledger.md', pattern: '`{2,}', mask: '`' },
];
const guaranteedMaskPattern = (file) => MASK_FAMILIES
  .filter((family) => family.file === null || family.file === file)
  .map((family) => family.pattern)
  .join('|');

const readInventory = () => {
  const raw = fs.readFileSync(INVENTORY_PATH, 'utf8');
  return JSON.parse(raw);
};

const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && /\.(astro|md)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Имя поля, к которому относится маска (атрибут, свойство или ячейка таблицы). */
function fieldOf(line, index) {
  if (line.trimStart().startsWith('|')) {
    const cells = line.split('|');
    let offset = 0;
    for (let i = 0; i < cells.length; i += 1) {
      const start = offset;
      offset += cells[i].length + 1;
      if (index >= start && index < offset) return `cell[${i - 1}]`;
    }
    return 'cell[?]';
  }
  const head = line.slice(0, index);
  const matches = [...head.matchAll(/([A-Za-z_][\w]*)\s*[:=]\s*["'`]?/g)];
  return matches.length ? matches[matches.length - 1][1] : 'line';
}

/** Длины утраченных слов: маска задаёт их однозначно. */
function wordLengths(fragment) {
  return fragment
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word === '`' ? '.' : word.includes('?') || word.includes('`')
      ? String([...word].filter((ch) => ch === '?' || ch === '`').length)
      : word))
    .join(' ');
}

function extractFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const entries = [];
  const pattern = guaranteedMaskPattern(rel(file));
  lines.forEach((line, index) => {
    const runs = [...line.matchAll(new RegExp(`(${pattern})`, 'g'))];
    if (!runs.length) return;
    const fragments = runs.map((run) => {
      const start = Math.max(0, line.lastIndexOf(' ', run.index) + 1);
      const end = (() => {
        const next = line.indexOf(' ', run.index + run[0].length);
        return next === -1 ? line.length : next;
      })();
      return line.slice(start, end).trim();
    });
    entries.push({
      line: index + 1,
      field: fieldOf(line, runs[0].index),
      masks: runs.map((run) => run[0]).join('|'),
      words: fragments.map(wordLengths).join(' / '),
      signature: `${runs.map((run) => run[0]).join('|')}#${fieldOf(line, runs[0].index)}`,
    });
  });
  return entries;
}

function scanInventoryFiles(inventory) {
  const result = {};
  for (const file of Object.keys(inventory.files)) {
    const absolute = path.join(ROOT, file);
    if (!fs.existsSync(absolute)) {
      result[file] = { missing: true, entries: [] };
      continue;
    }
    result[file] = { missing: false, entries: extractFile(absolute) };
  }
  return result;
}

function build() {
  const files = {};
  for (const dir of GUARDED_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const entries = extractFile(file);
      if (entries.length) files[rel(file)] = entries.map((entry) => entry.signature).sort();
    }
  }
  const totals = { files: Object.keys(files).length, lines: 0, questionMarks: 0, backticks: 0 };
  for (const signatures of Object.values(files)) {
    totals.lines += signatures.length;
    for (const signature of signatures) {
      if (signature.startsWith('?') || signature.includes('?#')) totals.questionMarks += 1;
      if (signature.startsWith('`') || signature.includes('`#')) totals.backticks += 1;
    }
  }
  return {
    schemaVersion: 1,
    note: 'Инвентарь утраченного при перекодировке текста серии «Баптисты России»: маска — один символ на каждый потерянный не-ASCII символ. Подпись = «маски#поле»; читаемый вид с длинами слов — audit/BAPTISTY-MOJIBAKE-WORKSHEET-2026-10-16.md, восстановление текста авторское (audit/BAPTISTY-MOJIBAKE-RECOVERY-PACK-2026-10-13.md).',
    maskChars: { question: '?', backtick: '`' },
    totals,
    files,
  };
}

if (MODE === 'write') {
  const inventory = build();
  fs.writeFileSync(INVENTORY_PATH, `${JSON.stringify(inventory, null, 2)}\n`);
  const backtick = String.fromCharCode(96);
  console.log(`Записан ${rel(INVENTORY_PATH)}: файлов ${inventory.totals.files}, строк ${inventory.totals.lines} (маска «?»: ${inventory.totals.questionMarks}, маска «${backtick}»: ${inventory.totals.backticks})`);
  process.exit(0);
}

const inventory = readInventory();
const scanned = scanInventoryFiles(inventory);

if (MODE === 'report') {
  const lines = [];
  for (const file of Object.keys(inventory.files)) {
    const scannedFile = scanned[file];
    if (!scannedFile || scannedFile.missing) continue;
    lines.push(`\n### ${file}`);
    for (const entry of scannedFile.entries) {
      lines.push(`- L${entry.line} · ${entry.field} · маска: ${entry.masks.split('|').join(' ')}  →  длины слов: ${entry.words}`);
    }
  }
  console.log(`# Рабочий лист восстановления: ${inventory.totals.lines} строк в ${inventory.totals.files} файлах`);
  console.log('Маска фиксирует длину каждого утраченного слова; донор — Source URL в той же строке реестра.');
  console.log(lines.join('\n'));
  process.exit(0);
}

const problems = [];

// 1. Инвентарь против источника: сравнение мультимножеств подписей.
const countBy = (values) => {
  const map = new Map();
  for (const value of values) map.set(value, (map.get(value) || 0) + 1);
  return map;
};
for (const [file, expectedSignatures] of Object.entries(inventory.files)) {
  const actual = scanned[file];
  if (!actual || actual.missing) {
    problems.push(`${file}: файл инвентаря отсутствует`);
    continue;
  }
  const expectedCounts = countBy(expectedSignatures);
  const actualEntries = actual.entries;
  const actualCounts = countBy(actualEntries.map((entry) => entry.signature));
  for (const entry of actualEntries) {
    const recorded = expectedCounts.get(entry.signature) || 0;
    const found = actualCounts.get(entry.signature) || 0;
    if (recorded === 0) {
      problems.push(`${file}:L${entry.line} незафиксированный маскированный фрагмент (${entry.masks}) — восстановите текст или обновите инвентарь: node scripts/baptisty-mojibake-ratchet.mjs --write`);
    } else if (found > recorded) {
      problems.push(`${file}: фрагментов «${entry.signature}» в источнике ${found}, в инвентаре ${recorded} — обновите инвентарь`);
    }
  }
  for (const [signature, recorded] of expectedCounts) {
    const found = actualCounts.get(signature) || 0;
    if (found === 0) {
      problems.push(`${file}: инвентарь помнит фрагмент «${signature}», которого в источнике нет (восстановлен?) — уберите запись из инвентаря: node scripts/baptisty-mojibake-ratchet.mjs --write`);
    } else if (found < recorded) {
      problems.push(`${file}: фрагментов «${signature}» в инвентаре ${recorded}, в источнике ${found} — уберите лишние записи: node scripts/baptisty-mojibake-ratchet.mjs --write`);
    }
  }
}

// 2. Вне инвентаря нет маскированных фрагментов.
for (const dir of GUARDED_DIRS) {
  for (const file of walk(path.join(ROOT, dir))) {
    const key = rel(file);
    if (key in inventory.files) continue;
    const entries = extractFile(file).filter((entry) => /\?{3,}/.test(entry.masks));
    for (const entry of entries) {
      problems.push(`${key}:L${entry.line} маскированный фрагмент вне инвентаря (${entry.masks})`);
    }
  }
}

if (problems.length) {
  console.error('❌ MOJIBAKE РАТЧЕТ:');
  for (const problem of problems) console.error(`   - ${problem}`);
  process.exit(1);
}
console.log(`✅ MOJIBAKE РАТЧЕТ: ${inventory.totals.lines} зафиксированных строк в ${inventory.totals.files} файлах; новых и снятых без отметки — 0; вне инвентаря — 0`);
console.log(`   рабочий лист для автора: node scripts/baptisty-mojibake-ratchet.mjs --report`);
