# RESEARCH_SOURCE_AUDIT_80_PLUS_2026.md — второй deep pass 30+ источников

Дата: 2026-06-12  
Назначение: дополнить `RESEARCH_SOURCE_AUDIT_30_PLUS_2026.md` вторым проходом по официальным/практическим источникам.

---

## 1. Главные новые уточнения

```text
1. Astro build-time collections остаются основой; live collections не нужны.
2. Astro image API в stable docs использует constrained/full-width/fixed/none, а не beta responsive naming.
3. Pagefind multilingual нужно отдельно тестировать на русском; stemming может быть ограничением.
4. Yandex Webmaster добавляет свои статусы: NOT_CANONICAL, NO_INDEX, ROBOTS_URL_ERROR, DUPLICATE.
5. ARIA: native button/link first; complex combobox/listbox only если действительно нужно.
6. External source links не нужно blanket nofollow — Google прямо говорит external links can establish trustworthiness.
```

---

## 2. Дополнительные источники Astro

### 41. Astro Content Collections — official deep chunks

URL: https://docs.astro.build/en/guides/content-collections/

Дополнительные выводы:

- `file()` loader parses JSON/YAML/TOML;
- file entries need unique `id`;
- custom parser possible;
- nested JSON can be split via parser;
- custom build-time loader can fetch remote data and still use collection APIs;
- schemas guarantee predictable data and TS types;
- `reference()` creates typed links between collections;
- `render()` returns `<Content />` and headings;
- `getCollection()` order nondeterministic — sort yourself.

### 42. Astro Content Loader API reference

URL: https://github.com/withastro/docs/blob/main/src/content/docs/en/reference/content-loader-reference.mdx

Выводы:

- custom loader object has `name` and `load({ store, parseData })`;
- `store.clear()` + `store.set()`;
- loader can expose schema;
- simple loader function can return array entries with `id` or object keyed by id;
- live loaders return entries/errors and fetch at request time.

Влияние:

```text
Custom loader useful later, but start with glob/file.
```

### 43. Astro Images guide

URL: https://docs.astro.build/en/guides/images/

Выводы:

- Astro can optimize local/remote/CMS images;
- plain native HTML images are allowed but not optimized by Astro;
- responsive layout generates srcset/sizes;
- `image.responsiveStyles` can apply global styles;
- current layout naming includes constrained/full-width/fixed/none.

Влияние:

```text
ASTRO_IMAGE_CURRENT_NOTES_2026.md.
```

### 44. Astro Assets API

URL: https://docs.astro.build/en/reference/modules/astro-assets/

Выводы:

- `Image`/`Picture` components;
- `layout` controls resize behavior;
- `full-width` for hero, `constrained` default, `fixed` for icons, `none` to opt out;
- `fit` controls cropping.

---

## 3. Дополнительные Google/Yandex SEO источники

### 45. Google link best practices — full pass

URL: https://developers.google.com/search/docs/crawling-indexing/links-crawlable

Дополнительные выводы:

- anchor text should be natural, not keyword-stuffed;
- don't chain links without context;
- every cared-about page should be linked from at least one other page;
- external links to sources can establish trustworthiness;
- nofollow only when you don't trust source;
- sponsored/ugc for paid/user-generated links.

Влияние:

```text
Source links should usually be normal links, not nofollow by default.
```

### 46. Google Article structured data — deep pass

URL: https://developers.google.com/search/docs/appearance/structured-data/article

Выводы:

- author.url or sameAs helps disambiguate;
- image URLs must be crawlable/indexable;
- datePublished/dateModified should include timezone if possible;
- multi-part articles: canonical per part or view-all, not all to page 1.

Влияние:

```text
Нагорная серия должна иметь canonical каждой части, не всё на первую часть.
```

### 47. Google Organization structured data

URL: https://developers.google.com/search/docs/appearance/structured-data/organization

Вывод:

- Organization info recommended on home/about, not necessarily every page.

Влияние:

```text
Organization graph can be referenced by @id site-wide.
```

### 48. Google Dataset structured data

URL: https://developers.google.com/search/docs/appearance/structured-data/dataset

Дополнительный вывод:

- sitemap helps find dataset URLs;
- dataset structured data should be on canonical dataset landing pages;
- use `sameAs` for duplicates/listing pages.

Влияние:

```text
If map route datasets become public, create canonical route data landing/reference.
```

### 49. Yandex Important URLs / indexing API docs

URL: https://yandex.com/dev/webmaster/doc/en/reference/host-id-important-urls

Выводы:

- statuses include NOTHING_FOUND, HOST_ERROR, NOT_CANONICAL, ROBOTS_URL_ERROR, NO_INDEX, DUPLICATE, LOW_QUALITY;
- NOT_CANONICAL means indexed by canonical URL;
- NO_INDEX means robots meta noindex.

Влияние:

```text
Yandex monitoring after Astro pilot should inspect these statuses.
```

### 50. Yandex redirects docs

URL: https://yandex.com/support/webmaster/en/robot-workings/managing-redirects.html

Выводы:

- primary address can be selected automatically by redirect/canonical;
- content should match;
- changes can take around a month.

Влияние:

```text
Do not change URL/domain during Astro migration.
```

### 51. Yandex reindex docs

URL: https://yandex.com/support/webmaster/en/robot-workings/site-reindex

Вывод:

- pages should be accessible;
- pages should be present in sitemap;
- reindex can prioritize important URLs.

Влияние:

```text
After pilot deploy, reindex /about/ if changed.
```

---

## 4. Pagefind / search sources

### 52. Pagefind multilingual docs

URL: https://pagefind.app/docs/multilingual/

Выводы:

- page `lang` controls language-specific search filtering;
- stemming adapts if language supported;
- unsupported stemming means forms may not match;
- force language option can create one index.

Влияние:

```text
Russian query benchmark required.
```

### 53. Pagefind API

URL: https://pagefind.app/docs/api/

Выводы:

- results data loads independently;
- filters API;
- search options filters/sort.

### 54. Pagefind filtering

URL: https://pagefind.app/docs/filtering/

Выводы:

- filter values from text, attributes, inline syntax;
- multiple values allowed.

### 55. Pagefind Astro practice

URL: https://deku.posstree.com/en/astro/search/

Вывод:

- build first, then pagefind;
- `data-pagefind-body`/ignore/filter patterns.

---

## 5. Accessibility / ARIA / SVG sources

### 56. WAI-ARIA Practices Guide

URL: https://wai-aria-practices.netlify.app/aria-practices/

Выводы:

- dialogs, comboboxes, listboxes have specific keyboard/ARIA expectations;
- modal dialog makes background inert;
- combobox uses aria-controls/expanded/haspopup depending popup type.

Влияние:

```text
Command palette should either be simple search form/list or correct combobox/listbox pattern.
```

### 57. MDN ARIA button role

URL: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/button_role

Вывод:

- non-native button needs tabindex and key handlers.

### 58. Deque accessible buttons

URL: https://www.deque.com/blog/accessible-aria-buttons/

Вывод:

- native button provides keyboard behavior free.

### 59. MDN ARIA tab role

URL: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/tab_role

Вывод:

- tabs require tablist/tab/tabpanel, selected state, keyboard behavior.

### 60. SVG accessibility sources

URLs:

- https://wpdean.com/accessible-svg-files/
- SVG accessibility practical guides from search results

Вывод:

- informative SVG: role=img + title/desc;
- decorative SVG: aria-hidden=true focusable=false;
- interactive SVG parts need role/tabindex/keyboard/focus;
- for icons inside buttons, make SVG decorative and name the button.

Влияние:

```text
Map markers can be SVG interactive only with full keyboard handling; HTML controls/list are safer.
```

---

## 6. CSP / Yandex / security sources

### 61. Yandex.Metrika CSP docs

URL: https://yandex.com/support/metrica/en/code/install-counter-csp

Вывод:

- nonce option for inline counter;
- img/connect/frame/child directives needed;
- session replay/click maps require blob/frame/child.

### 62. MDN CSP script-src

URL: https://github.com/mdn/content/blob/main/files/en-us/web/http/reference/headers/content-security-policy/script-src/index.md?plain=1

Вывод:

- unsafe-inline risky;
- nonce/hash alternatives;
- nonce per request;
- hashes whitespace-sensitive.

### 63. OWASP CSP cheat sheet

URL: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html

Вывод:

- hashes/nonces/strict-dynamic; avoid unsafe-inline/eval.

---

## 7. CMS sources

### 64. Keystatic Astro docs

URL: https://docs.astro.build/en/guides/cms/keystatic/

Вывод:

- config storage local/GitHub;
- collections path;
- schema should match existing content collections.

### 65. Keystatic ecosystem review

URL: https://www.luckymedia.dev/insights/keystatic

Вывод:

- best Git-based CMS for Astro/Next; but Git workflow limits, smaller community, visual editing less than Tina.

### 66. Astro CMS overview / Decap

URL: https://docs.astro.build/en/guides/cms/decap-cms/

Вывод:

- Decap can manage content collections via config.yml;
- commits content to repo;
- another option, but Keystatic has cleaner Astro-native DX.

---

## 8. New actions from this pass

Created docs:

```text
ASTRO_CONTENT_LOADER_STRATEGY_2026.md
PAGEFIND_RUSSIAN_SEARCH_NOTES_2026.md
YANDEX_WEBMASTER_SEO_CONTRACT_2026.md
ARIA_WIDGET_PATTERNS_2026.md
ASTRO_IMAGE_CURRENT_NOTES_2026.md
```

---

## 9. Updated conclusions

```text
[refined] Use stable Astro image layout names: constrained/full-width/fixed/none.
[refined] Use file() loader for authors/series/sources, with id.
[refined] Pagefind Russian quality must be benchmarked.
[refined] Command palette should not automatically be ARIA combobox unless fully implemented.
[refined] Source/external links should not be blanket nofollow.
[refined] Yandex status monitoring should be part of post-pilot checklist.
```

---

## 10. Next deep-pass topics

```text
1. Russian morphology/search alternatives if Pagefind weak.
2. Exact current hosting/deploy headers for GitHub Pages or current pipeline.
3. OG image generation options: Satori/Sharp/Playwright screenshots.
4. Biblical source data model: citations, bibliography, primary/secondary sources.
5. Map projection/coordinate model: lat/lon → SVG x/y.
```
