# ASTRO_PROTOTYPE_TASKLIST.md — конкретный tasklist первого PR Astro

Дата: 2026-06-12  
Статус: tasklist, выполнять только в отдельной ветке.

---

## Цель PR

Создать минимальный Astro-прототип без замены текущего сайта.

Не цель:

```text
❌ не мигрировать все статьи
❌ не трогать карты
❌ не менять URL production
❌ не делать redesign
❌ не включать CMS
```

---

## PR name

```text
astro-prototype-minimal
```

---

## 1. Подготовка ветки

```bash
git checkout -b astro-prototype-minimal
npm run contract:extract
cp reports/url-contract-draft.json reports/url-contract-baseline-2026-06-12.json
```

---

## 2. Установка зависимостей

```bash
npm install -D astro typescript @astrojs/check
npm install @astrojs/react @astrojs/mdx @astrojs/sitemap @astrojs/rss
npm install react react-dom
```

Проверить Node version. Если Astro 6 требует Node 22, не менять `engines` в main сразу — только в ветке.

---

## 3. Добавить config

Файлы:

```text
astro.config.mjs
tsconfig.json
src/env.d.ts optional
```

Минимум:

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

## 4. Добавить scripts

```json
{
  "dev": "astro dev",
  "build": "astro check && astro build",
  "preview": "astro preview",
  "check": "astro check"
}
```

Важно: не удалить текущие validate scripts.

---

## 5. Создать структуру src

```text
src/
  data/site.ts
  layouts/BaseLayout.astro
  components/seo/Seo.astro
  components/ui/Header.astro
  components/ui/Footer.astro
  styles/tokens.css
  styles/global.css
  pages/dev/astro-test.astro
```

---

## 6. Реализовать BaseLayout

Требования:

```text
[ ] lang="ru"
[ ] charset
[ ] viewport
[ ] title/description/canonical
[ ] robots
[ ] OG/Twitter
[ ] RSS link
[ ] local CSS
[ ] slot
```

---

## 7. Реализовать Seo.astro

Требования:

```text
[ ] title
[ ] description
[ ] canonical
[ ] robots
[ ] og:title
[ ] og:description
[ ] og:url
[ ] og:type
[ ] og:image optional
[ ] twitter
[ ] JSON-LD array
```

---

## 8. Тестовая страница

```text
src/pages/dev/astro-test.astro
```

С `noindex`.

Проверить:

```bash
npm run dev
npm run build
npm run preview
```

---

## 9. Не конфликтовать с legacy

Пока Astro output не должен перетирать production root.

Варианты:

```text
- build отдельно в dist и не деплоить
- или pages/dev only
```

---

## 10. Проверки PR

```bash
npm run contract:extract
npm run check
npm run build
npm run preview
```

Ручно:

```text
[ ] /dev/astro-test/ открывается в preview
[ ] HTML source содержит контент
[ ] noindex стоит
[ ] нет React runtime без островов
[ ] CSS/шрифты не ломают страницу
```

---

## 11. Следующий PR после этого

```text
astro-about-pilot
```

Цель:

```text
перенести /about/ на Astro
сравнить SEO/visual с legacy
не трогать остальные страницы
```

---

## 12. Definition of Done

```text
[ ] Astro установлен и собирается
[ ] BaseLayout/Seo работают
[ ] dev test page есть
[ ] legacy не сломан
[ ] документация обновлена
[ ] PR маленький и обратимый
```
