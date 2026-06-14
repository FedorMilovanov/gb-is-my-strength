# ASTRO_SCAFFOLDING_IMPLEMENTATION_PLAN.md — точный план scaffold без риска

Дата: 2026-06-12

---

## 1. Цель

Создать минимальную Astro-структуру, не меняя production.

---

## 2. Package install

```bash
npm install -D astro typescript @astrojs/check
npm install @astrojs/react @astrojs/mdx @astrojs/sitemap @astrojs/rss
npm install react react-dom
```

Если Node 22 нужен для Astro 6, сначала проверить локально/CI. Не менять production engines без отдельного PR.

---

## 3. Files to add

```text
astro.config.mjs
tsconfig.json
src/data/site.ts
src/layouts/BaseLayout.astro
src/components/seo/Seo.astro
src/components/seo/JsonLd.astro
src/components/ui/Header.astro
src/components/ui/Footer.astro
src/styles/tokens.css
src/styles/global.css
src/pages/dev/astro-test.astro
```

---

## 4. astro.config.mjs

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://gospod-bog.ru',
  trailingSlash: 'always',
  output: 'static',
  integrations: [react(), mdx(), sitemap()],
});
```

---

## 5. tsconfig.json

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

---

## 6. dev test page

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
---
<BaseLayout
  title="Astro test | Господь Бог — Сила Моя"
  description="Техническая тестовая страница Astro-прототипа."
  canonical="https://gospod-bog.ru/dev/astro-test/"
  robots="noindex, follow"
>
  <h1>Astro test</h1>
  <p>Astro-прототип работает. Эта страница не предназначена для индексации.</p>
</BaseLayout>
```

---

## 7. Commands

```json
{
  "astro:dev": "astro dev",
  "astro:check": "astro check",
  "astro:build": "astro check && astro build",
  "astro:preview": "astro preview"
}
```

Не переименовывать текущий `build` сразу, чтобы не ломать старый workflow.

---

## 8. Safety checks

```text
[ ] legacy files unchanged
[ ] Astro only creates dist locally
[ ] /dev/astro-test/ noindex
[ ] no production deploy change
[ ] package lock reviewed
[ ] CI still passes legacy validation
```

---

## 9. Merge criteria

```text
[ ] npm run astro:check passes
[ ] npm run astro:build passes
[ ] npm run contract:extract passes
[ ] npm run maps:validate passes
[ ] docs updated
```

---

## 10. Next PR

```text
astro-about-pilot
```

Only after scaffold merged.
