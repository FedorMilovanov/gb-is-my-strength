# Пи-Гахироф — Product uncertainty release

**Дата:** 2026-08-02  
**Product authority:** `PRODUCT-ATLAS-PIHAHIROTH-UNCERTAINTY-2026-08-02`  
**Research authority:** `ATLAS-PIHAHIROTH-AUTHORITY-2026-08-02`  
**Маршрут:** `/karty/ishod/`  
**Статус документа:** implementation committed; CI/browser witness pending.

## 1. Что изменено

Исторический `karty/ishod/route.json` сохраняется побайтно как forensic source и закреплён Git blob SHA:

`f1cb58be907efb0fb9cfa8bc344b07b5cf84edb2`

До создания карты native Astro adapter загружает `pihahiroth-authority.json` и выполняет ограниченную projection-транзакцию:

1. единственная историческая точка `pihahiroth` исключается из stage-path и скрывается до первого кадра;
2. point-bound `water-split` signature удаляется;
3. одиночный waypoint `wp-suez` удаляется;
4. старый dispute/scientific-variant runtime заменяется current Research authority;
5. фотографии старой точечной реконструкции не публикуются;
6. создаются три кликабельных SVG-коридора собственной схематической геометрии;
7. каждый коридор открывает одно общее evidence-panel, а не отдельную «доказанную координату».

## 2. Публичные коридоры

| Feature ID | Публичная метка | Статус | Confidence |
|---|---|---|---|
| `PH-CAND-NORTH` | Северный прибрежный / Сирбонисский коридор | `ALTERNATIVE` | `LOW` |
| `PH-CAND-BALLAH` | Озёра Баллах / север Суэцкого перешейка | `CANDIDATE` | `MODERATE_LOW` |
| `PH-CAND-BITTER` | Озеро Тимсах / Горькие озёра | `CANDIDATE` | `MODERATE_LOW` |

Обязательная reader-label:

> Точное место Пи-Гахирофа и перехода не установлено; показаны исследовательские коридоры, а не найденная точка.

Геометрия не копирует карту современного автора. Все три path являются `ORIGINAL_SCHEMATIC_GEOMETRY` и привязаны только к Research source/constraint IDs.

## 3. Evidence и rights

Machine authority сохраняет:

```text
3 CANDIDATE CORRIDORS
8 TEXTUAL CONSTRAINTS
9 SOURCES
0 AUTHORITATIVE POINTS
0 DIRECT QUOTES APPROVED
EXTERNAL SCHOLAR MAPS REPRODUCED: FALSE
EXTERNAL IMAGE REQUIRED: FALSE
```

Research snapshots:

- current authority: `bd1617782796dc9a56b2791b3d07351dc42a245e`;
- machine registry: `a0bc169f735444da661a9a7348c99e467a715991`.

## 4. Fail-closed gates

### Static contract

`scripts/pihahiroth-uncertainty-release-contract.mjs` проверяет:

- exact Research/Product authority IDs;
- Git blob исторического `route.json`;
- 3 corridor IDs, distinct geometry, status/confidence, source bindings и rights;
- exact PH-T01–PH-T08 и PH-S01–PH-S09 sets;
- нулевые authoritative points и direct quotes;
- скрытие исторического marker;
- удаление `wp-suez` и point signature;
- replacement старых scientific variants;
- no-JS fallback;
- отсутствие запрещённых формулировок в публичной authority/adapter surface.

### Browser contract

`scripts/pihahiroth-uncertainty-browser-contract.mjs` проверяет в Chromium:

- desktop 1440×900;
- mobile 390×844;
- JavaScript-disabled mobile;
- три SVG paths и их exact IDs;
- path length, pointer/focus contracts, confidence, rights и source IDs;
- исторический marker существует только как скрытый forensic node;
- signature и `wp-suez` отсутствуют;
- click по corridor открывает Pihahiroth evidence-panel;
- panel показывает три competing corridors и не показывает запрещённые fringe-claims;
- no-JS fallback видим поверх canvas и перечисляет все три corridors.

## 5. Что не заявляется

Этот release не утверждает:

- точную координату Пи-Гахирофа;
- точную координату перехода;
- совпадение современных береговых линий с поздним бронзовым веком;
- уникальную идентификацию Мигдола или Ваал-Цефона;
- доказательство события одной гидродинамической моделью;
- закрытие остальных atlas review/rights вопросов.

## 6. Witness boundary

До успешного workflow `.github/workflows/pihahiroth-uncertainty-release.yml` статус остаётся:

```text
IMPLEMENTATION COMMITTED
STATIC CONTRACT COMMITTED
BROWSER CONTRACT COMMITTED
PRODUCTION-LIKE BUILD WITNESS: PENDING
CHROMIUM DESKTOP/MOBILE/NO-JS WITNESS: PENDING
RESEARCH PRODUCT-GATE CLOSURE: NOT YET RECORDED
```

После зелёного run Research current authority может снять только конкретный Product implementation gate для Пи-Гахирофа и должна зафиксировать exact Product head/run/artifact. Остальные внешние или редакционные atlas gates этим не закрываются.
