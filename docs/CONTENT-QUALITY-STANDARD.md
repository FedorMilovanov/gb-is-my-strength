# CONTENT-QUALITY-STANDARD.md — премиум-планка контента

**Статус:** обязательный редакционный стандарт.  
**Версия:** 2026-09-07.

> **Назначение.** Этот документ задаёт reader-facing планку качества для статей,
> серий, квизов, глоссария, изображений, ссылок на Писание и типографики.
> Evidence/publication integrity задаёт `docs/EDITORIAL-SOURCE-POLICY.md`, а
> верхнеуровневую редакционную рамку — `docs/ARTICLE-STANDARD-CHARTER.md`.
>
> Техническая разметка и runtime ownership берутся из **current route family/source
> contract**, а не из исторического HTML-файла или старого JS-owner по памяти.

---

## 0. Инварианты: нарушение = не публиковать

1. **Самодостаточность.** Сложные термины и исторические реалии объяснены в прозе или
   через current glossary mechanism.
2. **По тексту и доказательству, не по памяти.** «Коротко», квиз, подписи, даты и
   числовые claims не вводят фактов, которых нет в статье/evidence.
3. **Глубина без воды.** Существенные различения и варианты раскрыты, а не сведены к
   лозунгу «верно/неверно».
4. **Evidence-first.** Исторический/богословский claim подчиняется
   `EDITORIAL-SOURCE-POLICY`; discovery-source не превращается в доказательство.
5. **Единый reader experience серии.** Части одной серии согласованы по навигации,
   терминологии и структуре, но route-specific identity сохраняется.
6. **Один semantic owner.** Quiz, reader capability, glossary data или иной контентный
   объект не поддерживается двумя независимыми handwritten копиями ради legacy parity.
7. **Профиль маршрута важнее legacy-инерции.** Strict-native route не обязан оживлять
   старый transport/HTML только потому, что прежний документ описывал его как обязательный.

---

## 1. Статья — semantic каркас

Публикуемая статья обычно содержит:

| Семантический блок | Требование |
|---|---|
| Заголовочная зона | H1 + current byline + релевантная метаинформация |
| Лид | кратко объясняет тему и её значимость |
| «Коротко» | 4–6 пунктов только из фактического тела статьи |
| Основные секции | логичные H2/H3, устойчивые якоря там, где они нужны навигации |
| Изображения/документы | по теме, с provenance/rights/alt/caption по current contract |
| Квиз, если предусмотрен route/article contract | обучает по тексту статьи |
| Источники и сверка | reader-facing библиография без внутренних repo/Drive notes |
| Авторская атрибуция | current byline/author-card contract |

Конкретные классы, Astro-компоненты и место runtime-owner не фиксируются здесь навечно.
Их определяет current source tree и route profile. Нельзя копировать старый root HTML как
«обязательный стандарт», если текущий semantic owner уже другой.

**Тон:** академически точный, живой русский, без канцелярита, искусственной важности и
непроверенной риторики.

**Объём:** тема должна быть раскрыта по своей роли. Ориентиры тиров задаёт Хартия;
механическое добивание word count водой запрещено.

---

## 2. Глоссарий и термины

### 2.1. Содержание

Глоссарное пояснение должно:

- раскрывать термин понятным русским языком;
- различать важные варианты/школы, когда они существуют;
- не подменять спорный богословский вывод словарным «определением»;
- иметь aliases/формы только там, где это действительно нужно current data schema.

`data/glossary.json` и связанные owner-controlled data меняются только по current
owner/guard rules из `AGENTS.md` и `OWNER-INVARIANTS.md`.

### 2.2. Runtime

Маркер `gterm`/tooltip или его current successor не должен всплывать в служебных зонах:
заголовках, меню, таблицах, элементах управления, «Коротко», quiz UI и hidden/meta data,
если current component contract явно не разрешает иное.

Позиционирование, focus/keyboard, Escape, mobile overflow и collision handling —
**browser/runtime contract**, а не строковый lint. Не направляйте новый strict-native код
в `js/site.js`, `enhancements.js` или другой legacy owner без проверки current route graph.

---

## 3. Серия — единая система без generic-усреднения

Для серии обязательны:

- понятное место каждой части и навигация между частями;
- единая транслитерация имён/топонимов;
- согласованные названия, статусы и количество частей в data/catalog projections;
- сохранение route/series identity: Gill, Nagornaya, Baptists и другие owner-sensitive
  миры не превращаются автоматически в один generic template;
- current reader/platform components переиспользуются там, где это предусмотрено
  ownership contract, вместо нового route-local CSS/JS engine.

Visual/reference режим определяется `docs/REFERENCE_TRANSFER_POLICY.md`, а не
универсальным процентом legacy pixel similarity.

---

## 4. Квизы — обучающий стандарт и один источник истины

Квиз — не проверка случайной памяти, а обучающий модуль по материалу статьи.

### 4.1. Semantic contract

Типовая логическая структура:

```text
quiz
├── questions
├── scores
├── bonusQuestions (если используются)
└── bonusScores (если используются)

question
├── id / type / category / difficulty
├── question
├── options
├── correct
├── explanation
└── sourceRef / article anchor
```

Точная serialization (`window.SITE_CONFIG`, component props, content data или иной
формат) определяется current route owner.

### 4.2. Single-owner rule

**Запрещён новый ручной dual-write contract** вида:

```text
Astro quiz copy
+
legacy index.html quiz copy
+
«держать побайтно одинаковыми вручную»
```

Для каждой route family должен существовать **один semantic data owner**. Legacy/shadow
поверхность, если она всё ещё нужна текущему route profile, получает данные через
детерминированную projection/adapter/generator либо явно зарегистрированный временный
contract. Второй независимый handwritten object не считается страховкой — это split-brain.

До завершения миграции конкретного старого маршрута существующий parity guard можно
сохранять как migration evidence, но он не является разрешением создавать новые двойные
источники истины.

### 4.3. Качество вопроса

- каждый вопрос строго следует статье и её evidence;
- четыре варианта, если current quiz schema требует четыре; ровно один корректный ответ;
- distractors правдоподобны, но не содержат выдуманных цитат/ссылок/дат;
- `explanation.full` объясняет, а не повторяет «верно/неверно»;
- терминологические/методологические вопросы присутствуют там, где тема их требует;
- `sourceRef` ведёт к реальному месту ответа;
- question count согласован с scoring contract;
- `correct` находится в допустимом диапазоне;
- один и тот же explanation не размножается как filler.

Анти-регрессии: старый quiz против финального текста, fictional Scripture distractor,
несовпадающие options/question, потерянный sourceRef, второй ручной owner.

---

## 5. Изображения и документальные объекты

- Размеры/srcset соответствуют реальным bytes и не создают CLS/искажение.
- `alt` и `figcaption` описывают именно показанный объект.
- Историческая фотография/скан имеет provenance и отдельно проверенный rights state.
- Наличие файла в Research/Drive/репозитории не означает право публичного
  воспроизведения.
- AI-реконструкция не выдаётся за исторический документ и не заменяет owner-protected
  изображение без прямого решения владельца.
- OG/social image существует физически и проходит current route/schema contract.
- Для exact crop/portrait/composition применяются current route visual guards, а не
  древний универсальный размер из prose.

---

## 6. Типографика и язык

- Русские кавычки — «ёлочки»; вложенные — „лапки“.
- Тире и дефис используются по назначению.
- `ё` сохраняется последовательно там, где она нужна тексту/имени.
- Нет пробела перед пунктуацией и очевидных orphan-разрывов.
- Иноязычная прямая цитата в русском reader-facing тексте имеет русский перевод.
- Имена, даты, названия трудов и транслитерация согласованы внутри серии.
- Автоматическая типографика запускается только current targeted command; repository-wide
  formatter без отдельного scope запрещён.

---

## 7. Ссылки на Писание и Bible tooltips

### 7.1. Цитатный контракт статьи

Прямая цитата Писания должна быть дословной по **явно заявленному изданию**. Current
owner invariant задаёт default; альтернативный перевод допустим, когда статья/route
явно его называет. Пересказ не оформляется как точная цитата.

Нельзя выводить правило «Новый Завет всегда перевод X» только из того, что в репозитории
существует dataset этого перевода.

### 7.2. Data contract

В репозитории сейчас могут сосуществовать verified datasets разных переводов, включая
`data/bible/synodal/` и `data/bible/kassian/`. Это **данные с собственной provenance**, а
не автоматический выбор читательского перевода для любой статьи.

Каждый scripture-data object должен сохранять:

- translation/edition identity;
- exact reference;
- verified text;
- provenance/source metadata по current schema.

Новая статья использует current Bible-reference component/runtime и тот dataset, который
соответствует заявленному переводу. Не создаётся route-local второй Bible store, если
центральный verified owner уже существует.

### 7.3. UX

Если current route contract предусматривает `.bref`/tooltip:

- полный короткий passage должен быть читаем;
- длинный passage не ломает viewport;
- целая глава не обязана инлайниться в тяжёлый tooltip;
- keyboard/focus/mobile semantics проверяются current browser contract;
- отсутствие verified текста честнее автоматической непроверенной заливки.

---

## 8. «Коротко», подписи и производные поверхности

Summary, quiz, search description, card copy и подписи — **projections смысла статьи**.
Они не имеют права вводить новый факт, новую дату, новую цитату или более сильный verdict,
которых нет в evidence-backed основном материале.

Если projection генерируется автоматически, её machine owner должен быть один и
детерминированный. Ручное параллельное редактирование source + projection допускается
только там, где current contract явно считает оба самостоятельными reader surfaces.

---

## 9. Контентная проверка перед публикацией

```text
□ Термины объяснены; glossary data/aliases валидны по current schema.
□ Summary не добавляет новых claims.
□ Quiz следует статье, имеет один semantic owner и проходит current schema/runtime checks.
□ Изображения имеют корректные bytes/dimensions/alt/caption/provenance/rights.
□ Прямые цитаты и Писание совпадают с заявленным edition/version.
□ Reader-facing sources не содержат внутренних Research/Drive paths и TODO/HOLD notes.
□ Серийные data/card/navigation projections согласованы с content owner.
□ Нет нового legacy transport или route-local duplicate engine без explicit contract.
□ Запущены применимые targeted source/content/browser/visual checks на final head.
```

Технические checks выбираются по `AGENTS.md` + `docs/WORK_MODES.md`; этот документ не
навязывает `validate:all`/`audit-pro` каждому content diff и не объявляет один конкретный
legacy runtime вечным владельцем UI.
