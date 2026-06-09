const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const PART1 = 'articles/dzhon-gill-chast-1-chelovek/index.html';

const FUNERAL = 'gill-funeral-sermon';
const BAPTISM = 'gill-baptism-scene';
const OLD_CONSOLATION = 'gill-pastoral-consolation';

function p(...parts) { return path.join(ROOT, ...parts); }
function exists(rel) { return fs.existsSync(p(rel)); }
function read(rel) { return fs.readFileSync(p(rel), 'utf8'); }
function write(rel, s) { fs.writeFileSync(p(rel), s, 'utf8'); }
function remove(rel) {
  const full = p(rel);
  if (fs.existsSync(full)) {
    fs.rmSync(full, { recursive: true, force: true });
    console.log('removed:', rel);
  }
}
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function assertImageFamilyExists(base, variants = ['', '-600w', '-900w', '-1200w']) {
  const missing = [];
  for (const suffix of variants) {
    const rel = `images/${base}${suffix}.webp`;
    if (!exists(rel)) missing.push(rel);
  }
  if (missing.length) {
    throw new Error(`Missing required image files:\n${missing.join('\n')}`);
  }
}

const FUNERAL_FIGURE = `<figure class="article-img wide reveal">
    <picture>
      <source
        type="image/webp"
        srcset="../../images/gill-funeral-sermon-600w.webp 600w,
                ../../images/gill-funeral-sermon-900w.webp 900w,
                ../../images/gill-funeral-sermon-1200w.webp 1200w,
                ../../images/gill-funeral-sermon.webp 1672w"
        sizes="(max-width: 700px) 92vw, 1100px">
      <img
        src="../../images/gill-funeral-sermon.webp"
        alt="Погребальная проповедь Джона Гилла в баптистской капелле XVIII века: открытая Библия на кафедре, траурное собрание, гроб и скорбящая община под словом утешения"
        width="1672"
        height="941"
        loading="lazy"
        decoding="async">
    </picture>
    <figcaption>Пастырское служение Гилла включало и погребальные проповеди: утешение скорбящих у открытого Писания, где надежда воскресения звучала не менее сильно, чем учёность кафедры.</figcaption>
  </figure>`;

const BAPTISM_FIGURE = `<figure class="article-img wide reveal">
        <picture>
          <source
            type="image/webp"
            srcset="../../images/gill-baptism-scene-600w.webp 600w,
                    ../../images/gill-baptism-scene-900w.webp 900w,
                    ../../images/gill-baptism-scene-1200w.webp 1200w,
                    ../../images/gill-baptism-scene.webp 1672w"
            sizes="(max-width: 700px) 92vw, 1200px">
          <img
            src="../../images/gill-baptism-scene.webp"
            alt="Крещение молодого Джона Гилла в реке близ Кеттеринга ранним туманным утром: община на берегу, пастор совершает погружение, атмосфера благоговения и призвания"
            width="1672"
            height="941"
            loading="lazy"
            decoding="async">
        </picture>
        <figcaption>1 ноября 1716 года: Джон Гилл публично исповедал веру и принял крещение погружением в кеттерингской реке.</figcaption>
      </figure>`;

function replaceOrInsertFuneralFigure() {
  if (!exists(PART1)) throw new Error(`Missing ${PART1}`);
  let s = read(PART1);

  // If the old one-girl consolation image still exists, replace the whole figure.
  const oldFig = new RegExp(`\\n?\\s*<figure\\b(?=[\\s\\S]*?${escapeRe(OLD_CONSOLATION)})[\\s\\S]*?<\\/figure>\\s*`, 'm');
  if (oldFig.test(s)) {
    s = s.replace(oldFig, `\n${FUNERAL_FIGURE}\n`);
    write(PART1, s);
    console.log('replaced old pastoral-consolation figure with funeral-sermon figure');
    return;
  }

  // If a malformed partial replacement left the new image but old metadata, normalize the whole figure.
  const newFig = new RegExp(`\\n?\\s*<figure\\b(?=[\\s\\S]*?${escapeRe(FUNERAL)})[\\s\\S]*?<\\/figure>\\s*`, 'm');
  if (newFig.test(s)) {
    s = s.replace(newFig, `\n${FUNERAL_FIGURE}\n`);
    write(PART1, s);
    console.log('normalized existing funeral-sermon figure');
    return;
  }

  // Last-resort insertion: place it near the pastoral ministry / Horseleydown section,
  // not at the top and not in historical context.
  const anchors = [
    /(<h2[^>]*>\s*III\.\s*Пасторское служение[\s\S]*?<\/h2>)/m,
    /(<h2[^>]*>\s*II\.\s*Пасторское служение[\s\S]*?<\/h2>)/m,
    /(<h3[^>]*>[\s\S]*?Horseleydown[\s\S]*?<\/h3>)/m,
    /(<p[^>]*>[\s\S]*?Horseleydown[\s\S]*?<\/p>)/m,
    /(<p[^>]*>[\s\S]*?пастырск[\s\S]*?служени[\s\S]*?<\/p>)/im
  ];

  for (const re of anchors) {
    if (re.test(s)) {
      s = s.replace(re, `$1\n\n${FUNERAL_FIGURE}`);
      write(PART1, s);
      console.log('inserted funeral-sermon figure near pastoral ministry section');
      return;
    }
  }

  throw new Error('Could not find safe insertion point for funeral-sermon figure');
}

function ensureBaptismFigure() {
  if (!exists(PART1)) throw new Error(`Missing ${PART1}`);
  let s = read(PART1);

  const existing = new RegExp(`<figure\\b(?=[\\s\\S]*?${escapeRe(BAPTISM)})[\\s\\S]*?<\\/figure>`, 'm');
  if (existing.test(s)) {
    s = s.replace(existing, BAPTISM_FIGURE);
    write(PART1, s);
    console.log('normalized existing baptism figure');
    return;
  }

  const anchorsAfter = [
    /(<p[^>]*>[\s\S]*?написанного самим Джоном Гиллом для своего крещения,\s*1 ноября 1716 года[\s\S]*?<\/p>)/m,
    /(—\s*Из гимна, написанного самим Джоном Гиллом для своего крещения,\s*1 ноября 1716 года\s*)/m
  ];
  for (const re of anchorsAfter) {
    if (re.test(s)) {
      s = s.replace(re, `$1\n\n${BAPTISM_FIGURE}`);
      write(PART1, s);
      console.log('inserted baptism figure after baptism hymn/source');
      return;
    }
  }

  const anchorsBefore = [
    /(<p[^>]*>\s*Через три дня,\s*4 ноября,[\s\S]*?<\/p>)/m,
    /(Через три дня,\s*4 ноября,\s*он был принят в полное общение церкви[\s\S]*?Этот текст стал девизом всей его жизни\.)/m
  ];
  for (const re of anchorsBefore) {
    if (re.test(s)) {
      s = s.replace(re, `${BAPTISM_FIGURE}\n\n$1`);
      write(PART1, s);
      console.log('inserted baptism figure before “Через три дня”');
      return;
    }
  }

  throw new Error('Could not find safe insertion point for baptism figure');
}

function updateAgents() {
  const rel = 'AGENTS.md';
  if (!exists(rel)) return;

  let s = read(rel);
  s = s.replace(/`gill-pastoral-consolation`/g, '`gill-funeral-sermon`');
  s = s.replace(
    /Слот скорби\/пастырского утешения в Части I = `gill-funeral-sermon`[^.\n]*\./g,
    'Слот скорби/пастырского утешения в Части I = `gill-funeral-sermon`: погребальная проповедь Гилла в капелле XVIII века, а не сцена с одной женщиной и не типография.'
  );

  const marker = '### 9.13 John Gill grief/consolation slot';
  const block = `${marker}

  * В Части I слот скорби/пастырского утешения должен использовать \`gill-funeral-sermon\`.
  * Сцена должна показывать исторически правдоподобную погребальную проповедь: кафедра, открытая Библия, траурное собрание, скорбящая община.
  * Старую семью \`gill-pastoral-consolation\` после замены не возвращать.
  * Если audit показывает \`gill-funeral-sermon\` или \`gill-baptism-scene\` как orphan, это означает не «удалить картинку», а сначала проверить, что фигура реально вставлена в \`articles/dzhon-gill-chast-1-chelovek/index.html\`.
`;

  if (s.includes(marker)) {
    const re = new RegExp(`${escapeRe(marker)}[\\s\\S]*?(?=\\n### 9\\.\\d+|\\n## |$)`, 'm');
    s = s.replace(re, block.trimEnd());
  } else {
    s = s.trimEnd() + `\n\n${block}`;
  }

  write(rel, s.endsWith('\n') ? s : s + '\n');
  console.log('updated AGENTS.md');
}

function runAudit() {
  try {
    const out = cp.execSync('node scripts/audit-pro.js', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 40 * 1024 * 1024
    });
    return { ok: true, text: out };
  } catch (e) {
    return { ok: false, text: `${e.stdout || ''}\n${e.stderr || ''}` };
  }
}

function parseOrphans(text) {
  const files = new Set();
  let inBlock = false;
  for (const line of text.split(/\r?\n/)) {
    if (line.includes('Orphan images in /images/')) {
      inBlock = true;
      continue;
    }
    if (!inBlock) continue;

    const m = line.match(/^\s*[-–]\s+(?:(?:\d+(?:\.\d+)?)\s*(?:KB|MB|bytes)\s+)?(.+?\.(?:webp|jpg|jpeg|png|gif|svg|ico))\s*$/i);
    if (m) {
      files.add(m[1].trim());
      continue;
    }

    if (/^\s*(──|━━|###|##|#|❌|⚠️|✅|ℹ️)/.test(line)) break;
  }
  return [...files];
}

function sweepRemainingOrphans() {
  for (let pass = 1; pass <= 5; pass++) {
    const audit = runAudit();
    const orphans = parseOrphans(audit.text);

    if (!orphans.length) {
      console.log(audit.ok ? 'audit-pro clean: no orphan images' : 'no orphan block, but audit has another error');
      if (!audit.ok) {
        console.log(audit.text.split(/\r?\n/).slice(-100).join('\n'));
        throw new Error('audit-pro still failing with non-orphan error');
      }
      return;
    }

    console.log(`audit orphan pass ${pass}: ${orphans.length} file(s)`);

    // Now the desired figures are anchored. If they still appear as orphan, fail instead of deleting them.
    const protectedBases = [FUNERAL, BAPTISM];
    const protectedHit = orphans.filter(f => protectedBases.some(base => f === `${base}.webp` || f.startsWith(`${base}-`)));
    if (protectedHit.length) {
      throw new Error(`Protected desired images are still reported orphan, so HTML insertion failed:\n${protectedHit.join('\n')}`);
    }

    for (const file of orphans) remove(`images/${file}`);
  }

  throw new Error('Stopped after 5 orphan sweep passes; audit still reports orphans');
}

function assertFinalRefs() {
  const s = read(PART1);
  if (!s.includes(`${FUNERAL}.webp`)) throw new Error(`${FUNERAL}.webp is not referenced in Part I`);
  if (!s.includes(`${BAPTISM}.webp`)) throw new Error(`${BAPTISM}.webp is not referenced in Part I`);
  if (s.includes(OLD_CONSOLATION)) throw new Error(`${OLD_CONSOLATION} still referenced in Part I`);
}

function cleanupHelpers() {
  for (const f of fs.readdirSync(ROOT)) {
    if (/^apply_gill_.*\.js$/i.test(f)) remove(f);
  }
  remove('patch-assets');
}

console.log('Applying Gill v27: anchor funeral/baptism figures, then sweep only true orphans...');
assertImageFamilyExists(FUNERAL);
assertImageFamilyExists(BAPTISM);
replaceOrInsertFuneralFigure();
ensureBaptismFigure();
updateAgents();
assertFinalRefs();
sweepRemainingOrphans();
cleanupHelpers();

console.log('Done. Run: npm run validate:all; node scripts/audit-pro.js; git status --short');
