'use strict';
const { esc, txt, D } = require('./build.js');

const icon = {
  origins:'<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/>',
  map:'<circle cx="12" cy="12" r="3"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users:'<path d="M16 18v-1a4 4 0 00-8 0v1"/><circle cx="12" cy="8" r="3"/>',
  scale:'<path d="M12 3v18M5 7h14M5 7l-2 6a3 3 0 006 0L7 7M19 7l-2 6a3 3 0 006 0l-2-6"/>',
  branch:'<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 8v8M6 16c8 0 10-2 10-6"/>',
  shield:'<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>',
  book:'<path d="M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2z"/><path d="M18 3v16"/>',
  scroll:'<path d="M6 3h11a2 2 0 012 2v12M6 3a2 2 0 00-2 2v12a2 2 0 002 2h11"/><path d="M9 8h6M9 12h6"/>',
  q:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 115 0c0 2-2.5 2-2.5 4M12 17h.01"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
  route:'<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h6a4 4 0 000-8H8a4 4 0 010-8h2"/>',
  gavel:'<path d="M14 6l4 4M3 21l6-6M13 3l8 8-3 3-8-8z"/>',
};

const shead = (ic, badge, title, sub) => `
  <div class="shead reveal">
    <div class="badge"><svg viewBox="0 0 24 24">${icon[ic]||''}</svg>${esc(badge)}</div>
    <h2 class="stitle">${esc(title)}</h2>
    ${sub?`<p class="ssub">${txt(sub)}</p>`:''}
    <div class="rule"></div>
  </div>`;

// ── HERO
function hero(){
  const stats = D.heroStats.map(s=>`<div class="hstat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('');
  return `
<section id="hero">
  <div class="dots" aria-hidden="true"></div>
  <div>
    <div class="cross" aria-hidden="true"><span class="glow"></span>
      <svg viewBox="0 0 60 80"><rect x="17" y="0" width="6" height="76" rx="2.5" fill="#c4a67e"/><rect x="2" y="24" width="36" height="6" rx="2.5" fill="#c4a67e"/></svg>
    </div>
    <div class="he">Интерактивная карта истории</div>
    <h1>Карта<span class="acc">Русского Баптизма</span></h1>
    <p class="lead">От истоков к современности</p>
    <p class="sub">Молокане и штундисты · Тифлис 1867 · Пашковцы · ВСЕХБ · Раскол · РС ЕХБ и МСЦ ЕХБ</p>
    <div class="hstats">${stats}</div>
    <div class="hbtns">
      <a class="btn btn-p" href="#origins">Начать путешествие<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></a>
      <a class="btn btn-s" href="#mindmap"><span style="color:var(--gold-l)">Карта связей</span><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></a>
    </div>
    <div class="hhint">Прокрутите вниз · 17 разделов истории</div>
  </div>
</section>`;
}

// ── секц-навигация
function secnav(){
  const items = [
    ['origins','Истоки'],['mindmap','Карта связей'],['geo','География'],['timeline','Хронология'],
    ['congresses','Съезды'],['parallel','Два пути'],['persecution','Гонения'],['orgs','Союзы'],
    ['figures','Фигуры'],['findings','Находки'],['archives','Архивы'],['comparison','РС и МСЦ'],
    ['glossary','Глоссарий'],['quiz','Викторина'],
  ];
  return `<nav class="secnav" aria-label="Разделы материала"><div class="inner">${items.map(([id,l])=>`<a href="#${id}">${esc(l)}</a>`).join('')}</div></nav>`;
}

// ── Истоки
function origins(){
  const cards = D.origins.map(o=>`
    <div class="card origin reveal">
      <div class="oy" style="color:${o.color}">${o.year}</div>
      <div class="om" style="color:${o.color}">${esc(o.model)}</div>
      <h3>${esc(o.city)}</h3>
      <div class="ofig">${esc(o.figure)}${o.baptizer?` · крестил: ${esc(o.baptizer)}`:''}${o.catalyst?` · катализатор: ${esc(o.catalyst)}`:''}${o.movement?` · ${esc(o.movement)}`:''}</div>
      <p>${txt(o.note)}</p>
      <div class="chips">${o.members.map(m=>`<span class="chip">${esc(m)}</span>`).join('')}</div>
      <div class="ofocus">Акцент: ${esc(o.focus)}</div>
    </div>`).join('');
  return `<section id="origins"><div class="sec">
    ${shead('origins','Три истока','Три независимых истока','Русский баптизм родился не из одного центра, а из трёх независимых очагов 1860–1870-х годов, которые позже сошлись в единое братство.')}
    <div class="grid g3">${cards}</div>
  </div></section>`;
}

// ── Карта связей (mindmap)
function mindmap(){
  const routes = D.routePresets.map((r,i)=>`<button type="button" class="routebtn${i===0?' on':''}" data-route="${r.id}"><span class="dot" style="background:${r.color}"></span>${esc(r.label)}</button>`).join('');
  const groups = [
    ['root','Корень','#f0d896'],['union','Истоки и союзы','#e8c879'],['merger','Объединение','#8b5cf6'],
    ['split','Раскол','#ec4899'],['modern','Современность','#06b6d4'],['leader','Деятели','#9aa2ae'],
  ];
  const legend = groups.map(g=>`<span class="lg"><i style="background:${g[2]}"></i>${esc(g[1])}</span>`).join('');
  return `<section id="mindmap"><div class="sec mid">
    ${shead('map','Карта связей','Карта связей движения','Интерактивное созвездие из 23 узлов и 27 связей: три истока, союзы, объединение и раскол. Наведите на узел, выберите маршрут или найдите фигуру.')}
    <div id="mapwrap" class="reveal">
      <canvas id="mapcanvas" role="img" aria-label="Интерактивная карта связей русского баптизма: узлы-фигуры и события, соединённые нитями"></canvas>
      <div class="maptop">
        <div class="routebar">${routes}</div>
        <div class="mapsearchwrap">
          <div class="mapsearch"><svg viewBox="0 0 24 24">${icon.search}</svg><input id="mapsearch" type="text" placeholder="Найти фигуру или союз…" autocomplete="off" aria-label="Поиск по карте"></div>
          <div id="mapresults"></div>
        </div>
      </div>
      <div class="maplegend">${legend}</div>
      <div class="mapbtns"><button type="button" id="mapzin" aria-label="Приблизить">+</button><button type="button" id="mapzout" aria-label="Отдалить">−</button><button type="button" id="mapfit" aria-label="Показать всё">⌂</button></div>
      <div class="mapcard" id="mapcard"></div>
    </div>
    <p class="maphint" id="maphint">Перетаскивайте для перемещения · колесо для масштаба · клик по узлу — закрепить карточку</p>
    <p class="mapstats">23 узла · 27 связей · 5 тематических маршрутов</p>
  </div></section>`;
}

// ── География
function geo(){
  const cards = D.mapPlaces.map(p=>`
    <article class="card rec reveal" data-kind="${p.kind}">
      <div class="place-tag">${p.kind==='city'?'Город':'Страна'}</div>
      <h3>${esc(p.label)}</h3>
      <p>${txt(p.summary)}</p>
      <ul>${p.notes.map(n=>`<li>${txt(n)}</li>`).join('')}</ul>
      <div style="margin-top:14px"><div class="kick" style="margin-bottom:7px">Связанные узлы</div><div class="tags">${p.related.map(id=>`<span class="chip">${esc(D.graphLabels[id]||id)}</span>`).join('')}</div></div>
      <div class="src">Источник: ${esc(p.source)}</div>
    </article>`).join('');
  return `<section id="geo"><div class="sec">
    ${shead('globe','География истории','Страны и города на карте','Точки, подсвечиваемые на карте связей, собраны здесь как читаемые исторические карточки.')}
    <div style="display:flex;gap:8px;justify-content:center;margin-bottom:26px" id="geofilters">
      <button type="button" class="tlf on" data-gk="all">Все</button>
      <button type="button" class="tlf" data-gk="country">Страны</button>
      <button type="button" class="tlf" data-gk="city">Города</button>
    </div>
    <div class="grid g3" id="geogrid">${cards}</div>
  </div></section>`;
}

// ── Хронология
function timeline(){
  const filters = Object.entries(D.timelineCategories).map(([k,v])=>`<button type="button" class="tlf" data-cat="${k}"><i style="background:${v.color}"></i>${esc(v.label)}</button>`).join('');
  const items = D.timeline.map((e,i)=>{
    const c = D.timelineCategories[e.cat];
    const det = (e.details||e.source)?`<div class="tldet"><div>${txt(e.details||'')}</div>${e.source?`<span class="src">Источник: ${esc(e.source)}</span>`:''}</div>`:'';
    return `<div class="tlitem reveal" data-cat="${e.cat}">
      <span class="node" style="color:${c.color}"></span>
      <div class="tlcard" ${det?'data-toggle="1"':''}>
        <span class="tly" style="color:${c.color}">${esc(e.year)}</span>
        <h3>${txt(e.title)}</h3>
        <p>${txt(e.description)}</p>
        ${det}
      </div>
    </div>`;
  }).join('');
  return `<section id="timeline"><div class="sec mid">
    ${shead('clock','Хронология','Хронология 1609 → наши дни','От первой баптистской общины в Амстердаме до современных союзов. Нажмите на событие, чтобы раскрыть детали и источники.')}
    <div class="tlfilters" id="tlfilters"><button type="button" class="tlf on" data-cat="all">Все</button>${filters}</div>
    <div class="tl" id="tl">${items}</div>
  </div></section>`;
}

// ── Съезды
function congresses(){
  const cards = D.congresses.map(c=>`
    <article class="card rec reveal">
      <span class="ry">${esc(c.date)} · ${esc(c.place)}</span>
      <h3>${esc(c.title)}</h3>
      <p>${txt(c.summary)}</p>
      <ul>${c.facts.map(f=>`<li>${txt(f)}</li>`).join('')}</ul>
      <div class="src">Источник: ${esc(c.source)}</div>
    </article>`).join('');
  return `<section id="congresses"><div class="sec mid">
    ${shead('users','Съезды','Съезды и объединения','Ключевые съезды, на которых складывалась организационная структура братства.')}
    <div class="grid g2">${cards}</div>
  </div></section>`;
}

// ── Два пути
function parallel(){
  const V='#8b5cf6', R='#ef4444';
  const evs=(arr,col)=>arr.map(e=>`<div class="ev"><span class="en" style="background:${col};box-shadow:0 0 8px ${col}80"></span><b style="color:${col}">${esc(e.year)}</b><span>${txt(e.text)}</span></div>`).join('');
  return `<section id="parallel"><div class="sec">
    ${shead('branch','Два пути','Два пути после 1960','«Инструктивное письмо» 1960 г. раскололо ЕХБ СССР на официальный ВСЕХБ и подпольный СЦ ЕХБ.')}
    <div class="paths">
      <div class="reveal">
        <div class="pathhead" style="border-color:${V}55;background:color-mix(in srgb,${V} 8%, rgba(7,7,14,.95))">
          <span class="pathbadge" style="border-color:${V}55;color:${V};background:${V}14">~200k</span>
          <h3>ВСЕХБ</h3><div class="pp" style="color:${V}">Официальный путь · 1944–1992</div>
          <p class="pdesc">Зарегистрированный союз в рамках советских законов. Сохранил легальность, но ценой ограничений — «Инструктивное письмо» 1960 г. стало причиной раскола.</p>
        </div>
        <div class="evlist" style="--c:${V}"><span style="position:absolute;left:3px;top:4px;bottom:4px;width:1px;background:linear-gradient(${V}70,${V}20,transparent)"></span>${evs(D.vsehbEvents,V)}</div>
      </div>
      <div class="reveal">
        <div class="pathhead" style="border-color:${R}55;background:color-mix(in srgb,${R} 8%, rgba(7,7,14,.95))">
          <span class="pathbadge" style="border-color:${R}55;color:${R};background:${R}14">МСЦ</span>
          <h3>СЦ ЕХБ</h3><div class="pp" style="color:${R}">Путь сопротивления · 1965 — наши дни</div>
          <p class="pdesc">Незарегистрированный союз — подпольные типографии, аресты, лагеря. Принципиальный отказ от государственной регистрации. Ныне МСЦ ЕХБ.</p>
        </div>
        <div class="evlist"><span style="position:absolute;left:3px;top:4px;bottom:4px;width:1px;background:linear-gradient(${R}70,${R}20,transparent)"></span>${evs(D.scEvents,R)}</div>
      </div>
    </div>
  </div></section>`;
}

// ── Гонения
function persecution(){
  const p=D.persecution;
  const acts=p.keyActs.map(a=>`<li><b class="mono" style="color:#ff9b9b">${esc(a.year)}</b> — ${txt(a.text)}</li>`).join('');
  return `<section id="persecution"><div class="sec mid">
    ${shead('shield','Хроника гонений','Гонения на верующих','Систематическое преследование евангельских христиан и баптистов в советский период — от закона 1929 года до Большого террора и лагерей.')}
    <div class="pstats reveal">
      <div class="pstat"><b>${esc(p.totalVictims)}</b><span>пострадавших</span></div>
      <div class="pstat"><b>${esc(p.peakYear)}</b><span>пик террора</span></div>
      <div class="pstat"><b>${esc(p.percentLeadersKilled)}</b><span>руководителей погибло</span></div>
    </div>
    <div class="card listcard reveal">
      <h3><svg viewBox="0 0 24 24">${icon.scroll}</svg>Ключевые акты и память</h3>
      <ul style="margin-bottom:14px">${acts}</ul>
      <p style="font-size:13px;color:var(--txt2);line-height:1.7">${txt(p.uzniki)}</p>
    </div>
  </div></section>`;
}

// ── Организации
function orgs(){
  const cards=D.organizations.map(o=>`
    <article class="card org reveal" style="border-top-color:${o.color}">
      <div class="on"><h3>${esc(o.name)}</h3><span class="oy">${esc(o.years)}</span></div>
      <div class="ofull">${esc(o.fullName)}</div>
      <div class="meta">
        <div><b>Численность</b>${esc(o.members)}</div>
        <div><b>Статус</b>${esc(o.position)}</div>
      </div>
      <p style="font-size:12.5px;color:var(--txt2);line-height:1.6;margin-bottom:12px">${txt(o.origin)}</p>
      <ul style="color:${o.color}">${o.characteristics.map(c=>`<li><span style="color:var(--muted)">${txt(c)}</span></li>`).join('')}</ul>
      <div class="kick" style="margin-bottom:7px">Ключевые лидеры</div>
      <div class="leaders">${o.keyLeaders.map(l=>`<span class="chip">${esc(l)}</span>`).join('')}</div>
      ${o.source?`<div class="src">Источник: ${esc(o.source)}</div>`:''}
    </article>`).join('');
  return `<section id="orgs"><div class="sec">
    ${shead('users','Союзы и организации','Союзы и организации','Институциональная карта движения: от первых союзов 1884 и 1909 годов до современных РС ЕХБ, МСЦ ЕХБ и ЕАФ.')}
    <div class="grid g2">${cards}</div>
  </div></section>`;
}

// ── Ключевые фигуры
function figures(){
  const cards=D.persons.map(p=>{
    const hl=p.highlights.map(h=>`<li>${txt(h)}</li>`).join('');
    const ch=p.chronology.map(c=>`<div class="chrow"><div class="cy">${esc(c.year)}</div><div class="ct">${txt(c.text)}</div></div>`).join('');
    return `<article class="card pcard reveal" data-toggle="1">
      <div class="ph"><h3>${esc(p.name)}</h3><span class="py">${esc(p.years)}</span></div>
      <div class="prole">${txt(p.role)}</div>
      <div class="preg">${esc(p.region)}</div>
      <p class="pcontrib">${txt(p.contribution)}</p>
      <div class="pmore">Подробнее →</div>
      <div class="pdetail">
        <h4>Ключевые факты</h4><ul>${hl}</ul>
        <h4>Хронология</h4><div class="chrono">${ch}</div>
        ${p.fate?`<div class="pfate">${txt(p.fate)}</div>`:''}
        ${p.source?`<div class="src">Источник: ${esc(p.source)}</div>`:''}
      </div>
    </article>`;
  }).join('');
  return `<section id="figures"><div class="sec">
    ${shead('users','Ключевые фигуры','Ключевые фигуры','Тринадцать с лишним деятелей, без которых не понять историю движения. Нажмите на карточку, чтобы раскрыть досье с хронологией.')}
    <div class="grid g3">${cards}</div>
  </div></section>`;
}

// ── Находки v6
function findings(){
  const kr=D.kargelRoute.map((s,i)=>`<div class="kr-step"><span class="kn">${i+1}</span><span class="kt"><b>${esc(s.place)}</b> (${esc(s.period)}): ${txt(s.note)}</span></div>`).join('');
  const conf=D.confessions.map(c=>`<div class="subcard"><h4>${esc(c.title)}<span class="y">${esc(c.year)}</span></h4><div class="who">${esc(c.who)}</div><p>${txt(c.significance)}</p></div>`).join('');
  const mol=D.molokanLeaders.map(l=>`<span class="tag">${esc(l)}</span>`).join('');
  const arch=D.archiveTargets.map(a=>`<li>${txt(a)}</li>`).join('');
  const disp=D.biographyDisputes.map(d=>`<div class="dispute"><div class="dp">${esc(d.person)}</div><div class="di">${esc(d.issue)}</div><div class="dv"><div class="dvc"><b>Версия A:</b> ${txt(d.a)}</div><div class="dvc"><b>Версия B:</b> ${txt(d.b)}</div></div><div class="dn">${txt(d.note)}</div></div>`).join('');
  const corr=D.sourceCorrections.map(c=>`<div class="subcard"><h4>${esc(c.topic)}</h4><p>${txt(c.corrected)}</p><div class="src">${esc(c.source)}</div></div>`).join('');
  const legal=D.legal.map(r=>`<div class="subcard"><h4>${esc(r.title)}<span class="y">${esc(r.year)}</span></h4><p>${txt(r.summary)}</p><p style="color:var(--muted);margin-top:5px">${txt(r.significance)}</p><div class="src">${esc(r.source)}</div></div>`).join('');
  const jour=D.baptistJournal.map(j=>`<div class="subcard"><h4>${esc(j.editor)}<span class="y">${esc(j.period)}</span></h4><p>${txt(j.note)}</p></div>`).join('');
  return `<section id="findings"><div class="sec">
    ${shead('scroll','Новые находки v6','Уточнения, вероучение и право','Сводка важных исторических находок и исправлений, которые не должны потеряться в проекте.')}
    <div class="grid g2">
      <div class="card listcard reveal"><h3><svg viewBox="0 0 24 24">${icon.route}</svg>Каргель как связующее звено</h3><p style="font-size:12.5px;color:var(--txt2);line-height:1.6;margin-bottom:14px">${txt(D.persons.find(p=>p.id==='kargel').contribution)}</p>${kr}</div>
      <div class="card listcard reveal"><h3><svg viewBox="0 0 24 24">${icon.book}</svg>Вероучительные документы</h3>${conf}</div>
    </div>
    <div class="grid g2" style="margin-top:20px">
      <div class="card listcard reveal"><h3><svg viewBox="0 0 24 24">${icon.users}</svg>Молоканские лидеры в ЕХБ</h3><p style="font-size:12.5px;color:var(--muted);line-height:1.6;margin-bottom:12px">Значительная часть ранних лидеров ЕХБ вышла из молоканской среды.</p><div class="tags">${mol}</div></div>
      <div class="card listcard reveal"><h3><svg viewBox="0 0 24 24">${icon.scroll}</svg>Архивные цели</h3><ul>${arch}</ul></div>
    </div>
    <div class="grid g2" style="margin-top:20px">
      <div class="card listcard reveal"><h3><svg viewBox="0 0 24 24">${icon.scroll}</svg>Биографические расхождения</h3>${disp}</div>
      <div class="card listcard reveal"><h3><svg viewBox="0 0 24 24">${icon.search}</svg>Исправления источников</h3>${corr}</div>
    </div>
    <div class="grid g2" style="margin-top:20px">
      <div class="card listcard reveal"><h3><svg viewBox="0 0 24 24">${icon.gavel}</svg>Правовой контекст</h3>${legal}</div>
      <div class="card listcard reveal"><h3><svg viewBox="0 0 24 24">${icon.scroll}</svg>Журнал «Баптист»</h3>${jour}</div>
    </div>
  </div></section>`;
}

// ── Архивы и источники
function archives(){
  const prim=D.primarySources.map(s=>`<li>${txt(s)}</li>`).join('');
  const loc=D.archiveLocations.map(s=>`<li>${txt(s)}</li>`).join('');
  const foreign=D.foreignWorks.map(w=>`<span class="chip">${esc(w)}</span>`).join('');
  const copies=D.pashkovArchive.copies.map(c=>`<li>${txt(c)}</li>`).join('');
  return `<section id="archives"><div class="sec">
    ${shead('book','Источники и архивы','Источники и архивы','На чём строится этот материал: первичные тексты, журналы 1920-х, академические работы и архивные собрания.')}
    <div class="grid g2">
      <div class="card listcard reveal"><h3><svg viewBox="0 0 24 24">${icon.scroll}</svg>Первичные источники</h3><ul>${prim}</ul></div>
      <div class="card listcard reveal"><h3><svg viewBox="0 0 24 24">${icon.book}</svg>Архивные собрания</h3><ul>${loc}</ul></div>
    </div>
    <div class="grid g2" style="margin-top:20px">
      <div class="card listcard reveal"><h3><svg viewBox="0 0 24 24">${icon.scroll}</svg>Архив В. А. Пашкова</h3>
        <p style="font-size:12.5px;color:var(--txt2);line-height:1.6;margin-bottom:12px">${txt(D.pashkovArchive.summary)}</p>
        <div class="kick" style="margin-bottom:7px">Микрофильмы в</div><ul>${copies}</ul>
      </div>
      <div class="card listcard reveal"><h3><svg viewBox="0 0 24 24">${icon.globe}</svg>Зарубежные работы, отмеченные ВСЕХБ</h3>
        <p style="font-size:12.5px;color:var(--muted);line-height:1.6;margin-bottom:12px">В предисловии ВСЕХБ 1989 они упомянуты как недостаточно точные и требующие сверки.</p>
        <div class="tags">${foreign}</div>
      </div>
    </div>
    <div class="card listcard reveal" style="margin-top:20px">
      <h3><svg viewBox="0 0 24 24">${icon.q}</svg>Открытые вопросы</h3>
      <p style="font-size:12.5px;color:var(--muted);line-height:1.6;margin-bottom:12px">История русского баптизма долго переписывалась по вторичным обзорам. Эти вопросы остаются открытыми и требуют сверки с первоисточниками.</p>
      <ul>${D.unresolved.map(u=>`<li>${txt(u)}</li>`).join('')}</ul>
    </div>
  </div></section>`;
}

// ── Сравнение
function comparison(){
  const rows=D.comparison.map((r,i)=>`<tr${i%2?' style="background:rgba(255,255,255,.018)"':''}><td style="font-weight:600;color:var(--txt)">${esc(r.aspect)}</td><td>${txt(r.rs)}</td><td>${txt(r.msc)}</td></tr>`).join('');
  const mob=D.comparison.map(r=>`<div class="card" style="padding:18px"><div class="kick" style="margin-bottom:10px">${esc(r.aspect)}</div><div style="border:1px solid rgba(127,180,255,.25);background:rgba(127,180,255,.05);border-radius:11px;padding:11px;margin-bottom:9px"><div class="kick" style="color:#7fb4ff;margin-bottom:4px">РС ЕХБ</div><div style="font-size:12.5px;color:var(--txt2);line-height:1.5">${txt(r.rs)}</div></div><div style="border:1px solid rgba(255,155,155,.25);background:rgba(255,155,155,.05);border-radius:11px;padding:11px"><div class="kick" style="color:#ff9b9b;margin-bottom:4px">МСЦ ЕХБ</div><div style="font-size:12.5px;color:var(--txt2);line-height:1.5">${txt(r.msc)}</div></div></div>`).join('');
  return `<section id="comparison"><div class="sec mid">
    ${shead('scale','Сравнение','РС ЕХБ и МСЦ ЕХБ','Нейтральный обзор двух ветвей, возникших после советского раскола 1960-х годов.')}
    <div class="tablewrap reveal"><table class="ptable"><thead><tr><th style="width:22%">Параметр</th><th class="blue" style="width:39%">РС ЕХБ</th><th class="red" style="width:39%">МСЦ ЕХБ</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="cmpmobile">${mob}</div>
  </div></section>`;
}

// ── Глоссарий
function glossary(){
  const items=D.glossary.map((g,i)=>`<div class="gitem" data-term="${esc((g.term+' '+g.def).toLowerCase())}"><button type="button" aria-expanded="false"><span>${esc(g.term)}</span><span class="gi-ic"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></span></button><div class="gdef"><p>${txt(g.def)}</p></div></div>`).join('');
  return `<section id="glossary"><div class="sec narrow">
    ${shead('book','Глоссарий','Словарь терминов','Ключевые понятия для понимания истории русского баптизма.')}
    <div class="gsearch reveal"><svg viewBox="0 0 24 24">${icon.search}</svg><input id="gsearch" type="text" placeholder="Найти термин или понятие…" aria-label="Поиск по глоссарию"><span class="ct" id="gcount">${D.glossary.length}/${D.glossary.length}</span></div>
    <p class="gnone" id="gnone" style="display:none;margin-bottom:14px"></p>
    <div id="glist">${items}</div>
  </div></section>`;
}

// ── Викторина
function quiz(){
  return `<section id="quiz"><div class="sec narrow">
    ${shead('q','Викторина','Проверьте себя','Двадцать вопросов по истории русского баптизма — от истоков до современности.')}
    <div class="quizbox reveal" id="quizbox"></div>
  </div></section>`;
}

// ── footer
function footer(){
  return `
<div class="endsdg"><svg width="42" height="58" viewBox="0 0 52 70" aria-hidden="true"><line x1="26" y1="3" x2="26" y2="67" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><line x1="6" y1="19" x2="46" y2="19" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg><span class="sdg">Soli Deo Gloria</span></div>
<footer class="site">
  <div><a href="/">gospod-bog.ru</a> · отдел <a href="/konfessii/">«Конфессии и Деноминации»</a> · «Карта Русского Баптизма»</div>
  <div class="ed">Материал нейтрально-исторический, с опорой на первичные источники и архивы. Раздел дорабатывается.</div>
</footer>`;
}

function buildBody(){
  return `
<a class="skip" href="#hero">Перейти к содержанию</a>
<div id="progress" aria-hidden="true"></div>
<header class="topbar"><div class="inner">
  <a class="back" href="/konfessii/"><svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>Конфессии и Деноминации</a>
  <div class="crumb"><a href="/">Главная</a> · <a href="/konfessii/">Конфессии</a> · Русский баптизм</div>
</div></header>
<main class="wrap">
${hero()}
${secnav()}
${origins()}
${mindmap()}
${geo()}
${timeline()}
${congresses()}
${parallel()}
${persecution()}
${orgs()}
${figures()}
${findings()}
${archives()}
${comparison()}
${glossary()}
${quiz()}
</main>
${footer()}
<button type="button" id="stop" aria-label="Наверх"><svg viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg></button>`;
}

module.exports = { buildBody };
