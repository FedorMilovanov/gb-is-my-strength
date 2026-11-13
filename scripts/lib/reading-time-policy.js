#!/usr/bin/env node
'use strict';

/*
 * Единая политика времени чтения (решение владельца, ноябрь 2026).
 *
 * ОРИЕНТИР: 180 русских слов в минуту. ОКРУГЛЕНИЕ: вверх. МИНИМУМ: 1 минута.
 *
 * Модуль — единственное место, где живёт число 180 и правила подсчёта.
 * Он не хранит значений сам: источниками остаются frontmatter MDX
 * (`readingTime`) и `data/series.json` (`parts[].readingTime`), а модуль
 * только детерминированно вычисляет то, что там должно стоять.
 *
 * Что считается читательским текстом:
 *   — видимый читателю текст тела статьи: абзацы, заголовки, подписи,
 *     содержимое цитат, списков и таблиц, видимый текст инлайн-кнопок ссылок;
 *   — инлайн-код внутри предложения.
 * Что НЕ считается:
 *   — YAML frontmatter, MDX-комментарии {/* … *\/}, HTML-комментарии;
 *   — имена тегов и все их атрибуты (классы, id, data-ref, src, href);
 *   — блоки <script>, <style>, <template> и всё содержимое <head>/<nav>-подобных
 *     служебных обёрток, если они помечены hidden/aria-hidden;
 *   — скрытые элементы (hidden, aria-hidden="true", display:none,
 *     sr-only/visually-hidden) и закрытые по умолчанию <details>/<summary>;
 *   — огороженные блоки ```…``` (это код, а не проза).
 */

const WPM = 180; // русских слов в минуту — политика владельца
const MIN_MINUTES = 1;

const MDX_COMMENT = /\{\/\*[\s\S]*?\*\/\}/g;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const FRONTMATTER = /^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const FENCED_CODE = /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[^\n]*$/gm;
const ESM_LINES = /^[ \t]*(import|export)\b[^\n]*$/gm;
const SCRIPT_STYLE = /<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi;
const DETAILS = /<details\b[^>]*>[\s\S]*?<\/details>/gi;
const HIDDEN_TAG = /<([a-zA-Z][\w-]*)\b([^>]*)\bhide\b[^>]*>[\s\S]*?<\/\1>/g; // страховка, см. ниже
const OPEN_TAG = /<\/?[a-zA-Z][^>]*>/g; // тег целиком: имя + атрибуты

function stripHiddenAndServiceTags(html) {
  return html
    // <script>, <style>, <template> — служебные, не читательский текст
    .replace(SCRIPT_STYLE, ' ')
    // <details> закрыты по умолчанию — читатель их не читает, пока не раскроет
    .replace(DETAILS, ' ')
    // скрытые элементы: hidden, aria-hidden="true", display:none, sr-only/visually-hidden
    .replace(
      /<([a-zA-Z][\w-]*)\b([^>]*)>([\s\S]*?)<\/\1>/g,
      (m, tag, attrs, inner) => {
        const hidden =
          /\bhide\b|\bhidden\b/.test(attrs) ||
          /aria-hidden=(?:"true"|'true'|true)/.test(attrs) ||
          /display\s*:\s*none/.test(attrs) ||
          /class=(?:"[^"]*(?:sr-only|visually-hidden)[^"]*"|'[^']*(?:sr-only|visually-hidden)[^']*')/.test(attrs);
        return hidden ? ' ' : m; // вложенность обрабатывается повторным проходом ниже
      }
    );
}

function stripTags(text) {
  return text.replace(OPEN_TAG, ' ');
}

const WORD = /[\p{L}\p{N}]+(?:[’'\-][\p{L}\p{N}]+)*/gu;

/** Читательские слова в теле MDX-статьи. */
function readerWordCount(mdxSource) {
  if (typeof mdxSource !== 'string') return 0;
  let body = mdxSource.replace(FRONTMATTER, '');
  // два прохода по скрытым элементам, чтобы поймать вложенность
  for (let i = 0; i < 2; i += 1) body = stripHiddenAndServiceTags(body);
  const text = stripTags(
    body
      .replace(MDX_COMMENT, ' ')
      .replace(HTML_COMMENT, ' ')
      .replace(FENCED_CODE, ' ')
      .replace(ESM_LINES, ' ')
  );
  const words = text.match(WORD);
  return words ? words.length : 0;
}

/** Минуты по политике: 180 слов/мин, округление вверх, минимум 1. */
function minutesForWords(words) {
  if (!Number.isFinite(words) || words <= 0) return MIN_MINUTES;
  return Math.max(MIN_MINUTES, Math.ceil(words / WPM));
}

/** Слов в минуту, приписанные существующему значению (для диагностики). */
function impliedWpm(words, minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.round(words / minutes);
}

module.exports = {
  WPM,
  MIN_MINUTES,
  readerWordCount,
  minutesForWords,
  impliedWpm,
};
