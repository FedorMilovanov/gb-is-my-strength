# Reader R5 overlay runtime inventory

- Source: `5fdcba10223ffec346c050a3477624811277d102`
- Scanned files: **779**
- Pattern matches: **4851**
- Direct writer files: **9**
- Global scroll API overwrite files: **2**
- Multi-category lifecycle candidates: **77**

## Counts by rule

- `body-style-writer`: 33
- `escape-handler`: 28
- `focus-operation`: 149
- `global-scroll-api-write`: 3
- `html-style-writer`: 4
- `keydown-handler`: 145
- `overlay-dialog-semantics`: 3068
- `overlay-naming`: 1287
- `route-recovery`: 17
- `scroll-api`: 116
- `style-remove-property-writer`: 1

## Direct body/html style writers

### `_build-tools/konfessii-baptizm/MindMap3D.tsx`

- L606 · `body-style-writer` · body.style.overflow = 'hidden';
- L610 · `body-style-writer` · body.style.overflow = prevBodyOverflow;

### `js/floating-cluster-controller.js`

- L1379 · `body-style-writer` · document.body.style.overflow = 'hidden';
- L1398 · `body-style-writer` · document.body.style.overflow = '';
- L2071 · `body-style-writer` · document.body.style.overflow = 'hidden';
- L2083 · `body-style-writer` · document.body.style.overflow = '';

### `js/site-utils.js`

- L41 · `body-style-writer` · body.style.position === 'fixed' &&
- L42 · `body-style-writer` · body.style.overflow === 'hidden' &&
- L44 · `body-style-writer` · body.style.width === '100%'
- L131 · `body-style-writer` · body.style.overflow = 'hidden';
- L133 · `body-style-writer` · body.style.position = 'fixed';
- L134 · `body-style-writer` · body.style.top = '-' + savedScrollY + 'px';
- L135 · `body-style-writer` · body.style.left = '0';
- L136 · `body-style-writer` · body.style.right = '0';
- L137 · `body-style-writer` · body.style.width = '100%';

### `js/site.js`

- L143 · `body-style-writer` · (),function(){var e=document.querySelector(".article-list");function t(e){var t=(e||"/").replace(/index\.html$/,"").replace(/\/$/,"");return t&&"/"!==t.charAt(0)&&(t="/"+t),t||"/"}function n(){if(window.BookmarkEngine&&"function"==typeof window.BookmarkEngine.getAllForSite){var n=window.BookmarkEngi
- L143 · `body-style-writer` · (),function(){var e=document.querySelector(".article-list");function t(e){var t=(e||"/").replace(/index\.html$/,"").replace(/\/$/,"");return t&&"/"!==t.charAt(0)&&(t="/"+t),t||"/"}function n(){if(window.BookmarkEngine&&"function"==typeof window.BookmarkEngine.getAllForSite){var n=window.BookmarkEngi
- L143 · `html-style-writer` · (),function(){var e=document.querySelector(".article-list");function t(e){var t=(e||"/").replace(/index\.html$/,"").replace(/\/$/,"");return t&&"/"!==t.charAt(0)&&(t="/"+t),t||"/"}function n(){if(window.BookmarkEngine&&"function"==typeof window.BookmarkEngine.getAllForSite){var n=window.BookmarkEngi
- L143 · `html-style-writer` · (),function(){var e=document.querySelector(".article-list");function t(e){var t=(e||"/").replace(/index\.html$/,"").replace(/\/$/,"");return t&&"/"!==t.charAt(0)&&(t="/"+t),t||"/"}function n(){if(window.BookmarkEngine&&"function"==typeof window.BookmarkEngine.getAllForSite){var n=window.BookmarkEngi
- L143 · `style-remove-property-writer` · (),function(){var e=document.querySelector(".article-list");function t(e){var t=(e||"/").replace(/index\.html$/,"").replace(/\/$/,"");return t&&"/"!==t.charAt(0)&&(t="/"+t),t||"/"}function n(){if(window.BookmarkEngine&&"function"==typeof window.BookmarkEngine.getAllForSite){var n=window.BookmarkEngi

### `karty/_engine/map-engine.js`

- L540 · `body-style-writer` · document.body.style.overflow = '';
- L2148 · `body-style-writer` · document.body.style.overflow = 'hidden';
- L2224 · `body-style-writer` · document.body.style.overflow = '';

### `konfessii/russkij-baptizm/_app/index.html`

- L30 · `body-style-writer` · `),()=>{o.current?.removeAttribute("data-motion-pop-id"),C.contains(A)&&C.removeChild(A)}},[e]),v.jsx(Ij,{isPresent:e,childRef:o,sizeRef:u,pop:r,children:r===!1?n:ie.cloneElement(n,{ref:p})})}const Fj=({children:n,initial:e,isPresent:t,onExitComplete:i,custom:s,presenceAffectsLayout:r,mode:a,anchorX
- L30 · `body-style-writer` · `),()=>{o.current?.removeAttribute("data-motion-pop-id"),C.contains(A)&&C.removeChild(A)}},[e]),v.jsx(Ij,{isPresent:e,childRef:o,sizeRef:u,pop:r,children:r===!1?n:ie.cloneElement(n,{ref:p})})}const Fj=({children:n,initial:e,isPresent:t,onExitComplete:i,custom:s,presenceAffectsLayout:r,mode:a,anchorX
- L30 · `body-style-writer` · `),()=>{o.current?.removeAttribute("data-motion-pop-id"),C.contains(A)&&C.removeChild(A)}},[e]),v.jsx(Ij,{isPresent:e,childRef:o,sizeRef:u,pop:r,children:r===!1?n:ie.cloneElement(n,{ref:p})})}const Fj=({children:n,initial:e,isPresent:t,onExitComplete:i,custom:s,presenceAffectsLayout:r,mode:a,anchorX

### `scripts/gill-v16-mobile-play-smoke.js`

- L333 · `body-style-writer` · scrollLocked: document.documentElement.hasAttribute('data-scroll-locked') || document.body.style.overflow === 'hidden' || document.body.style.position === 'fixed',
- L333 · `body-style-writer` · scrollLocked: document.documentElement.hasAttribute('data-scroll-locked') || document.body.style.overflow === 'hidden' || document.body.style.position === 'fixed',
- L351 · `body-style-writer` · scrollLocked: document.documentElement.hasAttribute('data-scroll-locked') || document.body.style.overflow === 'hidden' || document.body.style.position === 'fixed',
- L351 · `body-style-writer` · scrollLocked: document.documentElement.hasAttribute('data-scroll-locked') || document.body.style.overflow === 'hidden' || document.body.style.position === 'fixed',

### `scripts/interactive-audit.js`

- L167 · `body-style-writer` · await mob.evaluate(() => { document.querySelector('#seriesTocOverlay')?.classList.remove('is-open'); document.querySelector('#partTocOverlay')?.classList.remove('is-open'); document.body.style.overflow = ''; });
- L370 · `body-style-writer` · scrollLocked: document.documentElement.dataset.scrollLocked === '1' || document.body.style.position === 'fixed' || document.documentElement.style.overflow === 'hidden'
- L370 · `html-style-writer` · scrollLocked: document.documentElement.dataset.scrollLocked === '1' || document.body.style.position === 'fixed' || document.documentElement.style.overflow === 'hidden'
- L377 · `body-style-writer` · scrollLocked: document.documentElement.dataset.scrollLocked === '1' || document.body.style.position === 'fixed' || document.documentElement.style.overflow === 'hidden'
- L377 · `html-style-writer` · scrollLocked: document.documentElement.dataset.scrollLocked === '1' || document.body.style.position === 'fixed' || document.documentElement.style.overflow === 'hidden'

### `scripts/runtime-integrity-test.js`

- L171 · `body-style-writer` · body.style.overflow = 'auto';
- L172 · `body-style-writer` · body.style.position = 'relative';
- L173 · `body-style-writer` · body.style.top = '4px';

## Global scroll API writes

### `js/highlights.js`

- L31 · </div>`;return}if(i.length===0){r.innerHTML='<div class="gb-hl-empty">\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u043F\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0443 \xAB'+h(_.trim())+"\xBB</div>";return}r.innerHTML=i.map(V).join(""),r.querySelect
- L31 · </div>`;return}if(i.length===0){r.innerHTML='<div class="gb-hl-empty">\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u043F\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0443 \xAB'+h(_.trim())+"\xBB</div>";return}r.innerHTML=i.map(V).join(""),r.querySelect

### `scripts/runtime-integrity-test.js`

- L149 · window.SiteUtils.lockScroll = function broken() {};

## Highest-density lifecycle candidates

| File | Matches | Categories | Rules |
|---|---:|---|---|
| `js/site.js` | 202 | coordination, focus, keyboard, lifecycle, migration, recovery | body-style-writer, escape-handler, focus-operation, html-style-writer, keydown-handler, overlay-dialog-semantics, overlay-naming, route-recovery, scroll-api, style-remove-property-writer |
| `konfessii/russkij-baptizm/_app/index.html` | 152 | focus, keyboard, lifecycle, migration, recovery | body-style-writer, escape-handler, focus-operation, keydown-handler, overlay-dialog-semantics, overlay-naming, route-recovery |
| `js/floating-cluster-controller.js` | 141 | coordination, focus, keyboard, lifecycle, migration | body-style-writer, escape-handler, focus-operation, overlay-dialog-semantics, overlay-naming, scroll-api |
| `js/site-utils.js` | 120 | coordination, focus, keyboard, lifecycle, migration, recovery | body-style-writer, escape-handler, focus-operation, keydown-handler, overlay-dialog-semantics, overlay-naming, route-recovery, scroll-api |
| `index.html` | 92 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `articles/krajne-li-isporcheno-serdce/index.html` | 85 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `biografii/index.html` | 84 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `scripts/_temp-r5-overlay-runtime.inc.js` | 67 | coordination, focus, keyboard, lifecycle, recovery | escape-handler, focus-operation, keydown-handler, overlay-dialog-semantics, overlay-naming, route-recovery, scroll-api |
| `articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/index.html` | 63 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `articles/20-antisovetov-pastoru/index.html` | 59 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics |
| `baptisty-rossii/dva-sezda-1884/index.html` | 58 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `baptisty-rossii/goneniya-i-sovest/index.html` | 58 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `baptisty-rossii/iniciativnaya-gruppa/index.html` | 58 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `baptisty-rossii/noch-na-kure/index.html` | 58 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `baptisty-rossii/peterburgskaya-liniya/index.html` | 58 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `baptisty-rossii/podpolnaya-pechat/index.html` | 58 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `baptisty-rossii/sovetskaya-noch/index.html` | 58 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `baptisty-rossii/spravochnik/index.html` | 58 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `baptisty-rossii/vsehib-1944/index.html` | 58 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `baptisty-rossii/yuzhnaya-shtunda/index.html` | 58 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `baptisty-rossii/index.html` | 54 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `src/components/baptisty-rossii/BaptistyRossiiBody.astro` | 54 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `nagornaya/chast-3/index.html` | 50 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics |
| `articles/dzhon-gill-istoricheskiy-kontekst/index.html` | 48 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `nagornaya/chast-1/index.html` | 48 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics |
| `karty/_engine/map-engine.js` | 47 | focus, keyboard, lifecycle, migration | body-style-writer, escape-handler, focus-operation, keydown-handler, overlay-dialog-semantics, overlay-naming |
| `nagornaya/chast-4/index.html` | 47 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics |
| `scripts/interactive-audit.js` | 47 | focus, keyboard, lifecycle, migration | body-style-writer, focus-operation, html-style-writer, keydown-handler, overlay-dialog-semantics, overlay-naming |
| `articles/dzhon-gill-chast-3-nasledie/index.html` | 46 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `articles/dzhon-gill-chast-4-ekzeget/index.html` | 46 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `articles/dzhon-gill-spravochnik/index.html` | 46 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `articles/dzhon-gill-chast-1-chelovek/index.html` | 45 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `js/enhancements.js` | 42 | coordination, keyboard, lifecycle | escape-handler, keydown-handler, overlay-dialog-semantics, overlay-naming, scroll-api |
| `src/components/article-pilots/hermenevtika/HermenevtikaMobileBar.astro` | 42 | coordination, focus, keyboard, lifecycle | escape-handler, focus-operation, keydown-handler, overlay-dialog-semantics, overlay-naming, scroll-api |
| `articles/kod-da-vinchi/index.html` | 41 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/index.html` | 39 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `scripts/runtime-integrity-test.js` | 38 | conflict, coordination, focus, lifecycle, migration | body-style-writer, focus-operation, global-scroll-api-write, overlay-dialog-semantics, overlay-naming, scroll-api |
| `articles/dzhon-gill-chast-2-uchenyi/index.html` | 37 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `nagornaya/chast-5/index.html` | 37 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics |
| `articles/index.html` | 36 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `src/components/article-pilots/gill-series/GillLearningSheet.astro` | 36 | focus, keyboard, lifecycle | focus-operation, keydown-handler, overlay-dialog-semantics, overlay-naming |
| `js/search.js` | 35 | coordination, focus, keyboard, lifecycle | focus-operation, keydown-handler, overlay-dialog-semantics, overlay-naming, scroll-api |
| `nagornaya/chast-2/index.html` | 35 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics |
| `src/components/article-pilots/_shared/ReaderSettings.astro` | 35 | coordination, focus, keyboard, lifecycle | escape-handler, focus-operation, keydown-handler, overlay-dialog-semantics, overlay-naming, scroll-api |
| `pastor-series/index.html` | 34 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `nagornaya/nakhodki/index.html` | 33 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics |
| `scripts/_temp-reader-r5-inventory.js` | 33 | coordination, focus, lifecycle | focus-operation, overlay-dialog-semantics, overlay-naming, scroll-api |
| `js/nagornaya-mobile-toc.js` | 32 | coordination, focus, keyboard, lifecycle | focus-operation, keydown-handler, overlay-dialog-semantics, overlay-naming, scroll-api |
| `karty/avraam/avraam-app.js` | 31 | focus, keyboard, lifecycle | escape-handler, focus-operation, keydown-handler, overlay-dialog-semantics, overlay-naming |
| `src/components/nagornaya/seriya/NagornayaSeriyaBody.astro` | 31 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `nagornaya/seriya/index.html` | 30 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `_build-tools/konfessii-baptizm/MindMap3D.tsx` | 28 | keyboard, lifecycle, migration | body-style-writer, escape-handler, keydown-handler, overlay-dialog-semantics, overlay-naming |
| `nagornaya/index.html` | 28 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics |
| `js/highlights.js` | 27 | conflict, coordination, focus, keyboard, lifecycle | escape-handler, focus-operation, global-scroll-api-write, keydown-handler, overlay-dialog-semantics, overlay-naming, scroll-api |
| `nagornaya/istochniki/index.html` | 26 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics |
| `src/components/article-pilots/krajne/KrajneBody.astro` | 25 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics |
| `src/components/pastor-series/PastorSeriesPageChrome.astro` | 23 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `src/components/article-pilots/hermenevtika/HermenevtikaBody.astro` | 19 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `scripts/gill-v16-mobile-play-smoke.js` | 18 | lifecycle, migration | body-style-writer, overlay-dialog-semantics, overlay-naming |
| `data/genealogy/v2/build/genealogy-interactive.html` | 17 | focus, keyboard, lifecycle | focus-operation, keydown-handler, overlay-naming |
| `data/genealogy/v2/build/nations-interactive.html` | 17 | focus, keyboard, lifecycle | focus-operation, keydown-handler, overlay-naming |
| `scripts/genealogy-build/interactive-template.html` | 17 | focus, keyboard, lifecycle | focus-operation, keydown-handler, overlay-naming |
| `about/index.html` | 16 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics |
| `src/components/home/HomePageChrome.astro` | 14 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `src/components/article-pilots/gill-series/GillSeriesMobileBar.astro` | 13 | focus, lifecycle | focus-operation, overlay-dialog-semantics, overlay-naming |
| `src/components/article-pilots/gill-series/GillSeriesChrome.astro` | 12 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `src/components/article-pilots/kod-da-vinchi/KodDaVinchiPageFooter.astro` | 10 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics, overlay-naming |
| `scripts/atlas-build-shell-preview.js` | 8 | focus, keyboard, lifecycle | focus-operation, keydown-handler, overlay-dialog-semantics, overlay-naming |
| `src/components/articles/ArticlesPageFooter.astro` | 6 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics |
| `src/components/biografii/BiografiiPageFooter.astro` | 6 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics |
| `rodosloviye/index.html` | 4 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics |
| `scripts/overlay-runtime-contract-test.js` | 4 | coordination, lifecycle | overlay-naming, scroll-api |
| `src/components/about/AboutPageChrome.astro` | 4 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics |
| `src/components/nagornaya/seriya/NagornayaSeriyaPageFooter.astro` | 4 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics |
| `src/components/rodosloviye/RodosloviyeBody.astro` | 4 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics |
| `404.html` | 3 | keyboard, lifecycle | keydown-handler, overlay-dialog-semantics |
| `src/components/genealogy/GenealogyTree.tsx` | 3 | keyboard, lifecycle | escape-handler, keydown-handler, overlay-dialog-semantics |
