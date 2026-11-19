# Интеграционный пакет содействия для Главного Интегратора (Agent 8 / PR #2338)

**Дата:** 19 ноября 2026 г.  
**Адресат:** Agent 8 (`arena/7f634191-gb-is-my-strength`, HEAD `dedbcdaba`) & Интегратор PR [#2338](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2338)  
**Отправитель:** Agent 5 (`arena/06dc1485-gb-is-my-strength`, PR [#2342](https://github.com/FedorMilovanov/gb-is-my-strength/pull/2342))  
**Статус CI:** ✅ All Checks Passing (4/4 jobs PASS на коммите `b9d6f4b70`)

---

## 1. Контекст и статус

В соответствии с решением владельца проекта (**OWNER FINAL VISUAL DECISION**, комментарии `#7003938517` и `#7004283098`) визуальная система и архитектура **Agent 8** выбраны как единственная основа для канонической интеграции в PR #2338.

Данный документ передаёт проверенные, изолированные решения и точные патчи для ускорения сборки канонического SHA ветки PR #2338.

---

## 2. Готовые проверенные патчи для интеграции в версию Agent 8

### 2.1. SEO-контракт: `JournalDocumentHead.astro` (Синтез с PR #2345)
В текущей версии Agent 8 (`dedbcdaba`) теги `article:published_time` и `article:modified_time` выводятся безусловно, в том числе для страниц каталога `CollectionPage` (`/journal/`). Кроме того, отсутствуют обязательные атрибуты `og:image:alt` и `twitter:image:alt`, требуемые валидатором `scripts/lib/seo-route-contract.js`.

**Рекомендуемый патч для `src/components/journal/JournalDocumentHead.astro`:**

```astro
---
import ReaderPreferencesHead from '@/components/reader-platform/ReaderPreferencesHead.astro';
import JournalFontPreloads from './JournalFontPreloads.astro';

interface Props {
  title: string;
  description: string;
  canonical: string;
  kind: 'CollectionPage' | 'Article';
  publishedAt: string;
  modifiedAt: string;
  readingTime?: number;
  socialImage: string;
  socialImageAlt: string;
}

const {
  title,
  description,
  canonical,
  kind,
  publishedAt,
  modifiedAt,
  readingTime,
  socialImage,
  socialImageAlt,
} = Astro.props as Props;

const siteTitle = `${title} | Господь Бог — Сила Моя`;
const icon = 'https://gospod-bog.ru/icons/icon-512.png';
const schemaType = kind;
const hasReadingTime = Number.isInteger(readingTime) && Number(readingTime) > 0;
---
<meta charset="utf-8">
<link rel="preconnect" href="https://mc.yandex.ru" crossorigin>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com; img-src 'self' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com wss://mc.yandex.ru wss://*.yandex.ru wss://mc.yandex.com wss://*.yandex.com; frame-src 'self' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self';">
<ReaderPreferencesHead />
<JournalFontPreloads />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content">
<meta name="theme-color" content="#fdfcf9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#171411" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<title>{siteTitle}</title>
<meta name="description" content={description}>
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
<meta name="author" content="Фёдор Милованов">
{kind === 'Article' && <meta name="editor" content="Фёдор Милованов" />}
<link rel="canonical" href={canonical}>
<link rel="icon" href="/favicon.ico" type="image/x-icon">
<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
<link rel="manifest" href="/manifest.json">
<meta property="og:type" content={kind === 'Article' ? 'article' : 'website'}>
<meta property="og:title" content={title}>
<meta property="og:description" content={description}>
<meta property="og:url" content={canonical}>
<meta property="og:site_name" content="Господь Бог — Сила Моя">
<meta property="og:locale" content="ru_RU">
<meta property="og:image" content={socialImage}>
<meta property="og:image:alt" content={socialImageAlt}>
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/webp">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@FedorMilovanov">
<meta name="twitter:creator" content="@FedorMilovanov">
<meta name="twitter:title" content={title}>
<meta name="twitter:description" content={description}>
<meta name="twitter:image" content={socialImage}>
<meta name="twitter:image:alt" content={socialImageAlt}>
{kind === 'Article' && <meta property="article:published_time" content={publishedAt} />}
{kind === 'Article' && <meta property="article:modified_time" content={modifiedAt} />}
```

---

### 2.2. Финансовый дисклеймер Form 990 (Исключение аддитивной путаницы)
В блоке `#finance` статьи G3 суммы `+$817 283` (конференции) и `+$246 511` (реклама) суммарно составляют 99% от `+$1 061 800` (общее увеличение). Читатели могут ошибочно предположить, что статьи складываются поверх общего роста.

Патч добавляет редакционное пояснение в `src/components/journal/journalEditorial.css`:

```css
.journal-edition .je-finance-disclaimer {
  font-size: 13px;
  line-height: 1.5;
  color: var(--je-muted);
  background: var(--je-surface);
  border: 1px solid var(--je-rule);
  border-left: 3px solid var(--je-gold);
  border-radius: 4px;
  padding: 10px 14px;
  margin: 14px 0 20px;
}
```

И абзац в `src/components/journal/G3Dossier.astro`:
```astro
<p class="je-finance-disclaimer">
  <strong>Справка к суммам:</strong> статьи конференций (+${formatNumber(financeDeltas[1].value)}) и рекламы (+${formatNumber(financeDeltas[2].value)}) составляют 99% общего прироста расходов и входят в состав итоговой суммы +${formatNumber(financeDeltas[0].value)} (не складываются поверх неё).
</p>
```

---

### 2.3. Семантический fallback для `JournalSourceReturn.astro`
В текущей версии Agent 8 все 21 источник при отсутствии активного клика по цитате возвращают читателя на общий `#documents` («К методике проверки»). Читатель, перешедший в библиографию по прямой ссылке, теряет контекст первоначальной темы (например, финансовой или кадровой).

Предлагается словарь соответствия первичным разделам:

```typescript
const SOURCE_SECTION_MAP: Record<string, { href: string; label: string }> = {
  'G3-S001': { href: '#timeline', label: 'К разделу «Хронология»' },
  'G3-S002': { href: '#finance', label: 'К разделу «Финансы»' },
  'G3-S008': { href: '#buice', label: 'К разделу «Джош Бьюс»' },
  'G3-S009': { href: '#buice', label: 'К разделу «Джош Бьюс»' },
  'G3-S010': { href: '#buice', label: 'К разделу «Джош Бьюс»' },
  'G3-S011': { href: '#wind-down', label: 'К разделу «Завершение»' },
  'G3-S012': { href: '#buck', label: 'К разделу «Том Бак»' },
  'G3-S015': { href: '#buck', label: 'К разделу «Том Бак»' },
  'G3-S017': { href: '#wind-down', label: 'К разделу «Завершение»' },
  'G3-S023': { href: '#buice', label: 'К разделу «Джош Бьюс»' },
  'G3-S024': { href: '#buice', label: 'К разделу «Джош Бьюс»' },
  'G3-S028': { href: '#finance', label: 'К разделу «Финансы»' },
  'G3-S033': { href: '#wind-down', label: 'К разделу «Завершение»' },
  'G3-S035': { href: '#buck', label: 'К разделу «Том Бак»' },
  'G3-S042': { href: '#buck', label: 'К разделу «Том Бак»' },
  'G3-S046': { href: '#governance', label: 'К разделу «Управление»' },
  'G3-S047': { href: '#governance', label: 'К разделу «Управление»' },
  'G3-S050': { href: '#wind-down', label: 'К разделу «Завершение»' },
  'G3-S053': { href: '#wind-down', label: 'К разделу «Завершение»' },
  'G3-S054': { href: '#wind-down', label: 'К разделу «Завершение»' },
  'G3-S096': { href: '#governance', label: 'К разделу «Управление»' },
};
```

В библиографии:
```astro
{G3_SOURCE_BIBLIOGRAPHY.map((entry) => {
  const target = SOURCE_SECTION_MAP[entry.id] || { href: '#documents', label: 'К методике проверки' };
  return (
    <li id={`src-${entry.id}`} class="bibliography-item" ...>
      ...
      <JournalSourceReturn href={target.href} label={target.label} />
    </li>
  );
})}
```

---

### 2.4. Безопасность отображения кнопки темы в `JournalMasthead.astro`
В коде Agent 8 инициализация кнопки темы выполнена в `<script>` верхнего уровня:
```ts
const preferences = journalWindow.GBReaderPreferences;
```
Если скрипт выполняется до того, как `js/reader-preferences.js` (подключённый с `defer`) установил `window.GBReaderPreferences`, кнопка темы остаётся `hidden = true`.

**Рекомендуемый фикс:**
```ts
function initThemeButton() {
  const preferences = journalWindow.GBReaderPreferences;
  const button = document.querySelector<HTMLButtonElement>('[data-journal-theme]');
  if (preferences && button && !button.dataset.journalThemeBound) {
    button.dataset.journalThemeBound = 'true';
    const sync = () => button.setAttribute('aria-pressed', String(preferences.get().theme === 'dark'));
    button.addEventListener('click', () => {
      preferences.setTheme(preferences.get().theme === 'dark' ? 'light' : 'dark', { source: 'journal-masthead' });
    });
    preferences.subscribe(sync);
    sync();
    button.hidden = false;
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThemeButton, { once: true });
} else {
  initThemeButton();
}
```

---

### 2.5. Устранение горизонтального скролла на 320px
На малых мобильных экранах (iPhone SE, 320px) элементы сеток и контейнеров могут вызывать горизонтальный сдвиг в 12–16px.

Добавление в `src/components/journal/journalEditorial.css`:
```css
.journal-edition {
  overflow-x: clip; /* clip предотвращает горизонтальный скролл страницы, сохраняя position: sticky */
}

@media (max-width: 690px) {
  .journal-edition .je-pipeline-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## 3. Интеграционная матрица для Cherry-pick

| Коммит / Патч | Файлы | Назначение |
|---|---|---|
| `4efc03240` | `JournalDocumentHead.astro` | Обязательные `publishedAt`/`modifiedAt`/`kind` |
| `6c75b5141` | `JournalDocumentHead.astro` | Подавление `article:published_time` на `CollectionPage` |
| `b9d6f4b70` | `G3Dossier.astro`, `journalEditorial.css` | Дисклеймер Form 990, `:target` подсветка, 320px clip |

---

## 4. Поддержка Live Preview
Сервер предпросмотра на `0.0.0.0:4321` настроен с автоматическим перенаправлением на `/journal/dossiers/g3/` и двухуровневым резолвером статических ассетов, гарантируя 100% отображение стилей и шрифтов при любых проверках.
