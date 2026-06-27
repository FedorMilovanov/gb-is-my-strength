# Floating Cluster / Hermeneutics / Gill — ЗАПРЕТЫ и ЭТАЛОННЫЕ ИСТИНЫ (читать ПЕРЕД любой правкой визуала)
**Статус:** ОБЯЗАТЕЛЬНО. Owner-approved. Нарушение = регрессия, которую owner уже ловил неделями.
**Эталон (единственный источник правды по визуалу):** `uploads/gb-floating-cluster-probe-v16.html` (HTML-образец).
**Подробный технический аудит со всеми нюансами, доказательствами и пошаговым playbook — в AuditRepo:**
→ `projects/<project>/working/SURGICAL_FIX_PLAYBOOK_2026-06-27_hermeneutics-and-gill-complete.md`
→ `projects/<project>/reverify/CURRENT_HEAD_REVERIFY_2026-06-27_position-truth-and-toc-images.md`
→ `projects/<project>/reverify/CURRENT_HEAD_REVERIFY_2026-06-27_gill-browser-witness-and-root-cause.md`
→ `projects/<project>/reverify/CURRENT_HEAD_REVERIFY_2026-06-27_remote-head-6dc6477_source-vs-built-desync.md`
(репозиторий аудита: github.com/FedorMilovanov/AuditRepo)

> Агент: собираешься «подвинуть значки», «подогнать расстояние», «сделать покрасивее»? СТОП.
> Сначала прочти этот файл и подробный аудит в AuditRepo. Метод тыка (то близко, то далеко) ЗАПРЕЩЁН.
> Берётся ГОТОВЫЙ отчёт/эталон, а не выдумывается формула. Симптом не лечится на легаси-структуре — мигрируй на эталон.

---

## 🔴 ЗАПРЕЩЕНО (hard NO)
1. НЕ выдумывать формулу позиции Hermeneutics. НЕ писать `right: calc((100vw - min(820px,92vw))/2 - Npx)`. Это давало «впритык к тексту».
2. НЕ подгонять расстояния на глаз / по скриншоту / итеративно.
3. НЕ матчить под DALLE-скриншоты. Только HTML-образец. (Уже вызвало R9-регрессию: белые кружки 48px вокруг Play/Save — откат 08432bf.)
4. НЕ добавлять halo/кружок к `gb-save` (намеренно без `::before`).
5. НЕ вставлять картинки/мини-превью в оглавления Гилла (`gbs2-thumb`, любые `<img>` в списках частей/глав). Это baptisty-паттерн, не Gill.
6. НЕ трогать play-expand (`initPlayExpand()`, `.gb-ember-expand*`, speed-pill CSS) — owner отложил.
7. НЕ считать source-правку завершённой без production-like пересборки и коммита `articles/*/index.html`. Артефакт прода = strangler build.
8. НЕ удалять `gbs2-*` маркеры, проверяемые `owner:ui-guard`, без разрешения конфликта с гардом в той же ветке.
9. ДЛЯ ГИЛЛА: НЕ лечить симптом (ellipsis на `gbs2-mobile-head` и т.п.) на ЛЕГАСИ-структуре. Части мигрируются на эталон gill-context, а не латаются.

## ✅ ЭТАЛОННЫЕ ИСТИНЫ (брать 1-в-1)

### A. Hermeneutics standalone — позиция (исторический `.theme-toggle` из css/site.css)
```css
.gb-floater--hermeneutics { top: calc(clamp(24px,3.5vw,44px) - 4px); right: max(8.5vw, env(safe-area-inset-right,0px)); }
@media (max-width:899px){ .gb-floater--hermeneutics { right: max(4.5vw, env(safe-area-inset-right,0px)); } }
```
Мобайл standalone отдельно становится нижней горизонтальной pill (скруглённый контур) — это правильно, не трогать.

### B. Gill — единый эталонный блок (desktop + mobile) = `src/components/article-pilots/gill-context/GillContextPageChrome.astro`
- desktop: `gbs-rail` + `gbs-rail-card` (римские I–V) + `gbs-rail-foot` (Theme|Search|A−|A+|Play 32px|Save 32px, `space-between`, без бокса).
- mobile: `mobile-bottom-bar` (скруглённый контур) = TOC | секция | золотая линия | % | (theme/search/play). Save НЕ в баре — он в Part-TOC popup (`toc-sheet__actions`).
- popups: `#seriesTocOverlay` (`toc-item` римские) + `#partTocOverlay` (`toc-part-item` + actions).
ВСЕ 5 страниц Гилла должны быть на ЭТОЙ структуре. Разница только в данных части. Никаких отдельных «других блоков».

### C. Gill footer `[data-gill-v16] .gbs-rail-foot`
`justify-content:space-between; gap:0; padding-top:12px;` без border-radius/background. Кнопки 32×32, ember `--ember-size:32px`, save 32×32. Селектор ВСЕГДА `.gbs-rail-foot` (с `s`); опечатка `.gb-rail-foot` = мёртвые правила = «огромные значки» (VR-07).

### D. Оглавления Гилла — только римские, без картинок
`toc-item__num`/`toc-part-item__num`/`gbs-rail-card__num` = римские с hover (scale, gold-bright), тон под гамму серии. Без `<img>`/`gbs2-thumb`.

### E. КРИТИЧНО: атрибут `data-gill-v16`
Весь v16-CSS Гилла скоуплен под `[data-gill-v16]`. Если built-страница его НЕ содержит — стили мертвы, римские становятся СИНИМИ (наследуют `--color-link`), layout ломается. После КАЖДОЙ пересборки проверять: `grep -c data-gill-v16 articles/dzhon-gill-*/index.html` ≥ 1 на каждой.

---

## ПОРЯДОК ДВИЖЕНИЯ К ЭТАЛОНУ
1. Hermeneutics (одиночная) — позиция A + мобильная pill — идеал.
2. Gill Часть 1 (серия) — миграция на gill-context (B/C/D/E) — идеал.
3. После owner-аппрува пилота — части 2/3/справочник, затем остальной сайт (та же структура/блоки, с учётом цветовой гаммы каждой страницы).

## ПРОВЕРКА КАЖДОЙ ПРАВКИ
```bash
grep -n "gb-floater--hermeneutics" css/floating-cluster.css           # right=max(8.5vw,...), НЕ calc
grep -rn "gb-rail-foot" css/ js/ src/ | grep -v gbs-rail-foot         # =0
for p in dzhon-gill-istoricheskiy-kontekst dzhon-gill-chast-1-chelovek dzhon-gill-chast-2-uchenyi dzhon-gill-chast-3-nasledie dzhon-gill-spravochnik; do
  echo "$p: v16=$(grep -c data-gill-v16 articles/$p/index.html) thumb=$(grep -c gbs2-thumb articles/$p/index.html) foot=$(grep -c gbs-rail-foot articles/$p/index.html)"
done   # v16>=1, thumb=0, foot>=1 (после миграции)
```
Затем: `strangler:build:production-like` + commit dist, `validate:static-publication`, `owner:ui-guard`, cache-bust.
