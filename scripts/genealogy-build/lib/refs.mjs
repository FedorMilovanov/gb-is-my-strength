/**
 * refs.mjs — OSIS-коды книг, разбор ссылок TIPNR (Book.ch.v), доступ к Синодальному
 * тексту и русские сокращения книг.
 *
 * Версификация: TIPNR следует англ. схеме (ESV); Синодальный местами расходится
 * (Руф 4 хвост, Псалтирь-заголовки, Иоиль 2/3 и т.п.). Для извлечения имён этого
 * достаточно решать локально: resolveVerse() умеет отдавать окно соседних стихов.
 */

export const OSIS_ORDER = [
  'Gen','Exo','Lev','Num','Deu','Jos','Jdg','Rut','1Sa','2Sa','1Ki','2Ki','1Ch','2Ch',
  'Ezr','Neh','Est','Job','Psa','Pro','Ecc','Sng','Isa','Jer','Lam','Ezk','Dan','Hos',
  'Jol','Amo','Oba','Jon','Mic','Nam','Hab','Zep','Hag','Zec','Mal',
  'Mat','Mrk','Luk','Jhn','Act','Rom','1Co','2Co','Gal','Eph','Php','Col','1Th','2Th',
  '1Ti','2Ti','Tit','Phm','Heb','Jas','1Pe','2Pe','1Jn','2Jn','3Jn','Jud','Rev',
];

const BOOK_INDEX = new Map(OSIS_ORDER.map((c, i) => [c, i]));

/** Русские сокращения книг (для firstRef.ru и будущих verse-поповеров). */
export const OSIS_RU = {
  Gen: 'Быт', Exo: 'Исх', Lev: 'Лев', Num: 'Чис', Deu: 'Втор', Jos: 'Нав', Jdg: 'Суд',
  Rut: 'Руф', '1Sa': '1Цар', '2Sa': '2Цар', '1Ki': '3Цар', '2Ki': '4Цар',
  '1Ch': '1Пар', '2Ch': '2Пар', Ezr: 'Езд', Neh: 'Неем', Est: 'Есф', Job: 'Иов',
  Psa: 'Пс', Pro: 'Притч', Ecc: 'Еккл', Sng: 'Песн', Isa: 'Ис', Jer: 'Иер',
  Lam: 'Плач', Ezk: 'Иез', Dan: 'Дан', Hos: 'Ос', Jol: 'Иоил', Amo: 'Ам', Oba: 'Авд',
  Jon: 'Иона', Mic: 'Мих', Nam: 'Наум', Hab: 'Авв', Zep: 'Соф', Hag: 'Агг',
  Zec: 'Зах', Mal: 'Мал', Mat: 'Мф', Mrk: 'Мк', Luk: 'Лк', Jhn: 'Ин', Act: 'Деян',
  Rom: 'Рим', '1Co': '1Кор', '2Co': '2Кор', Gal: 'Гал', Eph: 'Еф', Php: 'Флп',
  Col: 'Кол', '1Th': '1Фес', '2Th': '2Фес', '1Ti': '1Тим', '2Ti': '2Тим', Tit: 'Тит',
  Phm: 'Флм', Heb: 'Евр', Jas: 'Иак', '1Pe': '1Пет', '2Pe': '2Пет', '1Jn': '1Ин',
  '2Jn': '2Ин', '3Jn': '3Ин', Jud: 'Иуд', Rev: 'Откр',
};

// TIPNR различает тёзок в одном стихе суффиксом подстиха: Ezr.8.16a / .16b / .16c
const REF_RE = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)([a-z]?)$/;

/** 'Exo.4.14' | 'Ezr.8.16b' → { osis, chapter, verse, sub } | null */
export function parseRef(ref) {
  const m = REF_RE.exec(ref);
  if (!m || !BOOK_INDEX.has(m[1])) return null;
  return { osis: m[1], chapter: Number(m[2]), verse: Number(m[3]), sub: m[4] || '' };
}

/** 'Exo.4.14' → 'Исх 4:14' (для UI/отчётов). */
export function refToRu(ref) {
  const p = parseRef(ref);
  return p ? `${OSIS_RU[p.osis]} ${p.chapter}:${p.verse}` : ref;
}

/**
 * Обёртка над Синодальным JSON (формат thiagobodruk/bible: массив из 66 книг,
 * book.chapters = массив глав, глава = массив строк-стихов).
 */
export class SynodalText {
  constructor(books) {
    if (!Array.isArray(books) || books.length !== 66) {
      throw new Error(`SynodalText: ожидалось 66 книг, получено ${books?.length}`);
    }
    this.books = books;
  }

  /** Точный стих или null. */
  verse(ref) {
    const p = typeof ref === 'string' ? parseRef(ref) : ref;
    if (!p) return null;
    const book = this.books[BOOK_INDEX.get(p.osis)];
    return book?.chapters?.[p.chapter - 1]?.[p.verse - 1] ?? null;
  }

  /**
   * Окно стихов вокруг ref (для версификационных сдвигов): [{ref, text}, …]
   * span=2 → до 5 стихов: v-2..v+2 в пределах главы.
   */
  verseWindow(ref, span = 2) {
    const p = typeof ref === 'string' ? parseRef(ref) : ref;
    if (!p) return [];
    const chapter = this.books[BOOK_INDEX.get(p.osis)]?.chapters?.[p.chapter - 1];
    if (!chapter) return [];
    const out = [];
    for (let v = Math.max(1, p.verse - span); v <= Math.min(chapter.length, p.verse + span); v++) {
      out.push({ ref: `${p.osis}.${p.chapter}.${v}`, text: chapter[v - 1], offset: v - p.verse });
    }
    // ближние к целевому стиху — первыми
    out.sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset));
    return out;
  }
}
