# Gill content integrity audit — 2026-06-21

**Причина проверки:** владелец заметил, что Gill-кластер может визуально ощущаться «меньше», чем должен быть, и попросил проверить, не утеряны ли абзацы или крупные куски материала.

**Метод:**
- `data/public-content-baseline.json`
- `scripts/check-mdx-html-parity-v2.js`
- прямой подсчёт paragraphs / headings / figures по текущим HTML-файлам
- проверка current legacy root и текущего rollback-safe rendering path

---

## 1. Короткий вывод

По состоянию на 2026-06-21 **признаков крупной утраты материала в Gill-кластере не найдено**.

Наоборот, цифры показывают, что Gill-серия остаётся большой и плотной:

- **Трилогия Gill I–III = 22,734 слова** по `data/public-content-baseline.json`
- **Gill-кластер целиком (I–III + контекст + справочник) = 27,911 слов**

Это не «маленький набор заметок», а полноценный крупный корпус.

---

## 2. Baseline объём Gill-кластера

Источник: `data/public-content-baseline.json`

| Страница | Baseline words |
|---|---:|
| `dzhon-gill-chast-1-chelovek` | 5,964 |
| `dzhon-gill-chast-2-uchenyi` | 7,048 |
| `dzhon-gill-chast-3-nasledie` | 9,722 |
| `dzhon-gill-istoricheskiy-kontekst` | 3,242 |
| `dzhon-gill-spravochnik` | 1,935 |

### Суммы
- **Gill trilogy I–III**: **22,734**
- **Gill cluster total**: **27,911**

Практически это означает:
- Part I — уже средняя/большая статья;
- Part II — большая;
- Part III — очень большая;
- плюс отдельный контекстный эссе-текст и справочник.

---

## 3. Current parity snapshot — есть ли текстовая усушка

Источник: `scripts/check-mdx-html-parity-v2.js`

| Статья | MDX words | HTML words | Diff | Статус |
|---|---:|---:|---:|---|
| `dzhon-gill-chast-1-chelovek` | 6,586 | 6,613 | -27 | ✅ within tolerance |
| `dzhon-gill-chast-2-uchenyi` | 7,865 | 7,934 | -69 | ✅ within tolerance |
| `dzhon-gill-chast-3-nasledie` | 10,830 | 10,912 | -82 | ✅ within tolerance |
| `dzhon-gill-istoricheskiy-kontekst` | 3,514 | 3,385 | +129 | ✅ within tolerance |
| `dzhon-gill-spravochnik` | 1,857 | 1,877 | -20 | ✅ within tolerance |

### Интерпретация

Если бы где-то действительно «отвалились абзацы», мы ожидали бы:
- крупный word-count drop,
- провал parity threshold,
- расхождение H2/H3 структуры,
- заметную разницу между MDX и live HTML.

Этого **не видно**.

Во всех пяти Gill-страницах:
- word-count parity остаётся в допустимых пределах;
- нет признаков massive content loss;
- различия — точечные и структурные, а не катастрофические.

---

## 4. Структурная плотность current HTML

Ниже — прямой текущий снимок по HTML-телу статей (legacy root), чтобы оценить «массу текста» не только по словам, но и по реальной длине композиции.

| Страница | Paragraphs | H2 | H3 | Figures |
|---|---:|---:|---:|---:|
| `dzhon-gill-chast-1-chelovek` | 71 | 4 | 18 | 6 |
| `dzhon-gill-chast-2-uchenyi` | 107 | 4 | 29 | 3 |
| `dzhon-gill-chast-3-nasledie` | 135 | 3 | 38 | 3 |
| `dzhon-gill-istoricheskiy-kontekst` | 42 | 12 | 1 | 8 |
| `dzhon-gill-spravochnik` | 15 | 11 | 2 | 1 |

### Что это говорит

- Part I — это уже длинная биографическая статья, не short-form;
- Part II и особенно Part III — очень плотные по paragraph count;
- `istoricheskiy-kontekst` компактнее, но по жанру это отдельный context-essay, а не часть основной триады;
- `spravochnik` и должен быть компактнее, потому что это reference node, а не narrative longread.

То есть ощущение «Gill какой-то маленький» **не подтверждается общей структурой**.

---

## 5. Где у Gill есть реальные проблемы — но не про потерю абзацев

### 5.1 Есть semantic drift warnings

У Gill есть предупреждения по semantic parity:
- `chast-1`
- `chast-2`
- `chast-3`
- `spravochnik`

Типы расхождений:
- `h2`
- `a`
- местами wrapper-структура

Но это **не выглядит как потеря больших фрагментов текста**.

### 5.2 Есть ощущение «меньше» из-за presentation-layer

Возможные причины, почему Gill визуально может казаться меньше владельцу:

1. **full-document shadow rollback** спрятал native/MDX-слой и вернул legacy transport;
2. часть semantic enhancements не живёт в production нативно;
3. плотный GBS2 chrome + visual shell может делать длинный текст менее «монументальным» на ощущение;
4. context/spravochnik естественно короче trilogy parts, и если смотреть не на триаду, а на отдельные сопутствующие тексты, возникает ощущение «маловато».

### 5.3 Исторически Gill уже усиливали, а не сокращали

Старые audit/source-ingestion файлы показывают, что в июне Gill-страницы скорее **обрастали**:
- первоисточниками,
- ссылками,
- уточнениями,
- image/caption work,
- GBS shell refinement.

Признаков deliberate shrink в текущем состоянии не найдено.

---

## 6. Самая важная проверка

### Если смотреть только на главную трилогию:

- Part I = **5,964** baseline words
- Part II = **7,048** baseline words
- Part III = **9,722** baseline words

Это означает, что серия идёт по нарастающей и завершается самой большой частью.

Такой профиль скорее говорит о:
- нормальной крупной авторской серии,
- а не о том, что при миграции «где-то выпали абзацы».

---

## 7. Verdict

### Что НЕ подтверждается
- что Gill-кластер «схлопнулся» до коротких статей;
- что при последних rollback/refactor wave были потеряны большие абзацы или целые разделы;
- что trilogy стала аномально маленькой.

### Что подтверждается
- Gill-корпус по-прежнему большой;
- trilogy I–III остаётся полноценной длинной серией;
- major paragraph loss сейчас не виден ни по baseline, ни по parity, ни по paragraph density.

### Самая честная формула

> На 2026-06-21 Gill не выглядит content-truncated. Реальная проблема там скорее в semantic/native delivery gap и в presentation-layer ощущении, а не в доказанной потере крупных абзацев.

---

## 8. Что можно сделать дальше

Если владелец всё ещё чувствует, что Gill «визуально маловат», логичный следующий шаг — **не искать пропавшие абзацы вслепую**, а сделать отдельно:

1. **visual reading audit Gill trilogy**
   - длина first-screen,
   - насыщенность section rhythm,
   - hero/body proportion,
   - GBS2 chrome vs text mass.

2. **section-by-section content audit**
   - сравнить narrative promises vs actual section depth,
   - проверить, не слишком коротки некоторые H2-блоки при большом общем word-count.

3. **source-density audit**
   - особенно для `chast-2`, `chast-3`, `istoricheskiy-kontekst`,
   - чтобы усилить не объём ради объёма, а интеллектуальную плотность.
