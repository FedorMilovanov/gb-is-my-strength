# v1 — ранние DALL-E референсы (style exploration)

**Дата:** 2026-06-20 (первая итерация)  
**Источник:** ChatGPT Image generation  
**Назначение:** общий стиль и композиция для `/rodosloviye/`  

---

## ⚠️ Дисклеймер

Эти 7 PNG-файлов — **ранние эксперименты** с DALL-E. Они не финальные референсы — только exploration:
- Общая эстетика (cream/beige + gold)
- Общая композиция (sidebar + canvas + minimap)
- Идея messianic tree от Адама до Христа

**НЕ копировать буквально.** Для более детальных визуальных состояний см. [`../v2-visual-tree-states/`](../v2-visual-tree-states/).

---

## Файлы

| Файл | Что показывает |
|---|---|
| `v1-messianic-tree-detail-3.png` | Общая messianic line Адам → Христос с золотой нитью |
| `v1-messianic-tree-detail-4.png` | Тот же messianic tree + открытая панель персоны (David) |
| `v1-messianic-tree-detail-5.png` | Фильтрованный вид (Тамарь/Thamar highlighted как важный узел) |
| `v1-messianic-tree-detail-6.png` | Подсвеченная messianic линия с приглушёнными боковыми ветвями |
| `v1-messianic-tree-detail-7.png` | Сравнение Матфей 1 vs Лука 3 (две колонки) |
| `v1-messianic-tree-detail-8.png` | Overview карта (mini-map в углу) |
| `v1-messianic-tree-detail-9.png` | Отдельный скрин — структура страницы |

---

## Что брать от v1

✅ **Композиция:** sidebar слева (era icons), canvas в центре, minimap справа, detail panel справа.  
✅ **Цвета:** cream/beige фон (`#fdfcf9`-like), gold акценты (`#d4a857`, `#c4a04a`), blue для Луки (`teal`), purple для Матфея.  
✅ **Шрифты:** serif (Playfair Display-style для заголовков), sans для UI.  
✅ **Эстетика:** premium "scholarly atlas" feel — мягкие тени, закруглённые углы, библиотечная палитра.

❌ **Что НЕ брать:** конкретные имена/позиции/связи — это DALL-E, могут быть неточны. Использовать только как композиционный inspiration.

---

## Сравнение с v2

| Аспект | v1 (эти файлы) | v2 (9 файлов) |
|---|---|---|
| Количество визуальных состояний | 1 общее | 9 разных состояний |
| Bug overlay | нет | `v2/03-bug-overlay-visual-errors.png` — антипаттерны |
| Post-Christ слой | нет | `v2/05-post-christ-and-early-church.png` |
| Levites / priests | нет | `v2/09-levites-priests-service-tree.png` |
| Split view | один скрин | `v2/07-split-view-matthew-luke-comparison.png` |
| Detail panel | один скрин | `v2/04-patriarchal-close-up-abraham.png` (Тамарь highlighted) |

→ Используйте v2 для **детальных состояний**, v1 для **общего стиля**.
