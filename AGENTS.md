# AGENTS.md — gb-is-my-strength (gospod-bog.ru)

> **Обязательно к прочтению ДО любой правки кода**, если ты — ИИ-агент
> (Cursor / Arena Agent / Copilot Workspace / Kilo / любой).
>
> Этот файл — **договор** между владельцем (Фёдор Милованов) и любым агентом.
> Нарушение = регресс, который видят сотни читателей сайта.
> Если правило кажется глупым — **спроси, ПОЧЕМУ оно появилось**.

| Версия документа | Дата | Состояние |
|---|---|---|
| **AGENTS-r140** | 2026-06-13 | **Карта Авраама wave-14: bible_extra 19/19 + SVG регионы + ambient chord.** (1) **bible_extra ЗАКРЫТ для всех 19 мест**: Ур (Деян 7:2), Урфа (Берешит Рабба), Харран (Лех-леха три круга), Сихем (Ин 4 колодец), Бет-Эль (лестница→тельцы), Хеврон (Быт 18:25), Шалем (Акеда→Голгофа), Дан (война ради Лота), Содом (Иез 16:49 гордость), Хаммам (критерий Соф 2:9), Цоар (молитва меняет суд), Герар (язычник невиновен), Беэр-Шева (Эль Олам посреди боли), Кадеш (перекрёсток 3 эпох), Шур (первое явление ангела — рабыне), Лахай-рои (один источник двух встреч), Хова (ночной рейд); теперь отображается после bible. (2) **SVG**: Суэцкий залив, Едом שֵׂעִיר, Аббана/Барада אֲמָנָה, Вифлеем, Изреель. (3) **Ambient**: changeAmbientChord(i) — 8 тональностей (C/D/Bmin/Cmin/Amin/Bdim/Cmaj/D) с portamento .8s. (4) **CSS**: verse::before ❝, place-counter gold border, zoom-badge glow, cartouche z2 hide. QA: 21/21 ✅ | 3543 строки | 322KB. |
| **AGENTS-r139** | 2026-06-13 | **Карта Авраама wave-13: AiG/YEC аргументы + 18 мест с фото + Каркемиш/Алеппо/Эцион-Гевер.** Из MD (ABRAHAM-ARCHAEOLOGY-RESEARCH + OWNER-REQUIREMENTS): (1) **YEC/консерв.**: Содом — полная AiG 2022/2025 аргументация (Иез 16:46 «Содом к югу», Быт 10:19, Флавий, Мадабская карта, серо-битум юга); Хаммам — 5 пунктов against (Соф 2:9 «необитаем вовек», хронология 300-450 лет, AiG «Have we found Sodom? No», retraction 2025); Ур — note Ашшер ~2166 г. до н.э.; Источники: AiG + ARJ v5 + Ritmeyer + LOC Matson PD. (2) **Фото 18 мест**: Харран (2014), Дан (2011), Мамре (2010), Мория (2019+панорама), Zoar, Шур, Хова, Бет-Эль. (3) **SVG**: Каркемиш (כַּרְכְּמִישׁ), Алеппо (חָלֶב), Эцион-Гевер (עֶצְיֹן גֶּבֶר), Ассирия/Вавилония lbl, маршрут через Каркемиш. (4) **CSS**: normTxt NFD, photo cap, he-tab cur, he-word mob 20px, dispute/bib-note mobile, panel aria-label, cam 3 breakpoints, cap-dot glow. QA: 29/29 ✅ | 3461 строка | 304KB. |
| **AGENTS-r138** | 2026-06-13 | **Карта Авраама wave-12: spotlight + поиск highlight + 7 disputes + arrows + print.** (1) **bible_extra** для Египта (Рассказ Синухе, Бени-Хасан, Папирус Анастаси VI) и Дамаска (Элиэзер + два упоминания). (2) **Dispute** закрыт для Цоара (Гор эс-Сафи conf-hi), Герара (Тель Харор vs Джемме), Кадеша (Эйн эль-Кудейрат, уточнение: оазис/не телль) — итого 7 dispute-block. (3) **Spotlight**: radial glow при открытии маркера (scale .5→1, .5s), убирается при closePanel. (4) **Поиск highlight**: hlText() → mark с gold bg, CSS mark стиль. (5) **SVG**: Крит כָּפְתּוֹר, Вади Арава пунктир, стрелки течения рек (Иордан/Евфрат/Нил), terra incognita label. (6) **CSS**: soundPulse (ambient btn), pulseLot (lot-маркеры быстрее), goldRuleGlow (gold-rule 3s мерцание), life-tick::after dot, pfoot share pill, mHud improved, print styles, aria-live+aria-label, fog lighter. QA: 32/32 ✅ | 3406 строк | 295KB. |
| **AGENTS-r137** | 2026-06-13 | **Карта Авраама wave-11: иврит 19/19 + SVG шумер/Моав/fog-of-war + zoom + частицы.** (1) **Иврит закрыт для всех 19 мест**: Дамаск (דַּמֶּשֶׂק + Гута + Элиэзер), Урфа (אוּרְהַי + традиция огня Нимрода), Египет (מִצְרַיִם двойств. + יְאוֹר + типология). (2) **SVG**: шумерские города у Ура (НИППУР, УРУК, ЛАГАШ, АККАД, lbl-z2); Моав + Галаад; река Кишон; −430 м Мёртвого моря; треугольный контур Синая; mountainHatch на горах Заиорданья; fog-of-war overlay (восток/запад/юг). (3) **UX**: Tab underline sweep (::after scaleX 0→1); zoom badge «3.2×» в scalebar; Route idle breath (routeIdle 4s); Compass pan tilt (±1.5°); Particle CSS + 5 частиц в intro; CtxCard gold border+h3 underline; Modal gold border; Tooltip .vis+translateY; ::-webkit-scrollbar 4px gold; Panel drag-handle tap = close (mobile). QA: 30/30 ✅ | 3332 строки | 285KB. |
| **AGENTS-r136** | 2026-06-13 | **Карта Авраама wave-10: полнота иврита + ripple + 12 анимаций + SVG детали.** (1) **he_deep закрыт для всех 17 мест**: Хаммам (תַּל אֶל-חַמָּם), Цоар (самоэтимология Быт 19:20), Герар + Авимелех, Кадеш-Барнеа (три имени оазиса), Шур (египетская стена), Беэр-лахай-рои (первое явление ангела), Хова (единственное упоминание). (2) **Ripple при клике**: SVG circle r=8→28, opacity .6→0, цвет по типу маркера. (3) **12 новых CSS анимаций**: underlineSweep, hebGlow, storyBtnActivate, hintSlideDown, searchSlideIn, photoFadeIn, counterPop, chipShimmer, cartoucheBreathe, backKarty underline, counter rAF restart. (4) **SVG**: Нил יְאוֹר, Красное море יַם-סוּף, Персидский залив הַיָּם הַמִּזְרָחִי, Кипр כִּתִּים, Ханаан bbox, Кинерет green zone, Евфрат highlight glow. (5) **CSS полировка**: panel h2 underline sweep, heb glow, meta borders, chip cur gradient+glow, chipShimmer hover, kbd-help bg, hint gold border, timeline darker. QA: 43/43 ✅ | 3220 строк | 275KB. |
| **AGENTS-r135** | 2026-06-13 | **КРИТИЧЕСКИЙ БАГ кнопки intro исправлен + wave-9 SVG шедевр.** БАГ: #intro::before (звёздный паттерн) position:absolute;inset:0 без pointer-events:none перехватывал ВСЕ клики внутри intro — кнопка 'НАЧАТЬ КИНОТУР' не нажималась. ИСПРАВЛЕНИЕ: pointer-events:none на ::before; z-index:2 на .inner; z-index:3+pointer-events:auto на .go, .skip, .intro-story-btn; story-nav скрыт JS'ом на время intro. MOBILE INTRO: GO min-height 54px + goShine 3s pulse animation; SKIP 44px; staggered introFadeUp. SVG WAVE 9: Ливан с 3 снежными пиками + הַר לְבָנוֹן; Хермон הַר חֶרְמוֹן; Ярмук (приток); Лесбос+Хиос (Эгей); Via Maris стрелка; Персидский залив seaPattern; истоки Евфрата/Тигра; Компас PREMIUM (кольцо + 8 рисок + межкардинальные + центральный диск с glow); CTX hover glow; minimap gold border; caption enhanced bg. GSAP: trade routes drawSVG при загрузке. QA: 29/29 ✅ |
| **AGENTS-r134** | 2026-06-13 | **Карта Авраама wave-8: SVG шедевр — фильтры воды, картуш, паттерны, 15 premium анимаций.** (1) **SVG фильтры**: feDisplacementMap + анимированный feTurbulence (baseFrequency осциллирует 14s) → живая вода Средиземного; goldGlow/neonGlow для маршрутов; terrainTex для суши. (2) **SVG паттерны**: mountainHatch (45°), desertStipple (3 точки, покрывает Аравию), seaPattern (волны на Средиземном+Красном), caravanGrad radial. (3) **Декор**: картуш LEGENDA (антикварный с полной легендой), угловые орнаменты map frame, координатная сетка (15 faint gold lines, opacity .04), 5 анимированных звёзд (ночной режим). (4) **Animated trade routes**: Via Maris dashOffset 0→-28 (3s), Царская дорога 0→+28 (4s). (5) **15 CSS анимаций**: markerEntrance staggered, headerSweep, contentFade, routePulse, compassBob, mmRectPulse, toastIn, introFadeUp 6-уровневый stagger, progressGlow. (6) **GSAP**: маршруты с goldGlow при DrawSVG, glow исчезает за .8s; caravan trail (ring glow + dot, opacity tween). (7) **Рельеф**: гранитные горы Синая, заливные луга Иордана, Кинерет с паттерном+бликом, Красное море с волнами. QA: 39/39 ✅ | 3009 строк | 255KB. |
| **AGENTS-r133** | 2026-06-13 | **Карта Авраама wave-7: топ мобайл — touch 44px + bottom sheet + SVG шедевр.** (1) **Touch targets WCAG AA**: все кнопки ≥44px на мобайле (.btn 44, closeP 44, pm-x 48, pfoot 44, backKarty 44, story-btn 36, stage-chip 130, tab 42, pl-item 44, life-tick 22, life-nav 48, pfoot-arrows 52). (2) **Panel bottom sheet**: на ≤760px панель выезжает снизу (92svh, border-radius 22px, drag handle ::after, translateY). (3) **Active states**: scale(.94) на btn/story-btn, scale(.97) на chip, scale(.96) на arrows — чёткий клик. (4) **Long-press 500ms**: haptic(25ms) + hover preview на маркерах. (5) **iOS**: -webkit-overflow-scrolling touch, -webkit-appearance none, font-size 16px на inputs, search modal снизу. (6) **will-change** на panel/caption/pulse/marker. (7) **SVG**: skyG атмосфера, Тавр/Загрос горные хребты, волны Средиземного, соляной берег Мёртвого моря, dashed halo на кандидатах, valleyG Иордан. (8) **Caption dots**: 8 точек прогресса кинотура. (9) **tn-item full-width** мобайл + img 160px. (10) **reduced-motion**: shimmer + starsDrift отключаются. QA: 48/48 ✅ |
| **AGENTS-r132** | 2026-06-13 | **Карта Авраама wave-6: визуальный шедевр + прогресс тура + счётчик мест + a11y + SVG острова.** (1) **Визуал**: intro — звёздный паттерн (starsDrift 60s) + gold glow на иврите; panel header — золотая полоска 3px ::before; verse — border-radius 0 8px 8px 0; note — border-left 3px; bib-note — ✦ звезда + gradient; he-block — border-top 2px + shadow; btn hover — glow 12px gold; маркер active — drop-shadow filter; route hot — stroke 3px; stage chip — text-shadow; pulse — улучшен 0.35→1.65. (2) **#tourProgress**: золотая полоска внизу экрана, растёт с 0 до 100% по мере кинотура, сбрасывается при stopTour. (3) **Счётчик места**: pill «X из Y» над кнопками prev/next (story-aware); сбрасывается при closePanel. (4) **Skeleton loader**: shimmer анимация на img; loaded class отключает по onload. (5) **A11y**: focus trap в photoModal; focus на ✕ при открытии; Esc priority. (6) **SVG**: Кармил (הַכַּרְמֶל), горы Самарии/Иудеи (6 пиков), река Оронт, Родос (Ρόδος), Крит, дюны Аравии (волнистый паттерн), Синай со снежной шапкой, Нил с 3 рукавами дельты, minimap active-place mmPulse. (7) **Фото** расширены до 13 мест: Герар, Кадеш, Дамаск. QA: 36/36 ✅ |
| **AGENTS-r131** | 2026-06-13 | **Карта Авраама wave-5: фото-галерея then/now + UI баги + SVG рельеф (из исследования ABRAHAM-ARCHAEOLOGY-RESEARCH-2026-06-13.md).** (1) **Photos[]** — 10 маркеров получили массив фотографий (Wikimedia CC/PD, NASA PD): Ур (зиккурат USAF + раскопки Вулли PD), Харран (конические дома), Сихем (NPAPH 1957), Хеврон/Мамре (Махпела), Дан («Ворота Авраама» ~1750 до н.э.), Содом (реальная соляная колонна горы Содом CC BY-SA 2020 + Баб эд-Дра c dis-тегом + retraction disclaimer), Талл эль-Хаммам (раскопки Коллинза), Беэр-Шева (UNESCO + жертвенник), Египет (NASA PD орбита), Шалем/Мория (Купол Скалы). (2) **renderPhotos() + openPhotoModal()**: галерея в вкладках СЮЖЕТ/АРХЕОЛОГИЯ; полноэкранный модальный просмотр с кредитами, «спорная локализация» для dis-типа. CSS: .tn-gallery/.tn-item/.tn-label (then/now/ctx/dis). CSP расширен: nasa.gov. (3) **UI баги**: #tabs overflow-x (4 вкладки без переполнения), .tab flex:0 0 auto (не сжимаются), Esc priority (photoModal перехватывает Esc первым), p-stage-hint фон, story-toast top:52px мобайл. (4) **SVG**: «ПЛОДОРОДНЫЙ ПОЛУМЕСЯЦ» label, соляная текстура Мёртвого моря, компас с W/E стрелками. QA: 45/46 ✅ |
| **AGENTS-r130** | 2026-06-13 | **Карта Авраама wave-4: иврит-этимология, библейские ссылки, дискуссия локализаций, SVG-рельеф.** (1) Новая вкладка «ИВРИТ» в панели каждого маркера: глубокий этимологический разбор топонима с огласовками, объяснение корней, омонимов, антиципирующих топонимов (Дан в Быт 14:14, Бет-Эль у Авраама), CSS-блоки `he-block/he-word/he-etym/he-refs`. (2) Расширенная вкладка ПИСАНИЕ: `bible_extra` — контекстные цитаты за пределами «основных стихов», блоки `bib-note` с богословским контекстом (типология Аврам→Исход, Акеда→Новый Завет, Мелхиседек→Евр 7). (3) Дискуссионные локализации (`dispute-block`): Ур (Тель эль-Мукайяр vs Урфа), Содом (ЮВ побережье vs Хаммам, ретракция 2025), Шалем/Мория (Иерусалим vs Гаризим) — CSS цветовые маркеры надёжности `conf-hi/conf-med/conf-lo`; позиция сайта: консервативная + честная неопределённость. (4) SVG карта: `edgeFog` (туман краёв), Ливанские горы, Синайский пик (2285 м + иврит), Хермон (2814 м), зелёная Иорданская долина, точечная Аравия, Негев; реки подписаны с ивритом (ИОРДАН · הַיַּרְדֵּן, ЕВФРАТ · פְּרָת, ТИГР · חִדֶּקֶל); исправлен дубль «ЗАЛИВ АКАБА». QA: 19/19 checklist green. |
| **AGENTS-r129** | 2026-06-13 | **Карта Авраама: Multi-Story (мультикарта), точность маршрутов, GSAP, мобайл-шедевр.** Масштабная итерация по разделу Карты: (1) **Story Switcher** — на одной карте 5 сюжетов (Весь путь / Лех-леха / Линия Лота / Война царей / Акеда); при выборе нерелевантные маркеры и маршруты dim/hi через CSS-классы, карта flyTo к bbox сюжета, chips в тайм-баре фильтруются; deeplink `?story=akeda`; View Transitions API при смене (Chrome 111+/Safari 18+/Firefox 133+). (2) **Точность**: маршрут Ур→Харран исправлен — теперь огибает по Евфрату через Вавилон и Мари (x≈1472,y≈756), а не срезает через пустыню; Кинерет — правильный вытянутый эллипс rotate(-20); Акабский залив подписан (יָם סוּף); Беэр-лахай-рои переведён в тип `cand` с нотой «📍 Точное место неизвестно». (3) **GSAP 3.13** (бесплатен с апреля 2025): CDN + DrawSVG + MotionPath; при входе в этап маршруты анимируются `drawSVG: 0→100%`. (4) **Desktop UX**: Hover Preview — при hover на маркер 200ms задержка → тёмная карточка 240px с иврит+название+kick; скрывается при уходе мыши; только ≥900px. (5) **Мобайл**: кнопка Fullscreen API (`⛶`, показывается только mobile); Haptic (Vibration API 12ms при открытии маркера, 8ms при свайпе); Swipe left/right в открытой панели → prev/next маркер; мобайл-стрелки `←→` в footer панели; Story Switcher — горизонтально скроллируемый ряд в fixed top на мобиле. (6) **Легенда**: цветовая легенда типов маркеров в попапе «Слои карты». (7) **CSP**: добавлен cdn.jsdelivr.net. (8) **Документация**: создан `MAPS-RD-MASTERPLAN-2026.md` и `MAPS-ANALYSIS-2026-06-13.md` в воркспейсе — живая база знаний по картам, R&D, координатам, roadmap. Счётчик мест: 19→20. QA: 36/36 чеклист-проверок зелёный. |
| **AGENTS-r128** | 2026-06-13 | **3D-карта баптизма: Timeline landmark-mode + restrained map highlight + wheel-capture + no native button titles.** Продолжение по скринам владельца: Timeline всё ещё выглядел шумным в местах скопления дат, режим карты мог заливать сцену слишком сильным золотым пятном, колесо мыши иногда снова скроллило документ вместо zoom 3D, а белые browser-tooltip могли появляться не только на Timeline. В `TimelineOverlay` добавлены `visibleTimelineTicks` (только major/landmark ticks) и `hoveredTick` — hover/focus обновляет собственную тёмную карточку события вместо нативного browser-title; при раскрытом route panel event-card Timeline скрывается, чтобы не лежать поверх маршрута. Заливка стран в map mode приглушена (`${color}35`→`${color}14`, related `${color}20`→`${color}08`, opacity exact 0.9→0.48), glow-фильтр оставлен только для exact country. В fullscreen-контейнер добавлен `onWheelCapture={handleSceneWheel}`: колесо вне реально прокручиваемого dossier управляет zoom камеры и не двигает document-scrollbar. Прямые DOM `title` на `<button>/<motion.button>` заменены на `aria-label` (PanelButton больше не прокидывает native title). `konfessii:audit` усилен guards на landmark-mode, no native titles, stacking rule, restrained map highlight и wheel-capture. Пересборка Vite singlefile → `_app/index.html`. QA: `konfessii:audit`, `validate:all`, `audit-pro` green. |
| **AGENTS-r127** | 2026-06-13 | **3D-приложение баптизма: верхняя навигация anti-overlap по скринам владельца.** По скрину первого экрана бренд-плашка «Русский баптизм / Карта истории» на узких desktop-width могла визуально наезжать на пункт «Главная». Правка в React-исходнике Navigation.tsx (копия для воспроизводимости добавлена в `_build-tools/konfessii-baptizm/Navigation.tsx` + инструкция `_build-tools/konfessii-baptizm/3D-NAV-POLISH-2026-06-13.md`): nav `max-w-6xl`→`max-w-[82rem]`, `w-[95%]`→`w-[96%]`, компактнее gap/padding бренда и nav-items, `whitespace-nowrap` на пунктах. Пересборка Vite singlefile → `_app/index.html`. `konfessii:audit` усилен I11 source guard на anti-overlap sizing. QA: `konfessii:audit`, `validate:all`, `audit-pro` green. |
| **AGENTS-r126** | 2026-06-13 | **3D-карта баптизма: исправлены визуальные баги по скринам владельца — scrollbar/Timeline-noise/native tooltips/raycast blocking.** По скринам 14:53–14:54 найдено: правый document-scrollbar перехватывал wheel вместо zoom, Timeline давал шумное скопление точек и белые браузерные `title` tooltip, крупные близкие декоративные glows/кольца могли мешать выбрать дальний узел. Исправления: (1) fullscreen 3D lock `html/body{overflow:hidden}` + restore on unmount; (2) Timeline ticks сгруппированы по году, minor-события приглушены, native `title` удалён (только aria-label); (3) node hit target уменьшен, decorative children raycast-disabled, клики ловит компактный `interactiveHit`; (4) `konfessii:audit` усилен source guards на scroll lock, declutter/no-title, raycast hygiene. R&D doc обновлён. Пересборка Vite singlefile → `_app/index.html`. QA: `konfessii:audit` live Chromium/WebGL, `validate:all`, `audit-pro` green. |
| **AGENTS-r125** | 2026-06-13 | **3D-карта баптизма: маршруты углублены до мини-storyboard.** В нижнем роутере активный маршрут теперь показывает не только summary и chips, но и блок `Сейчас в маршруте`: текущий узел, его год, краткое описание и следующий шаг/тип связи (`transitionLink.label`). Chips получили более информативные title (год + описание узла). Это продолжает паттерн progressive disclosure/details-on-demand: маршрут объясняет, где пользователь находится и куда идёт дальше, без расширения dossier и без новых тяжёлых визуальных эффектов. `konfessii:audit` усилен source guard на storyboard context. Пересборка Vite singlefile → `_app/index.html`. QA: `konfessii:audit`, `validate:all`, `audit-pro` green. |
| **AGENTS-r124** | 2026-06-13 | **3D-карта баптизма: Timeline теперь синхронизирует граф, маршрут и географию.** Продолжение UX-углубления без акцента на Drive: добавлен единый `TIMELINE_TARGETS` (промежуточный data-driven слой до будущих `nodeId/routeId/mapSelectionId` в `timeline.ts`), `handleTimelineEventSelect` теперь не только перелетает к узлу, но и активирует релевантный маршрут/шаг и подсвечивает связанную географию через `findMapSelectionForNode` (Тифлис/Петербург/Москва/Украина/Грузия и т.п.). Это реализует паттерн focus+context: событие времени → узел → маршрут → карта Евразии. `konfessii:audit` усилен source guard, что Timeline синхронизирует map selection. R&D-документ обновлён. Пересборка Vite singlefile → `_app/index.html`. QA: `konfessii:audit` source/live passed, `validate:all` green, `audit-pro` 152 passed · 0 errors. |
| **AGENTS-r123** | 2026-06-13 | **3D-карта баптизма: R&D best-practices doc + тихий learning coach первого входа.** По запросу владельца («не делать сверхакцент на Drive, искать топовые идеи на июнь 2026») создан специализированный документ `_build-tools/konfessii-baptizm/3D-RD-BEST-PRACTICES-2026-06-13.md` с 30+ ссылками и выводами по WebGL/3D graph UX, progressive disclosure, interactive timelines, spatial design, performance-aware Three.js/postprocessing. В 3D добавлен ненавязчивый блок «Как читать карту» (показывается только на desktop, когда нет фокуса/маршрута/раскрытого роутера): объясняет 3 шага чтения карты и даёт CTA «Маршруты»/«Карта». Это реализует паттерн overview → route/timeline/map → details-on-demand без перегруза интерфейса. `konfessii:audit` усилен I10 (source+live guard learning coach). Пересборка Vite singlefile → `_app/index.html`. QA: `konfessii:audit` live Chromium/WebGL passed, `validate:all` green, `audit-pro` 152 passed · 0 errors. |
| **AGENTS-r122** | 2026-06-13 | **3D-карта баптизма: следующий UX-проход — Timeline ticks фокусируют узлы, маршруты стали кликабельной цепочкой.** На базе R&D по современным паттернам WebGL/инфовизуализации (overview → zoom/filter → details-on-demand, progressive disclosure, interactive timelines, focus+context) сделаны малые безопасные улучшения без расширения dossier: (1) Timeline ticks стали кнопками с `title`/`aria-label`; клик по событию выставляет год и, если событие распознано по ключевым словам, перелетает к соответствующему 3D-узлу (Воронин/Кальвейт/Павлов/Пашков/ВСЕХБ/СЦ/РС ЕХБ и др.); (2) active route в нижнем роутере получил micro-copy «Нажмите этап…» и кликабельную цепочку шагов, каждый chip перелетает к узлу маршрута; (3) source-аудит I8/I9 усилен проверками `onEventSelect`, `handleTimelineEventSelect`, `onRouteStepTo` и кликабельных route step chips. Пересборка Vite singlefile → `_app/index.html`. QA: live `npm run konfessii:audit` Chromium/WebGL passed, `validate:all` green, `audit-pro` 152 passed · 0 errors. |
| **AGENTS-r121** | 2026-06-13 | **3D-карта баптизма: UX-улучшения Timeline/маршрутов + Drive-source lock.** По запросу владельца продолжен аккуратный проход после фикса `timelineYear is not defined`: (1) в документацию добавлена прямая ссылка на Google Drive React/Vite ZIP-исходник (`react-vite-tailwind`), чтобы будущие агенты сверяли не минифицированный бандл, а `src/components/MindMap3D.tsx` и `src/data/history/*`; (2) событийная карточка Timeline теперь всегда показывает русскую категорию + название + краткое описание события, а ticks на шкале стали кликабельными кнопками с title/aria-label; (3) нижний роутер «Маршруты и города» получил понятный active-route summary, счётчик этапов и компактную цепочку узлов маршрута, а кнопки маршрутов показывают число этапов и summary в title; (4) status-bar активного маршрута показывает текущий узел и подсказку по стрелкам; (5) ширина full dossier НЕ расширялась — Drive-исходник подтвердил канонические 300/320px, поэтому проблему «узко» дальше искать в состояниях/line-clamp/auto-collapse, не простым растягиванием. Пересборка Vite singlefile → `_app/index.html`. QA: `npm run konfessii:audit` live Chromium/WebGL passed (I1–I9), `validate:all` green, `audit-pro` 152 passed · 0 errors. |
| **AGENTS-r120** | 2026-06-13 | **3D-карта баптизма: визуал «шедевр» — космос-глубина + символика (запрос владельца «улучшай красивость, глубину, прорисовку, символические детали»).** Инкрементальные правки MindMap3D.tsx (без жёсткого рефактора), пересборка → `_app/index.html`: (1) **глубокий космос** `buildCosmos()` — 3 слоя звёзд (THREE.Points, параллакс по глубине, additive-blending, мягкие точки-спрайты) + 3 крупные туманности-спрайта (золото #c4a67e / индиго #6a4a8a / синь #2a5a8a) по краям сцены → сцена обрела объём и атмосферу глубокого космоса; строится один раз, только тёмная тема (флаг `__cosmosBuilt`), renderOrder отрицательный (за узлами). (2) **символика крещения** для faith-узла (Н. Воронин, крещён в реке Кура 1867): под золотым крестом 3 кольца `baptismRipple` — в RAF-loop расходятся вверх и затухают как волны на воде. Патч в `_build-tools/konfessii-baptizm/3D-RUBBER-DRAG.md`. QA Playwright: 3D рендерится (canvas 1366px), 0 pageerrors; konfessii:audit все инварианты ✔; audit-pro 152 passed · 0 errors. |
| **AGENTS-r119** | 2026-06-13 | **3D-карта баптизма: «резиновое» перетаскивание узлов + устранение idle-дрожания (запрос владельца «чтобы тянулось резиново и ничего не дрыгалось»).** Правки в React-исходнике 3D (MindMap3D.tsx; патч описан в `_build-tools/konfessii-baptizm/3D-RUBBER-DRAG.md`), пересборка Vite singlefile → `konfessii/russkij-baptizm/_app/index.html`: (1) **rubber-band drag** — `enableNodeDrag` включён для ВСЕХ устройств (был только desktop ≥768); `onNodeDrag` держит симуляцию тёплой и мягкой (velocityDecay 0.28) → соседи эластично тянутся за курсором; `onNodeDragEnd` РАСПИНИВАЕТ узел (fx/fy/fz=undefined) + лёгкий импульс к якорю → сила `composition` мягко возвращает узел и соседей домой. (2) **idle без дрожания** — `cooldownTicks` Infinity→260, `cooldownTime` Infinity→9000: физика затухает и ЗАМИРАЕТ в покое (никакого микро-джиттера позиций), а орбиты/кольца/«дыхание» крутятся в отдельном RAF-loop и не зависят от физики; drag/маршрут/карта будят симуляцию через `d3ReheatSimulation`. (3) сила `composition` усилена ×1.6 для более «резинового» возврата; зафиксированные (тянущиеся) узлы пропускаются, чтобы не бороться с курсором; warmupTicks 120→140 (пред-уложенная стартовая раскладка, без стартового прыжка). Исходник index.html бандла дополнен CSP + robots=noindex + viewport-fit + корректным title (воспроизводимая сборка, проходит konfessii-map-audit I6). QA: Playwright — drag тащит узел и соседей (визуально подтверждено), release → мягкий возврат в раскладку, 0 pageerrors; idle практически статичен. konfessii:audit все инварианты ✔; audit-pro 152 passed · 0 errors; validate/seo/tokens green. |
| **AGENTS-r118** | 2026-06-13 | **«Карта Русского Баптизма»: восстановлена НАСТОЯЩАЯ 3D-карта оригинала (1-в-1) вместо упрощённого 2D-порта.** Владелец указал, что ранний vanilla-порт (2D canvas-«созвездие») сильно упростил оригинал — у LM Arena проекта настоящая 3D-сцена (Three.js + react-force-graph-3d + d3-geo: сферы-узлы со свечением, торы-орбиты, тубы-связи, карта стран Mercator, режимы граф/карта, лоадер, AI-ассистент). По согласованию (точность 1-в-1 > vanilla-канон для этого материала) встроен **оригинальный собранный бандл** как изолированный iframe-ассет: `/konfessii/russkij-baptizm/` стал нативной обёрткой (шапка/SEO/OG/JSON-LD/CSP `frame-src 'self'`/sr-only h1/лоадер) + `<iframe src="./_app/index.html">`. `_app/` — singlefile-бандл (~2.2 МБ, Vite `base:'./'` + vite-plugin-singlefile), со своей CSP (Three.js `unsafe-eval`/`blob:`, шрифты Google Fonts) и `robots=noindex`. Папка `_app` добавлена в skipDirs/EXCLUDE_DIRS 5 валидаторов (built-asset). Регресс-аудит `scripts/konfessii-map-audit.js` переписан под iframe-архитектуру (I1–I7: обёртка SEO/CSP/iframe, бандл singlefile/CSP/noindex, live-загрузка + **активация 3D WebGL-canvas** на desktop+mobile). Старый 2D-генератор удалён, `_build-tools/konfessii-baptizm/README.md` — инструкция пересборки. §9.23 переписан. QA: konfessii:audit 25/25 ✔ (включая реальный WebGL 3D), audit-pro 152 passed · 0 errors, validate/seo/tokens/readable/editorial/data — green. |
| **AGENTS-r117** | 2026-06-12 | **«Карта связей» отдела баптизма поднята до премиум-уровня + регресс-защита (§9.23).** Полный апгрейд canvas-карты `/konfessii/russkij-baptizm/`: (1) **живая ambient-анимация** — дыхание/дрейф узлов, мягкое свечение (радиальные градиенты на узел), пульс-кольца на выделении, **частицы, бегущие по подсвеченным рёбрам**, параллакс-старфилд на фоне; (2) **рёбра-градиенты** (цвет источника→цели) + **подписи связей при наведении** (раньше данные label/desc рёбер — «Слились в · 1944», «Раскол · 1961–1965» — не использовались, теперь видны на hover); (3) карточка узла теперь перечисляет связанные узлы; (4) **перф:** RAF-цикл крутится только когда canvas в зоне видимости и вкладка активна (60fps в кадре, **0 RAF вне экрана** — Playwright-замер), `prefers-reduced-motion` → статичная отрисовка без RAF; (5) aria-pressed на кнопках-маршрутах. **Регресс-защита:** `scripts/konfessii-map-audit.js` (npm run konfessii:audit) — 9 инвариантов I1–I9 (рендер, ambient, перф-пауза, reduced-motion, поиск→pin, маршрут, хронология/глоссарий/викторина, overflow/pageerror, контент-паритет 23 узла/27 связей/25 вопросов/15 терминов + блоки Пашков/зарубежные работы) на desktop+mobile; без браузера — SKIP. QA: Chromium+WebKit(Safari) × desktop+mobile — все интеракции PASS, 0 pageerrors, 0 overflow; konfessii:audit 25/25 ✔. audit-pro 152 passed · 0 errors. |
| **AGENTS-r116** | 2026-06-12 | **Новый отдел «Конфессии и Деноминации» + миграция токенов завершена + регистр названий разделов.** (1) Создан раздел `/konfessii/` (хаб по эталону `/karty/`) и `/konfessii/russkij-baptizm/` — полный перенос проекта из LM Arena Coding Battle на vanilla HTML/CSS/JS (без React/Vite/Three.js, как требует §10): все секции (три истока, интерактивная «карта связей» — 2D-созвездие на canvas в дизайн-языке /map/ r112–114, 23 узла/27 связей/5 маршрутов с drag/zoom/поиском/hover, хронология, съезды, два пути, гонения, союзы, 14 фигур с досье, находки v6, архивы, открытые вопросы, сравнение РС/МСЦ ЕХБ, глоссарий, викторина на 20 вопросов). Самодостаточные страницы с CSP/OG/JSON-LD/breadcrumbs/Yandex/SDG, 2 OG-обложки 1200×630 webp. Главная: пункт «Конфессии» в navbar+mobile-nav, карточка отдела «Открыт». sitemap +2 URL. (2) **tokens:check завершён:** в `:root` site.css домаплены 10 недостающих legacy-алиасов (`--border-strong`,`--accent-strong`,`--link`,`--note-bg`,`--quote-bg`,`--text-primary`,`--text-secondary`,`--text-muted`→`--color-text-faint`,`--fg`,`--fg-secondary`) на канонические `--color-*`; ratchet прямых var(--legacy)=0 сохранён; cache-bust прогнан (26 файлов). (3) **§9.22:** зафиксирован регистр названий отделов — Title Case (эталон «Конфессии и Деноминации»), без массовой капитализации русских заголовков статей/секций. Playwright: 0 pageerrors (desktop+mobile 390px), карта/маршруты/поиск/хронология/глоссарий/викторина работают. audit-pro 152 passed · 0 errors. |
| **AGENTS-r115** | 2026-06-12 | **Карта Авраама: археологическое обогащение + торговые пути + горы + era-tags.** Добавлены 3 торговых пути SVG (Via Maris, Царская дорога, Дорога Сура) с ивритскими подписями; горы Геризим и Гевал; 7-я CTX-точка Хацор (ЮНЕСКО, 80 га, 18 клинописных табличек); era:["bronze"] на 19 PLACES + data-layer="base-geo" для будущего выноса по docs/MAPS-ARCHITECTURE.md; 8 слоёв карты (abr/lot/war/cand/ctx/trades/mounts/debate); km на timeline chips; археологические данные 13/19 мест верифицированы по академическим источникам (Nature, BAR, UNESCO, Wikipedia). CSS: удалены 18 dead vars + orphan @keyframes + empty @media. links-graph: 20/20 readingTime + 20/20 tags. SW: v170→v171. SITE_CONFIG timestamps. llms.txt +2 URL. Content word-count floor guard (10 статей, ~80% порог). Gill reading-time sync (149 мин серии). audit-pro 152 passed · 0 errors. |
| **AGENTS-r115** | 2026-06-12 | **Карта Авраама + тотальная ревизия AGENTS.md: торговые пути, горы, Хацор, era-tags, 152 checks, нумерация §9 исправлена.** тематические нити, режим «Путь», deep-link ?focus= + кнопка «Посмотреть на карте связей» в статьях.** (1) **Тематические нити**: links-graph.json обогащён tags[] из article:tag страниц (20/20 узлов); карта строит второй слой рёбер по общим темам (нормализация ё→е, дубли ссылочных рёбер исключаются), фиолетовый пунктир, изгиб в противофазе к ссылочным рёбрам; тумблер «Темы» в новом modebar (выкл по умолчанию — слой дополнительный). Теги показываются чипами в hover-карточке. (2) **Режим «Путь»**: кнопка «Путь» + подсказка; клик по двум статьям → BFS по ссылочному графу (+тематические рёбра, если слой включён) → цепочка подсвечивается золотом (path-lit с drop-shadow, узлы пути — усиленное кольцо, остальное гасится); «пути нет» — честное сообщение; Esc выходит и чистит. В режиме пути hover-карточка отключена (клики = выбор пары). (3) **Deep-link ?focus=<id>**: карта открывается с подлётом камеры к узлу и пином карточки (intro пропускается). (4) **Статьи → карта**: в backlinks-блок добавлена кнопка-пилюля «Посмотреть на карте связей» (/map/?focus=<id>, site.js + CSS в site.css, dark/print учтены) — полный цикл навигации статья↔карта замкнут (Playwright: клик из kod-da-vinchi → карта с запиненной карточкой именно этой статьи). Inline-JS ужат до 267 LOC (<500). QA: Волна-2 матрица (theme-default-off/toggle/card-tags/path-hint/path-found 2 ребра 3 узла/path-esc/focus-deeplink) — все PASS; полная регрессия Волны 1 (BUILD/SEARCH/FLY/ESC/HOVER, кластеры C1-C3, pin/unpin/фильтры/zoom/empty-search/kbd, мобайл tap-pin) — все PASS; 0 pageerrors везде; ci:check green, audit-pro 152 passed · 0 errors. |
| **AGENTS-r113** | 2026-06-12 | **/map/ Волна 1: avatar-узлы, киношное появление, поиск с подлётом + задел progressive disclosure (по «делаем профессионально» владельца).** (1) **Обложки внутри узлов**: каждый узел — круглая мини-обложка статьи (SVG image + clip-path circle, кольцо цветом раздела, glow-хало) — 20/20 узлов с аватарами. (2) **Intro-анимация**: узлы прилетают с stagger (nodePop, 55мс шаг), нити прорисовываются stroke-dashoffset по реальной длине пути (getTotalLength); prefers-reduced-motion → всё видно сразу без анимации (проверено эмуляцией). (3) **Поиск по карте**: инпут в шапке (стеклянный, в стиле раздела), дропдаун с мини-обложками, клавиатура ↑/↓/Enter/Esc, «Ничего не найдено»; выбор → плавный подлёт камеры (cubic ease-out 620мс) + пин карточки + пульс-подсветка узла. (4) **Progressive disclosure (задел на 40+ статей)**: серии с ≥3 статьями сворачиваются в супер-узлы (пунктирное кольцо, орбита мини-обложек членов, «N СТАТЕЙ · РАСКРЫТЬ»); порог COLLAPSE_AT=35 (сейчас не достигнут — карта полная), форс-режим ?clusters=1 для тестов; клик по кластеру раскрывает с re-layout и intro; поиск находит статью в свёрнутом кластере и раскрывает его автоматически; рёбра к кластеру агрегируются с весом (толщина). Данные: links-graph.json — параллельный агент добавил 3 узла без id/cover и 3 ребра в чужом формате {source,target} (ломали бы рендер) — нормализовано: узлы karty/karty-avraam с cover+desc, формат рёбер канонический [a,b]; /map/ сам себя не рисует. search-manifest: 4 item без id (его же хвост, валил data-consistency) — id добавлены. Баг-фиксы по ходу: .hdr>*{pointer-events:auto} глотал клики по карте под шапкой (кластер Гилла было не раскрыть) → point-events только на .back/.srch; тач: pointerover открывал карточку и pointerout тут же закрывал, click не доходил → pointerup(touch)-активация с подавлением synthetic click; статистика «75 связей» считала направленные дубли → честные «43 нити связей». QA: BUILD/SEARCH/FLY+PIN/ESC/HOVER, кластеры C1-C3 (?clusters=1: 2 кластера+10 узлов, клик раскрывает 5 узлов Гилла, поиск раскрывает Нагорную), pin/unpin/фильтры/zoom-drag-fit/empty-search/kbd-fly — все PASS; мобайл 390 (тап-пин, 0 overflow, аватары), reduced-motion, backlinks-блоки статей не сломаны (читают тот же JSON); inline-JS 437 LOC < 500; ci:check green, audit-pro 152 passed · 0 errors. |
| **AGENTS-r112** | 2026-06-12 | **«Карта связей» /map/ переделана под уровень раздела «Карты» (запрос владельца: «сыровата, нужны качественные стили, всплывающие превью, вшитые картинки, топовые шрифты»).** Полный редизайн в дизайн-языке avraam: тёмное «созвездие» (радиальные градиенты + feTurbulence-зерно), фирменные шрифты сайта (Playfair Display для заголовков, Cormorant Garamond для лида, Source Sans 3 для UI; preload woff2 + /fonts/fonts.css — раньше шрифты вообще не подключались и страница падала в системные), золотая палитра avraam (#e8c879). Новые возможности: (1) **hover-превью статьи** — стеклянная карточка с НАСТОЯЩЕЙ обложкой статьи (og-cover, ленивая загрузка с kenburns-проявлением), названием (Playfair), описанием, минутами чтения и числом связей, бейдж раздела; позиционируется у узла, на мобиле — нижний шит; (2) **клик = закрепление карточки** (unpin: пустой клик/Esc/повторный клик); (3) подсветка связей узла (золотые нити, остальное гасится); (4) **легенда = живые фильтры** разделов (aria-pressed, счётчики, solo-режим прозрачности); (5) пан/зум: колесо к курсору, drag, тач-пинч, кнопки +/−/⌂ fit; (6) изогнутые рёбра (quadratic bezier) вместо прямых линий, glow-фильтр узлов, детерминированный force-layout (seeded PRNG — раскладка стабильна между загрузками); (7) hint-блок, статистика «18 материалов · 74 связи». Данные: data/links-graph.json обогащён полями cover/desc (+readingTime где было 0) из og:image/description страниц — 18/18 обложек, 18/18 описаний; это единый источник и для backlinks-блоков статей. SEO/мета: twitter:site/creator, og:image width/height, theme-color light+dark, исправлен bare href="#". Размер страницы 15K→27K (инлайн, без новых файлов; inline-JS 289 LOC < лимита 500). QA: Playwright — build (18 узлов/74 ребра/5 фильтров), hover-карточка с загруженной обложкой и 4 lit-рёбрами, pin/unpin/Esc, фильтр прячет 5 узлов Гилла и возвращает, zoom/fit, мобайл 390px (карточка-шит в вьюпорте, 0 h-overflow), 0 pageerrors во всех прогонах; ci:check green, audit-pro 152 passed · 0 errors. |
| **AGENTS-r111** | 2026-06-12 | **Ревизия нового раздела «Карты» (/karty/ + /karty/avraam/) и /map/ — мелкие фиксы, архитектурные решения задокументированы.** Полный Playwright-проход раздела: хаб (карточки, 0 ошибок), Авраам (intro→исследование 87 маркеров → клик по остановке → панель → кинотур 8 этапов → ←/→ → Esc → зум/драг → reduced-motion → Tab-фокус → мобайл 390px) — 0 pageerrors, 0 h-overflow. Найдено и исправлено: (1) **бренд-регистр** — в title/og:title трёх страниц (karty, avraam, map) стояло «Господь Бог — сила моя» нижним регистром, тогда как канон сайта «Сила Моя» (9 вхождений исправлено); (2) **/map/ был страницей-сиротой** (0 входящих ссылок с самого сайта, только sitemap) — добавлена ссылка «карта связей статей» в футер хаба /karty/. Решение по неймингу URL (НЕ менять): /karty/ (библейские карты, кириллический транслит = осознанный SEO-выбор для русскоязычных запросов «карта пути Авраама») и /map/ (служебная карта связей статей) остаются как есть — переименование /map/→/karta-svyazey/ дало бы минорный SEO-выигрыш, но это служебная страница без поискового интента, а смена URL = редиректы и потеря истории; различие имён (karty vs map) дополнительно разводит два разных типа карт. Архитектура раздела на вырост зафиксирована в docs/MAPS-ARCHITECTURE.md: ОДИН базовый географический макет (слои: вода/рельеф/топонимы эпохи) + наборы маршрутов как данные поверх него; страница = слой данных, не копия карты. |
| **AGENTS-r110** | 2026-06-12 | **Глоссарий: ещё два бага владельца — «тупит крестик» и «при развороте у верха резко уходит вниз».** (1) **Прыжок вниз при развороте (ВОСПРОИЗВЕДЁН)**: когда тултип открыт placement=top близко к верху вьюпорта и пользователь жмёт «Подробнее», rAF-цикл вызывал полный positionTip, который при нехватке места НАВЕРХУ перекидывал тултип на placement=bottom — тултип резко уезжал из-под курсора вниз (y:16→298) и перекрывал текст. Фикс: цикл репозиционирования заменён на **anchored growth** — placement ФИКСИРУЕТСЯ на момент клика; если разворачиваемому свитку не хватает места в свою сторону, тултип получает maxHeight по доступному месту и внутренний скролл (овнер-сценарий «хотим развернуть» сохраняется, ничего не прыгает); при «Кратко» maxHeight/overflow снимаются. Также убрана осцилляция maxHeight (расчёт от scrollHeight, а не от текущей высоты) и добавлен guard: цикл умирает мгновенно, если тултип закрыли во время анимации. (2) **«Тупит/не закрывается крестик»**: десктоп-крестик в headless работал во всех 8 матричных сценариях, но найдены и закрыты реальные причины «тупизны»: (а) закрытие перенесено на **pointerdown** (capture) — мгновенная реакция вместо ожидания click (~120мс+); (б) **хит-зона крестика 28→44px** через ::after; (в) **smooth-scroll баг на мобиле**: `html{scroll-behavior:smooth}` превращал восстановление скролла в unlockScroll(scrollTo(0,saved)) в видимую анимацию прокрутки через ПОЛСТРАНИЦЫ (~1 секунда, в тестах терм «уезжал» на сотни px при замере сразу после закрытия — это и ощущалось как «после закрытия тупит»); unlockScroll/forceUnlockEmergency теперь временно ставят scrollBehavior:auto → восстановление мгновенное. Матрица проверок (все PASS): крестик в compact/expanded/во-время-анимации/bottom-placement/re-open после крестика; top-edge expand без флипа (y=16, внутр. скролл); collapse снимает maxHeight; bottom-growth в пределах вьюпорта; мобайл: крестик+restore скролла+reopen+expand+крестик-в-expanded; Esc в expanded; wheel закрывает; resize чисто; fn-marker жив; WANDER/DART/COLLAPSE/LEAVE прежней матрицы. ci:check green, audit-pro 151 passed · 0 errors, 0 pageerrors. |
| **AGENTS-r109** | 2026-06-12 | **Два бага владельца: статические термы без папируса + TTS читал английским голосом.** (1) **«Шамир» без свитка**: 14 пререндеренных в HTML термов (`<span class="gterm" tabindex>текст<span class="gtip">…` — без data-term, все на krajne) гидратор полностью пропускал — у них не было ни brief/detail-структуры, ни кнопки «Подробнее», ни папируса. Добавлен upgrade-проход в `glossary.js l()`: статический текст становится `.gtip-brief`, detail подтягивается из словаря, и КРИТИЧНО — переразметка идёт внутри `.gtip-luxury__definition` (initGlossaryTooltips из site.js люксифицирует tip раньше; первая версия патча перезаписывала весь tip.innerHTML и сносила luxury-шапку с категорией — поймано сравнением структур). В словарь добавлены 6 терминов с полноценными detail: шамир, Кархемише, Гейдельбергский катехизис, Вестминстерское исповедание, остаточная порча, тотальная испорченность (все с `autoHydrate:false` — авто-обёртка по тексту НЕ включается, владелец: «застраховаться от лишних срабатываний»; «остаточного греха» замапился на существующий «остаточный грех»). Для lookup добавлена карта `aliasAll` (включает autoHydrate:false-термины). Итог: 41/41 термов на krajne с папирусом, luxury-структура идентична динамическим. (2) **TTS английский голос**: Chrome загружает голоса асинхронно — `getVoices()` при первом клике пуст, utterance уходил с `voice=null`, и Chrome игнорировал `lang="ru-RU"`, читая системным английским. Фикс: `pl()` ждёт `voiceschanged` (до 1.2с) перед стартом; выбор голоса при каждом `sP()` с приоритетом Google ru → remote ru → любой ru; `utt.voice` в try/catch (битый voice-объект кидал TypeError и убивал воспроизведение — поймано моком); если голоса загружены, но русского НЕТ — честное состояние «Нет рус. голоса» вместо английского чтения. Проверено моками Chrome-поведения: клик до загрузки голосов → ru-RU + Google русский; нет ru-голосов → сообщение, 0 speak-вызовов. QA: papyrus-сценарии (expand/wander/dart/collapse/leave) green, 4 страницы гидрации (0 invisible, luxury у всех), мобильный шит на статическом терме (тап/разворот/закрытие), smoke 6 страниц, ci:check green, audit-pro 151 passed · 0 errors, data-consistency PASS. Словарь: 101→107 терминов. |
| **AGENTS-r108** | 2026-06-12 | **Глоссарий «Подробнее» переделан под ключ: папирус-разворот + стабильность (баг-репорт владельца «крайне глючно»).** Визуал: detail-текст теперь раскрывается как пергаментный свиток `.gtip-papyrus` — папирусная карточка (градиент пергамента, feTurbulence-зерно, внутренние тени сверху/снизу как у скрученного свитка, асимметричные углы 4/14px, золотая линия по верхней кромке), полная тёмная тема, кнопка-пилюля в том же пергаментном стиле с вращающимся шевроном (SVG, не текстовые ▾▴ — владелец просил «без странных разделителей»). Механика без дёрганий: трёхслойная разметка `.gtip-detail-wrap` (grid 0fr→1fr, .42s cubic-bezier) > `.gtip-detail` (min-height:0; overflow:clip) > `.gtip-papyrus` (opacity+translateY) — НИКАКИХ hidden-переключений (раньше brief прятался, detail показывался скачком и тултип прыгал); brief остаётся видимым над свитком. Порядок: brief → кнопка → свиток (кнопка НЕ уезжает вниз при развороте — клик «Кратко» не промахивается). Стабильность против ложных закрытий: (1) глобальный pointer-трекер `SiteUtils._ptrPos` + `_ptrInside` — оба close-таймера дополнительно проверяют ГЕОМЕТРИЮ (курсор в пределах тултипа/якоря ±4px → не закрывать), это снимает гонки relatedTarget при перестроении DOM; (2) `data-gb-sticky` на время клика по toggle: rAF-цикл репозиционирования 500мс (тултип растёт вверх плавно, не скачет), sticky снимается pointermove-трекером только когда курсор реально ушёл за 28px-буфер с grace 380мс; (3) сворачивание состояния — только при закрытии тултипа (restoreTip, с `.gtip--no-anim` чтобы скрытый возврат не мигал), а не на pointerover как раньше (это и был главный источник глюков). Доступность: aria-expanded на кнопке, aria-hidden на wrap, focus-visible, 44px на таче, prefers-reduced-motion отключает все анимации. Попутно: гидратор глоссария исключает `[hidden]`/`[data-pagefind-meta]`/`[data-pagefind-ignore]` — раньше оборачивал термин внутри скрытого pagefind-мета-спана (1 невидимый .gterm на герменевтике). Playwright-верификация (все green): hover-открытие, разворот (папирус 348px, opacity 1, в вьюпорте), блуждание по свитку, случайный увод 150мс (выживает), «Кратко» (кнопка на месте после сжатия), реальный уход (закрывается), повторный hover (сброшен на «Подробнее»), fn-marker/bref регрессий нет, мобильный шит (тап, разворот внутри скролла, 44px кнопка, закрытие тапом вне), light+dark скриншоты, 3 страницы × все термины с папирусом и кнопкой, 0 невидимых терминов, 0 pageerrors. ci:check green, audit-pro 151 passed · 0 errors. |
| **AGENTS-r107** | 2026-06-12 | **Тотальная чистка репо по «да» владельца + закрытие _agent-handoff.** (1) **КРУПНЫЙ CSS-БАГ найден чисткой:** ~17.8KB компонентных стилей фазы 2 (§1–§2: .gbx-verse/-ow/-jux/-epi/-pq/-storymap/-next-suggest/-hero-shrink, .cp-continue-*, .ss-btn, details.gbx-details) были случайно вложены агентом dce7ff84 ВНУТРЬ `@media print` — на экране все эти компоненты рендерились БЕЗ стилей (поповеры стихов, карточки оригинала, эпиграфы, pull-quote, storymap, share-кнопки выделения, секция «Продолжить» в Ctrl+K, аккордеон). Блоки распакованы на верхний уровень, легитимные print-хвосты (display:none для tts/next-suggest/backlinks) пересобраны в отдельные print-правила; Playwright-проверка computed-styles: verse=help, jux=col-resize, suggest=fixed, details=12px, storymap=grid — всё ожило. (2) **_agent-handoff/ закрыта** (фаза 1+2 выполнены полностью, сверено по ROADMAP §0/§1/§2 грепами и браузером): PATTERN.md → `docs/GBS-PATTERN.md` (постоянный справочник миграций, числа обновлены после r104), невыполненные решения и инварианты владельца перенесены в §9.11 (инварианты дизайна, анти-фичи, ожидающие решения), README.md и ROADMAP.md удалены — вся их актуальная информация в AGENTS/changelog. (3) **Мёртвый код вычищен:** js/series-cards.js 8.8K→2.6K (renderStrip/renderNav — hosts=0 с r96, README handoff §3a разрешал чистку с прогоном аудитов; живым остался data-series-cards для каталогов), CSS: .gb-snav+.article-with-snav (~7.5KB, hosts=0), .article-topnav/* + body.topnav-active (топнав удалён r74, стили остались), .ai-note (баннед r-старый, hosts=0), 3 пустых @media-огрызка. scripts/article-end-audit.py удалён (одноразовый агентский костыль 3a226299, нигде не документирован). Локальные audit-pro-*.md отчёты подчищены (gitignored). (4) package.json: добавлен `typograf:dry` (§2.6 — инструмент существовал, но не был discoverable). README: дерево data/ дополнено (verses/original-words/links-graph), docs/GBS-PATTERN.md внесён. Сиротских картинок 0 (все 230 в использовании), сиротских шрифтов 0, hosts-проверка всех 11 JS и 7 CSS файлов. Итог: site.css 270K→267K, series-cards 8.8K→2.6K, CSS total 415K→412K. Аудиты: gates exit 0, audit-pro 151 passed · 0 errors, interactive-audit 35 pages · series 7 · all green, smoke 14 страниц Playwright — 0 ошибок. |
| **AGENTS-r106** | 2026-06-12 | **IndexNow CI — третий (последний) слой: bash-баги шага «Build IndexNow payload».** После r104/r105 гейты в CI прошли впервые с 13.05 (бот снова закоммитил auto-meta), но шаг payload упал: «Invalid format ... BASE/articles/...». Два bash-бага, существовавшие с создания workflow и маскировавшиеся падением гейтов: (1) sed-выражение подстановки BASE стояло в ОДИНАРНЫХ кавычках — переменная не разворачивалась, в URL уезжала литеральная строка с долларом; (2) финальный jq без флага -c давал многострочный pretty-JSON в echo urls=... >> GITHUB_OUTPUT, который принимает только однострочные значения (иначе «Unable to process file command output»). Фикс: sed в двойных кавычках с экранированным долларом, jq -c. Payload-скрипт прогнан локально на реальном диффе ba799f83..5beb729e: валидный однострочный JSON, 16 URL. Workflow YAML валиден, workflows:check green, ci:check green. Итог: цепочка из трёх независимых поломок одного пайплайна — duplicate-metas (r104) → timezone-гонка G20 в sitemap lastmod (r105) → bash payload (r106). Сабмит в Bing/Яндекс заработает при заданном секрете INDEXNOW_KEY (иначе корректный skip с warning). |
| **AGENTS-r105** | 2026-06-12 | **IndexNow CI — второй корень: timezone-гонка sitemap lastmod (G20).** r104 закрыл duplicate-metas и read-time drift, но workflow упал снова — уже на «sitemap.xml has 16 lastmod date(s) in the future». Корень: `update-meta.js` писал lastmod существующих статей/nagornaya/главной как ГОЛУЮ московскую дату `toDate()` → `2026-06-12`), а guard G20 в audit-pro парсит её как UTC-полночь и сравнивает с «сегодня» CI-раннера (UTC, ещё 11-е) → ложное «будущее» каждый вечер с 21:00 UTC. При этом ДОБАВЛЕНИЕ новых записей уже использовало `toSitemapLastmod()` (полный ISO с +03:00, который Date парсит с поясом корректно) — несоответствие в одном файле. Фикс: все 3 точки записи lastmod переведены на `toSitemapLastmod()`, мёртвый `toDate()` удалён, плюс существующий `normalizeSitemapLastmods` всё равно дописывает `T00:00:00+03:00` к голым датам при следующем прогоне. CI-симуляция с BEFORE_SHA/AFTER_SHA локально дважды: gates exit 0, audit-pro 151 passed · 0 errors, идемпотентно; sitemap теперь однородный full-ISO. Smoke 14 страниц: 0 ошибок, SDG на всех статьях, skip-link скрыт. После пуша IndexNow должен наконец дойти до сабмита (см. ⚠️: секрет INDEXNOW_KEY — если не задан, шаг корректно скипается с warning). |
| **AGENTS-r104** | 2026-06-12 | **CI-разбор: IndexNow workflow падал на каждом пуше — починен корень (data-consistency + duplicate meta).** Workflow `indexnow.yml` не доходил до сабмита URL с 2026-05-13 (628 ранов, последний success 08.05): шаг «Static publication gates» падал. Воспроизведено локально (update-meta → cache-bust → gates), два корня: (1) **Duplicate article:published/modified_time** — на chast-1-chelovek и hermenevtika меты исторически записаны в «перевёрнутом» порядке атрибутов (`<meta content=… property=…>`), regex update-meta их не видел (`hasPubTime=false`) и **дописывал вторую пару** → audit-pro G «OpenGraph singleton» падал; меты нормализованы в канонический порядок `property=… content=…`. (2) **read-time-drift 23 шт.** — update-meta честно пересчитывает readingTime из текста (`<article>` минус nav/aside, слова >1 буквы), а после GBS-миграции (rail/next-cards в nav) цифры упали: ch1 28→21, ch2 12→8, ch3 22→16, sprav 11→8, rim7 18→12, kod 28→30; series.json и search-manifest хранили старые. Синхронизировано ВСЁ по канону пересчёта: series.json, search-manifest (включая `/biografii/#dzhon-gill-series` 89→69), pagefind-меты (rim7, kod), видимые подписи в рельсе/шторке/next-картах/каталоге articles, rail-sub «89→69 мин серии» (Гилл) и «79→53 мин серии» (hard-texts), `data-gbs2-total-min` 89→69 и 79→53, `data-gbs2-done-min` фолбэки (37/45/61), лендинг hard-texts «59→53 минут чтения» и карточка rim7 18→12. Нагорная (89 мин) не тронута — это её честная цифра. Прогон CI-пайплайна локально дважды: gates exit 0, data-consistency ✅, идемпотентно. Re-QA: рельсы показывают новые минуты (Playwright), SDG 14/14, сноски 10/10, метро 64/81, свипы 40+17 страниц — 0 ошибок (1 флак-таймаут при повторе чист), audit-pro 151 passed · 0 errors. После пуша IndexNow workflow должен пройти впервые за месяц — проверить conclusion. |
| **AGENTS-r103** | 2026-06-11 | **Перепроверка после параллельного пуша (01426765 + 11 glossary-refine) — Playwright re-QA, 4 регрессии закрыты.** Параллельный агент запушил свой вариант фиксов 8 багов владельца: ss-share crash удалён ✓, герменевтика summary-card direct-child ✓, metro per-tick geo ✓, paper numOctaves+opacity ✓, next-card underline (unlayered в @layer-зоне site.css §gbs2) ✓, glossary 101×(definition+detail+category+aliases)+autoHydrate-флаг ✓. НО его коммит вернул/оставил 4 проблемы, найденные этим re-QA: (1) **`body.gbs-paper>*{position:relative}` вернулся** → на 3-х singles (kod/herm/antisovetov) ломал `position:fixed` ВСЕХ прямых детей body: skip-link «Перейти к содержанию» висел посреди страницы без фокуса, toc-sidebar (fixed) вставал в поток и отжимал контент на 746px вниз (огромная пустота сверху — видна и на проде), TTS-плеер и floating-controls лежали в конце документа вместо вьюпорта; правило заменено на точечное `>.page-wrap,>main,>.article-main` (toc-sidebar/skip-link/theme-toggle НЕ включать — они fixed/absolute). (2) **`button.bref{all:unset}` без position:relative** → 44px хит-зона `::after` (absolute) распухала до ширины абзаца-предка: на герменевтике (244 bref) перекрыты ВСЕ 116 fn-marker сносок (elementFromPoint → чужой .bref, 0/10 достижимы); добавлен `position:relative` в `all:unset`-правило → 10/10. (3) **Тултип не закрывался никогда**: в его 320мс-таймере условие `e.querySelector("[data-gtip-expand]")` блокировало close для ЛЮБОГО глоссарного тултипа (у всех 101 термина есть кнопка «Подробнее») — условие убрано; grace 320мс + :hover-проверка сохранены (случайный увод 150мс не закрывает). (4) **Уход с floating-tip не закрывал тултип** (tip переносится в body, dispatcher его pointerout не видел) + затенение `var i=t.anchor` ломало доступ к контроллерам — anchor переименован в A, добавлена else-ветка pointerout для tipSel с тем же 320мс grace. Re-QA после правок: SDG-крест 14/14 страниц, fn-сноски 10/10, тултип: открытие/expand/блуждание/grace/закрытие при реальном уходе — все сценарии green, metro 64/81 distinct, underline 0, 40 article-проверок (d/m × light/dark) + 17 страниц — 0 ошибок/overflow, audit-pro 151 passed · 0 errors, бюджеты: site.js 153k, enhancements 46.7k, !important 208. |
| **AGENTS-r102** | 2026-06-11 | **GBS rail v2.1 — паритет с эталоном макета (баг-репорт владельца по скрину).** Владелец: «метро — кавардак: блок раскрывается снизу, нет подпунктов, линия рывками по кружкам». Исправлено три класса проблем. (1) **Flow-rail**: JS переносит блок «Сейчас читаете» НА МЕСТО текущей части в списке (раньше список 5 частей сверху + блок отдельно снизу → выглядело «панель раскрывается внизу»); скрытая текущая строка списка, классы `.gbs2-flow`/`.gbs2-parts-after`; маски/max-height списка в flow-режиме сняты. (2) **Подпункты H3 группируются ПОД родительский H2** (`ul.gbs2-subg` внутри li), раскрыта только группа активной секции (max-height по scrollHeight, плавно); активен и родитель, когда активна подсекция; счётчик «N / M» считает только H2. (3) **Линия плавная**: CSS transition заливки .45s cubic-bezier(.22,1,.36,1) (была .38s ease + перерисовка только на смене секции — отсюда «рывки по кружкам»); во время анимации раскрытия группы линия следует за layout покадрово (kick/follow 520мс с transition:none), затем transition возвращается; трек теперь от центра первой ВИДИМОЙ точки до последней видимой, заливка строго до центра активной (инвариант макета v9/v13). Попутно: дубль `.gbs2-track` в kontekst (статический в tocscroll + JS-овский в ul) давал нулевую заливку — статический удалён из HTML, в JS добавлена зачистка таких дублей. enhancements.js фактически 47.3k — в пределах нового floor 48k. Самопроверка Playwright: flow=true, tracks=1, заливка монотонно растёт мелкими шагами, subg=2/open=1 на chast-1, шторка TOC 10 ссылок, 0 pageerror, light+dark скриншоты рельса сняты. Аудиты: audit-pro 152·0 errors. |
| **AGENTS-r101** | 2026-06-11 | **GBS Phase 2 §0 — поведение «мира серии» (по ROADMAP.md владельца).** Прогресс серии стал ЧЕСТНЫМ: `localStorage gb-series-progress:<key>` (key из нового `data-gbs2-series` на 7 страницах; части/минуты подтягиваются из series.json, planned-части без readingTime в знаменатель не входят), `data-gbs2-done-min` остался только как no-JS/первый-кадр фолбэк. Галочки `.gbs2-done` в рельсе и шторке теперь ставятся реально (прочитано = ≥90%), кольцо при 100% серии делает однократный пульс (reduced-motion — нет). Добавлены: тост «Вы остановились на N% — Продолжить» (`gb-series-pos:<key>:<slug>`, запись только после реального скролла и y>120 — защита от программных скроллов), «осталось ~N мин» по серии под кольцом + по части в title капсулы, клавиатура ←/→ между частями (через startViewTransition при поддержке), свайп от кромки 28px с peek-карточкой соседней части и одноразовым онбордингом (`gbs2-swipe-tip-seen`), автоскрытие мобильной шапки/капсулы при чтении вниз (аккумулятор 40px, возврат при скролле вверх), onerror-фолбэки всех обложек (миниатюры → номер на градиенте; hero → «фронтиспис» с римской цифрой data-n), строка-итог `.gbs2-sum` с точками частей над next-карточками. JS-floor enhancements.js поднят осознанно 28/40→34/48k (рост = функционал, не bloat). Самопроверка Playwright: честный 0% при первом входе в середину серии, 13% после прочтения 12-мин части, галочка на соседней странице, resume-тост с возвратом на y, ←/→ переход, автоскрытие вниз/возврат вверх, шторка ок, фолбэки 5 миниатюр + hero, hard-texts 69% (=41/59 опубликованных минут), 0 pageerror. Аудиты: validate:all 0/0, audit-pro 152 passed · 0 errors, tokens 0/0, readable PASS. |
| **AGENTS-r100** | 2026-06-11 | **Screenshot-bugfix pass + singles polish + CSS purge.** (1) Зафиксирован и добит баг владельца со скриншота: pilot-polish правило `.gbs2-parts{max-height:none}` действовало на ВСЕХ высотах экрана — на высоких список частей разрастался и давил metro-TOC текущей части («оглавление уехало вниз, будто нет подпунктов»); базовое правило возвращено к оригинальным пропорциям `clamp(170px,32vh,308px)` + scroll; проверено 1657/1440/1366. Бесшовное зерно (feTurbulence вместо квадратившего conic-gradient) — закрыто предыдущим коммитом e2e574c8, визуально подтверждено. (2) CSS-бюджет: возвращён под 390KB, затем **вычищены 64 мёртвых правила `.gb-strip*/.gb-snav*`** (−8.2KB, `!important` 204→201) — у них ноль HTML-хостов с r96, G113 запрещает возврат. (3) **Одиночные статьи подтянуты к премиум-уровню серий**: новый `body.gbs-paper` (бумажное зерно + gbs2-переменные + виньетка ✦ перед author-card, БЕЗ рельса — это не серии) на 20-antisovetov, hermenevtika, kod-da-vinchi; print скрывает зерно. Smoke 9 страниц light/dark — 0 JS-ошибок. **Итог: audit-pro 152 passed · 1 warning · 0 errors.** |
| **AGENTS-r99** | 2026-06-11 | **GBS loop closed: legacy series-UI снят с проводки + аудиты модернизированы.** (1) С 7 gbs-world страниц удалён мёртвый `<script series-cards.js>` (hosts `data-series-*` там отсутствуют; каталожный режим `data-series-cards` не затронут). (2) `interactive-audit.js`: checkSeries переписан с gb-strip-дропдауна (после раскатки всегда красный «no .gb-strip__toggle») на полный GBS-контракт — desktop: rail видим, aria-current часть, живой TOC, кольцо, ноль legacy/старого series-UI, клик по TOC скроллит и не уводит; mobile: капсула открывает шторку, вкладки переключаются, закрытие работает. Селекторы темы дополнены gbs2-кнопками — снят ложный «mobile-theme-control-not-visible» на 2 страницах. Итог: 35 pages · series 7 · all green. (3) **G113 gbsWorldIntegrityGuard** в audit-pro: каждая gbs-world страница обязана нести полный kit (data-gbs2-*-min, mobile-head, rail, ring, toc, bbar, sheet, aria-current) и НОЛЬ legacy-остатков — это точный crash-mode, чинившийся в r96; ловит и подключение series-cards.js на article-страницах. (4) readable-audit: `--gbs2-cover:url()` распознаётся как presentation, не как «raw image path leak». (5) §9.11 переписан: GBS = канон серий, legacy strip/nav запрещены, задокументированы `.gbs2-scope`, planned-статус и обязательный interactive-audit перед правками GBS. OWNER-REQUIREMENTS п.11 обновлён. **Итог: audit-pro 152 passed · 1 warning · 0 errors; interactive-audit green; smoke 11 страниц — 0 ошибок.** |
| **AGENTS-r98** | 2026-06-11 | **Hard-texts landing GBS-апгрейд + data-sync минут чтения.** (1) Найден сайтовый рассинхрон: карточки krajne показывали «32 мин» на 10 страницах (главная, каталоги, related-блоки Нагорной и статей), при series.json=41 и реальной подписи в статье 41; всё синхронизировано 32→41, статистика лендинга 50→59 мин. (2) `/hard-texts/` получил GBS-карту серии (`.gbs2-timeline` Иер 17 → Рим 7 → Рим 8, planned приглушён) + стартовую карточку `.gbs2-next` «Начать серию». (3) Введён **`.gbs2-scope`** — класс-носитель gbs2-переменных (light+dark) для встраивания gbs2-компонентов на страницы без `body.gbs-world`; 2 selector-only правки в минифицированном site.css. Playwright light/dark — чисто. **Итог: audit-pro 151 passed · 1 warning · 0 errors.** |
| **AGENTS-r97** | 2026-06-11 | **GBS rollout: серия «Тайны человеческого сердца» (hard-texts, 2/2 опубликованных страниц).** По «да» владельца паттерн перенесён с Гилла: `krajne-li-isporcheno-serdce` (ч.1, 41 мин) и `rimlyanam-7` (ч.2, 18 мин) переведены в gbs-world c weighted-прогрессом (total=79); запланированная ч.3 «Закон духа жизни (Рим 8)» показана в рельсе/шторке приглушённой («скоро»), без ссылки. Отличие архитектуры: эти страницы используют `main.article-main` без `div.page-wrap` — селекторы `.gbs2-world .page-wrap` расширены до `,.gbs2-world>.article-main` (2 точечные правки в минифицированном site.css, cache-bust по всему сайту). Удалены legacy-блоки обеих страниц + gb-strip. Сторож G86 (reading-time drift) удовлетворён: «~мин части» в mobile-head, «мин серии» без тильды в rail-sub. Playwright: обе страницы desktop+mobile+sheet, 0 JS-ошибок. **Итог: audit-pro 151 passed · 1 warning (known !important ratchet) · 0 errors.** `_agent-handoff/README.md` дополнен особенностями hard-texts. |
| **AGENTS-r96** | 2026-06-11 | **GBS rollout complete для серии «Джон Гилл» (5/5 страниц) + crash recovery.** Предыдущий агент упал посреди миграции `chast-1-chelovek`, оставив legacy-блоки (`#reading-progress`, `#section-label`, старый `#themeToggle`, `#tocSidebar`, `#bottomBar`, `#btocOverlay`, старый `.series-next-cta`) поверх GBS-мира — рендерилась вторая полоса прогресса и дубль карточки следующей части. Вычищено (dc8d8de7). Затем по эталон-паттерну мигрированы `chast-2-uchenyi` (1e73e204), `chast-3-nasledie` (3ed9189e), `spravochnik` (bcf6389f); из kontekst удалён мёртвый legacy themeToggle (1502d865). Каждая страница: weighted-прогресс серии (done-min/part-min/total-min=89), rail с aria-current, пререндеренный TOC, hero+kinetic+vignette+next-cards+timeline, мобильная капсула+шторка. Введена **временная папка `_agent-handoff/`** (README.md статус/план/чеклист + PATTERN.md анатомия миграции) для непрерывности между агентами — владелец удалит после завершения раскатки. Финальный Playwright-проход всех 5 страниц: 0 legacy, 0 старых CTA/strip, 0 JS-ошибок, light+dark, 1440+390. **Итог: audit-pro 151 passed · 1 warning (известный !important ratchet) · 0 errors, validate:all green.** Следующий шаг — только после согласования владельцем: hard-texts. |
| **AGENTS-r95** | 2026-06-10 | **GBS reference pilot policy.** Начат новый аккуратный подход после отката сырого rollout: GBS внедряется сначала как эталон на одной странице `dzhon-gill-istoricheskiy-kontekst`, без масштабирования и без merge в `main` до визуального согласования. Зафиксировано: визуальный слой не режется ради старого CSS-budget; `MAX_CSS_TOTAL` поднят до 390KB как предупреждающий сторож, а не отключён. Нагорная функционально не трогается; изменения её HTML возможны только как cache-bust-хэши после правки общих CSS/JS. **Итог:** `audit-pro` **151 passed · 1 warning · 0 errors**, `validate:all` green. |
| **AGENTS-r93** | 2026-06-10 | **Primary-source marathon + probe guard hardening.** По запросу владельца загружен и разобран большой gist `MASTER-SOURCE-RESEARCH-2026-06-08` (`pass-001`..`pass-027`, ~10k строк research notes). Проведены source-hardening батчи по Da Vinci Code, Gill, Krajne и Nagornaya: исправлены/смягчены claims без pinned источника; Today Show больше не используется как самостоятельная direct quote без ручной расшифровки видео; Da Vinci stats привязаны к PRH/Britannica/CSMonitor/BoxOfficeMojo; Gregory Homily 33 заменён с SSL-bad host на Roger Pearse/PL 76 locus; Gill Part I legal sentence fixed; Gill/Krajne/Nagornaya overclaims смягчены; TMS generic archive links заменены прямыми PDF. **Новые guards:** G104 nestedSourceTooltipGuard (блокирует `.fn-marker` внутри `.tooltip`) и G105 knownBadExternalSourceHostGuard (блокирует SSL-bad source hosts вроде `arthistoryresources.net`). Итог: `audit-pro` green (0 warnings / 0 errors), `visual-audit` 32 pages / 96 screenshots / 0 console / 0 network / 0 unsuppressed. |
| **AGENTS-r92** | 2026-06-10 | **Полная повторная ревизия John Gill pages + editorial lock after self-audit.** По запросу владельца заново просмотрены документация, все 5 Gill-материалов, каталоги (`/`, `/biografii/`, `/articles/`), метаданные и реальный визуал через браузер. Найдены и исправлены вторичные регрессии, оставшиеся после восстановления текста из history: (1) в Части I был снова сломан outer-`fn-marker--dove` вокруг даты рождения — маркер втягивал целый абзац; исправлено; (2) в историческом контексте обнаружен **недопустимый вложенный `<picture>`** у `underground-puritan-meeting`; исправлено; (3) в Части III висел **устаревший preload `gill-wesley-letters.jpg`**, которого больше нет в контенте; удалён; (4) исправлены подписи/alt там, где текст описывал не то, что реально видно на картинке: `gill-kettering-1697` (ранняя кеттерингская бытовая среда, а не funeral), `gill-spurgeon-succession` (символ преемственности кафедры, а не буквальный портрет Сперджена), `gill-bunhill-fields` (погребальная процессия, а не пустой вид кладбища); (5) английский гимн крещения в Части I переведён на русский, оригинал оставлен в `<details>`. **Новый editorial lock:** в Gill-series нельзя доверять одному filename — описывать нужно реальное изображение. Зафиксировано в §9.14–9.15. Это защита от будущих откатов/ложных «restore old image» решений. |
| **AGENTS-r91** | 2026-06-09 | **Тщательная перепроверка по запросу: ещё одна регрессия найдена + 2 новые защиты.** Прошёл по ВСЕМ удалённым в коммите `43bf09ea` файлам, проверил их upstream-references в HEAD. Помимо 5 уже восстановленных `og-*-600w.webp` нашёл **давнюю поломку (НЕ моя)** — в `feed.xml` `<image><url>` указывал на `images/og-preview.jpg` (удалён в чужом коммите `89679fc7` ещё в мае 2026). **RSS-ридеры получали 404 для feed-картинки уже месяц**. Исправлено: ссылка переведена на актуальный `og-preview-1200x630.webp`. Также прошёл по интернет-стандартам: ✅ DOCTYPE на всех content-страницах, ✅ все og:image ≥ 600×600 (FB-минимум), ✅ all JSON-LD image refs целы (0 missing), ✅ CSS background-image только data:-URIs, ✅ SW precache covered by G36 whitelist. **G102 dataAssetReferenceGuard**: каждый URL (абсолютный или root-relative) в `feed.xml`/`manifest.json`/`llms.txt`/`search-manifest.json` должен указывать на существующий файл (поймал бы preview.jpg-поломку). **G103 changelogCodeConsistencyInfo**: INFO-сверка, что числовая цифра в AGENTS-rNN claim совпадает с фактическим количеством `R.ok()` в audit-pro (защита от меня же — claim'ить «140 passed», когда реально другое). **Итог: 143 passed · 0 warn · 0 errors · 8 info.** |
| **AGENTS-r90** | 2026-06-09 | **URGENT FIX моей же ошибки в r89.** При тщательной перепроверке (на запрос владельца) обнаружил: при чистке 7МБ orphan-картинок я ошибочно удалил 5 файлов, которые РЕАЛЬНО использовались в `<source srcset>` `<picture>`-элементов на страницах-каталогах: `og-rimlyanam-7-600w.webp`, `og-krajne-isporcheno-600w.webp`, `og-dzhon-gill-chast-2-uchenyi-600w.webp`, `og-dzhon-gill-chast-3-nasledie-600w.webp`, `og-dzhon-gill-istoricheskiy-kontekst-600w.webp`. Использовались в `articles/index.html`, `biografii/index.html`, `hard-texts/index.html`, `index.html` (карточки серий с responsive `<picture>`). Утверждение в r89 «OG responsive variants не нужны — соцсети всегда полный размер» **было ЛОЖНЫМ** — эти файлы использовались НЕ для OG-мета (где правда полный нужен), а для responsive рендера ВНУТРИ страниц-каталогов. **Моя G62/G94/G30 защиты корректно поймали проблему** (`❌ Image references to non-existent files`, `⚠️ Missing local reference`) — но я не запустил audit ПОСЛЕ удаления push, поэтому пуш ушёл со сломанными ссылками. **Восстановлено 5 файлов** (~150KB), пуш `661b230a` восстанавливает проде. Урок: каждое масштабное удаление обязательно прогонять через audit-pro ДО push. **Итог: 141 passed · 0 warn · 0 errors.** Остальные ~6.5MB удалённого мусора — действительно orphans (whitefield-preaching.jpg, gill-hebrew-scroll-yad, gill-manuscript-drafts, etc.) — подтверждено grep'ом по HEAD. |
| **AGENTS-r89** | 2026-06-09 | **Cleanup ~7MB image orphans + G101 guard.** Полная перепроверка проекта обнаружила **47+19 = 66 orphan images** (бесполезные responsive-варианты OG-картинок, удалённые серии вроде `gill-hebrew-scroll-yad`, `gill-manuscript-drafts`, `whitefield-preaching.jpg`, остатки `og-about-*`, `og-preview-*-600w/-900w`). **Удалено 6.8MB**: 51 файл в первой партии + 19 OG-responsive-вариантов во второй. Восстановил 24 файла которые были false-positive первым «наивным» orphan-детектором (он не находил variants внутри srcset comma-separated значений) — поправил алгоритм. **G101 orphanImagesGuard**: ERROR-блокер если в `/images/` появится файл, не упомянутый ни в одном `.html/.css/.js/.json/.xml/.md/.txt`. Whitelist: суффиксы `*-original.*` и `*--keep.*` для явных архивных оригиналов. **Итог: 141 passed · 0 warnings · 0 errors · 8 info.** Images: 241 файлов, ~35MB (было 288 файлов ~42MB). Audit ~2.0 сек. Total active guards: **123** (G1–G101 минус retired G47 + 22 классических). |
| **AGENTS-r88** | 2026-06-09 | **Round 12 — mobile-specific guards G96-G100.** Тщательная разведка mobile-регрессий за всю историю (~600 коммитов): искал overflow-x, touch targets, broken sticky elements, mobile menu wiring, inline px-widths. Проект уже в хорошем mobile-состоянии — реальных регрессий не найдено, но 5 новых hard-сторожей теперь предотвращают типичные паттерны. **G96 bodyOverflowSentinelGuard**: `body{overflow-x:hidden}` + `html{overflow-x:clip}` обязательны (без этого rogue inline-width элементы делают страницу горизонтально-скроллящейся). **G97 inlineWidthOverflowGuard**: warning на inline `style="width:NNNpx"` ≥ 320px без `max-width:100%` safeguard (overflow на мобиле 320-400px). **G98 touchTargetCoverageGuard**: проверяет, что в `mobile-hotfix.css` есть `@media (pointer:coarse)` блок с min-width/height:44px для **всех** 7 канонических icon buttons (`.btoc-close, .cp-close-btn, .h-cp-btn, .h-mobile-menu-btn, .gb-nav-search-icon, .bar-icon-btn, .mobile-nav-close`) — WCAG 2.5.5. **G99 mobileMenuWiringGuard**: страница с `<button class="h-mobile-menu-btn">` ОБЯЗАНА иметь `#hMobileNav` + `#hMobileBackdrop` (иначе burger не открывает меню — мёртвая кнопка). **G100 stickyOverlapsBottomBarGuard**: каждый `position:fixed; bottom:` элемент должен иметь `body.has-bottom-bar` override для +72px (иначе sticky-элемент сидит ПОД bottom-bar на article-страницах). **Итог: 139 passed · 1 soft warning · 0 errors · 8 info.** Audit ~2.1 сек. Total active guards: **122** (G1–G100 минус retired G47 + 22 классических). |
| **AGENTS-r87** | 2026-06-09 | **Round 11 — реальная аналитическая дыра + 5 защит G91-G95.** **Найдена и устранена крупная регрессия:** на 3 страницах (`dzhon-gill-istoricheskiy-kontekst/`, `dzhon-gill-spravochnik/`, `rimlyanam-7-veruyushchiy-ili-neveruyushchiy/`) **полностью отсутствовала Яндекс Метрика** — ни tracker pixel, ни ym() init. Все JS-посетители этих страниц **не отслеживались** (это ~30% всего траффика). Добавлен стандартный блок Yandex.Metrika во все 3 страницы (формат как в Гилл-1). **G91 yandexMetrikaConsistencyGuard**: каждая content-страница должна иметь **И** ym() init **И** `<noscript>` tracker pixel — они matched pair. **G92 protocolRelativeLinkGuard**: запрещены `href="//path"` (legacy protocol-relative, ломаются на file:// preview). **G93 pictureNeedsImgFallbackGuard**: каждый `<picture>` обязан иметь `<img>` fallback внутри (иначе браузер показывает пустоту). **G94 jsonLdImageReferencesGuard**: каждая `image`/`logo`/`contentUrl` в JSON-LD графе должна резолвиться (3-я гарантия: G62 для og:image, G89 для image:loc в sitemap, теперь G94 для JSON-LD nodes). **G95 headIntegrityGuard**: запрещены `<body>`/`<main>`/`<img>` теги внутри `<head>` (исключение: `<noscript>` блоки legitimate). **Итог: 134 passed · 1 soft warning (z-index magic) · 0 errors · 8 info.** Audit ~2.1 сек. Total active guards: **117** (G1–G95 минус retired G47 + 22 классических). |
| **AGENTS-r86** | 2026-06-09 | **Round 10 — finale + bug fix in G51 + real LCP regression fixed.** **Исправлен false-positive в собственной защите G51**: она неправильно считала 2 `fetchpriority="high"` для **одной и той же** картинки (preload + img — это правильный web.dev паттерн!) как нарушение. Теперь G51 нормализует имя файла (убирает `-600w` суффикс, расширение, путь) — реально проверяет UNIQUE ресурсы. Это уменьшило false-positives с 8 страниц до 1 РЕАЛЬНОЙ регрессии. **Найдена и исправлена настоящая LCP-регрессия:** на главной (`index.html`) сразу 2 разных hero-картинки имели `fetchpriority="high"` — `og-nagornaya-propoved` (LCP, preload+img) И `og-biografii` (вторая featured-серия НИЖЕ скролла). Биографии должны быть `loading="lazy"` без high — починено. **G86 readingTimeConsistencyInfo**: drift между `series.json.readingTime` и реальным "~XX мин" в HTML; INFO до 20 мин разницы. **G87 preloadedFontsExistGuard**: каждый `<link rel="preload" as="font">` URL должен резолвиться. **G88 llmsTxtSanityGuard**: проверяет, что каждый URL в `llms.txt` (AI-discovery indexes для Perplexity/ChatGPT Search/Claude/Grok) указывает на существующий файл И не на noindex-страницу. **G89 sitemapImageExistGuard**: каждый `<image:loc>` в image sitemap резолвится в реальный файл. **G90 ogImageHeroAlignmentGuard**: INFO когда `og:image` не совпадает с LCP-priority картинкой страницы (alignment signal для соц-сетей). **Итог: 129 passed · 1 soft warning (z-index magic) · 0 errors · 8 info notes.** Audit duration: ~2.1 сек на 129 проверок. Total active guards: **112** (G1–G90 минус retired G47 + 22 классических). |
| **AGENTS-r85** | 2026-06-09 | **Round 9 — Schema/Speakable/A11y/Workflow guards G76-G85. Найдена реальная регрессия:** 4 страницы (`hard-texts/`, `pastor-series/`, `nagornaya/istochniki/`, `nagornaya/nakhodki/`) имели `data-speakable` HTML атрибут, но НЕ имели `SpeakableSpecification` JSON-LD — голосовые ассистенты (Google Assistant, Алиса) не знали, что зачитывать. **Исправлено:** во все 4 страницы добавлены SpeakableSpecification JSON-LD блоки с правильными `cssSelector` массивами (`h1`, `.h-hero-desc`/`.article-lead`, `.summary-card`, `[data-speakable]`). **G76 speakableConsistencyGuard**: data-speakable HTML и SpeakableSpecification JSON-LD должны быть парой. **G77 reducedMotionCoverageGuard**: каждый CSS с ≥5 timed-animations должен иметь хотя бы один `prefers-reduced-motion` блок (WCAG 2.3.3). **G78 breadcrumbListPresenceGuard**: каждая Article+landing страница ОБЯЗАНА иметь BreadcrumbList JSON-LD (без него SERP показывает уродливые URL). **G79 articleDatesConsistencyGuard**: `dateModified` ≥ `datePublished` во всех JSON-LD блоках. **G80 colorMixFallbackInfo**: INFO о количестве `color-mix()` использований (Safari <15.2). **G81 articleAuthorIdGuard**: Article author в JSON-LD должен иметь `@id` reference (E-E-A-T signal Google). **G82 lazyLoadingHeuristicGuard**: above-fold `<img>` с `loading="lazy"` запрещены (killer для LCP). **G83 unusedCssClassesInfo**: heuristic INFO о возможно-неиспользуемых CSS классах (с исключениями для runtime-state классов `tw-*`, `is-*`, `gb-fc-*`, `cp-*`). **G84 workflowPinnedActionsGuard**: workflow `uses:` action должен быть pinned (не `@main`/`@latest` — supply-chain attack vector). **G85 agentsMdChangelogInfo**: INFO о количестве AGENTS-r* строк (после 100 — пора архивировать). **Итог: 124 passed · 2 soft warnings (fetchpriority + z-index) · 0 errors · 7 info.** Total guards активных: 107 (G1–G85 минус retired G47 + 22 классических). |
| **AGENTS-r84** | 2026-06-09 | **Round 8 — DALL-E 9:16 portrait image bug + 5 guards G71-G75. Найдена и устранена реальная регрессия в проде:** изображение `gill-context-scroll.webp` (1504×2784, ratio 1.85 — почти 9:16) сидело в `<figure class="article-img float-left reveal">` без класса `--vertical`. На мобильном с `float:none; width:auto` оно занимало ~666px по высоте — «9:16 на весь экран», как описал владелец. **Исправлено:** переведено в `article-img--vertical float-left` с явным width="270" height="500", responsive sizes="(max-width:640px) 200px, 270px". Также найдены 2 СОПУТСТВУЮЩИЕ регрессии: `gill-southwark-sermon-900w.webp` (1200×1800) и `rim7-believer-heart.webp` (1024×1536) — тоже portrait без `--vertical` класса. Оба исправлены. **Добавлен CSS блок** в `site.css` (без `!important`!): `.article-img.article-img--vertical.float-left/right` — desktop 270px, mobile 160px, с правильной mobile-floating-схемой через `shape-outside:margin-box`. **G71 verticalImageClassGuard**: каждый `<img>` где `height >= 1.4*width` ОБЯЗАН быть в figure с `article-img--vertical` (защита от DALL-E 9:16). **G72 figureCaptionGuard**: каждый `<figure class="article-img">` должен иметь `<figcaption>` (a11y/SEO). **G73 seriesStripPlacementGuard**: `<aside data-series-strip>` всегда ПЕРЕД `<section class="summary-card">` (защита от regression коммита #2920a36e). **G74 altTextQualityGuard**: запрещает паттерны "image of…", alt=filename, слишком короткие alt. **G75 srcsetDescriptorAccuracyGuard**: `srcset` width-descriptor должен совпадать с filename hint (`foo-600w.webp 600w` ≠ `foo-600w.webp 900w`). **Итог: 117 passed · 2 soft warnings · 0 errors.** !important остаётся 199/200, новый CSS блок написан БЕЗ единого !important. |
| **AGENTS-r83** | 2026-06-09 | **Round 7 — infrastructure/SW/workflow guards (G61–G70).** Финальная порция хирургических проверок: **G61 swPrecacheCompletenessGuard** — sw.js `PRECACHE_ASSETS` обязан содержать все 5 CSS + 11 JS (любой rename/delete должен mirror в SW, иначе пользователи видят 404 placeholder из cache). **G62 ogImageExistsGuard** — каждый `<meta og:image>` URL должен резолвиться в реальный файл (G30 проверяла только `<img>` references). **G63 namedColorAntiPatternGuard** — `color: red/blue/green/…` в CSS = warning (используй `var(--color-…)` токены из AGENTS-r46/r51). **G64 workflowSecurityGuard** — каждый `.github/workflows/*.yml` обязан иметь `permissions:` block (security best-practice) и deploy-workflows — `concurrency:` group. **G65 zIndexTokenGuard** — magic z-index ≥ 10 = warning (AGENTS-r33 требует `--z-*` токены). **G66 siteConfigVersionFreshnessGuard** — INFO о placeholder-ах `version: 1` в SITE_CONFIG. **G67 trailingSlashConsistencyGuard** — каждая `<a href="/path">` без extension обязана иметь trailing slash (иначе 301-hop). **G68 seriesLandingInSitemapGuard** — каждая series-landing на диске обязана быть в sitemap.xml. **G69 duplicateSvgBodyGuard** — INFO когда одна SVG-иконка инлайнится в 5+ файлах (perf-полировка). **G70 cacheBustHashFormatGuard** — каждый `?v=xxx` хеш формата 6-12 hex chars (защита от поломанного cache-bust скрипта). **Итог: 112 passed · 2 soft warnings · 0 errors · 4 info.** Время аудита: **1.5 сек**. Всего 92 IIFE-функции в `scripts/audit-pro.js` (2946 строк) — все живые проверки, никакого мусора. |
| **AGENTS-r82** | 2026-06-09 | **Bug-hunt of own guards + Round 6 surgical performance/data-consistency.** Прошёл по 627-коммитной истории по неисследованным доменам (FOUC, CLS, manifest, search-manifest, fetchpriority, feed sync, CNAME, robots.txt). **Fix 2 own-guard bugs**: (a) G29 (CSS vars) кричал warning на каждый `var(--ink)` хотя у него есть fallback `var(--ink, #14100b)` который рендерится корректно — теперь G29 различает bare-usage (без fallback) от usage with fallback; добавлены 6 runtime-externals из JS (`--mouse-x`, `--cp-max-h`, `--hb-front-w` и др.). (b) G44 (innerHTML XSS) был **слишком жадным**: ловил слово `value` ВНУТРИ HTML-шаблонной строки `<span class="kb">⌘K</span>` (это string literal, не JS-access!) — переписан с настоящим string-stripping ПЕРЕД regex, плюс ужесточен список untrusted-источников до реальных (`location/cookie/input.value/fetch/storage`), уменьшен diapason до 180 символов чтобы не спилл-овер в следующий statement. **G51 fetchPriorityHighGuard**: warning если >1 `fetchpriority="high"` на странице (web.dev/Google: для LCP только 1 max — иначе они конкурируют). **G52 feedArticleParityGuard**: каждая ссылка в `feed.xml` должна указывать на реальный файл на диске. **G53 sitemapFeedDriftInfo**: drift detection между sitemap.xml и feed.xml. **G54 manifestRequiredFieldsGuard**: `manifest.json` имеет name/start_url/display/icons/theme_color, и каждая icon существует. **G55 htmlLangIsRussianGuard**: `<html lang="…">` обязан быть `ru` или `ru-RU` (не `en`). **G56 rssAlternateConsistencyGuard**: `<link rel="alternate" RSS>` указывает на ОДИН и тот же URL на всех страницах. **G57 imageDimensionsCLSGuard**: каждый `<img>` в контенте имеет `width` + `height` (предотвращение CLS); decorative и noscript-tracker исключены. **G58 noCssImportGuard**: запрещает `@import` внутри наших 5 CSS-файлов (render-blocking serial waterfall). **G59 robotsTxtSanityGuard**: robots.txt не блокирует весь сайт + содержит `Sitemap:` директиву. **G60 cnameMatchesCanonicalGuard**: содержимое CNAME совпадает с canonical-доменом (защита от typo при rename). **Итог: 105 passed · 1 soft warning (fetchpriority, info-only) · 0 errors.** |
| **AGENTS-r81** | 2026-06-09 | **OPENNESS RESTORED + Anti-regression guards Round 5.** Хозяин (Фёдор) явно подтвердил: **максимальная SEO-открытость** — это стратегия проекта. `nagornaya/istochniki/` (66+ источников: TMSJ, MacArthur GTY, Chicago Statement) и `nagornaya/nakhodki/` (21 верифицированная находка) **возвращены к `<meta robots="index, follow…">`** и **возвращены в sitemap.xml**. Виновник — старый коммит `62bee809 chore: update from zip gb-is-my-strength-v3-fixed` (май 2026), какой-то агент поставил noindex без обсуждения. **G41 noindexAllowlistGuard**: блокирует любой `noindex`, кроме явного allowlist (404 + 3 robot-stubs). Если кто-то снова добавит — аудит мгновенно фейлит. **G42 jsRatchetGuard**: каждый из 6 ключевых JS-файлов имеет HARD-cap (site.js ≤ 180KB, search.js ≤ 55KB, и т.д.), нарушение блокирует деплой. **G43 cssDeadVarsInfo**: INFO-проверка количества unused CSS-переменных (AGENTS-r34 чистил 21 шт.); warning только при >50. **G44 innerHtmlXssHeuristic**: warning на `.innerHTML = ${var}` без escapeHtml/sanitiz/textContent. **G45 jsonLdUrlConsistencyGuard**: каждый Article/CollectionPage/WebPage JSON-LD должен иметь `url` совпадающий с canonical (защита от copy-paste schema между страницами). **G46 preloadUsageGuard**: warning если `<link rel="preload" as="image">` ссылается на файл, которого нет в body. **Нашёл и почистил 7 бессмысленных preload-ов** (og-картинки превью, которые никогда не отображаются на странице — пустая трата bandwidth). **G47 retired**: первая версия (запрет Фёдор-as-Person в JSON-LD) была false-positive — для авторских статей Фёдор и есть автор, это легитимно. Номер зарезервирован. **G48 deprecatedVendorPrefixGuard**: запрещает `-webkit-border-radius`, `-moz-border-radius`, `filter:alpha()` и др. dead-since-2015 префиксы (AGENTS-r48b их чистил). **G49 articleJsonLdRequiredFieldsGuard**: каждая `/articles/<slug>/` ОБЯЗАНА иметь ровно 1 Article JSON-LD с `headline + datePublished + image`. **G50 themeColorGuard**: каждая content-страница должна иметь `<meta theme-color>` для **обеих** медиа-схем (light + dark) — иначе мобильная адресная строка не подкрашивается. **Итог: 94 passed · 2 soft warnings · 0 errors.** |
| **AGENTS-r80** | 2026-06-09 | **Anti-regression guards Round 4 + 2 bugs caught in own guards + 1 real SEO regression fixed.** Прошёл по неисследованным доменам: canonical/sitemap/CSP/SW-precache/charset/JSON-LD shape/feed freshness. **Реальная SEO регрессия:** `nagornaya/istochniki/` и `nagornaya/nakhodki/` были в sitemap.xml но имели `<meta robots="noindex">` — Google не любит такие конфликты (могут «de-trust» весь sitemap). Удалил их из sitemap (оставил доступными по ссылкам). **2 бага в собственных guards:** (a) G32 canonical-проверка искала только `rel="canonical" href="…"` — пропускала обратный порядок `href="…" rel="canonical"`, дала 5 false-positives на Гилл-статьях; теперь tolerant к любому порядку атрибутов; (b) G37 CSP-парсер был хрупкий, выдавал false-positives для легитимных hosts из img-src (mc.yandex.ru есть в CSP, но мой regex не находил) — переписал с чистого normalized split. **G31 sitemapNoindexConflictGuard**: страницы в sitemap не должны иметь `noindex` (поймал прод-регрессию). **G32 canonicalSanityGuard**: каждая content-страница имеет уникальный canonical, совпадающий с собственным URL на gospod-bog.ru. **G33 viewportZoomGuard**: запрещает `user-scalable=no` / `maximum-scale=1` (WCAG 1.4.4 a11y). **G34 inlineEventHandlerGuard**: запрещает inline `onclick`/`onload`/`onerror`/etc. в HTML (CSP violation, в проде silently fail). **G35 charsetEarlyGuard**: `<meta charset>` обязан быть в первых 1024 байт `<head>` (иначе браузер re-parse). **G36 swPrecacheAssetExistGuard**: каждый URL в sw.js precache должен существовать на диске (исключение: `/pagefind/` генерится в CI). **G37 cspExternalHostCoverageGuard**: каждый внешний `<img src="https://…">` host должен быть в CSP `img-src` allowlist (защищает от silent blocking). **G38 feedFreshnessGuard**: warning если `feed.xml` `<lastBuildDate>` старше 60 дней. **G39 jsonLdShapeGuard**: каждый JSON-LD блок имеет `@context=schema.org` и `@type` или `@graph`. **G40 descriptionLengthGuard**: warning если `<meta description>` >300 символов. **Итог: 87 passed · 1 warning (legacy CSS vars) · 0 errors.** |
| **AGENTS-r79** | 2026-06-09 | **Anti-regression guards Round 3 + bug hunt on own guards.** Прошёл всю 624-коммитную историю по неисследованным доменам (a11y — 48 коммитов, duplicate — 35, Hebrew/RTL — 29, scroll-lock — 10, touch — 13, SW — 14, browser-compat — 9), вычленил повторяющиеся боли. Перед добавлением новых проверок исправил **5 багов в собственных защитах G1–G20**: (a) G1 был не рекурсивный — теперь обходит весь репо и ловит мусор в любых подпапках, расширен список (`.bak`, `.orig`, `.rej`, `~`); (b) G14 не распознавал `<meta content="…" property="og:image">` (атрибуты в обратном порядке); (c) G6/G7 хрупкие к одинарным кавычкам и многоатрибутному `<ul>`; (d) G2 показывала размер с дробью «683.59375 KB»; (e) G17-OK-сообщение врало «50 LOC» при пороге 500. **G21 singleH1Guard**: ровно 1 `<h1>` на content-страницу (SEO+a11y), skip robot-stubs. **G22 mixedProtocolGuard**: `http://` в href/src запрещено, whitelist `w3.org` + `web.archive.org` (легитимные снапшоты). **G23 targetBlankRelGuard**: каждый `target="_blank"` обязан иметь `rel="noopener"`. **G24 badAnchorHrefGuard**: `href="javascript:…"` запрещён; голый `href="#"` — только если нет `data-*`/`role=` (легитимный progressive-enhancement не считается багом). **G25 htmlLangGuard**: `<html lang="…">` обязателен. **G26 linkAccessibleNameGuard**: каждый `<a>` имеет visible text / aria-label / alt вложенной картинки / `<title>` в SVG — иначе скринридер ничего не видит. **G27 buttonAccessibleNameGuard**: icon-only `<button>` обязан иметь `aria-label` (защищает §9.7-кнопки темы/поиска). **G28 tabindexAntiPatternGuard**: `tabindex` > 0 — фейл (создаёт keyboard-order hell). **G29 cssVariableHygieneGuard**: warning если `var(--name)` без соответствующего `--name:` определения; 12 known externals whitelisted. **G30 imageResponsiveSetGuard**: каждый `src`/`srcset` URL картинки должен резолвиться (защита от PLAN-07 #ebf52955 «missing base files»). **Итог: 77 passed · 1 warning (CSS-vars legacy) · 0 errors.** |
| **AGENTS-r78** | 2026-06-09 | **Surgical anti-regression Round 2** — 10 ещё более точных защит (`G11–G20`) после анализа всей 623-коммитной истории. Каждая привязана к реально случавшемуся инциденту и ловит ровно его. **Span balance: порог снижен с `> 20` до `> 0`** — это сразу выявило 6 живых багов в проде, не отловленных за десятки коммитов (#bb3ccfa7, #49882d96, #176facb2). Исправлены ВСЕ 8 unclosed-spans: `<span class="bar-progress-text">0%</span>` × 6 файлов (был мусор без `</span>`), `<span class="btoc-progress-pct">0%</span>` × 4, breadcrumb `<span>Главная</span>` × 3 (был `<span>Главная</span></a></span></li>` — закрытие внутри неверного контейнера), `<span class="bookmark-toast-icon">` × N, `<span>...~XX мин чтения</span>` × N, `kod-da-vinchi` имел 5 лишних `</span></span></span></span></span>` на отдельной строке, `krajne` имел `>~32 ми</span>н</span>` (закрытие внутри слова «мин»!), `articles/index.html` — `<span class="h-scroll-top-arrow">` без `</span>`. Все HTML теперь с **diff(open,close)==0**. **G11 topnavExorcismGuard**: блокирует возврат `<…class="article-topnav…">` (AGENTS §9.8, удалён 2026-06-08). **G12 deadClassResurrectionGuard**: 5 классов из PLAN-04 P5-P7 (`.theme-float-btn`, `.ai-disclosure`, `.nag-theme-btn`, `#themeFloat`, `#gbSearchFloat`) — заблокированы и в HTML, и в CSS, и в JS. **G13 aiNoteInFigcaptionGuard**: `<span class="ai-note">` или текст «Изображение сгенерировано ИИ» внутри `<figcaption>` — фейл (AGENTS §289). **G14 ogMetaDuplicateGuard**: `og:image`/`og:title`/`og:url`/`og:description`/`twitter:image` дубли (баг #65ef82a5). **G15 pictureSourceWrapperGuard**: `<source srcset>` без `<picture>`-обёртки (баг PLAN-07 #ebf52955). **G16 brokenListenerPatternGuard**: `addEventListener('x', function(, {passive:…}))` — паттерн поломок AGENTS-r45c/47c/47d. **G17 bigInlineScriptGuard**: inline `<script>` > 500 LOC (warning, не fail) — исключения для JSON-LD, SITE_CONFIG, QUIZ_DATA. **G18 keyframesIntegrityGuard**: `@keyframes` без from/to/% правил (баг #32eabff7 «broken @keyframes regression»). **G19 swCacheVersionGuard**: `CACHE_VERSION` в sw.js — строковый литерал ≥ 3 символа с цифрой. **G20 sitemapFutureDateGuard**: `lastmod` в sitemap не может быть в будущем (баг #65ef82a5 «normalize sitemap lastmod»). **Итог: 68 passed · 0 warnings · 0 errors.** |
| **AGENTS-r77** | 2026-06-09 | Smart anti-regression guards added to `scripts/audit-pro.js` (10 новых проверок, **58 passed · 0 warnings · 0 errors**). Каждая проверка появилась как ответ на конкретный инцидент — это «умная» защита, не «тупая». **G1 junkFilesGuard**: блокирует деплой если в репо появятся `*.py` / `*.patch` / `*-patch` / `uploads/` / `.DS_Store` / `Thumbs.db` (ловит брошенные после агентских правок скрипты вроде `fix_home.py`). **G2 oversizedImagesGuard**: PNG/JPG > 700 KB в `/images/` = ошибка (ловит сырые загрузки агентов вроде 2.3 MB `og-rimlyanam-7-new.png`), кроме явного ALLOWLIST (сейчас 1: `whitefield-field.png`) и суффиксов `*-original.*` / `*--keep.*`. **G3 seriesConsistencyGuard**: каждая `published` часть в `data/series.json` должна существовать на диске. **G4 seriesLandingTitleGuard**: cross-check — `/hard-texts/` не должна содержать «кафедры/пасторских патологий/диотреф», `/pastor-series/` не должна содержать «Тайны человеческого сердца/Иеремия 17» (ловит copy-paste-катастрофы при создании нового лендинга из старого). **G5 catalogDuplicatesGuard**: в `/articles/index.html` нет дублей `<a class="h-article-card">` (поймал дубли Иер/Рим7 в коммите ad32a3e6). **G6 unifiedHeaderGuard**: все страницы с `<ul class="h-nav-links">` обязаны содержать канонический набор {Публикации · Разбор заблуждений · Биографии · Все статьи · О библиотеке}. **G7 navListSemanticsGuard**: запрещает `<button>` внутри `<ul class="h-nav-links">` (нарушение §9.7, ломает цвет иконок). **G8 hardTextsLinkAuditGuard**: на `/hard-texts/` все article-card ссылки должны быть из `series.json.hard-texts.parts`. **G9 hashedAssetExistenceGuard**: каждый `?v=…`-хешированный URL должен указывать на существующий файл. **G10 gitignoreSanityGuard**: `.gitignore` должен покрывать `.npm/` / `.DS_Store`. Также очищен реальный мусор: удалены `images/og-series-heart.png` (1.4 MB raw), `images/hard-texts/og-rimlyanam-7-new.png` (2.3 MB) + `og-series-heart.png` (1.4 MB), `scripts/audit-pro.js-patch`. **!important** в site.css: 199 (≤200 ✅). |
| **AGENTS-r76** | 2026-06-09 | Articles index unified header + wide catalog. На странице `/articles/` (`body.articles-index-page`) шапка приведена к единому эталону (как `/biografii/`): убрана нестандартная `<button class="h-cp-btn">` лупа поиска внутри `<ul.h-nav-links>` (нарушала §9.7 — была в `<li>` и наследовала цвет ссылок навигации, выглядела чёрной vs серой луны), убрано второе дублирование `theme-toggle`. Теперь `mobile-controls` содержит только `theme-toggle` + `h-mobile-menu-btn`, как на всех других страницах. В navbar/mobile-nav главной добавлена ссылка «Все статьи»; в navbar/mobile-nav `/articles/` добавлены «Биографии» + «О библиотеке» (раньше шапки на разных страницах сайта отличались). Удалены **дубли карточек** Иеремии 17 и Римлянам 7 в каталоге (были дважды). Добавлен **full-width баннер серии «Тайны человеческого сердца»** на `/articles/` (как у Нагорной), ведущий на `/hard-texts/`. Каталог `/articles/` на десктопе теперь широкий (до 1280–1320px) с 3-колоночной сеткой карточек (≥1100px) — премиальный вид без портянки. На странице `/hard-texts/` ранее найдена и устранена крупная регрессия: H1 был «Тёмная сторона кафедры», summary/hero/stats — про пасторские патологии, видимый HTML содержал Блоки 2/3 с Частями 7–9 («Здоровое пастырство», «Признаки здоровой церкви», «20 пасторских патологий»). Полностью переписано под Иеремия 17 / Римлянам 7 / Римлянам 8 (3 части). Заменена обложка Римлянам 7 на новое изображение (коленопреклонённый перед скрижалями, дуальная стилистика light/obsidian). **!important** в site.css: 199 (≤200 ✅). Новый блок «articles-index-page — wide premium catalog» в `css/home.css` написан без единого `!important`. |
| **AGENTS-r75** | 2026-06-08 | Unified Series Navigator v2. Расширен `js/series-cards.js` (без новых JS-файлов): добавлены 2 новых рендер-режима поверх существующего `[data-series-cards]`: **`[data-series-strip="key"]`** — компактная топ-навигация для статей серии (← prev | dots | next →), **`[data-series-nav="key"]`** — премиум-сайдбар (для будущего использования). Данные читаются из `data/series.json` (добавлены `baseUrl` для nagornaya/pastor-series). Все 5 статей трилогии о Гилле получили `<aside data-series-strip="dzhon-gill">` вверху; одновременно удалены огромные inline-styled блоки «Трилогия о Джоне Гилле» (~12.5 КБ HTML-мусора с тремя ручными карточками опасностью регрессии при добавлении новых частей). Теперь добавление новой части серии = одна правка `data/series.json` + автоматический рендер на всех страницах серии. Стили в `css/site.css` (`.gb-strip`, `.gb-snav`), `!important` без изменений (196 ≤ 200). |
| **AGENTS-r74** | 2026-06-08 | User-reported regression pass III. Восстановлен **анимированный голубь с махающим крылом** (`.fn-marker--dove::before` + JS-inject `.fn-dove-body` + `.fn-dove-wing` + `@keyframes fn-dove-flap`) — был случайно откатан r71 на статичный FA-голубь. Возвращена картинка `whitefield-preaching` (вторая в `/articles/dzhon-gill-istoricheskiy-kontekst/`) — мой Kennington Common был хуже оригинала. Удалены сгенерированные мной файлы `images/whitefield-kennington-common-*` (8 файлов). **Картинка `gill-library-shelf` перенесена** из позиции «впритык после whitefield-field» в Section I после первого параграфа — теперь между ними есть текст. **Удалён `article-topnav`** (sticky шапка при скролле статей) из всех 8 статей — пользователь его не хочет. Чёткое правило: **theme-toggle / search-icon = ЧИСТЫЙ SVG БЕЗ КРУЖОЧКОВ / РАМОК / БЭКГРАУНДА** (см. §9.7). Убран `opacity:.86!important` из `mobile-hotfix.css` который вызывал двойное наложение sun+moon при переключении темы. Убран pill-фон `.gb-fc-btn` (был border + background + box-shadow) — теперь чисто SVG. Добавлен preload для Inter-600 и Playfair-700 — FOUC на «АВВАКУМ 3:19» исчезает. Цвет hover-заголовка `.h-article-title` в тёмной теме изменён с розового `--h-accent` (#d97a6c) на золотистый `#e8c97a`. Восстановлен margin-bottom 24px на `.context-bridge` (был встык со следующим `<p>`). Починен summary-card grid (3 варианта: только-num / check+num) — текст больше не сжимается в 60px. SITE_CONFIG contract guard добавлен в `audit-pro`. **!important** в site.css: 196 (≤200 ✅). |
| **AGENTS-r73** | 2026-06-08 | User-reported quality pass. Восстановлен `window.SITE_CONFIG` контракт на 3 страницах (kontekst/spravochnik: `base:` → `site:`; rim7: добавлен `site:` блок). Topnav layout исправлен: `.article-topnav-title` получил `margin:0 auto;padding:0 16px` чтобы корректно центрироваться между home-ссылкой и search-кнопкой (было: «Сила МояДжон Гилл» слитно). Закрыты `</span>` на 6 файлах. nag-summary внутри indigo/teal hero получил светлый текст (читабельный контраст). Добавлена `audit-pro` проверка SITE_CONFIG runtime contract (46 проверок). |
| AGENTS-r72 | 2026-06-08 | User-reported visual regression pass II (Arena Agent). Перевод 31 ambient-фразы на главной (Solus Christus → «Только Христос», Dominus illuminatio mea → «Господь — свет мой», Ego sum via veritas et vita → «Я есмь путь и истина и жизнь» и т.д.) + источник под подписью (`.h-phrase-source`, минималистично, мелким шрифтом, появляется на hover без перекрытия). Заменена вторая картинка Уайтфилда в `dzhon-gill-istoricheskiy-kontekst` (была визуально дубликатом первой) на новую Kennington Common ~1739. Порядок Гилла на `/biografii/`: [контекст, ч.1, ч.2, ч.3, справочник]. Порядок на `/articles/`: контекст → справочник. Введён 2-колоночный grid `.h-article-list--grid` для одиночных статей (компактнее при росте каталога). Удалены inline `padding-top:0` overrides — секция «Разбор заблуждений» больше не упирается в предыдущую. |
| **AGENTS-r71** | 2026-06-08 | CRITICAL fix: предыдущий `49882d9 «balance 151 unclosed braces»` восстановил счёт `{}`, но в неверных позициях. site.css парсился как 1 top-level правило с 19 cssRules вместо ~1222 — половина страниц рендерилась без основного CSS, шрифт падал в Times New Roman, share-кнопки раздувались. Восстановлен чистый baseline `32e8c63` (1703/1703 braces, 194 !important — снова в рамках PLAN-04 ≤200) + аккуратно дополнен финальным dove-маркером. В `audit-pro` уже есть структурный guard CSS-braces (от r71) — теперь сработает при любой подобной регрессии. |
| AGENTS-r70 | 2026-06-08 | Browser-QA проход (Playwright/Chromium). Исправлены реальные баги, найденные `visual-audit`: (1) 36 незакрытых `<span>`-маркеров и 6 «eyebrow»-лейблов в `20-antisovetov-pastoru` ломали вёрстку (paragraphs становились flex-детьми → horizontal-overflow); (2) тултипы на десктопе теряли width-clamp и фон-карточку (правила погребены во вложенности) — добавлен плоский tooltip-hardening блок на глубине 0; (3) overflow `series-nav` (negative margins) и nagornaya `shrink-0` pills на узких экранах; (4) ложный low-contrast на `.h-featured-series`. `visual-audit`: 8 → 0 raw bugs. !important без изменений (270). |
| **AGENTS-r69** | 2026-06-08 | Голубь-сноска `.fn-marker--dove` обновлён (новый премиум-силуэт, hover-взмах крыла), мёртвый inline `fn-dove-icon` удалён из HTML. В `audit-pro` добавлены guard-проверки: авто-потолок `!important` (`IMPORTANT_CEIL`), целостность dove-маркеров. site.css `!important` 295→270. Проверок теперь 38. |
| **AGENTS-r68** | 2026-06-06 | Добавлен `docs/EDITORIAL-SOURCE-POLICY.md` и ссылки на него; актуализировано число проверок `audit-pro` до 36. |
| AGENTS-r67 | 2026-06-06 | Добавлен технический guard в `validate.js` и `audit-pro.js`: английские прямые цитаты в русских статьях блокируются проверками. |
| AGENTS-r66 | 2026-06-06 | Добавлено правило языка статей: в русских материалах не оставлять английские прямые цитаты; английские названия источников/URL/DOI допустимы только как библиографические идентификаторы. |
| AGENTS-r65 | 2026-06-04 | После budget/perf pass: CSS/JS assets сжаты до продакшн-формата, бюджетные warnings в `audit-pro` сняты. Важно: архитектурный контракт не изменился — всё ещё 5 CSS + 11 JS, один основной `site.js`. |
| AGENTS-r64 | 2026-06-04 | После PLAN-06 JS cleanup: синхронизированы заголовки модулей в `js/site.js` (добавлены 28/29/30) и `js/enhancements.js` (пронумерованы A..G). Подтверждено: реального dead code в JS нет. См. `audit/PLAN-06-DONE.md`. |
| AGENTS-r63 | 2026-06-04 | Полная перезапись (PLAN-05). Старая история свёрнута. |

**Владелец:** Фёдор Милованов (редактор/автор-редактор, не «автор»)
**Прод:** https://gospod-bog.ru · GitHub Pages из ветки `main`
**Node:** требуется `>=20`

---

## 0. TLDR — что СРАЗУ нельзя делать

1. ❌ **Создавать новые CSS/JS файлы.** Архитектурный максимум: **5 CSS + 1 шрифтовой + 11 JS**. Список фиксирован, см. §2.
2. ❌ **Менять byline на «Автор: Фёдор Милованов».** Только `Автор-редактор:` (тип A/B) или `Редактор:` (тип C — переводы). См. §3.1.
3. ❌ **Возвращать `AI-disclosure`.** Удалён 2026-06-02 (`AGENTS-r11`), повторно удалён в PLAN-04 (CSS-остатки). Об ИИ — только на `/about/`.
4. ❌ **Запускать `prettier --write .` или `eslint --fix .`** по всему дереву. Только точечно.
5. ❌ **Обновлять зависимости в `package.json`** без явного запроса.
6. ❌ **Удалять/переименовывать `?v=...` хеши.** Они генерируются `scripts/cache-bust.js`. После любой правки CSS/JS — запусти `npm run cache-bust`.
7. ❌ **Удалять заголовки `<header class="article-header">` или `<aside class="author-card">`.** Это контракт разметки.
8. ❌ **Создавать в корне репо `.patch`, `*.py`, `*.tsx`, `src/components/*`** — статический сайт без сборщика, см. §10.
9. ❌ **Дублировать `<meta og:*>`.** Один `og:image` per page. JPG-fallback — только если `.jpg` файл реально есть на диске.
10. ❌ **Создавать legacy-кнопки** `.theme-float-btn`, `#themeFloat`, `#gbSearchFloat`, `.nag-theme-btn`. Удалены в PLAN-04 P5. Единственный canonical блок плавающих контролов — `gbFloatingControls` (`js/site.js` модуль 29), классы `.gb-fc-theme` / `.gb-fc-search`.
11. ❌ **Добавлять новые `!important` без анализа конкурента.** См. §4.2 — обязательный 5-шаговый чеклист.
12. ✅ **После любой правки CSS/JS** → `npm run cache-bust`.
13. ✅ **Перед коммитом** → `npm run validate:all` + `node scripts/audit-pro.js`. Оба должны быть PASS. Эти проверки теперь включают Russian quote policy guard; подробные правила — в `docs/EDITORIAL-SOURCE-POLICY.md`.
14. ❌ **Не оставлять английские прямые цитаты в русских статьях.** Названия книг/статей, URL, DOI и библиографические данные могут быть на английском; цитируемые мысли, прямые речи и сильные фразы автора в теле русской статьи должны быть переведены на русский. Оригинал можно давать только ссылкой на источник, не вставляя англоязычную цитату в текст.

---

## 1. О проекте

Христианский богословский сайт со статьями, биографиями, серией «Нагорная проповедь» (5 частей), серией «Тёмная сторона кафедры» (pastor-series), серией о Джоне Гилле (5 текстов), статьями о Коде да Винчи / герменевтике / Иеремии и др.

**Стек:** статический HTML + CSS + JS, без сборщика, без TypeScript, без React.
**Хостинг:** GitHub Pages, автодеплой через `.github/workflows/deploy.yml`.
**Поисковая индексация:** `.github/workflows/indexnow.yml` уведомляет Яндекс/Bing при push в main.
**Алерты на падение CI:** `.github/workflows/notify-on-failure.yml` открывает GitHub issue (label `ci-failure`).

### 1.1 Целевые браузеры

| Платформа | Браузер | Минимальная версия |
|---|---|---|
| Desktop | Chrome / Edge | 90+ |
| Desktop | Firefox | 90+ |
| Desktop | Safari | 15+ |
| Mobile | iOS Safari | 15+ |
| Mobile | Android Chrome | 90+ |
| Mobile | Samsung Internet | 16+ |

CSS-фичи, не поддерживаемые в этих версиях (`color-mix()`, `grid-template-rows: 0fr`, `:has()`), **обязаны** иметь `@supports`-fallback или каскадный fallback (`property: rgb(...); property: color-mix(...);`).

### 1.2 Метрики качества

| Метрика | Цель |
|---|---|
| Lighthouse Performance (mobile) | ≥ 90 |
| Lighthouse Accessibility | ≥ 95 |
| Core Web Vitals LCP | < 2.5s |
| Core Web Vitals CLS | < 0.1 |
| `audit-pro` | ✅ PASSED, errors = 0 |
| `validate:all` | ✅ 0 errors, 0 warnings |
| `tokens:check` | ✅ 0 / 0 |
| `visual-audit` (Playwright) | 0 console-errors, 0 network-errors |
| CSS `!important` в `site.css` | цель **≤ 200**; авто-потолок в `audit-pro.js` (сейчас 270, ratchet вниз) |

---

## 2. Архитектура — единственно верная

```
/
├── index.html                      ← главная
├── 404.html                        ← страница ошибки
├── sw.js                           ← Service Worker
├── manifest.json                   ← PWA
├── feed.xml                        ← RSS
├── robots.txt, sitemap.xml         ← SEO
├── llms.txt                        ← правила для LLM
├── AGENTS.md                       ← ⭐ ЭТОТ файл
├── README.md                       ← пользовательская архитектурная документация
├── AUDIT_HISTORY.md                ← консолидированный changelog аудитов
├── CNAME                           ← gospod-bog.ru
│
├── package.json                    ← build-скрипты, без рантайм-зависимостей
├── .github/workflows/              ← deploy.yml + indexnow.yml + notify-on-failure.yml
│
├── css/                            ← РОВНО 5 ФАЙЛОВ. БОЛЬШЕ НЕ СОЗДАВАТЬ.
│   ├── site.css                    ← основной слой (статьи, шапка, тёмная тема)
│   ├── home.css                    ← только главная + каталоги (hero, dashboard)
│   ├── command-palette.css         ← поиск (Ctrl+K)
│   ├── mobile-hotfix.css           ← мобильные производительные hotfix-правки
│   └── nagornaya-mobile-toc.css    ← мобильное оглавление Нагорной проповеди
│
├── fonts/
│   └── fonts.css                   ← @font-face деклараты, не трогать
│
├── js/                             ← РОВНО 11 ФАЙЛОВ. БОЛЬШЕ НЕ СОЗДАВАТЬ.
│   ├── site.js                     ← главное (theme, nav, quiz, tooltips, gbFloatingControls)
│   ├── site-utils.js               ← утилиты, доступные отдельным страницам
│   ├── scroll-perf.js              ← производительность scroll/observers
│   ├── search.js                   ← Ctrl+K поиск (CommandPalette)
│   ├── enhancements.js             ← scroll-эффекты, lazy load, ambient phrases
│   ├── highlights.js               ← подсветка текста, заметки
│   ├── glossary.js                 ← глоссарий богословских терминов
│   ├── bookmark-engine.js          ← закладки (localStorage)
│   ├── series-cards.js             ← карточки серий
│   ├── nagornaya-mobile-toc.js     ← мобильное TOC для проповеди
│   └── sw-register.js              ← регистрация Service Worker
│
├── data/                           ← JSON-данные для рантайма
│   ├── glossary.json               ← термины глоссария
│   ├── search-manifest.json        ← индекс поиска
│   ├── series.json                 ← карточки серий
│   └── strategic-map-antisovetov.json  ← MAP_DATA для 20-antisovetov-pastoru
│
├── articles/                       ← статьи (каждая = папка с index.html)
│   ├── index.html                  ← каталог всех статей
│   ├── 20-antisovetov-pastoru/
│   ├── dzhon-gill-chast-1-chelovek/
│   ├── dzhon-gill-chast-2-uchenyi/
│   ├── dzhon-gill-chast-3-nasledie/
│   ├── dzhon-gill-istoricheskiy-kontekst/
│   ├── dzhon-gill-spravochnik/
│   ├── hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/
│   ├── kod-da-vinchi/
│   └── krajne-li-isporcheno-serdce/
│
├── nagornaya/                      ← серия «Нагорная проповедь»
│   ├── chast-1/ ... chast-5/       ← 5 частей
│   ├── istochniki/                 ← библиография
│   ├── nakhodki/                   ← находки
│   ├── seriya/                     ← обзор серии
│   ├── tw.min.css                  ← Tailwind (НЕ ТРОГАТЬ — отдельная генерация)
│   └── index.html                  ← обзор серии
│
├── about/, pastor-series/, biografii/   ← статичные разделы
│
├── scripts/                        ← build-инструменты (Node.js)
│   ├── cache-bust.js               ← ⭐ генерит ?v=... хеши
│   ├── validate.js                 ← валидация HTML/JSON/манифестов
│   ├── audit-pro.js                ← главный аудит (запускать перед каждым push)
│   ├── seo-audit.js                ← SEO-проверки
│   ├── visual-audit.js             ← Playwright скриншоты + console/network errors
│   ├── update-meta.js              ← обновление meta-тегов
│   ├── check-design-tokens.js      ← валидация дизайн-токенов
│   ├── deep-check.js, _audit-deep.js  ← глубокий аудит (внутренние)
│   ├── download-fonts.js           ← скачка шрифтов
│   ├── build-avif.sh               ← конвертация в AVIF
│   └── resize_og.py                ← рескейл OG-картинок (Pillow)
│
├── audit/                          ← последние audit-pro отчёты + AUDIT_CLEANUP_PLAN
└── images/                         ← все изображения
```

### Запрещено создавать новые CSS-файлы

У сайта **ровно 5 CSS + 1 шрифтовой**. Каждый файл = отдельный HTTP-запрос на статическом хостинге без bundler'а. Новая правка идёт в существующий файл по таблице:

| Что правишь | В какой CSS |
|---|---|
| Общие компоненты, статьи, шапка, тёмная тема | `site.css` |
| Главная + каталоги (только то, чего нет на других страницах) | `home.css` |
| Поиск (Ctrl+K, всплывашка) | `command-palette.css` |
| Мобильные hotfix touch-pointer overrides | `mobile-hotfix.css` |
| Мобильное оглавление Нагорной проповеди | `nagornaya-mobile-toc.css` |
| @font-face декларации | `fonts/fonts.css` |
| Tailwind для Нагорной | `nagornaya/tw.min.css` (НЕ ТРОГАТЬ) |

### Запрещено создавать новые JS-файлы в `js/`

Все 11 файлов — фиксированный набор. Новая логика идёт **внутрь существующего** файла по теме (если ничего не подходит — в `enhancements.js`).

---

## 3. PROTECTED — не трогать без письменного разрешения

### 3.1 Атрибуция авторства (КРИТИЧНО)

Фёдор Милованов на сайте — **автор-редактор** оригинальных статей и **редактор** переводов. **НЕ «автор»** в традиционном смысле. Он задаёт направление, редактирует, исправляет неточности и собирает материал при помощи ИИ.

#### Правило: нигде не писать «Автор: Фёдор Милованов».

| Тип контента | Byline в `<header>` | `.author-card-label` | Карточки в каталогах |
|---|---|---|---|
| Тип A — авторская статья | `Автор-редактор: Фёдор Милованов` | `Автор-редактор` | `Автор-редактор: Фёдор Милованов` |
| Тип B — авторская серия / разбор | `Автор-редактор: Фёдор Милованов` | `Автор-редактор` | `Автор-редактор: Фёдор Милованов` |
| Тип C — перевод зарубежной статьи | `Редактор: Фёдор Милованов` | `Редактор` | `Ред.: Фёдор Милованов` |

#### Meta-теги:

- **Тип A/B:** `<meta name="author" content="Фёдор Милованов">` + `<meta property="article:author" content="Фёдор Милованов">`.
- **Тип C:** `<meta name="author" content="Имя оригинального автора">` + `<meta name="translator" content="Фёдор Милованов">` + `<meta property="article:author" content="Имя оригинального автора">`.

#### feed.xml для всех типов:

```xml
<dc:creator>Фёдор Милованов</dc:creator>
```

### 3.2 JSON-LD структура

В каждой статье есть `<script type="application/ld+json">` с `Article` (или `ScholarlyArticle` для переводов) + `BreadcrumbList` + `Person` (автор оригинала или Фёдор как редактор). **Не упрощать, не «оптимизировать», не удалять.** Это критично для SEO.

Для переводов:
```json
"@type": "ScholarlyArticle",
"author": { "@type": "Person", "name": "Имя Автора Оригинала" },
"translator": { "@id": "https://gospod-bog.ru/about/#person" }
```

### 3.3 OpenGraph + Twitter Card теги

В каждой `index.html` статьи есть полный набор `<meta property="og:*">`. Не удалять, не сокращать «для чистоты». **Один `og:image` per page.** JPG-fallback можно ставить ТОЛЬКО если файл `images/<name>.jpg` реально существует.

### 3.4 Service Worker и cache-bust

Версии файлов в HTML:
```html
<link rel="stylesheet" href="css/site.css?v=2223865f">
<script src="js/site.js?v=54e3f377"></script>
```

Хеши — **CRC32 содержимого файлов**, генерируются `scripts/cache-bust.js`. **Не трогать руками.** После правки CSS/JS — обязательно `npm run cache-bust`.

`CACHE_NAME` в `sw.js` также пересчитывается автоматически.

### 3.5 Структура Нагорной проповеди

Серия = 5 частей + 3 вспомогательных страницы (`istochniki`, `nakhodki`, `seriya`). Внутри каждой части — `<aside class="article-toc">`. **Не упрощать TOC, не сжимать вёрстку, не удалять подключение `tw.min.css`** в Нагорной.

`tw.min.css` — минифицированный Tailwind, генерируется отдельно от основного проекта. Если нужен новый Tailwind-класс в `nagornaya/chast-*` — обратись к владельцу для регенерации.

### 3.6 Изображения

| Правило | Подробнее |
|---|---|
| **Формат** | `.webp` основной; `.png/.jpg` — backup, не для `<img>` напрямую |
| **Размеры** | Обязательно 3 ширины: `600w`, `900w`, `1200w` |
| **Именование** | `images/<name>.webp`, `images/<name>-600w.webp`, ... |
| **Качество WebP** | 82–85% |
| **OG** | один `og:image` per page; JPG-fallback только если файл реален |

### 3.7 Создание новой статьи — требования к качеству (ОБЯЗАТЕЛЬНО)

При создании новой статьи (или значительном обновлении существующей) **обязательно** соблюдать следующие правила качества:

#### 3.7.1 Тултипы и глоссарий
- **Все** исторические названия (города, территории, законы, институты, события) должны быть обёрнуты в `<span class="gterm" data-term="..." data-term-title="...">...</span>`.
- **Все** сложные богословские, герменевтические, раввинистические и апологетические термины должны иметь тултип.
- Пояснения должны быть **не поверхностными** — минимум 1–2 предложения, понятных рядовому читателю, без упрощения до примитива.
- Примеры исторических терминов, требующих тултипа: Кеттеринг, Хорслидаун, Саутварк, Акт о корпорациях, Gin Craze, Банхилл-Филдс, Приорат Сиона, Никейский собор, гностики и т.д.

#### 3.7.2 Квизы
- Каждый квиз должен содержать **минимум 1–2 вопроса по терминологии и понятиям** (не только по фактам и сюжету).
- Все вопросы обязаны иметь `explanation.short` + `explanation.full`.
- `explanation.full` должен давать **глубокое богословское/историческое/методологическое объяснение**, а не просто «верно/неверно».
- Вопросы должны быть **адаптированы под тематику статьи**:
  - Биографии → акцент на личность, решения, контекст.
  - Экзегетика/герменевтика → акцент на метод, термины, аргументацию.
  - Апологетика → акцент на факты, критерий затруднения, контраргументы.
  - Антропология/доктрина → акцент на понятия, различения, богословские нюансы.

#### 3.7.3 Общий принцип
- Статья должна быть **самодостаточной** для читателя без богословского образования.
- Если термин или историческая реалия встречается в статье — читатель должен иметь возможность понять его значение **не выходя из статьи** (через тултип).
| **figcaption** | НЕ вставлять `<span class="ai-note">` или «Изображение сгенерировано ИИ». Прозрачность — только на `/about/`. |

#### Шаблон `<picture>`:

```html
<figure class="article-img wide reveal">
  <picture>
    <source srcset="../../images/<name>-600w.webp 600w,
                    ../../images/<name>-900w.webp 900w,
                    ../../images/<name>-1200w.webp 1200w"
            sizes="(max-width: 640px) 92vw, 1200px" type="image/webp">
    <img src="../../images/<name>.webp" alt="…"
         width="1200" height="630" loading="lazy" decoding="async">
  </picture>
  <figcaption>Подпись без упоминания ИИ.</figcaption>
</figure>
```

---

## 4. CSS-правила

### 4.1 Каскад

Порядок подключения CSS в `<head>` (не менять):

1. `fonts/fonts.css` (preload + stylesheet)
2. `css/site.css`
3. `css/home.css` (на главной и каталогах)
4. `css/command-palette.css`
5. На Нагорной — **сначала** `nagornaya/tw.min.css`, **потом** `site.css` (Tailwind обязан грузиться раньше — site.css перебивает его по каскаду).

### 4.2 `!important` — обязательный чеклист перед добавлением

**Текущее состояние (2026-06-04, после PLAN-04):**

| Файл | `!important` | Назначение |
|---|---:|---|
| `site.css` | **270** ⚠️ | цель ≤200; потолок `IMPORTANT_CEIL` в audit-pro (только вниз) |
| `home.css` | 20 | OK |
| `command-palette.css` | 7 | OK |
| `mobile-hotfix.css` | 74 | touch / pointer:coarse overrides — легитимно |
| `nagornaya-mobile-toc.css` | 122 | Tailwind override на nagornaya-page — легитимно |

**Корректный подсчёт:** `grep -o '!important' file | wc -l` (НЕ `grep -c` — он считает строки).

#### 5-шаговый чеклист перед добавлением нового `!important`:

1. **Найди конкурента.** `grep -nE 'твой-селектор' css/*.css`.
2. **Рассчитай specificity** обоих правил (id=100, class=10, element=1).
3. **Если твоё выше** → `!important` не нужен; используй каскад.
4. **Если ниже** → увеличь специфичность через дополнительный класс/id/атрибут (например, `body.your-page .selector` или `.parent .selector`).
5. **`!important` оправдан ТОЛЬКО для:**
   - `@media print`
   - `@media (prefers-reduced-motion: reduce)`
   - `@media (forced-colors: active)`
   - `@media (scripting: none)` — no-JS fallback
   - Tailwind override на nagornaya (если selectivity не помогает)
   - Defensive disable (`display: none !important`) для скрытия legacy/повреждённого элемента
   - Внутри `@layer components/utilities` — для перебивания правил вне layer (правила вне `@layer` имеют выше priority по spec)

**Если уже есть `!important` на том же селекторе/свойстве — исправь существующий, не добавляй второй.**

### 4.3 Тёмная тема

Используется класс `html.dark` на `<html>` (переключается JS в `site.js`).

| Правило | Пример |
|---|---|
| ✅ Используй переменные | `color: var(--color-text)`, `background: var(--color-bg)` |
| ❌ Не хардкодить `#fff`, `#000` | искл.: фолбэки в `color-mix(in srgb, ... var(--color-x, #fff))` |
| ✅ `html.dark` всегда | НЕ просто `.dark` — JS выставляет именно `html.dark` |
| ✅ `color-mix()` fallback | Сначала простое значение, потом `color-mix` ниже — каскад перебивает |

### 4.4 CSS Integrity Rules — анти-регрессия

Эти правила введены после серии регрессий май-июнь 2026 (см. AUDIT_HISTORY).

1. **`html.dark` — всегда, никогда просто `.dark`.** Класс `.dark` на body не используется.

2. **Дублирование top-level селекторов запрещено.** Перед добавлением правила для `.foo` — `grep ".foo"` по файлу. Найдено → расширяй существующее, не добавляй новый блок. PLAN-04 P1+P1b слили 9 настоящих дублей.

3. **Пустые правила `{}` — мусор, удалять.** Допустимо только намеренное `:empty` с пояснительным комментарием.

4. **Двойное свойство в одном блоке — первое мёртво.** Два `box-shadow`, два `color` в одном `{}` — первый всегда перебивается. Удаляй его. **Исключение:** color-mix fallback pattern (`color: #fff; color: color-mix(...);`) — это намеренно.

5. **`:hover` с важным эффектом — только внутри `@media (hover: hover) and (pointer: fine)`.** Без guard — срабатывает на тапе (iOS/Android). Исключение: декоративные opacity/color, не меняющие layout.

6. **Переключатель темы — singleton.** Три канонических места:
   - `.theme-toggle` (absolute, в статьях рядом с breadcrumbs)
   - `.gb-fc-theme` (FAB через `gbFloatingControls` site.js модуль 29)
   - `.bar-icon-btn[data-action=theme]` (bottom-bar, mobile)

   ❌ Не создавать четвёртую: `.theme-float-btn`, `#themeFloat`, `.nag-theme-btn` — всё удалено в PLAN-04 P5.

7. **Tooltip — три канонических вида, один контроллер.**
   - `.gterm > .gtip` (глоссарий)
   - `.fn-marker > .tooltip` (академические сноски)
   - `.bref > .btip` (Библейские ссылки)

   Контроллер: `SiteUtils.makeTooltipController()` (единственная реализация).
   ❌ Не добавлять четвёртый тип tooltip с другими классами/позиционированием.

   **Модификатор `.fn-marker--dove`** — это НЕ четвёртый тип, а вариант `fn-marker`
   (та же `.tooltip`, тот же контроллер), у которого числовой маркер заменён на иконку
   голубя. Глиф рисует JS: функция `e()` в `js/site.js` инжектит inline-SVG
   `<svg class="fn-dove-icon">` (тело `.fn-dove-body` + отдельное крыло `.fn-dove-wing`).
   `::before` в CSS — это no-JS фолбэк (статический голубь), он скрывается, когда JS
   проставил `data-gb-dove-ready`. Крыло машет на hover (`@keyframes fn-dove-flap`,
   только `@media (hover:hover) and (pointer:fine)`, отключается при `prefers-reduced-motion`).
   ❌ Не возвращать инлайновый `<svg class="fn-dove-icon">` в HTML статей — JS инжектит его сам
   (audit-pro это проверяет и упадёт).
   ⚠️ **Все inline-маркеры закрывай явно** (`<span ...></span>`). `.fn-marker--dove` —
   `display:inline-flex`; незакрытый `<span>` «проглатывает» следующие `<p>/<h4>`, делая их
   flex-детьми → горизонтальный overflow. То же с «eyebrow»-лейблами `<span style="display:inline-flex">`.
   После правок контента/CSS прогоняй **visual-audit** (Playwright) — он ловит overflow и контраст:
   `python3 -m http.server 8080 & ; sudo npx playwright install-deps chromium ; AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit` → должно быть `0 raw bugs`.

8. **CSS-переменные — не объявлять «про запас».** Объявленная в `:root` переменная без `var(--...)` нигде = мёртвый код, удалить.

9. **Мёртвый компонент = удалить.** Если класс нигде в HTML/JS не используется (включая динамическую конкатенацию в JS `'class--' + variant`) — удалить CSS-правила. PLAN-04 P5-P7 удалил `.theme-float-btn`, `.ai-disclosure`, `.fx-lift`, `.epilogue-*`, `.float-fallback`, `.sd-url-strip/divider/copy/label-default`, `.article-img--portrait-wide`, `.card.fx-lift` и др.

10. **`!important` лимит для `site.css` — цель ≤ 200, жёсткий потолок задан в `audit-pro.js`.**
    Теперь это **автоматическая проверка** (`IMPORTANT_CEIL` / `IMPORTANT_GOAL` в `scripts/audit-pro.js`):
    - выше `IMPORTANT_CEIL` → **ERROR** (audit падает, push блокируется);
    - выше `IMPORTANT_GOAL` (200) но в пределах потолка → **WARNING** (продолжай гасить долг).
    Потолок — храповик: **только вниз**. Снизил `!important` — снизь и `IMPORTANT_CEIL`.
    Ручная проверка: `grep -o '!important' css/site.css | wc -l`.
    История: PLAN-04 342 → 199; затем dove/tooltip-серия дала регрессию 194 → 295,
    после чистки (унификация tooltip-компонентов) → 270.

    **ПРИЧИНА большого числа `!important`** (важно понимать): `css/site.css` исторически
    собран из НЕзакрытых `@media`/`@supports`/`@layer` блоков — на 2026-06-08 в файле был
    дисбаланс **+151** открывающей скобки (браузер закрывал их на EOF). Из-за этого многие
    правила оказывались «погребены» на глубине вложенности ~151 и применялись только при
    накопленных media-условиях — поэтому их и заставляли работать через `!important`.
    Блок `fn-marker--dove` был восстановлен **плоским, на глубине 0, в конце файла** (после
    явного закрытия всех скобок) — и там `!important` ему уже НЕ нужен (un-layered правило
    бьёт любой `@layer`). Дальнейшее снижение к 200 — тем же приёмом: чинить вложенность,
    а не добавлять `!important`. **Проверяй баланс скобок:**
    `python3 -c "s=open('css/site.css').read();print(s.count('{')-s.count('}'))"` → должно быть 0.
    **`!important` сам по себе не «зло», но >50 в одном файле — запах: каскадные слои
    (`@layer reset,base,components,utilities`) решают специфичность без него.**

---

## 5. JS-правила

### 5.1 Архитектура

Каждый JS-файл — самодостаточный, под одну тему. **НЕ создавать общий `utils.js`** — это сломает текущую модульность (`site-utils.js` существует, но имеет узкую роль). Подробная карта 27 модулей внутри `site.js` — в `README.md`.

### 5.2 Запреты

- ❌ `eval()`, `Function()`, `innerHTML = userInput`
- ❌ `addEventListener` без `removeEventListener` (память)
- ❌ CDN-зависимости (jQuery, Lodash) — проект bessebt (vanilla)
- ❌ ES2024+ фичи без проверки на Safari 15+
- ❌ Переход на TypeScript / Vite / любой bundler — архитектурный выбор vanilla

### 5.3 Обязательные проверки перед коммитом

```bash
# Синтаксис JS — все 11 файлов + sw.js + scripts
node --check js/*.js
node --check scripts/*.js
node --check sw.js

# Хеши cache-bust свежие
npm run cache-bust

# Полная валидация (HTML, JSON, manifest, SEO)
npm run validate:all

# Дизайн-токены
npm run tokens:check

# Главный аудит (38 проверок)
node scripts/audit-pro.js
# Должно: ✅ PASSED, errors = 0
```

Если хоть одна — FAIL, **не коммитить**.

#### Visual audit (Playwright, опционально но рекомендовано перед крупными CSS-правками)

```bash
# 1. Локальный HTTP-сервер (отдельная вкладка)
python3 -m http.server 8080 --bind 127.0.0.1

# 2. Playwright + chromium (один раз)
npm install --no-save playwright
npx playwright install chromium

# 3. Аудит (52 контекста / 156 скринов в shots/)
AUDIT_BASE=http://127.0.0.1:8080 npm run visual-audit
```

Должно: `0 console errors, 0 network errors, 0 raw bugs` (или все подавлены).

---

## 6. Статьи — как добавлять

### 6.1 Структура

```
articles/<slug>/
└── index.html
```

slug — строчные латинские буквы и дефисы, без слэша в начале.

### 6.2 Обязательные блоки в `<head>`

См. [`README.md` § «Добавление новой статьи»](README.md) — полный шаблон с meta-тегами, JSON-LD, OG/Twitter, SITE_CONFIG, breadcrumb JSON-LD.

### 6.3 Runtime-компоненты

| Компонент | Поведение |
|---|---|
| `<header class="article-header">` | h1, byline (см. §3.1), метаданные (дата, ≈мин чтения) |
| `<aside class="author-card">` | Перед `.sources-block` / `.reading-list` |
| `<aside class="article-toc">` | Для длинных статей (>20мин) |
| Глоссарий `<span class="gterm">термин<span class="gtip">…</span></span>` | luxury tooltip, mobile bottom-sheet |
| Академические сноски `<span class="fn-marker">N<span class="tooltip">…</span></span>` | mobile bottom-sheet |
| Библейские ссылки `<button class="bref" data-ref="Иер 17:9">` | tooltip с переводами |
| `.gb-accuracy-btn--email` | mailto: только `viktorcoy2012@gmail.com`, subject/body формируются JS из h1 + URL |

### 6.4 SITE_CONFIG — обязательная часть HTML

См. README.md § «Контракт `window.SITE_CONFIG`».

### 6.5 Quiz Engine v3+

Если `features.quiz.enabled === true` и в `window.SITE_CONFIG.quiz.questions` есть вопросы, HTML обязан содержать канонический mount `<div id="quizPlaceholder"></div>`. **Не вставлять вручную legacy `#quizWrapper`**: runtime сам генерирует `#quizWrapper`, `#quizLaunch`, `#quizQuestion`, `.quiz-option` и bonus-блоки. Ручной wrapper уже ломал Da Vinci / Krajne: overlay открывался, но вопрос и варианты не рендерились.

Вопросы могут содержать `sourceRef` для академического feedback:

```js
{
  id: 'q1',
  type: 'single',
  category: 'theology',
  difficulty: 'medium',
  question: 'Вопрос...',
  options: ['...', '...', '...'],
  correct: 1,
  explanation: {
    short: 'Короткий вывод.',
    full: 'Развёрнутое объяснение ответа.',
    anchor: 'sec-intro'
  },
  sourceRef: { label: 'Иер. 17:9', href: '#sec-intro' }
}
```

`sourceRef` — строка, объект `{ label, href }` или массив. Результаты квиза сохраняются в `localStorage` как `quiz-result-v2:{page.id}`. Legacy-формат `q / answer / ok / err / focus` поддерживается только для старых страниц; новые вопросы писать в новом формате.

### 6.6 Share API (для цитат, результатов квизов)

```js
window.SiteShare.open(button, {
  dialogTitle: 'Поделиться цитатой',
  title: document.title,
  text: '«цитата» — Название статьи',
  url: 'https://gospod-bog.ru/article/#:~:text=...'
});
```

НЕ подменять заголовок диалога через DOM. Все платформы (TG/WA/VK/MAX/OK/Copy) используют `activeShareUrl/Title/Text` из payload.

### 6.7 Язык статей и цитат

Русскоязычная статья должна читаться как цельный русский текст. Это правило закреплено не только документально, но и технически: `scripts/validate.js` и `scripts/audit-pro.js` блокируют английские прямые цитаты в читательском русском тексте и quiz-строках. Полная редакционно-источниковая политика — `docs/EDITORIAL-SOURCE-POLICY.md`.

- ✅ Основной текст, прямые речи, сильные цитаты, цитаты в quiz/explanation, подписи к иллюстрациям и callout-блоки — **на русском**.
- ✅ Английские названия книг, статей, журналов, издательств, URL, DOI, `href`, библиографические записи и технические термины в скобках допустимы, если они нужны для идентификации источника.
- ❌ Не вставлять в тело русской статьи английскую прямую цитату ради «солидности».
- ✅ Если важно показать, что формулировка верифицирована, дать русский перевод и рядом ссылку на оригинал: `МакАртур формулирует: «…» <a href="...">GTY transcript</a>`.
- ✅ Если перевод спорный или авторский, можно добавить: «перевод наш» / «смысловой перевод», но сам цитируемый текст остаётся русским.
- ❌ Не заменять русскую цитату машинным калькированным английским термином. Сначала русский эквивалент, затем при необходимости оригинальный термин в скобках: «различный отбор материала (variant selections)» — допустимо как термин; «variant selections» как самостоятельная цитата — нет.

### 6.8 После добавления статьи

1. Обновить `sitemap.xml` (ISO8601 lastmod с +03:00)
2. Обновить `feed.xml` (`<item>` в начало `<channel>` + `<lastBuildDate>`)
3. Обновить `data/series.json` (если статья входит в серию)
4. Обновить `data/search-manifest.json` (для Ctrl+K)
5. Добавить карточку на `/articles/index.html` и (если уместно) на `/index.html`
6. Подготовить OG-картинку (1200×630, `.webp` или `.jpg`)
7. `npm run cache-bust`
8. `npm run validate:all` + `node scripts/audit-pro.js`

IndexNow при `git push main` сам уведомит Яндекс/Bing.

---

## 7. Красные флаги

| Если ты собираешься… | …почему НЕТ |
|---|---|
| «Создать новый CSS для article-share-buttons.css» | См. §2. Используй `site.css`. |
| «Создать `utils.js` для общих функций» | См. §5.1. У каждого JS своя тема. |
| «Заменить "Редактор" на "Автор" — короче» | См. §3.1. Это намеренно. |
| «Упростить JSON-LD — слишком много свойств» | См. §3.2. Это для SEO. |
| «Удалить старые AUDIT_*.md — лишний мусор» | Оставлять `AUDIT_HISTORY.md`. `audit/AUDIT_CLEANUP_PLAN_*.md` оставлять до завершения плана. |
| «Обновлю pretty каждый файл — для красоты» | НЕТ. Diff нечитаем. |
| «Прогоню `eslint --fix` — улучшит код» | НЕТ. Только точечно. |
| «Поправил CSS — забыл `cache-bust`» | Запусти. SW не подхватит правки. |
| «Заменю vanilla на TypeScript для надёжности» | НЕТ. Архитектурный выбор vanilla. |
| «Верну AI-disclosure для прозрачности» | См. §0 п.3. Об ИИ — только на `/about/`. |
| «Добавлю `!important` на всякий случай» | См. §4.2 чеклист. |
| «Перепишу `summary-card` с `!important` для надёжности» | НЕТ. PLAN-04 P8-P10 сняли 39 ненужных. Конкурентов в каскаде нет (компонент только на 2 не-nagornaya страницах). |

---

## 8. Service Worker — что важно

`sw.js` — версионируется автоматически (`scripts/cache-bust.js` обновляет `CACHE_VERSION`). При правке `sw.js` руками — **не править version-строку**, скрипт это сделает.

Precache список — в самом `sw.js`. При добавлении нового шрифта/JS-файла — добавь в precache.

---

## 9. Безопасность / гигиена

- ❌ Не добавлять `http://` ссылки в контент — `audit-pro` ругается на mixed-content. Используй `https://` или (для умерших источников) `https://web.archive.org/web/2025/http://...`.
- ❌ Не хранить ключи / токены в репозитории. `INDEXNOW_KEY` — только в GitHub Secrets.
- ❌ Не использовать `eval` / `Function` / `innerHTML = userInput`.

---

## 10. Что из корня репо никогда не коммитить

| Файл / маска | Почему нельзя |
|---|---|
| `*.patch` | git-артефакты, не контент |
| `*.py` в корне | Статический сайт. Python — только в `scripts/` (build-tools) |
| `*.tsx`, `*.ts`, `src/components/` | Vanilla проект, TypeScript-компоненты — мёртвый код |
| `README-<что-то>.txt`, `README.txt` | Дубли `README.md` |
| `PATCH-V*-SUMMARY.md`, `AUDIT_REPORT_*.md`, `*_PLAN_*.md` (в корне) | Истёкшие планы; история — в git log и `AUDIT_HISTORY.md`. План в `audit/` — оставлять до завершения. |
| `apply_*.py`, `fix_*.py`, `final_*.py`, `split_*.py` | Одноразовые костыли. Нужен скрипт — в `scripts/` + `package.json` |
| `shots/`, `visual-audit-report.json`, `deep-check.json`, `node_modules/`, `.playwright-browsers/` | Уже в `.gitignore` |
| `<INDEXNOW_KEY>.txt` | Генерируется `deploy.yml` только в Pages-артефакте |

Если AI-агент создал такой файл во время работы — обязан удалить перед коммитом.

---

## 11. История документа (свёрнуто)

Полная история r1..r110 — в `git log` (`git log --oneline --grep="AGENTS-r"`).
Детальные changelog'и r68–r110 свёрнуты при r115 (были занимали >400 строк).

Последние 5 значимых вех (полная таблица r111+ — выше):

Полная история r1..r62 — в `git log` (`git log --oneline --grep="AGENTS-r"`).

Сохранены здесь только последние 5 значимых вех:

| Версия | Дата | Главное |
|---|---|---|
| **AGENTS-r68** | 2026-06-06 | **Editorial source policy.** Добавлен `docs/EDITORIAL-SOURCE-POLICY.md`; README/AGENTS связаны с единым документом политики. |
| **AGENTS-r67** | 2026-06-06 | **Russian quote policy guard.** `validate.js` и `audit-pro.js` теперь проверяют русские статьи и quiz-строки на английские прямые цитаты. |
| **AGENTS-r66** | 2026-06-06 | **Russian quote policy.** В русских статьях прямые цитаты/сильные фразы должны быть переведены на русский; английский допустим в названиях источников, URL, DOI и терминах-идентификаторах. |
| **AGENTS-r63** | 2026-06-04 | **Полная перезапись (PLAN-05).** Свёрнута история 60+ записей (полная — в git log). Убраны противоречия: AGENTS до этого учил создавать `.theme-float-btn`, `.ai-disclosure` (давно удалены) и держал устаревший счётчик `!important` ~189. Зафиксированы актуальные числа после PLAN-04 (199). Добавлен §9 «Безопасность/гигиена», §8 «Service Worker». §4.4 расширен пунктами 9 (мёртвый код = удалить) и 10 (лимит ≤200). Объединена сломанная нумерация (было два §11). |
| AGENTS-r62 | 2026-06-04 | **PLAN-04 — !important cleanup, site.css 342 → 199.** 15 партий точечной чистки + 1 hotfix HTML-бага + notify-on-failure.yml workflow. См. `audit/AUDIT_CLEANUP_PLAN_2026-06-04.md`. |
| AGENTS-r61.17 | 2026-06-03 | Mobile long-block premium compaction (summary-card / note-box / info-box collapse-to-preview ≥740-950px на мобильных). |
| AGENTS-r17 | 2026-06-02 | **Unified Floating Controls (модуль 29).** Единый `.gb-fc-theme + .gb-fc-search` блок заменяет legacy `.theme-float-btn / #themeFloat / #gbSearchFloat / .nag-sidebar-theme-btn`. Эти legacy окончательно удалены из CSS в PLAN-04 P5. |
| AGENTS-r11 | 2026-06-02 | **AI-disclosure JS-модуль удалён.** Класс `.ai-disclosure` остался в CSS как мёртвый код; удалён из CSS в PLAN-04 P7. |

---

## 12. Раздел «Карты» (/karty/) — архитектура и правила

Полная документация: **`docs/MAPS-ARCHITECTURE.md`**.

### 12.1 Ключевые принципы

1. **ОДНА базовая карта** — единая SVG-география Ближнего Востока (viewBox `0 0 1900 1430`). Маршруты = слои данных поверх неё.
2. **Вторая карта = триггер рефакторинга** — вынести base-geo, map-engine.js и route.json. НЕ выносить заранее.
3. **era-теги** — каждое место несёт `era:["bronze"]` (или `["iron"]`, `["roman"]`). При второй карте — фильтрация по эпохе.
4. **Standalone inline** — karty/avraam/ (129 KB, 852 LOC script) автономен от site.js. Лимит inline-JS: warning >500 LOC.

### 12.2 Текущее состояние карты Авраама

| Метрика | Значение |
|---|---|
| Места (PLACES) | 19 (с era-тегами) |
| Контекстные точки (CTX) | 7 (Вавилон, Мари, Эбла, Ниневия, Мегиддо, Пещера Лота, Хацор) |
| Этапы кинотура (STAGES) | 8 (с km дистанциями) |
| Слои (LAYERS) | 8 (abr, lot, war, cand, ctx, trades, mounts, debate) |
| Торговые пути | Via Maris, Царская дорога, Дорога Сура (SVG + иврит) |
| Горы | Геризим (גְּרִזִּים), Гевал (עֵיבָל) |
| Археология | 13/19 мест верифицировано по академическим источникам |

### 12.3 URL — НЕ менять

| URL | Что | Почему |
|---|---|---|
| `/karty/` | Хаб библейских карт | Кириллица = SEO под русские запросы |
| `/karty/<slug>/` | Конкретная карта | Слаг = имя героя (avraam, ishod, pavel) |
| `/map/` | Карта связей статей | Служебная, другой тип, НЕ переименовывать |

### 12.4 Запрещено

- ❌ Копипастить avraam/ целиком для новой карты — вынос базы обязателен
- ❌ Растровые подложки / тайлы / спутник — только SVG-вектор
- ❌ Leaflet / MapLibre — оверкилл для стилизованной исторической карты
- ❌ Отдельный «поддомен» / SPA на карту — хаб /karty/ единый


---

> **Если правило кажется глупым — спроси, ПОЧЕМУ оно появилось.**
> Большинство «странных» правил появилось после реальных регрессий.
> Прежде чем менять контракт — открой `AUDIT_HISTORY.md`.


---

## 9. Железобетонные UI-правила (НИКОГДА не нарушать)

### 9.1 Имена Бога на главной странице
- `js/enhancements.js` содержит блок ambient-фраз (42 фразы: иврит/греческий/латинский (35 боковых + 7 центральных))
- **Страж запуска**: `if (!document.getElementById('hScriptureBg')) return;`  
- НЕ менять на проверку `.h-phrase--ambient` — элемента в статическом HTML нет
- При любых правках `js/enhancements.js` — проверить что `document.querySelectorAll('.h-phrase').length >= 35`

### 9.2 FC-controls (плавающие кнопки тема/поиск)
- Компактный пилл-контейнер с `backdrop-filter`, `border-radius:24px`, `padding:3px`
- Кнопки `36x36px`, NO `border-radius:50%`, NO `background-color` на hover
- Hover: ТОЛЬКО `transform:translateY(-2px)` — никаких кругов, никакого фона
- Высота контейнера ≤ 110px (две кнопки + padding)
- Класс `.gb-floating-controls` в `css/site.css`
- На mobile, если `features.themeToggle.enabled !== false`, должен быть видимый theme control: `.gb-fc-theme`, `#barThemeBtn`, `#themeToggle` или Нагорная sidebar/bottom-bar equivalent. Не скрывать `.gb-fc-theme` только потому, что есть bottom-bar: это уже приводило к отсутствию темы на статьях.

### 9.3 bio-cover в статьях о Гилле
- `articles/dzhon-gill-chast-1-chelovek/index.html` ДОЛЖЕН содержать `.bio-cover` с изображением `gill-authentic-study-cover`
- Это 16:9 кабинетный портрет Гилла в библиотеке — НЕ city-view, НЕ portrait 3:4, НЕ кафедра
- `aspect-ratio` в `.bio-cover` = `16/9` (не 21/9)

### 9.4 Карточки-thumbnails серии Гилла на главной
- Часть 1 (`dzhon-gill-chast-1`): thumbnail = `gill-authentic-study-cover` (широкоформатный кабинетный портрет)
- НЕ использовать `og-gill-authentic-study-cover` как thumbnail-картинку карточки: это social-share OG, а не компактный карточный ресурс

### 9.5 Запрет дублирования контента
- В `chast-1` — НЕ должно быть двух одинаковых портретов Гилла
- `biography-portrait` / малый 3:4 `dzhon-gill-portret` в шапке — НЕ возвращать
- На первом экране Части I должен остаться один главный образ: `.bio-cover` с `gill-authentic-study-cover`

### 9.6 Playwright-регрессионные проверки
`scripts/visual-audit.js` содержит автоматические проверки:
- `ambientPhrases === 0` на `/` → CRITICAL bug
- `fcControlsH > 110` → HIGH bug  
- `.bio-cover` отсутствует на gill chast-1 → HIGH bug

Запуск перед каждым коммитом: `npm run validate:all && node scripts/audit-pro.js`

### 9.7 Theme-toggle / search-icon — ЧИСТЫЙ SVG БЕЗ РАМОК
**Никогда не добавлять** `background`, `border`, `border-radius`, `box-shadow`, `backdrop-filter` к иконкам переключения темы и поиска. Это:
- `.theme-toggle` (absolute, в статьях)
- `.gb-fc-theme`, `.gb-fc-search` (FAB, `js/site.js` модуль 29)
- `.h-cp-btn`, `.gb-nav-search-icon` (в шапке home)
- `.bar-icon-btn` (bottom-bar, mobile)

Должно быть: **только сам SVG** (stroke=currentColor), `background:transparent`, `border:none`, никаких pill/circle обводок. Hover-эффект только `transform:translateY(-2px) scale(1.08)` + изменение `color`, без opacity-флипа (иначе оба `.icon-sun` и `.icon-moon` могут показаться одновременно — баг от 2026-06-08).

**Исключение:** серия «Нагорная проповедь» (`body.nagornaya-page`) — там своя система с Tailwind-классами, не трогать.

**Search keyboard contract:** `Ctrl/⌘+F` — всегда нативный поиск браузера; сайт не должен делать `preventDefault()` и не должен открывать command palette. Command Palette открывается только `Ctrl/⌘+K` (case-insensitive: Chromium/Playwright может дать `key="K"`). `Escape` внутри palette должен закрывать palette, а не только чистить строку. Это защищено `audit-pro` G112 и `npm run interactive-audit`.

**Media/share runtime contract:** image viewer должен открываться по клику на article image, ставить scroll-lock (`html.style.overflow='hidden'`) и закрываться по Escape с восстановлением overflow. Share dialog должен открываться через `#articleEndShareBtn`, иметь `aria-hidden="false"`, закрываться по Escape и опираться на canonical URL, не на preview/local URL. Это проверяет `npm run interactive-audit`.

**Readable/publication contract:** декоративные номера summary (`.summary-card__num`) не должны быть читательским текстом: span пустой, `aria-hidden="true"`, номер хранится в `data-num` и рисуется CSS `content:attr(data-num)`. Главный H1 на `/` в `innerText` обязан читаться как `Господь Бог — Сила Моя`. В публичном тексте не должно быть внутренних enum labels (`Book`, `Confession`, `ChicagoDoc`, `Warning`, `Father`, `Academic`) и overclaim-бейджа `Проверено историками`. Это защищает `npm run readable-audit`.

**Data/source contract:** после изменения карточек, серий или article meta запускать `npm run data:consistency` (readTime/title/search-manifest/series drift). Для внешних источников есть `npm run source:links`: TLS/404/bad-host — ошибка; 403/429/timeout — предупреждение с ручной проверкой, потому академические сайты часто режут ботов.

**Workflow/CI contract:** `indexnow.yml` и `deploy.yml` обязаны запускать `npm run validate:static-publication`; `source-links.yml` и `interactive-audit.yml` должны быть manual+scheduled; `notify-on-failure.yml` должен слушать оба этих workflow. Это защищено `npm run workflows:check`. Локальный `npm run ci:check` теперь = cache-bust + static publication gates + workflow policy.

### 9.8 article-topnav — УДАЛЁН
Sticky шапка `.article-topnav` (показывалась при скролле статьи с «← Господь Бог — Сила Моя | TITLE | поиск») **удалена из всех 8 статей** по запросу владельца 2026-06-08. **Не возвращать.** Хлебных крошек (`.breadcrumb`) достаточно для навигации.

CSS-правила `.article-topnav*` пока остаются в site.css как dead code (для возможного восстановления). При полной чистке можно удалить через PLAN; до этого не реанимировать в HTML.

### 9.9 Hover на ссылках-карточках в тёмной теме — НЕ розовый
`.h-article-card:hover .h-article-title` в светлой теме = `--h-accent` (#8b2626 темно-красный — ок). В **тёмной** теме `--h-accent` = #d97a6c — это **розово-красный**, плохо контрастирующий с золотисто-палевым телом. Поэтому в `html.dark` hover-цвет переопределён на **золотистый `#e8c97a`** (`css/home.css`). Не возвращать на `var(--h-accent)`.

### 9.10 FOUC шрифтов на главной
Кроме `Lora-cyrillic-400`, **обязательно preload** для:
- `Inter-cyrillic-600` (используется в `.h-sacred-ref` — «АВВАКУМ 3:19»)
- `PlayfairDisplay-cyrillic-700` (используется в `.h-section-title`, hero и др.)

Иначе виден FOUC: сначала рендерится fallback Times New Roman, потом подмена. Это видно на главной при перезагрузке.



### 9.13 Изображения владельца — НЕ ЗАМЕНЯТЬ генерациями

**НИКОГДА** не заменять изображения, которые загрузил владелец, на AI-генерации.
Если изображение визуально не устраивает — спроси владельца, а не генерируй замену.

Конкретно:
- `whitefield-preaching.*` — картинка Уайтфилда на Кеннингтон-Коммон. Загружена владельцем.
  Это ВТОРАЯ картинка Уайтфилда в gill-kontekst. НЕ удалять, НЕ заменять.
- `whitefield-field.*` — картинка Уайтфилда в поле. ПЕРВАЯ в gill-kontekst. НЕ удалять.
- Между двумя Уайтфилдами должен быть текст (не ставить подряд).

### 9.12 Голуби (fn-marker--dove) vs Цифры (fn-marker) — РАЗДЕЛЕНИЕ ТИПОВ СНОСОК

Два типа сносок — **железобетонное правило**, не смешивать:

| Тип | Класс | Иконка | Когда использовать |
|---|---|---|---|
| **Цифровая сноска** | `fn-marker` (без `--dove`) | Число (1, 2, 3…) | Ссылки на источники, библиографические сноски, переводческие ссылки на оригинал |
| **Голубь-сноска** | `fn-marker fn-marker--dove` | 🕊️ SVG-голубь | Пояснения редактора, справочная информация, терминологические справки, контекстные примечания |

**По статьям:**
- **Переводы** (герменевтика Чау и др.) → **ТОЛЬКО ЦИФРЫ**. В оригинале были цифровые сноски.
- **Авторские статьи** (20 антисоветов и др.) → **ГОЛУБИ** для авторских/редакторских комментариев.
- **Биографии Гилла** → цифры для ссылок на источники, голуби для пояснительных вставок (†, ‡ и т.д.).
- **Код да Винчи, Иеремия, Римлянам** → цифры (ссылки на источники).

**Запрещено:** ставить голубей на ВСЕ сноски подряд. Голубь — это визуальный маркер «здесь пояснение», а не «здесь источник».

CSS поддерживает оба типа:
- `.fn-marker` — цифра в суперскрипте, hover показывает tooltip
- `.fn-marker.fn-marker--dove` — SVG-голубь с машущим крылом, hover показывает tooltip

JS `site.js` функция `e()` инжектит SVG тело голубя только в `.fn-marker--dove`.

### 9.11 Series World (GBS) — единый канон для серий статей (с 2026-06-11, r96–r99)

Все многочастные серии статей используют **GBS** («мир серии»):
тёмный левый рельс (desktop) + sticky-шапка и нижняя капсула со шторкой (mobile),
weighted-прогресс серии по минутам, живой TOC, hero+kinetic, prev/next-карточки,
era-timeline. Живые эталоны: 5 страниц Гилла + 2 hard-texts.

- Стили: `css/site.css`, секция `body.gbs-world` / `gbs2-*` (минифицировано, ~строки 369–373).
- Поведение: `js/enhancements.js`, 3 IIFE «GBS reference pilot v2».
- Анатомия миграции страницы, плейсхолдеры и грабли: **`docs/GBS-PATTERN.md`**.
- `data/series.json` остаётся источником данных серий (тайтлы/slug'и/минуты/status); формат прежний:
```json
{
  "<series-key>": {
    "title": "Название серии",
    "baseUrl": "/articles/",
    "parts": [
      {"n": 1, "slug": "url-slug-of-part", "title": "Часть I. Заголовок", "status": "published", "readingTime": 25}
    ]
  }
}
```
- Прогресс серии в рельсе — data-атрибуты на body: `data-gbs2-done-min` (сумма минут предыдущих частей), `data-gbs2-part-min`, `data-gbs2-total-min`. При добавлении части — пересчитать на ВСЕХ страницах серии + series.json.
- Для встраивания gbs2-компонентов (timeline, next-card) на страницы БЕЗ `body.gbs-world` (лендинги серий, каталоги) — класс **`.gbs2-scope`** на секции-контейнере (даёт переменные light+dark). Пример: `/hard-texts/`.
- `status: "planned"` части показываются приглушёнными (`opacity:.55`, без href) в рельсе/шторке/next-картах.

**Запрещено:**
- Возвращать legacy series-UI: `data-series-strip` / `data-series-nav` / `.gb-strip` / `.gb-snav` / `.series-next-cta` — удалены со всех страниц в r96–r97; рендереры strip/nav и CSS `.gb-snav` ВЫЧИЩЕНЫ из кода в r107 (по «да» владельца на тотальную чистку). В `js/series-cards.js` остался только режим `data-series-cards` (каталоги); к article-страницам файл не подключается (r99).
- Дублировать inline-карточки «Часть I / II / III» вручную в HTML.
- Создавать новые CSS/JS-файлы под серию — GBS живёт в существующих файлах.
- Оставлять при миграции legacy-блоки `#reading-progress`, `#section-label`, старый `#themeToggle`, `#tocSidebar`, `#bottomBar`, `#btocOverlay` — именно так упал агент до r96 (двойная полоса прогресса).

**Нагорная проповедь** — историческое исключение (свой Tailwind-sidebar + nagornaya-mobile-toc.js). Не трогать; новые серии делать на GBS.

Перед изменением GBS-кода обязательно прогнать `npm run interactive-audit`: он проверяет на всех 7 series-страницах рельс/aria-current/toc/ring, отсутствие legacy-UI, клик по TOC (скролл, не навигация), а на мобиле — открытие шторки, переключение вкладок и закрытие.

**Инварианты дизайна GBS (решения владельца, фаза 2; нарушение = регресс):**
- Все направляющие линии — от реальных центров элементов (getBoundingClientRect), без магических отступов.
- Scroll-spy: кэш позиций + инвалидация на resize/шрифты; низ страницы → последняя секция; гистерезис ~12px.
- Автоподскролл активного пункта TOC — только scrollTop контейнера, НИКОГДА scrollIntoView.
- Один rAF-тик на скролл; классы перекрашиваются только при смене секции.
- view-transition-name не в статическом CSS — только на время перехода (JS вешает/снимает).
- Resume-позиция пишется только после реального скролла пользователя (wheel/touch/клавиши) и y>120.
- prefers-reduced-motion отключает параллакс/кинетику/зерно/отсчёты/VT — функциональность остаётся.
- У каждой картинки интерфейса — дизайн-фолбэк (onerror → градиент + номер части).

**Анти-фичи — владелец ЯВНО отклонил, не возвращать:**
- ❌ чекбокс «Отметить прочитанным» (прогресс только автоматический);
- ❌ «Дочитаете к ЧЧ:ММ» (допустим только тихий «осталось ~N мин»);
- ❌ минуты у пунктов оглавления ЧАСТИ (в списках частей — можно);
- ❌ кикер «СЕРИЯ … — N ИЗ M» над H1 (дублирует hero-подпись);
- ❌ автопереход на следующую часть по таймеру (только подсветка + клик);
- ❌ геймификация с бейджами.

**Ожидает решения владельца (без «да» не делать):** Popover API для тултипов; 3D-карта связей (three.js, этап «в» §2.4); hover-карточки внутренних ссылок / Tufte-сноски / режим фокуса; GBS для pastor-series (осмыслен при ≥2 частях); миграция «Римлянам 8» по docs/GBS-PATTERN.md когда статья будет написана (total пересчитать, обновить series.json + сестринские страницы).


### 9.17 John Gill image system — final editorial lock

  * Часть 1 bio-cover и thumbnail = `gill-authentic-study-cover`: монументальный кабинетный портрет Джона Гилла в библиотеке, 16:9.
  * Малый 3:4 портрет `dzhon-gill-portret` в верхней карточке Части I не использовать: он создаёт дублирование и непремиальную белую рамку.
  * На первом экране Части I должен быть один главный визуальный образ, а не два портрета подряд.
  * В Части I после рассказа о крещении и гимна должна быть иллюстрация `gill-baptism-scene`; не ставить её перед обращением на Быт. 3:9.
  * В Части II в блоке о раввинистике/Талмуде использовать только `gill-talmud-study-authentic`; старую `gill-engraving-talmud-study` не возвращать.
  * Книжная лавка Кеттеринга в историческом контексте = `gill-bookshop-strip` как узкая горизонтальная полоса. Не возвращать вертикальный `gill-context-scroll`.
  * Кафедра Гилла в тексте = `gill-pulpit-strip` как узкая горизонтальная полоса.
  * В Частях I–III не возвращать interstitial-блок `context-bridge` с текстом «Исторический фон серии…». После owner-review 2026-06-10 он признан лишним дублем навигации.
  * Слот скорби/пастырского утешения в Части I = `gill-funeral-sermon`: погребальная проповедь Гилла в капелле XVIII века, а не сцена с одной женщиной и не типография.
  * `gill-pastoral-succession` не трогать: владелец отдельно попросил оставить эту схему как есть. Если файл временно не используется в HTML, не удалять его без отдельного подтверждения.
  * Защищённые исходники схемы преемственности: `images/gill-pastoral-succession.webp`, `images/gill-pastoral-succession.jpg`, `images/gill-pastoral-succession-600w.webp`, `images/gill-pastoral-succession-900w.webp`, `images/gill-pastoral-succession-1200w.webp`.

### 9.18 John Gill grief/consolation slot

  * В Части I слот скорби/пастырского утешения должен использовать `gill-funeral-sermon`.
  * Сцена должна показывать исторически правдоподобную погребальную проповедь: кафедра, открытая Библия, траурное собрание, скорбящая община, а не частную сцену утешения одной девушки.
  * Старую семью `gill-pastoral-consolation` после замены не возвращать.

### 9.19 John Gill image truth-lock — описывать реальное изображение, а не только filename

  * После self-audit 2026-06-10 зафиксировано: у части Gill-asset families filename исторически неточен. **Нельзя слепо писать alt/figcaption по имени файла. Сначала открыть картинку и описать то, что реально видно.**
  * `gill-kettering-1697` = ранняя кеттерингская бытовая/ремесленная среда, дом и дорога под вечерним небом. Это **не** funeral scene и не обязательно «суконные мастерские крупным планом».
  * `gill-spurgeon-succession` = символическая сцена преемственности кафедры (кафедра, Библия, молитва), а **не** буквальный портрет/репортаж со Спердженом. Если используется, подпись должна быть о символе преемственности, не о «фото Сперджена».
  * `gill-bunhill-fields` = погребальная процессия / memorial engraving в Банхилл-Филдс, а не просто пустой вид кладбища. Подпись должна это отражать.
  * `gill-young-boy-shop` в текущей approved-family визуально является still-life с чернильницей и пером. Если используется — подпись о письме/чернилах/инструментах труда, а не о «мальчике в книжной лавке».
  * Если image family кажется семантически неидеальной, **не возвращать старые удалённые семьи автоматически**. Сначала проверь, можно ли честно переписать alt/figcaption под реальный approved image. Старое «restore ради совпадения filename→caption» запрещено без отдельного подтверждения владельца.

### 9.20 John Gill historical-restore lock

  * Если восстанавливаешь Gill-текст из старого git history, после вставки **обязательно** перепроверь `fn-marker` / `fn-marker--dove` вручную. Старые коммиты могли содержать формально «сбалансированные», но семантически сломанные span-обёртки, когда outer-marker проглатывает абзац.
  * После любого history-restore для Gill-страниц: (1) grep по `<figure class="article-img` + captions, (2) browser-check desktop+mobile, (3) verify no stale preload remains for removed/replaced image family.

### 9.21 Glossary/tooltips in summaries — HARD LOCK

  * `.summary-card` / блок «Коротко» — **только краткий plain-text summary**. Внутри summary-card запрещены `.gterm`, `.gtip`, всплывающие glossary-карточки, dotted underline и любые interactive tooltip terms. Термины и всплывающие пояснения допустимы в основном тексте статьи, но не в summary.
  * `js/glossary.js` обязан пропускать `.summary-card` и при авто-hydration текста, и при `hydrateGlossaryTerms()`. Не возвращать glossary auto-markup в summary ради “обогащения”: владелец явно попросил минималистичные summary без пунктирных терминов.
  * Glossary popup desktop-карточка должна быть цельной, без урезанного внутреннего layout: `.gtip-luxury` — block layout, header/title/body не должны вести себя как inline-flow, нормальные короткие определения не должны получать внутренний scrollbar. Mobile bottom-sheet может скроллиться только когда контент реально длинный.
  * Перед любыми правками tooltip/glossary: Playwright smoke на Gill context + Gill part + Krajne: hover/tap `.gterm`, проверить видимую карточку, непрозрачный фон, non-zero width/height, no clipping, no `.summary-card .gterm`.
  * Source-footnote tooltips must be flat DOM: запрещены `.tooltip .fn-marker`, `.tooltip .tooltip`, `.fn-marker .fn-marker`. Это уже ломало статью Chou/hermeneutics: основной текст был проглочен внутрь tooltip. После любых массовых правок сносок прогонять audit-pro G104 и browser hover на статье.
  * `audit-pro.js` guards G104/G106/G107 защищают эти правила. Если они падают — не обходить, а чинить tooltip/summary contract.

### 9.22 Регистр названий отделов/разделов — Title Case (с 2026-06-12)

  * **Названия ОТДЕЛОВ библиотеки** (бренд-лейблы разделов) пишутся в Title Case:
    значимые слова — с заглавной, служебные (предлоги/союзы/частицы) — строчными,
    кроме первого слова. Образец-эталон: **«Конфессии и Деноминации»**.
    Служебные строчными: *и, а, но, или, в, на, по, с, о, об, от, до, для, к, у,
    за, из, под, над, при, без, через*.
  * Это касается именно **имён разделов** (как они звучат в навигации, на карточке
    отдела на главной, в H1 хаба и хлебных крошках нового раздела). Новые отделы
    создавать сразу в этом регистре.
  * **НЕ распространять Title Case на:** заголовки статей, описательные заголовки
    секций, цитаты, имена собственные, ссылки на Писание, ambient-фразы. В русском
    это обычный регистр предложения (sentence case) — он остаётся как есть, иначе
    текст становится неидиоматичным. Слепая массовая «капитализация каждого слова»
    запрещена.
  * Легаси-идентификаторы, уже зашитые в structured data (`articleSection`,
    breadcrumb JSON-LD, `SITE_CONFIG.section`), менять только если меняется ВЕЗДЕ
    согласованно (видимый текст + JSON-LD + breadcrumbs + SITE_CONFIG на всех
    страницах раздела) — иначе не трогать ради косметики.

### 9.23 Отдел «Конфессии и Деноминации» — 3D-карта (iframe-приложение) и регресс-защита (с 2026-06-13)

  * `/konfessii/russkij-baptizm/` — **нативная обёртка сайта** (шапка/крошки,
    SEO/OG/JSON-LD/canonical, sr-only `<h1>`, CSP `frame-src 'self'`, Yandex, лоадер),
    внутри `<iframe src="./_app/index.html">`.
  * **Внутри iframe — ОРИГИНАЛЬНОЕ 3D-приложение** из LM Arena (перенос 1-в-1):
    React 19 + TypeScript + Vite + Tailwind 4 + **Three.js + react-force-graph-3d + d3-geo**.
    Настоящая 3D-сцена: сферы-узлы со свечением, торы-орбиты, тубы-связи, карта стран
    (d3-geo Mercator + world-atlas), режимы «граф/карта», маршруты, инспектор, лоадер,
    AI-ассистент (Gemini, без ключа graceful-null). Это собранный singlefile-бандл ~2.2 МБ.
    **Почему так:** ранний vanilla-порт (2D canvas) сильно упрощал оригинал — владелец
    потребовал точное 1-в-1; согласовано встроить оригинал как изолированный iframe-ассет.
  * **`_app/` — built-asset, исключён из статических валидаторов** (skipDirs/EXCLUDE_DIRS
    в validate.js, audit-pro.js, seo-audit.js, readable-audit.js, editorial-lint.js).
    НЕ редактировать бандл руками (кроме обязательных мета — см. README); пересобирать
    из исходников приложения.
  * **CSP бандла** (своя, в `_app/index.html`): Three.js требует `script-src 'unsafe-eval'
    blob:` и `worker-src blob:`; шрифты Inter/JetBrains — `style-src/font-src/connect-src`
    с `fonts.googleapis.com`/`fonts.gstatic.com`. Бандл несёт `robots=noindex` (индексируется
    только обёртка). Обёртка остаётся в строгой CSP сайта + `frame-src 'self'`.
  * **Регресс-защита:** `npm run konfessii:audit` (`scripts/konfessii-map-audit.js`,
    Playwright) — инварианты I1–I7 на desktop+mobile: обёртка (canonical/og/h1/JSON-LD/
    theme-color/CSP/iframe-src), бандл (singlefile/viewport/CSP/noindex/root), live
    (загрузка приложения в iframe, скрытие лоадера, **активация 3D WebGL-canvas**,
    0 pageerror, 0 overflow). Без браузера/WebGL — мягкий SKIP (exit 0). Прогонять после
    любой пересборки `_app`. Если падает — чинить страницу/пересобрать бандл, не упрощать тест.
  * **Сборка/пересборка:** инструкция в `_build-tools/konfessii-baptizm/README.md`
    (исходники приложения — отдельный Vite-проект у владельца; `base:'./'`,
    `vite-plugin-singlefile`, после сборки вернуть CSP/noindex/favicon в `<head>`).
