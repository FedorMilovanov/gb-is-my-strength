# IMAGE_PIPELINE_2026.md — изображения, OG, Astro assets, image SEO

Дата: 2026-06-12  
Связано с:

- `docs/SEO_TECHNICAL_CONTRACT_2026.md`
- `docs/ASTRO_IMPLEMENTATION_BLUEPRINT_2026.md`
- `docs/CONTENT_MODEL_AND_AUTHORING_2026.md`

---

## 1. Цель

Сделать изображения управляемой системой:

```text
быстро грузятся;
не ломают CLS;
имеют alt;
работают для SEO/Google Images;
дают хорошие OG previews;
не дублируются хаотично;
легко добавляются к новым статьям;
сохраняют текущие URL там, где важно.
```

---

## 2. Что важно для Google Images

Google Image SEO best practices рекомендуют:

- использовать HTML image elements `<img>` с `src`;
- писать descriptive `alt`;
- использовать responsive images через `<picture>`/`srcset`;
- использовать поддерживаемые форматы JPEG, PNG, WebP, SVG, AVIF;
- делать описательные filenames;
- улучшать landing pages и structured data;
- следить за скоростью и качеством [1](https://developers.google.com/search/docs/appearance/google-images).

Правило проекта:

```text
Контентные изображения не должны быть только CSS background.
```

---

## 3. Типы изображений проекта

```text
1. favicon/icons
2. OG images 1200x630
3. hero/cover images статей
4. inline article images
5. map/atlas images
6. decorative backgrounds/noise
7. author/profile images
8. generated thumbnails/cards
```

---

## 4. Текущая стратегия до Astro

Сохранять существующие:

```text
/images/*.webp
/icons/*.png
/fonts/...
```

Не ломать текущие URL картинок, особенно OG:

```text
https://gospod-bog.ru/images/og-*.webp
```

---

## 5. Целевая стратегия в Astro

### 5.1 Новые статьи

Для новых статей хранить source assets рядом:

```text
src/assets/articles/<slug>/cover.jpg
src/assets/articles/<slug>/inline-1.jpg
```

И использовать Astro:

```astro
---
import { Picture } from 'astro:assets';
import cover from '@/assets/articles/foo/cover.jpg';
---

<Picture
  src={cover}
  formats={['avif', 'webp']}
  fallbackFormat="jpg"
  alt="Описание изображения"
  widths={[480, 768, 1200, 1600]}
  sizes="(max-width: 760px) 100vw, 760px"
/>
```

Astro assets docs: `Picture` генерирует оптимизированное изображение с несколькими formats/sizes; порядок formats важен, современные форматы вроде WebP/AVIF идут первыми [1](https://docs.astro.build/en/reference/modules/astro-assets/).

### 5.2 Старые изображения

Старые `/images/...` не переносить сразу. Использовать как public assets, потом постепенно оптимизировать.

---

## 6. Форматы

Рекомендация:

```text
AVIF — первый source для новых hero/cover, если качество ок
WebP — основной безопасный формат
JPEG — fallback для фото
PNG — только если нужна lossless/прозрачность и SVG/WebP не подходят
SVG — логотипы/иконки/простая векторная графика
```

Astro `Picture` позволяет форматы:

```astro
formats={['avif', 'webp']}
fallbackFormat="jpg"
```

---

## 7. Alt policy

```text
Содержательное изображение: alt описывает, что важно читателю.
Декоративное изображение: alt="".
Не набивать ключи.
Не писать «картинка/изображение» без необходимости.
```

Примеры:

```text
Плохо: alt="Авраам карта Библия путь Авраама карта Авраам"
Хорошо: alt="Стилизованная карта пути Авраама от Ура к Ханаану"
```

---

## 8. Width/height и CLS

Каждое `<img>` должно иметь размеры или layout, который резервирует место.

```text
[ ] width/height
[ ] aspect-ratio
[ ] no late layout shift
```

Hero/LCP image:

```text
[ ] не lazy-load
[ ] decoding="async" обычно
[ ] fetchpriority="high" только если это настоящий LCP
```

---

## 9. OG images

Стандарт:

```text
1200x630
WebP + при необходимости JPG fallback
описательный filename
релевантно странице
указаны og:image:width/height/type/alt
```

Meta:

```html
<meta property="og:image" content="https://gospod-bog.ru/images/og-foo-1200x630.webp">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/webp">
<meta property="og:image:alt" content="...">
```

---

## 10. Article structured data images

Google Article docs рекомендуют для лучших результатов несколько image aspect ratios: 1x1, 4x3, 16x9, минимум 50K pixels, crawlable/indexable URLs [1](https://developers.google.com/search/docs/appearance/structured-data/article).

В идеале для ключевых статей:

```json
"image": [
  "https://gospod-bog.ru/images/foo-1x1.webp",
  "https://gospod-bog.ru/images/foo-4x3.webp",
  "https://gospod-bog.ru/images/foo-16x9.webp"
]
```

Но для начала можно сохранить текущий OG как основной image.

---

## 11. Image sitemap

Не обязательно на первой фазе. Рассмотреть, если:

```text
много уникальных авторских иллюстраций;
важен Google Images traffic;
будут карты/атласные изображения;
будет крупная медиабиблиотека.
```

---

## 12. Naming convention

```text
images/
  og-<slug>-1200x630.webp
  <slug>-cover-1200w.webp
  <slug>-cover-900w.webp
  <slug>-cover-600w.webp
```

Для Astro source assets:

```text
src/assets/articles/<slug>/cover.jpg
src/assets/articles/<slug>/figure-01.jpg
```

---

## 13. Figure component

```astro
---
import { Picture } from 'astro:assets';
const { src, alt, caption, widths = [480, 768, 1200] } = Astro.props;
---
<figure class="figure">
  <Picture
    src={src}
    formats={['avif', 'webp']}
    fallbackFormat="jpg"
    alt={alt}
    widths={widths}
    sizes="(max-width: 760px) 100vw, 760px"
  />
  {caption && <figcaption>{caption}</figcaption>}
</figure>
```

---

## 14. Map images

Карты имеют отдельный режим:

```text
interactive SVG — не обычное image
OG preview — обычный WebP 1200x630
print/export PNG — будущая функция
```

Для `/karty/avraam/` обязательно иметь:

```text
OG image
screenshot/social preview
alt
structured data image
```

---

## 15. CI checks

```text
[ ] every content image has alt or alt=""
[ ] cover requires coverAlt
[ ] og:image exists
[ ] og:image width/height for key pages
[ ] Article image URL exists
[ ] no missing local image
[ ] no giant unoptimized PNG/JPG above threshold
[ ] no layout image without width/height/aspect ratio
```

---

## 16. Migration strategy

```text
Фаза 1: сохранить старые /images URLs.
Фаза 2: новые статьи через Astro assets.
Фаза 3: ключевые старые hero/OG images нормализовать.
Фаза 4: добавить image pipeline script/report.
Фаза 5: image sitemap, если есть смысл.
```

---

## 17. Итог

Цель не просто «сжать картинки», а сделать image system:

```text
SEO + performance + accessibility + authoring convenience.
```
