#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  collectJsonStringValues,
  findMixedScriptTokens,
  sanitizeMarkupForMixedScript,
} = require('./lib/mixed-script-guard.js');

// 1. Negative fixture: single Latin ASCII homoglyph inside Cyrillic word (previously bypassed 3-letter threshold)
{
  const hits = findMixedScriptTokens('Архив Уильяма Чекy и он hе пришёл.');
  assert.deepEqual(
    hits.map((h) => h.token),
    ['Чекy', 'hе'],
    'must catch 1-letter Latin homoglyphs inside Cyrillic words',
  );
}

// 2. Negative fixture: single precomposed accented Latin vowel inside Cyrillic word (previously bypassed ASCII-only regex)
{
  const hits = findMixedScriptTokens('Сердцá людей, духóвный смысл и Ханóх.');
  assert.deepEqual(
    hits.map((h) => h.token),
    ['Сердцá', 'духóвный', 'Ханóх'],
    'must catch accented Latin vowels mixed into Cyrillic words',
  );
}

// 3. Negative fixture: single Cyrillic homoglyph inside Latin word
{
  const hits = findMixedScriptTokens('Cambridge Biblе Society and pаstor ministry.');
  assert.deepEqual(
    hits.map((h) => h.token),
    ['Biblе', 'pаstor'],
    'must catch 1-letter Cyrillic homoglyphs inside Latin words',
  );
}

// 4. Negative fixture: non-article JSON/map/quiz/metadata surfaces
{
  const mapPayload = {
    points: [{ title: 'Иерихон', summary: 'Археологический отчёт Кеньoн.' }],
  };
  const jsonHits = findMixedScriptTokens(collectJsonStringValues(mapPayload).join('\n'));
  assert.deepEqual(jsonHits.map((h) => h.token), ['Кеньoн'], 'must catch mixed-script tokens in JSON map payloads');

  const htmlMeta = `
    <html>
      <head>
        <title>Исследование тексtа</title>
        <meta name="description" content="Обзор рукописeй Нового Завета" />
      </head>
      <body><button aria-label="Открыtь меню">Меню</button></body>
    </html>
  `;
  const metaHits = findMixedScriptTokens(sanitizeMarkupForMixedScript(htmlMeta));
  assert.deepEqual(
    metaHits.map((h) => h.token),
    ['тексtа', 'рукописeй', 'Открыtь'],
    'must catch mixed-script tokens in <title>, <meta>, and aria-label attributes',
  );
}

// 5. Negative fixture: unapproved hyphenated hybrid
{
  const hits = findMixedScriptTokens('Термин гоим-haолам и randomword-слово.');
  assert.deepEqual(
    hits.map((h) => h.token),
    ['haолам', 'randomword-слово'],
    'must catch both subtoken homoglyphs and unapproved hyphenated Latin-Cyrillic hybrids',
  );
}

// 6. Positive preservation: URLs, mailto encodings, code blocks, citations, and approved hybrids must pass cleanly
{
  const cleanHtml = `
    <article>
      <p>Скачайте PDF-архив, откройте 3D-карту и GPS-координату в Telegram-приложении.</p>
      <p>См. источник: <a href="https://gospod-bog.ru/articles/kod-da-vinchi/">https://gospod-bog.ru/articles/kod-da-vinchi/</a></p>
      <p><a href="mailto:test@example.com?subject=%D0%9E%D1%88%D0%B8%D0%B1%D0%BA%D0%B0&body=%0AЯ%20нашёл%3AОписание">Сообщить</a></p>
      <pre><code>const x = "academическую";</code></pre>
      <p><em>John Gill, A Body of Doctrinal Divinity</em> (London, 1769), 142.</p>
    </article>
  `;
  const cleanHits = findMixedScriptTokens(sanitizeMarkupForMixedScript(cleanHtml));
  assert.deepEqual(cleanHits, [], `approved forms must produce 0 false positives, got ${JSON.stringify(cleanHits)}`);
}

console.log('Mixed-script surface contract: PASS (1-char Latin/Cyrillic homoglyphs, accented Latin, JSON/meta/ARIA, and allowlist verified)');
