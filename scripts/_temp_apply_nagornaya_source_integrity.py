#!/usr/bin/env python3
from pathlib import Path

SOURCE_FILES = [
    Path('src/components/nagornaya/istochniki/NagornayaIstochnikiMainShell.astro'),
    Path('nagornaya/istochniki/index.html'),
]
PART4_FILES = [
    Path('src/components/nagornaya/chast-4/NagornayaChast4MainShell.astro'),
    Path('nagornaya/chast-4/index.html'),
]


def replace_exact(text: str, old: str, new: str, path: Path, label: str, expected: int = 1) -> str:
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'{path}: {label}: expected {expected} anchor(s), found {count}')
    return text.replace(old, new, expected)


for path in SOURCE_FILES:
    text = path.read_text(encoding='utf-8')
    text = replace_exact(text, 'pp. 49–74', 'pp. 49–68', path, 'Green pages')
    text = replace_exact(
        text,
        '<strong class="text-stone-800">Evangelical Responses to the Jesus Seminar</strong>',
        '<strong class="text-stone-800"><a href="https://tms.edu/wp-content/uploads/2021/09/tmsj7d.pdf" target="_blank" rel="noopener">Evangelical Responses to the Jesus Seminar</a></strong>',
        path,
        'Thomas exact object',
    )
    text = replace_exact(
        text,
        '<strong class="text-stone-800">The Dispensational View of the Davidic Kingdom</strong>',
        '<strong class="text-stone-800"><a href="https://tms.edu/wp-content/uploads/2021/09/tmsj7h.pdf" target="_blank" rel="noopener">The Dispensational View of the Davidic Kingdom</a></strong>',
        path,
        'Nichols exact object',
    )
    text = replace_exact(
        text,
        'Все ссылки верифицированы по первоисточникам.',
        'Ключевые библиографические данные и доступные первичные объекты проверены на дату обновления; состояние внешних ссылок может меняться.',
        path,
        'bounded verification claim',
    )
    text = replace_exact(
        text,
        'Один источник отмечен предупреждением: используется только как историческое свидетельство.',
        'Один источник отмечен предупреждением: используется только как историческое свидетельство. Статья в TMSJ представляет аргумент названного автора и место публикации, а не автоматически официальную позицию TMS.',
        path,
        'author/institution source note',
    )
    path.write_text(text, encoding='utf-8')

for path in PART4_FILES:
    text = path.read_text(encoding='utf-8')
    heading_count = 2 if path == Path('nagornaya/chast-4/index.html') else 1
    text = replace_exact(
        text,
        'V. Ipsissima Verba и Ipsissima Vox: Жёсткая граница Семинарии Мастерс',
        'V. Ipsissima Verba и Ipsissima Vox: Аргумент Дональда Грина',
        path,
        'section heading',
        heading_count,
    )
    text = replace_exact(
        text,
        'В этой дискуссии Семинария Мастерс предложила последовательную консервативную защиту историчности евангельского свидетельства. Дональд Грин',
        'В этой дискуссии Дональд Грин',
        path,
        'author publication attribution',
    )
    text = replace_exact(
        text,
        'Аргументы Дональда Грина и позиции TMS сводятся к трём фундаментальным пунктам:',
        'Аргумент Дональда Грина в этой статье сводится к трём фундаментальным пунктам:',
        path,
        'argument attribution',
    )
    text = replace_exact(
        text,
        'Позиция Семинарии Мастерс бескомпромиссна: Евангелия передают не приблизительный смысл и не богословские догадки авторов. Мы принимаем концепцию',
        'Грин проводит строгую границу: Евангелия передают не приблизительный смысл и не богословские догадки авторов. В рамках этой серии мы принимаем концепцию',
        path,
        'series synthesis attribution',
    )
    path.write_text(text, encoding='utf-8')

TEST = Path('scripts/nagornaya-source-integrity-regression-test.js')
TEST.write_text(r'''#!/usr/bin/env node
'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const sourceFiles = [
  'src/components/nagornaya/istochniki/NagornayaIstochnikiMainShell.astro',
  'nagornaya/istochniki/index.html',
];
const part4Files = [
  'src/components/nagornaya/chast-4/NagornayaChast4MainShell.astro',
  'nagornaya/chast-4/index.html',
];

for (const rel of sourceFiles) {
  const text = read(rel);
  assert.match(text, /Donald E\. Green[\s\S]{0,1200}pp\. 49–68/, `${rel}: Green pages must be 49–68`);
  assert.doesNotMatch(text, /Donald E\. Green[\s\S]{0,1200}pp\. 49–74/, `${rel}: stale Green pages 49–74 returned`);
  assert.match(text, /href="https:\/\/tms\.edu\/wp-content\/uploads\/2021\/09\/tmsj7d\.pdf"[^>]*>Evangelical Responses to the Jesus Seminar<\/a>/, `${rel}: Thomas must link to exact tmsj7d.pdf`);
  assert.match(text, /href="https:\/\/tms\.edu\/wp-content\/uploads\/2021\/09\/tmsj7h\.pdf"[^>]*>The Dispensational View of the Davidic Kingdom<\/a>/, `${rel}: Nichols must link to exact tmsj7h.pdf`);
  assert.doesNotMatch(text, /tmsj7h\.pdf[^<]{0,300}Jesus Seminar|Jesus Seminar[\s\S]{0,300}tmsj7h\.pdf/, `${rel}: Jesus Seminar must never resolve to tmsj7h.pdf`);
  assert.doesNotMatch(text, /Все ссылки верифицированы по первоисточникам/, `${rel}: universal verification claim returned`);
  assert.match(text, /Ключевые библиографические данные и доступные первичные объекты проверены на дату обновления/, `${rel}: bounded verification wording missing`);
  assert.match(text, /Статья в TMSJ представляет аргумент названного автора[^.]+не автоматически официальную позицию TMS/, `${rel}: author\/institution source-role note missing`);
}

const banned = [
  'Жёсткая граница Семинарии Мастерс',
  'Семинария Мастерс предложила последовательную консервативную защиту',
  'Аргументы Дональда Грина и позиции TMS',
  'Позиция Семинарии Мастерс бескомпромиссна',
];
const required = [
  'V. Ipsissima Verba и Ipsissima Vox: Аргумент Дональда Грина',
  'В этой дискуссии Дональд Грин',
  'Аргумент Дональда Грина в этой статье сводится к трём фундаментальным пунктам',
  'Грин проводит строгую границу',
  'В рамках этой серии мы принимаем концепцию',
];
for (const rel of part4Files) {
  const text = read(rel);
  for (const phrase of banned) assert.ok(!text.includes(phrase), `${rel}: institutional overreach returned: ${phrase}`);
  for (const phrase of required) assert.ok(text.includes(phrase), `${rel}: calibrated attribution missing: ${phrase}`);
}

console.log('✅ Nagornaya source integrity contract passed');
''', encoding='utf-8')

print('applied Nagornaya source-integrity patch')
