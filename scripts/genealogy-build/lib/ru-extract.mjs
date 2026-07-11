/**
 * ru-extract.mjs — извлечение русских имён персон из Синодального текста.
 *
 * Источник истины по приоритету (build.mjs применяет в этом порядке):
 *   override (ru-overrides.json, ручной) > seed (v1-скелет, 156 ручных имён)
 *   > pattern (именной паттерн в стихе первого упоминания)
 *   > candidate (единственный/лучший кандидат в стихе, по транслит-близости)
 *   > translit (правило EN→RU; всегда review:true)
 *
 * Экстрактор ничего не «знает наверняка»: каждый результат несёт source и
 * confidence; всё, кроме override/seed, подлежит редакторской сверке (review-очередь).
 */

/** Слова с заглавной, которые именами не являются (частотный шум стихов). */
const STOPWORDS = new Set([
  'И', 'А', 'Но', 'Не', 'Ни', 'Он', 'Она', 'Они', 'Оно', 'Их', 'Его', 'Ему', 'Ей',
  'Я', 'Ты', 'Вы', 'Мы', 'Кто', 'Что', 'Это', 'Тот', 'Та', 'Те', 'Сей', 'Сия',
  'У', 'В', 'Во', 'На', 'От', 'До', 'По', 'За', 'Из', 'К', 'Ко', 'С', 'Со', 'О', 'Об',
  'Когда', 'Тогда', 'Потом', 'После', 'Если', 'Ибо', 'Вот', 'Все', 'Всё', 'Весь',
  'Бог', 'Бога', 'Богу', 'Богом', 'Боге', 'Господь', 'Господа', 'Господу', 'Господом',
  'Господе', 'Дух', 'Духа', 'Духом', 'Сын', 'Сына', 'Сыну', 'Отец', 'Отца', 'Отцу',
  'Царь', 'Царя', 'Царю', 'Царем', 'Царём', 'Египет', 'Египта', 'Египте',
]);

/** Кириллические токены с заглавной буквы + позиции. */
export function capitalizedTokens(text) {
  const out = [];
  const re = /[А-ЯЁ][а-яё]+(?:-[А-ЯЁа-яё][а-яё]+)*/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!STOPWORDS.has(m[0])) out.push({ token: m[0], index: m.index });
  }
  return out;
}

/**
 * Именные паттерны Синодального текста. Возвращают кандидатов с бонусом
 * достоверности (сильный паттерн → почти наверняка имя).
 */
const NAME_PATTERNS = [
  /имя\s+(?:одному|другому|ему|ей|сему|брата его|её|ея)?\s*:?\s*([А-ЯЁ][а-яё]+)/g,
  /нарек(?:ла|ли)?\s+(?:ему|ей|им)?\s*имя\s*:?\s*([А-ЯЁ][а-яё]+)/g,
  /наречени?е?\s+имени\s*:?\s*([А-ЯЁ][а-яё]+)/g,
  /родил[аи]?\s+([А-ЯЁ][а-яё]+)/g,
  /жен[аыеу]\s+(?:его|моя|твоя)?\s*,?\s*([А-ЯЁ][а-яё]+)/g,
];

export function patternCandidates(text) {
  const out = [];
  for (const re of NAME_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (!STOPWORDS.has(m[1])) out.push(m[1]);
    }
  }
  return out;
}

/** Грубая транслитерация библейского EN-имени в русскую форму (для скоринга и фолбэка). */
export function translitEnRu(en) {
  let s = String(en).toLowerCase()
    // многобуквенные сочетания раньше одиночных
    .replace(/sh/g, 'ш').replace(/ch/g, 'х').replace(/th/g, 'ф').replace(/ph/g, 'ф')
    .replace(/zz/g, 'з').replace(/tt/g, 'тт').replace(/kk/g, 'кк')
    .replace(/^je/g, 'ие').replace(/^jo/g, 'ио').replace(/^ja/g, 'иа').replace(/^ju/g, 'иу')
    .replace(/j/g, 'и')
    .replace(/^h/g, '')      // Hebron→Еврон-стиль: начальное h в Синодальном часто опускается
    .replace(/ah$/g, 'а').replace(/iah$/g, 'ия').replace(/h$/g, '')
    .replace(/h/g, '')       // внутренние h чаще исчезают (Abraham→Авраам)
    .replace(/x/g, 'кс').replace(/q/g, 'к').replace(/w/g, 'в').replace(/y/g, 'и')
    .replace(/a/g, 'а').replace(/b/g, 'в').replace(/c/g, 'к').replace(/d/g, 'д')
    .replace(/e/g, 'е').replace(/f/g, 'ф').replace(/g/g, 'г').replace(/i/g, 'и')
    .replace(/k/g, 'к').replace(/l/g, 'л').replace(/m/g, 'м').replace(/n/g, 'н')
    .replace(/o/g, 'о').replace(/p/g, 'п').replace(/r/g, 'р').replace(/s/g, 'с')
    .replace(/t/g, 'т').replace(/u/g, 'у').replace(/v/g, 'в').replace(/z/g, 'з')
    .replace(/[^а-яё]/g, '');
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

/** Нормализованная близость 0..1 (1 = совпадение) по Левенштейну. */
export function similarity(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  if (!a.length || !b.length) return 0;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length);
}

/**
 * Извлечь русское имя для персоны из окна стихов первого упоминания.
 * @param {string} enName       английское имя (TIPNR, первая альтернатива до '|')
 * @param {Array<{ref,text,offset}>} verses  окно из SynodalText.verseWindow()
 * @returns {{ name, source: 'pattern'|'candidate'|'translit', confidence: number,
 *             review: boolean, verseRef?: string } | null}
 */
export function extractRuName(enName, verses) {
  const en = String(enName).split('|')[0].trim();
  const approx = translitEnRu(en);
  let best = null;

  for (const v of verses) {
    if (!v.text) continue;
    const pats = patternCandidates(v.text);
    const caps = capitalizedTokens(v.text).map(t => t.token);
    const scored = [];
    for (const c of pats) scored.push({ c, bonus: 0.25, via: 'pattern' });
    for (const c of caps) scored.push({ c, bonus: 0, via: 'candidate' });
    for (const { c, bonus, via } of scored) {
      const score = similarity(approx, c) + bonus - Math.abs(v.offset) * 0.03;
      if (!best || score > best.score) best = { score, c, via, verseRef: v.ref };
    }
  }

  if (best && best.score >= 0.62) {
    return {
      name: best.c,
      source: best.via,
      confidence: Number(best.score.toFixed(3)),
      review: best.score < 0.8,
      verseRef: best.verseRef,
    };
  }
  if (approx.length >= 2) {
    return { name: approx, source: 'translit', confidence: 0.3, review: true };
  }
  return null;
}
