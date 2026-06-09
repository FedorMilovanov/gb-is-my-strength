const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const ARTICLE = 'articles/dzhon-gill-chast-1-chelovek/index.html';
const AGENTS = 'AGENTS.md';
const NEW_BASE = 'gill-funeral-sermon';
const OLD_BASE = 'gill-pastoral-consolation';

function p(...parts) { return path.join(ROOT, ...parts); }
function exists(rel) { return fs.existsSync(p(rel)); }
function read(rel) { return fs.readFileSync(p(rel), 'utf8'); }
function write(rel, text) { fs.writeFileSync(p(rel), text, 'utf8'); }
function copyAsset(file) {
  const src = p('patch-assets', 'images', file);
  const dst = p('images', file);
  if (!fs.existsSync(src)) throw new Error(`Missing patch asset: patch-assets/images/${file}`);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log('copied:', `images/${file}`);
}
function remove(rel) {
  const full = p(rel);
  if (fs.existsSync(full)) {
    fs.rmSync(full, { recursive: true, force: true });
    console.log('removed:', rel);
  }
}
function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    if (ent.isDirectory()) {
      if (['.git','node_modules','audit','.next','dist','.cache','patch-assets','pagefind'].includes(ent.name)) continue;
      out.push(...walk(full));
    } else out.push(rel);
  }
  return out;
}
function isText(rel) {
  return ['.html','.xml','.json','.md','.txt','.js','.css','.webmanifest'].includes(path.extname(rel).toLowerCase());
}
function textFiles() { return walk(ROOT).filter(rel => isText(rel) && !rel.startsWith('patch-assets/')); }
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function removeImageFamilyIfUnreferenced(base) {
  const refs = textFiles().filter(rel => read(rel).includes(base));
  if (refs.length) {
    console.log(`kept ${base}: still referenced in ${refs.join(', ')}`);
    return;
  }
  const dir = p('images');
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (
      file === `${base}.webp` || file === `${base}.jpg` || file === `${base}.jpeg` || file === `${base}.png` ||
      file.startsWith(`${base}-`)
    ) remove(`images/${file}`);
  }
}
function cleanupHelpers() {
  for (const f of fs.readdirSync(ROOT)) {
    if (/^apply_gill_.*\.js$/i.test(f)) remove(f);
  }
  remove('patch-assets');
}

console.log('Applying Gill v26 funeral sermon replacement...');

for (const f of [
  `${NEW_BASE}.webp`,
  `${NEW_BASE}-600w.webp`,
  `${NEW_BASE}-900w.webp`,
  `${NEW_BASE}-1200w.webp`,
]) copyAsset(f);

if (!exists(ARTICLE)) throw new Error(`Missing ${ARTICLE}`);
let article = read(ARTICLE);

if (!article.includes(OLD_BASE)) {
  throw new Error(`Could not find ${OLD_BASE} in ${ARTICLE}`);
}

// Replace image refs.
article = article.split(`${OLD_BASE}-600w.webp`).join(`${NEW_BASE}-600w.webp`);
article = article.split(`${OLD_BASE}-900w.webp`).join(`${NEW_BASE}-900w.webp`);
article = article.split(`${OLD_BASE}-1200w.webp`).join(`${NEW_BASE}-1200w.webp`);
article = article.split(`${OLD_BASE}.webp`).join(`${NEW_BASE}.webp`);

// Replace alt and caption.
article = article.replace(
  /alt="[^"]*скорбящая женщина[^"]*"/,
  'alt="Погребальная проповедь Джона Гилла в баптистской капелле XVIII века: открытая Библия на кафедре, траурное собрание, гроб и скорбящая община под словом утешения"'
);
article = article.replace(
  /<figcaption>[\s\S]*?Пастырское служение Гилла было не только кафедрой и книгами, но и утешением скорбящих у открытого Писания\.<\/figcaption>/,
  '<figcaption>Пастырское служение Гилла включало и погребальные проповеди: утешение скорбящих у открытого Писания, где надежда воскресения звучала не менее сильно, чем учёность кафедры.</figcaption>'
);

write(ARTICLE, article);
console.log('updated Part I funeral/consolation figure');

// Update AGENTS.
if (exists(AGENTS)) {
  let agents = read(AGENTS);
  agents = agents.replace(/`gill-pastoral-consolation`/g, '`gill-funeral-sermon`');
  agents = agents.replace(
    /Слот скорби\/пастырского утешения в Части I = `gill-funeral-sermon`, не типография\./,
    'Слот скорби/пастырского утешения в Части I = `gill-funeral-sermon`: погребальная проповедь Гилла в капелле XVIII века, а не сцена с одной женщиной и не типография.'
  );
  const marker = '### 9.13 John Gill grief/consolation slot';
  const block = `${marker}\n\n  * В Части I слот скорби/пастырского утешения должен использовать \`gill-funeral-sermon\`.\n  * Сцена должна показывать исторически правдоподобную погребальную проповедь: кафедра, открытая Библия, траурное собрание, скорбящая община, а не частную сцену утешения одной девушки.\n  * Старую семью \`gill-pastoral-consolation\` после замены не возвращать.\n`;
  if (!agents.includes(marker)) {
    agents = agents.trimEnd() + '\n\n' + block;
  }
  write(AGENTS, agents.endsWith('\n') ? agents : agents + '\n');
  console.log('updated AGENTS.md');
}

// Remove old family if no refs remain.
removeImageFamilyIfUnreferenced(OLD_BASE);

// Assertions
const check = read(ARTICLE);
if (!check.includes(NEW_BASE)) throw new Error(`${NEW_BASE} not referenced in ${ARTICLE}`);
if (check.includes(OLD_BASE)) throw new Error(`${OLD_BASE} still referenced in ${ARTICLE}`);

cleanupHelpers();
console.log('Done. Run: npm run validate:all; node scripts/audit-pro.js; git status --short');
