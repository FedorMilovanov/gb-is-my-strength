import fs from 'node:fs';
import path from 'node:path';

function collect(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (/\.(astro|ts|mjs|json)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const roots = fs.readdirSync('src/components/article-pilots', { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('gill-'))
  .map((entry) => path.join('src/components/article-pilots', entry.name));
const sourceFiles = roots.flatMap(collect);
const entries = sourceFiles.map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));
const corpus = entries.map(({ file, text }) => `\n<!-- ${file} -->\n${text}`).join('\n');
const series = JSON.parse(fs.readFileSync('data/series.json', 'utf8'));
const gill = series['dzhon-gill'];

const forbidden = [
  'Биография Джона Гилла — не просто история пастора XVIII века. Это рассказ о беспрецедентной интеллектуальной дисциплине',
  'Откуда рождаются гении без университетов',
  'то, что оно сбылось',
  'оксфордские профессора снимали шляпы',
  'Систематическая евангелизация Саутварка',
  'еженедельно достигал Евангелием более тысячи',
  'стало конституцией для поколения строгих баптистов',
  'определила богословский облик общины на следующие полтора века',
  'полный протокол события',
  'Эти книги легли в основу девятитомного комментария',
  '— Наблюдение биографа над методом самообразования',
  '— Из церковной книги Хорслидауна, 1729',
  'документально зафиксированное совпадение двух смертей',
  'в прямой видимости от церкви Гилла',
  'Пресвитериане и общие баптисты проголосовали <em>против</em> — и начали дрейф',
  'Для христианина XVIII века это было беспрецедентно',
  'Исторический контекст апостольской эпохи',
  'открывает его как <em>мистика</em>',
  'двадцать шесть лет вечерних проповедей',
  'продолжалась <strong>двадцать семь лет</strong>',
  'классического баптистского взгляда на два таинства',
  'поразительно точное предвидение экуменического миссионерского движения',
  'христианским гебраистом, равным университетским профессорам',
  'единственный пастор — богословская позиция',
  '<strong>16 августа 1859 года</strong>',
  '<strong>он не мой Равви</strong>',
  'расколол Партикулярных баптистов на два лагеря',
  'строить свои вероучительные стандарты не на исповедании 1689 года',
  'два тома «Практического богословия»',
  '52 тома Отцов Церкви in folio',
  'Книги Гилла хранятся в Провиденсе по сей день',
  'Таким образом, Гилл стоял за кулисами основания этого учреждения',
  'Американские баптисты писали ему в Лондон за советами',
  'взаимное high-Calvinist уважение',
  'защищал точность масоретской огласовки (никкуд, акценты) против рационалистов',
  'семь реальных периодов церковной истории',
  'Современники называли Гилла «Лайтфутом баптистов»',
  'у него мера веры — это, по сути, внешний догматический стандарт',
  'почему в раннем иудаизме «мир»/«язычники»',
  'и большинство отвечало отрицательно',
  'одно и то же понятие, получающее у Иоанна утвердительный',
  '~16 мин',
];

const required = [
  'Серия о Джоне Гилле состоит из исторического введения',
  'Провиденциальный биографический рассказ',
  'Точные возрастные рекорды',
  'Почти через семь лет',
  'будто Уайтфилд приглашал Гилла',
  'В опубликованном шеститомном корпусе Уайтфилда',
  'не маркируется как цитата из церковной книги',
  'анонимное стихотворное письмо из Тилберийского форта',
  'голосование 24 февраля и последующая подписка 3 марта были разными событиями',
  'не являются автоматическим свидетельством того, как мыслили апостолы',
  'Лекции в Истчипе: 1729–1756',
  'современная текстология не принимает',
  'девятью folio-томами',
  'Джон Риппон стал преемником после смерти Гилла',
  'A very distinguished place is due to Dr. Gill',
  'В XIX веке стороны нередко обозначали как <em lang="en">Fullerites</em> и <em lang="en">Gillites</em>',
  'не подтверждены открытым институциональным каталогом или актом передачи',
  'один том «Практического богословия» — третий том общего издания',
  'Наиболее твёрдо документирована рецепция у Джонатана Эдвардса',
  'современная текстология не принимает эту историческую гипотезу',
  'Поздние баптистские авторы называли Гилла «Лайтфутом баптистов»',
  'не представляет «большинство раннего иудаизма»',
  'не доказывает историческую тождественность',
  'Долг веры: различие и продолжающийся спор',
  '~28 мин',
];

const failures = [];
for (const phrase of forbidden) {
  for (const { file, text } of entries) if (text.includes(phrase)) failures.push(`${file}: forbidden phrase remains: ${phrase}`);
}
for (const phrase of required) if (!corpus.includes(phrase)) failures.push(`required reconciliation marker missing: ${phrase}`);

const expectedTimes = [28, 32, 39, 71, 54, 15];
const actualTimes = gill?.parts?.map((part) => part.readingTime);
if (JSON.stringify(actualTimes) !== JSON.stringify(expectedTimes)) {
  failures.push(`data/series.json: Gill reading-time SSOT drift: expected ${expectedTimes.join('/')}, got ${actualTimes?.join('/')}`);
}
if (!sourceFiles.some((file) => file.endsWith('GillSpravochnikSectionTimeline.astro'))) {
  failures.push('Gill reference timeline is missing from the audited native corpus');
}

if (failures.length) {
  console.error('Gill route-wide source reconciliation audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Gill route-wide reconciliation passed across ${sourceFiles.length} native source files.`);
