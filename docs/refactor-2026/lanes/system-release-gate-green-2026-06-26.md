# Lane: system-release-gate-green-2026-06-26

**Date:** 2026-06-26  
**Mode:** SYSTEM  
**Branch:** `lane/system-release-gate-green-2026-06-26`  
**Goal:** вернуть зелёный release/static gate после floating-cluster/cache-bust/SEO рассинхрона.

## Что исправлено

1. **Cache-bust drift закрыт**
   - `js/floating-cluster-controller.js` refs in root legacy/public HTML обновлены с `?v=5c91b618` на актуальный `?v=ba4a4019` через `npm run cache-bust`.
   - Затронуты article / baptisty / nagornaya root HTML pages, где audit-pro выдавал 25 cache-bust errors.

2. **SW / audit-pro live asset contract синхронизирован**
   - `scripts/cache-bust.js`: убраны tooling/dead assets из user-facing cache-bust list:
     - `css/site-layered.css`
     - `js/site-modules.js`
   - `scripts/audit-pro.js`: G61 теперь требует в SW precache только cache-busted live assets, а не каждый физический `.css/.js` файл в папках.
   - Причина: `site-layered.css` и `site-modules.js` не подключаются production HTML и не должны принудительно скачиваться пользователями через SW.

3. **SEO FAQPage false-negative закрыт**
   - `scripts/seo-audit.js`: проверка FAQPage теперь regex-based (`"@type"\s*:\s*"FAQPage"`), поэтому compact/minified JSON-LD больше не считается отсутствующим.
   - Это закрыло SEO errors на Krajne / Antisovetov без добавления дублей JSON-LD.

4. **`/rodosloviye/` noindex/sitemap contradiction закрыт**
   - `rodosloviye/index.html`: robots изменён на `index, follow`, чтобы root legacy layer соответствовал native Astro source и sitemap.
   - До фикса audit-pro падал: sitemap listed noindex page.

5. **Gill trilogy H1 parity восстановлен**
   - `GillPart1HeaderHero.astro`: `Джон Гилл (1697–1771). Часть I: Человек`
   - `GillPart2HeaderHero.astro`: `Джон Гилл (1697–1771). Часть II: Учёный`
   - `GillPart3HeaderHero.astro`: `Джон Гилл (1697–1771). Часть III: Наследие`
   - Это закрыло `astro:audit:article-mdx:strict` failures по visible H1 mismatch legacy vs dist.

6. **Release gate усилен strict migration metadata**
   - `package.json`: `validate:static-publication` и `validate:static-publication:light` теперь завершаются `migration:metadata:check:strict`, а не warning-mode check.

## Проверки

### FAST / targeted

```bash
node scripts/seo-audit.js
node scripts/audit-pro.js
node scripts/validate.js --strict
node scripts/check-data-consistency.js
node scripts/check-route-migration-matrix.js --strict
node scripts/check-content-source-coverage.js --strict
node scripts/native-runtime-taxonomy-audit.js --strict
node scripts/check-workflows.js
```

Результат: зелёные, кроме допустимых validate warnings.

### FULL barrier

```bash
PATH=/home/user/node-v22.12.0-linux-x64/bin:$PATH npm run validate:static-publication
```

Результат: ✅ passed.

## Остались warnings, не blocking

- `validate.js`: 5 warnings (floating-cluster нестандартные breakpoints; title/og:title drift на 2 статьях).
- `audit-pro.js`: 3 warnings:
  - CSS budget;
  - undefined CSS vars in `floating-cluster.css`;
  - magic z-index in `floating-cluster.css`.

Эти пункты не ломают release gate и должны идти отдельной CSS-polish lane.

## Out-of-lane notes

- `Research` repo был просмотрен как источник материалов для будущего контента: там есть большие корпуса по `БАПТИСТЫ РОССИИ`, `СЕРИЯ СЕРДЦЕ`, `ОБРАТНАЯ СТОРОНА КАФЕДРЫ`. В эту system gate lane материалы не переносились, чтобы не смешивать content ingestion с release stabilization.

## Rollback

Откатить этот lane commit целиком, если потребуется вернуться к предыдущему failing state для forensic diff.
