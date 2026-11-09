import { parseBibleReference, normalizeBookAlias } from './bible-reference-core.mjs';

/**
 * Build-time-only reader projection of independently sourced public-domain
 * eBible RUSSYN. Never open the held Kassian or mixed-rights excerpts.
 */
export function createPublicSynodalResolver(registry, edition) {
  if (edition?._meta?.rightsState !== 'PUBLICATION_ELIGIBLE'
      || edition?._meta?.publicationState !== 'PUBLICATION_APPROVED'
      || edition?._meta?.rights !== 'Public Domain (eBible RUSSYN)') {
    throw new Error('Unapproved public Synodal source');
  }
  const bookCodeById = new Map(
    Object.entries(edition._meta.bookIds || {}).map(([code, id]) => [id, code]),
  );
  const books = edition.books || {};
  const aliases = registry.aliasMap || new Map();
  if (!registry.aliasMap) {
    for (const [bookId, book] of Object.entries(registry.books || {})) {
      for (const alias of book.aliases || []) {
        const key = normalizeBookAlias(alias);
        const previous = aliases.get(key);
        if (previous && previous !== bookId) throw new Error('Ambiguous Bible book alias: ' + alias);
        aliases.set(key, bookId);
      }
    }
  }
  const parserRegistry = { ...registry, aliasMap: aliases };
  function validChapter(book, chapter) {
    return Number.isInteger(chapter) && chapter >= 1
      && Object.keys(book).some(key => key.startsWith(chapter + ':'));
  }
  function collect(code, startChapter, startVerse, endChapter, endVerse) {
    const book = books[code];
    if (!book || !validChapter(book, startChapter) || !validChapter(book, endChapter)) return null;
    if (startChapter > endChapter || (startChapter === endChapter && startVerse > endVerse)) return null;
    const rows = [];
    let foundStart = false;
    let foundEnd = false;
    for (let chapter = startChapter; chapter <= endChapter; chapter += 1) {
      const entries = Object.entries(book)
        .filter(([key]) => Number(key.split(':')[0]) === chapter)
        .map(([key, text]) => ({ verse: Number(key.split(':')[1]), text }))
        .sort((a, b) => a.verse - b.verse);
      for (const row of entries) {
        if (chapter === startChapter && row.verse < startVerse) continue;
        if (chapter === endChapter && row.verse > endVerse) continue;
        if (chapter === startChapter && row.verse === startVerse) foundStart = true;
        if (chapter === endChapter && row.verse === endVerse) foundEnd = true;
        rows.push({ chapter, ...row });
      }
    }
    if (!rows.length || (!foundStart && Number.isFinite(startVerse)) || (!foundEnd && Number.isFinite(endVerse))) return null;
    // Preserve verse identity in longer passages.
    const numbered = rows.length > 1;
    const text = rows.map(row =>
      (numbered ? (startChapter === endChapter ? '' : row.chapter + ':') + row.verse + ' ' : '') + row.text
    ).join(' ').trim();
    return { text, verses: rows.length };
  }

  function resolve(reference) {
    const source = String(reference || '').trim().replace(/[\u00a0\u202f]/g, ' ')
      .replace(/[\u2012-\u2015]/g, '-').replace(/\s+/g, ' ');
    // One-chapter books (Jude, Philemon, 2/3 John, Obadiah) conventionally
    // omit chapter 1: "Иуды 14-15" names verses, not non-existent chapters.
    const singleChapterVerses = source.match(/^(.+?)\s+(\d{1,3})(?:-(\d{1,3}))?$/u);
    if (singleChapterVerses) {
      const id = aliases.get(normalizeBookAlias(singleChapterVerses[1]));
      const code = bookCodeById.get(id);
      if (code && validChapter(books[code], 1)
          && !Object.keys(books[code]).some(key => !key.startsWith('1:'))) {
        const start = Number(singleChapterVerses[2]);
        const end = Number(singleChapterVerses[3] || singleChapterVerses[2]);
        return collect(code, 1, start, 1, end);
      }
    }
    // A reference may traverse a chapter boundary: Matthew 4:23-5.
    const crossChapter = source.match(/^(.+?)\s+(\d{1,3}):(\d{1,3})-(\d{1,3})$/u);
    if (crossChapter) {
      const id = aliases.get(normalizeBookAlias(crossChapter[1]));
      const code = bookCodeById.get(id);
      const ch = Number(crossChapter[2]), start = Number(crossChapter[3]), last = Number(crossChapter[4]);
      if (code && last > ch && validChapter(books[code], last))
        return collect(code, ch, start, last, Infinity);
    }
    const parsed = parseBibleReference(source, parserRegistry);
    if (parsed.ok) {
      const code = bookCodeById.get(parsed.bookId);
      const startVerse = parsed.start ? Number.parseInt(parsed.start, 10) : 1;
      const endVerse = parsed.end ? Number.parseInt(parsed.end, 10) : parsed.start ? startVerse : Infinity;
      if (!code || !Number.isFinite(startVerse) || (!Number.isFinite(endVerse) && endVerse !== Infinity)) return null;
      return collect(code, parsed.chapter, startVerse, parsed.chapter, endVerse);
    }
    const chapterRange = source.match(/^(.+?)\s+(\d{1,3})-(\d{1,3})$/u);
    if (chapterRange) {
      const id = aliases.get(normalizeBookAlias(chapterRange[1]));
      const code = bookCodeById.get(id);
      if (!code) return null;
      const first = Number(chapterRange[2]), last = Number(chapterRange[3]);
      return collect(code, first, 1, last, Infinity);
    }
    return null;
  }
  return Object.freeze({ resolve, edition: edition._meta.translation });
}
