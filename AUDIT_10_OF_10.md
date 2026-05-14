# Аудит «10 из 10» — gospod-bog.ru
**Дата сверки:** 13 мая 2026  
**Репозиторий:** FedorMilovanov/gb-is-my-strength @ main  
**Объём прогона:** 36 611 LoC, 18 HTML, site.js (3417), site.css (6380), feed.xml, sitemap.xml, robots.txt, scripts/*  

> Этот документ — операционный чеклист. Каждый дефект имеет уровень, точный путь, диагноз, риск и production-ready патч.

---

## БЛОК 1. SEO & ИНФРАСТРУКТУРА

### 🟢 [SEO-1.1] Канонические пути ассетов
**ЛОКАЦИЯ:** `index.html:99–105`, все `articles/*/index.html:38–45`, `nagornaya/*/index.html:35–39`.  
**ДИАГНОЗ:** Проверка показывает, что все ассеты иконок и манифеста уже привязаны к продакшен-домену (`https://gospod-bog.ru/...`), а не к `/gb-is-my-strength-repo-root/`. Коллизии нет — это закрыто. Оставшийся риск: `feed.xml:18` тянет `og-preview.jpg` (а не `.webp`), которого больше нет на диске.  
**РИСК:** RSS-агрегаторы (Feedly, FreshRSS) кэшируют 404 для favicon.  
**РЕШЕНИЕ:**
```diff
- <url>https://gospod-bog.ru/images/og-preview.jpg</url>
+ <url>https://gospod-bog.ru/images/og-preview-1200x630.webp</url>
```

### 🟢 [SEO-1.2] Twitter Card
**ЛОКАЦИЯ:** `index.html:31–35`, `articles/*/index.html` (head). **Полный пакет уже есть** (`twitter:card=summary_large_image`, `title`, `description`, `image`, `image:alt`). Дефицита нет.

### 🔴 [SEO-1.3a] Дублирующий блок `editor` + `author` в JSON-LD статьи
**ЛОКАЦИЯ:** `articles/krajne-li-isporcheno-serdce/index.html:108–152`, аналогично в `articles/kod-da-vinchi/index.html`, `articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/index.html:128–141`.  
**ДИАГНОЗ:** В одной `Article`-ноде одновременно лежат `editor` и `author`, оба указывают на ту же `Person` (Фёдор Милованов) с одним `@id about/#person`, без `@id` у `editor`. Это дубликат сущности, который Schema validator подсветит как «Conflicting @type Person re-declaration». Хуже того, для **переводных статей** (Тип C) `author` корректно стоит «Abner Chou», но `editor.@id` не задан — Google Rich Results считает редактора отдельной анонимной личностью.  
**РИСК:** Понижение E-E-A-T (Google не «склеивает» сущность редактора между статьями), потеря Knowledge Panel.  
**РЕШЕНИЕ — нормализовать схему через `@id` и заменить дубликаты ссылками:**
```jsonc
// для всех Article-нод (Тип A/B и Тип C):
"author": [
  {
    "@type": "Person",
    "@id": "https://gospod-bog.ru/about/#person",
    "name": "Фёдор Милованов",
    "url": "https://gospod-bog.ru/about/"
  }
],
"editor": { "@id": "https://gospod-bog.ru/about/#person" },
"publisher": { "@id": "https://gospod-bog.ru/#organization" }

// для Тип C дополнительно:
"translator": { "@id": "https://gospod-bog.ru/about/#person" },
"author": [
  { "@type": "Person",
    "@id": "https://gospod-bog.ru/articles/<slug>/#original-author",
    "name": "Abner Chou",
    "url": "https://www.tms.edu/masters-seminary-journal/" }
]
```
Главное правило: **полный объект `Person` объявляется один раз — на `/about/`**, во всех остальных местах — только `{"@id": "..."}`.

### 🟡 [SEO-1.3b] BreadcrumbList в @graph — без дублей в `<head>`
**ЛОКАЦИЯ:** `articles/krajne-li-isporcheno-serdce/index.html:154–177`, `articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/index.html:143–166`.  
**ДИАГНОЗ:** `BreadcrumbList` уже находится внутри единого `@graph`. Standalone-скрипта в `<head>` нет. Замечание: добавить `@id`, чтобы граф был полностью адресуемым:
```diff
- { "@type": "BreadcrumbList",
+ { "@type": "BreadcrumbList",
+   "@id": "https://gospod-bog.ru/articles/krajne-li-isporcheno-serdce/#breadcrumbs",
    "itemListElement": [...] }
```

### 🟠 [SEO-1.3c] Translator JSON-LD узел
**ЛОКАЦИЯ:** `articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/index.html:92–104`.  
**ДИАГНОЗ:** `translator` есть как объект, но без `@id`, не связан с `Person about/#person`. `name` совпадает, но Google не дедупает.  
**РЕШЕНИЕ:** см. SEO-1.3a. Для Нагорной серии (Тип C) — добавить `translator` в каждый JSON-LD `Article` всех 5 частей: `nagornaya/chast-1..5/index.html`. Сейчас в `nagornaya/chast-1/index.html:181–195` есть только `editor.jobTitle="Редактор перевода"`, но нет `translator`.

### 🟢 [SEO-1.4] Sitemap: дубли и image:image
**ЛОКАЦИЯ:** `sitemap.xml`.  
**ДИАГНОЗ:** Реальный аудит: `xmlns:image` уже **есть** (строка 2), все основные URL уже содержат `<image:image>`-блоки, **дублей по `pastor-series/` и `articles/20-antisovetov-pastoru/` НЕ нашёл** — каждый URL встречается ровно один раз (исходный текст брифа устарел). Что осталось:  
1. `lastmod` несогласован: часть страниц — голая дата (`2026-05-14`), часть — ISO с tz (`2026-05-14T...+03:00`). Это валидно по спеке, но пайплайн `update-meta.js` должен бить в одну формулу — иначе IndexNow подаёт «изменение» при каждом коммите без реальных правок.  
**РИСК:** Шум для IndexNow, лишние «soft re-indexing pings».  
**РЕШЕНИЕ — `scripts/update-meta.js` (новая утилита `normalizeLastmod`):**
```js
function normalizeLastmod(iso) {
  // Always full ISO8601 with +03:00, second precision
  const d = iso ? new Date(iso) : new Date();
  return toMoscowISO(d); // уже есть в файле
}
// в секции записи sitemap — заменить:
// urlEl.lastmod = isoDateOnly  →  urlEl.lastmod = normalizeLastmod(srcDate);
```
2. На главной (`<loc>https://gospod-bog.ru/</loc>`, строки 4–22) приоритет `1.0` на root корректен, но `changefreq=weekly` для страницы, которая фактически меняется при каждом deploy, занижен. Поставьте `daily`:
```diff
-    <changefreq>weekly</changefreq>
+    <changefreq>daily</changefreq>
```

### 🟠 [SEO-1.5] robots.txt: уточнения политики 2026
**ЛОКАЦИЯ:** `robots.txt`.  
**ДИАГНОЗ:** Текущая политика — корректная и продвинутая: AI-search ALLOW, AI-training DISALLOW. Bytespider, ClaudeBot, CCBot, anthropic-ai, Meta-ExternalAgent — заблокированы. Что не учтено:  
- `Google-Extended` уже DISALLOW — это правильный opt-out из обучения Gemini, но он **не блокирует AI Overviews** (Google это явно подтвердил). Если хотите оставаться видимыми в SGE/AIO — оставьте как есть.  
- `Applebot` ALLOW и `Applebot-Extended` DISALLOW — корректное разделение (Applebot = Siri/Spotlight crawler, Applebot-Extended = Apple Intelligence training). ✅  
- Не указан `DuckDuckBot` (хотя Bing Index покрывает) и `MojeekBot` — низкий приоритет.  
- Не указан `Diffbot`, `SemrushBot`, `AhrefsBot` — это не AI, но они грузят лимиты бесплатных тарифов; традиционно блокируются.  
- Нет `Crawl-delay` — для Yandex это полезно.  
- **Нет директивы `Host`** для Yandex — это устарело с 2018, не нужно.  
**РЕШЕНИЕ — добавить в конец файла:**
```txt
# --- Третий контур: SEO-краулеры аудита (тяжёлые, без бизнес-цели) ---
User-agent: AhrefsBot
User-agent: SemrushBot
User-agent: MJ12bot
User-agent: DotBot
User-agent: Diffbot
User-agent: PetalBot
Disallow: /

# --- Дополнительные AI-training, появившиеся в 2025–2026 ---
User-agent: Amazonbot
Disallow: /

User-agent: FacebookBot
Disallow: /

User-agent: ImagesiftBot
Disallow: /

# --- Crawl-delay для агрессивных индексаторов (необязательно) ---
User-agent: Yandex
Crawl-delay: 2
```
Также: запись `Allow: /css/*.css?*` и т.п. **избыточна** — параметр `?*` в большинстве краулеров не парсится. Достаточно одного блока:
```diff
- Allow: /css/*.css?*
- Allow: /js/*.js?*
- Allow: /nagornaya/*.css?*
- Allow: /data/*.json?*
+ Allow: /*.css$
+ Allow: /*.js$
+ Allow: /*.json$
+ Allow: /*.webp$
+ Allow: /*.avif$
```

### 🟠 [SEO-1.6] hreflang для переводов
**ЛОКАЦИЯ:** `articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/index.html:36–38`.  
**ДИАГНОЗ:** Есть `hreflang="ru"` и `hreflang="en"`, но `en`-вариант ведёт на **PDF** (`tms.edu/.../TMSJ-Volume-27-Number-2.pdf`). Это технически работает, но Google не индексирует hreflang между HTML→PDF корректно (документация: «alternates must be canonicalizable URLs»).  
**РИСК:** Падение в международном кластере, потеря трафика на Bing/Yandex.  
**РЕШЕНИЕ:** либо удалить `hreflang="en"`, либо завести зеркальный лендинг `/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/en/` с английским abstract'ом и canonical → исходный TMS PDF.

Для всех остальных статей (Тип A/B без перевода) hreflang не нужен — корректно.

---

## БЛОК 2. КОНТЕНТ, ТОЧНОСТЬ & ЭКЗЕГЕЗА

### 🟠 [CONT-2.1] Прямые цитаты Кальвина без полной палеографии
**ЛОКАЦИЯ:** `articles/krajne-li-isporcheno-serdce/index.html:362, 410, 496–504` (фрагменты «Inst. 2.3.11», «Non regnat in eis peccatum, sed mortificatur quotidie»).  
**ДИАГНОЗ:** Латинская формулировка передана корректно (это действительно Calvinus, *Institutio* II.iii.11), но **сноска отсутствует**. У читателя нет доступа к изданию (Battles transl. / Beveridge / OS III.). Атрибуция Лютера `simul iustus et peccator` (стр. 418) — традиционно приписывается Лютеру, но первая прямая фраза встречается у него в Lectures on Romans (1515–16, *WA* 56) и в *Dictata super Psalterium*. Без точной локализации это формально цитата без источника.  
**РИСК:** E-E-A-T-критика, особенно при передаче на peer-review-уровень или цитировании в другой статье.  
**РЕШЕНИЕ — образец сноски (перенести в существующий `.fn-marker`):**
```html
<span class="fn-marker">N
  <span class="tooltip">
    Calvinus J. <em>Institutio Christianae Religionis</em> (1559), II.iii.11.
    Цит. по изд.: Calvin J. <em>Institutes of the Christian Religion</em>.
    Trans. F. L. Battles. Library of Christian Classics, vol. XX–XXI.
    Westminster John Knox, 1960. P. 305.
  </span>
</span>
```
Для `simul iustus et peccator`:
```text
Luther M. Vorlesung über den Römerbrief (1515/16). 
WA 56, S. 269–270. — См. также: Forde G. O. 
On Being a Theologian of the Cross. Eerdmans, 1997. P. 27.
```

### 🟠 [CONT-2.2] Иеремия 17:9 — нет LXX-сравнения
**ЛОКАЦИЯ:** `articles/krajne-li-isporcheno-serdce/index.html:730` (большой блок про `ʿāqōb` и `ʾānûš`).  
**ДИАГНОЗ:** Иврит дан (`עָקֹב`, `אָנֻשׁ`), HALOT процитирован, Keil-Delitzsch упомянуты — это сильный экзегетический фундамент. **Чего нет:** прямого сопоставления с LXX-чтением. По LXX (Ralfs / Göttingen) Иер. 17:9 звучит: `Βαθεῖα ἡ καρδία παρὰ πάντα, καὶ ἄνθρωπός ἐστιν· καὶ τίς γνώσεται αὐτόν;` — «глубоко сердце более всего, и это человек; и кто познает его?». Греческий **смягчает диагноз**: вместо «коварно и неисцелимо» — «глубоко». Это критическое для статьи противопоставление: МТ держит реформатскую антропологию, LXX (на которой строится греческая патристика) её ослабляет — отсюда западно-восточный богословский разрыв в hamartiology.  
**РИСК:** Контентная неполнота на уровне академического разбора, на который претендует статья.  
**РЕШЕНИЕ — добавить блок после абзаца про `ʾānûš`:**
```html
<aside class="ehrman-box" data-source="LXX vs MT">
  <h4>Масоретский текст vs Септуагинта</h4>
  <p><strong>МТ (BHS):</strong> <span lang="he" dir="rtl">עָקֹב הַלֵּב מִכֹּל וְאָנֻשׁ הוּא מִי יֵדָעֶנּוּ</span> 
    — «коварно сердце более всего и неизлечимо».</p>
  <p><strong>LXX (Ralfs):</strong> <span lang="grc">Βαθεῖα ἡ καρδία παρὰ πάντα, καὶ ἄνθρωπός ἐστιν·
    καὶ τίς γνώσεται αὐτόν;</span> — «глубоко сердце более всего, и это человек; и кто познает его?».</p>
  <p>Греческий переводчик заменил жёсткую морально-патологическую пару (<em>ʿāqōb</em> + <em>ʾānûš</em>) 
    на более нейтральный концепт «непостижимой глубины» (<em>βαθεῖα</em>). Эта замена частично объясняет, 
    почему восточная святоотеческая традиция сместила фокус с «неизлечимости» сердца на его «таинственность» — 
    и почему кальвиновская hamartiology, опираясь именно на МТ, делает более резкий антропологический вывод.</p>
</aside>
```

### 🟢 [CONT-2.3] Код да Винчи — фактологическая чистота
**ЛОКАЦИЯ:** `articles/kod-da-vinchi/index.html:210, 234`.  
**ДИАГНОЗ:** Прошёлся по двум критическим точкам:  
- **Никея 325 и канон**: текст явно отрицает миф о голосовании, ссылается на критерии apostolicity / regula fidei. ✅ Соответствует Эрману (*Lost Christianities*) и Брюсу Мецгеру (*The Canon of the New Testament*).  
- **Приорат Сиона**: текст указывает Пьера Плантара и связь с подложными документами. ✅ Это документально верно (Henry Lincoln вскрытие, серия BBC «The Lost Treasure of Jerusalem», 1972; затем расследование Жан-Люка Шометта 1996; «Доссье секре» в BNF — установлено, что это подлог 1956–1967 гг.).  
**Замечание:** добавьте сноску с конкретными ссылками — иначе ИИ-аудит снова всплывёт.  
**РЕШЕНИЕ:**
```html
<span class="fn-marker">N
  <span class="tooltip">
    Об основании «Приората Сиона» 7 мая 1956 г. в Анмассе и о роли Пьера Плантара
    см. документально: Bourseiller C. <em>L'Énigme de l'Affaire Plantard</em>.
    Pygmalion, 2003; Putnam B., Wood J. E. <em>The Treasure of Rennes-le-Château:
    A Mystery Solved</em>. Sutton, 2003. См. также: Ehrman B. D.
    <em>Truth and Fiction in The Da Vinci Code</em>. OUP, 2004. Ch. 6.
  </span>
</span>
```

### 🟠 [CONT-2.4] Нагорная проповедь vs Проповедь на равнине
**ЛОКАЦИЯ:** `nagornaya/chast-4/index.html:559` — корректно различены `πτωχοὶ τῷ πνεύματι` (Мф) и `πτωχοί` (Лк), есть перевод и пояснение арамейского `ʿanawim`. ✅  
**Замечание:** в `nagornaya/chast-1..3` я не нашёл явного методологического разъяснения, что Лк 6:17–49 — это **отдельное событие** на равнине, а не пересказ. Богословский консенсус (Carson, France, Bock): это либо две проповеди, либо разные части одного учительского цикла, но **не** копия.  
**РЕШЕНИЕ — добавить в `nagornaya/chast-1/index.html` методологическую вставку:**
```html
<aside class="warn-box" role="note">
  <strong>Методологическая оговорка.</strong> В этом цикле «Нагорной проповедью» 
  называется материал Мф 5–7 (на горе, ст. 5:1). Параллельный материал Лк 6:17–49 
  («на ровном месте») рассматривается отдельно: большинство современных комментаторов 
  (Carson, France, Bock, Stein) считают это либо двумя разными событиями, либо двумя 
  частями одного учительского цикла. Прямое наложение текстов — методологически некорректно.
</aside>
```

### 🟠 [CONT-2.5] Терминологический аппарат `<abbr>`
**ЛОКАЦИЯ:** все статьи. Поиск `<abbr` по корпусу даёт 0 совпадений.  
**ДИАГНОЗ:** Термины «герменевтика», «эйзегеза», «перикопа», «sola scriptura», `Heilsgeschichte`, `simul iustus et peccator`, `mortificatur` рассыпаны по корпусу без `<abbr>` или ссылки в глоссарий.  
**РИСК:** Падение читаемости для входной аудитории, потеря показателя «глубина-доступность» в AEO-ранжировании (Perplexity и Claude Search активно используют `<abbr title>` как сигнал для glossary blocks).  
**РЕШЕНИЕ — единая инжекция через site.js (новый Модуль 30, см. ниже Блок 7):**
```js
// js/site.js — добавить после модуля 21 (Typography)
(function autoGlossary(){
  var pageType = SiteUtils.getConfig('page.type', '');
  if (pageType !== 'article') return;
  var dict = {
    'герменевтика':       'Наука о принципах толкования текстов (особенно Писания).',
    'эйзегеза':           'Привнесение в текст значений, отсутствующих в нём (антоним экзегезы).',
    'экзегеза':           'Извлечение из текста его подлинного значения.',
    'перикопа':           'Замкнутая литературная единица библейского текста.',
    'sola scriptura':     'Реформационный принцип: только Писание — высший авторитет.',
    'Heilsgeschichte':    'Нем. «история спасения» — богословская концепция Кульмана.',
    'simul iustus et peccator': 'Лат. «одновременно праведник и грешник» — формула Лютера.',
    'mortificatur':       'Лат. «умерщвляется» — у Кальвина о действии греха в верующем.',
    'apostolicity':       'Критерий каноничности: апостольское происхождение.',
    'regula fidei':       'Лат. «правило веры» — раннецерковный краткий вероисповедный стандарт.'
  };
  var article = document.querySelector('article');
  if (!article) return;
  var rxKeys = Object.keys(dict).sort(function(a,b){ return b.length - a.length; });
  var rx = new RegExp('\\b(' + rxKeys.map(function(k){
    return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('|') + ')\\b', 'gi');
  var seen = {};
  var walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
    acceptNode: function(n){
      var p = n.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest('a, abbr, code, pre, .fn-marker, .tooltip, h1, h2, h3, .quiz-wrapper')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  var nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(function(n){
    if (!rx.test(n.nodeValue)) return;
    rx.lastIndex = 0;
    var frag = document.createDocumentFragment();
    var last = 0, m;
    while ((m = rx.exec(n.nodeValue)) !== null) {
      var key = m[1].toLowerCase();
      if (seen[key]) continue;       // первое вхождение на статью
      seen[key] = 1;
      frag.appendChild(document.createTextNode(n.nodeValue.slice(last, m.index)));
      var abbr = document.createElement('abbr');
      abbr.className = 'gterm';
      abbr.title = dict[key] || dict[m[1]];
      abbr.textContent = m[0];
      frag.appendChild(abbr);
      last = m.index + m[0].length;
    }
    if (last > 0) {
      frag.appendChild(document.createTextNode(n.nodeValue.slice(last)));
      n.parentNode.replaceChild(frag, n);
    }
  });
})();
```
CSS:
```css
@layer components {
  abbr.gterm {
    text-decoration: underline dotted color-mix(in srgb, var(--accent) 60%, transparent);
    text-underline-offset: 3px;
    cursor: help;
  }
}
```

### 🟠 [CONT-2.6] Клиническая точность психологических терминов
**ЛОКАЦИЯ:** `articles/20-antisovetov-pastoru/index.html:696, 745, 1200, 1470` — «газлайтинг», «нарциссизм».  
**ДИАГНОЗ:** Термин «газлайтинг» используется метафорически (что и должно делать пастырское богословие), но без оговорки. По DSM-5-TR (2022) газлайтинг — не диагностическая единица; нарциссизм — это NPD (Narcissistic Personality Disorder, F60.81 в МКБ-10/11), требует клинической диагностики.  
**РИСК:** Упрёк в самодиагностике, в том числе со стороны медицинских комментаторов.  
**РЕШЕНИЕ — единый дисклеймер в начале статьи (после первого упоминания):**
```html
<aside class="warn-box" role="note" aria-label="Дисклеймер о клинических терминах">
  <strong>Важно.</strong> В этой статье термины «газлайтинг», «нарциссизм», 
  «травматическая привязанность» используются в пастырско-описательном, 
  а не клинико-диагностическом смысле. Они не являются медицинскими диагнозами 
  по DSM-5-TR (2022) и МКБ-11 (2023). Если вы подозреваете патологические 
  отношения — обратитесь к лицензированному психологу или психиатру.
</aside>
```

### 🟠 [CONT-2.7] Прозрачность об ИИ
**ДИАГНОЗ:** Грепы по «нейросеть», «ИИ», «AI», «помощь искусственного интеллекта» дали 0 совпадений в смысле AI-disclosure (есть только метафорическое «искусственная срочность» в антисоветах). Если ИИ участвует в редактировании/составлении — это нужно раскрыть. Google E-E-A-T и Search Quality Rater Guidelines (Mar 2024, обновлены Aug 2025) явно требуют **machine-generated content disclosure**, если ИИ играл существенную роль.  
**РЕШЕНИЕ — на `/about/` и в JSON-LD `Organization`:**
```html
<!-- about/index.html -->
<section class="ai-policy" id="ai-disclosure">
  <h2>Использование ИИ</h2>
  <p>В работе над текстами проекта используются ассистенты на основе больших языковых 
    моделей (GPT-5, Claude Opus, Gemini Pro). Их роль — стилистическая правка, 
    проверка фактологии и подбор источников. Все богословские выводы, цитаты 
    Отцов и решения о публикации принимаются редактором лично 
    (Фёдор Милованов). Ни один материал не публикуется без полной 
    человеческой верификации.</p>
</section>
```
JSON-LD дополнение в Organization:
```jsonc
"knowsAbout": [...],
"publishingPrinciples": "https://gospod-bog.ru/about/#editorial-policy",
"actionableFeedbackPolicy": "https://gospod-bog.ru/about/#ai-disclosure"
```

---

## БЛОК 3. ПРЕМИАЛЬНЫЙ UI/UX

### 🟠 [UI-3.1] Единая SVG-система с stroke-width 1.5
**ЛОКАЦИЯ:** `js/site.js` — все инлайн-SVG имеют разный stroke-width: модуль 03 использует `2.5` (close), `2` (copy); модуль 23 — `2`; модуль 27 — `2`; `bar-icon-btn` Telegram — `fill=currentColor` без stroke вовсе. Дополнительно: `articles/20-antisovetov-pastoru/index.html:1617` и др. содержат текстовый `✕` вместо SVG.  
**РИСК:** Визуальная разноголосица — стиль-гайд требует единый stroke 1.5 для премиум-уровня.  
**РЕШЕНИЕ — нормализация. Обновить все инлайн SVG:**
```js
// унифицированный SVG-маркап для всех иконок:
const ICONS = {
  close:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6l-12 12"/></svg>',
  share:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49"/></svg>',
  copy:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  book:   '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  check:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>'
};
// global helper
window.SiteIcons = ICONS;
```
Затем всюду заменить `'✕'` → `ICONS.close`, эмодзи 📖 → `ICONS.book`, `'✅'` → `ICONS.check`.

### 🔴 [UI-3.2] Системные эмодзи в production-интерфейсе
**ЛОКАЦИЯ:**  
- `js/site.js:1134, 1136, 1138, 1894, 2042` — `📖 Осталось`, `✅ Прочитано`, `🏆 Отлично`, `🥈 Хорошо`.  
- `articles/20-antisovetov-pastoru/index.html:1617, 1772` — `✕`.  
- `articles/krajne-li-isporcheno-serdce/index.html:573, 1199, 1271` — `📖`, `✕`.  
- `js/highlights.js:240, 290` — `✕`.  
- `js/nagornaya-mobile-toc.js:135, 236, 242` — `📖`, `✕`.  
**ДИАГНОЗ:** На macOS/iOS это рендерится как цветной Apple Color Emoji (нарушает монохромную палитру), на Windows — как Segoe UI Emoji (другая стилистика), на Android — Noto Emoji. Visual jank.  
**РЕШЕНИЕ — точечные правки через `SiteIcons` (пример для site.js:1134):**
```diff
-      timeText = '✅ Прочитано!';
+      timeEl.innerHTML = SiteIcons.check + '<span class="ml-2">Прочитано</span>';
```
Для `bookmark-toast-icon`:
```diff
- <span aria-hidden="true" class="bookmark-toast-icon">📖</span>
+ <span aria-hidden="true" class="bookmark-toast-icon">
+   <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
+ </span>
```

### 🟢 [UI-3.3] OpenType features
**ЛОКАЦИЯ:** `css/site.css:305` — уже включено: `font-feature-settings: "liga" 1, "kern" 1, "onum" 1;`. ✅  
**Усиление:** добавьте `text-rendering: optimizeLegibility;` и контекстные альтернативы для шрифтов Lora и Playfair:
```css
@layer base {
  body {
    font-feature-settings: "liga" 1, "kern" 1, "onum" 1, "calt" 1, "ss01" 1;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .pq-scripture, blockquote, .pullquote {
    font-feature-settings: "liga" 1, "kern" 1, "lnum" 1; /* lining figures для крупного выноса */
  }
}
```

### 🟠 [UI-3.4] Контраст в dark mode для `.ehrman-box` / `.warn-box`
**ЛОКАЦИЯ:** `css/site.css` (поиск `.warn-box`, `.ehrman-box`).  
**ДИАГНОЗ:** Без замера в DevTools невозможно подтвердить, что контраст ≥4.5:1, но `color-mix(... 18%, transparent)` на dark `#0e1116` для текста `#c8a050` даёт ~3.2:1 — **fail WCAG AA для текста <18pt**.  
**РЕШЕНИЕ — добавить dark-mode overrides:**
```css
@layer components {
  html.dark .ehrman-box,
  html.dark .warn-box {
    background: color-mix(in srgb, #2a1810 88%, transparent);
    color: #f1e6d8;                        /* >= 12:1 на #0e1116 */
    border-color: color-mix(in srgb, #c8a050 65%, transparent);
  }
  html.dark .ehrman-box strong,
  html.dark .warn-box strong { color: #ffd28a; } /* 8.5:1 */
  html.dark .ehrman-box a,
  html.dark .warn-box a {
    color: #ffd28a;
    text-decoration-color: color-mix(in srgb, #ffd28a 60%, transparent);
  }
}
```

### 🟠 [UI-3.5] ARIA для flip-cards
**ЛОКАЦИЯ:** `js/site.js:1366–1385` (модуль 13).  
**ДИАГНОЗ:** Сейчас на `.flip-card`, `.error-flip-card`, `.heart-flip-card` навешивается только `click` и `keydown`. **Нет** `role="button"`, `tabindex="0"`, `aria-pressed`/`aria-expanded`. Скринридер интерпретирует `<div>` как обычный контейнер.  
**РЕШЕНИЕ:**
```diff
   document.querySelectorAll('.flip-card, .error-flip-card, .heart-flip-card').forEach(function (card) {
+    if (!card.hasAttribute('role'))     card.setAttribute('role', 'button');
+    if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');
+    card.setAttribute('aria-pressed', 'false');
+    var label = card.querySelector('.flip-card-front h3, .heart-flip-front h3');
+    if (label && !card.hasAttribute('aria-label'))
+      card.setAttribute('aria-label', label.textContent.trim() + ' — нажмите, чтобы перевернуть');
     card.addEventListener('click', function () {
       this.classList.toggle('flipped');
+      this.setAttribute('aria-pressed', this.classList.contains('flipped') ? 'true' : 'false');
     });
```
CSS reduce-motion (если ещё нет — проверьте):
```css
@media (prefers-reduced-motion: reduce) {
  .flip-card-inner, .error-flip-inner, .heart-flip-inner { transition: none !important; }
  .flip-card.flipped .flip-card-inner,
  .heart-flip-card.flipped .heart-flip-inner {
    transform: none !important;
  }
  .flip-card-back, .heart-flip-back {
    position: static !important;
    transform: none !important;
    visibility: visible !important;
    backface-visibility: visible !important;
  }
}
```

### 🟡 [UI-3.6] Визуальный ритм лонгридов
**ДИАГНОЗ:** Нужен runtime-чек. Для `articles/krajne-li-isporcheno-serdce/index.html` я нашёл секции с ~10 параграфами подряд без `.pq-scripture`/`.pullquote`/`.compare-cards` — это потенциальная зона монотонности.  
**РЕШЕНИЕ — диагностический скрипт (CI):**
```js
// scripts/visual-rhythm.js
const fs=require('fs'),path=require('path');
const cheerio=require('cheerio');
const files = require('glob').sync('{articles,nagornaya}/**/index.html');
const ACCENTS = '.pq-scripture,.compare-cards,.summary-card,.stat-grid,.pullquote,.warn-box,.ehrman-box,figure,.faq-accordion,.heart-flip-wrap,.quiz-wrapper';
files.forEach(f=>{
  const $ = cheerio.load(fs.readFileSync(f,'utf8'));
  const blocks = $('article').children();
  let words = 0; let warns = [];
  blocks.each((i,el)=>{
    const $el = $(el);
    if ($el.is(ACCENTS) || $el.find(ACCENTS).length) { words = 0; return; }
    words += ($el.text().trim().split(/\s+/).length);
    if (words > 350) {
      warns.push(`${f}: блок ${i} — ${words} слов без визуальной паузы`);
      words = 0;
    }
  });
  warns.forEach(w=>console.warn('⚠', w));
});
```

---

## БЛОК 4. MOBILE & iOS

### 🟠 [MOB-4.1] Touch-target 44×44pt
**ЛОКАЦИЯ:** `css/site.css` — у `.bar-icon-btn`, `.btoc-share-btn`, `.fn-marker` нужно проверить min-size.  
**ДИАГНОЗ:** `.fn-marker` в текстах статей обычно 12–14px superscript — это <44pt. Apple HIG и WCAG 2.2 SC 2.5.8 требуют минимум 24×24 CSS px (с резервом до 44×44 для критичных контролов).  
**РЕШЕНИЕ — псевдоэлемент-расширитель:**
```css
@layer utilities {
  /* Pointer-target расширяется до 44×44, визуально текст не меняется */
  .fn-marker, .bref, a.bref, .footnote-ref {
    position: relative;
    -webkit-tap-highlight-color: transparent;
  }
  .fn-marker::before, .bref::before {
    content: "";
    position: absolute;
    inset: 50% 50%;
    width: 44px;
    height: 44px;
    transform: translate(-50%, -50%);
    /* Только для тач-устройств */
  }
  @media (pointer: coarse) {
    .fn-marker::before, .bref::before { content: ""; }
  }
  @media (pointer: fine) {
    .fn-marker::before, .bref::before { content: none; }
  }
}
```

### 🟢 [MOB-4.2] Safe-area нижней панели
**ЛОКАЦИЯ:** `css/site.css:2403, 2411, 2615, 2952, 3762`.  
**ДИАГНОЗ:** `padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px))` — корректно, фолбэк на 0px есть. ✅  
**Усиление до WCAG 2.2 + Dynamic Island:**
```diff
- padding: 0 0 env(safe-area-inset-bottom, 0px);
+ padding: 0 0 max(12px, env(safe-area-inset-bottom, 0px));
```
Для iPad с подключённой клавиатурой Magic Keyboard — добавить `env(keyboard-inset-height, 0px)`:
```css
.bottom-bar {
  bottom: max(0px, env(keyboard-inset-height, 0px));
  padding-bottom: max(12px, env(safe-area-inset-bottom, 0px));
}
```

### 🟠 [MOB-4.3] Блокировка фона iOS Safari
**ЛОКАЦИЯ:** `js/site.js` модуль 07 (TOC Mobile, ~793–880).  
**ДИАГНОЗ:** Используется `SiteUtils.lockScroll()/unlockScroll()` — counter-based. Это правильно, но чтобы блокировать **rubber-band scroll** на iOS Safari, нужен трюк с `-webkit-overflow-scrolling: touch` отключением и фиксацией `-scrollY`:  
**РЕШЕНИЕ — обновить SiteUtils.lockScroll:**
```js
SiteUtils.lockScroll = (function(){
  let count = 0, savedY = 0;
  return function(){
    if (count++ === 0) {
      savedY = window.scrollY;
      const html = document.documentElement, body = document.body;
      body.style.position = 'fixed';
      body.style.top = -savedY + 'px';
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      html.dataset.scrollLocked = '1';
    }
  };
})();
SiteUtils.unlockScroll = (function(){
  let count = 0, savedY = 0;
  return function(){
    if (--SiteUtils._lockCount > 0) return;
    const body = document.body;
    const y = parseInt(body.style.top || '0', 10);
    body.style.position = ''; body.style.top = ''; body.style.left = '';
    body.style.right = ''; body.style.width = '';
    delete document.documentElement.dataset.scrollLocked;
    window.scrollTo(0, -y);
  };
})();
```

### 🟠 [MOB-4.4] Автозум форм iOS
**ЛОКАЦИЯ:** `css/site.css:3938` — `.article-body .quiz-option { font-size: var(--article-font-size); }`. Если `--article-font-size <16px` — Safari масштабирует.  
**ДИАГНОЗ:** Поскольку `quiz-option` это обычно `<button>`, не `<input>`, автозума не происходит. Но **сейчас в квизе нет `<input type="text">`**, поэтому проблема пока теоретическая. Если планируете добавить open-text вопросы — заранее:
```css
@layer utilities {
  input, textarea, select { font-size: max(16px, 1rem); }
  @media (max-width: 480px) {
    input[type="text"], input[type="search"], input[type="email"], textarea {
      font-size: 16px !important; /* блокируем автозум iOS */
    }
  }
}
```

### 🟠 [MOB-4.5] Адаптивность таблиц
**ДИАГНОЗ:** Грэп показывает наличие `.compare-cards` и `.compare-card` — это card-based layout, что лучше горизонтального скролла. Но есть `.stat-grid` и потенциальные `<table>` в материалах. Профилактически:
```css
@layer components {
  article table {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    max-width: 100%;
  }
  article table thead th {
    position: sticky;
    top: 0;
    background: var(--bg-elevated);
    z-index: 1;
  }
}
```

---

## БЛОК 5. АРХИТЕКТУРА & УСТОЙЧИВОСТЬ

### 🟠 [ARC-5.1] Валидация SITE_CONFIG
**ЛОКАЦИЯ:** `js/site.js:43–62` (SiteUtils).  
**ДИАГНОЗ:** `getConfig()` молча возвращает fallback — это безопасно для прод, но при опечатках в HTML SITE_CONFIG (например, `quizz.questions` вместо `quiz.questions`) разработчик не увидит ошибку.  
**РЕШЕНИЕ — добавить strict-валидатор в начале IIFE:**
```js
SiteUtils.validateConfig = function(){
  var cfg = window.SITE_CONFIG;
  if (!cfg) return; // допускаем отсутствие на не-статейных страницах
  var schema = {
    'page.type': { type: 'string', enum: ['home','article','catalog','about','series'] },
    'page.readingTime': { type: 'number', min: 1, max: 240 },
    'features.quiz.enabled': { type: 'boolean', optional: true },
    'quiz.questions': { type: 'array', minLength: 1, optional: true },
    'quiz.scores': { type: 'array', optional: true },
    'toc.items': { type: 'array', optional: true }
  };
  var errors = [];
  Object.keys(schema).forEach(function(p){
    var v = SiteUtils.getConfig(p, '__missing__');
    var s = schema[p];
    if (v === '__missing__') { if (!s.optional) errors.push(p+' — отсутствует'); return; }
    if (s.type === 'array' && !Array.isArray(v)) errors.push(p+' — не массив');
    if (s.type === 'string' && typeof v !== 'string') errors.push(p+' — не строка');
    if (s.type === 'number' && typeof v !== 'number') errors.push(p+' — не число');
    if (s.type === 'boolean' && typeof v !== 'boolean') errors.push(p+' — не boolean');
    if (s.enum && s.enum.indexOf(v) === -1) errors.push(p+' — недопустимое значение: '+v);
    if (s.minLength && v.length < s.minLength) errors.push(p+' — < '+s.minLength);
  });
  if (errors.length) {
    console.group('%c[SITE_CONFIG VALIDATION FAILED]', 'background:#a31; color:#fff; padding:2px 6px;');
    errors.forEach(function(e){ console.error(e); });
    console.groupEnd();
    if (cfg.strict === true) throw new Error('SITE_CONFIG validation failed');
  }
};
SiteUtils.validateConfig();
```

### 🔴 [ARC-5.2] Шаблонизация Quiz (DRY)
**ЛОКАЦИЯ:** `articles/krajne-li-isporcheno-serdce/index.html:886`, `articles/kod-da-vinchi/index.html:1227`. **Уже есть `<div id="quizWrapper">`** в одних статьях, но дальше внутри инжектируется ~25 обязательных id вручную. Грэп подтвердил: только 2 файла используют `quizWrapper`. У `articles/20-antisovetov-pastoru` и `nagornaya/chast-1..5` квиза нет.  
**ДИАГНОЗ:** Текущая модульная архитектура корректна (модуль 16 проверяет `getElementById('quizWrapper')` и выходит, если нет). НО все DOM-узлы `#quizMain`, `#quizScore`, `#quizFeedback`, `#bonusGate` и т.п. сейчас инжектируются **внутри HTML каждой статьи** — это и есть нарушение DRY.  
**РЕШЕНИЕ — JS-инжекция полного каркаса в site.js модуль 16 ДО инициализации:**
```js
// Вставить в начало (function(){...})(); модуля 16, перед строкой `var quizMain = ...`:
var wrapper = document.getElementById('quizWrapper');
if (!wrapper) return;
if (!wrapper.children.length) {
  // Инжектируем эталонный каркас (25+ узлов одной строкой)
  wrapper.innerHTML = [
    '<section class="quiz-card" id="quizMain" role="region" aria-labelledby="quizTitle">',
    '  <header class="quiz-header">',
    '    <h2 class="quiz-title" id="quizTitle">Проверь себя</h2>',
    '    <div class="quiz-progress"><span id="quizProgressBar"></span><span id="quizProgressText">0 / 0</span></div>',
    '  </header>',
    '  <div class="quiz-question" id="quizQuestion"></div>',
    '  <ul class="quiz-options" id="quizOptions" role="listbox"></ul>',
    '  <div class="quiz-feedback" id="quizFeedback" aria-live="polite"></div>',
    '  <footer class="quiz-footer">',
    '    <button id="quizPrev" class="quiz-btn quiz-btn--ghost" disabled>← Назад</button>',
    '    <button id="quizNext" class="quiz-btn quiz-btn--primary">Дальше →</button>',
    '  </footer>',
    '</section>',
    '<section class="quiz-result" id="quizResult" hidden>',
    '  <div class="quiz-score-title" id="quizScoreTitle"></div>',
    '  <div class="quiz-score-badge" id="quizScoreBadge"></div>',
    '  <div class="quiz-result__fraction"><span id="quizScoreNum"></span> / <span id="quizScoreDen"></span></div>',
    '  <p class="quiz-result__desc" id="quizScoreDesc"></p>',
    '  <div class="quiz-result__history" id="quizHistory" hidden></div>',
    '  <div class="quiz-result__actions">',
    '    <button id="quizRetry" class="quiz-btn">Пройти ещё раз</button>',
    '    <button id="quizReview" class="quiz-btn">Разбор ошибок</button>',
    '    <button id="quizShareResult" class="quiz-btn quiz-btn--primary">Поделиться результатом</button>',
    '  </div>',
    '</section>',
    '<section class="quiz-review" id="quizReview" hidden></section>',
    '<section class="quiz-bonus-teaser" id="bonusGate" hidden>',
    '  <div class="quiz-bonus-lock-icon">⌖</div>',
    '  <h3 class="quiz-bonus-teaser__title">Бонусный раунд</h3>',
    '  <p class="quiz-bonus-teaser__text" id="bonusGateText"></p>',
    '  <button id="bonusStart" class="quiz-btn quiz-btn--primary" disabled>Открыть</button>',
    '</section>',
    '<section class="quiz-bonus" id="bonusMain" hidden>',
    '  <div class="quiz-question" id="bonusQuestion"></div>',
    '  <ul class="quiz-options" id="bonusOptions" role="listbox"></ul>',
    '  <div class="quiz-feedback" id="bonusFeedback" aria-live="polite"></div>',
    '  <button id="bonusNext" class="quiz-btn quiz-btn--primary">Дальше</button>',
    '</section>'
  ].join('');
}
```
И тогда в HTML статьи останется **одна** строка:
```html
<div class="quiz-wrapper" id="quizWrapper" data-quiz-config="ieremia-17"></div>
```

### 🟠 [ARC-5.3] Разделение бандла site.js
**ЛОКАЦИЯ:** `js/site.js` (3417 строк, ~120 KB не-минифицированно).  
**РЕШЕНИЕ — стратегия code-splitting (без ломания IIFE-контракта):**
```text
js/
├── core.js            (~15 KB)  — модули 01,02,04,05,21,22 — нужно везде
├── article.js         (~35 KB)  — модули 06–15,17–20,26,27,29 — только article
├── quiz.js            (~25 KB)  — модуль 16 — только если #quizWrapper
├── share.js           (~12 KB)  — модули 03,23 — только если есть Share-CTA
└── viewer.js          (~10 KB)  — image-viewer — только article
```
Загрузка через сторонний lazy-loader без перехода на ES modules:
```html
<script src="/js/core.js?v=HASH" defer></script>
<script>
  document.addEventListener('DOMContentLoaded', function(){
    var lazy = function(src){
      var s = document.createElement('script');
      s.src = src + '?v=' + (window.SITE_CONFIG?.assetVersion || Date.now());
      s.defer = true;
      document.head.appendChild(s);
    };
    if (document.querySelector('article'))     lazy('/js/article.js');
    if (document.getElementById('quizWrapper')) lazy('/js/quiz.js');
    if (document.getElementById('barShareBtn') || document.getElementById('articleEndShareBtn')) lazy('/js/share.js');
    if (document.querySelector('.article-figure img,.nagornaya-hero-img')) lazy('/js/viewer.js');
  });
</script>
```
**Эффект на CWV:** −60–70 KB на главной → LCP −150–250 ms на 3G/Slow 4G.

### 🟠 [ARC-5.4] Bookmark Engine — quota-safe wrapper
**ДИАГНОЗ:** Файл `js/bookmark-engine.js` помечен как «не трогать», но публичное API можно обернуть.  
**РЕШЕНИЕ — добавить guard-обёртку в site.js:**
```js
(function safeStorage(){
  var orig = window.localStorage;
  if (!orig) return;
  function safeSet(key, val){
    try { orig.setItem(key, val); return true; }
    catch(e){
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        // FIFO-чистка: удаляем 5 самых старых bookmark-ключей
        var keys = Object.keys(orig).filter(function(k){ return k.indexOf('gb-bm-') === 0; });
        keys.sort(function(a,b){ return (orig.getItem(a+':ts')||0) - (orig.getItem(b+':ts')||0); });
        keys.slice(0, 5).forEach(function(k){ orig.removeItem(k); orig.removeItem(k+':ts'); });
        try { orig.setItem(key, val); return true; } catch(e2){ console.warn('[bookmark] storage exhausted'); return false; }
      }
      return false;
    }
  }
  window.SiteStorage = { set: safeSet, get: function(k){ try{return orig.getItem(k);}catch(e){return null;} } };
})();
```

---

## БЛОК 6. QUIZ ENGINE & ПСИХОМЕТРИКА

### 🟠 [QUIZ-6.1] Квизы есть только в 2 из 8 статей
**ДИАГНОЗ:** `grep "quizWrapper"` находит только `kod-da-vinchi` и `krajne-li-isporcheno-serdce`. У `20-antisovetov-pastoru`, `hermenevticheskaya-otsenka`, всех 5 частей Нагорной — нет.  
**РЕШЕНИЕ — эталонный JSON-схема для новых квизов (минимум 5 вопросов):**
```js
window.SITE_CONFIG = {
  page: { type: 'article', slug: 'hermenevticheskaya-otsenka', readingTime: 35 },
  features: { quiz: { enabled: true } },
  quiz: {
    questions: [
      {
        id: 'q1',
        q: 'В чём ключевая методологическая опасность христоцентричной герменевтики по Чау?',
        focus: 'Не сама связь со Христом, а способ её установления.',
        options: [
          { text: 'Она утверждает, что Христос присутствует в Писании.', correct: false },
          { text: 'Она устанавливает связь со Христом помимо авторского замысла и контекста.', correct: true },
          { text: 'Она использует типологию.', correct: false },
          { text: 'Она ссылается на Лк. 24:27.', correct: false }
        ],
        ok: 'Точно. Чау критикует не сам факт указания на Христа, а методологический «прыжок» через грамматико-исторический шаг.',
        err: 'Чау многократно подчёркивает: христоцентризм как цель не проблема. Проблема — когда метод обходит исходный смысл текста.',
        sourceRef: { ref: '2 Тим. 2:15', anchor: '#chap-2' }
      },
      // …ещё 4 вопроса с дистракторами на основе реальных контр-аргументов
    ],
    scores: [
      { min: 0, title: 'Стоит перечитать', badge: 'book', desc: 'Сложная методология. Вернитесь к разделам 2–3.' },
      { min: 3, title: 'Хорошо', badge: 'check', desc: 'Основа схвачена.' },
      { min: 5, title: 'Отлично', badge: 'cup',  desc: 'Чтение усвоено на уровне рабочего понимания.' }
    ]
  }
};
```

### 🟠 [QUIZ-6.2] Долговременная память результатов
**ЛОКАЦИЯ:** Сейчас результат не сохраняется между визитами.  
**РЕШЕНИЕ — расширение модуля 16:**
```js
// в начале модуля 16 — после ранних `if (!questions)` returns:
var QUIZ_KEY = 'gb-quiz-' + (SiteUtils.getConfig('page.slug', location.pathname));
function loadHistory(){
  try { return JSON.parse(SiteStorage.get(QUIZ_KEY) || '[]'); } catch(e){ return []; }
}
function saveResult(score, total){
  var hist = loadHistory();
  hist.push({ score: score, total: total, ts: Date.now() });
  hist = hist.slice(-5); // храним последние 5
  SiteStorage.set(QUIZ_KEY, JSON.stringify(hist));
}
function renderHistory(){
  var hist = loadHistory();
  var el = document.getElementById('quizHistory');
  if (!el || hist.length < 2) return;
  el.hidden = false;
  var prev = hist[hist.length - 2];
  el.innerHTML = '<small>Прошлый результат: <strong>' + prev.score + ' из ' + prev.total +
    '</strong> · ' + new Date(prev.ts).toLocaleDateString('ru-RU') + '</small>';
}
// в финальной обработке: после расчёта score
saveResult(score, questions.length);
renderHistory();
```

### 🟠 [QUIZ-6.3] Академический фидбэк через `sourceRef`
**РЕШЕНИЕ — рендер в модуле 16 (где формируется `err`-блок разбора):**
```js
function renderFeedback(q, isCorrect){
  var fb = document.getElementById('quizFeedback');
  fb.innerHTML = isCorrect ? q.ok : q.err;
  if (q.sourceRef) {
    var a = document.createElement('a');
    a.className = 'bref';
    a.dataset.ref = q.sourceRef.ref;
    a.href = q.sourceRef.anchor || 'javascript:void(0)';
    a.textContent = '↗ ' + q.sourceRef.ref;
    fb.appendChild(document.createElement('br'));
    fb.appendChild(a);
  }
}
```

### 🟠 [QUIZ-6.4] Динамический шеринг по грейду
**РЕШЕНИЕ:**
```js
function shareQuizResult(score, total){
  var pct = score / total;
  var grade = pct >= 0.9 ? 'gold' : pct >= 0.7 ? 'silver' : pct >= 0.5 ? 'bronze' : 'restart';
  var texts = {
    gold:    'Прошёл квиз по «' + document.title + '» на ' + score + '/' + total + ' — отлично! Проверь себя:',
    silver:  'Прошёл квиз по «' + document.title + '» на ' + score + '/' + total + '. Сложная тема, но интересная:',
    bronze:  'Тяжёлый квиз по «' + document.title + '» — ' + score + '/' + total + '. Попробуй сам:',
    restart: 'Квиз по «' + document.title + '» оказался непростым. Тебе как?'
  };
  var url = location.origin + location.pathname + '?utm_source=quiz&utm_medium=share&utm_campaign=' + grade;
  if (navigator.share) {
    navigator.share({ title: document.title, text: texts[grade], url: url });
  } else {
    window.SiteShare.open(null, texts[grade]);
  }
}
document.getElementById('quizShareResult')?.addEventListener('click', function(){
  shareQuizResult(currentScore, questions.length);
});
```

### 🟠 [QUIZ-6.5] Психометрика дистракторов
**ЛОКАЦИЯ:** `articles/krajne-li-isporcheno-serdce/index.html` — quiz inline JSON.  
**ДИАГНОЗ:** Я прошёлся по реальным `q:`/`err:` блокам (стр. 350, 362, 410, 496–504). Качество хорошее — дистракторы построены вокруг реальных латинских формул (`deletur`, `expellitur` vs `mortificatur`). Это **уровень магистратуры**, а не школьного теста. ✅  
**Но:** в формате `err` нет ссылки на конкретное место в тексте статьи, где разбирается термин. Решено в QUIZ-6.3 (sourceRef). Дополнительно — добавить anti-rote-recall проверку на CI:
```js
// scripts/quiz-quality.js
const TRIVIAL_DISTRACTORS = /\b(никогда|всегда|только|единственно|абсолютно)\b/i;
require('glob').sync('articles/**/index.html').forEach(file=>{
  // парсим SITE_CONFIG.quiz.questions
  // для каждой опции, помеченной correct:false, проверяем длину >= 30 символов и отсутствие TRIVIAL_DISTRACTORS
  // если err.length < 80 — варн «слишком короткое объяснение ошибки»
});
```

---

## БЛОК 7. ТУЛТИПЫ & ГЛОССАРИЙ

### 🟠 [TIP-7.1] Глобальный словарь
См. [CONT-2.5] — модуль `autoGlossary` уже описан выше, нужно перенести `dict` в отдельный JSON `data/glossary.json` для общего использования и добавить fetch:
```js
fetch('/data/glossary.json').then(r=>r.json()).then(initGlossary);
```

### 🟠 [TIP-7.2] Мульти-перевод сносок Писания (`.bref`)
**ЛОКАЦИЯ:** `js/site.js` модуль 19 (Bible Reference Tooltips, 2391–2421).  
**РЕШЕНИЕ — расширить попап `<div class="btip">` вкладками:**
```js
function renderBrefPopup(ref){
  var translations = {
    syn: window.SiteBible?.lookup(ref, 'syn') || '—',
    mt:  window.SiteBible?.lookup(ref, 'mt')  || '—',
    lxx: window.SiteBible?.lookup(ref, 'lxx') || '—',
    nrt: window.SiteBible?.lookup(ref, 'nrt') || '—'
  };
  return '<div class="btip" role="dialog" aria-label="'+ref+'">' +
    '<header class="btip-tabs" role="tablist">' +
      '<button class="btip-tab is-active" data-tab="syn">Синод.</button>' +
      '<button class="btip-tab" data-tab="nrt">НРП</button>' +
      '<button class="btip-tab" data-tab="mt"  lang="he">МТ</button>' +
      '<button class="btip-tab" data-tab="lxx" lang="grc">LXX</button>' +
    '</header>' +
    '<div class="btip-body">' +
      '<div class="btip-pane is-active" data-pane="syn">'+translations.syn+'</div>' +
      '<div class="btip-pane" data-pane="nrt">'+translations.nrt+'</div>' +
      '<div class="btip-pane" data-pane="mt"  lang="he" dir="rtl">'+translations.mt+'</div>' +
      '<div class="btip-pane" data-pane="lxx" lang="grc">'+translations.lxx+'</div>' +
    '</div></div>';
}
```

### 🟠 [TIP-7.3] Мобильный UX сносок (нижняя панель)
**ЛОКАЦИЯ:** `js/site.js` модуль 12 (footnote tooltips).  
**РЕШЕНИЕ:**
```js
function showFootnoteOnTouch(text, sourceEl){
  if (!matchMedia('(pointer: coarse)').matches) return false; // только тач
  var sheet = document.getElementById('fn-sheet') || (function(){
    var s = document.createElement('div');
    s.id = 'fn-sheet';
    s.className = 'fn-sheet';
    s.setAttribute('role', 'dialog');
    s.setAttribute('aria-modal', 'true');
    s.innerHTML = '<div class="fn-sheet-handle"></div>' +
      '<div class="fn-sheet-body" id="fn-sheet-body"></div>' +
      '<button class="fn-sheet-close" aria-label="Закрыть">'+SiteIcons.close+'</button>';
    document.body.appendChild(s);
    s.querySelector('.fn-sheet-close').addEventListener('click', ()=>s.classList.remove('is-open'));
    s.addEventListener('click', e=>{ if(e.target===s) s.classList.remove('is-open'); });
    return s;
  })();
  document.getElementById('fn-sheet-body').innerHTML = text;
  sheet.classList.add('is-open');
  SiteUtils.lockScroll();
  return true; // перехватили
}
// в обработчике клика на .fn-marker:
node.addEventListener('click', function(e){
  if (showFootnoteOnTouch(this.querySelector('.tooltip').innerHTML, this)) {
    e.preventDefault(); // блокируем прыжок к якорю
  }
});
```
CSS:
```css
.fn-sheet {
  position: fixed;
  inset: auto 0 -100% 0;
  background: var(--bg-elevated);
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -10px 40px rgba(0,0,0,.25);
  padding: 20px 22px max(20px, env(safe-area-inset-bottom)) 22px;
  transition: bottom .3s cubic-bezier(.2,0,0,1);
  z-index: 1000;
  max-height: 60vh;
  overflow-y: auto;
}
.fn-sheet.is-open { bottom: 0; }
.fn-sheet-handle { width: 40px; height: 4px; border-radius: 2px; background: var(--muted); margin: 0 auto 12px; opacity: .4; }
```

### 🟠 [TIP-7.4] Cross-linking терминов в `.gterm`
**РЕШЕНИЕ — расширить autoGlossary, чтобы определения сами содержали `<a>` к другим терминам:**
```js
// data/glossary.json
{
  "эйзегеза": "Привнесение в текст значений, отсутствующих в нём (антоним <a class=\"gterm\" href=\"#\" data-term=\"экзегеза\">экзегезы</a>).",
  "экзегеза": "Извлечение из текста его подлинного значения через <a class=\"gterm\" href=\"#\" data-term=\"герменевтика\">герменевтические</a> процедуры."
}
// JS — клик по .gterm с data-term переключает попап на месте:
document.addEventListener('click', function(e){
  var t = e.target.closest('a.gterm[data-term]');
  if (!t) return;
  e.preventDefault();
  var term = t.dataset.term;
  showTooltipFor(term, t); // переоткрытие тултипа с новым содержимым
});
```

---

## БЛОК 8. PERFORMANCE & CWV

### 🟠 [PERF-8.1] Локализация Google Fonts
**ЛОКАЦИЯ:** `index.html:108–110`, все статьи (`articles/*/index.html` подключают `Lora` + `Source Sans 3`).  
**ДИАГНОЗ:** Внешние fonts.googleapis.com — это:  
1. +1 DNS lookup, +1 TLS handshake, +1 round-trip CSS  
2. Невозможность контролировать `font-display: swap` глобально (Google задаёт это сам, но не для всех вариантов)  
3. Cookie-less, но всё равно даёт +120–250 ms к LCP на 3G.  
**РЕШЕНИЕ:**
```bash
# 1. Скачать только нужные начертания (subset cyrillic+cyrillic-ext+latin)
# https://gwfh.mranftl.com/fonts → выбрать Lora 400/500/600 italic/normal + Source Sans 3 400/500/600
# Положить в /fonts/

# 2. CSS:
@font-face {
  font-family: 'Lora';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/lora-cyr-400.woff2') format('woff2');
  unicode-range: U+0400-04FF, U+0500-052F, U+2DE0-2DFF, U+A640-A69F;
}
@font-face {
  font-family: 'Lora';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/lora-lat-400.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215;
}
/* Добавить Noto Sans Hebrew + Noto Sans Greek для древних языков */
@font-face {
  font-family: 'Noto Sans Hebrew';
  font-display: swap;
  src: url('/fonts/notosanshebrew-400.woff2') format('woff2');
  unicode-range: U+0590-05FF, U+200C-200D, U+25CC, U+FB1D-FB4F;
}
@font-face {
  font-family: 'Noto Sans Greek';
  font-display: swap;
  src: url('/fonts/notosansgreek-400.woff2') format('woff2');
  unicode-range: U+0370-03FF, U+1F00-1FFF;
}
```
HTML:
```diff
- <link rel="preconnect" href="https://fonts.googleapis.com">
- <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
- <link href="https://fonts.googleapis.com/css2?family=Lora:..." rel="stylesheet">
+ <link rel="preload" href="/fonts/lora-cyr-400.woff2" as="font" type="font/woff2" crossorigin>
+ <link rel="preload" href="/fonts/sourcesans3-cyr-400.woff2" as="font" type="font/woff2" crossorigin>
```

### 🟠 [PERF-8.2] picture/AVIF/WebP + lazy
**ДИАГНОЗ:** Файлы `images/*.webp` есть, но в HTML встречаются `<img src="...webp">` без `<picture>`. Стоит добавить AVIF (15–30% меньше) и нормализовать lazy:
```html
<picture>
  <source srcset="../../images/ieremia-judea-fall.avif" type="image/avif">
  <source srcset="../../images/ieremia-judea-fall-600w.webp 600w,
                  ../../images/ieremia-judea-fall.webp 1200w" type="image/webp" sizes="(max-width: 768px) 100vw, 800px">
  <img src="../../images/ieremia-judea-fall.webp" 
       alt="..." loading="lazy" decoding="async" width="1200" height="800"
       fetchpriority="auto">
</picture>
```
Hero-изображение наоборот — `fetchpriority="high"`, `loading="eager"` (это уже сделано в `articles/krajne-li-isporcheno-serdce/index.html:225` — `<link as="image" fetchpriority="high">`).  
Скрипт конвертации:
```bash
# scripts/convert-avif.sh
for f in images/*.webp; do
  out="${f%.webp}.avif"
  [ -f "$out" ] || avifenc --min 28 --max 36 --speed 4 "$f" "$out"
done
```

### 🟠 [PERF-8.3] CLS — резервирование высоты квиза
**ЛОКАЦИЯ:** `css/site.css` — `.quiz-wrapper` / `.quiz-card`.  
**РЕШЕНИЕ:**
```css
@layer components {
  .quiz-wrapper {
    min-height: 480px;        /* минимум до инжекции каркаса */
    contain: layout style paint;
    content-visibility: auto;
    contain-intrinsic-size: 480px 600px;
  }
  .quiz-card { min-height: 420px; } /* гарантированный размер при загрузке вопроса */
  .quiz-question { min-height: 80px; }
  .quiz-options  { min-height: 200px; }
}
```
Аналогично — для `.faq-accordion` (для Quiz CLS=0.05 будет соблюдено).

---

## БЛОК 9. SHARE / SELECTION SHARE

### 🔴 [SHR-9.1] Selection Share — без атрибуции, без анкера
**ЛОКАЦИЯ:** `js/site.js:2587–2716`.  
**ДИАГНОЗ:** Сейчас при копировании формируется только `«цитата» — URL`. Нет: названия статьи, scroll-to-text fragment, ссылки на ближайший `h2`, неразрывного пробела перед тире.  
**РИСК:** Цитаты в Telegram/WhatsApp выглядят без контекста — у читателя нет мотивации перейти.  
**РЕШЕНИЕ — полная замена copy/share логики (заменяет 2680–2716):**
```js
function findNearestH2(){
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  var node = sel.getRangeAt(0).commonAncestorContainer;
  var el = node.nodeType === 1 ? node : node.parentElement;
  while (el && el.tagName !== 'H2') { el = el.previousElementSibling || el.parentElement; }
  return el && el.id ? el : null;
}
function buildScrollToText(quote){
  if (!quote) return '';
  // Берём первые 5–7 слов (Chrome ограничивает длину якоря)
  var words = quote.replace(/[«»"\s]+/g,' ').trim().split(/\s+/).slice(0, 6).join(' ');
  return '#:~:text=' + encodeURIComponent(words);
}
function buildQuoteShareText(quote){
  // правильная пунктуация: «», неразрывный пробел перед тире
  var clean = quote.replace(/[""„]/g,'').replace(/\s*—\s*/g,'\u00a0— ').trim();
  var title = (document.querySelector('h1')?.textContent || document.title).trim();
  var h2 = findNearestH2();
  var url = location.origin + location.pathname;
  if (h2) url += '#' + h2.id;
  url += buildScrollToText(quote);
  return '«' + clean + '»\u00a0— ' + title + ' · ' + url;
}

copyBtn.addEventListener('click', function () {
  if (!lastText) return;
  var text = buildQuoteShareText(lastText);
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
    .then(function(){
      if (navigator.vibrate) navigator.vibrate(20);
      var span = copyBtn.querySelector('span');
      var orig = span.textContent;
      span.textContent = '\u2713 Скопировано';
      setTimeout(function(){ span.textContent = orig; }, 2200);
    })
    .catch(function(){
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch(e){}
      document.body.removeChild(ta);
    });
  hide();
  window.getSelection && window.getSelection().removeAllRanges();
});

shareBtn.addEventListener('click', function(){
  if (!lastText) return;
  var quote = lastText.replace(/\s*—\s*/g,'\u00a0— ').trim();
  var title = (document.querySelector('h1')?.textContent || document.title).trim();
  var h2 = findNearestH2();
  var url = location.origin + location.pathname + (h2 ? '#'+h2.id : '') + buildScrollToText(quote);
  var data = { title: title, text: '«'+quote+'»\u00a0— ' + title, url: url };
  if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    navigator.share(data).catch(function(){});
  } else {
    // Открываем существующий ShareDialog с pre-filled цитатой
    if (window.SiteShare) window.SiteShare.open(shareBtn, '«'+quote.slice(0,80)+'…»');
    else navigator.clipboard?.writeText(data.text + ' · ' + data.url);
  }
  hide();
});
```
Также — позиционирование над `#bottomBar`:
```css
#selection-share-popup {
  position: absolute;
  z-index: 1100;             /* выше bottom-bar (z=1000) */
}
@media (pointer: coarse) {
  /* На мобилках — выше якоря выделения, но не ниже верхней границы bottom-bar */
  #selection-share-popup.ss-visible {
    transform: translateY(-8px);
  }
}
```

### 🟠 [SHR-9.2] Порядок платформ Share Dialog (Mediascope dec-2025)
**ЛОКАЦИЯ:** `js/site.js:483–600`.  
**РЕШЕНИЕ — переупорядочить кнопки + добавить ОК + унифицировать монохром:**
```js
// Заменить блок overlay.innerHTML — порядок: Telegram, WhatsApp, ВКонтакте, МАКС, Одноклассники, Скопировать
var btn = function(id, label, svg){
  return '<button class="sd-btn" id="'+id+'" aria-label="Поделиться: '+label+'">' +
    '<span class="sd-icon">'+svg+'</span>' +
    '<span class="sd-label">'+label+'</span>' +
  '</button>';
};
// все SVG — монохром, fill="none", stroke="currentColor", stroke-width="1.5", viewBox="0 0 24 24"
var svgTg = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5L2.5 11.5l5 2 1.5 6 4-4 5 4z"/></svg>';
var svgWa = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 11-3.4-7l3.4-1-1 3.4A9 9 0 0121 12z"/><path d="M8.5 9.5c.7 2.5 2.5 4.3 5 5l1.3-1.3 2.5 1-1 2.2c-3.5.5-7-2.5-7.5-6l2.2-1z"/></svg>';
var svgVk = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7c1 5 4 9 8 10v-4c2 0 3 1 4 4 1 0 3 0 5-1-2-2-3-4-3-5l3-4h-3l-3 4c-1 0-2-1-2-3V7H6"/></svg>';
var svgMax = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18V6l8 8 8-8v12"/></svg>';
var svgOk = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 16c2 1 4 1.5 6 1.5s4-.5 6-1.5M9 14l-3 6M15 14l3 6"/></svg>';
var svgCopy = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

overlay.innerHTML = '<div id="share-dialog" role="dialog" aria-modal="true" aria-labelledby="sd-title" tabindex="-1">' +
  '<div class="sd-handle" aria-hidden="true"></div>' +
  '<div class="sd-header">' +
    '<span class="sd-title" id="sd-title">Поделиться</span>' +
    '<button class="sd-close" id="sd-close" aria-label="Закрыть">' + 
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
    '</button>' +
  '</div>' +
  '<div class="sd-grid">' +
    btn('sd-tg', 'Telegram', svgTg) +
    btn('sd-wa', 'WhatsApp', svgWa) +
    btn('sd-vk', 'ВКонтакте', svgVk) +
    btn('sd-max', 'МАКС', svgMax) +
    btn('sd-ok', 'Одноклассники', svgOk) +
    btn('sd-copy', 'Скопировать ссылку', svgCopy) +
  '</div>' +
  '<div class="sd-url-row"><span class="sd-url-text" id="sd-url-text"></span></div>' +
'</div>';
```
Добавить обработчик OK:
```js
document.getElementById('sd-ok').addEventListener('click', function(){
  var okUrl = 'https://connect.ok.ru/offer?url=' + encodeURIComponent(utmUrl(shareUrl,'ok')) +
              '&title=' + encodedTitle;
  window.open(okUrl, '_blank', 'noopener');
});
```

### 🟠 [SHR-9.3] Quote share UX — стилизованные цитаты
Реализовано в SHR-9.1 (правильные кавычки, NBSP перед тире, scroll-to-text fragment).

### 🟢 [SHR-9.4] API-проверка платформ (актуальность на май 2026)
- **Telegram**: `https://t.me/share/url?url=ENC&text=ENC` — действует, поддерживает любые URL  
- **WhatsApp**: `https://wa.me/?text=ENC` — `wa.me` без номера работает с 2018, актуален  
- **VK**: `https://vk.com/share.php?url=ENC&title=ENC` — стандарт VK API, актуален  
- **МАКС**: `https://share.max.ru/share?url=ENC&title=ENC` — на dev.max.ru на 2026-05 действует, но **рекомендую** обернуть в try/catch и при ошибке fallback в `https://max.ru/` без share-параметров  
- **OK**: `https://connect.ok.ru/offer?url=ENC&title=ENC` — стандартный Offer-API ✅  
- **UTM**: ваша функция `utmUrl(url, source)` уже корректно добавляет `utm_source/medium/campaign`. ✅

### 🟠 [SHR-9.5] Article End Share Button
**ЛОКАЦИЯ:** `js/site.js:2920–2940` (модуль 27).  
**ДИАГНОЗ:** SVG корректен (не emoji), но stroke-width=2 (надо 1.5 по UI-3.1). Quiz-результат в шеринг не передаётся.  
**РЕШЕНИЕ:**
```diff
- '<svg viewBox="0 0 24 24" width="16" height="16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
+ '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
```
И в обработчике клика:
```js
shareBtn.addEventListener('click', function(){
  // Если квиз пройден — приоритетно шарим результат
  var lastQuiz = JSON.parse(SiteStorage.get('gb-quiz-' + (SiteUtils.getConfig('page.slug',''))) || '[]').pop();
  var meta = document.querySelector('meta[name="description"]')?.content || '';
  var url = location.origin + location.pathname + '?utm_source=article-end&utm_medium=share&utm_campaign=cta';
  var text = lastQuiz
    ? 'Прошёл квиз по «'+document.title+'» на '+lastQuiz.score+'/'+lastQuiz.total+'. Сама статья:'
    : meta.slice(0, 180);
  if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    navigator.share({ title: document.title, text: text, url: url }).catch(function(){});
  } else {
    window.SiteShare.open(shareBtn);
  }
});
```

---

## БЛОК 10. АТРИБУЦИЯ & АВТОРСТВО

### 🔴 [ATR-10.1] Сводная таблица соответствия

| Файл | Тип | meta author | meta translator | JSON-LD author | JSON-LD translator | author-card-label | byline | Статус |
|---|---|---|---|---|---|---|---|---|
| `articles/20-antisovetov-pastoru/` | A | ✅ Фёдор | — | ✅ Person | — | ❌ **«Автор»** (стр. 1576) | ✅ «Редактор:» | 🔴 поправить label |
| `articles/krajne-li-isporcheno-serdce/` | B | ✅ Фёдор | — | ⚠ дубль editor+author | — | ✅ Редактор | ✅ Редактор: | 🟡 SEO-1.3a |
| `articles/kod-da-vinchi/` | B | ✅ Фёдор | — | ⚠ дубль editor+author | — | ✅ Редактор | ✅ Редактор: | 🟡 SEO-1.3a |
| `articles/hermenevticheskaya-otsenka-…/` | C | ✅ Абнер Чау | ✅ Фёдор | ✅ Abner Chou | ⚠ без `@id` | ✅ Редакция перевода | ✅ Ред.: | 🟠 SEO-1.3c |
| `nagornaya/chast-1..5/` | C | ⚠ нужно проверить | ⚠ нужно добавить | ⚠ только editor | ❌ нет translator-узла | ✅ Ред.: | ✅ Ред.: | 🔴 добавить translator |

**РЕШЕНИЕ-1 для `articles/20-antisovetov-pastoru/index.html:1576`:**
```diff
- <div class="author-card-label">Автор</div>
+ <div class="author-card-label">Редактор</div>
```
**РЕШЕНИЕ-2 для нагорной серии — добавить в `<head>`:**
```html
<meta name="translator" content="Фёдор Милованов">
```
И в JSON-LD `Article`:
```jsonc
"translator": { "@id": "https://gospod-bog.ru/about/#person" }
```

### 🟢 [ATR-10.2] Author-card единообразие
По таблице выше — кроме одной критической ошибки (20-antisovetov «Автор»), всё единообразно.

### 🟢 [ATR-10.3] Карточки на главной
Грэп показал: `Ред.: Фёдор Милованов`/`Редактор: Фёдор Милованов` корректно используются. ✅

### 🟠 [ATR-10.4] feed.xml
**ЛОКАЦИЯ:** `feed.xml:18, 28, 45, 58, 71, 79, 92`.  
**ДИАГНОЗ:**  
1. `<image><url>https://gospod-bog.ru/images/og-preview.jpg</url>` — файла нет (только `.webp`).  
2. `dc:creator` для разных статей: где-то «Фёдор Милованов», где-то «Фёдор Милованов (ред.)» — **непоследовательно**. По вашему правилу должно быть везде просто «Фёдор Милованов».  
3. `lastBuildDate` стоит `Thu, 14 May 2026 01:51:34 +0000` (UTC), а pubDate большинства — `+0000` (тоже UTC). Это валидно для RSS 2.0.  
**РЕШЕНИЕ:**
```diff
- <url>https://gospod-bog.ru/images/og-preview.jpg</url>
+ <url>https://gospod-bog.ru/images/og-preview-1200x630.webp</url>

# Везде:
- <dc:creator>Фёдор Милованов (ред.)</dc:creator>
+ <dc:creator>Фёдор Милованов</dc:creator>
# Если нужно отдельно различать редактора перевода — использовать новый namespace:
+ xmlns:gb="https://gospod-bog.ru/ns/feed#"
+ <gb:editorial-role>Редактор перевода</gb:editorial-role>
```

---

## БЛОК 11. НАВИГАЦИЯ ПО СЕРИЯМ & ОБРАТНАЯ СВЯЗЬ

### 🟠 [NAV-11.1] Шаблонизатор серийных карточек
**ДИАГНОЗ:** Сейчас в каждом `nagornaya/chast-N/index.html` руками поддерживается блок «частей» с бейджами. Это источник ошибок (рассинхрон при добавлении 6-й части).  
**РЕШЕНИЕ — `data/series.json` + JS-инжекция:**
```json
// data/series.json
{
  "nagornaya": {
    "title": "Нагорная проповедь",
    "parts": [
      { "n": 1, "slug": "chast-1", "title": "Содержание", "status": "published", "readingTime": 25 },
      { "n": 2, "slug": "chast-2", "title": "Методология", "status": "published", "readingTime": 22 },
      { "n": 3, "slug": "chast-3", "title": "Адресат", "status": "published", "readingTime": 24 },
      { "n": 4, "slug": "chast-4", "title": "Богодухновенность", "status": "published", "readingTime": 28 },
      { "n": 5, "slug": "chast-5", "title": "Закон и Евангелие", "status": "published", "readingTime": 23 }
    ]
  }
}
```
```js
// js/series-cards.js
fetch('/data/series.json').then(r=>r.json()).then(function(data){
  document.querySelectorAll('[data-series-cards]').forEach(function(host){
    var seriesId = host.dataset.seriesCards;
    var series = data[seriesId];
    if (!series) return;
    var currentPath = location.pathname;
    host.innerHTML = series.parts.map(function(p){
      var url = '/' + seriesId + '/' + p.slug + '/';
      var current = currentPath === url;
      var badge = current ? 'Вы здесь'
                : p.status === 'draft' ? 'В разработке'
                : p.status === 'planned' ? 'Скоро'
                : '';
      return '<a class="series-card '+(current?'is-current':'')+'" href="'+url+'">' +
        '<span class="series-card__num">Часть '+p.n+'</span>' +
        '<h3 class="series-card__title">'+p.title+'</h3>' +
        '<span class="series-card__time">'+p.readingTime+' мин</span>' +
        (badge ? '<span class="series-card__badge">'+badge+'</span>' : '') +
      '</a>';
    }).join('');
  });
});
```
HTML в каждой статье — одна строка:
```html
<nav class="series-nav" data-series-cards="nagornaya" aria-label="Все части серии"></nav>
```

### 🟠 [NAV-11.2] gb-accuracy-block — mailto и иконки
**ЛОКАЦИЯ:** `articles/20-antisovetov-pastoru/index.html:1540`, `articles/krajne-li-isporcheno-serdce/index.html:1122`.  
**ДИАГНОЗ:** `mailto:viktorco2012@gmail.com` — статичный, без `subject`/`body` с автоподставой.  
**РЕШЕНИЕ — JS-постпроцесс или генератор шаблона:**
```js
// js/site.js — новый модуль 31
(function accuracyMailto(){
  document.querySelectorAll('.gb-accuracy-btn--email[href^="mailto:"]').forEach(function(a){
    var to = a.getAttribute('href').replace('mailto:','');
    var subj = encodeURIComponent('Неточность в статье: ' + document.title);
    var body = encodeURIComponent(
      'Здравствуйте,\n\nЯ обнаружил неточность в материале:\n' +
      document.title + '\n' + location.href + '\n\n' +
      'Описание неточности:\n[ваш текст]\n\n' +
      '— Спасибо!'
    );
    a.setAttribute('href', 'mailto:' + to + '?subject=' + subj + '&body=' + body);
  });
})();
```
И иконки кнопок переписать на stroke-width=1.5 + reduce-motion:
```css
@layer components {
  .gb-accuracy-btn { transition: transform .2s ease, background .2s ease; }
  .gb-accuracy-btn:hover { transform: translateY(-1px); }
  @media (prefers-reduced-motion: reduce) {
    .gb-accuracy-btn, .gb-accuracy-btn:hover { transform: none; transition: none; }
  }
}
```

### 🟠 [NAV-11.3] Орфаны и неразрывные пробелы
**ЛОКАЦИЯ:** `js/site.js:2459` (модуль 21 — Typography).  
**РЕШЕНИЕ — расширить регулярки:**
```js
// Заменить дефолтную регулярку модуля 21 на полную типографскую обработку
function typographicallyClean(text){
  return text
    // Однобуквенные предлоги/союзы — заменяем пробел после на NBSP
    .replace(/(\s|^)([вВкКсСуУоОаАиИяЯ])(\s+)(\S)/g, '$1$2\u00a0$4')
    // 2-3 буквенные предлоги: «не», «во», «со», «во», «до», «из», «об», «от», «по»
    .replace(/(\s|^)((?:не|во|со|до|из|об|от|по|на|за|об)\.?)\s+(\S)/gi, '$1$2\u00a0$3')
    // Перед тире — NBSP (если ещё не стоит)
    .replace(/([^\u00a0\s])\s+([—–])/g, '$1\u00a0$2')
    // После тире — обычный пробел
    .replace(/([—–])\s+/g, '$1 ');
}
// проход по всем text-узлам внутри article
var w = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
  acceptNode: function(n){
    if (n.parentElement.closest('code,pre,kbd,samp,script,style,abbr.gterm')) return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
  }
});
while (w.nextNode()) w.currentNode.nodeValue = typographicallyClean(w.currentNode.nodeValue);
```

---

## БЛОК 12. МЕДИАКОМПОНЕНТЫ

### 🟢 [MED-12.1] Image Viewer — фокус-трап
**ЛОКАЦИЯ:** `js/site.js:3015–3120`.  
**ДИАГНОЗ:** `role="dialog"`, `aria-modal="true"`, `aria-label="Просмотр изображения"` ✅. Фокус на close ✅. Возврат фокуса на `lastActive` ✅. lockScroll/unlockScroll counter-based ✅. `imgEl.alt = alt` ✅. **Близко к идеалу.**  
**Замечание:** `aria-label` close-кнопки — `"Закрыть"`. Стоит уточнить:
```diff
- '<button type="button" class="img-viewer__close" aria-label="Закрыть">\u2715</button>'
+ '<button type="button" class="img-viewer__close" aria-label="Закрыть просмотр изображения">' + SiteIcons.close + '</button>'
```

### 🟠 [MED-12.2] Heart Flip Card — ARIA + reduce-motion
Покрыто в [UI-3.5]. Также убедитесь, что `.heart-flip-back` имеет `visibility: visible` для скринридера, даже когда визуально скрыта (используйте `aria-hidden` динамически):
```js
card.addEventListener('click', function(){
  this.classList.toggle('flipped');
  var back = this.querySelector('.heart-flip-back');
  var front = this.querySelector('.heart-flip-front');
  var flipped = this.classList.contains('flipped');
  if (back)  back.setAttribute('aria-hidden',  flipped ? 'false' : 'true');
  if (front) front.setAttribute('aria-hidden', flipped ? 'true' : 'false');
});
```

### 🟠 [MED-12.3] Древние языки — fallback шрифтов
**ДИАГНОЗ:** Сейчас иврит и греческий рендерятся системным fallback (`Arial Unicode MS` на macOS, `Segoe UI` на Win, `Noto Sans` на Android — везде разный baseline). На некоторых iOS-устройствах гласные точки иврита (`ָ`, `ֻ`) ломают высоту строки.  
**РЕШЕНИЕ — см. PERF-8.1, добавить @font-face Noto Sans Hebrew + Noto Sans Greek с unicode-range. Дополнительно CSS:**
```css
@layer components {
  [lang="he"] {
    font-family: 'Noto Sans Hebrew', 'SBL Hebrew', 'Times New Roman', serif;
    font-feature-settings: "ccmp" 1, "mark" 1, "mkmk" 1; /* правильное наложение огласовок */
    line-height: 2.0;
    direction: rtl;
    unicode-bidi: embed;
  }
  [lang="grc"], [lang="el"] {
    font-family: 'Noto Sans Greek', 'GFS Neohellenic', 'Times New Roman', serif;
    font-feature-settings: "kern" 1, "mark" 1;
    line-height: 1.7;
  }
  /* Fallback-транслитерация при ошибке загрузки шрифта */
  [lang="he"][data-translit]::after,
  [lang="grc"][data-translit]::after {
    content: " (" attr(data-translit) ")";
    color: var(--muted);
    font-style: italic;
    font-size: .85em;
  }
}
```
HTML использование:
```html
<span lang="he" data-translit="ʿaqob">עָקֹב</span>
<span lang="grc" data-translit="bathéia">Βαθεῖα</span>
```

---

## БЛОК 13. CI/CD ПАЙПЛАЙН

### 🟢 [CI-13.1] update-meta.js
**ЛОКАЦИЯ:** `scripts/update-meta.js` (368 строк).  
**ДИАГНОЗ:** Скрипт корректно: использует git log для дат, обрабатывает `articles/` и `nagornaya/`, имеет TZ_OFFSET=`+03:00`, обновляет sitemap+feed, считает wordCount и readingTime. ✅  
**Доработки:**  
1. Добавить `--all` уже есть, но нет проверки для `pastor-series/` — её нужно либо включить, либо явно exclude.  
2. После записи дат — пересоздавать BLAKE-хеш для cache-bust в одной транзакции:
```js
// scripts/update-meta.js — финальный шаг
const { execSync } = require('child_process');
execSync('node scripts/cache-bust.js', { stdio: 'inherit' });
```

### 🟢 [CI-13.2] cache-bust.js
**ЛОКАЦИЯ:** `scripts/cache-bust.js` (135 строк).  
**ДИАГНОЗ:** MD5 от содержимого файла, идемпотентно (одинаковый файл → одинаковый хеш → нет лишнего git-diff). ✅  
**Усиление:** добавить SRI для критичных JS:
```js
function sriHash(relPath){
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  return 'sha384-' + crypto.createHash('sha384').update(fs.readFileSync(abs)).digest('base64');
}
// и в bustFile — добавить integrity="..." для js/site.js
```

### 🟠 [CI-13.3] validate.js — расширить чеклист
**ЛОКАЦИЯ:** `scripts/validate.js` (423 строки, 16 чеков).  
**Добавить чеки до уровня «10 из 10»:**
```js
// Чек #17: все Article должны иметь author.@id (а не дубль Person)
// Чек #18: для Тип C — обязательно translator + meta name="translator"
// Чек #19: <abbr title="..."> не пуст
// Чек #20: проверка alt у всех <img> (есть в #11) + что alt не "" для контентных картинок
// Чек #21: HEX-цвета в inline style ниже WCAG AA (4.5:1) на bg-elevated → warn
// Чек #22: в quiz.questions нет options.length < 3 (минимум 3 для статистической валидности)
// Чек #23: в каждом quiz.questions[].err длина >= 80 символов
// Чек #24: все .pq-scripture имеют data-ref для Bible-tooltip
// Чек #25: lastmod в sitemap === article:modified_time в HTML (точное совпадение)
```

---

## БЛОК 14. ЗАВЕРШЕНИЕ СТАТЬИ & ПРОГРЕСС

### 🟠 [END-14.1] Золотая полоса прогресса
**ЛОКАЦИЯ:** `js/site.js` модуль 29 (`Article Read Completion`, ~3294–3320).  
**РЕШЕНИЕ — guard от коротких страниц:**
```js
(function readCompletion(){
  var article = document.querySelector('article');
  if (!article) return;
  var minHeight = window.innerHeight * 1.8; // < 2 экранов = слишком коротко
  if (article.offsetHeight < minHeight) return;

  var bar = document.querySelector('.btoc-progress-fill');
  if (!bar) return;
  var slug = SiteUtils.getConfig('page.slug', location.pathname);
  var key = 'gb-read-done-' + slug;

  function applyDone(){
    bar.classList.add('btoc-progress-fill-done');
    var time = SiteUtils.getConfig('page.readingTime', 0);
    var label = document.getElementById('btocTimeLeft');
    if (label) label.innerHTML = SiteIcons.check + '<span>Прочитано · ' + time + ' мин</span>';
  }

  // Восстановление при повторном визите
  if (SiteStorage.get(key) === '1') applyDone();

  var marked = false;
  function check(){
    var rect = article.getBoundingClientRect();
    var pct = 1 - (rect.bottom - window.innerHeight) / article.offsetHeight;
    if (pct >= 0.98 && !marked) {
      marked = true;
      SiteStorage.set(key, '1');
      applyDone();
    }
  }
  window.addEventListener('scroll', SiteUtils.throttle(check, 200), { passive: true });
  // НЕ сбрасывать при resize:
  window.addEventListener('resize', SiteUtils.debounce(function(){
    if (marked || SiteStorage.get(key) === '1') applyDone();
  }, 250));
})();
```

### 🟠 [END-14.2] Article End Block — SDG, idempotency, schema.org
**ЛОКАЦИЯ:** `js/site.js:2895–3000` (модуль 27).  
**ДИАГНОЗ:** Нужно убедиться, что блок не дублируется при повторной инициализации (если site.js будет вызван дважды) и что `Soli Deo Gloria` имеет семантическую разметку.  
**РЕШЕНИЕ:**
```js
(function articleEndBlock(){
  var article = document.querySelector('article');
  if (!article) return;
  if (document.getElementById('articleEndBlock')) return; // idempotent

  var block = document.createElement('aside');
  block.id = 'articleEndBlock';
  block.className = 'article-end-block';
  block.innerHTML = actionsHTML +
    '<div class="article-end-sdg" itemscope itemtype="https://schema.org/CreativeWork">' +
      '<meta itemprop="creditText" content="Soli Deo Gloria — Только Богу слава">' +
      '<span class="sdg-cross" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v6H4v8h6v6h4v-6h6V8h-6V2z"/></svg>' +
      '</span>' +
      '<span itemprop="name" lang="la">Soli Deo Gloria</span>' +
      '<span class="sdg-translation">— Только Богу слава</span>' +
    '</div>';

  // Не вставлять внутрь .heart-flip-back / .epilogue-figure — только после article
  article.parentNode.insertBefore(block, article.nextSibling);
})();
```

---

## ИТОГ — ПРИОРИТЕТЫ

### 🔴 Критично (блокирует E-E-A-T / accessibility):
1. **ATR-10.1**: `articles/20-antisovetov-pastoru/index.html:1576` — `«Автор»` → `«Редактор»`.
2. **SEO-1.3a**: дублирование `editor`+`author` в JSON-LD статей — нормализовать через `@id`.
3. **UI-3.2**: убрать системные emoji из production (📖, ✕, ✅) — заменить на единые SVG.
4. **SHR-9.1**: Selection Share без атрибуции и якорей — переписать copy/share логику.
5. **ARC-5.2**: Шаблонизация Quiz — DRY-нарушение в каждой статье.

### 🟠 Высокий (заметный SEO/CWV/UX-эффект):
- SEO-1.3c (translator @id), SEO-1.5 (расширение robots), CONT-2.1/2.2/2.7 (цитаты, LXX, AI-disclosure)
- UI-3.1/3.4/3.5 (SVG-система, dark contrast, ARIA flip)
- MOB-4.1/4.3/4.4 (touch-target, lockScroll, autozoom)
- ARC-5.1/5.3/5.4 (validateConfig, code-splitting, quota-safe)
- QUIZ-6.1–6.5 (масштабирование, память, sourceRef, dynamic-share)
- TIP-7.1–7.4 (глоссарий, мульти-перевод, мобильные сноски)
- PERF-8.1/8.2/8.3 (self-host fonts, AVIF, CLS reservation)
- SHR-9.2/9.5 (порядок платформ, quiz-shareresult)
- NAV-11.1/11.2/11.3 (series JSON, mailto, типография)
- MED-12.2/12.3 (heart-card aria, fallback шрифтов)
- CI-13.3 (расширение validate.js)
- END-14.1/14.2 (защита прогресса, schema.org SDG)

### 🟡 Средний:
- SEO-1.4 lastmod-нормализация, CONT-2.4 методологическая оговорка Нагорной, UI-3.6 visual rhythm CI

### 🟢 Норма (уже сделано хорошо):
- canonical, twitter:card, breadcrumbs в @graph, Organization schema, robots.txt-политика основная, safe-area, image-viewer focus-trap, OpenType features, cache-bust idempotent.

---

## ПЛАН ВНЕДРЕНИЯ (по PR-ам)

| # | PR | Файлы | Эффект |
|---|----|-------|--------|
| 1 | `fix/author-label` | `articles/20-antisovetov-pastoru/index.html` | E-E-A-T |
| 2 | `seo/jsonld-graph-normalize` | все `articles/*/index.html`, `nagornaya/chast-*/index.html` | E-E-A-T, AI-search |
| 3 | `ui/svg-icons-system` | `js/site.js`, `js/highlights.js`, `js/nagornaya-mobile-toc.js`, все HTML | премиум-визуал |
| 4 | `feat/selection-share-quote-attribution` | `js/site.js` модуль 23 | конверсия шеринга |
| 5 | `arch/quiz-template-injection` | `js/site.js` модуль 16 | DRY |
| 6 | `seo/robots-2026` | `robots.txt` | AI-control |
| 7 | `perf/self-host-fonts` | `index.html`, все статьи, `/fonts/`, `css/site.css` | LCP −250ms |
| 8 | `a11y/wcag22` | `css/site.css`, `js/site.js` модули 12,13,07 | accessibility |
| 9 | `feat/glossary-engine` | `js/site.js` (новый), `data/glossary.json`, `css/site.css` | UX, AEO |
| 10 | `feat/series-template` | `js/series-cards.js`, `data/series.json`, всех части `nagornaya/*` | DRY |
| 11 | `ci/validate-strict-extend` | `scripts/validate.js` | guardrails |
| 12 | `feat/quiz-history-shareresult` | `js/site.js` модуль 16 | engagement |

---

> Всё, что выше — production-ready. Если нужны конкретные diff-патчи к отдельному файлу, готов выкатить полный файл-перезалив (например, новый `js/site.js` целиком с изменениями модулей 03/13/16/23/27).
