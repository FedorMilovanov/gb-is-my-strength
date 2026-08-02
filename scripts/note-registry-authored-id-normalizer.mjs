#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = process.argv.includes('--write');
const CHECK = process.argv.includes('--check');
if (WRITE === CHECK) throw new Error('pass exactly one of --write or --check');

const hermenevtikaOpen = '<span aria-label="Показать сноску" class="fn-marker" role="button" tabindex="0"';
const krajneOpen = '<span class="fn-marker" role="button" tabindex="0" aria-label="Показать сноску"';

const changes = [
  {
    path: 'src/components/article-pilots/hermenevtika/HermenevtikaBody.astro',
    open: hermenevtikaOpen,
    label: '30',
    note: 'Ibid., 311.',
    id: 'hermenevtika-johnson-311-achan',
  },
  {
    path: 'src/components/article-pilots/hermenevtika/HermenevtikaBody.astro',
    open: hermenevtikaOpen,
    label: '38',
    note: 'Ibid., 311.',
    id: 'hermenevtika-johnson-311-proverbs-bribery',
  },
  {
    path: 'src/components/article-pilots/hermenevtika/HermenevtikaBody.astro',
    open: hermenevtikaOpen,
    label: '32',
    note: 'Ibid.',
    id: 'hermenevtika-clowney-samson-ibid',
  },
  {
    path: 'src/components/article-pilots/hermenevtika/HermenevtikaBody.astro',
    open: hermenevtikaOpen,
    label: '39',
    note: 'Ibid.',
    id: 'hermenevtika-johnson-bribery-ibid',
  },
  {
    path: 'src/components/article-pilots/hermenevtika/HermenevtikaBody.astro',
    open: hermenevtikaOpen,
    label: '46',
    note: 'Chapell, Christ-Centered Preaching, 80.',
    id: 'hermenevtika-chapell-paul-proclaims-christ',
  },
  {
    path: 'src/components/article-pilots/hermenevtika/HermenevtikaBody.astro',
    open: hermenevtikaOpen,
    label: '49',
    note: 'Chapell, Christ-Centered Preaching, 80.',
    id: 'hermenevtika-chapell-every-text-christ',
  },
  {
    path: 'src/components/article-pilots/hermenevtika/HermenevtikaBody.astro',
    open: hermenevtikaOpen,
    label: '52',
    note: 'Ibid.',
    id: 'hermenevtika-goldsworthy-all-in-christ-ibid',
  },
  {
    path: 'src/components/article-pilots/hermenevtika/HermenevtikaBody.astro',
    open: hermenevtikaOpen,
    label: '60',
    note: 'Ibid.',
    id: 'hermenevtika-goldsworthy-paul-old-testament-ibid',
  },
  {
    path: 'src/components/article-pilots/krajne/KrajneBody.astro',
    open: krajneOpen,
    label: '13',
    note: 'Owen J. Of the Mortification of Sin in Believers («Об умерщвлении греха в верующих»). Ch. 2. Works, Vol. 6. Banner of Truth, 1965.',
    id: 'krajne-owen-indwelling-sin-daily-labor',
  },
  {
    path: 'src/components/article-pilots/krajne/KrajneBody.astro',
    open: krajneOpen,
    label: '17',
    note: 'Owen J. Of the Mortification of Sin in Believers («Об умерщвлении греха в верующих»). Ch. 2. Works, Vol. 6. Banner of Truth, 1965.',
    id: 'krajne-owen-new-nature-against-flesh',
  },
];

const byFile = new Map();
for (const change of changes) {
  if (!/^[a-z][a-z0-9-]{2,127}$/.test(change.id)) throw new Error(`invalid ID ${change.id}`);
  if (byFile.has(change.path)) byFile.get(change.path).push(change);
  else byFile.set(change.path, [change]);
}
if (new Set(changes.map((change) => change.id)).size !== changes.length) throw new Error('duplicate configured IDs');

let written = 0;
for (const [relative, fileChanges] of byFile) {
  const file = path.join(ROOT, relative);
  let source = fs.readFileSync(file, 'utf8');
  const original = source;
  for (const change of fileChanges) {
    const appliedOpen = `${change.open} data-note-id="${change.id}">`;
    const appliedNeedle = `${appliedOpen}${change.label}<span class="tooltip">${change.note}</span></span>`;
    if (source.includes(appliedNeedle)) continue;
    const needle = `${change.open}>${change.label}<span class="tooltip">${change.note}</span></span>`;
    const occurrences = source.split(needle).length - 1;
    if (occurrences !== 1) throw new Error(`${relative}: expected one exact marker for ${change.id}, found ${occurrences}`);
    if (CHECK) throw new Error(`${relative}: missing authored ID ${change.id}`);
    source = source.replace(needle, appliedNeedle);
  }
  for (const change of fileChanges) {
    const occurrences = source.split(`data-note-id="${change.id}"`).length - 1;
    if (occurrences !== 1) throw new Error(`${relative}: expected one ${change.id}, found ${occurrences}`);
  }
  if (WRITE && source !== original) {
    fs.writeFileSync(file, source, 'utf8');
    written += 1;
  }
}

console.log(`NoteRegistry authored IDs: ${changes.length} IDs across ${byFile.size} files; files written=${written}`);
