# ASTRO_IMAGE_CURRENT_NOTES_2026.md — уточнение по текущему Astro image API

Дата: 2026-06-12  
Связано с:

- `docs/IMAGE_PIPELINE_2026.md`

---

## 1. Зачем уточнение

В ранних Astro 5 beta docs встречались `layout='responsive'`. В текущих Astro image docs используются layout values вроде:

```text
constrained
full-width
fixed
none
```

Нужно ориентироваться на текущую stable документацию, а не beta terminology.

---

## 2. Текущие layout modes

По Astro Images docs:

```text
constrained — image scales down to container, max-width 100%; good default
full-width — image fills container/page width, good for hero
fixed — fixed dimensions, good for icons/logos
none — no responsive processing/styles
```

Astro docs указывают, что при layout Astro генерирует `srcset`/`sizes` и responsive styles; можно включить `image.responsiveStyles: true` для глобальных стилей.

---

## 3. Рекомендации для проекта

### Article cover

```astro
<Picture
  src={cover}
  alt={coverAlt}
  formats={['avif', 'webp']}
  fallbackFormat="jpg"
  layout="constrained"
/>
```

### Hero full width

```astro
<Picture
  src={hero}
  alt={heroAlt}
  formats={['avif', 'webp']}
  fallbackFormat="jpg"
  layout="full-width"
  loading="eager"
  fetchpriority="high"
/>
```

### Icons/logos

```astro
<Image src={logo} alt="..." layout="fixed" />
```

---

## 4. LCP caution

Не ставить `fetchpriority="high"` всем картинкам. Только реальный LCP image.

---

## 5. Old public images

Для существующих `/images/*.webp` Astro optimization не применяется автоматически, если использовать plain `<img>`.

Стратегия:

```text
Фаза 1: оставить как есть.
Фаза 2: новые images через Astro assets.
Фаза 3: мигрировать ключевые старые hero/OG images.
```

---

## 6. Итог

Обновить `IMAGE_PIPELINE_2026.md` при практической реализации:

```text
responsive → constrained/full-width terminology.
```
