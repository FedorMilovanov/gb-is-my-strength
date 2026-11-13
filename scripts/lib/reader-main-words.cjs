#!/usr/bin/env node
/**
 * reader-main-words.cjs — видимые слова внутри `<main>` собранной страницы.
 *
 * Один квант подсчёта для двух ролей: сверка (`reading-time-dist-crosscheck`)
 * и запись минут нативных маршрутов, у которых нет ни MDX, ни одного файла с
 * телом (`native-route-reading-time`).
 */

'use strict';

// Теги, содержимое которых не читают глазами.
const SKIP_TAGS = new Set(['script', 'style', 'template', 'svg', 'noscript']);

// Пустые элементы не имеют закрывающего тега: если положить их в стек,
// он никогда не очистится и всё дальнейшее содержимое пометится скрытым
// (страница `dzhon-gill-chast-3-nasledie` давала 0 слов из-за `<img hidden>`).
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Видимые слова внутри `<main>`: минимальный стекобход без зависимостей.
 * Свой парсер нужен потому, что регулярка `<[^>]+>` оставляет текст атрибутов
 * (длинные aria-label источников) и не знает про `hidden`.
 */
function visibleMainWords(html) {
  // Скрипты, стили и комментарии убираем целиком до разбора: внутри `<script>`
  // живут строки с `</`, `document` и собственные `<div>` из шаблонов, и
  // построчный стек от них ломался — страница показывала 0 слов.
  const cleaned = String(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  const stack = [];
  let inMain = 0;
  let words = 0;
  let last = 0;

  // Атрибуты разбираем по токенам вне кавычек: `class="hidden md:block"`
  // — это класс, а не скрытый блок, и регулярка по всей строке ловила его
  // как `hidden`, обнуляя содержимое 30 страниц.
  const parseAttrs = (attrs) => {
    const out = new Map();
    const re = /([^\s=/>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let m;
    while ((m = re.exec(attrs))) {
      const name = m[1].toLowerCase();
      const value = m[3] ?? m[4] ?? m[5] ?? '';
      out.set(name, value === '' && !m[2] ? true : value);
    }
    return out;
  };
  const hasFlag = (map, name) => map.get(name) === true;
  const attrValue = (map, name) => {
    const value = map.get(name);
    return typeof value === 'string' ? value : '';
  };
  const hiddenNow = () => stack.some((frame) => frame.hidden);

  const countText = (text) => {
    if (inMain <= 0 || hiddenNow()) return;
    const plain = text.replace(/&[a-z0-9#]+;/gi, ' ');
    words += (plain.match(/[A-Za-zА-Яа-яЁё0-9]{2,}/g) || []).length;
  };

  let m;
  while ((m = tagRe.exec(cleaned))) {
    if (inMain > 0) countText(cleaned.slice(last, m.index));
    last = tagRe.lastIndex;
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3] || '';

    if (closing) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].tag === tag) {
          stack.splice(i, 1);
          break;
        }
      }
      if (tag === 'main' && inMain > 0) inMain -= 1;
      continue;
    }

    const selfClosing = /\/\s*$/.test(attrs);
    if (selfClosing || VOID_TAGS.has(tag)) continue;

    const map = parseAttrs(attrs);
    const hidden =
      hasFlag(map, 'hidden') ||
      attrValue(map, 'aria-hidden') === 'true' ||
      SKIP_TAGS.has(tag);

    stack.push({ tag, hidden });
    if (tag === 'main') inMain += 1;
  }
  if (inMain > 0) countText(cleaned.slice(last));
  return words;
}

module.exports = { visibleMainWords };
