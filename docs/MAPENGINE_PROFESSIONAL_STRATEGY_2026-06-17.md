# MAPENGINE — ПРОФЕССИОНАЛЬНАЯ СТРАТЕГИЯ РАЗВИТИЯ

> **Дата:** 2026-06-17
> **Контекст:** Движок v0.7.0 (799 строк). Авраам (4776 строк) — свой рендеринг.
> Модули в `modules/` — мёртвый код. 9 карт используют `createMap()`.

## КОРНЕВАЯ ПРОБЛЕМА

Авраам был первой картой. Он создавался как standalone-шедевр: 21 премиум-фича,
63 CSS-анимации, GSAP. Когда позже написали `map-engine.js`, Авраам уже
существовал. Движок был «прикручен сбоку» — только для DATA API (validate,
compare). Рендеринг Авраама — 68 собственных функций.

Попытка «модульного» рефакторинга (`9315a510`) сломала Авраама и потребовала
5 коммитов восстановления (`c94a3298`–`22abf658`).

## СТРАТЕГИЯ: НЕ ТРОГАТЬ АВРААМА, УСИЛИВАТЬ ДВИЖОК

```
          ┌──────────────────────────────────┐
          │        MAPENGINE (v0.7.0)         │
          │   createMap() — 9 карт используют  │
          │   + фото-модалка      (v0.8)       │
          │   + интро-экран       (v0.8)       │
          │   + тур-прогресс      (v0.8)       │
          │   + таймлайн-интеграция (v0.9)     │
          │   + слои/легенда      (v0.9)       │
          └──────────────────────────────────┘
                         ↑
          новые карты используют движок
                         
          ┌──────────────────────────────────┐
          │     AVRAAM (4776 строк)           │
          │   Свой рендеринг — НЕ ТРОГАТЬ     │
          │   Использует engine: DATA only    │
          │   Защищён: avraam:audit 23/23    │
          └──────────────────────────────────┘
```

**Правило:** новые карты = ТОЛЬКО движок. Авраам = как есть.
Когда движок накопит 80%+ фич Авраама — можно будет портировать.

## ПЛАН ИЗВЛЕЧЕНИЯ ФИЧ (в порядке приоритета)

### Фаза 1: HIGH reuse (все карты) — v0.8

| # | Фича | Польза | Сложность |
|---|---|---|---|
| 1 | **Фото-модалка** | 8/10 карт имеют фото. Полноэкранный просмотр. | MEDIUM |
| 2 | **Интро-экран** | Welcome screen с заголовком, ивритом, кнопкой «Начать» | LOW |
| 3 | **Тур-прогресс бар** | Визуальный индикатор авто-тура | LOW |
| 4 | **Таймлайн этапов** | Временная шкала с кликабельными точками | MEDIUM |

### Фаза 2: MEDIUM reuse — v0.9

| # | Фича | Польза | Сложность |
|---|---|---|---|
| 5 | **Слои/фильтры** | Переключатели слоёв карты | MEDIUM |
| 6 | **Поиск по контенту** | Поиск не только по названию, но и по story/bible/arch | MEDIUM |
| 7 | **Контекстные маркеры** | Дополнительные точки на карте (города, регионы) | MEDIUM |

### Фаза 3: LOW reuse (визуальные) — v1.0

| # | Фича | Польза | Сложность |
|---|---|---|---|
| 8 | **Миникарта** | Обзорная карта в углу | HIGH |
| 9 | **Караван-анимация** | Декоративная анимация | HIGH |
| 10 | **Ночные звёзды** | Декоративный SVG-фон | LOW |

## ЧТО НЕ ДЕЛАТЬ

- ❌ Не пытаться портировать Авраама на движок «одним махом»
- ❌ Не удалять модули в `modules/` — они могут пригодиться при интеграции
- ❌ Не дублировать код из Авраама в движок — извлекать, не копировать
- ❌ Не добавлять в движок визуально-специфичные фичи (караван, звёзды)
- ❌ Не менять API `createMap()` — добавлять опции, не ломая существующие

## КАК ТЕСТИРОВАТЬ

Каждое извлечение фичи:
1. Добавить в engine
2. Протестировать на ishod (самая простая карта)
3. Протестировать на pavel (карта с фото)
4. Убедиться: `npm run maps:validate` зелёный
5. Убедиться: `npm run avraam:audit` всё ещё 23/23
6. Только потом коммитить



## EXTRACTION STATUS (2026-06-17 end of session)

### DONE (9 features from Avraam → Engine)

| Version | Feature | Lines | Benefit |
|---|---|---|---|
| v0.8 | Photo modal | +97 | Fullscreen photo viewer for all 8 maps with photos |
| v0.8 | Intro screen | +97 | Welcome overlay with title, Hebrew, stats |
| v0.9 | Timeline | +142 | Clickable stage dots with era labels |
| v0.9 | Layer toggles | +142 | iOS-style switches for map layer visibility |
| v0.10 | Content search | +18 | Search inside story/bible/arch/kick text |
| v0.10 | data-layer attrs | +18 | Markers tagged for layer toggle control |
| v0.11 | CTX markers | +48 | Dimmed geographic reference points on map |
| v0.11 | Compass rose | +48 | N/S/E/W indicator with gold accent |
| v0.12 | Stage caption | +62 | Floating stage title during tour with dot nav |

### Engine stats

| Metric | v0.7 (start) | v0.12 (now) |
|---|---|---|
| Lines | 799 | **1165** |
| Features | 16 | **25** |
| Event listener leaks | 19 unremoved | **0 (all tracked)** |
| Timer leaks | 9 setTimeout, 1 clear | **7 _tm() tracked** |
| Destroy method | innerHTML only | **_cleanupAll()** |
| Photo modal | ❌ | ✅ |
| Intro screen | ❌ | ✅ |
| Timeline | ❌ | ✅ |
| Layer toggles | ❌ | ✅ |
| Content search | name only | **name + content** |
| CTX markers | ❌ | ✅ |
| Compass | ❌ | ✅ |
| Stage caption | ❌ | ✅ |

### What remains in Avraam (NOT extracting)

These are visual/decorative features specific to the Abraham map.
Low reuse value — not worth extracting:

- Night stars / star field — decorative SVG
- Coordinate grid — decorative
- Fog layer — visual effect
- Ambient chords — audio
- Life timeline — Abraham-specific chronology
- Measure tool — niche feature
- GSAP — animation library (heavy dependency)
- Walker figure — Abraham-specific
- Minimap — complex + Avraam-specific
- Cartouche — decorative
- Caravan — decorative animation

### Current status

```
Engine:         1165 lines, 25 features, 10 maps use createMap()
Avraam:         4776 lines, 21 premium features — UNTOUCHED
Gates:          maps:validate 10/10 ✅, avraam:audit 23/23 ✅
Deploy:         dist (production) ✅
```

