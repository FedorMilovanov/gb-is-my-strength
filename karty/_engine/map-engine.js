/**
 * map-engine.js v0.53 — reusable biblical map rendering engine. Signature controls + story focus halo.
 * v0.53 (§11 P-8/P-9): label-модель v2 — 8 якорей place.labelAnchor + выноски place.leader{dx,dy};
 * labelBg следует за сдвигом текста (фикс разорванных плашек). Legacy side 'l'/'r' полностью совместим.
 *
 * PUBLIC API:
 *   // Data layer (v0.2):
 *   MapEngine.loadRoute(url) -> Promise<NormalizedRoute>
 *   MapEngine.validateRoute(route) -> {ok, errors, warnings, stats}
 *   MapEngine.compareRouteData(a, b) -> {ok, errors, warnings}
 *   MapEngine.normalizeRouteData(data) -> NormalizedRoute
 *   MapEngine.collectPhotoHosts(route) -> string[]
 *
 *   // Rendering layer (v0.3 — NEW):
 *   MapEngine.createMap(container, routeData, opts) -> MapInstance
 *
 *   MapInstance:
 *     .openPlace(id)           — open detail panel for a place
 *     .closePanel()            — close detail panel
 *     .setStory(storyId)       — filter places by story
 *     .startTour() / .stopTour() — auto-advance through stages
 *     .flyTo(cx, cy, zoom)     — animate viewport
 *     .destroy()               — cleanup
 *
 * DESIGN:
 *   - Self-contained: creates all DOM elements internally
 *   - Styleable via CSS custom properties and class names
 *   - No framework dependency
 *   - Works with any route.json conforming to route.schema.json
 */
'use strict';

const MapEngine = (function() {
  const DEFAULTS = { W0: 1900, H0: 1430, minW: 300, maxW: 2600, padX: 450, padY: 380, tourDelay: 2500, kmPerUnit: 0.92, kmPerDay: 30 };
  const EASE = { outCubic: p => 1 - Math.pow(1 - p, 3) };

  // Verified Archaeological References (2024-2026 discoveries)
  const ARCHAEOLOGY_REFERENCES = {
    // Exodus route
    exodus_route: {
      title: "Маршрут Исхода: археологические свидетельства",
      items: [
        {ref:"Tell el-Kharouba fortress (2026)", text:"3,500-летняя крепость Тутмоса I на «Пути Хора» с 11 башнями — объясняет, почему Исход пошёл южным путём (Исх 13:17)", src:"Egyptian Ministry of Tourism & Antiquities, Nov 2025"},
        {ref:"Wadi Tumilat sediment study (2014-2019)", text:"Спутниковые исследования подтвердили поселенческие слои поздней бронзы вдоль Вади-Тумилат — путь из Рамсеса в Суккот", src:"Egyptian Antiquities Authority"},
        {ref:"Tell el-Retaba ash layer (c.1450 BC)", text:"Слой разрушения и заброшенности ок. 1450 г. до н.э. в Телль эль-Ретаба (библ. Рамсес/Суккот) — соответствует ранней дате Исхода", src:"Polish-Slovak Archaeological Mission"},
        {ref:"Papyrus Anastasi VI", text:"Папирус Нового Царства: «беглецы прошли крепость Чекy (Суккот) на пути к озёрам Пи-Атума» — прямая параллель Исх 12:37", src:"Papyrus Anastasi VI, 23:7-24:6"},
        {ref:"Jabal al-Lawz survey", text:"Обследование горы в Саудовской Аравии: обожжённая вершина, 12-колонный жертвенник, петроглифы золотого тельца, пещеры с надписями о Мусе", src:"BASE Institute; CBN News 2025"},
      ]
    },
    // Jerusalem First Temple
    jerusalem_first_temple: {
      title: "Иерусалим эпохи Первого Храма",
      items: [
        {ref:"Assyrian inscription Jerusalem (2025)", text:"Первый ассирийский клинописный фрагмент в Иерусалиме: «Пришли дань до 1 Ава» — возможная переписка с Езекией о мятеже (4Цар 18:7)", src:"IAA, Oct 2025; Christianity Today Top 10 of 2025"},
        {ref:"City of David ritual structure (2025)", text:"8-комнатная структура VIII в. до н.э. с алтарём, маслодавильней и винодавильней — культовый центр до реформы Езекии", src:"IAA; Fox News Jan 2025"},
        {ref:"Monumental moat (2024)", text:"70-метровый ров между Храмовой горой и Градом Давида — соответствует библейскому «Милло» (3Цар 11:27)", src:"IAA; Times of Israel Jul 2024"},
        {ref:"Broad Wall redating (2024)", text:"Радиоуглерод + дендрохронология: «Широкая стена» — не Езекии, а Озии (2Пар 26:9), построена до нашествия ассирийцев", src:"Weizmann Institute; Tel Aviv University 2024"},
        {ref:"Hezekiah's tax bulla", text:"Глиняная булла с надписью «принадлежит царю» и упоминанием Хеврона — административная система Езекии", src:"Jewish Museum NY; IAA"},
      ]
    },
    // Maccabees
    maccabees: {
      title: "Маккавейские войны: археология",
      items: [
        {ref:"Bet Zecharia sling bullets (2025)", text:"Первое материальное свидетельство битвы Маккавеев: свинцовые снаряды и монета из Сиды у Хорбат Бет-Захария — место битвы Иуды Маккавея со слонами (1Мак 6:32-46)", src:"Dr. Dvir Raviv, Bar-Ilan University; TPS Dec 2025"},
        {ref:"Hasmonean coin hoard Modiin", text:"Клад серебряных монет (126 г. до н.э.) в Модиине — на родине Маккавеев", src:"IAA"},
        {ref:"Hasmonean fortress (2021)", text:"Крепость Хасмонеев, уничтоженная греками — линия укреплений против Маккавейского восстания", src:"IAA; LiveScience 2021"},
      ]
    },
    // Early Church
    early_church: {
      title: "Ранняя Церковь и апостолы",
      items: [
        {ref:"Laodicea Roman hall (2025)", text:"Римский зал совета (50 г. до н.э.) в Лаодикии с христианскими символами: крест, хризма (ΧΡ), греческие надписи — свидетельство раннехристианского присутствия", src:"Anadolu Agency; Fox News Sep 2025"},
        {ref:"Ephesus marble bathtub (2026)", text:"Мраморная ванна I в. н.э. и фрагмент статуи в Эфесе — город, где Павел проповедовал 2 года (Деян 19:10)", src:"Anadolu Agency; Fox News Jan 2026"},
        {ref:"Pilgrimage Road opened (2025-2026)", text:"600-метровая «Дорога паломников» от Силоамской купели к Храмовой горе — под монетами Понтия Пилата (30-31 гг. н.э.). Путь, которым ходил Иисус", src:"City of David; IAA; Times of Israel Jan-Feb 2026"},
        {ref:"Bethsaida church mosaic", text:"Византийская церковь V в. с мозаикой: «Пётр — глава и вождь небесных апостолов» — древнейшее археологическое свидетельство примата Петра", src:"Dr. Steven Notley; Christian Media Center 2025"},
        {ref:"Peter's house Capernaum", text:"Дом-церковь в Капернауме (I в.) — одна из трёх известных до-Константиновых церквей, традиционно считается домом апостола Петра", src:"Southgate Baptist 2025"},
      ]
    },
    // Davidic Kingdom
    davidic_kingdom: {
      title: "Царство Давида: внебиблейские свидетельства",
      items: [
        {ref:"Tel Dan Stele (9th c. BC)", text:"Древнейшее внебиблейское упоминание «Дома Давидова» — арамейский царь Азаил хвастается победой над царём «дома Давидова». Экспонировался в Музее Библии (2025)", src:"Museum of the Bible; Jewish Museum NY 2024-2025"},
        {ref:"Mesha Stele re-examination (2025)", text:"Проф. Ланглуа подтвердил чтение 'bt[d]wd' ('Дом Давида') на стеле Меши методами RTI-фотографии — второе подтверждение династии Давида", src:"André Lemaire; Michael Langlois; BAR 2022; IEJ 2025"},
        {ref:"Khirbet Qeiyafa (2007-2012)", text:"Укреплённый город Железного века в долине Эла (где Давид сразил Голиафа) с монументальными воротами и раннееврейскими надписями — свидетельство государственности при Давиде", src:"Yosef Garfinkel; Hebrew University"},
        {ref:"Siloam Pool dam (2025)", text:"Дамба Силоамской купели (805-795 гг. до н.э.) — 12×8×21 м, крупнейшая в Израиле. Построена при Иоасе/Амасии. Радиоуглеродная датировка ±10 лет", src:"PNAS; Hoshen Tours May 2026"},
      ]
    },
    // General
    general: {
      title: "Ключевые археологические подтверждения",
      items: [
        {ref:"Ketef Hinnom scrolls (7th c. BC)", text:"Два серебряных амулета с благословением из Числ 6:24-26 — древнейший известный библейский текст, на 400 лет старше свитков Мёртвого моря", src:"IAA; Jerusalem Post 2025"},
        {ref:"House of David inscription", text:"Стела Тель-Дан + стела Меши: два независимых внебиблейских источника IX в. до н.э. подтверждают династию Давида", src:"Multiple scholarly sources"},
        {ref:"Hezekiah's Tunnel inscription", text:"Силоамская надпись (VIII в. до н.э.) — древнейшая еврейская монументальная надпись, описывающая прокладку тоннеля Езекии (4Цар 20:20)", src:"Istanbul Archaeological Museum"},
        {ref:"Gallio inscription Delphi", text:"Надпись Галлиона в Дельфах (52 г. н.э.) — упоминает проконсула Ахайи Галлиона, перед которым судили Павла (Деян 18:12) — одна из точнейших датировок НЗ", src:"Delphi Museum"},
        {ref:"Pilate stone Caesarea", text:"Камень с надписью «Понтий Пилат, префект Иудеи» — единственное археологическое подтверждение историчности Пилата", src:"Israel Museum, Jerusalem"},
      ]
    },
    judges_period: {
      title: "Эпоха Судей: археология",
      items: [
        {ref:"Shiloh gate complex (2025-2026)", text:"Раскопки воротного комплекса Силома — места, где священник Илий упал и умер (1Цар 4:18). ABR продолжает раскопки в 2026.", src:"ABR Shiloh Excavation 2025-2026"},
        {ref:"Timnah (Tel Batash)", text:"Тель-Баташ = Фимнафа Самсона. Поселение железного века I (XII-XI вв. до н.э.) — период Судей. Место загадки Самсона о льве и мёде (Суд 14).", src:"Kelm & Mazar"},
        {ref:"Philistine Pentapolis", text:"Газа, Аскалон, Ашдод, Екрон и Геф — пять городов филистимской конфедерации. Керамика с эгейскими мотивами XII-XI вв. до н.э.", src:"Multiple excavations"},
      ]
    },
    kings_period: {
      title: "Эпоха Царей: археология",
      items: [
        {ref:"Samaria ivories (500+ pieces)", text:"Дворец Амврия/Ахава: 500+ фрагментов резной слоновой кости. Сосуд Осоркона (874-850 гг. до н.э.) — современник Ахава. 'Дом украшенный слоновой костью' (3Цар 22:39).", src:"Harvard Semitic Museum"},
        {ref:"Megiddo water tunnel", text:"65-метровый тоннель к источнику — инженерное чудо IX-VIII вв. до н.э. Армагеддон = Хар-Мегиддо (Откр 16:16).", src:"University of Chicago; Tel Aviv University"},
        {ref:"Jezreel fortress (1990-1996)", text:"Крепость IX в. до н.э.: 5-метровые стены, шестикамерные ворота, ров 6 м. Виноградник Навуфея? (3Цар 21:1). Летний дворец Ахава и Иезавели.", src:"Ussishkin & Woodhead"},
        {ref:"Lachish letters", text:"21 остракон с перепиской коменданта перед падением (588 г. до н.э.). Рельефы Сеннахирима (701 г. до н.э.) в Ниневии изображают осаду.", src:"British Museum; IAA"},
        {ref:"Beersheba horned altar", text:"Четырёхрогий жертвенник, разобранный и заложенный в стену — реформа Езекии (4Цар 18:4). (Aharoni 1969-1976).", src:"Tel Aviv University"},
        {ref:"Hezekiah bulla (Ophel 2015)", text:"Первая царская печать из научных раскопок: 'Езекии, сыну Ахаза, царю Иудеи'. В 3 м — возможная печать пророка Исайи.", src:"Eilat Mazar; Hebrew University"},
      ]
    },
    jesus_ministry: {
      title: "Служение Иисуса: археология",
      items: [
        {ref:"Magdala Stone (2009)", text:"Камень из синагоги I в. с Менорой и Храмом. Одна из 7 синагог I в. Экспонируется в Музее Библии (2025).", src:"IAA; Museum of the Bible"},
        {ref:"Nazareth house (2009)", text:"Дом I в. н.э. в Назарете. Надпись из Кесарии (1962) о священническом курсе в Назарете. Население ~400 в I в.", src:"IAA"},
        {ref:"Capernaum synagogue & Peter's house", text:"Синагога IV в. на основании синагоги I в. — где проповедовал Иисус (Мк 1:21). Дом Петра — октагональная церковь V в.", src:"Franciscan excavations"},
        {ref:"Jesus Boat (1986)", text:"Лодка I в. (8.2×2.3 м) из Галилейского моря. Радиоуглерод: 40 г. до н.э. — 70 г. н.э.", src:"Yigal Allon Museum"},
        {ref:"Pool of Bethesda (John 5:2)", text:"Двойной бассейн с пятью колоннадами. Точное соответствие Ин 5:2: 'купальня у Овечьих ворот... пять крытых ходов'.", src:"White Fathers; IAA"},
      ]
    },
    dead_sea_scrolls: {
      title: "Свитки Мёртвого моря",
      items: [
        {ref:"Museum of the Bible exhibition (2025-2026)", text:"Выставка в Музее Библии: Бытие, Иов, Псалмы, Храмовый свиток. 200+ артефактов IAA. 75-летие открытия свитков.", src:"Museum of the Bible; IAA"},
        {ref:"Cave of Horror fragments (2021)", text:"Новые фрагменты Захарии и Наума (греческий) из Пещеры ужаса. Радиоуглерод: II в. н.э. — время Бар-Кохбы.", src:"IAA"},
        {ref:"Qumran Cave 12 (2017)", text:"12-я пещера Кумрана: найдены jar-фрагменты, кожаные ремни, ткань. Операция 'Свиток'.", src:"Hebrew University; IAA"},
      ]
    },
    babylonian_exile: {
      title: "Вавилонский плен: археология",
      items: [
        {ref:"Babylonian Chronicle (BM 21946)", text:"Вавилонская хроника: «В седьмой год [Навуходоносора] он захватил город Иуды и назначил царя по своему выбору» — 597 г. до н.э. Точное соответствие 4Цар 24:10-17.", src:"British Museum"},
        {ref:"Jehoiachin ration tablets", text:"4 клинописные таблички из хранилищ Навуходоносора: «Яу-кину, царь земли Яхуд», получал масляный паёк с 5 сыновьями. 561-560 гг. до н.э. — 4Цар 25:27-30.", src:"British Museum BM 115338"},
        {ref:"Lachish Letters (ostraca)", text:"21 остракон из сторожки ворот Лахиса. Письмо IV: «Мы не видим сигналов Азеки» — последние дни перед падением (588 г.). Иер 34:7: только Лахис и Азека оставались.", src:"Israel Museum; British Museum"},
        {ref:"Jerusalem destruction layer", text:"Метровый слой пепла в Городе Давида. Карбонизированные балки, наконечники стрел вавилонского типа. 51 булла, закалённая огнём: «Гемарьяху сын Шафана» (Иер 36:10-12). 50 лет археологической тишины = плен.", src:"Yigal Shiloh 1978-82; Hebrew University"},
        {ref:"Kish cylinders of Nebuchadnezzar (2025)", text:"Два цилиндра из Киша (Ирак) с 50+ строками клинописи. Навуходоносор: «Я восстановил обрушившиеся части... украсил внешний вид». Опубликовано в IRAQ (декабрь 2025). Соответствует Дан 4:27.", src:"Iraq Museum; Cambridge University Press 2025"},
        {ref:"Al-Yahudu tablets", text:"100+ экономических текстов из центрального Ирака: иудейские семьи с еврейскими именами (Гедальягу сын Пашхура). Доказывают сохранение идентичности в плену.", src:"Multiple collections"},
      ]
    },
    persian_return: {
      title: "Возвращение из плена: археология",
      items: [
        {ref:"Cyrus Cylinder (539 BC)", text:"Цилиндр Кира (Британский музей BM 90920): политика возвращения изгнанников и восстановления храмов. Хотя конкретно иудеи не названы, общая политика точно соответствует Езд 1:1-4. Копия — в штаб-квартире ООН.", src:"British Museum"},
        {ref:"Tattenai tablet (502 BC)", text:"Клинописная табличка VAS 4 152: свидетель сделки — слуга 'Таттанну, правителя Заречья'. Тот самый Таттенай, который спрашивал у иудеев: «Кто дал вам разрешение строить этот дом?» (Езд 5:3).", src:"Vorderasiatisches Museum, Berlin"},
        {ref:"Elephantine papyri (5th c. BC)", text:"Арамейская переписка иудейского гарнизона на о. Элефантина (Египет). Письмо к Багохию, правителю Иудеи, и Иехоханану, первосвященнику в Иерусалиме. Упоминает 'сыновей Санаваллата' (Неем 2:10).", src:"Multiple museums"},
        {ref:"Nehemiah's wall", text:"Сегменты стены Неемии с персидской керамикой под и внутри кладки — археологическое свидетельство масштабной восстановительной программы, описанной в Неем 2-6.", src:"IAA; City of David"},
        {ref:"Yehud stamp impressions", text:"Сотни ручек сосудов с оттисками 'Yehud' (Иудея) персидского периода — административная система провинции Йехуд после возвращения из плена.", src:"IAA; multiple excavations"},
      ]
    },
    jericho_ai: {
      title: "Иерихон и Гай: дискуссия о завоевании",
      items: [
        {ref:"Jericho wall collapse", text:"Гарстанг (1930-е): стены рухнули НАРУЖУ — создав рампу для восхождения (Ис Нав 6:20). Кеньон (1950-е): «разрушение было полным», но датировала 1550 г. Б. Вуд (1990): Кеньон игнорировала кипрскую бихромную керамику. 3-футовый слой пепла. Запасы зерна = короткая осада.", src:"Garstang; Kenyon; Wood BAR 1990"},
        {ref:"Jericho City V (2025-2026)", text:"Bryan Windle: 572 артефакта LB, включая 174 сосуда. Город V был укреплён: mudbrick стена на циклопической основе. Нигро (Sapienza): LB I-II mudbrick стена подтверждена. Новая книга: 'Joshua's Jericho' (Trowel Press, декабрь 2025).", src:"Bryan Windle; Lorenzo Nigro"},
        {ref:"Ai debate: et-Tell vs Khirbet el-Maqatir", text:"Традиционно Гай = эт-Телль, но нет следов LB заселения. ABR раскопала Хирбет эль-Макатир: пережжённая керамика, пепел, византийский монастырь. Иоиль Крамер (2025): эт-Телль всё же может быть Гаем — нашёл LB I керамику и разрушение огнём.", src:"ABR; Joel Kramer Expedition Bible 2025"},
      ]
    }
  };
  const STAGE_COLORS = ['#e8c879','#e0813f','#4a9e6e','#cf5b6b','#8b6b4a','#4a80b4'];
  const TAB_LABELS = {story:'Сюжет',bible:'Писание',arch:'Археология',he:'Иврит',dispute:'Дискуссия',sci:'Наука',photos:'Фото',extra:'Библ.контекст'};
  const TAB_KEYS = ['story','bible','arch','he','dispute','sci','photos','extra'];

  function clamp(n,a,b){return Math.min(Math.max(n,a),b)}
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

  // ── v0.2 DATA LAYER (preserved) ──

  function normalizeRouteData(data={}){
    const places=Array.isArray(data.places)?data.places:(data.places_index||[]);
    const stages=Array.isArray(data.stages)?data.stages:(data.stages_index||[]);
    const ctx=Array.isArray(data.ctx)?data.ctx:(data.ctx_index||[]);
    const stories=Array.isArray(data.stories)?data.stories:[];
    return {...data,places,stages,ctx,stories};
  }

  async function loadRoute(url,opts={}){
    const res=await fetch(url,{credentials:opts.credentials||'same-origin',headers:{Accept:'application/json',...(opts.headers||{})}});
    if(!res.ok)throw new Error(`MapEngine.loadRoute: ${res.status} ${url}`);
    return normalizeRouteData(await res.json());
  }

  function validateRoute(data={}){
    const route=normalizeRouteData(data),errors=[],warnings=[],ids=new Set();
    route.places.forEach((p,i)=>{
      if(!p||!p.id)errors.push(`places[${i}] has no id`);
      if(p&&p.id){if(ids.has(p.id))errors.push(`duplicate place id: ${p.id}`);ids.add(p.id);}
      if(typeof p?.x!=='number'||typeof p?.y!=='number')warnings.push(`place ${p?.id||i}: x/y should be numbers`);
    });
    route.stories.forEach(st=>{
      (st.places||st.place_ids||[]).forEach(pid=>{if(!ids.has(pid))errors.push(`story ${st.id}: unknown place ${pid}`);});
      (st.stages||st.stage_ids||[]).forEach(si=>{if(si<0||si>=route.stages.length)errors.push(`story ${st.id}: unknown stage ${si}`);});
    });
    const metaStats=route.meta?.stats||{};
    if(metaStats.places&&metaStats.places!==route.places.length)warnings.push(`meta.stats.places mismatch`);
    if(metaStats.stages&&metaStats.stages!==route.stages.length)warnings.push(`meta.stats.stages mismatch`);
    return {ok:errors.length===0,errors,warnings,stats:{places:route.places.length,stages:route.stages.length,stories:route.stories.length,ctx:route.ctx.length}};
  }

  function compareRouteData(left={},right={}){
    const a=normalizeRouteData(left),b=normalizeRouteData(right),errors=[],warnings=[];
    const idsA=a.places.map(p=>p.id),idsB=b.places.map(p=>p.id);
    if(JSON.stringify(idsA)!==JSON.stringify(idsB))errors.push(`place id drift`);
    if(a.stages.length!==b.stages.length)errors.push(`stage count drift`);
    if(a.stories.length!==b.stories.length)errors.push(`story count drift`);
    a.places.forEach(pA=>{
      const pB=b.places.find(p=>p.id===pA.id);
      if(pB&&(pA.x!==pB.x||pA.y!==pB.y))errors.push(`place coord drift: ${pA.id}`);
    });
    return {ok:errors.length===0,errors,warnings,stats:{places:idsA.length,stages:a.stages.length,stories:a.stories.length}};
  }

  function collectPhotoHosts(route={}){
    const data=normalizeRouteData(route),hosts=new Set();
    data.places.forEach(p=>(p.photos||[]).forEach(ph=>{
      for(const key of['src','thumb']){if(!ph[key]||!/^https?:\/\//.test(ph[key]))continue;try{hosts.add(new URL(ph[key]).origin)}catch(_){}}
    }));
    return [...hosts].sort();
  }

  // Panel model helpers
  function getPlaceIndex(route,placeId){return (route.places||[]).findIndex(p=>p.id===placeId)}
  function getPlaceById(route,placeId){return (route.places||[]).find(p=>p.id===placeId)}
  function getStageForPlace(route,place){const st=route.stages||[];return place&&typeof place.stage==='number'?st[place.stage]||null:null}
  function getRelatedPlaceIds(route,placeId){
    const related=[];
    for(const p of(route.places||[])){if(p.related&&p.related.includes(placeId))related.push(p.id)}
    return related;
  }
  function getTabContentKey(place,tab){return place&&place[tab]?tab:null}

  function getPanelModel(route,placeId){
    const idx=getPlaceIndex(route,placeId);
    const place=idx>=0?route.places[idx]:null;
    return {index:idx,place,stage:getStageForPlace(route,place),relatedIds:place?getRelatedPlaceIds(route,place.id):[],photoCount:Array.isArray(place?.photos)?place.photos.length:0};
  }

  function getPanelSections(route,placeId,tab,relatedMap){
    const model=getPanelModel(route,placeId),place=model.place;
    return {
      hasStory:!!(place&&place.story),hasBible:!!(place&&place.bible),hasArch:!!(place&&place.arch),
      hasHe:!!(place&&place.he_deep),hasDispute:!!(place&&place.dispute),hasPhotos:!!(place&&Array.isArray(place.photos)&&place.photos.length),
      hasExtra:!!(place&&place.bible_extra),hasRelated:model.relatedIds.length>0,contentKey:place&&place[tab]?tab:null
    };
  }

  function getStoryViewport(data = {}, storyId = 'main', opts = {}) {
    const route = normalizeRouteData(data);
    const story = (route.stories || []).find(s => s.id === storyId) || (route.stories || [])[0] || null;
    const explicit = story && (story.viewport || story.cam);
    if (Array.isArray(explicit) && explicit.length >= 3) return explicit;
    if ((!story || story.id === 'main') && route.meta?.viewport_init) {
      const v = route.meta.viewport_init;
      return [v.cx, v.cy, v.w];
    }
    const state = getStoryState(route, storyId);
    const ids = new Set(state?.placeIds || []);
    const places = (route.places || []).filter(p => ids.has(p.id) && typeof p.x === 'number' && typeof p.y === 'number');
    if (!places.length && route.meta?.viewport_init) {
      const v = route.meta.viewport_init;
      return [v.cx, v.cy, v.w];
    }
    if (!places.length) return [DEFAULTS.W0 / 2, DEFAULTS.H0 / 2, DEFAULTS.W0];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    places.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    const pad = opts.padding ?? 1.75;
    const minW = opts.minW ?? 420;
    const maxW = opts.maxW ?? (route.meta?.viewport_init?.w || DEFAULTS.W0);
    const widthByX = Math.max(minW, (maxX - minX) * pad + 160);
    const widthByY = Math.max(minW, (maxY - minY) * pad * DEFAULTS.W0 / DEFAULTS.H0 + 160);
    const w = clamp(Math.max(widthByX, widthByY), minW, maxW);
    return [(minX + maxX) / 2, (minY + maxY) / 2, w];
  }

  function getStoryState(route,storyId){
    const story=(route.stories||[]).find(s=>s.id===storyId);
    return story?{story,placeIds:story.places||story.place_ids||null,stageIds:story.stages||story.stage_ids||null}:null;
  }

  function _defaultStoryId(route){
    return (route.stories||[]).find(s=>s.active_by_default)?.id || (route.stories||[])[0]?.id || 'main';
  }

  function _normalizeMapStateCandidate(route,candidate={},fallbackStoryId){
    const stories=route.stories||[];
    const places=route.places||[];
    const validStory=id=>typeof id==='string'&&stories.some(s=>s.id===id);
    const validPlace=id=>typeof id==='string'&&places.some(p=>p.id===id);
    let story=validStory(candidate.story)?candidate.story:(validStory(fallbackStoryId)?fallbackStoryId:_defaultStoryId(route));
    const place=validPlace(candidate.place)?candidate.place:null;
    if(place){
      const selected=stories.find(s=>s.id===story);
      const selectedIds=new Set(selected?(selected.places||selected.place_ids||places.map(p=>p.id)):places.map(p=>p.id));
      if(!selectedIds.has(place)){
        const containing=stories.find(s=>(s.places||s.place_ids||[]).includes(place));
        if(containing)story=containing.id;
      }
    }
    return {story,place};
  }

  function parseMapStateFromLocation(data={},locationLike={}){
    const route=normalizeRouteData(data);
    const query=new URLSearchParams(String(locationLike.search||'').replace(/^\?/,''));
    const hash=new URLSearchParams(String(locationLike.hash||'').replace(/^#/,''));
    const queryHas=query.has('story')||query.has('place');
    const hashHas=hash.has('story')||hash.has('place');
    const normalized=_normalizeMapStateCandidate(route,{
      story:query.get('story')||hash.get('story'),
      place:query.get('place')||hash.get('place')
    },_defaultStoryId(route));
    return {...normalized,hasExplicit:queryHas||hashHas,source:queryHas?'query':(hashHas?'hash':'default')};
  }

  function resolveInitialMapState(data={},locationLike={},savedState=null){
    const route=normalizeRouteData(data);
    const explicit=parseMapStateFromLocation(route,locationLike);
    if(explicit.hasExplicit)return {...explicit,viewport:getStoryViewport(route,explicit.story)};
    const saved=savedState&&typeof savedState==='object'?savedState:{};
    const savedStoryValid=typeof saved.story==='string'&&(route.stories||[]).some(s=>s.id===saved.story);
    const savedPlaceValid=typeof saved.place==='string'&&(route.places||[]).some(p=>p.id===saved.place);
    if(savedStoryValid||savedPlaceValid){
      const normalized=_normalizeMapStateCandidate(route,saved,_defaultStoryId(route));
      return {...normalized,hasExplicit:false,source:'saved',viewport:getStoryViewport(route,normalized.story)};
    }
    const normalized=_normalizeMapStateCandidate(route,{},_defaultStoryId(route));
    return {...normalized,hasExplicit:false,source:'default',viewport:getStoryViewport(route,normalized.story)};
  }

  function buildMapStateUrl(locationLike={},state={}){
    const origin=String(locationLike.origin||'');
    const pathname=String(locationLike.pathname||'/');
    const query=new URLSearchParams(String(locationLike.search||'').replace(/^\?/,''));
    query.delete('story');query.delete('place');
    if(state.story&&state.story!=='main')query.set('story',state.story);
    if(state.place)query.set('place',state.place);
    let hash=String(locationLike.hash||'');
    const hashParams=new URLSearchParams(hash.replace(/^#/,''));
    if(hashParams.has('story')||hashParams.has('place'))hash='';
    const search=query.toString();
    return origin+pathname+(search?'?'+search:'')+hash;
  }

  function getPlaceOrder(route,storyId,includeCandidates=true){
    const state=getStoryState(route,storyId);
    const places=route.places||[];
    let filtered=places;
    if(state&&state.placeIds){const ids=new Set(state.placeIds);filtered=places.filter(p=>ids.has(p.id))}
    if(!includeCandidates)filtered=filtered.filter(p=>p.type!=='cand');
    return {ids:filtered.map(p=>p.id),indexes:filtered.map(p=>places.indexOf(p)),includeCandidates,storyId,count:filtered.length};
  }

  function auditStoryDefinitions(route){
    const errors=[];
    (route.stories||[]).forEach(st=>{
      const ids=st.places||st.place_ids||[];
      ids.forEach(id=>{if(!(route.places||[]).find(p=>p.id===id))errors.push(`story ${st.id}: place ${id} not found`)});
    });
    return {ok:errors.length===0,errors};
  }

  // ── v0.3 RENDERING LAYER ──

  
    // Marker ripple effect
    function addRipple(parentSvg, cx, cy, color) {
      const ripple = document.createElementNS('http://www.w3.org/2000/svg','circle');
      ripple.setAttribute('cx', cx);
      ripple.setAttribute('cy', cy);
      ripple.setAttribute('r', '6');
      ripple.setAttribute('fill', 'none');
      ripple.setAttribute('stroke', color || '#e8c879');
      ripple.setAttribute('stroke-width', '2');
      ripple.setAttribute('opacity', '0.8');
      ripple.setAttribute('filter', 'url(#me-glow)');
      ripple.style.pointerEvents = 'none';
      (parentSvg || document.querySelector('.me-canvas svg'))?.appendChild(ripple);
      
      let r = 6;
      function animate() {
        r += 2.5;
        const progress = (r-6)/40;
        // Use ease-out cubic for smoother ripple
        const ease = 1 - Math.pow(1 - Math.min(progress, 1), 3);
        ripple.setAttribute('r', 6 + ease * 40);
        ripple.setAttribute('opacity', Math.max(0, 0.8 * (1 - ease)));
        if (r < 48) requestAnimationFrame(animate);
        else ripple.remove();
      }
      requestAnimationFrame(animate);
    }

  function createMap(container, routeData, opts={}) {
    // Validate input
    if (!container) { console.error('MapEngine.createMap: container is required'); return null; }
    if (!routeData || !routeData.places || !routeData.places.length) {
      container.innerHTML = '<div class="me-error" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#9aa2ae;font-family:Georgia,serif"><div style="font-size:48px;margin-bottom:12px">⚠</div><div style="font-size:16px;color:#e9e4d6;margin-bottom:4px">Карта пуста</div><div style="font-size:12px">route.json не содержит мест для отображения</div></div>';
      return null;
    }
    const route = normalizeRouteData(routeData);
    const cfg = {...DEFAULTS, ...opts};
    
    // State: one deterministic transaction before the first render.
    const stateStorageKey='me-map-state-'+(route.meta?.id||'map');
    let savedInitialState=null;
    try{
      const raw=localStorage.getItem(stateStorageKey);
      if(raw)savedInitialState=JSON.parse(raw);
    }catch(e){}
    const initialState = resolveInitialMapState(route, location, savedInitialState);
    const initialPlaceId = initialState.place;
    let activePlaceId = null;
    let activeStoryId = initialState.story;
    let touring = false;
    let tourStepIdx = 0;
    let rafId = null;
    let dragState = null;
    let tourTimer = null;
    let view = {x:0, y:0, w:cfg.W0, h:cfg.H0};

    function getState() {
      return { place: activePlaceId, story: activeStoryId };
    }
    
    // Cleanup tracking
    const _listeners = [];
    const _timers = [];
    function _on(el, ev, fn, opts) { el.addEventListener(ev, fn, opts); _listeners.push({el, ev, fn, opts}); }
    function _tm(fn, ms) { const t = setTimeout(fn, ms); _timers.push(t); return t; }
    
    // Haptic feedback
    function haptic(ms = 15) {
      try { if (navigator.vibrate) navigator.vibrate(ms); } catch(e) {}
    }

    function _cleanupAll() {
      _listeners.forEach(l => { try { l.el.removeEventListener(l.ev, l.fn, l.opts); } catch(e) {} });
      _listeners.length = 0;
      _timers.forEach(t => clearTimeout(t));
      _timers.length = 0;
      cancelAnimationFrame(rafId);
      if (tourTimer) clearTimeout(tourTimer);
      // Remove injected CSS
      const css = document.getElementById('me-base-css');
      if (css) css.remove();
      // Restore body overflow
      document.body.style.overflow = '';
    }
    const initVp = initialState.viewport || [cfg.W0/2,cfg.H0/2,cfg.W0];
    const initW=clamp(Number(initVp[2])||cfg.W0,cfg.minW,cfg.maxW);
    const initH=initW*cfg.H0/cfg.W0;
    view={
      x:clamp((Number(initVp[0])||cfg.W0/2)-initW/2,-cfg.padX,cfg.W0+cfg.padX-initW),
      y:clamp((Number(initVp[1])||cfg.H0/2)-initH/2,-cfg.padY,cfg.H0+cfg.padY-initH),
      w:initW,h:initH
    };

    // ── DOM construction ──

    // Inject base CSS
    if(!document.getElementById('me-base-css')){
      const css=document.createElement('style');
      css.id='me-base-css';
      css.textContent=`
/* === MAP ENGINE v0.25 CSS === */
/* Base */
.me-map{position:relative;width:100%;height:100%;overflow:hidden;overscroll-behavior:contain;background:#070a10;user-select:none;font-family:Georgia,'Times New Roman',serif}
.me-map *{box-sizing:border-box}
.me-canvas{position:absolute;inset:0;cursor:grab;will-change:transform;touch-action:none}.me-canvas svg{will-change:transform}
.me-canvas:active{cursor:grabbing}
.me-canvas svg{width:100%;height:100%;display:block;touch-action:none}

/* Header */
.me-header{position:absolute;top:0;left:0;right:0;padding:12px 16px;z-index:10;pointer-events:none;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap}
.me-header>*{pointer-events:auto}
.me-back{display:inline-flex;align-items:center;gap:6px;color:#9aa2ae;font-size:10px;letter-spacing:.15em;text-transform:uppercase;text-decoration:none;padding:11px 16px;min-height:36px;border-radius:999px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(8px);transition:color .2s}
.me-back:hover{color:#e8c879}
.me-title{color:#fff;font-size:22px;line-height:1.2;text-shadow:0 2px 8px rgba(0,0,0,.6)}
.me-title-he{color:#e8c879;font-size:15px;letter-spacing:.2em;margin-top:2px;direction:rtl;text-shadow:0 2px 6px rgba(0,0,0,.5)}
.me-subtitle{color:#9aa2ae;font-size:11px;margin-top:2px}

/* Story chips */
.me-stories{display:flex;gap:6px;flex-wrap:wrap}
.me-story-chip{padding:10px 14px;min-height:36px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.5);color:#9aa2ae;font-size:11px;cursor:pointer;backdrop-filter:blur(8px);transition:all .2s;font-family:inherit;white-space:nowrap;display:inline-flex;align-items:center}
.me-story-chip:hover{border-color:rgba(255,255,255,.3);color:#e9e4d6}
.me-story-chip--active{background:rgba(232,200,121,.2);color:#e8c879;border-color:rgba(232,200,121,.4)}

/* Stage dots */
.me-stages{position:absolute;bottom:8px;right:8px;z-index:10;display:flex;gap:8px;padding:6px 14px;border-radius:999px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(8px)}
.me-stage-dot{display:flex;align-items:center;gap:4px;font-size:10px;color:#9aa2ae;white-space:nowrap}
.me-stage-dot::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor}

/* Panel */
.me-panel{position:absolute;bottom:0;left:0;right:0;background:rgba(13,17,26,.95);backdrop-filter:blur(16px);border-top:1px solid rgba(232,200,121,.2);z-index:20;transition:transform .35s cubic-bezier(.4,0,.2,1);transform:translateY(105%);display:flex;flex-direction:column;border-radius:16px 16px 0 0;box-shadow:0 -8px 32px rgba(0,0,0,.4)}
.me-panel--open{transform:translateY(0)}
.me-panel__close{position:absolute;top:8px;right:10px;z-index:5;background:none;border:none;font-size:20px;color:#9aa2ae;cursor:pointer;padding:10px;min-width:44px;min-height:44px;border-radius:10px;line-height:1;display:inline-flex;align-items:center;justify-content:center}
.me-panel__close:hover{color:#fff;background:rgba(255,255,255,.05)}
.me-panel__head{padding:16px 16px 10px;border-bottom:1px solid rgba(255,255,255,.06);background:linear-gradient(to bottom,rgba(232,200,121,.06),rgba(232,200,121,.01) 60%,transparent);position:relative;transition:background .3s ease}
.me-panel__head::after{content:"";position:absolute;bottom:0;left:16px;right:16px;height:1px;background:linear-gradient(to right,transparent,rgba(232,200,121,.2),transparent)}
.me-panel__stage{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#e8c879;margin-bottom:4px}
.me-panel__name{font-size:20px;color:#fff;font-weight:700;margin-bottom:2px;padding-right:32px}
.me-panel__he{font-size:14px;color:#e8c879;margin-bottom:4px;direction:rtl}
.me-panel__kick{font-size:12px;color:#9aa2ae;font-weight:700}
.me-panel__meta{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.me-panel__meta span{font-size:9px;color:rgba(154,162,174,.7);padding:3px 10px;border:1px solid rgba(255,255,255,.06);border-radius:6px;background:rgba(255,255,255,.02)}
.me-panel__backdrop{position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:19;opacity:0;pointer-events:none;transition:opacity .3s}
.me-panel__backdrop--active{opacity:1;pointer-events:auto}
.me-panel__resize{position:absolute;left:-6px;top:50%;transform:translateY(-50%);width:12px;height:60px;cursor:ew-resize;z-index:25;display:none}
.me-panel__resize::after{content:'';position:absolute;left:4px;top:10px;bottom:10px;width:3px;border-radius:2px;background:rgba(255,255,255,.15);transition:background .2s}
.me-panel__resize:hover::after{background:rgba(232,200,121,.4)}
.me-panel__stage-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}

/* Tabs */
.me-tabs{display:flex;gap:0;padding:0 12px;border-bottom:1px solid rgba(255,255,255,.06);overflow-x:auto}
.me-tab{padding:8px 14px;font-size:11px;border:none;background:none;color:#9aa2ae;cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;font-family:inherit;white-space:nowrap;position:relative;top:1px}
.me-tab:hover{color:#e9e4d6}
.me-tabs::after{content:'';position:sticky;right:0;width:20px;flex-shrink:0;background:linear-gradient(to right,transparent,rgba(13,17,26,.9));pointer-events:none}
.me-tab--active{color:#e8c879;border-bottom-color:#e8c879;background:linear-gradient(to top,rgba(232,200,121,.08),transparent)}

/* Content */
.me-content{padding:12px 16px;overflow-y:auto;flex:1;font-size:13px;line-height:1.65;color:#9aa2ae;scroll-behavior:smooth;-webkit-overflow-scrolling:touch}.me-content *{will-change:auto}
.me-content::-webkit-scrollbar{width:4px}
.me-content::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
.me-content::-webkit-scrollbar-track{background:transparent}
.me-content p{margin-bottom:8px;color:#e9e4d6}
.me-content .verse{font-style:italic;border-left:3px solid rgba(232,200,121,.6);padding:8px 12px;margin:12px 0;color:#e9e4d6;font-size:13px;line-height:1.55;background:rgba(232,200,121,.04);border-radius:0 6px 6px 0;position:relative}.me-content .verse::before{content:'«';position:absolute;left:6px;top:2px;font-size:24px;color:rgba(232,200,121,.15);pointer-events:none}
.me-content .verse span{display:block;font-size:9px;color:#e8c879;margin-top:6px;letter-spacing:.06em;font-style:normal}
.me-content .note{background:rgba(255,255,255,.03);padding:10px 14px;border-radius:8px;font-size:11px;margin:8px 0;border-left:3px solid rgba(232,200,121,.3);line-height:1.5}
.me-content .he-block{background:rgba(255,255,255,.03);padding:12px 14px;border-radius:10px;margin:10px 0;border:1px solid rgba(255,255,255,.05);position:relative;overflow:hidden}
.me-content .he-block::after{content:"א";position:absolute;top:-12px;right:8px;font-size:72px;color:rgba(232,200,121,.03);font-family:Georgia,serif;pointer-events:none}
.me-content .hw{color:#e8c879;font-size:20px;font-family:Georgia,"Times New Roman",serif}
.me-content .he-tr{color:#9aa2ae;font-size:11px;margin-left:8px}
.me-content .he-etym{font-size:11px;margin-top:4px;color:#e9e4d6}
.me-content .he-refs{font-size:9px;color:rgba(154,162,174,.6);margin-top:4px}
.me-content .dispute-block{background:rgba(255,255,255,.03);padding:12px 14px;border-radius:10px;margin:10px 0;border:1px solid rgba(255,255,255,.05);position:relative}.me-content .dispute-block::before{content:'⚡';position:absolute;top:-8px;right:8px;font-size:14px;opacity:.5}
.me-content .dispute-title{font-weight:700;color:#e8c879;margin-bottom:8px;font-size:13px;display:flex;align-items:center;gap:6px}
.me-content .dispute-pos{padding-left:8px;margin:4px 0;border-left:2px solid rgba(255,255,255,.1)}
.me-content .dispute-note{font-size:10px;color:rgba(154,162,174,.6);font-style:italic;margin-top:6px}
.me-content .conf-hi{color:#4ade80;font-size:9px}
.me-content .conf-med{color:#facc15;font-size:9px}
.me-content .conf-lo{color:#f87171;font-size:9px}
.me-content .bib-note{background:rgba(255,255,255,.04);padding:10px 12px;border-radius:8px;font-size:11px;margin:8px 0}
.me-content .bib-note b{color:#e8c879}
.me-content img{max-width:100%;border-radius:6px;margin:6px 0}

/* Photo */
.me-photo-label{font-size:9px;color:rgba(154,162,174,.5);margin-top:3px;text-align:center}
.me-photo-gallery{position:relative}
.me-photo-slide{animation:mePhotoFadeIn .3s ease}
.me-photo-slide img{max-width:100%;border-radius:6px;margin:0}
@keyframes mePhotoFadeIn{from{opacity:0;transform:translateX(5px)}to{opacity:1;transform:translateX(0)}}
.me-photo-nav{display:flex;justify-content:center;gap:6px;margin-top:8px;padding:4px 0}
.me-photo-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.15);cursor:pointer;transition:all .2s;position:relative}.me-photo-dot:hover{transform:scale(1.4)}.me-photo-dot:active{transform:scale(.85)}
.me-photo-dot:hover{background:rgba(255,255,255,.3)}
.me-photo-dot--active{background:#e8c879;transform:scale(1.3)}

/* Nav */
.me-nav{display:flex;align-items:center;padding:10px 16px;border-top:1px solid rgba(255,255,255,.08);gap:8px}
.me-nav button{flex:0;padding:6px 14px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:#9aa2ae;font-size:11px;cursor:pointer;font-family:inherit;transition:all .15s}
.me-nav button:hover:not(:disabled){border-color:#e8c879;color:#e8c879}
.me-nav button:disabled{opacity:.3;cursor:default}
.me-nav__dots{flex:1;display:flex;justify-content:center;gap:4px}
.me-nav__dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.15);transition:all .2s}
.me-nav__dot--active{background:#e8c879;transform:scale(1.4)}
.me-nav__info{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1}
.me-nav__counter{font-size:10px;color:#e8c879;font-weight:700;letter-spacing:.04em}

/* Markers & SVG filters */
.me-marker-pulse{animation:mePulse 2s ease-in-out infinite}
@keyframes mePulse{0%,100%{r:5;opacity:1}50%{r:8;opacity:.6}}
.me-marker-spring{animation:meSpringIn .5s cubic-bezier(.34,1.56,.64,1) both}
@keyframes meSpringIn{0%{opacity:0;transform:scale(0.3)}60%{transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
.me-marker-glow{filter:url(#me-glow)}
.me-marker-glow-strong{filter:url(#me-glow-strong)}
.me-path-draw{stroke-dasharray:var(--me-path-len,2000);stroke-dashoffset:var(--me-path-len,2000);animation:meDrawPath 1.8s cubic-bezier(.4,0,.2,1) forwards}
@keyframes meDrawPath{to{stroke-dashoffset:0}}

/* Zoom */
.me-zoom{position:absolute;top:50%;right:8px;transform:translateY(-50%);z-index:10;display:flex;flex-direction:column;gap:4px}
.me-zoom-btn{width:44px;height:44px;min-width:44px;min-height:44px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.6);color:#9aa2ae;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);transition:all .15s;font-family:inherit;line-height:1;user-select:none;-webkit-user-select:none}.me-zoom-btn:active{background:rgba(232,200,121,.2);border-color:rgba(232,200,121,.5);color:#e8c879;transform:scale(.92)}
.me-zoom-btn:hover{color:#e8c879;border-color:rgba(232,200,121,.4);background:rgba(0,0,0,.8)}

/* Tour */
.me-tour-progress{position:absolute;top:0;left:0;right:0;height:2px;z-index:30;display:none}
.me-tour-progress__fill{height:100%;background:linear-gradient(90deg,#e8c879,#e0813f,#e8c879);background-size:200% 100%;animation:meProgressFlow 1.5s linear infinite;transition:width .3s ease;width:0%;border-radius:0 2px 2px 0}

/* Share */
.me-share-btn{position:absolute;top:10px;right:10px;z-index:15;width:44px;height:44px;min-width:44px;min-height:44px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.5);color:#9aa2ae;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);transition:all .15s}
.me-share-btn:hover{color:#e8c879;border-color:rgba(232,200,121,.3)}

/* Legend */
.me-legend{position:absolute;bottom:40px;left:8px;z-index:10;padding:8px 12px;border-radius:10px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(8px);font-size:10px;display:none;cursor:pointer;max-width:180px;transition:all .25s cubic-bezier(.4,0,.2,1);overflow:hidden;max-height:32px}.me-legend--expanded{max-height:300px;background:rgba(0,0,0,.8)}
.me-legend__title{color:#e8c879;font-weight:700;margin-bottom:4px;font-size:9px;letter-spacing:.08em;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center}.me-legend__arrow{display:inline-block;font-size:7px;transition:transform .25s ease}
.me-legend__item{display:flex;align-items:center;gap:6px;color:#9aa2ae;margin:2px 0}
.me-legend__item--signature{margin-top:7px;padding-top:7px;border-top:1px solid rgba(232,200,121,.14);align-items:flex-start}
.me-legend__dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.me-legend__sig-body{min-width:0}.me-legend__sig-label{display:block;color:#e8c879;font-weight:700;font-size:10px;line-height:1.25}.me-legend__sig-desc{display:block;margin-top:3px;color:rgba(233,228,214,.72);font-size:9px;line-height:1.35}
.me-route-underlay{filter:url(#me-gold-glow);pointer-events:none;mix-blend-mode:screen}
.me-route-main{filter:url(#me-shadow);transition:opacity .4s ease,stroke-width .4s ease,filter .4s ease}
.me-route-label{font-size:8px;letter-spacing:.12em;fill:rgba(232,200,121,.72);stroke:#070a10;stroke-width:2.4;paint-order:stroke;pointer-events:none;text-transform:uppercase}
.me-signature{pointer-events:none;mix-blend-mode:screen}
.me-story-focus{fill:rgba(232,200,121,.035);stroke:rgba(232,200,121,.46);stroke-width:1.4;stroke-dasharray:9 9;vector-effect:non-scaling-stroke;filter:url(#me-gold-glow);pointer-events:none;animation:meStoryFocus 1.7s ease-out both}
@keyframes meStoryFocus{0%{opacity:0;stroke-dashoffset:42}35%{opacity:.78}100%{opacity:.38;stroke-dashoffset:0}}
.me-sig-pulse{animation:meSigPulse 2.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes meSigPulse{0%,100%{opacity:.32;transform:scale(.94)}50%{opacity:.72;transform:scale(1.08)}}
.me-sig-lamp path,.me-sig-lamp line{vector-effect:non-scaling-stroke}
.me-sig-wave{fill:none;stroke:rgba(232,200,121,.35);stroke-width:2;vector-effect:non-scaling-stroke;animation:meSigWave 3.6s ease-out infinite;transform-box:fill-box;transform-origin:center}
.me-sig-wave:nth-child(2){animation-delay:.8s}.me-sig-wave:nth-child(3){animation-delay:1.6s}
@keyframes meSigWave{0%{opacity:.55;transform:scale(.45)}100%{opacity:0;transform:scale(1.45)}}
.me-sig-water-wall{fill:rgba(74,128,168,.13);stroke:rgba(127,198,232,.42);stroke-width:2.2;vector-effect:non-scaling-stroke;filter:url(#me-glow);animation:meWaterBreathe 4.2s ease-in-out infinite}
.me-sig-water-lane{stroke:rgba(232,200,121,.55);stroke-width:2;stroke-dasharray:7 8;vector-effect:non-scaling-stroke;filter:url(#me-gold-glow);animation:meDashFlow 5s linear infinite}
@keyframes meWaterBreathe{0%,100%{opacity:.38;transform:translateX(0)}50%{opacity:.72;transform:translateX(2px)}}
@keyframes meDashFlow{to{stroke-dashoffset:-60}}
.me-sig-ship path,.me-sig-ship line{vector-effect:non-scaling-stroke}.me-sig-ship{filter:url(#me-gold-glow);opacity:.78}.me-sig-ship .sail{fill:rgba(232,200,121,.18);stroke:#e8c879;stroke-width:1.2}.me-sig-ship .hull{fill:rgba(10,13,20,.88);stroke:#e8c879;stroke-width:1.2}.me-sig-ship .wake{fill:none;stroke:rgba(127,198,232,.45);stroke-width:1.1;stroke-linecap:round}
.me-sig-menorah{filter:url(#me-gold-glow);opacity:.88}.me-sig-menorah path,.me-sig-menorah line{vector-effect:non-scaling-stroke}.me-sig-menorah .stem{stroke:#e8c879;stroke-width:1.35;fill:none;stroke-linecap:round}.me-sig-menorah .flame{fill:#ffd36a;animation:meSigPulse 2.1s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.me-sig-kingdom path{vector-effect:non-scaling-stroke}.me-sig-kingdom .north{fill:rgba(74,128,168,.08);stroke:rgba(127,198,232,.34);stroke-width:2;filter:url(#me-glow)}.me-sig-kingdom .south{fill:rgba(232,200,121,.075);stroke:rgba(232,200,121,.34);stroke-width:2;filter:url(#me-gold-glow)}.me-sig-kingdom .divide{fill:none;stroke:rgba(255,255,255,.24);stroke-width:1.5;stroke-dasharray:6 7}.me-sig-kingdom text{font-size:9px;letter-spacing:.16em;stroke:#070a10;stroke-width:2.2;paint-order:stroke}
.me-sig-cycle-ring{fill:none;stroke:rgba(232,200,121,.32);stroke-width:1.6;stroke-dasharray:5 7;vector-effect:non-scaling-stroke;animation:meSigRotate 9s linear infinite;transform-box:fill-box;transform-origin:center}.me-sig-cycle-dot{fill:#e8c879;filter:url(#me-gold-glow);animation:meSigPulse 2.4s ease-in-out infinite}@keyframes meSigRotate{to{transform:rotate(360deg)}}
.me-sig-tribe-star{fill:rgba(232,200,121,.84);stroke:#070a10;stroke-width:.8;filter:url(#me-gold-glow);animation:meSigPulse 3.4s ease-in-out infinite}.me-sig-tribe-line{stroke:rgba(232,200,121,.16);stroke-width:1;stroke-dasharray:3 6;vector-effect:non-scaling-stroke}
.me-sig-light-trail{fill:none;stroke:rgba(232,200,121,.46);stroke-width:2.4;stroke-dasharray:9 9;filter:url(#me-gold-glow);vector-effect:non-scaling-stroke;animation:meDashFlow 5s linear infinite}.me-sig-light-node{fill:rgba(232,200,121,.18);stroke:#e8c879;stroke-width:1.2;filter:url(#me-gold-glow);animation:meSigPulse 2.6s ease-in-out infinite;vector-effect:non-scaling-stroke}
.me-source-badges{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px}
.me-source-badge{font-size:8px;letter-spacing:.08em;text-transform:uppercase;border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:2px 7px;background:rgba(255,255,255,.035);color:#9aa2ae}
.me-source-badge--primary{color:#9ee7ad;border-color:rgba(74,222,128,.28);background:rgba(74,222,128,.07)}
.me-source-badge--field{color:#e8c879;border-color:rgba(232,200,121,.28);background:rgba(232,200,121,.07)}
.me-source-badge--academic{color:#9fc0dd;border-color:rgba(127,167,196,.28);background:rgba(127,167,196,.07)}
.me-source-badge--conservative{color:#d7b86b;border-color:rgba(215,184,107,.28);background:rgba(215,184,107,.07)}
.me-source-badge--heritage{color:#c7a5ff;border-color:rgba(199,165,255,.28);background:rgba(199,165,255,.06)}
.me-arch-footer{margin-top:16px;padding:12px 0;border-top:1px solid rgba(255,255,255,.06)}
.me-arch-eyebrow{font-size:10px;color:rgba(74,222,128,.7);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.me-arch-eyebrow-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:rgba(74,222,128,.5)}
.me-arch-title{font-size:13px;color:#4ade80;font-weight:700;margin-bottom:6px}
.me-arch-item{margin-bottom:8px;padding:7px 10px;border-left:2px solid rgba(74,222,128,.15);font-size:11px;line-height:1.5;background:rgba(255,255,255,.018);border-radius:0 7px 7px 0}
.me-arch-item--extra{display:none}.me-arch-footer--expanded .me-arch-item--extra{display:block}
.me-arch-text{color:#e9e4d6;margin-bottom:2px}.me-arch-meta{font-size:9px;color:rgba(154,162,174,.4);display:flex;gap:8px;flex-wrap:wrap}.me-arch-meta-mark{color:rgba(74,222,128,.5)}
.me-arch-more{margin:4px 0 0;padding:7px 12px;min-height:32px;border-radius:999px;border:1px solid rgba(74,222,128,.22);background:rgba(74,222,128,.055);color:#9ee7ad;font-size:10px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;font-family:inherit;transition:all .18s}.me-arch-more:hover{background:rgba(74,222,128,.11);border-color:rgba(74,222,128,.38)}

/* Photo modal */
.me-photo-modal{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .3s}
.me-photo-modal--open{opacity:1;pointer-events:auto}
.me-photo-modal__backdrop{position:absolute;inset:0;background:rgba(0,0,0,.92);cursor:pointer}
.me-photo-modal__close{position:absolute;top:16px;right:16px;z-index:2;width:44px;height:44px;min-width:44px;min-height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.5);color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);transition:all .15s}
.me-photo-modal__close:hover{border-color:rgba(232,200,121,.5);color:#e8c879}
.me-photo-modal__img{max-width:90vw;max-height:80vh;border-radius:8px;box-shadow:0 16px 48px rgba(0,0,0,.6);position:relative;z-index:1}
.me-photo-modal__caption{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);z-index:2;color:#9aa2ae;font-size:12px;text-align:center;max-width:80vw;background:rgba(0,0,0,.7);padding:6px 16px;border-radius:999px}
.me-photo-modal__credit{color:rgba(232,200,121,.7);font-size:10px}

/* Intro */
.me-intro{position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;transition:opacity .5s}
.me-intro__bg{position:absolute;inset:0;background:rgba(7,10,16,.95);cursor:pointer}
.me-intro__content{position:relative;z-index:1;text-align:center;padding:2rem;max-width:500px}
.me-intro__title{font-family:Georgia,serif;font-size:32px;color:#fff;margin-bottom:.5rem;line-height:1.2}
.me-intro__he{font-size:18px;color:#e8c879;letter-spacing:.15em;margin-bottom:.75rem}
.me-intro__sub{font-size:13px;color:#9aa2ae;margin-bottom:1rem}
.me-intro__stats{display:flex;gap:12px;justify-content:center;margin-bottom:1.5rem}
.me-intro__stats span{font-size:11px;color:rgba(154,162,174,.6);padding:4px 12px;border:1px solid rgba(255,255,255,.08);border-radius:999px}
.me-intro__btn{padding:10px 28px;border-radius:999px;border:1px solid #e8c879;background:rgba(232,200,121,.1);color:#e8c879;font-size:14px;cursor:pointer;font-family:inherit;transition:all .2s}
.me-intro__btn:hover{background:rgba(232,200,121,.25)}

/* Timeline */
.me-timeline{position:absolute;top:0;left:0;right:0;z-index:5;padding:4px 8px;overflow-x:auto;-webkit-overflow-scrolling:touch;background:linear-gradient(to bottom,rgba(7,10,16,.9),rgba(7,10,16,.3));pointer-events:none}
.me-timeline__track{display:flex;gap:2px;align-items:flex-start;min-width:max-content;position:relative;padding:2px 0}
.me-timeline__line{position:absolute;top:14px;left:0;right:0;height:1px;background:rgba(255,255,255,.1)}
.me-timeline__item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 10px;cursor:pointer;pointer-events:auto;transition:opacity .2s;min-width:60px}
.me-timeline__item:hover{opacity:1}
.me-timeline__item--active .me-timeline__dot{transform:scale(1.5);box-shadow:0 0 8px currentColor}
.me-timeline__dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;transition:transform .2s}
.me-timeline__era{font-size:10px;font-weight:700;color:#e9e4d6;white-space:nowrap}
.me-timeline__label{font-size:8px;color:#9aa2ae;text-align:center;line-height:1.2;max-width:80px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* Layers */
.me-layers{position:absolute;bottom:40px;right:8px;z-index:10;padding:6px 10px;border-radius:10px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(8px);font-size:10px}
.me-layers__title{color:#e8c879;font-weight:700;font-size:9px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}
.me-layers__row{display:flex;align-items:center;gap:6px;margin:3px 0}
.me-layers__dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.me-layers__name{flex:1;color:#9aa2ae;white-space:nowrap}
.me-layers__toggle{width:44px;height:44px;min-width:44px;min-height:44px;border-radius:22px;border:none;background:rgba(255,255,255,.15);cursor:pointer;position:relative;transition:background .2s;flex-shrink:0}
.me-layers__toggle::after{content:'';position:absolute;top:13px;left:5px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .2s}
.me-layers__toggle--on{background:rgba(232,200,121,.4)}
.me-layers__toggle--on::after{transform:translateX(16px)}

/* Tour caption */
.me-caption{position:absolute;bottom:50%;left:50%;transform:translate(-50%,50%);z-index:8;pointer-events:none;opacity:0;transition:opacity .4s;text-align:center}
.me-caption--visible{opacity:1}
.me-caption__stage{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#e8c879;margin-bottom:2px;text-shadow:0 0 12px rgba(0,0,0,.8)}
.me-caption__title{font-family:Georgia,serif;font-size:20px;color:#fff;text-shadow:0 0 16px rgba(0,0,0,.9);margin-bottom:6px}
.me-caption__dots{display:flex;gap:4px;justify-content:center}
.me-caption__dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.2);transition:all .3s}
.me-caption__dot--active{background:#e8c879;transform:scale(1.3)}
.me-caption__dot--past{background:rgba(232,200,121,.5)}

/* Toast */
.me-toast{position:absolute;top:60px;left:50%;transform:translate(-50%,-8px);z-index:25;padding:6px 16px;border-radius:999px;background:rgba(232,200,121,.15);border:1px solid rgba(232,200,121,.3);color:#e8c879;font-size:12px;backdrop-filter:blur(8px);opacity:0;pointer-events:none;transition:opacity .3s ease,transform .3s cubic-bezier(.34,1.56,.64,1);white-space:nowrap}
.me-toast--visible{opacity:1;transform:translate(-50%,0)}

/* v0.53 (D-3) — мобильный контракт: панель слоёв не перекрывает этап-бар,
   строка хоткеев (десктоп-сущность) скрыта на тач-экранах */
@media (max-width:560px){
  .me-layers{bottom:132px;right:6px;max-width:150px;padding:5px 8px;opacity:.94}
  .me-layers__name{white-space:normal;line-height:1.15}
  .me-shortcuts{display:none}
}

/* Minimap */
.me-minimap{position:absolute;bottom:8px;right:48px;z-index:10;width:140px;height:105px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,.1);background:rgba(7,10,16,.8);backdrop-filter:blur(8px);cursor:pointer;opacity:.7;transition:opacity .2s}
.me-minimap:hover{opacity:1}
.me-minimap svg{width:100%;height:100%}

/* Scientific variants */
.me-sci-item{padding:8px 12px;margin:6px 0;border-radius:8px;border:1px solid rgba(255,255,255,.06);font-size:12px}
.me-sci-item:hover{border-color:rgba(255,255,255,.12)}
.me-sci--consensus{border-left:3px solid rgba(74,222,128,.4)}
.me-sci--alternative{border-left:3px solid rgba(250,204,21,.3)}
.me-sci-status{font-size:9px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}
.me-sci--consensus .me-sci-status,.me-sci--primary .me-sci-status{color:rgba(74,222,128,.86)}
.me-sci--alternative .me-sci-status,.me-sci--candidate .me-sci-status{color:rgba(250,204,21,.78)}
.me-sci--caveat .me-sci-status,.me-sci--minor .me-sci-status{color:rgba(159,192,221,.78)}
.me-sci--rejected .me-sci-status{color:rgba(248,113,113,.82)}
.me-sci--primary{border-left:3px solid rgba(74,222,128,.45)}
.me-sci--candidate{border-left:3px solid rgba(250,204,21,.35)}
.me-sci--caveat{border-left:3px solid rgba(127,167,196,.35)}
.me-sci--minor{border-left:3px solid rgba(199,165,255,.3)}
.me-sci--rejected{border-left:3px solid rgba(248,113,113,.35)}
.me-sci-title{font-weight:700;color:#e9e4d6;margin-bottom:2px}
.me-sci-detail{font-size:11px;color:#9aa2ae;line-height:1.45}
.me-sci-sources{margin-top:5px;display:flex;gap:4px;flex-wrap:wrap}
.me-sci-source{font-size:8px;color:rgba(232,200,121,.65);border:1px solid rgba(232,200,121,.16);border-radius:999px;padding:1px 6px;background:rgba(232,200,121,.04)}

/* Life timeline */
.me-life{position:absolute;bottom:0;left:0;right:0;z-index:6;padding:4px 8px 6px;overflow-x:auto;-webkit-overflow-scrolling:touch;background:linear-gradient(to top,rgba(7,10,16,.95),rgba(7,10,16,.4));pointer-events:none;display:none}
.me-life__track{display:flex;gap:0;align-items:flex-start;min-width:max-content;position:relative;padding:6px 2px 2px}
.me-life__line{position:absolute;top:12px;left:0;right:0;height:2px;background:rgba(255,255,255,.06)}
.me-life__item{display:flex;flex-direction:column;align-items:center;gap:1px;padding:2px 8px;cursor:pointer;pointer-events:auto;min-width:50px;transition:all .2s;position:relative}
.me-life__item:hover{opacity:1}
.me-life__item--active .me-life__dot{transform:scale(1.8);box-shadow:0 0 12px var(--me-life-clr,#e8c879)}
.me-life__dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;transition:all .2s;position:relative;z-index:1}
.me-life__era{font-size:9px;font-weight:700;color:rgba(232,200,121,.8);white-space:nowrap;margin-top:2px}
.me-life__label{font-size:7px;color:#9aa2ae;text-align:center;line-height:1.15;max-width:70px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* Shortcuts */
.me-shortcuts{position:absolute;bottom:50px;left:50%;transform:translateX(-50%);z-index:12;padding:5px 14px;border-radius:999px;background:rgba(0,0,0,.7);color:#9aa2ae;font-size:10px;backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.06);pointer-events:none;transition:opacity .5s;white-space:nowrap}
.me-shortcuts kbd{padding:1px 5px;border-radius:4px;background:rgba(255,255,255,.1);font-family:inherit;font-size:9px;color:rgba(232,200,121,.8);margin:0 1px}

/* Theme toggle */
.me-theme-btn{position:absolute;top:10px;right:62px;z-index:15;width:44px;height:44px;min-width:44px;min-height:44px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.5);color:#9aa2ae;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);transition:all .15s}
.me-theme-btn:hover{color:#e8c879;border-color:rgba(232,200,121,.3)}

/* Progress bar */
.me-progress{position:absolute;top:0;left:0;right:0;height:2px;z-index:60;transition:opacity .4s}
.me-progress__fill{height:100%;background:linear-gradient(90deg,#e8c879,#e0813f,#e8c879);background-size:200% 100%;animation:meProgressFlow 1.5s linear infinite;width:0%;transition:width .3s}
@keyframes meProgressFlow{0%{background-position:200% 0}100%{background-position:-200% 0}}

/* Error */
.me-error{position:absolute;inset:0;z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(7,10,16,.95);color:#9aa2ae;font-family:Georgia,serif;gap:8px}
.me-error__icon{font-size:48px}
.me-error__title{font-size:16px;color:#e9e4d6}
.me-error__msg{font-size:12px}

/* Search */
.me-search{position:absolute;top:8px;right:48px;z-index:15;width:160px;padding:5px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.5);color:#e9e4d6;font-size:11px;font-family:inherit;backdrop-filter:blur(8px);outline:none;transition:border-color .2s}
.me-search:focus{border-color:rgba(232,200,121,.4);width:200px}
.me-search::placeholder{color:rgba(154,162,174,.5)}

/* Loading */
.me-loading{position:absolute;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(7,10,16,.9);transition:opacity .3s;gap:12px}
.me-loading__spinner{width:24px;height:24px;border:2px solid rgba(255,255,255,.08);border-top-color:#e8c879;border-right-color:rgba(232,200,121,.3);border-radius:50%;animation:meSpin .8s linear infinite, meSpinnerPulse 2s ease-in-out infinite}@keyframes meSpinnerPulse{0%,100%{box-shadow:0 0 0 0 rgba(232,200,121,0)}50%{box-shadow:0 0 12px 2px rgba(232,200,121,.15)}}
@keyframes meSpin{to{transform:rotate(360deg)}}
.me-loading__text{color:#9aa2ae;font-size:11px}

/* Media queries */
@media(min-width:640px){
  .me-title{font-size:28px}
  .me-panel{left:12px;right:auto;bottom:12px;width:420px;border-radius:14px;border:1px solid rgba(232,200,121,.2);transform:translateX(-120%)}
  .me-panel--open{transform:translateX(0)}
  .me-header{padding:16px 20px}
  .me-life{display:block}
  .me-panel__resize{display:block}
  .me-minimap{width:170px;height:128px;bottom:12px;right:60px}
  .me-intro__title{font-size:38px}
  .me-intro__he{font-size:20px}
  .me-legend{display:block}
}
/* Respect reduced-motion preference (a11y): disable decorative animations
   so the map stays fully usable without vestibular triggers. Pan/zoom and
   all interactive behaviour remain functional — only transitions/animations
   are neutralised. */
@media(prefers-reduced-motion:reduce){
  .me-map *,.me-map *::before,.me-map *::after{
    animation-duration:.001ms !important;
    animation-iteration-count:1 !important;
    transition-duration:.001ms !important;
    scroll-behavior:auto !important;
  }
  .me-canvas,.me-canvas svg{will-change:auto}
}

      `;
      document.head.appendChild(css);
    }

    // Build DOM
    container.innerHTML='';
    container.className='me-map';
    
    const canvas=document.createElement('div');canvas.className='me-canvas';
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    
    // SVG layers
    const bgRect=document.createElementNS('http://www.w3.org/2000/svg','rect');
    bgRect.setAttribute('x','-400');bgRect.setAttribute('y','-400');bgRect.setAttribute('width','2700');bgRect.setAttribute('height','2230');
    bgRect.setAttribute('fill','#0d1d2e');bgRect.setAttribute('opacity','0.4');
    svg.appendChild(bgRect);

    // SVG defs — glow filters, gradients
    const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');
    defs.innerHTML=`
      <filter id="me-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.5" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
      <filter id="me-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 .6 0" result="color"/>
        <feComposite in="SourceGraphic" in2="color" operator="over"/>
      </filter>
      <filter id="me-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.5"/>
      </filter>
      <filter id="me-gold-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feColorMatrix in="blur" type="matrix" values="0.91 0 0 0 0  0.78 0 0 0 0  0.47 0 0 0 0  0 0 0 0.7 0" result="gold"/>
        <feComposite in="SourceGraphic" in2="gold" operator="over"/>
      </filter>
      <radialGradient id="me-marker-grad">
        <stop offset="0%" stop-color="#fff" stop-opacity="1"/>
        <stop offset="40%" stop-color="#e8c879" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#e8c879" stop-opacity="0"/>
      </radialGradient>
    `;
    // Arrowhead markers for stage paths
    STAGE_COLORS.forEach((clr,i) => {
      const marker = document.createElementNS('http://www.w3.org/2000/svg','marker');
      marker.setAttribute('id','me-arrow-'+i);
      marker.setAttribute('markerWidth','10');marker.setAttribute('markerHeight','8');
      marker.setAttribute('refX','9');marker.setAttribute('refY','4');
      marker.setAttribute('orient','auto');
      marker.innerHTML = `<path d="M0,0 L10,4 L0,8 L3,4 Z" fill="${clr}" opacity="0.7"/>`;
      defs.appendChild(marker);
    });
    svg.appendChild(defs);

    const pathsG=document.createElementNS('http://www.w3.org/2000/svg','g');pathsG.id='me-paths';svg.appendChild(pathsG);
    const waypointsG=document.createElementNS('http://www.w3.org/2000/svg','g');waypointsG.id='me-waypoints';svg.appendChild(waypointsG);
    let signatureG=document.createElementNS('http://www.w3.org/2000/svg','g');signatureG.id='me-signature';svg.appendChild(signatureG);
    const storyFocusG=document.createElementNS('http://www.w3.org/2000/svg','g');storyFocusG.id='me-story-focus';svg.appendChild(storyFocusG);
    const markersG=document.createElementNS('http://www.w3.org/2000/svg','g');markersG.id='me-markers';svg.appendChild(markersG);
    const ctxG=document.createElementNS('http://www.w3.org/2000/svg','g');ctxG.id='me-ctx';svg.appendChild(ctxG);
    canvas.appendChild(svg);
    container.appendChild(canvas);

    // Compass rose
    if (opts.showCompass !== false) {
      const compass = document.createElementNS('http://www.w3.org/2000/svg','g');
      compass.setAttribute('transform', 'translate(50, 80)');
      compass.style.opacity = '0.5';
      compass.style.pointerEvents = 'none';
      compass.innerHTML = `
        <circle cx="0" cy="0" r="24" fill="rgba(7,10,16,.6)" stroke="rgba(255,255,255,.1)" stroke-width="0.8"/>
        <circle cx="0" cy="0" r="20" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="0.5"/>
        <circle cx="0" cy="0" r="16" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="0.3"/>
        <!-- Tick marks every 30 degrees -->
        ${Array.from({length:12},(_,i)=>`<line x1="${Math.sin(i*Math.PI/6)*18}" y1="${-Math.cos(i*Math.PI/6)*18}" x2="${Math.sin(i*Math.PI/6)*20}" y2="${-Math.cos(i*Math.PI/6)*20}" stroke="${i%3===0?'rgba(232,200,121,.4)':'rgba(255,255,255,.1)'}" stroke-width="${i%3===0?'1':'0.4'}"/>`).join('')}
        <text x="0" y="-10" text-anchor="middle" fill="#e8c879" font-size="10" font-weight="700">N</text>
        <text x="0" y="20" text-anchor="middle" fill="rgba(255,255,255,.25)" font-size="7">S</text>
        <text x="14" y="4" text-anchor="middle" fill="rgba(255,255,255,.25)" font-size="7">E</text>
        <text x="-14" y="4" text-anchor="middle" fill="rgba(255,255,255,.25)" font-size="7">W</text>
        <line x1="0" y1="-7" x2="0" y2="7" stroke="#e8c879" stroke-width="1"/>
        <line x1="-7" y1="0" x2="7" y2="0" stroke="rgba(255,255,255,.25)" stroke-width="0.5"/>
        <polygon points="0,-16 -3.5,-7 0,-8 3.5,-7" fill="#e8c879" opacity="0.85"/>
        <polygon points="0,16 -3.5,7 0,8 3.5,7" fill="rgba(255,255,255,.15)"/>
      `;
      compass.setAttribute('id','me-compass');
      compass.style.transition = 'transform .3s ease-out';
      svg.appendChild(compass);
    }


    // Header
    const header=document.createElement('div');header.className='me-header';
    const headerLeft=document.createElement('div');
    const backLink=document.createElement('a');backLink.className='me-back';backLink.href=opts.backUrl||'/karty/';backLink.textContent='← Карты';
    const titleEl=document.createElement('div');titleEl.className='me-title';titleEl.textContent=route.meta?.title||'';
    headerLeft.appendChild(backLink);headerLeft.appendChild(titleEl);
    if(route.meta?.title_he){const he=document.createElement('div');he.className='me-title-he';he.textContent=route.meta.title_he;headerLeft.appendChild(he)}
    if(route.meta?.subtitle){const sub=document.createElement('div');sub.className='me-subtitle';sub.textContent=route.meta.subtitle;headerLeft.appendChild(sub)}
    header.appendChild(headerLeft);
    
    const storiesBar=document.createElement('div');storiesBar.className='me-stories';
    header.appendChild(storiesBar);
    // Search input
const searchInput=document.createElement('input');searchInput.className='me-search';searchInput.type='text';searchInput.placeholder='Поиск места…';searchInput.setAttribute('aria-label','Поиск места на карте');searchInput.setAttribute('role','searchbox');
let searchTimer = null;
_on(searchInput,'input',()=>{
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const q = searchInput.value.toLowerCase().trim();
    const allG = markersG.querySelectorAll('g[transform]');
    if (!q) {
      const visibleIds = new Set(visiblePlaces().map(p => p.id));
      allG.forEach(g => {
        const placeId = g.getAttribute('data-place-id');
        g.style.opacity = !placeId || visibleIds.has(placeId) ? '1' : '.15';
      });
      return;
    }
    let matchCount = 0;
    allG.forEach(g => {
      const placeId = g.getAttribute('data-place-id');
      const text = g.querySelector('text');
      let match = false;
      if (text && text.textContent && text.textContent.toLowerCase().includes(q)) match = true;
      if (!match) {
        if (placeId) {
          const place = (route.places||[]).find(p => p.id === placeId);
          if (place) {
            const haystack = [place.story, place.bible, place.arch, place.kick, place.id1, place.id2].join(' ').toLowerCase();
            if (haystack.includes(q)) match = true;
          }
        }
      }
      g.style.opacity = match ? '1' : '.08';
      // Highlight matching text in label
      if (match && q.length >= 2) {
        const labelEl = g.querySelector('text');
        if (labelEl) {
          labelEl.setAttribute('fill', '#e8c879');
          labelEl.setAttribute('font-weight', '700');
          _tm(() => {
            const markerStillInStory = !placeId || visiblePlaces().some(p => p.id === placeId);
            labelEl.setAttribute('fill', markerStillInStory ? '#f4eedd' : '#555');
            labelEl.setAttribute('font-weight','');
          }, 3000);
        }
      }
      if (match) matchCount++;
      // Pulse the dot of matching marker
      const dot = g.querySelector('circle:nth-child(3)');
      if (dot && match) {
        dot.style.transition = 'r .15s cubic-bezier(.34,1.56,.64,1)';
        dot.setAttribute('r', '7');
        setTimeout(() => { if(dot) { dot.setAttribute('r','4.5'); dot.style.transition = 'r .2s ease, fill .2s ease, filter .2s ease'; } }, 400);
      }
    });
    // Show match count (was: at handler entry; crashed: q not in scope here)
    if (q) {
      const mc = markersG.querySelectorAll('g[transform]').length;
      let visibleCount = 0;
      markersG.querySelectorAll('g[transform]').forEach(g => {
        if (g.style.opacity !== '0.08' && g.style.opacity !== '.08') visibleCount++;
      });
      if (visibleCount > 0 && visibleCount < mc) {
        showToast('Найдено: ' + visibleCount, 1500);
      }
    }
  }, 200);
});
header.appendChild(searchInput);
container.appendChild(header);

    // Theme toggle
    const themeBtn = document.createElement('button');
    themeBtn.className = 'me-theme-btn';
    themeBtn.title = 'Сменить тему';
    themeBtn.textContent = '🌙';
    themeBtn.setAttribute('aria-label', 'Переключить тему');
    let isDark = true;
    themeBtn.addEventListener('click', () => {
      isDark = !isDark;
      themeBtn.textContent = isDark ? '🌙' : '☀️';
      if (isDark) {
        container.style.setProperty('--me-bg','#070a10');
        container.style.setProperty('--me-panel-bg','rgba(13,17,26,.95)');
        container.style.setProperty('--me-text','#e9e4d6');
        container.style.setProperty('--me-gold','#e8c879');
      } else {
        container.style.setProperty('--me-bg','#f5f0e8');
        container.style.setProperty('--me-panel-bg','rgba(255,252,245,.97)');
        container.style.setProperty('--me-text','#3a2f1f');
        container.style.setProperty('--me-gold','#b8860b');
      }
      showToast(isDark ? 'Тёмная тема' : 'Светлая тема', 1200);
    });
    header.appendChild(themeBtn);

// Share button
const shareBtn=document.createElement('button');shareBtn.className='me-share-btn';shareBtn.title='Поделиться';shareBtn.textContent='↗';
_on(shareBtn,'click',()=>{
  const st=getState();
  const url=buildMapStateUrl(location,st);
  if(navigator.share)navigator.share({title:document.title,url}).catch(()=>navigator.clipboard?.writeText(url));
  else navigator.clipboard?.writeText(url).then(()=>{
    showToast('Ссылка скопирована');shareBtn.textContent='✓';setTimeout(()=>shareBtn.textContent='↗',1500);
  });
});
header.appendChild(shareBtn);

    // Toast notification
    const toastEl = document.createElement('div');
    toastEl.className = 'me-toast';
    container.appendChild(toastEl);
    function showToast(msg, duration = 2000) {
      toastEl.textContent = msg;
      toastEl.classList.add('me-toast--visible');
      clearTimeout(toastEl._timeout);
      toastEl._timeout = setTimeout(() => toastEl.classList.remove('me-toast--visible'), duration);
    }

    // Stage dots
    const stagesBar=document.createElement('div');stagesBar.className='me-stages';
    container.appendChild(stagesBar);


    // Timeline bar
    if ((route.stages||[]).length > 1) {
      const timelineWrap = document.createElement('div');
      timelineWrap.className = 'me-timeline';
      const timelineTrack = document.createElement('div');
      timelineTrack.className = 'me-timeline__track';
      timelineTrack.innerHTML = '<span class="me-timeline__line"></span>';
      (route.stages||[]).forEach((st, i) => {
        const item = document.createElement('div');
        item.className = 'me-timeline__item';
        item.innerHTML = `<span class="me-timeline__dot" style="background:${STAGE_COLORS[i]}"></span><span class="me-timeline__era">${esc(st.n)}</span><span class="me-timeline__label">${esc(st.age||st.t||'')}</span>`;
        item.addEventListener('click', () => {
          const place = (route.places||[]).find(p => p.stage === i && visiblePlaces().some(v => v.id === p.id));
          if (place) open(place.id);
          // Highlight clicked
          timelineTrack.querySelectorAll('.me-timeline__item').forEach(el => el.classList.remove('me-timeline__item--active'));
          item.classList.add('me-timeline__item--active');
        });
        timelineTrack.appendChild(item);
      });
      timelineWrap.appendChild(timelineTrack);
      container.appendChild(timelineWrap);
    }


    // Life Timeline (bottom)
    if (route.timeline && route.timeline.length > 0) {
      const lifeWrap = document.createElement('div');
      lifeWrap.className = 'me-life';
      const lifeTrack = document.createElement('div');
      lifeTrack.className = 'me-life__track';
      lifeTrack.innerHTML = '<span class="me-life__line"></span>';
      
      route.timeline.forEach((item, i) => {
        const div = document.createElement('div');
        div.className = 'me-life__item';
        const clr = item.color || STAGE_COLORS[item.stage||0] || STAGE_COLORS[0];
        div.style.setProperty('--me-life-clr', clr);
        div.innerHTML = `<span class="me-life__dot" style="background:${clr}"></span><span class="me-life__era">${esc(item.era||'')}</span><span class="me-life__label">${esc(item.label||'')}</span>`;
        div.addEventListener('click', () => {
          const place = (route.places||[]).find(p => p.stage === item.stage && visiblePlaces().some(v => v.id === p.id));
          if (place) open(place.id);
          lifeTrack.querySelectorAll('.me-life__item').forEach(el => el.classList.remove('me-life__item--active'));
          div.classList.add('me-life__item--active');
        });
        lifeTrack.appendChild(div);
      });
      lifeWrap.appendChild(lifeTrack);
      container.appendChild(lifeWrap);
    }
  
    // Zoom controls
    const zoomControls=document.createElement('div');zoomControls.className='me-zoom';
    zoomControls.innerHTML='<button class="me-zoom-btn" data-zoom="in" title="Приблизить">+</button><button class="me-zoom-btn" data-zoom="out" title="Отдалить">−</button><button class="me-zoom-btn" data-zoom="reset" title="Сбросить">⌂</button><button class="me-zoom-btn" id="me-ruler-btn" title="Измерить расстояние" style="font-size:12px">⟍</button>';
    container.appendChild(zoomControls);
    // Zoom with hold-to-repeat
    let zoomRepeatTimer = null;
    let suppressZoomClickUntil = 0;
    function zoomOnce(dir) {
      const cx=view.x+view.w/2,cy=view.y+view.h/2;
      const nw=dir==='in'?Math.max(cfg.minW,view.w*0.85):Math.min(cfg.maxW,view.w*1.15);
      flyTo(cx,cy,nw,150);
    }
    function startZoomRepeat(dir) {
      zoomOnce(dir);
      zoomRepeatTimer = setInterval(() => zoomOnce(dir), 120);
    }
    function stopZoomRepeat() { if (zoomRepeatTimer) { clearInterval(zoomRepeatTimer); zoomRepeatTimer = null; } }
    ['in','out'].forEach(dir => {
      const btn = zoomControls.querySelector('[data-zoom='+dir+']');
      if (!btn) return;
      _on(btn, 'mousedown', (e) => { e.preventDefault(); suppressZoomClickUntil=Date.now()+800; startZoomRepeat(dir); });
      _on(btn, 'mouseup', stopZoomRepeat);
      _on(btn, 'mouseleave', stopZoomRepeat);
      _on(btn, 'touchstart', (e) => { e.preventDefault(); suppressZoomClickUntil=Date.now()+800; startZoomRepeat(dir); });
      _on(btn, 'touchend', stopZoomRepeat);
      _on(btn, 'click', (e) => {
        e.preventDefault();
        if(Date.now()<suppressZoomClickUntil)return;
        zoomOnce(dir);
      });
    });
    _on(zoomControls.querySelector('[data-zoom=reset]'),'click',()=>{
      const initVp=route.meta?.viewport_init||{cx:cfg.W0/2,cy:cfg.H0/2,w:cfg.W0};
      flyTo(initVp.cx,initVp.cy,initVp.w,500);
    });

    // Scale bar
    const scaleBar2 = document.createElement('div');
    scaleBar2.style.cssText = 'position:absolute;bottom:22px;right:60px;z-index:10;display:flex;align-items:center;gap:6px;pointer-events:none';
    scaleBar2.innerHTML = '<div id="me-scale-line" style="height:4px;background:rgba(255,255,255,.3);border-radius:2px;transition:width .3s ease;min-width:40px"></div><span id="me-scale-label" style="font-size:9px;color:rgba(255,255,255,.4);white-space:nowrap"></span>';
    container.appendChild(scaleBar2);
    function updateScaleBar() {
      const pxPerKm = 1 / cfg.kmPerUnit;
      const screenPxPerKm = (cfg.W0 / view.w) * pxPerKm;
      let km = 200;
      while (km * screenPxPerKm > 180 && km > 3) { km /= 2; }
      while (km * screenPxPerKm < 40 && km < 3200) { km *= 2; }
      const barW = Math.round(km * screenPxPerKm);
      const lineEl = document.getElementById('me-scale-line');
      const labelEl = document.getElementById('me-scale-label');
      if (lineEl) lineEl.style.width = barW + 'px';
      if (labelEl) labelEl.textContent = km + ' km';
    }

    // Panel backdrop
    const panelBackdrop=document.createElement('div');panelBackdrop.className='me-panel__backdrop';
    panelBackdrop.addEventListener('click', ()=>{ close(); });
    container.appendChild(panelBackdrop);
    
    // Panel
    const panel=document.createElement('div');panel.className='me-panel';
    panel.innerHTML='<button class="me-panel__close">×</button><button class="me-panel__scroll-top" style="display:none;position:absolute;top:10px;right:44px;z-index:5;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#9aa2ae;font-size:14px;cursor:pointer;padding:3px 7px;line-height:1">↑</button><div class="me-panel__resize"></div><div class="me-tour-progress" id="me-tour-bar"><div class="me-tour-progress__fill"></div><div id="me-tour-speed" style="display:none;position:absolute;top:4px;right:8px;display:none;gap:4px"><button id="me-tour-faster" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:4px;color:#9aa2ae;font-size:10px;cursor:pointer;padding:1px 6px">▶▶</button><button id="me-tour-slower" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:4px;color:#9aa2ae;font-size:10px;cursor:pointer;padding:1px 6px">▶</button></div></div><div class="me-panel__head"></div><div class="me-tabs"></div><div class="me-content"></div><div class="me-nav"></div>';
    // Scroll-to-top button logic
    const scrollTopBtn = panel.querySelector('.me-panel__scroll-top');
    const contentEl = panel.querySelector('.me-content');
    if (scrollTopBtn && contentEl) {
      scrollTopBtn.addEventListener('click', () => { contentEl.scrollTo({top:0, behavior:'smooth'}); });
      const origShowScroll = () => {
        if (contentEl.scrollTop > 200) { scrollTopBtn.style.display = 'block'; }
        else { scrollTopBtn.style.display = 'none'; }
      };
      contentEl.addEventListener('scroll', origShowScroll);
    }
    // Panel resize (desktop sidebar)
    const resizeHandle = panel.querySelector('.me-panel__resize');
    let resizing = false;
    let resizeStartX = 0;
    let panelStartWidth = 0;
    if (resizeHandle) {
      resizeHandle.addEventListener('pointerdown', e => {
        e.preventDefault();
        resizeHandle.setPointerCapture(e.pointerId);
        resizing = true;
        resizeStartX = e.clientX;
        panelStartWidth = panel.offsetWidth;
        document.body.style.userSelect = 'none';
      });
      // Use _on() so document-level listeners are tracked and cleaned up by _cleanupAll()
      // (avoids the only real listener leak: document.pointermove/pointerup during panel resize)
      _on(document, 'pointermove', e => {
        if (!resizing) return;
        const dx = resizeStartX - e.clientX;
        const newWidth = clamp(panelStartWidth + dx, 280, 700);
        panel.style.width = newWidth + 'px';
      });
      _on(document, 'pointerup', () => {
        if (resizing) {
          resizing = false;
          document.body.style.userSelect = '';
          // Save panel width
          try {
            localStorage.setItem('me-panel-width-' + (route.meta?.id || 'map'), panel.style.width);
          } catch(e) {}
        }
      });
      // Restore saved panel width
      try {
        const saved = localStorage.getItem('me-panel-width-' + (route.meta?.id || 'map'));
        if (saved) panel.style.width = saved;
      } catch(e) {}
    }
    // Legend
const legend=document.createElement('div');legend.className='me-legend';
const legendItems=(route.stages||[]).map((st,i)=>`<div class="me-legend__item"><span class="me-legend__dot" style="background:${STAGE_COLORS[i]}"></span>${st.t||''}</div>`).join('');
const sigLegend=route.signature?`<div class="me-legend__item me-legend__item--signature me-signature-note" data-signature-note="${esc(route.signature.type||'')}"><span class="me-legend__dot" style="background:#e8c879;box-shadow:0 0 8px rgba(232,200,121,.55)"></span><span class="me-legend__sig-body"><span class="me-legend__sig-label">${esc(route.signature.label||'Сигнатура карты')}</span>${route.signature.description?`<span class="me-legend__sig-desc">${esc(route.signature.description)}</span>`:''}</span></div>`:'';
legend.innerHTML=`<div class="me-legend__title">Этапы <span class="me-legend__arrow">▾</span></div>${legendItems}${sigLegend}`;
// Legend arrow rotation on expand
const legendArrow = legend.querySelector('.me-legend__arrow');
const legendObserver = new MutationObserver(() => {
  if (legendArrow) {
    legendArrow.style.transform = legend.classList.contains('me-legend--expanded') ? 'rotate(180deg)' : 'rotate(0deg)';
    legendArrow.style.transition = 'transform .25s ease';
  }
});
legendObserver.observe(legend, { attributes: true, attributeFilter: ['class'] });
container.appendChild(legend);
container.appendChild(panel);

    // Minimap (if opts.showMinimap)
    if (opts.showMinimap) {
      const mm = document.createElement('div');
      mm.className = 'me-minimap';
      mm.innerHTML = '<svg viewBox="0 0 1900 1430" preserveAspectRatio="xMidYMid meet"><rect x="0" y="0" width="1900" height="1430" fill="rgba(7,10,16,.6)" stroke="rgba(255,255,255,.15)" stroke-width="2"/><g id="me-mm-dots"></g><rect id="me-mm-rect" fill="rgba(232,200,121,.08)" stroke="rgba(232,200,121,.4)" stroke-width="1" rx="4" style="transition: all .2s ease"/></svg>';
      // Add place dots to minimap
      const mmDots = mm.querySelector('#me-mm-dots');
      (route.places||[]).forEach(place => {
        const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
        dot.setAttribute('cx', place.x);
        dot.setAttribute('cy', place.y);
        dot.setAttribute('r', '2.5');
        dot.setAttribute('fill', STAGE_COLORS[place.stage||0]||'#888');
        dot.setAttribute('opacity', '0.7');
        mmDots.appendChild(dot);
      });
      container.appendChild(mm);
      // Click minimap to navigate
      mm.addEventListener('click', (e) => {
        const svgEl = mm.querySelector('svg');
        if (!svgEl) return;
        const rect = svgEl.getBoundingClientRect();
        const scX = 1900 / rect.width;
        const scY = 1430 / rect.height;
        const mx = (e.clientX - rect.left) * scX;
        const my = (e.clientY - rect.top) * scY;
        flyTo(mx, my, view.w);
        haptic();
      });
      
      function updateMinimap() {
        const mmRect = mm.querySelector('#me-mm-rect');
        if (!mmRect) return;
        mmRect.setAttribute('x', view.x);
        mmRect.setAttribute('y', view.y);
        mmRect.setAttribute('width', view.w);
        mmRect.setAttribute('height', view.h);
      }
      
      // Update minimap on view change (call after flyTo/pan/zoom)
      const origFlyTo = flyTo;
      flyTo = function(cx, cy, w, duration) {
        const result = origFlyTo(cx, cy, w, duration);
        updateMinimap();
        return result;
      };
    }

    // Layer toggles
    {
      const layerData = [...(opts.layers || route.layers || [])];
      if (route.signature && route.signature.type) {
        layerData.push({ id:'signature', label: route.signature.label || 'Сигнатура', color:'#e8c879', on:true, selector:'#me-signature', pathSelector:'#me-signature' });
      }
      if (layerData.length) {
      const layerPanel = document.createElement('div');
      layerPanel.className = 'me-layers';
      layerPanel.innerHTML = '<div class="me-layers__title">Слои</div>';
      layerData.forEach((layer, i) => {
        const row = document.createElement('div');
        row.className = 'me-layers__row';
        row.setAttribute('data-layer-id', layer.id || '');
        const color = layer.color || STAGE_COLORS[i] || '#888';
        row.innerHTML = `<span class="me-layers__dot" style="background:${color}"></span><span class="me-layers__name">${esc(layer.label||layer.id||'')}</span>`;
        const toggle = document.createElement('button');
        toggle.className = `me-layers__toggle${layer.on !== false ? ' me-layers__toggle--on' : ''}`;
        toggle.setAttribute('aria-label', `Переключить слой ${layer.label||layer.id}`);
        toggle.addEventListener('click', () => {
          const isOn = toggle.classList.toggle('me-layers__toggle--on');
          // Apply opacity to all markers with matching layer
          const selector = layer.selector || `[data-layer="${layer.id}"]`;
          try {
            const elements = svg.querySelectorAll(selector);
            elements.forEach(el => {
              el.style.transition = 'opacity .35s ease';
              el.style.opacity = isOn ? '1' : '0.15';
            });
          } catch(e) {}
          showToast((layer.label||layer.id) + (isOn ? ' показан' : ' скрыт'), 1200);
          // Also toggle path visibility
          if (layer.pathSelector) {
            try {
              const paths = svg.querySelectorAll(layer.pathSelector);
              paths.forEach(p => { p.style.display = isOn ? '' : 'none'; });
            } catch(e) {}
          }
        });
        row.appendChild(toggle);
        layerPanel.appendChild(row);
      });
      container.appendChild(layerPanel);
      }
    }


    // Toggle legend on click
    _on(legend,'click', () => {
      legend.classList.toggle('me-legend--expanded');
    });


    // ── State helpers ──
    function visiblePlaces(){
      const story=(route.stories||[]).find(s=>s.id===activeStoryId);
      if(!story||!(story.places||story.place_ids))return route.places||[];
      const ids=new Set(story.places||story.place_ids||[]);
      return (route.places||[]).filter(p=>ids.has(p.id));
    }
    function getActivePlace(){return activePlaceId?(route.places||[]).find(p=>p.id===activePlaceId)||null:null}
    function placeIndexInStory(){
      const v=visiblePlaces();
      return activePlaceId?v.findIndex(p=>p.id===activePlaceId):-1;
    }

    // ── SVG rendering ──
    function applyViewBox(){
      svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
      // Parallax compass tilt
      const compass = document.getElementById('me-compass');
      if (compass) {
        const tiltX = (view.x / cfg.W0 - 0.5) * 3;
        compass.style.transform = `rotate(${tiltX.toFixed(1)}deg)`;
      }
      // Update scale bar
      if (typeof updateScaleBar === 'function') updateScaleBar();
      // Update minimap viewport rect (if minimap exists)
      const mmRect = document.getElementById('me-mm-rect');
      if (mmRect) {
        mmRect.setAttribute('x', view.x);
        mmRect.setAttribute('y', view.y);
        mmRect.setAttribute('width', view.w);
        mmRect.setAttribute('height', view.h);
      }
    }

    function renderMarkers(){
      markersG.innerHTML='';
      waypointsG.innerHTML='';
      signatureG.innerHTML='';
      storyFocusG.innerHTML='';
      pathsG.innerHTML='';
      // CTX (context) markers
      const ctxG = document.getElementById('me-ctx');
      if (ctxG) ctxG.innerHTML = '';
      (route.ctx||[]).forEach(ctx => {
        if (!ctxG) return;
        const g = document.createElementNS('http://www.w3.org/2000/svg','g');
        g.setAttribute('transform', `translate(${ctx.x},${ctx.y})`);
        g.setAttribute('data-layer', 'ctx');
        g.setAttribute('opacity', '0.4');
        const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
        circle.setAttribute('r', '2.5');
        circle.setAttribute('fill', '#9aa2ae');
        circle.setAttribute('stroke', 'transparent');
        g.appendChild(circle);
        if (ctx.name || ctx.label) {
          const text = document.createElementNS('http://www.w3.org/2000/svg','text');
          text.setAttribute('x', '6'); text.setAttribute('y', '2.5');
          text.setAttribute('fill', '#9aa2ae'); text.setAttribute('font-size', '7');
          text.setAttribute('font-style', 'italic');
          text.textContent = ctx.name || ctx.label || '';
          g.appendChild(text);
        }
        ctxG.appendChild(g);
      });

      const vis=visiblePlaces();
      const visIds=new Set(vis.map(p=>p.id));
      const allPlaces=route.places||[];

      // Stage paths
      const stagePaths=Array.from({length:(route.stages||[]).length},()=>[]);
      allPlaces.forEach(p=>{
        if(!Number.isInteger(p.stage)||p.stage<0||p.stage>=stagePaths.length)return;
        stagePaths[p.stage].push(p);
      });
      stagePaths.forEach((places,i)=>{
        if(places.length<2)return;
        const d=places.map((p,j)=>`${j===0?'M':'L'}${p.x},${p.y}`).join(' ');
        const color=STAGE_COLORS[i]||STAGE_COLORS[0];
        const under=document.createElementNS('http://www.w3.org/2000/svg','path');
        under.setAttribute('d',d);under.setAttribute('fill','none');under.setAttribute('stroke',color);
        under.setAttribute('stroke-width','9');under.setAttribute('stroke-linecap','round');under.setAttribute('stroke-linejoin','round');under.setAttribute('opacity','0.11');under.setAttribute('data-stage',String(i));under.setAttribute('data-route-kind','underlay');under.setAttribute('class','me-route-underlay');
        pathsG.appendChild(under);
        const path=document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d',d);path.setAttribute('fill','none');path.setAttribute('stroke',color);
        path.setAttribute('stroke-width','3');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');path.setAttribute('opacity','0.5');path.setAttribute('marker-end','url(#me-arrow-'+i+')');path.setAttribute('data-stage',String(i));path.setAttribute('data-route-kind','main');path.setAttribute('class','me-route-main');
        path.setAttribute('stroke-dasharray',path.getTotalLength());path.setAttribute('stroke-dashoffset',path.getTotalLength());
        path.style.transition = 'stroke-dashoffset 1.5s '+(i*0.3)+'s cubic-bezier(.4,0,.2,1), opacity .4s ease, stroke-width .4s ease, filter .4s ease';
        pathsG.appendChild(path);
        if(places.length>=2){
          const mid=places[Math.floor(places.length/2)];
          const label=document.createElementNS('http://www.w3.org/2000/svg','text');
          label.setAttribute('x',String(mid.x+10));label.setAttribute('y',String(mid.y-10));label.setAttribute('class','me-route-label');label.setAttribute('data-stage',String(i));label.textContent=(route.stages?.[i]?.n||(''+(i+1)));
          pathsG.appendChild(label);
        }
        requestAnimationFrame(() => { path.style.strokeDashoffset = '0'; });
      });

      // Waypoints
      (route.verified_waypoints||[]).forEach(wp=>{
        const g=document.createElementNS('http://www.w3.org/2000/svg','g');
        g.setAttribute('transform',`translate(${wp.x},${wp.y})`);g.setAttribute('data-layer','wp');g.setAttribute('opacity','0.4');
        const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('r','3');c.setAttribute('fill','#e8c879');
        g.appendChild(c);
        const t=document.createElementNS('http://www.w3.org/2000/svg','text');t.setAttribute('x','8');t.setAttribute('y','3');
        t.setAttribute('fill','#9aa2ae');t.setAttribute('font-size','7');t.textContent=wp.name||'';
        g.appendChild(t);
        waypointsG.appendChild(g);
      });
      // Dashed connection lines between waypoints
      const wps = route.verified_waypoints||[];
      if (wps.length >= 2) {
        const wpD = wps.map((wp,j) => `${j===0?'M':'L'}${wp.x},${wp.y}`).join(' ');
        const wpLine = document.createElementNS('http://www.w3.org/2000/svg','path');
        wpLine.setAttribute('d', wpD);
        wpLine.setAttribute('fill', 'none');
        wpLine.setAttribute('stroke', 'rgba(232,200,121,.25)');
        wpLine.setAttribute('stroke-dasharray', '4 6');
        wpLine.setAttribute('stroke-width', '1.2');
        wpLine.setAttribute('opacity', '0.5');
        waypointsG.appendChild(wpLine);
      }

      function renderSignatureOverlay() {
        const sig = route.signature;
        if (!sig || !sig.type) {
          signatureG.removeAttribute('data-signature-kind');
          signatureG.removeAttribute('aria-label');
          return;
        }
        signatureG.setAttribute('data-signature-kind', sig.type);
        signatureG.setAttribute('aria-label', sig.label || sig.type);
        const placesById = new Map((route.places || []).map(p => [p.id, p]));
        if (sig.type === 'lampstands') {
          const ids = sig.place_ids || (route.places || []).map(p => p.id);
          ids.map(id => placesById.get(id)).filter(Boolean).forEach((place) => {
            const g = document.createElementNS('http://www.w3.org/2000/svg','g');
            g.setAttribute('class','me-signature me-sig-lamp');
            g.setAttribute('transform',`translate(${place.x},${place.y - 18})`);
            g.setAttribute('data-signature','lampstands');
            const glow = document.createElementNS('http://www.w3.org/2000/svg','circle');
            glow.setAttribute('class','me-sig-pulse'); glow.setAttribute('r','22'); glow.setAttribute('fill','rgba(232,200,121,.11)'); glow.setAttribute('stroke','rgba(232,200,121,.18)'); glow.setAttribute('stroke-width','1');
            g.appendChild(glow);
            const stem = document.createElementNS('http://www.w3.org/2000/svg','line');
            stem.setAttribute('x1','0'); stem.setAttribute('y1','-11'); stem.setAttribute('x2','0'); stem.setAttribute('y2','10'); stem.setAttribute('stroke','#e8c879'); stem.setAttribute('stroke-width','1.4'); stem.setAttribute('stroke-linecap','round');
            g.appendChild(stem);
            const base = document.createElementNS('http://www.w3.org/2000/svg','path');
            base.setAttribute('d','M-8,10 H8 M-5,14 H5'); base.setAttribute('stroke','#e8c879'); base.setAttribute('stroke-width','1.2'); base.setAttribute('stroke-linecap','round'); base.setAttribute('fill','none');
            g.appendChild(base);
            const cup = document.createElementNS('http://www.w3.org/2000/svg','path');
            cup.setAttribute('d','M-8,-4 C-5,-12 5,-12 8,-4 M-8,-4 C-4,0 4,0 8,-4'); cup.setAttribute('stroke','#f6d98a'); cup.setAttribute('stroke-width','1.1'); cup.setAttribute('fill','none'); cup.setAttribute('stroke-linecap','round');
            g.appendChild(cup);
            const flame = document.createElementNS('http://www.w3.org/2000/svg','path');
            flame.setAttribute('class','me-sig-pulse'); flame.setAttribute('d','M0,-19 C5,-13 3,-8 0,-6 C-3,-8 -5,-13 0,-19 Z'); flame.setAttribute('fill','#ffd36a'); flame.setAttribute('opacity','.85');
            g.appendChild(flame);
            signatureG.appendChild(g);
          });
        } else if (sig.type === 'water-split') {
          const origin = placesById.get(sig.origin || sig.origin_id || 'pihahiroth') || (route.places || [])[0];
          if (!origin) return;
          const g = document.createElementNS('http://www.w3.org/2000/svg','g');
          g.setAttribute('class','me-signature'); g.setAttribute('data-signature','water-split');
          const left = document.createElementNS('http://www.w3.org/2000/svg','path');
          left.setAttribute('class','me-sig-water-wall'); left.setAttribute('d',`M${origin.x-74},${origin.y-86} C${origin.x-118},${origin.y-45} ${origin.x-104},${origin.y+42} ${origin.x-64},${origin.y+88} C${origin.x-38},${origin.y+46} ${origin.x-42},${origin.y-40} ${origin.x-74},${origin.y-86} Z`);
          g.appendChild(left);
          const right = document.createElementNS('http://www.w3.org/2000/svg','path');
          right.setAttribute('class','me-sig-water-wall'); right.setAttribute('d',`M${origin.x+74},${origin.y-86} C${origin.x+118},${origin.y-45} ${origin.x+104},${origin.y+42} ${origin.x+64},${origin.y+88} C${origin.x+38},${origin.y+46} ${origin.x+42},${origin.y-40} ${origin.x+74},${origin.y-86} Z`);
          g.appendChild(right);
          const lane = document.createElementNS('http://www.w3.org/2000/svg','path');
          lane.setAttribute('class','me-sig-water-lane'); lane.setAttribute('d',`M${origin.x},${origin.y-92} C${origin.x-12},${origin.y-36} ${origin.x+10},${origin.y+34} ${origin.x},${origin.y+96}`); lane.setAttribute('fill','none');
          g.appendChild(lane);
          signatureG.appendChild(g);
        } else if (sig.type === 'sea-voyage') {
          const ids = sig.place_ids || [];
          const pts = ids.map(id => placesById.get(id)).filter(Boolean);
          pts.slice(0,-1).forEach((a,idx) => {
            const b = pts[idx+1];
            const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
            const g = document.createElementNS('http://www.w3.org/2000/svg','g');
            g.setAttribute('class','me-signature me-sig-ship'); g.setAttribute('transform',`translate(${x},${y-12})`); g.setAttribute('data-signature','sea-voyage');
            const wake = document.createElementNS('http://www.w3.org/2000/svg','path'); wake.setAttribute('class','wake'); wake.setAttribute('d','M-18,12 C-8,7 8,17 18,12'); g.appendChild(wake);
            const hull = document.createElementNS('http://www.w3.org/2000/svg','path'); hull.setAttribute('class','hull'); hull.setAttribute('d','M-14,6 L14,6 L8,14 L-8,14 Z'); g.appendChild(hull);
            const mast = document.createElementNS('http://www.w3.org/2000/svg','line'); mast.setAttribute('x1','0'); mast.setAttribute('y1','6'); mast.setAttribute('x2','0'); mast.setAttribute('y2','-16'); mast.setAttribute('stroke','#e8c879'); mast.setAttribute('stroke-width','1.2'); g.appendChild(mast);
            const sail = document.createElementNS('http://www.w3.org/2000/svg','path'); sail.setAttribute('class','sail'); sail.setAttribute('d','M0,-15 L0,4 L12,2 Z M0,-13 L0,3 L-10,1 Z'); g.appendChild(sail);
            signatureG.appendChild(g);
          });
        } else if (sig.type === 'hanukkah-lights') {
          const origin = placesById.get(sig.origin || sig.origin_id || 'jerusalem_meet') || (route.places || [])[0];
          if (!origin) return;
          const g = document.createElementNS('http://www.w3.org/2000/svg','g');
          g.setAttribute('class','me-signature me-sig-menorah'); g.setAttribute('transform',`translate(${origin.x},${origin.y-38})`); g.setAttribute('data-signature','hanukkah-lights');
          const base = document.createElementNS('http://www.w3.org/2000/svg','path'); base.setAttribute('class','stem'); base.setAttribute('d','M-30,32 H30 M-18,38 H18 M0,32 V2'); g.appendChild(base);
          [-28,-21,-14,-7,0,7,14,21,28].forEach((x,i)=>{ const arm=document.createElementNS('http://www.w3.org/2000/svg','path'); arm.setAttribute('class','stem'); const top=i===4?-12:0; arm.setAttribute('d',`M0,12 C${x/2},12 ${x},${top+8} ${x},${top}`); g.appendChild(arm); const fl=document.createElementNS('http://www.w3.org/2000/svg','path'); fl.setAttribute('class','flame'); fl.setAttribute('d',`M${x},${top-12} C${x+5},${top-6} ${x+3},${top-2} ${x},${top} C${x-3},${top-2} ${x-5},${top-6} ${x},${top-12} Z`); fl.style.animationDelay=(i*.18)+'s'; g.appendChild(fl); });
          signatureG.appendChild(g);
        } else if (sig.type === 'split-kingdom') {
          const north = (sig.north_ids || []).map(id => placesById.get(id)).filter(Boolean);
          const south = (sig.south_ids || []).map(id => placesById.get(id)).filter(Boolean);
          const hull = (pts, cls) => {
            if (!pts.length) return;
            let minX=Math.min(...pts.map(p=>p.x))-38, maxX=Math.max(...pts.map(p=>p.x))+38, minY=Math.min(...pts.map(p=>p.y))-34, maxY=Math.max(...pts.map(p=>p.y))+34;
            const path=document.createElementNS('http://www.w3.org/2000/svg','path'); path.setAttribute('class',cls); path.setAttribute('d',`M${minX},${minY} C${(minX+maxX)/2},${minY-22} ${maxX},${minY+8} ${maxX},${(minY+maxY)/2} C${maxX},${maxY+20} ${minX},${maxY+14} ${minX},${(minY+maxY)/2} Z`); signatureG.appendChild(path);
          };
          const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('class','me-signature me-sig-kingdom'); g.setAttribute('data-signature','split-kingdom'); signatureG.appendChild(g); const oldSig=signatureG; signatureG=g;
          hull(north,'north'); hull(south,'south');
          const div=document.createElementNS('http://www.w3.org/2000/svg','path'); div.setAttribute('class','divide'); div.setAttribute('d',sig.divide || 'M628,650 C646,715 626,760 638,830'); g.appendChild(div);
          const tn=document.createElementNS('http://www.w3.org/2000/svg','text'); tn.setAttribute('x','668'); tn.setAttribute('y','705'); tn.setAttribute('fill','#7fc6e8'); tn.textContent='יִשְׂרָאֵל'; g.appendChild(tn);
          const ts=document.createElementNS('http://www.w3.org/2000/svg','text'); ts.setAttribute('x','586'); ts.setAttribute('y','828'); ts.setAttribute('fill','#e8c879'); ts.textContent='יְהוּדָה'; g.appendChild(ts);
          signatureG=oldSig;
        } else if (sig.type === 'judge-cycles') {
          const ids = sig.place_ids || [];
          ids.map(id => placesById.get(id)).filter(Boolean).forEach((place,idx)=>{
            const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('class','me-signature'); g.setAttribute('transform',`translate(${place.x},${place.y})`); g.setAttribute('data-signature','judge-cycles');
            const r=document.createElementNS('http://www.w3.org/2000/svg','circle'); r.setAttribute('class','me-sig-cycle-ring'); r.setAttribute('r','24'); r.style.animationDelay=(idx*.35)+'s'; g.appendChild(r);
            const d=document.createElementNS('http://www.w3.org/2000/svg','circle'); d.setAttribute('class','me-sig-cycle-dot'); d.setAttribute('cx','0'); d.setAttribute('cy','-24'); d.setAttribute('r','3'); d.style.animationDelay=(idx*.2)+'s'; g.appendChild(d);
            signatureG.appendChild(g);
          });
        } else if (sig.type === 'tribe-stars') {
          const ids = sig.place_ids || (route.places||[]).map(p=>p.id);
          const pts = ids.map(id => placesById.get(id)).filter(Boolean);
          if (pts.length>1) {
            const line=document.createElementNS('http://www.w3.org/2000/svg','path'); line.setAttribute('class','me-sig-tribe-line'); line.setAttribute('fill','none'); line.setAttribute('d',pts.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ')); signatureG.appendChild(line);
          }
          pts.forEach((p,idx)=>{ const star=document.createElementNS('http://www.w3.org/2000/svg','path'); star.setAttribute('class','me-signature me-sig-tribe-star'); star.setAttribute('data-signature','tribe-stars'); star.setAttribute('d',`M${p.x},${p.y-8} L${p.x+2.2},${p.y-2.2} L${p.x+8},${p.y} L${p.x+2.2},${p.y+2.2} L${p.x},${p.y+8} L${p.x-2.2},${p.y+2.2} L${p.x-8},${p.y} L${p.x-2.2},${p.y-2.2} Z`); star.style.animationDelay=(idx*.12)+'s'; signatureG.appendChild(star); });
        } else if (sig.type === 'ministry-light') {
          const ids = sig.place_ids || [];
          const pts = ids.map(id => placesById.get(id)).filter(Boolean);
          if (pts.length>1) { const line=document.createElementNS('http://www.w3.org/2000/svg','path'); line.setAttribute('class','me-signature me-sig-light-trail'); line.setAttribute('data-signature','ministry-light'); line.setAttribute('d',pts.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ')); signatureG.appendChild(line); }
          pts.forEach((p,idx)=>{ const node=document.createElementNS('http://www.w3.org/2000/svg','circle'); node.setAttribute('class','me-signature me-sig-light-node'); node.setAttribute('data-signature','ministry-light'); node.setAttribute('cx',p.x); node.setAttribute('cy',p.y); node.setAttribute('r',idx===0||idx===pts.length-1?'16':'11'); node.style.animationDelay=(idx*.22)+'s'; signatureG.appendChild(node); });
        } else if (sig.type === 'gospel-waves') {
          const origin = placesById.get(sig.origin || sig.origin_id || 'jerusalem_upper') || (route.places || [])[0];
          if (!origin) return;
          const g = document.createElementNS('http://www.w3.org/2000/svg','g');
          g.setAttribute('class','me-signature'); g.setAttribute('transform',`translate(${origin.x},${origin.y})`); g.setAttribute('data-signature','gospel-waves');
          [38,76,114].forEach(r => { const c=document.createElementNS('http://www.w3.org/2000/svg','circle'); c.setAttribute('class','me-sig-wave'); c.setAttribute('r',String(r)); g.appendChild(c); });
          const dot=document.createElementNS('http://www.w3.org/2000/svg','circle'); dot.setAttribute('r','5'); dot.setAttribute('fill','#e8c879'); dot.setAttribute('filter','url(#me-gold-glow)'); g.appendChild(dot);
          signatureG.appendChild(g);
        }
      }
      function renderStoryFocus() {
        const story = (route.stories || []).find(s => s.id === activeStoryId);
        if (!story || story.id === 'main') return;
        const pts = visiblePlaces().filter(p => isFinite(p.x) && isFinite(p.y));
        if (!pts.length) return;
        const pad = pts.length > 1 ? 54 : 72;
        const minX = Math.min(...pts.map(p => p.x)) - pad;
        const maxX = Math.max(...pts.map(p => p.x)) + pad;
        const minY = Math.min(...pts.map(p => p.y)) - pad;
        const maxY = Math.max(...pts.map(p => p.y)) + pad;
        const halo = document.createElementNS('http://www.w3.org/2000/svg','rect');
        halo.setAttribute('class','me-story-focus');
        halo.setAttribute('data-story-focus', story.id);
        halo.setAttribute('x', String(minX));
        halo.setAttribute('y', String(minY));
        halo.setAttribute('width', String(Math.max(36, maxX - minX)));
        halo.setAttribute('height', String(Math.max(36, maxY - minY)));
        halo.setAttribute('rx', '28');
        storyFocusG.appendChild(halo);
      }
      renderSignatureOverlay();
      renderStoryFocus();

      // Place markers
      allPlaces.forEach(place=>{
        const inStory=visIds.has(place.id);
        const isActive=place.id===activePlaceId;
        const color=STAGE_COLORS[place.stage]||STAGE_COLORS[0];
        const g=document.createElementNS('http://www.w3.org/2000/svg','g');
        g.setAttribute('transform',`translate(${place.x},${place.y})`);
        g.setAttribute('data-place-id', place.id);
        g.setAttribute('data-layer', `stage-${place.stage||0}`);
        g.setAttribute('data-layer-main', '');
        if (place.type) g.setAttribute('data-layer', `${g.getAttribute('data-layer')} ${place.type}`);
        g.style.cursor=inStory?'pointer':'default';
        g.addEventListener('mouseenter',()=>{if(inStory){const d=g.querySelector('circle:nth-child(3)');if(d){d.setAttribute('r','6');d.setAttribute('filter','url(#me-gold-glow)');}const r2=g.querySelector('circle:nth-child(2)');if(r2){r2.setAttribute('opacity','0.6');r2.setAttribute('r','14');}}});
        g.addEventListener('mouseleave',()=>{const d=g.querySelector('circle:nth-child(3)');if(d){d.setAttribute('r',(place.id===activePlaceId)?'7':'4.5');d.setAttribute('filter',(place.id===activePlaceId)?'url(#me-glow-strong)':'url(#me-shadow)');}const r2=g.querySelector('circle:nth-child(2)');if(r2){r2.setAttribute('opacity',(place.id===activePlaceId)?'0.5':'0');r2.setAttribute('r','12');}});
        g.style.opacity=inStory?'1':'.15';
        if(inStory){
              // Long-press detection for quick info tooltip
      let longPressTimer = null;
      let longPressFired = false;
      g.addEventListener('pointerdown', (e) => {
        longPressFired = false;
        longPressTimer = _tm(() => {
          longPressFired = true;
          haptic(30);
          // Show quick info tooltip
          const tooltip = document.createElement('div');
          tooltip.style.cssText = 'position:absolute;z-index:50;padding:8px 14px;border-radius:10px;background:rgba(7,10,16,.92);border:1px solid rgba(232,200,121,.3);color:#e9e4d6;font-size:12px;backdrop-filter:blur(12px);pointer-events:none;white-space:nowrap;text-align:center;transition:opacity .2s;opacity:0';
          const stage = (route.stages||[])[place.stage||0];
          tooltip.innerHTML = '<div style="font-weight:700;color:#e8c879;margin-bottom:3px">'+esc(place.name)+'</div><div style="font-size:10px;color:#9aa2ae">'+esc(place.id1||'')+'</div>'+(stage?'<div style="font-size:10px;color:#9aa2ae">'+esc(stage.n||'')+' · '+esc(stage.t||'')+'</div>':'');
          container.appendChild(tooltip);
          const r = canvas.getBoundingClientRect();
          const sc = r.width / view.w;
          const sx = r.left + (place.x - view.x) * sc;
          const sy = r.top + (place.y - view.y) * sc;
          tooltip.style.left = Math.min(sx + 24, r.right - 180) + 'px';
          tooltip.style.top = Math.max(sy - 60, 10) + 'px';
          requestAnimationFrame(() => { tooltip.style.opacity = '1'; });
          _tm(() => { tooltip.style.opacity = '0'; _tm(() => tooltip.remove(), 300); }, 2000);
        }, 500);
      });
      g.addEventListener('pointerup', () => { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } });
      g.addEventListener('pointerleave', () => { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } });
      g.addEventListener('click',()=>{if(longPressFired){longPressFired=false;return;}haptic();addRipple(svg,place.x,place.y,STAGE_COLORS[place.stage]);const d2=g.querySelector('circle:nth-child(3)');if(d2){d2.style.transition='transform .15s cubic-bezier(.34,1.56,.64,1)';d2.style.transform='scale(1.4)';_tm(()=>{d2.style.transform='scale(1)';_tm(()=>{d2.style.transition='r .2s ease, fill .2s ease, filter .2s ease';},160);},160);}open(place.id);});
        g.addEventListener('dblclick',(e)=>{e.preventDefault();e.stopPropagation();flyTo(place.x,place.y,Math.min(view.w,450),600);});
      }
        
        const hit=document.createElementNS('http://www.w3.org/2000/svg','circle');hit.setAttribute('r','20');hit.setAttribute('fill','transparent');hit.setAttribute('stroke','transparent');hit.setAttribute('stroke-width','8');
        g.appendChild(hit);
        // Outer ring for active state
        const ring=document.createElementNS('http://www.w3.org/2000/svg','circle');
        ring.setAttribute('r','12');ring.setAttribute('fill','none');
        ring.setAttribute('stroke',color);ring.setAttribute('stroke-width','1.5');
        ring.setAttribute('opacity',isActive?'0.5':'0');
        ring.setAttribute('filter','url(#me-glow)');
        ring.style.transition = 'opacity .3s ease, r .3s ease';
        g.appendChild(ring);
        // Stage number badge
        if (typeof place.stage === 'number' && inStory) {
          const badge = document.createElementNS('http://www.w3.org/2000/svg','circle');
          badge.setAttribute('r','8');badge.setAttribute('fill','none');
          badge.setAttribute('stroke',color);badge.setAttribute('stroke-width','1');
          badge.setAttribute('opacity','0.4');badge.setAttribute('stroke-dasharray','2 3');
          badge.style.pointerEvents = 'none';
          g.appendChild(badge);
        }
        const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
        const isCand = place.type === 'cand';
        dot.setAttribute('r',isActive?'7':'4.5');dot.setAttribute('fill',isActive?'#fff':color);
        if (isCand) {
          dot.setAttribute('stroke-dasharray','3 2');
          dot.setAttribute('fill',isActive?'#fff':'none');
          dot.setAttribute('stroke-width','2');
        }
        dot.setAttribute('stroke',isActive?color:'#0b0f16');dot.setAttribute('stroke-width','2.5');
        dot.setAttribute('filter',isActive?'url(#me-glow-strong)':'url(#me-shadow)');
        dot.classList.add('me-marker-spring');
        dot.style.transition = 'r .2s ease, fill .2s ease, filter .2s ease';
        g.appendChild(dot);
        
        // Label-модель v2 (§11 P-8): 8 якорей place.labelAnchor (e/w/n/s/ne/nw/se/sw)
        // + выноска place.leader {dx,dy}. Legacy: side 'l'→'w', 'r'/умолчание→'e';
        // авто-сдвиг соседей действует только для legacy-мест без labelAnchor.
        const side=place.side||'r';
        const anchor=place.labelAnchor||(side==='l'?'w':'e');
        const labelText = place.name||'';
        const fontSize=10;
        const textWidth=labelText.length*fontSize*0.6;
        const ANCHOR_POS={
          e:{x:14,y:4,ta:'start'},   w:{x:-14,y:4,ta:'end'},
          n:{x:0,y:-12,ta:'middle'}, s:{x:0,y:20,ta:'middle'},
          ne:{x:10,y:-8,ta:'start'}, nw:{x:-10,y:-8,ta:'end'},
          se:{x:10,y:16,ta:'start'}, sw:{x:-10,y:16,ta:'end'}
        };
        const ap=ANCHOR_POS[anchor]||ANCHOR_POS.e;
        let lx=ap.x, ly=ap.y;
        if (!place.labelAnchor) {
          // legacy-коллизия: сосед на той же стороне → сдвиг вниз
          const nearbyLabels = allPlaces.filter(op =>
            op.id !== place.id && !op.labelAnchor &&
            Math.abs(op.x - place.x) < 100 &&
            Math.abs(op.y - place.y) < 16 &&
            (op.side||'r') === side
          );
          if (nearbyLabels.length > 0) ly += 12;
        }
        if (place.leader && typeof place.leader.dx==='number') {
          lx += place.leader.dx; ly += place.leader.dy;
          // тонкая выноска: от кромки маркера к ближнему краю текста;
          // микро-смещения (<10u) — без линии, чтобы не плодить шум
          if (Math.hypot(place.leader.dx, place.leader.dy) > 10) {
          const exEdge = ap.ta==='end' ? lx+3 : ap.ta==='middle' ? lx : lx-3;
          const eyEdge = ly-4;
          const dLen = Math.hypot(exEdge,eyEdge)||1;
          const r0 = (isActive?7:4.5)+2;
          const leaderLine=document.createElementNS('http://www.w3.org/2000/svg','line');
          leaderLine.setAttribute('x1',String(exEdge/dLen*r0));
          leaderLine.setAttribute('y1',String(eyEdge/dLen*r0));
          leaderLine.setAttribute('x2',String(exEdge));
          leaderLine.setAttribute('y2',String(eyEdge));
          leaderLine.setAttribute('stroke','rgba(244,238,221,.38)');
          leaderLine.setAttribute('stroke-width','1');
          leaderLine.setAttribute('opacity',inStory?'0.9':'0');
          leaderLine.style.transition='opacity .3s';
          leaderLine.style.pointerEvents='none';
          leaderLine.classList.add('me-leader');
          g.appendChild(leaderLine);
          }
        }
        // Label background for readability — следует за текстом при любом якоре
        const bgX = ap.ta==='end' ? lx-textWidth-3 : ap.ta==='middle' ? lx-textWidth/2-3 : lx-3;
        const labelBg=document.createElementNS('http://www.w3.org/2000/svg','rect');
        labelBg.setAttribute('x',String(bgX));
        labelBg.setAttribute('y',String(ly-11));
        labelBg.setAttribute('width',textWidth+6);
        labelBg.setAttribute('height','14');
        labelBg.setAttribute('rx','3');
        labelBg.setAttribute('fill','rgba(7,10,16,.75)');
        labelBg.setAttribute('stroke','rgba(255,255,255,.06)');
        labelBg.setAttribute('stroke-width','0.5');
        labelBg.setAttribute('opacity',inStory?'0.85':'0');
        labelBg.style.transition = 'opacity .3s';
        labelBg.style.pointerEvents = 'none';
        g.appendChild(labelBg);
        const label=document.createElementNS('http://www.w3.org/2000/svg','text');
        label.setAttribute('x',String(lx));
        label.setAttribute('y',String(ly));
        label.setAttribute('text-anchor',ap.ta);
        label.setAttribute('fill',inStory?'#f4eedd':'#555');
        label.setAttribute('font-size',String(fontSize));
        label.setAttribute('opacity','0.9');
        label.style.transition = 'opacity .3s';
        label.textContent=labelText;
        g.appendChild(label);
        markersG.appendChild(g);
      });
    }



    // ── Panel rendering ──
    function renderPanel(){
      const place=getActivePlace();
      if(!place)return;
      const head=panel.querySelector('.me-panel__head');
      const tabsEl=panel.querySelector('.me-tabs');
      const content=panel.querySelector('.me-content');
      const nav=panel.querySelector('.me-nav');
      const vis=visiblePlaces();
      const idx=placeIndexInStory();
      const stage=route.stages&&place.stage>=0?route.stages[place.stage]:null;

      // Check available tabs
      const availTabs=TAB_KEYS.filter(k=>{
        if(k==='bible')return!!place.bible;
        if(k==='arch')return!!place.arch;
        if(k==='he')return!!place.he_deep;
        if(k==='dispute')return!!place.dispute;
        if(k==='sci')return!!(route.scientific_variants||route.variants||{})[place.id];
        if(k==='photos')return!!(place.photos&&place.photos.length);
        if(k==='extra')return!!place.bible_extra;
        return k==='story';
      });
      const activeTab=availTabs[0]; // default to first available

      // Head
      head.innerHTML=`
        <div class="me-panel__stage"><span class="me-panel__stage-dot" style="background:${STAGE_COLORS[place.stage]||STAGE_COLORS[0]}"></span>Этап ${(place.stage||0)+1} · ${esc(place.id2||'')}</div>
        <div class="me-panel__name">${esc(place.name)}</div>
        ${place.he?`<div class="me-panel__he">${esc(place.he)}</div>`:''}
        ${place.kick?`<div class="me-panel__kick">${esc(place.kick)}</div>`:''}
        <div class="me-panel__meta">
          ${place.id1?`<span>${esc(place.id1)}</span>`:''}
          ${place.ep1?`<span>${esc(place.ep1)}</span>`:''}
          ${stage?`<span style="border-color:${STAGE_COLORS[place.stage]||STAGE_COLORS[0]};color:${STAGE_COLORS[place.stage]||STAGE_COLORS[0]}">${esc(stage.n||'')}</span>`:''}
          ${place.dispute?`<span style="border-color:rgba(207,128,112,.5);color:#cf8070">⚡ дискуссия</span>`:''}
          ${place.photos&&place.photos.length?`<span>📷 ${place.photos.length}</span>`:''}
        </div>`;

      // Tabs
      tabsEl.innerHTML=availTabs.map(k=>`<button class="me-tab${k===activeTab?' me-tab--active':''}" data-tab="${k}">${TAB_LABELS[k]||k}</button>`).join('');
      tabsEl.querySelectorAll('.me-tab').forEach(btn=>{
        btn.addEventListener('click',()=>{
          tabsEl.querySelectorAll('.me-tab').forEach(b=>b.classList.remove('me-tab--active'));
          btn.classList.add('me-tab--active');
          renderTabContent(btn.dataset.tab||'story',place);
        });
      });

      // Content
      renderTabContent(activeTab,place);

      // Nav
      const totalInStory=vis.length;
    const counterText=idx>=0?`${idx+1} / ${totalInStory}`:'';
    nav.innerHTML=`
        <button ${idx<=0?'disabled':''} id="me-prev" title="${idx>0?esc(vis[idx-1].name):''}">←</button>
        <div class="me-nav__info"><span class="me-nav__counter">${idx+1} / ${vis.length}</span><div class="me-nav__dots">${vis.map((p,i)=>`<div class="me-nav__dot${i===idx?' me-nav__dot--active':''}"></div>`).join('')}</div></div>
        <button ${idx>=vis.length-1?'disabled':''} id="me-next" title="${idx<vis.length-1?esc(vis[idx+1].name):''}">→</button>
      `;
      // Related places
      const relatedIds = place.related||[];
      if (relatedIds.length > 0) {
        const relatedPlaces = relatedIds.map(rid => (route.places||[]).find(p => p.id === rid)).filter(Boolean);
        if (relatedPlaces.length > 0) {
          const relatedHtml = relatedPlaces.map(rp => {
            const rc = STAGE_COLORS[rp.stage||0]||STAGE_COLORS[0];
            return `<span class="me-related-chip" data-pid="${esc(rp.id)}" style="display:inline-block;padding:3px 10px;margin:2px 4px;border-radius:999px;border:1px solid ${rc};color:${rc};font-size:10px;cursor:pointer;transition:all .15s">${esc(rp.name)}</span>`;
          }).join('');
          const relatedSection = document.createElement('div');
          relatedSection.style.cssText = 'padding:8px 16px;border-top:1px solid rgba(255,255,255,.06)';
          relatedSection.innerHTML = '<div style="font-size:9px;color:rgba(154,162,174,.5);margin-bottom:4px">Связанные места</div>' + relatedHtml;
          nav.parentNode.insertBefore(relatedSection, nav);
          // Wire up clicks
          relatedSection.querySelectorAll('.me-related-chip').forEach(chip => {
            chip.addEventListener('mouseenter', function(){this.style.background='rgba(255,255,255,.05)';});
            chip.addEventListener('mouseleave', function(){this.style.background='';});
            chip.addEventListener('click', () => {
              const pid = chip.dataset.pid;
              if (pid && pid !== activePlaceId) open(pid);
            });
          });
        }
      }
      nav.querySelector('#me-prev')?.addEventListener('click',()=>{if(idx>0)open(vis[idx-1].id)});
      nav.querySelector('#me-next')?.addEventListener('click',()=>{if(idx<vis.length-1)open(vis[idx+1].id)});
      // Clickable nav dots
      nav.querySelectorAll('.me-nav__dot').forEach((dot,i) => {
        dot.style.cursor = 'pointer';
        dot.addEventListener('click', () => { if (i !== idx) open(vis[i].id); });
      });
    }

    function _variantMeta(status='') {
      const map = {
        consensus: {cls:'me-sci--consensus', label:'Основная версия'},
        primary: {cls:'me-sci--primary', label:'Основная'},
        candidate: {cls:'me-sci--candidate', label:'Кандидат'},
        alternative: {cls:'me-sci--alternative', label:'Альтернатива'},
        caveat: {cls:'me-sci--caveat', label:'Оговорка'},
        minor: {cls:'me-sci--minor', label:'Меньшинств.'},
        rejected: {cls:'me-sci--rejected', label:'Отвергнуто'}
      };
      return map[status] || {cls:'', label: status || 'вариант'};
    }

    function _variantSources(v) {
      const raw = v.sources || v.source || v.src || '';
      if (!raw) return '';
      const parts = Array.isArray(raw) ? raw : String(raw).split(/[;·]/).map(x => x.trim()).filter(Boolean);
      return `<div class="me-sci-sources">${parts.slice(0,4).map(x => `<span class="me-sci-source">${esc(x)}</span>`).join('')}</div>`;
    }

    function renderTabContent(tab,place){
      const content=panel.querySelector('.me-content');
      content.style.opacity='0';content.style.transform='translateX(4px)';content.style.transition='opacity .18s ease, transform .22s cubic-bezier(.4,0,.2,1)';
      requestAnimationFrame(() => { content.style.opacity='1';content.style.transform='translateX(0)'; });
      const map={story:place.story,bible:place.bible,arch:place.arch,he:place.he_deep,dispute:place.dispute,extra:place.bible_extra};
      if(tab==='sci'){
        const variants = route.scientific_variants||route.variants||{};
        const rows = variants[place.id];
        if (rows) {
          content.innerHTML = rows.map(v => {
            const meta = _variantMeta(v.status);
            const detail = v.detail || v.note || v.text || '';
            return `<div class="me-sci-item ${meta.cls}">
              <div class="me-sci-status">${esc(meta.label)}</div>
              <div class="me-sci-title">${esc(v.title)}</div>
              ${detail?`<div class="me-sci-detail">${esc(detail)}</div>`:''}
              ${_variantSources(v)}
            </div>`;
          }).join('');
        }
      }else if(tab==='photos'&&place.photos){
        const photos = place.photos;
        if (photos.length <= 1) {
          content.innerHTML = photos.map(ph=>`
            <div><img src="${esc(ph.thumb||ph.src)}" alt="${esc(ph.alt||ph.label||'')}" loading="lazy" class="me-clickable-photo" data-src="${esc(ph.src||'')}" data-label="${esc(ph.label||'')}" data-credit="${esc(ph.credit||'')}">
            <div class="me-photo-label">${esc(ph.label||'')} · ${esc(ph.credit||'')}</div></div>
          `).join('');
          // Wire up click-to-enlarge
          content.querySelectorAll('.me-clickable-photo').forEach(img => {
            img.style.cursor = 'pointer';
            img.addEventListener('click', () => {
              const src = img.dataset.src;
              const label = img.dataset.label;
              const credit = img.dataset.credit;
              if (src) openPhoto(src, label, credit);
            });
          });
        } else {
          // Multi-photo gallery with dots
          const photosHtml = photos.map((ph,i) => `
            <div class="me-photo-slide" style="display:${i===0?'block':'none'}">
              <img src="${esc(ph.thumb||ph.src)}" alt="${esc(ph.alt||ph.label||'')}" loading="lazy">
              <div class="me-photo-label">${esc(ph.label||'')} · ${esc(ph.credit||'')}</div>
            </div>`).join('');
          const dotsHtml = photos.map((_,i) => `
            <span class="me-photo-dot${i===0?' me-photo-dot--active':''}" data-idx="${i}"></span>`).join('');
          content.innerHTML = `
            <div class="me-photo-gallery">${photosHtml}</div>
            <div class="me-photo-nav">${dotsHtml}</div>`;
          // Wire up dot clicks
          content.querySelectorAll('.me-photo-dot').forEach(dot => {
            dot.addEventListener('click', () => {
              const idx = parseInt(dot.dataset.idx);
              content.querySelectorAll('.me-photo-slide').forEach((s,i) => s.style.display = i===idx?'block':'none');
              content.querySelectorAll('.me-photo-dot').forEach((d,i) => d.classList.toggle('me-photo-dot--active', i===idx));
            });
          });
        }
      }else if(map[tab]){
        content.innerHTML=map[tab];
      }else{
        content.innerHTML='';
      }
      // Add archaeology reference footer for relevant places
      _renderArchaeologyFooter(place);
    }

    function _classifySource(item) {
      const hay = `${item.ref || ''} ${item.src || ''}`.toLowerCase();
      if (/papyrus|inscription|stele|bulla|tablet|cylinder|ostraca|coin|scroll|siloam|pilate stone|tel dan/.test(hay)) return {kind:'primary',label:'первичный'};
      if (/excavation|dig|mission|iaa|survey|field|shiloh|pool|gate|tunnel|stratigraphy/.test(hay)) return {kind:'field',label:'раскопки'};
      if (/university|journal|pnas|bar |bas |biblical archaeology society|atiqot|hebrew university|tel aviv/.test(hay)) return {kind:'academic',label:'научн.'};
      if (/abr|associates for biblical research|aig|answers|creation|bible archaeology report|bibleplaces|base institute/.test(hay)) return {kind:'conservative',label:'консерв.'};
      return {kind:'heritage',label:'heritage'};
    }

    function _sourceBadges(items) {
      const seen = new Map();
      (items || []).forEach(item => {
        const cls = _classifySource(item);
        if (!seen.has(cls.kind)) seen.set(cls.kind, cls.label);
      });
      return [...seen.entries()].slice(0,4).map(([kind,label]) => `<span class="me-source-badge me-source-badge--${kind}">${label}</span>`).join('');
    }

    function _renderArchaeologyFooter(place) {
      // Determine which archaeology category this place belongs to
      let cat = null;
      // Exodus places
      const exodusIds = ['rameses','succoth','etham','pihahiroth','migdol','marah','elim','rephidim','sinai','kadesh','eziongeber'];
      if (exodusIds.includes(place.id)) cat = 'exodus_route';
      // Jerusalem/Temple/David
      const jerusalemIds = ['jerusalem','jerusalem_kings','cityofdavid','temple','hebron','lachish','beersheba'];
      if (jerusalemIds.includes(place.id)) cat = 'jerusalem_first_temple';
      // Maccabees
      const maccabeeIds = ['modiin','jerusalem_meet','antioch_syria','betzecharia','bethzur','emmaus','elasa'];
      if (maccabeeIds.includes(place.id)) cat = 'maccabees';
      // Early Church
      const churchIds = ['jerusalem_upper','temple_early','damascus','antioch','ephesus','laodicea','philadelphia','sardis','thyatira','smyrna','pergamos','philippi','corinth','athens','thessaloniki','capernaum','bethsaida'];
      if (churchIds.includes(place.id)) cat = 'early_church';
      // Judges
      const judgesIds = ['shiloh','timnath','gaza','ashkelon','ashdod','ekron','gath','hazor','bethel','shechem'];
      if (judgesIds.includes(place.id)) cat = 'judges_period';
      // Kings
      const kingsIds = ['samaria','megiddo','jezreel','dan','beersheba','hazor','lachish'];
      if (kingsIds.includes(place.id)) cat = 'kings_period';
      // Jesus ministry
      const jesusIds = ['nazareth','capernaum','magdala','bethlehem','jericho','jerusalem','bethany','cana','tabgha','bethebara'];
      if (jesusIds.includes(place.id)) cat = 'jesus_ministry';
      // Dead Sea Scrolls
      const dssIds = ['qumran','masada','jericho'];
      if (dssIds.includes(place.id)) cat = 'dead_sea_scrolls';
      // Babylonian exile
      const exileIds = ['babylon','jerusalem','lachish','azekah'];
      if (exileIds.includes(place.id) && !cat) cat = 'babylonian_exile';
      // Persian return
      const persianIds = ['jerusalem','babylon','elephantine'];
      if (persianIds.includes(place.id) && !cat) cat = 'persian_return';
      // Jericho/Ai
      const conquestIds = ['jericho','ai','gai','hazor','gilgal'];
      if (conquestIds.includes(place.id) && !cat) cat = 'jericho_ai';
      // Davidic
      const davidIds = ['jerusalem','hebron','bethlehem'];
      if (davidIds.includes(place.id) && !cat) cat = 'davidic_kingdom';
      
      if (cat && ARCHAEOLOGY_REFERENCES[cat]) {
        const refs = ARCHAEOLOGY_REFERENCES[cat];
        const content = panel.querySelector('.me-content');
        if (!content) return;
        const footer = document.createElement('div');
        const items = refs.items || [];
        const hiddenCount = Math.max(0, items.length - 2);
        footer.className = 'me-arch-footer';
        footer.innerHTML = `
          <div class="me-arch-eyebrow"><span class="me-arch-eyebrow-dot"></span>Археологические открытия 2024–2026</div>
          <div class="me-arch-title">${esc(refs.title)}</div>
          <div class="me-source-badges">${_sourceBadges(items)}</div>
          ${items.map((item,idx) => `
            <div class="me-arch-item${idx>=2?' me-arch-item--extra':''}">
              <div class="me-arch-text">${esc(item.text)}</div>
              <div class="me-arch-meta"><span class="me-arch-meta-mark">◆</span><span>${esc(item.ref)}</span><span>${esc(item.src)}</span></div>
            </div>
          `).join('')}
          ${hiddenCount?`<button class="me-arch-more" type="button" aria-expanded="false">Ещё ${hiddenCount} свидетельств</button>`:''}
        `;
        const more = footer.querySelector('.me-arch-more');
        if (more) more.addEventListener('click', () => {
          const open = footer.classList.toggle('me-arch-footer--expanded');
          more.setAttribute('aria-expanded', open ? 'true' : 'false');
          more.textContent = open ? 'Скрыть свидетельства' : `Ещё ${hiddenCount} свидетельств`;
        });
        content.appendChild(footer);
      }
    }

    // ── Public API ──
    function open(id){
      try {
      const place=(route.places||[]).find(p=>p.id===id);
      if(!place)return;
      activePlaceId=id;
      panel.classList.add('me-panel--open');
      panelBackdrop.classList.add('me-panel__backdrop--active');
      // Auto-focus first tab for keyboard navigation
      _tm(() => {
        const firstTab = panel.querySelector('.me-tab');
        if (firstTab) firstTab.focus();
      }, 400);
      document.body.style.overflow = 'hidden';
      updateUrl();
      renderMarkers();
      renderPanel();
      // Animate content entrance
      const content = panel.querySelector('.me-content');
      if (content) {
        content.scrollTop = 0;
        content.style.opacity = '0';
        content.style.transform = 'translateY(8px)';
        content.style.transition = 'opacity .25s ease, transform .3s cubic-bezier(.34,1.56,.64,1)';
        requestAnimationFrame(() => {
          content.style.opacity = '1';
          content.style.transform = 'translateY(0)';
        });
      }
      if(place.x!==undefined&&place.y!==undefined)flyTo(place.x,place.y,Math.min(view.w,800));
      // Auto-scroll timeline to active stage
      const timelineTrack = document.querySelector('.me-timeline__track');
      if (timelineTrack && typeof place.stage === 'number') {
        const items = timelineTrack.querySelectorAll('.me-timeline__item');
        items.forEach((el,i) => el.classList.toggle('me-timeline__item--active', i === place.stage));
        const activeItem = items[place.stage];
        if (activeItem) {
          activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }

      const lifeTrack = document.querySelector('.me-life__track');
      if (lifeTrack && typeof place.stage === 'number') {
        const items = lifeTrack.querySelectorAll('.me-life__item');
        // Simple heuristic: activate first life item matching stage
        let found = false;
        items.forEach((el,i) => {
          const itemData = route.timeline[i];
          const match = itemData && itemData.stage === place.stage;
          el.classList.toggle('me-life__item--active', match);
          if (match && !found) {
            found = true;
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        });
      }

      // Highlight stage path for active place
      const activeStage = place.stage;
      const allPaths = pathsG.querySelectorAll('path[data-stage]');
      allPaths.forEach(p => {
        const isActive = Number(p.dataset.stage) === activeStage;
        const isUnder = p.dataset.routeKind === 'underlay';
        p.setAttribute('opacity', isActive ? (isUnder ? '0.26' : '0.88') : (isUnder ? '0.07' : '0.26'));
        p.setAttribute('stroke-width', isActive ? (isUnder ? '12' : '4') : (isUnder ? '8' : '2.4'));
        p.style.filter = isActive && !isUnder ? 'url(#me-gold-glow)' : '';
        p.style.transition = 'opacity .4s ease, stroke-width .4s ease, filter .4s ease';
      });
      pathsG.querySelectorAll('.me-route-label').forEach(lbl => lbl.setAttribute('opacity', Number(lbl.dataset.stage) === activeStage ? '0.95' : '0.38'));
    } catch(e) {
      console.error('MapEngine open error:', e);
      showToast('⚠ Ошибка открытия', 2500);
    }
    }

    function close(){
      activePlaceId=null;
      panel.classList.remove('me-panel--open');
      // Reset all stage paths to equal opacity
      const allPaths = pathsG.querySelectorAll('path[data-stage]');
      allPaths.forEach(p => {
        const isUnder = p.dataset.routeKind === 'underlay';
        p.setAttribute('opacity', isUnder ? '0.11' : '0.5');
        p.setAttribute('stroke-width', isUnder ? '9' : '3');
        p.style.filter = '';
        p.style.transition = 'opacity .4s ease, stroke-width .4s ease, filter .4s ease';
      });
      pathsG.querySelectorAll('.me-route-label').forEach(lbl => lbl.setAttribute('opacity','0.72'));
      panelBackdrop.classList.remove('me-panel__backdrop--active');
      document.body.style.overflow = '';
      // Return focus to search input
      _tm(() => { if (searchInput) searchInput.focus(); }, 100);
      hideCaption();
      updateUrl();
      saveState();
      renderMarkers();
    }

    _on(panel.querySelector('.me-panel__close'),'click',close);

    // Story toast for richer notification
    function showStoryToast(story) {
      const toastEl2 = document.createElement('div');
      toastEl2.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(.9);z-index:26;padding:10px 20px;border-radius:12px;background:rgba(7,10,16,.92);border:1px solid rgba(232,200,121,.3);color:#e8c879;font-size:14px;backdrop-filter:blur(12px);opacity:0;pointer-events:none;transition:all .4s cubic-bezier(.34,1.56,.64,1);text-align:center;white-space:nowrap';
      toastEl2.innerHTML = '<div style="font-size:22px;margin-bottom:4px">📖</div>' + esc(story.t || story.label || story.id);
      container.appendChild(toastEl2);
      requestAnimationFrame(() => { toastEl2.style.opacity='1';toastEl2.style.transform='translate(-50%,-50%) scale(1)'; });
      _tm(() => { toastEl2.style.opacity='0';toastEl2.style.transform='translate(-50%,-50%) scale(.9)';_tm(()=>toastEl2.remove(),400); }, 1500);
    }

    function setStory(storyId){
      const story=(route.stories||[]).find(s=>s.id===storyId);
      if(!story)return;
      // Fade out all markers
      const allMarkers = markersG.querySelectorAll('g[transform]');
      allMarkers.forEach(g => { g.style.opacity = '0'; g.style.transition = 'opacity .2s ease'; });
      activeStoryId=storyId;
      close();
      showStoryToast(story);
      updateUrl();
      renderStories();
      renderMarkers();
      renderStages();
      _tm(animateMarkersIn, 150);
      const storyViewport = getStoryViewport(route, storyId);
      if(Array.isArray(storyViewport)) flyTo(storyViewport[0], storyViewport[1], storyViewport[2]);
      // Auto-open first place in story after animation
      _tm(() => {
        const firstPlace = (route.places||[]).find(p => visiblePlaces().some(v => v.id === p.id));
        if (firstPlace && !activePlaceId) open(firstPlace.id);
      }, 600);
    }

    function renderStories(){
      storiesBar.innerHTML=(route.stories||[]).map(s=>`
        <button class="me-story-chip${s.id===activeStoryId?' me-story-chip--active':''}" data-story="${s.id}">${esc(s.label)}</button>
      `).join('');
      storiesBar.querySelectorAll('.me-story-chip').forEach(chip=>{
        chip.addEventListener('click',()=>setStory(chip.dataset.story||'main'));
      });
    }

    function renderStages(){
      stagesBar.innerHTML=(route.stages||[]).map((st,i)=>`
        <div class="me-stage-dot" style="color:${STAGE_COLORS[i]};cursor:pointer" data-stage="${i}">${esc(st.n||'')}</div>
      `).join('');
      // Click stage dot → open first place of that stage
      stagesBar.querySelectorAll('.me-stage-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          const si = parseInt(dot.dataset.stage);
          const place = (route.places||[]).find(p => p.stage === si && visiblePlaces().some(v => v.id === p.id));
          if (place) open(place.id);
        });
      });
    }

    function flyTo(cx,cy,w,duration=700){
      // Backward compatibility: older wrappers/modules passed a zoom factor
      // (e.g. 0.72 or 0.85) while newer engine internals pass a viewBox width.
      // Treat small positive values as zoom factors to avoid collapsed 1px viewBoxes.
      if (typeof w === 'number' && w > 0 && w <= 10) w = cfg.W0 / w;
      w = clamp(w || cfg.W0, cfg.minW, cfg.maxW);
      const from={...view};
      const h=w*cfg.H0/cfg.W0;
      const to={x:clamp(cx-w/2,-cfg.padX,cfg.W0+cfg.padX-w),y:clamp(cy-h/2,-cfg.padY,cfg.H0+cfg.padY-h),w,h};
      cancelAnimationFrame(rafId);
      const t0=performance.now();
      function step(t){
        let p=clamp((t-t0)/Math.max(1,duration),0,1);p=EASE.outCubic(p);
        view.x=from.x+(to.x-from.x)*p;view.y=from.y+(to.y-from.y)*p;
        view.w=from.w+(to.w-from.w)*p;view.h=from.h+(to.h-from.h)*p;
        applyViewBox();
        if(p<1)rafId=requestAnimationFrame(step);
      }
      rafId=requestAnimationFrame(step);
    }

    // ── Pan/Zoom ──
    _on(canvas,'pointerdown',e=>{
      if(e.target.closest('button,a,.me-story-chip'))return;
      canvas.setPointerCapture(e.pointerId);
      dragState={sx:e.clientX,sy:e.clientY,vx:view.x,vy:view.y};
    });
    _on(canvas,'pointermove',e=>{
      if(!dragState)return;
      const r=canvas.getBoundingClientRect();
      const sc=r.width/view.w;
      view.x=clamp(dragState.vx-(e.clientX-dragState.sx)/sc,-cfg.padX,cfg.W0+cfg.padX-view.w);
      view.y=clamp(dragState.vy-(e.clientY-dragState.sy)/sc,-cfg.padY,cfg.H0+cfg.padY-view.h);
      applyViewBox();
    });
    // Pinch-to-zoom on mobile
    let pinchDist0 = 0;
    let pinchView0 = null;
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchDist0 = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchView0 = { ...view };
        dragState = null; // Cancel any ongoing drag
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      if (e.touches.length === 2 && pinchView0) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scale = pinchDist0 / Math.max(1, dist);
        const nw = clamp(pinchView0.w * scale, cfg.minW, cfg.maxW);
        const cx = pinchView0.x + pinchView0.w / 2;
        const cy = pinchView0.y + pinchView0.h / 2;
        view.w = nw;
        view.h = nw * cfg.H0 / cfg.W0;
        view.x = clamp(cx - view.w / 2, -cfg.padX, cfg.W0 + cfg.padX - view.w);
        view.y = clamp(cy - view.h / 2, -cfg.padY, cfg.H0 + cfg.padY - view.h);
        applyViewBox();
      }
    }, { passive: false });
    canvas.addEventListener('touchend', e => {
      if (e.touches.length < 2) { pinchView0 = null; }
    });
    canvas.addEventListener('pointerup',()=>{dragState=null});
    canvas.addEventListener('wheel',e=>{
      e.preventDefault();
      const r=canvas.getBoundingClientRect();
      const sc=r.width/view.w;
      const mx=view.x+(e.clientX-r.left)/sc;
      const my=view.y+(e.clientY-r.top)/sc;
      const nw=clamp(view.w*Math.exp(e.deltaY*.0014),cfg.minW,cfg.maxW);
      const k=nw/view.w;
      view.x=clamp(mx-(mx-view.x)*k,-cfg.padX,cfg.W0+cfg.padX-nw);
      view.y=clamp(my-(my-view.y)*k,-cfg.padY,cfg.H0+cfg.padY-nw*cfg.H0/cfg.W0);
      view.w=nw;view.h=nw*cfg.H0/cfg.W0;
      applyViewBox();
      },{passive:false});

    function resetView(duration=800){
      const init=route.meta?.viewport_init||{cx:cfg.W0/2,cy:cfg.H0/2,w:cfg.W0};
      flyTo(init.cx,init.cy,init.w,duration);
    }

    // ── Tour ──
    
    function startTour(){
      touring=true;tourStepIdx=0;close();runTourStep();
      // Show speed controls
      const speedDiv = document.getElementById('me-tour-speed');
      if (speedDiv) speedDiv.style.display = 'flex';
    }
    // Adjust tour speed
    function adjTourSpeed(delta) {
      cfg.tourDelay = clamp(cfg.tourDelay + delta, 800, 8000);
      showToast('Тур: ' + (cfg.tourDelay/1000).toFixed(1) + 'с', 1000);
    }
    function stopTour(){
      touring=false;clearTimeout(tourTimer);
      const speedDiv = document.getElementById('me-tour-speed');
      if (speedDiv) speedDiv.style.display = 'none';
      // Show pause indicator
      const pauseEl = document.createElement('div');
      pauseEl.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:31;padding:12px 24px;border-radius:12px;background:rgba(7,10,16,.85);border:1px solid rgba(232,200,121,.3);color:#e8c879;font-size:16px;backdrop-filter:blur(12px);pointer-events:none;opacity:0;transition:opacity .3s';
      pauseEl.textContent = '⏸ Пауза';
      container.appendChild(pauseEl);
      requestAnimationFrame(() => { pauseEl.style.opacity = '1'; });
      _tm(() => { pauseEl.style.opacity = '0'; _tm(() => pauseEl.remove(), 400); }, 1500);
    hideCaption();
    const bar=document.getElementById('me-tour-bar');
    if(bar){bar.style.display='none';bar.querySelector('.me-tour-progress__fill').style.width='0%';}
    }
    function runTourStep(){
      if(!touring)return;
      const story=(route.stories||[]).find(s=>s.id===activeStoryId);
      const stageIds=story?.stage_ids||Array.from({length:(route.stages||[]).length},(_,i)=>i);
      if(tourStepIdx>=stageIds.length){stopTour();return;}
      const sid=stageIds[tourStepIdx];
      const place=(route.places||[]).find(p=>p.stage===sid&&visiblePlaces().some(v=>v.id===p.id));
      if(place)open(place.id);
      showCaption(route.stages&&route.stages[tourStepIdx], tourStepIdx, (route.stages||[]).length);
      // Elastic animation on current stage dot
      const stageDots = stagesBar.querySelectorAll('.me-stage-dot');
      if (stageDots[tourStepIdx]) {
        stageDots[tourStepIdx].style.transition = 'transform .2s cubic-bezier(.34,1.56,.64,1)';
        stageDots[tourStepIdx].style.transform = 'scale(1.4)';
        _tm(() => { stageDots[tourStepIdx].style.transform = 'scale(1)'; }, 300);
      }
      tourStepIdx++;
      const pct=Math.round((tourStepIdx/stageIds.length)*100);
      const bar=document.getElementById('me-tour-bar');
      if(bar){bar.style.display='block';bar.querySelector('.me-tour-progress__fill').style.width=pct+'%';}
      tourTimer=_tm(runTourStep,cfg.tourDelay);
      // Pre-fly to next stage's first place for smoother transition
      const nextSid=stageIds[tourStepIdx];
      const nextPlace=(route.places||[]).find(p=>p.stage===nextSid&&visiblePlaces().some(v=>v.id===p.id));
      if(nextPlace)flyTo(nextPlace.x,nextPlace.y,Math.min(view.w,800),1200);
    }

    
    // Photo modal
    const photoModal = document.createElement('div');
    photoModal.className = 'me-photo-modal';
    photoModal.innerHTML = '<div class="me-photo-modal__backdrop"></div><button class="me-photo-modal__close" aria-label="Закрыть">×</button><img class="me-photo-modal__img" alt=""><div class="me-photo-modal__caption"></div>';
    container.appendChild(photoModal);
    // Photo swipe
    let photoSwipeStartX = 0;
    let photoCurrentIdx = 0;
    let photoCurrentPlace = null;
    _on(photoModal, 'touchstart', (e) => {
      photoSwipeStartX = e.touches[0].clientX;
    }, {passive: true});
    _on(photoModal, 'touchend', (e) => {
      if (!photoCurrentPlace || !photoCurrentPlace.photos) return;
      const dx = e.changedTouches[0].clientX - photoSwipeStartX;
      if (Math.abs(dx) < 50) return;
      const photos = photoCurrentPlace.photos;
      const newIdx = dx > 0 ? Math.max(0, photoCurrentIdx - 1) : Math.min(photos.length - 1, photoCurrentIdx + 1);
      if (newIdx !== photoCurrentIdx) {
        photoCurrentIdx = newIdx;
        const ph = photos[newIdx];
        photoModal.querySelector('.me-photo-modal__img').src = ph.src || ph.thumb || '';
        photoModal.querySelector('.me-photo-modal__caption').innerHTML = (ph.label||'') + (ph.credit ? ' · <span class="me-photo-modal__credit">' + ph.credit + '</span>' : '');
        haptic(10);
      }
    }, {passive: true});
    _on(photoModal.querySelector('.me-photo-modal__backdrop'), 'click', () => photoModal.classList.remove('me-photo-modal--open'));
    _on(photoModal.querySelector('.me-photo-modal__close'), 'click', () => photoModal.classList.remove('me-photo-modal--open'));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') photoModal.classList.remove('me-photo-modal--open'); });

    function openPhoto(src, caption, credit, place, idx) {
      if (place) { photoCurrentPlace = place; photoCurrentIdx = idx || 0; }
      photoModal.querySelector('.me-photo-modal__img').src = src;
      photoModal.querySelector('.me-photo-modal__caption').innerHTML = caption ? caption + (credit ? ' · <span class="me-photo-modal__credit">' + credit + '</span>' : '') : '';
      photoModal.classList.add('me-photo-modal--open');
    }
    
    // Make photos in panel clickable via delegation
    panel.addEventListener('click', e => {
      const img = e.target.closest('img');
      if (!img || !img.src || !panel.contains(img)) return;
      const container = img.closest('div');
      const label = container?.querySelector('.me-photo-label');
      openPhoto(img.src, label?.textContent || '', '');
    });

    
    // Stage caption bar
    const captionBar = document.createElement('div');
    captionBar.className = 'me-caption';
    captionBar.style.transition = 'opacity .4s, transform .35s cubic-bezier(.34,1.56,.64,1)';
    captionBar.innerHTML = '<div class="me-caption__stage"></div><div class="me-caption__title"></div><div class="me-caption__dots"></div>';
    container.appendChild(captionBar);
    
    function showCaption(stage, idx, total) {
      if (!stage) { captionBar.classList.remove('me-caption--visible'); return; }
      captionBar.style.transform = 'translate(-50%, calc(50% + 10px))';
      captionBar.querySelector('.me-caption__stage').textContent = 'ЭТАП ' + (stage.n || '') + ' · ' + (stage.r || '');
      captionBar.querySelector('.me-caption__title').textContent = stage.t || '';
      captionBar.querySelector('.me-caption__dots').innerHTML = (route.stages||[]).map((_, i) => 
        `<span class="me-caption__dot${i === idx ? ' me-caption__dot--active' : ''}${i < idx ? ' me-caption__dot--past' : ''}"></span>`
      ).join('');
      captionBar.classList.add('me-caption--visible');
      requestAnimationFrame(() => { captionBar.style.transform = 'translate(-50%, 50%)'; });
    }
    function hideCaption() { captionBar.classList.remove('me-caption--visible'); }

    
    // Measure tool
    let measuring = false;
    let measureStart = null;
    const measureLine = document.createElementNS('http://www.w3.org/2000/svg','line');
    measureLine.setAttribute('stroke','rgba(232,200,121,.6)');
    measureLine.setAttribute('stroke-width','2');
    measureLine.setAttribute('stroke-dasharray','6 4');
    measureLine.setAttribute('display','none');
    measureLine.setAttribute('pointer-events','none');
    svg.appendChild(measureLine);
    
    const measureLabel = document.createElementNS('http://www.w3.org/2000/svg','text');
    measureLabel.setAttribute('fill','#e8c879');
    measureLabel.setAttribute('font-size','10');
    measureLabel.setAttribute('text-anchor','middle');
    measureLabel.setAttribute('display','none');
    measureLabel.setAttribute('pointer-events','none');
    svg.appendChild(measureLabel);
    
    function toggleMeasure() {
      measuring = !measuring;
      canvas.style.cursor = measuring ? 'crosshair' : '';
      if (!measuring) {
        measureStart = null;
        measureLine.setAttribute('display','none');
        measureLabel.setAttribute('display','none');
      }
    }
    
    function svgPoint(e) {
      const rect = canvas.getBoundingClientRect();
      const sc = rect.width / view.w;
      return {
        x: view.x + (e.clientX - rect.left) / sc,
        y: view.y + (e.clientY - rect.top) / sc
      };
    }
    
    function kmBetween(p1, p2) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const svgDist = Math.sqrt(dx*dx + dy*dy);
      return (svgDist * 0.92).toFixed(0); // 1 SVG unit ≈ 0.92 km
    }
    
    canvas.addEventListener('click', e => {
      if (!measuring) return;
      if (e.target.closest('.me-zoom-btn,.me-share-btn,button,a')) return;
      const pt = svgPoint(e);
      if (!measureStart) {
        measureStart = pt;
        measureLine.setAttribute('x1', pt.x);
        measureLine.setAttribute('y1', pt.y);
        measureLine.setAttribute('display','');
      } else {
        measureLine.setAttribute('x2', pt.x);
        measureLine.setAttribute('y2', pt.y);
        const km = kmBetween(measureStart, pt);
        measureLabel.setAttribute('x', (measureStart.x + pt.x) / 2);
        measureLabel.setAttribute('y', (measureStart.y + pt.y) / 2 - 8);
        measureLabel.textContent = km + ' км';
        measureLabel.setAttribute('display','');
        measureStart = null;
      }
    });
    
    canvas.addEventListener('mousemove', e => {
      if (!measuring || !measureStart) return;
      const pt = svgPoint(e);
      measureLine.setAttribute('x2', pt.x);
      measureLine.setAttribute('y2', pt.y);
    });
    
    // Add measure button to zoom controls
    if (zoomControls) {
      const measureBtn = document.createElement('button');
      measureBtn.className = 'me-zoom-btn';
      measureBtn.title = 'Измерить расстояние';
      measureBtn.textContent = '↔';
      measureBtn.addEventListener('click', toggleMeasure);
      zoomControls.appendChild(measureBtn);
    }

    // ── Keyboard ──
    // v0.53 (D-3): рудимент me-hint удалён — дублировал me-shortcuts слово в слово,
    // 2–6 c на экране жили ДВЕ одинаковые подсказки.
    
    
    // Swipe between places (mobile)
    let swipeStartX = 0;
    panel.addEventListener('touchstart', e => {
      if (e.target.closest('button,a,.me-tab')) return;
      swipeStartX = e.touches[0].clientX;
    }, {passive: true});
    
    // Focus trap in panel
    panel.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || !panel.classList.contains('me-panel--open')) return;
      const focusable = panel.querySelectorAll('button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    panel.addEventListener('touchend', e => {
      if (!activePlaceId) return;
      const dx = (e.changedTouches[0]?.clientX || 0) - swipeStartX;
      if (Math.abs(dx) < 60) return;
      const vis = visiblePlaces(); const idx = placeIndexInStory();
      if (dx < -60 && idx < vis.length - 1) open(vis[idx+1].id);
      if (dx > 60 && idx > 0) open(vis[idx-1].id);
    }, {passive: true});

    // Touch swipe-to-close on mobile
    let touchStartY = 0;
    _on(panel,'touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, {passive: true});
    _on(panel,'touchmove', (e) => {
      const dy = e.touches[0].clientY - touchStartY;
      if (dy > 40 && panel.querySelector('.me-content')?.scrollTop <= 5) {
        close();
      }
    }, {passive: true});

    // Toggle shortcuts help overlay
    let shortcutsVisible = false;
    function toggleShortcutsHelp() {
      if (shortcutsEl.parentNode) {
        shortcutsVisible = !shortcutsVisible;
        shortcutsEl.style.opacity = shortcutsVisible ? '1' : '0';
        shortcutsEl.style.transform = shortcutsVisible ? 'translate(-50%, 0)' : 'translate(-50%, 12px)';
        if (!shortcutsVisible) _tm(() => { if (!shortcutsVisible) shortcutsEl.style.transform='translate(-50%, 12px)'; }, 50);
        else _tm(() => {
          shortcutsVisible = false;
          shortcutsEl.style.opacity = '0';
          shortcutsEl.style.transform = 'translate(-50%, -6px)';
        }, 8000);
      }
    }
    // Content search (Ctrl+F when panel open)
    function searchInContent(query) {
      if (!activePlaceId) return 0;
      const c = panel.querySelector('.me-content');
      if (!c) return 0;
      const text = c.innerText.toLowerCase();
      const idx = text.indexOf(query);
      if (idx === -1) return 0;
      // Count occurrences
      let count = 0, pos = 0;
      while ((pos = text.indexOf(query, pos)) !== -1) { count++; pos++; }
      return count;
    }

    // Tour speed buttons
    _tm(() => {
      const fasterBtn = document.getElementById('me-tour-faster');
      const slowerBtn = document.getElementById('me-tour-slower');
      if (fasterBtn) _on(fasterBtn, 'click', (e) => { e.stopPropagation(); adjTourSpeed(-500); });
      if (slowerBtn) _on(slowerBtn, 'click', (e) => { e.stopPropagation(); adjTourSpeed(500); });
    }, 100);

    _on(document,'keydown',function kh(e){
      if(!container.contains(document.activeElement)&&document.activeElement!==document.body)return;
      if(e.key==='Escape'){close();return}
      if(e.key===' '||e.key==='Spacebar'){e.preventDefault();if(touring){stopTour();hideCaption()}else{startTour()};return}
      if(e.key==='?'||(e.key==='/'&&e.shiftKey)){e.preventDefault();toggleShortcutsHelp();return}
      if(!activePlaceId)return;
      // Number keys 1-7 for tab switching
      if(e.key>='1'&&e.key<='8'){
        e.preventDefault();
        const availTabs = TAB_KEYS.filter(k => {
          const place = getActivePlace();
          if (!place) return false;
          if (k==='bible') return !!place.bible;
          if (k==='arch') return !!place.arch;
          if (k==='he') return !!place.he_deep;
          if (k==='dispute') return !!place.dispute;
          if (k==='photos') return !!(place.photos&&place.photos.length);
          if (k==='extra') return !!place.bible_extra;
          return k==='story';
        });
        const ti = parseInt(e.key)-1;
        if (ti < availTabs.length) {
          const tabKey = availTabs[ti];
          const tabsEl = panel.querySelector('.me-tabs');
          if (tabsEl) {
            tabsEl.querySelectorAll('.me-tab').forEach(b => b.classList.remove('me-tab--active'));
            const targetTab = tabsEl.querySelector('[data-tab="'+tabKey+'"]');
            if (targetTab) { targetTab.classList.add('me-tab--active'); renderTabContent(tabKey, getActivePlace()); }
          }
        }
        return;
      }
      const vis=visiblePlaces();const idx=placeIndexInStory();
      if(e.key==='ArrowRight'&&idx<vis.length-1)open(vis[idx+1].id);
      if(e.key==='ArrowLeft'&&idx>0)open(vis[idx-1].id);
      if(e.key==='PageDown'&&idx<vis.length-1){e.preventDefault();open(vis[Math.min(idx+3,vis.length-1)].id);}
      if(e.key==='PageUp'&&idx>0){e.preventDefault();open(vis[Math.max(idx-3,0)].id);}
      if(e.key==='Home'&&idx>0){e.preventDefault();open(vis[0].id);}
      if(e.key==='End'&&idx<vis.length-1){e.preventDefault();open(vis[vis.length-1].id);}
    });

    // ── Marker entrance animation ──
    function animateMarkersIn() {
      const allMarkers = markersG.querySelectorAll('g[transform]');
      allMarkers.forEach((g, i) => {
        g.style.opacity = '0';
        g.style.transform = g.getAttribute('transform') + ' scale(0.3)';
        g.style.transition = `opacity .4s ${i * 50}ms ease-out, transform .5s ${i * 60}ms cubic-bezier(.34,1.56,.64,1)`;
        requestAnimationFrame(() => {
          g.style.opacity = '1';
          const orig = g.getAttribute('transform');
          g.style.transform = orig;
        });
        // Add spring animation to marker dots
        const dot = g.querySelector('circle:nth-child(3)');
        if (dot) {
          dot.style.animation = `meSpringIn .5s ${i * 60 + 50}ms cubic-bezier(.34,1.56,.64,1) both`;
          dot.addEventListener('animationend', function() { this.style.animation = ''; }, {once: true});
        }
      });
    }

    // ── Canonical query-based deep linking (legacy hash remains readable) ──
    function updateUrl() {
      const next=buildMapStateUrl(location,{story:activeStoryId,place:activePlaceId});
      const current=location.origin+location.pathname+location.search+location.hash;
      if(next!==current)history.replaceState(null,'',next);
    }

    // ── Intro screen ──

    // Intro screen
    if (opts.showIntro !== false) {
      const intro = document.createElement('div');
      intro.className = 'me-intro';
      intro.innerHTML = `
        <div class="me-intro__bg"></div>
        <div class="me-intro__content">
          <h1 class="me-intro__title">${esc(route.meta?.title || '')}</h1>
          ${route.meta?.title_he ? `<p class="me-intro__he" dir="rtl">${esc(route.meta.title_he)}</p>` : ''}
          ${route.meta?.subtitle ? `<p class="me-intro__sub">${esc(route.meta.subtitle)}</p>` : ''}
          <div class="me-intro__stats">
            ${(route.places||[]).length ? `<span>${route.places.length} мест</span>` : ''}
            ${(route.stories||[]).length ? `<span>${route.stories.length} сюжетов</span>` : ''}
          </div>
          <button class="me-intro__btn">Начать изучение</button>
        </div>`;
      container.appendChild(intro);
      _on(intro.querySelector('.me-intro__btn'), 'click', () => {
        intro.style.opacity = '0';
        intro.style.transform = 'scale(0.95)';
        intro.style.transition = 'opacity .4s ease, transform .4s cubic-bezier(.4,0,.2,1)';
        intro.style.pointerEvents = 'none';
        _tm(() => intro.remove(), 450);
      });
      // Also dismiss on clicking background
      _on(intro.querySelector('.me-intro__bg'), 'click', () => {
        intro.querySelector('.me-intro__btn').click();
      });
    }

    
    // Loading progress
    const progressBar = document.createElement('div');
    progressBar.className = 'me-progress';
    progressBar.innerHTML = '<div class="me-progress__fill"></div>';
    container.appendChild(progressBar);
    let loadProgress = 0;
    const progressInterval = setInterval(() => {
      const remaining = 95 - loadProgress;
      loadProgress += remaining * (0.1 + Math.random() * 0.15);
      if (loadProgress > 95) loadProgress = 95;
      progressBar.querySelector('.me-progress__fill').style.width = loadProgress + '%';
    }, 150);
    // Complete on markers rendered
    setTimeout(() => {
      clearInterval(progressInterval);
      progressBar.querySelector('.me-progress__fill').style.width = '100%';
      setTimeout(() => { progressBar.style.opacity = '0'; setTimeout(() => progressBar.remove(), 400); }, 300);
    }, 800);

    // ── Loading state ──
    const loadingEl=document.createElement('div');loadingEl.className='me-loading';
    const placeCount = (route.places||[]).length;
    loadingEl.innerHTML='<div class="me-loading__spinner"></div><div class="me-loading__text">Загрузка карты…</div><div style="font-size:10px;color:rgba(154,162,174,.4);margin-top:4px">'+placeCount+' мест · '+(route.stages||[]).length+' этапов</div>';
    container.appendChild(loadingEl);
    _tm(()=>{loadingEl.style.opacity='0';_tm(()=>loadingEl.remove(),400);},600);

    
    // Keyboard shortcuts overlay
    // Keyboard shortcuts overlay with slide-up entrance
    const shortcutsEl = document.createElement('div');
    shortcutsEl.className = 'me-shortcuts';
    shortcutsEl.innerHTML = '<kbd>← →</kbd> навигация · <kbd>Esc</kbd> закрыть · <kbd>Space</kbd> тур · <kbd>1-8</kbd> вкладки · <kbd>?</kbd> помощь · <kbd>Колёсико</kbd> масштаб';
    shortcutsEl.style.transform = 'translate(-50%, 12px)';
    shortcutsEl.style.transition = 'opacity .5s ease, transform .5s cubic-bezier(.34,1.56,.64,1)';
    container.appendChild(shortcutsEl);
    _tm(() => { shortcutsEl.style.opacity = '1'; shortcutsEl.style.transform = 'translate(-50%, 0)'; }, 1500);
    _tm(() => { shortcutsEl.style.opacity = '0'; shortcutsEl.style.transform = 'translate(-50%, -6px)'; _tm(() => shortcutsEl.remove(), 600); }, 6000);
    
    // ── Init ──
    applyViewBox();
    renderMarkers();
    
    // Load base-geo.svg if provided
    if (opts.baseGeoUrl) {
      fetch(opts.baseGeoUrl).then(r => r.text()).then(svgText => {
        const parser = new DOMParser();
        const geoDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const geoRoot = geoDoc.querySelector('svg');
        if (geoRoot) {
          // Insert base-geo as first child of SVG (behind paths/markers)
          const baseGeoG = document.createElementNS('http://www.w3.org/2000/svg','g');
          baseGeoG.id = 'me-base-geo';
          baseGeoG.setAttribute('opacity','0.5');
          while (geoRoot.firstChild) baseGeoG.appendChild(geoRoot.firstChild);
          svg.insertBefore(baseGeoG, svg.firstChild);
        }
      }).catch(e => console.warn('Base geo load failed:', e));
    }
    renderStories();
    renderStages();

    // Persist the already-resolved state; no delayed reader may override URL intent.
    function saveState() {
      try {
        localStorage.setItem(stateStorageKey,JSON.stringify({place:activePlaceId,story:activeStoryId}));
      } catch(e) {}
    }
    const origOpen = open;
    open = function(id) { origOpen(id); saveState(); return (route.places||[]).find(p => p.id === id); };
    if(initialPlaceId){
      _tm(()=>open(initialPlaceId),200);
    }else if(initialState.source!=='default'){
      updateUrl();
      saveState();
    }

    // ── Instance ──
    const instance={
      open,close,setStory,startTour,stopTour,flyTo,resetView,
      get routeData(){return route},
      destroy(){
        stopTour();
        _cleanupAll();
        container.innerHTML='';container.className='';
      }
    };
    return instance;
  }

  // ── Public exports ──
  return {
    // v0.2 data layer
    loadRoute,validateRoute,compareRouteData,normalizeRouteData,collectPhotoHosts,
    getPlaceIndex,getPlaceById,getStageForPlace,getRelatedPlaceIds,getTabContentKey,
    getPanelModel,getPanelSections,getStoryViewport,getStoryState,getPlaceOrder,auditStoryDefinitions,
    parseMapStateFromLocation,resolveInitialMapState,buildMapStateUrl,
    // v0.3 rendering
    createMap,
    version:'0.53.0',buildDate:'2026-07-11'
  };
})();

if(typeof window!=='undefined')window.MapEngine=MapEngine;
if(typeof module!=='undefined')module.exports=MapEngine;
