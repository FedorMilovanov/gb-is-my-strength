# Контентно-источниковый аудит проекта `gb-is-my-strength`

**Дата:** 2026-06-06  
**Фокус:** богословская позиция, точность прямых цитат/позиций других авторов, качество ссылок на первоисточники, консервативность подачи, редакционные риски.  
**Статус:** анализ без правок контента.

---

## 1. Что проверено

### 1.1. Технически

Запущено:

```bash
npm install --no-audit --no-fund
npm run validate:all
node scripts/audit-pro.js
```

Результат:

- `validate:all` — PASS, 0 errors, 0 warnings.
- `seo-audit` — PASS.
- `audit-pro` — PASS: 35 passed, 0 warnings, 0 errors.
- Локальные ресурсы/внутренние ссылки — валидны по текущему валидатору.
- JSON-LD, OG-уникальность, attribution guard — PASS.

### 1.2. Контентно

Просмотрены:

- все статьи в `articles/*/index.html`;
- серия `nagornaya/chast-1..5`;
- вспомогательные страницы `nagornaya/istochniki`, `nagornaya/nakhodki`, `nagornaya/seriya`;
- `README.md`, `AGENTS.md`, `AUDIT_HISTORY.md`;
- блоки источников, сноски, прямые цитаты, блоки `blockquote`, позиции авторов.

### 1.3. Внешняя проверка первоисточников / надёжных источников

Проверялись не Википедия, а первоисточники или максимально близкие к ним источники:

- Rippon, *A Brief Memoir of the Life and Writings of the late Rev. John Gill, D.D.* — Internet Archive.
- PRDL — страница John Gill: 113 titles / 148 vols.
- TMSJ Volume 27/2 — Abner Chou, “A Hermeneutical Evaluation of the Christocentric Hermeneutic”.
- TMSJ Volume 30/2 — Jay Street, “Romans 7: An Old Covenant Struggle Seen through New Covenant Eyes”.
- GTY #2222 — John MacArthur, “The Spiritual Credibility Gap”.
- Ligonier guide on the Sermon on the Mount.
- Calvin on Matthew 5 via BibleHub/CCEL.
- Spurgeon sources on *The Beatitudes* and *Commenting and Commentaries*.
- CNN transcript of Dan Brown interview, 25 May 2003.

---

## 2. Общий вывод

Проект технически очень чистый: текущие валидаторы показывают зелёный статус. Контентно сайт выражает **ясную консервативную евангельскую / реформатско-баптистскую / грамматико-историческую позицию**. Это не нейтральная энциклопедия и не должно ею притворяться. В этом смысле позиция сайта честная и узнаваемая.

Но по источникам и прямым цитатам есть несколько важных редакционных рисков:

1. **Нагорная серия насыщена сильными цитатами и позициями, но почти все ссылки на источники даны текстом, без кликабельных URL.** Для читателя это резко снижает проверяемость.
2. **В ряде мест строгая позиция TMS/Thomas/Farnell/Green подана настолько сильно, что может звучать как “единственно консервативная позиция”, хотя внутри консервативного евангельского мира существуют более широкие варианты, сохраняющие inerrancy.** Это не обязательно ошибка, но нужна маркировка: “строгая линия TMS”, “позиция автора сайта”, “не вся консервативная традиция”.
3. **Серия о Джоне Гилле в целом источниково сильная, но нуждается в большем количестве прямых ссылок на первоисточники в самих статьях 2–3 и историческом контексте, а не только в справочнике.**
4. **Есть один реально битый внешний URL:** `https://commons.wikimedia.org/wiki/Nag_Hammadi_library` — отдаёт 404; вероятная замена: `https://commons.wikimedia.org/wiki/Category:Nag_Hammadi_texts`.
5. **В `rimlyanam-7...` источник Jay Street / TMSJ указан, но не кликабелен.** Это особенно важно, потому что пользователь прямо просил TMS-ссылки и первоисточники.

---

## 3. Количественная карта контента

| Файл | Слов | Внешних ссылок без Telegram | `blockquote` | `fn-marker` | Комментарий |
|---|---:|---:|---:|---:|---|
| `articles/20-antisovetov-pastoru` | 15049 | 0 | 0 | 0 | Библейско-пастырский разбор без внешней библиографии. |
| `articles/dzhon-gill-chast-1-chelovek` | 4873 | 4 | 0 | 8 | Есть Rippon/Archive, хорошо. |
| `articles/dzhon-gill-chast-2-uchenyi` | 3324 | 0 | 0 | 6 | Много фактического материала, но нет внешних ссылок в статье. |
| `articles/dzhon-gill-chast-3-nasledie` | 3916 | 2 | 0 | 8 | Есть PRDL/PhD; часть цитат требует точной привязки. |
| `articles/dzhon-gill-istoricheskiy-kontekst` | 2920 | 0 | 0 | 0 | Исторический текст без явного источникового аппарата. |
| `articles/dzhon-gill-spravochnik` | 1683 | 16 | 0 | 0 | Лучший узел источников по Gill. |
| `articles/hermenevticheskaya-otsenka...` | 11151 | 1 | 0 | 116 | Сильный аппарат сносок; TMS PDF есть. |
| `articles/kod-da-vinchi` | 6333 | 8 | 0 | 24 | Хорошо, но один битый Wikimedia URL. |
| `articles/krajne-li-isporcheno-serdce` | 9414 | 0 | 0 | 38 | Богословски сильная статья, но библиография в основном некликабельная. |
| `articles/rimlyanam-7...` | 2747 | 0 | 0 | 8 | Источники перечислены, но без URL, включая TMSJ. |
| `nagornaya/chast-1` | 3696 | 0 | 13 | 0 | Много прямых цитат, но без URL на первоисточники. |
| `nagornaya/chast-2` | 2521 | 0 | 1 | 0 | TMS-позиция сильная; нужны ссылки на TMSJ. |
| `nagornaya/chast-3` | 2807 | 0 | 4 | 0 | Есть цитаты MacArthur / Ligonier / Walvoord, но без URL. |
| `nagornaya/chast-4` | 5734 | 0 | 7 | 0 | Самая источниково требовательная страница серии; ссылки нужны обязательно. |
| `nagornaya/chast-5` | 5761 | 0 | 6 | 0 | Сильные цитаты MacArthur / Sproul / Spurgeon; нужны URL. |

---

## 4. Проверенные сильные цитаты и позиции

### 4.1. John Gill / Rippon / PRDL / Spurgeon / Toplady

**Верно / подтверждено:**

- Дата рождения Джона Гилла: Rippon указывает `Nov. 23, o. s. 1697`. По новому стилю это 4 декабря 1697. Это корректно подано в `dzhon-gill-chast-1`.
- Образ отца Гилла как человека между бедностью и богатством подтверждается текстом Rippon: “equally delivered from the snares of poverty and affluence”. Русская передача свободная, но допустимая, если она маркирована как перевод/парафраз, а не дословная цитата.
- История про дровосека и “he will be a Scholar too, and all the world cannot hinder it” подтверждается в перепечатках Rippon / ReformedReader. В статье это подано верно как предание, не как богодухновенное пророчество.
- PRDL действительно показывает John Gill `(1697–1771) / 113 titles, 148 vols.`. Это корректно.
- Spurgeon в *Commenting and Commentaries* действительно говорит о Gill как об одном из самых способных Hebraists, о его Rabbinical learning, Targums, Talmuds, Mishna, Gemara. Русская цитата в `dzhon-gill-chast-3` по смыслу точная.
- Toplady-формула “While true Religion, and sound Learning, have a single friend remaining in the British Empire...” подтверждается вторичными публикациями, воспроизводящими Toplady. Русская цитата близка.

**Нужно усилить:**

- В `dzhon-gill-chast-2` и `dzhon-gill-istoricheskiy-kontekst` нет внешних ссылок, хотя там много конкретных исторических утверждений: Salters’ Hall, Eastcheap lectures, Anthony Collins, Fabricius, Carter Lane, Goat’s Yard Declaration. Нужно добавить источниковые `fn-marker` или хотя бы секцию “Использованные источники”.
- В `dzhon-gill-chast-3` цитаты Spurgeon/Toplady/Francis хорошо работают риторически, но нужно дать ссылку не только на справочник, а прямо рядом с цитатой: CCEL / Spurgeon *Commenting and Commentaries*, Rippon / Toplady source.
- Если пользователь имел в виду “TMS-ссылку по Гиллу”, сейчас в Gill-страницах `TMS` не встречается. Есть SBJT, PRDL, Brill, Glasgow, TGC/Themelios, Rathel. Если существует нужная TMS/TMU публикация о Gill — её надо явно добавить в справочник и в релевантную статью.

### 4.2. Abner Chou / христоцентричная герменевтика

**Верно / подтверждено:**

- Статья TMSJ 27/2 действительно называется “A Hermeneutical Evaluation of the Christocentric Hermeneutic”, автор Abner Chou.
- Аннотация статьи прямо утверждает: Christocentric hermeneutic proposes a modification to grammatical-historical approach; Chou argues the alteration is not scripturally warranted, and grammatical-historical method is sufficient to discover Christ as presented in Scripture.
- Позиция сайта в статье `hermenevticheskaya-otsenka...` соответствует позиции Chou/TMS: Христос должен проповедоваться так, как Его раскрывает авторский замысел текста, а не через произвольную типологизацию.

**Нужно усилить:**

- При цитировании Chou лучше чаще различать:
  - `Christ-centered ministry` как цель;
  - `Christocentric hermeneutic` как спорный метод;
  - грамматико-исторический метод как путь к реальному Христу текста.
- Если где-то звучит “христоцентричность” как сама по себе подозрительная, это надо смягчить: подозрителен не Христос в проповеди, а метод, который читает Христа вопреки авторскому замыслу.

### 4.3. Нагорная проповедь: Calvin, Ligonier, MacArthur, Spurgeon, Sproul

**Верно / подтверждено:**

- Calvin на Matthew 5:1 действительно пишет, что различение двух разных проповедей у Matthew/Luke опирается на “very light and frivolous argument”. Русская цитата в `nagornaya/chast-1` точна по смыслу.
- Ligonier guide действительно говорит, что Luke 6 is often called Sermon on the Plain; возможно, это summary; Matthew under inspiration provides a wholly accurate summary preserving the sense of Jesus’ words. Это корректно используется в серии.
- MacArthur GTY #2222 действительно называет Matthew 5:20 ключом к Нагорной проповеди: “the key to what He says in the Sermon on the Mount is in verse 20”. Позиция сайта верно передаёт его акцент.
- Spurgeon *The Beatitudes* действительно предупреждает: первые стихи Нагорной проповеди — не “как спастись”, а “кто спасён”. Цитата в серии верна по смыслу.
- Sproul / Ligonier `Build on the Rock` действительно содержит мысль: Matthew 7:21–23 — один из самых страшных текстов; вопрос будет не “знаешь ли ты Иисуса?”, а “знает ли Он тебя?”. Русская передача в `chast-5` близка.

**Нужно усилить:**

- У всех этих цитат в `nagornaya/chast-*` нет кликабельных URL. Для такой серии это главный недостаток.
- `nagornaya/istochniki` и `nagornaya/nakhodki` тоже не дают внешних ссылок, хотя называются “источники” и “верифицированные находки”. Сейчас это скорее библиографические карточки, а не проверяемые источники.

### 4.4. Dan Brown / “Код да Винчи”

**Верно / подтверждено:**

- CNN transcript от 25 May 2003 подтверждает фразу Brown: “99 percent of it is true...” относительно архитектуры, искусства, ритуалов, истории, gnostic gospels; fiction — Robert Langdon/action. Это сильный источник.
- NBC Today / Matt Lauer “Absolutely all of it” подтверждается архивной страницей Transworld/Today transcript.
- Статья корректно замечает, что “99% правда” лучше привязывать именно к CNN, а не к NBC Today. В локальном источниковом блоке уже есть осторожная фраза: “точная цифра ‘99% правда’ в верифицированных стенограммах не подтверждается” — её надо поправить: подтверждается CNN transcript; не подтверждается именно в Today Show.

**Найденная ошибка:**

- Битая ссылка: `https://commons.wikimedia.org/wiki/Nag_Hammadi_library` — 404.
- Рекомендуемая замена: `https://commons.wikimedia.org/wiki/Category:Nag_Hammadi_texts`.

### 4.5. Romans 7 / Jay Street / Lloyd-Jones / TMSJ

**Верно / подтверждено:**

- TMS archive действительно содержит Street, “Romans 7: An Old Covenant Struggle Seen through New Covenant Eyes”, TMSJ 30/2 Fall 2019, pp. 277–302.
- В статье источник указан библиографически корректно.

**Недостаток:**

- Нет URL на TMSJ PDF: `https://tms.edu/wp-content/uploads/2021/09/TMSJ-Volume-30-Number-2.pdf`.
- Для запроса пользователя это приоритетная правка: добавить кликабельную ссылку к источнику Street.

---

## 5. Богословская оценка объективности / консервативности

### 5.1. Где сайт объективно консервативен

Сайт последовательно держит:

- высокую доктрину Писания;
- непогрешимость / безошибочность Писания;
- грамматико-историческую герменевтику;
- реформатскую антропологию греха;
- осторожность к редукционистской “христоцентрической” герменевтике;
- критическое отношение к историко-критическим предпосылкам;
- пастырскую применимость доктрины.

Это действительно консервативный профиль, не либеральный и не “серединно-академический”.

### 5.2. Где есть риск не “объективной консервативности”, а узкой TMS-подачи

Самый важный участок — `nagornaya/chast-2` и `nagornaya/chast-4`.

Фразы типа:

- “Если Матфей копировал у Марка... мы имеем дело с литературной игрой”;
- “принятие литературной зависимости логически ведёт к редакционной критике”;
- “корни литературной зависимости — те же самые корни, что и современных взглядов на ошибочность Писания”;
- “нельзя заигрывать с методом...”

— соответствуют строгой линии TMS/Farnell/Thomas, но внутри консервативного евангельского мира есть авторы, которые принимают некоторую форму литературной зависимости / Markan priority / Two-source hypothesis и при этом исповедуют inerrancy. Сайт имеет право занимать строгую позицию, но редакционно честнее сказать:

> “В строгой линии TMS это оценивается так...”

а не так, будто любая литературная зависимость автоматически равна либеральной деисторизации.

### 5.3. Как сделать позицию сильнее, а не слабее

Не надо “смягчать” убеждения сайта до нейтральности. Надо сделать их точнее:

- “Мы следуем строгой линии TMS/Thomas/Farnell/Green”.
- “Мы признаём, что некоторые консервативные евангельские учёные иначе решают синоптическую проблему, сохраняя inerrancy, но считаем их решение менее убедительным / менее безопасным”.
- “Критика направлена не против всякого сравнения источников, а против метода, который делает евангелистов свободными создателями речей Иисуса”.

Это будет объективнее и сильнее.

---

## 6. Приоритетный список правок для следующего этапа

### P0 — обязательно перед пушем

1. **Исправить 404 в `kod-da-vinchi`:**
   - было: `https://commons.wikimedia.org/wiki/Nag_Hammadi_library`
   - заменить на: `https://commons.wikimedia.org/wiki/Category:Nag_Hammadi_texts`

2. **Добавить TMSJ URL в `rimlyanam-7...` к Jay Street:**
   - `https://tms.edu/wp-content/uploads/2021/09/TMSJ-Volume-30-Number-2.pdf`

3. **В `kod-da-vinchi` уточнить формулировку про “99% правда”:**
   - сейчас: “точная цифра ‘99% правда’ в верифицированных стенограммах не подтверждается”;
   - лучше: “точная цифра ‘99%’ подтверждается CNN transcript (25 May 2003), а в Today Show подтверждается другая формула — ‘Absolutely all of it’.”

### P1 — очень желательно

4. **Добавить кликабельные источники в `nagornaya/chast-1..5` и `nagornaya/istochniki`:**
   минимум:
   - GTY #2222: `https://www.gty.org/library/sermons-library/2222/the-spiritual-credibility-gap`
   - Ligonier Sermon on the Mount guide: `https://learn.ligonier.org/guides/the-sermon-on-the-mount`
   - Calvin Matthew 5: `https://biblehub.com/commentaries/calvin/matthew/5.htm` или CCEL.
   - Spurgeon *The Beatitudes* / CCEL sermon 3156/3157/3158.
   - Ligonier Sproul `Build on the Rock`: `https://learn.ligonier.org/sermons/build-rock`
   - TMSJ Chou PDF: `https://tms.edu/wp-content/uploads/2021/09/TMSJ-Volume-27-Number-2.pdf`

5. **В `nagornaya/chast-2` и `chast-4` уточнить, что Independence View — строгая позиция TMS, а не единственный возможный консервативный вариант.**

6. **В Gill-статьях добавить источниковые ссылки прямо на страницы 2–3 и исторический контекст, а не только в справочник.**

### P2 — редакционное усиление

7. **Для `krajne-li-isporcheno-serdce` сделать кликабельную библиографию:** Calvin, Owen, Flavel, Boston, Edwards, Frame/Grudem/Berkhof и т.д. Где есть public domain — CCEL / Monergism / Archive.

8. **Для `20-antisovetov-pastoru` добавить небольшой блок источников/дисклеймер:** сейчас статья сильная пастырски, но не имеет источникового аппарата. Можно оставить как авторский анализ, но добавить: “Библейская база / пастырские категории / не юридическая инструкция”.

9. **Добавить внутренний “source coverage” валидатор:** проверять, что страницы с `blockquote` и `cite` имеют хотя бы один внешний источник или ссылку на `nagornaya/istochniki` с URL.

---

## 7. Итоговая оценка

**Техническое качество:** 9.5/10.  
**SEO/структура:** 9/10.  
**Богословская цельность:** 8.5/10.  
**Консервативность позиции:** высокая, но местами узко-TMS без достаточной маркировки.  
**Проверяемость цитат:** 6.5/10 из-за отсутствия URL в Нагорной серии и нескольких статьях.  
**Главный риск:** не фактическая ересь/ошибка, а проверяемость и риторическое overclaiming.

Сайт уже выглядит как серьёзный консервативный проект. Следующий качественный скачок — не “ещё красивее”, а **академически проверяемее**: прямые URL на первоисточники, точная маркировка “цитата / перевод / парафраз”, и честное разграничение “консервативная позиция вообще” vs “строгая линия TMS / автора сайта”.

---

## 8. Дополнение после второго источникового прохода

После первого коммита был выполнен дополнительный проход по материалам, где источниковый аппарат был слабее всего:

- `articles/krajne-li-isporcheno-serdce/` — добавлены кликабельные ссылки на проверяемые тексты Calvin, Owen, Clarkson, Spurgeon, Piper, Edwards, Boston и др. Там, где речь идёт о прямых цитатах, ссылка теперь ведёт не на Википедию, а на CCEL / Spurgeon Library / Digital Puritan / Desiring God / Monergism.
- `articles/20-antisovetov-pastoru/` — добавлена источниковая рамка: материал явно маркирован как авторский пастырский разбор, а не юридическое/клиническое заключение; добавлена библейская база, 1689 LBCF ch. 26 и два осторожных современных пастырских источника 9Marks по власти/злоупотреблению.
- `articles/dzhon-gill-chast-2-uchenyi/`, `articles/dzhon-gill-chast-3-nasledie/`, `articles/dzhon-gill-istoricheskiy-kontekst/` — усилены ссылками на первоисточники Gill / Rippon / PRDL / SBJT / официальные тексты Act of Uniformity.

Принцип второго прохода: не добавлять «для веса» случайные ссылки, а усиливать только те места, где читатель реально должен иметь возможность проверить цитату, позицию или источник факта.

---

## 9. Дополнение после третьего источникового прохода

Третий проход был направлен на Нагорную серию и справочник по Гиллу:

- `nagornaya/chast-3/` — добавлены кликабельные ссылки к Thomas, TMSJ 21/1; Turner, JETS 53/4; Ligonier Open Book interview с John MacArthur. Это закрывает ключевые тезисы о применимости Нагорной проповеди и о смягчении/пересмотре диспенсациональных позиций.
- `nagornaya/chast-5/` — добавлены ссылки к GTY #2222, GTY #2224, GTY #42-90, GTY #2252, Spurgeon/CCEL, Calvin/BibleHub, Ligonier Lordship Salvation и Ligonier/Sproul. Это усиливает проверяемость цитат по Lordship Salvation, easy-believism, Мф 7:21–23 и связи закона/Евангелия.
- `articles/dzhon-gill-spravochnik/` — расширен блок полных текстов Гилла: добавлены прямые Internet Archive ссылки на `The Doctrine of the Trinity` (1731), `A Dissertation Concerning the Antiquity of the Hebrew-Language...` (1767) и `A Body of Practical Divinity` (1770).

Все добавленные в этом проходе ключевые новые ссылки вручную проверены на доступность: GTY, Ligonier, TMSJ PDF, JETS PDF и Internet Archive отвечают 200.

---

## 10. Дополнение после общего внешнего link-аудита

Выполнен общий внешний link-аудит всех HTML-страниц сайта: найдено 111 уникальных внешних URL.

Результат:

- Реальных 404 после текущих правок не найдено.
- Остались только ответы, похожие на антибот/метод-защиту, а не битые ссылки:
  - Brill — `405 Method Not Allowed` на HEAD/автоматический запрос;
  - Wiley — `403 Forbidden`;
  - SBTS repository — `403 Forbidden`;
  - London Lyceum — ранее давал `403` на бот-запросы.
- Ключевые новые ссылки третьего прохода проверены вручную: GTY, Ligonier, TMSJ PDF, JETS PDF, Internet Archive — `200`.

Дополнительно усилена статья-перевод Abner Chou: в блок источника добавлено пояснение, что нумерованные сноски следуют аппарату оригинальной статьи TMSJ, а переводческие пояснения отмечены отдельно; добавлена библиографическая ссылка на книгу Chou `The Hermeneutics of the Biblical Writers` (Kregel Academic, 2018).
