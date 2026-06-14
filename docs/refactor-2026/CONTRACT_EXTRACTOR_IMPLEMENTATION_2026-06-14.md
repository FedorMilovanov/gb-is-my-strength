# CONTRACT_EXTRACTOR_IMPLEMENTATION_2026-06-14.md

Дата: 2026-06-14  
Риск-уровень: **Level 0 — docs/scripts only**  
Статус: выполнен первый безопасный шаг из `NEXT_ACTIONS_PROFESSIONAL_SEQUENCE.md`.

## Что сделано

Добавлен скрипт:

```text
scripts/extract-url-contract.js
```

Назначение: извлекать URL/SEO contract из текущего legacy root или будущего build output (`dist/`) без изменения production.

## CLI

```bash
node scripts/extract-url-contract.js
node scripts/extract-url-contract.js --root . --out-json reports/url-contract-root.json --out-md reports/url-contract-root.md
node scripts/extract-url-contract.js --root dist --out-json reports/url-contract-dist.json --out-md reports/url-contract-dist.md
```

Опции:

```text
--root DIR        директория для анализа; по умолчанию repo root
--out-json FILE   JSON report path
--out-md FILE     Markdown report path
--include-noindex включить noindex pages в public section
```

## Package scripts

Добавлены:

```json
"contract:extract": "node scripts/extract-url-contract.js",
"contract:extract:root": "node scripts/extract-url-contract.js --root . --out-json reports/url-contract-root.json --out-md reports/url-contract-root.md",
"contract:extract:dist": "node scripts/extract-url-contract.js --root dist --out-json reports/url-contract-dist.json --out-md reports/url-contract-dist.md"
```

`reports/` добавлен в `.gitignore`, потому отчёты локальные и не должны попадать в git.

## Что извлекается

Для каждого HTML:

- file
- expected URL from file path
- canonical URL
- title
- description
- robots
- H1 + h1Count
- OG title/url/image
- JSON-LD types
- visible word count
- local refs
- flags: system/noindex/publicPage

## Проверка текущего root

```bash
npm run contract:extract
```

Результат на момент добавления:

```text
42 public pages
0 issues
```

## Почему это безопасно

- production HTML/CSS/JS не меняется;
- deploy workflow не меняется;
- Astro зависимости не устанавливаются;
- скрипт нужен для будущего сравнения `legacy root` vs `Astro dist`;
- это прямо соответствует immediate safe next step из `RESEARCH_SOURCE_AUDIT_POST_PUSH_2026.md` и Next PR 1 из `NEXT_ACTIONS_PROFESSIONAL_SEQUENCE.md`.

## Следующий шаг, но НЕ сейчас автоматически

Добавить `scripts/compare-url-contract.js`, когда появится второй report (`dist`) или когда владелец разрешит следующий Level 0 PR.
