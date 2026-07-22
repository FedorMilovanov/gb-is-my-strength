#!/usr/bin/env node
'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ROOTS = ['src', 'nagornaya'];
const EXTENSIONS = new Set(['.astro', '.html', '.mdx']);
const banned = ['Полное отсутствие плодов — смертный приговор вере', 'Мф 7:21 относится к нему'];
const required = ['Упорное бесплодие требует серьёзного самоиспытания', 'Окончательный суд о сердце принадлежит Христу', 'нельзя механически применять к сокрушённому верующему'];
function collect(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, files);
    else if (EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}
const corpus = ROOTS.flatMap((rel) => collect(path.join(ROOT, rel))).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
for (const phrase of banned) assert(!corpus.includes(phrase), `banned pastoral verdict returned: ${phrase}`);
for (const phrase of required) assert(corpus.includes(phrase), `pastoral safeguard missing: ${phrase}`);
for (const rel of ['src/components/nagornaya/chast-5/NagornayaChast5MainShell.astro', 'nagornaya/chast-5/index.html']) {
  const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  for (const phrase of required) assert(source.includes(phrase), `${rel}: safeguard missing: ${phrase}`);
}
console.log('✅ Nagornaya pastoral safety contract passed');
