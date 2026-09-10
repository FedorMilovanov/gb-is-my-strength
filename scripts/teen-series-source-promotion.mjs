#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const WRITE = process.argv.includes('--write');
const DATE = '2026-09-10T00:00:00+03:00';
const OG = '/images/teen-series/series-hero.svg';
const OG_ALT = 'Свет у открытой двери и телефон на пороге — образ скрытой и открытой жизни';
const SLUGS = [
  'podrostok-za-kadrom-dvoynaya-zhizn',
  'podrostok-za-kadrom-roditelyam-posle-razoblacheniya',
  'podrostok-za-kadrom-chto-delat-tserkvi',
  'vzroslyy-rebenok-ushel-kontakt-pokayanie-vozvrashchenie',
  'vzroslyy-rebenok-doma-dengi-pomoshch-posledstviya',
  'sovershennoletie-roditelskaya-vlast-chto-menyaetsya',
  'vzroslaya-doch-otets-brak-soglasie-granitsy-vlasti',
];

const UPPERCASE_TERMS = {
  "INITIAL SAFETY CLARIFICATION": 'ПЕРВИЧНАЯ ПРОВЕРКА БЕЗОПАСНОСТИ',
  "PERMANENT RIGHT TO ADULT OMNISCIENCE": 'ПОСТОЯННОЕ ПРАВО ЗНАТЬ ВСЁ О ВЗРОСЛОМ',
  "NARRATIVE SILENCE": 'МОЛЧАНИЕ ПОВЕСТВОВАНИЯ',
  "COMMAND": 'ЗАПОВЕДЬ',
  "ALLOW CONSEQUENCES": 'ПОЗВОЛИТЬ ПОСЛЕДСТВИЯМ НАСТУПИТЬ',
  "ENGINEER MISERY": 'СПЕЦИАЛЬНО СОЗДАВАТЬ СТРАДАНИЕ',
  "PARENTAL CONSEQUENCE": 'РОДИТЕЛЬСКОЕ ПОСЛЕДСТВИЕ',
  "DIVINE COVENANT CURSE": 'БОЖЕСТВЕННОЕ ЗАВЕТНОЕ ПРОКЛЯТИЕ',
  "PARENTAL HOME": 'РОДИТЕЛЬСКИЙ ДОМ',
  "THE COVENANT LAND": 'ЗАВЕТНАЯ ЗЕМЛЯ',
  "ADULT CHILD": 'ВЗРОСЛЫЙ РЕБЁНОК',
  "COVENANT ISRAEL": 'ЗАВЕТНЫЙ ИЗРАИЛЬ',
  "PARENT": 'РОДИТЕЛЬ',
  "YAHWEH": 'ЯХВЕ',
  "PUBLICLY VISIBLE": 'ПУБЛИЧНО ДОСТУПНОЕ',
  "PARENTAL RIGHT TO OMNISCIENCE": 'ПРАВО РОДИТЕЛЯ ЗНАТЬ ВСЁ',
  "PRAYER": 'МОЛИТВА',
  "SURVEILLANCE": 'СЛЕЖКА',
  "NATURAL RELATION": 'РОДСТВО',
  "LICENSE FOR COVERT PURSUIT": 'ПРАВО НА ТАЙНОЕ ПРЕСЛЕДОВАНИЕ',
  "HOPE IN GOD": 'НАДЕЖДА НА БОГА',
  "CONFIDENCE IN THE PRESENT CLAIM": 'ДОВЕРИЕ К НЫНЕШНЕМУ ЗАЯВЛЕНИЮ',
  "CHILD'S SIN": 'ГРЕХ РЕБЁНКА',
  "PARENTAL IMMUNITY": 'НЕПРИКОСНОВЕННОСТЬ РОДИТЕЛЯ',
  "PARENTAL SIN": 'ГРЕХ РОДИТЕЛЯ',
  "CHILD'S LICENSE": 'РАЗРЕШЕНИЕ РЕБЁНКУ ГРЕШИТЬ',
  "PARENTAL REPENTANCE": 'ПОКАЯНИЕ РОДИТЕЛЯ',
  "MORAL CAPITULATION": 'НРАВСТВЕННАЯ КАПИТУЛЯЦИЯ',
  "ORDINARY KINDNESS": 'ОБЫЧНАЯ ДОБРОТА',
  "MORAL NORMALIZATION": 'НОРМАЛИЗАЦИЯ ГРЕХА',
  "PRIVATE PROPHECY ABOUT THIS CHILD'S OUTCOME OR TIMING": 'ЧАСТНОЕ ПРОРОЧЕСТВО О СРОКЕ И ИСХОДЕ ДЛЯ ЭТОГО РЕБЁНКА',
  "RETURN HOME": 'ВОЗВРАЩЕНИЕ ДОМОЙ',
  "AUTOMATIC REPENTANCE": 'АВТОМАТИЧЕСКОЕ ПОКАЯНИЕ',
  "RECEIVE THE PERSON": 'ПРИНЯТЬ ЧЕЛОВЕКА',
  "RESTORE EVERY PREVIOUS PRIVILEGE IMMEDIATELY": 'НЕМЕДЛЕННО ВЕРНУТЬ ВСЕ ПРЕЖНИЕ СВОБОДЫ',
  "MERCY MAY BE IMMEDIATE": 'МИЛОСТЬ МОЖЕТ БЫТЬ НЕМЕДЛЕННОЙ',
  "RE-ENTRUSTMENT MAY BE GRADUAL": 'ПОВТОРНОЕ ДОВЕРЕНИЕ МОЖЕТ БЫТЬ ПОСТЕПЕННЫМ',
  "FRUIT": 'ПЛОД',
  "PRICE OF FORGIVENESS": 'ЦЕНА ПРОЩЕНИЯ',
  "ADULT UNDER PARENTS' ROOF": 'ВЗРОСЛЫЙ В РОДИТЕЛЬСКОМ ДОМЕ',
  "HOTEL GUEST": 'ГОСТИНИЧНЫЙ ПОСТОЯЛЕЦ',
  "MINOR CHILD": 'НЕСОВЕРШЕННОЛЕТНИЙ',
  "HOUSEHOLD WORSHIP ORDER": 'ПОРЯДОК СЕМЕЙНОГО ПОКЛОНЕНИЯ',
  "POWER TO MANUFACTURE SPIRITUAL WORSHIP": 'ВЛАСТЬ ПРОИЗВЕСТИ ДУХОВНОЕ ПОКЛОНЕНИЕ',
  "NO FUNDING": 'ОТКАЗ ФИНАНСИРОВАТЬ',
  "UNIVERSAL MORAL PROHIBITION": 'УНИВЕРСАЛЬНЫЙ НРАВСТВЕННЫЙ ЗАПРЕТ',
  "UNREGENERATE": 'НЕВОЗРОЖДЁННЫЙ',
  "RELIGIOUSLY DUTYLESS": 'СВОБОДНЫЙ ОТ РЕЛИГИОЗНЫХ ОБЯЗАННОСТЕЙ',
  "MOVE OUT": 'ОТДЕЛЬНОЕ ПРОЖИВАНИЕ',
  "EXCOMMUNICATION": 'ОТЛУЧЕНИЕ',
  "MANUFACTURED ROCK BOTTOM": 'ИСКУССТВЕННО СОЗДАННОЕ «ДНО»',
  "END OF NATURAL RELATION": 'КОНЕЦ РОДСТВА',
  "UNABLE TO WORK": 'НЕ МОЖЕТ РАБОТАТЬ',
  "UNWILLING TO WORK": 'НЕ ХОЧЕТ РАБОТАТЬ',
  "FINANCIAL HELP": 'ФИНАНСОВАЯ ПОМОЩЬ',
  "PURCHASE OF TOTAL ADULT JURISDICTION": 'ПОКУПКА ПОЛНОЙ ВЛАСТИ НАД ВЗРОСЛЫМ',
  "DEBT PAYMENT": 'ОПЛАТА ДОЛГА',
  "FINANCIAL RESCUE": 'ФИНАНСОВОЕ СПАСЕНИЕ ОТ ПОСЛЕДСТВИЙ',
  "RESTORATION OF TRUST": 'ВОССТАНОВЛЕНИЕ ДОВЕРИЯ',
  "CURRENT SUPPORT": 'ТЕКУЩАЯ ПОДДЕРЖКА',
  "LUKE 15 ADVANCE SHARE": 'РАННЯЯ ДОЛЯ В ЛК. 15',
  "MODERN EARLY-INHERITANCE COMMAND": 'СОВРЕМЕННАЯ ЗАПОВЕДЬ О ДОСРОЧНОМ НАСЛЕДСТВЕ',
  "REFUGE FROM ABUSE": 'УБЕЖИЩЕ ОТ НАСИЛИЯ',
  "REFUGE FROM RIGHTEOUS CORRECTION": 'УБЕЖИЩЕ ОТ ПРАВЕДНОГО ИСПРАВЛЕНИЯ',
  "PARENTAL STATUS DOES NOT BAPTIZE SIN": 'РОДИТЕЛЬСКИЙ СТАТУС НЕ ОСВЯЩАЕТ ГРЕХ',
  "FIRST STORY HEARD": 'ПЕРВАЯ УСЛЫШАННАЯ ВЕРСИЯ',
  "FINAL FACT PATTERN": 'ОКОНЧАТЕЛЬНАЯ КАРТИНА ФАКТОВ',
  "SAFETY → FACTS → REAL JURISDICTION → MORAL ASSESSMENT → MEDIATION → FORM OF HELP → REVIEW": 'БЕЗОПАСНОСТЬ → ФАКТЫ → РЕАЛЬНАЯ ЮРИСДИКЦИЯ → НРАВСТВЕННАЯ ОЦЕНКА → ПОСРЕДНИЧЕСТВО → ФОРМА ПОМОЩИ → ПЕРЕСМОТР',
  "TEMPORARY SAFETY / HOSPITALITY": 'ВРЕМЕННАЯ БЕЗОПАСНОСТЬ / ГОСТЕПРИИМСТВО',
  "MORAL ADJUDICATION OF THE WHOLE FAMILY CONFLICT": 'НРАВСТВЕННЫЙ ВЕРДИКТ ПО ВСЕМУ СЕМЕЙНОМУ КОНФЛИКТУ',
  "SUITOR SUPPORT": 'ПОДДЕРЖКА ЖЕНИХА',
  "SPOUSAL JURISDICTION": 'СУПРУЖЕСКАЯ ВЛАСТЬ',
  "CHURCH MEDIATION": 'ЦЕРКОВНОЕ ПОСРЕДНИЧЕСТВО',
  "REPLACEMENT PARENTING": 'ЗАМЕНА РОДИТЕЛЬСТВА',
  "RELATION": 'РОДСТВО',
  "CO-RESIDENCE": 'СОВМЕСТНОЕ ПРОЖИВАНИЕ',
  "MORAL PERMISSION": 'НРАВСТВЕННАЯ ДОПУСТИМОСТЬ',
  "LEGAL PROCEDURE": 'ЮРИДИЧЕСКАЯ ПРОЦЕДУРА',
  "HELP": 'ПОМОЩЬ',
  "CASH": 'НАЛИЧНЫЕ',
  "DEBT RESCUE": 'ПОГАШЕНИЕ ЧУЖОГО ДОЛГА',
  "SURETY": 'ПОРУЧИТЕЛЬСТВО',
  "INHERITANCE": 'НАСЛЕДСТВО',
  "BOUNDARY": 'ГРАНИЦА',
  "REVENGE": 'МЕСТЬ',
  "REPENTANCE": 'ПОКАЯНИЕ',
};

const PLAIN_REPLACEMENTS = [
  ['Этот draft сознательно', 'Эта статья сознательно'],
  ['### Evidence-class guard', '### Границы доказательности'],
  ['doctrinal/status companion', 'общий материал о доктрине и статусе'],
  ['adult parental authority', 'родительская власть над взрослыми детьми'],
  ['status-sensitive jurisdiction', 'юрисдикция, зависящая от статуса'],
  ['status-sensitive / disputed in degree; do not overstate as one explicit NT age rule', 'зависит от статуса; степень спорна, и это нельзя выдавать за одно прямое новозаветное возрастное правило'],
  ['DIRECT_SCRIPTURE themes + CANONICAL_SYNTHESIS', 'прямые темы Писания + канонический синтез'],
  ['DIRECT_SCRIPTURE + CANONICAL_SYNTHESIS', 'прямое Писание + канонический синтез'],
  ['CANONICAL_SYNTHESIS + CLASSICAL_EXEGESIS_STRONG', 'канонический синтез + сильная классическая экзегеза'],
  ['PRUDENTIAL_APPLICATION', 'благоразумное практическое применение'],
  ['CIVIL_OR_SAFEGUARDING_DEPENDENT', 'зависит от гражданского права и требований защиты'],
  ['daughter/father/marriage veto claims: отдельный Companion D с собственным evidence ladder.', 'тезисы о дочери, отце и возможном брачном вето разбираются отдельно в разделе D с собственной иерархией доказательств.'],
  ['house-rule', 'правил дома'],
  ['house rules', 'правила дома'],
  ['lease agreement', 'договор аренды'],
  ['cash transfer', 'денежную выплату'],
  ['estate planning', 'планирование наследства'],
  ['co-residence', 'совместное проживание'],
  ['courtship', 'ухаживание'],
  ['consent', 'согласие'],
  ['household', 'дом'],
  ['counsel', 'совет'],
  ['dependence', 'зависимость'],
  ['prudential деталь', 'практическую деталь'],
  ['prudence', 'благоразумия'],
  ['stewardship', 'ответственное распоряжение'],
  ['safeguards', 'меры защиты'],
  ['no-contact', 'полное прекращение контакта'],
  ['rock bottom', '«дно»'],
  ['материальный guard', 'материальная оговорка'],
  ['evidence ladder', 'иерархией доказательств'],
  ['Companion A', 'раздел A'],
  ['Companion B', 'раздел B'],
  ['Companion C', 'раздел C'],
  ['Companion D', 'раздел D'],
  ['отдельному раздел B', 'отдельному разделу B'],
  ['отдельному разделу B', 'отдельному разделу B'],
  ['предмет раздел D', 'предмет раздела D'],
  ['принадлежит раздел B', 'принадлежит разделу B'],
  ['принадлежат раздел B', 'принадлежат разделу B'],
  ['собственным иерархией доказательств', 'собственной иерархией доказательств'],
];

const FORBIDDEN_VISIBLE = [
  /Этот draft/u,
  /\bCompanion [ABCD]\b/u,
  /\bstewardship\b/iu,
  /\bhouse rules?\b/iu,
  /\bco-residence\b/iu,
  /\bcourtship\b/iu,
  /\bconsent\b/iu,
  /\bhousehold\b/iu,
  /\bcounsel\b/iu,
  /\bdependence\b/iu,
  /\bprudence\b/iu,
  /\bprudential\b/iu,
  /Evidence-class guard/u,
  /DIRECT_SCRIPTURE|CANONICAL_SYNTHESIS|CLASSICAL_EXEGESIS_STRONG|PRUDENTIAL_APPLICATION|CIVIL_OR_SAFEGUARDING_DEPENDENT/u,
  /^\s*(?:\*\*|`)[A-Z][A-Z0-9' /-]{3,}(?:≠|→)[A-Z0-9' /→-]+(?:\*\*|`)[.!]?\s*$/mu,
  /^\s*\*\*[A-Z][A-Z0-9' /-]{8,}\.\*\*\s*$/mu,
];

function quoted(value) { return JSON.stringify(value); }

function updateFrontmatter(source, slug) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error(`${slug}: missing frontmatter`);
  let lines = match[1].split('\n').filter((line) =>
    !/^# Контент загружен с опережением:/u.test(line) &&
    !/^# Явный (?:draft|черновик)\b/u.test(line)
  );
  const set = (key, value) => {
    const index = lines.findIndex((line) => new RegExp(`^${key}:`).test(line));
    const next = `${key}: ${value}`;
    if (index >= 0) lines[index] = next;
    else lines.push(next);
  };
  set('contentStatus', quoted('published'));
  set('publishedAt', quoted(DATE));
  set('updatedAt', quoted(DATE));
  set('draft', 'false');
  set('noindex', 'false');
  set('sourcesRequired', 'true');
  set('series', quoted('teen-double-life'));
  set('canonicalOverride', quoted(`https://gospod-bog.ru/articles/${slug}/`));
  set('ogImage', quoted(OG));
  set('ogImageAlt', quoted(OG_ALT));
  return source.replace(match[0], `---\n${lines.join('\n')}\n---\n`);
}

function transformVisibleBody(source, transform) {
  const frontmatter = source.match(/^---\n[\s\S]*?\n---\n/);
  if (!frontmatter) throw new Error('missing frontmatter');
  const head = frontmatter[0];
  const body = source.slice(head.length);
  const parts = body.split(/(\{\/\*[\s\S]*?\*\/\})/g);
  return head + parts.map((part, index) => index % 2 ? part : transform(part)).join('');
}

function visibleBody(source) {
  const frontmatter = source.match(/^---\n[\s\S]*?\n---\n/);
  const body = frontmatter ? source.slice(frontmatter[0].length) : source;
  return body.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

function normalizeReaderSurface(source) {
  return transformVisibleBody(source, (input) => {
    let text = input;
    for (const [from, to] of Object.entries(UPPERCASE_TERMS).sort((a, b) => b[0].length - a[0].length)) text = text.split(from).join(to);
    for (const [from, to] of PLAIN_REPLACEMENTS) text = text.split(from).join(to);
    return text;
  });
}

function normalizeMdxComments(source, slug) {
  let converted = 0;
  const normalized = source.replace(/<!--([\s\S]*?)-->/g, (_match, body) => {
    if (body.includes('*/')) throw new Error(`${slug}: HTML comment contains */ and cannot be converted safely`);
    converted += 1;
    return `{/*${body}*/}`;
  });
  if (normalized.includes('<!--') || normalized.includes('-->')) throw new Error(`${slug}: raw HTML comment marker remains after MDX normalization`);
  return { source: normalized, converted };
}

function normalizeSource(source, slug) {
  const frontmatter = updateFrontmatter(source, slug);
  const reader = normalizeReaderSurface(frontmatter);
  return normalizeMdxComments(reader, slug);
}

function assertPublished(source, slug) {
  const required = [
    'contentStatus: "published"', `publishedAt: "${DATE}"`, `updatedAt: "${DATE}"`,
    'draft: false', 'noindex: false', 'sourcesRequired: true', 'series: "teen-double-life"',
    `canonicalOverride: "https://gospod-bog.ru/articles/${slug}/"`, `ogImage: "${OG}"`, `ogImageAlt: "${OG_ALT}"`,
  ];
  for (const needle of required) if (!source.includes(needle)) throw new Error(`${slug}: missing ${needle}`);
  if (/^# (?:Контент загружен с опережением|Явный (?:draft|черновик)\b)/mu.test(source)) throw new Error(`${slug}: prepublication frontmatter comment remains`);
  if (source.includes('<!--') || source.includes('-->')) throw new Error(`${slug}: raw HTML comment is invalid in published MDX`);
  const visible = visibleBody(source);
  for (const pattern of FORBIDDEN_VISIBLE) {
    const match = visible.match(pattern);
    if (match) throw new Error(`${slug}: reader-facing backstage residue remains: ${JSON.stringify(match[0])}`);
  }
}

const planned = [];
let convertedComments = 0;
for (const slug of SLUGS) {
  const file = path.join(ROOT, 'src', 'content', 'articles', `${slug}.mdx`);
  const source = fs.readFileSync(file, 'utf8');
  const result = normalizeSource(source, slug);
  assertPublished(result.source, slug);
  convertedComments += result.converted;
  planned.push({ slug, file, source, normalized: result.source });
}

const changed = planned.filter((item) => item.source !== item.normalized);
if (!WRITE && changed.length) {
  console.error(`❌ ${changed.length} teen source file(s) require publication/reader normalization: ${changed.map((item) => item.slug).join(', ')}`);
  process.exit(1);
}
if (WRITE) for (const item of changed) fs.writeFileSync(item.file, item.normalized, 'utf8');
console.log(`✅ Teen source publication state ${WRITE ? 'normalized' : 'canonical'} (${SLUGS.length} files; changed ${changed.length}; converted comments ${convertedComments})`);
