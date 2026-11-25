/* Unified Reader visual witness — opt-in ?reader-pilot=1.
 * The real article, headings, links and footnotes are the only data sources.
 * Common shells for articles, series chapters, book chapters and references.
 * Does not touch native Product controls, audio state, repo, or servers. */
(() => {
 'use strict';
 const c=window.GBReaderContract;
 const readerState=window.ReaderState;
 if(!c || !readerState || typeof readerState.subscribe!=='function' || typeof readerState.getSnapshot!=='function' || document.getElementById('npUniversalDemo'))return;
 const model=c.inspect(document), check=c.validate(model);
 if(!check.valid)return;
 // Source root is resolved ONCE by the semantic Reader contract.
 const article=c.articleRoot(document);
 const main=article?.matches('main')?article:article?.closest('main');
 if(!article||!main)return;
 if(article.matches('article'))article.setAttribute('data-reader-projection','');
 main.classList.add('np-u-reader-main');
 // W40 opt-in A/B visual mode, real Product controls unchanged.
 const paperMode=new URLSearchParams(location.search).get('paper');
 document.body.classList.add(paperMode==='book'?'np-u-w40-book':'np-u-w40-space');
 const root=document.createElement('div');root.id='npUniversalDemo';
 // The article stays in its original main. This sibling contains only reader UI.
 root.dataset.printPolicy='exclude';
 const $=(q,s=document)=>s.querySelector(q);
 const $$=(q,s=document)=>[...s.querySelectorAll(q)];
 const escape=s=>String(s??'').replace(/[&<>"']/g,t=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[t]));
 const types={'article':'СТАТЬЯ','series-chapter':'ГЛАВА СЕРИИ','book-chapter':'ГЛАВА КНИГИ','reference':'СПРАВОЧНИК'};
 const plural=(n,a,b,c)=>{const rem=n%100;const v=n%10;return rem>10&&rem<20?c:v===1?a:v>=2&&v<=4?b:c;};
 const sections=model.groups;
 const compact=model.compactOutline||sections.slice(0,7);
 const h1=document.querySelector('h1');
 const pageTitle=h1?.textContent?.replace(/\s+/g,' ').trim()||document.title;
 const draftTitle=model.kind==='reference'?'Разделы справочника':model.kind==='article'?'Оглавление статьи':'Оглавление главы';
 const outlineEntries=sections.map((s,i)=>({s,i,sub:s.items.filter(t=>t.id!==s.id)}));
 const navCards=outlineEntries.map(({s,i,sub})=>
  '<div class="np-u-group" data-np-u-group="'+i+'"><div class="np-u-major"><span class="np-u-numeral">'+escape(s.numeral)+'</span><a href="#'+escape(s.id)+'" class="np-u-major-link" data-np-u-goto="'+escape(s.id)+'">'+escape(s.title)+'</a></div>'+
  (sub.length?'<details class="np-u-sub"'+(sections.length<=3?' open':'')+'><summary>'+sub.length+' '+plural(sub.length,'подпункт','подпункта','подпунктов')+' <span aria-hidden="true">⌄</span></summary><div class="np-u-children">'+sub.map(t=>'<a href="#'+escape(t.id)+'" data-np-u-goto="'+escape(t.id)+'" class="np-u-child np-u-h'+t.level+'">'+escape(t.label)+'</a>').join('')+'</div></details>':'')+'</div>').join('');
 const spine=compact.map(s=>'<button type="button" class="np-u-spine-item" data-np-u-goto="'+escape(s.id)+'" title="'+escape(s.title)+'" aria-label="Раздел '+escape(s.numeral)+': '+escape(s.title)+'">'+escape(s.numeral)+'</button>').join('');
 const appx=model.appendices?.length?'<details class="np-u-appendices"><summary>Дополнительные материалы</summary><div>'+model.appendices.map(t=>'<a data-np-u-goto="'+escape(t.id)+'" href="#'+escape(t.id)+'">'+escape(t.label)+'</a>').join('')+'</div></details>':'';
 root.innerHTML=
 '<aside id="npUOutline" aria-label="'+escape(draftTitle)+'" class="np-u-left">'+
  '<header class="np-u-left-head"><span class="np-u-monogram">GB</span><div class="np-u-left-title"><span class="np-u-eyebrow">'+escape(types[model.kind]||'МАТЕРИАЛ')+'</span><strong>'+escape(draftTitle)+'</strong></div><button type="button" id="npUFold" class="np-u-fold" aria-label="Свернуть оглавление" aria-expanded="true" title="Свернуть оглавление">'+
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.2"/><path d="M9.4 4.6v14.8m6.1-10.5-3.1 3.1 3.1 3.1"/></svg></button></header>'+
  '<div class="np-u-left-full"><div class="np-u-paper-title">'+escape(pageTitle)+'</div><div class="np-u-rail-stat">'+model.counts.headings+' заголовков · '+sections.length+' узлов</div>'+
    '<nav class="np-u-nav" aria-label="'+escape(draftTitle)+'">'+navCards+appx+'</nav></div>'+
  '<div class="np-u-rail-spine"><div class="np-u-spine-line" aria-hidden="true"></div>'+spine+'</div>'+
  '<footer class="np-u-left-foot"><span>Навигация Reader</span><span class="np-u-foot-mark">I — '+escape(compact.at(-1)?.numeral||'I')+'</span></footer></aside>'+
 '<aside id="npUResearch" aria-label="Аналитика" class="np-u-right"><header class="np-u-right-head"><div><span class="np-u-eyebrow">АНАЛИТИКА · '+escape(types[model.kind]||'МАТЕРИАЛ')+'</span><strong>Исследовательский контекст</strong></div><button type="button" id="npUCloseRight" aria-label="Свернуть Аналитика" title="Свернуть Аналитика"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.2"/><path d="M15 4.6v14.8m-3.3-10.5 3.1 3.1-3.1 3.1"/></svg></button></header>'+
 '<div class="np-u-right-scroll"><div id="npUSectionHost"></div><div id="npUOtherHost"></div>'+
  '<div class="np-u-source-note">Фрагменты и ссылки — из текста этой статьи.</div></div></aside>'+
 '<div id="npUBackdrop" class="np-u-backdrop" hidden></div>'+
 '<div class="np-u-mobilebar"><button type="button" id="npUOpenToc">Оглавление</button><span class="np-u-mobilebar-title">'+escape(types[model.kind]||'READER')+'</span><button type="button" id="npUOpenResearch">Аналитика</button></div>';

 // ARGON UPDATE: actual source-based visual structure, no new article content.
 const argonSvg=(id)=>{
  const paths={
   'panel-left-close':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m7-12-3 3 3 3"/>',
   'panel-left-open':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m4-9 3 3-3 3"/>',
   'panel-right-close':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18m-7-12 3 3-3 3"/>',
   'panel-right-open':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18m-4-9-3 3 3 3"/>',
   'list':'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
   'book-open':'<path d="M12 7v14M3 18V5c3-1 6-1 9 1v14c-3-2-6-2-9-1zM21 18V5c-3-1-6-1-9 1v14c3-2 6-2 9-1z"/>',
   'chevron-down':'<path d="m6 9 6 6 6-6"/>',
   'chevron-right':'<path d="m9 18 6-6-6-6"/>',
   'bookplate':'<path d="M12 3v18M7.5 7.5h9M5 19.5c2.2-1.1 4.5-1.1 7 0 2.5-1.1 4.8-1.1 7 0V5.5c-2.2-1.1-4.5-1.1-7 0-2.5-1.1-4.8-1.1-7 0v14z"/>',
   'play':'<path d="m8 5 11 7-11 7V5z"/>',
   'pause':'<path d="M8 5v14M16 5v14"/>',
   'notebook-pen':'<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M9 3v18m3-10 5-5 2 2-5 5-3 1 1-3Z"/>',
   'search':'<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4.5 4.5"/>',
   'bookmark':'<path d="M6 4h12v17l-6-4-6 4V4z"/>'
  };
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[id]||paths.list)+'</svg>';
 };
 root.classList.add('np-u-argon');
 document.body.classList.add('np-u-argon-shell');
 root.querySelector('.np-u-left-head').innerHTML=
  '<span class="np-u-argon-bookmark">'+argonSvg('bookplate')+'</span>'+
  '<div class="np-u-left-title"><strong class="np-u-argon-wordmark">Господь Бог<span>Сила моя</span></strong><span class="np-u-argon-library">Богословская библиотека</span></div>'+
  '<button type="button" id="npUFold" class="np-u-fold" aria-label="Свернуть оглавление" aria-expanded="true" title="Свернуть оглавление">'+argonSvg('panel-left-close')+'</button>';
 root.querySelector('.np-u-paper-title').textContent='Оглавление';
 root.querySelector('.np-u-rail-stat').textContent=sections.length+' '+plural(sections.length,'глава','главы','глав')+' · '+model.counts.headings+' §';
 // The ORIGINAL ARGON BookTOC has independent nested chapter toggles. Add
 // a lightweight top-level TOC disclosure, distinct from closing the rail.
 const tocBody=root.querySelector('.np-u-left-full');
 const tocHead=document.createElement('div');
 tocHead.className='np-u-toc-head';
 const tocText=document.createElement('div');tocText.className='np-u-toc-label';
 tocText.append(root.querySelector('.np-u-paper-title'),root.querySelector('.np-u-rail-stat'));
 const tocToggle=document.createElement('button');
 tocToggle.type='button';tocToggle.id='npUTocContentFold';
 tocToggle.className='np-u-toc-toggle';
 tocToggle.setAttribute('aria-label','Свернуть разделы оглавления');
 tocToggle.setAttribute('aria-expanded','true');
 tocToggle.setAttribute('aria-controls','npUChapterList');
 tocToggle.innerHTML=argonSvg('chevron-down');
 tocHead.append(tocText,tocToggle);tocBody.prepend(tocHead);
 const tocPeek=document.createElement('div');
 tocPeek.className='np-u-toc-peek';
 tocPeek.innerHTML='<span class="np-u-peek-eyebrow">СЕЙЧАС ЧИТАЕТЕ</span>'+
   '<a href="#" class="np-u-peek-current" data-np-u-toc-peek data-np-u-goto=""></a>'+
   '<button type="button" id="npUTocPeekExpand">Показать все главы '+argonSvg('chevron-right')+'</button>';
 tocHead.after(tocPeek);
 tocPeek.querySelector('#npUTocPeekExpand').addEventListener('click',()=>tocToggle.click());
 root.querySelector('.np-u-nav').id='npUChapterList';
 tocToggle.addEventListener('click',()=>{
   const closed=tocBody.classList.toggle('np-u-toc-closed');
   tocToggle.setAttribute('aria-expanded',String(!closed));
   tocToggle.setAttribute('aria-label',closed?'Развернуть разделы оглавления':'Свернуть разделы оглавления');
 });

 const toc=root.querySelector('.np-u-nav');
 toc.innerHTML=outlineEntries.map(({s,i,sub})=>
  '<div class="np-u-group" data-np-u-group="'+i+'"><div class="np-u-major">'+
   '<a href="#'+escape(s.id)+'" class="np-u-major-link" data-np-u-goto="'+escape(s.id)+'">'+
   '<span class="np-u-numeral">'+escape(s.numeral)+'.</span><span class="np-u-major-name">'+escape(s.title)+'</span></a>'+
   '</div>'+
   (sub.length?'<details class="np-u-sub"'+(i===0?' open':'')+'><summary aria-label="Раскрыть подпункты '+escape(s.numeral)+'" title="Подразделы">'+argonSvg('chevron-right')+'</summary>'+
      '<div class="np-u-children">'+sub.map(t=>'<a href="#'+escape(t.id)+'" data-np-u-goto="'+escape(t.id)+'" class="np-u-child np-u-h'+t.level+'">'+escape(t.label)+'</a>').join('')+'</div></details>':'')+
  '</div>').join('');
 root.querySelector('.np-u-right-head').innerHTML=
  '<div class="np-u-argon-right-heading"><strong>Аналитика</strong><span>Работа с текстом</span></div>'+
  '<div class="np-u-right-actions" role="group" aria-label="Инструменты панели">'+
  '<button type="button" id="npUHistoryButton" aria-label="История чтения" title="История чтения" aria-expanded="false" aria-controls="npUHistoryDrawer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7M3 3v5h5M12 7v5l3 2"/></svg></button>'+
  '<button type="button" id="npULibraryButton" aria-label="Закладки и библиотека" title="Закладки и библиотека"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4z"/></svg></button>'+
  '<button type="button" id="npUCloseRight" aria-label="Свернуть панель «Аналитика»" title="Свернуть панель «Аналитика»">'+argonSvg('panel-right-close')+'</button></div>';
 root.querySelector('#npUResearch').setAttribute('aria-label','Аналитика');
 const historyDrawer=document.createElement('div');
 historyDrawer.id='npUHistoryDrawer';historyDrawer.className='np-u-history-drawer';
 historyDrawer.setAttribute('role','region');
 historyDrawer.setAttribute('aria-label','Недавно прочитанные разделы');
 historyDrawer.hidden=true;
 root.querySelector('#npUResearch .np-u-right-head').after(historyDrawer);
 const historyTrail=[];
 function recordHistory(index){
  if(index<0||index>=sections.length)return;
  const section=sections[index];
  if(historyTrail.at(-1)?.id===section.id)return;
  historyTrail.push({id:section.id,label:section.title,number:section.numeral});
  if(historyTrail.length>12)historyTrail.shift();
  historyDrawer.innerHTML='<strong>История чтения</strong>'+
   '<ol>'+historyTrail.slice().reverse().map(item=>
    '<li><button type="button" data-np-u-goto="'+escape(item.id)+'"><span>'+escape(item.number)+'.</span>'+escape(item.label)+'</button></li>').join('')+'</ol>';
 }
 const historyButton=root.querySelector('#npUHistoryButton');
 historyButton.addEventListener('click',()=>{
  historyDrawer.hidden=!historyDrawer.hidden;
  historyButton.setAttribute('aria-expanded',String(!historyDrawer.hidden));
  if(!historyDrawer.hidden)historyDrawer.querySelector('button')?.focus({preventScroll:true});
 });
 const libraryButton=root.querySelector('#npULibraryButton');
 libraryButton.setAttribute('aria-haspopup','dialog');
 libraryButton.setAttribute('aria-expanded','false');
 libraryButton.disabled=true;
 // Product owns the entire async lifecycle and actual opener ARIA/focus.
 libraryButton.addEventListener('click',event=>{
  const opener=event.currentTarget;
  if(typeof window.GBHighlights?.open==='function')window.GBHighlights.open(opener);
 });
 // ARGON RightResearchPanel: the live section follows the article; every
 // window below has its own collapse and maximise controls.
 const follow=document.createElement('div');
 follow.className='np-u-research-follow';
 follow.innerHTML='<button type="button" id="npUFollowToggle" aria-pressed="true" title="Переключить автоматическое следование"><i aria-hidden="true"></i> Следует за чтением</button><span id="npUFollowChapter">Раздел I</span>';
 root.querySelector('.np-u-right-scroll').before(follow);
 let followEnabled=true;
 follow.querySelector('#npUFollowToggle').addEventListener('click',event=>{
  followEnabled=!followEnabled;
  event.currentTarget.setAttribute('aria-pressed',String(followEnabled));
  event.currentTarget.lastChild.textContent=followEnabled?' Следует за чтением':' Ручной выбор';
  if(followEnabled)show(currentGroupIndex());
 });

 const tocMobile=root.querySelector('#npUOpenToc');
 const rightMobile=root.querySelector('#npUOpenResearch');
 tocMobile.innerHTML=argonSvg('list')+'<span>Оглавление</span>';
 rightMobile.innerHTML=argonSvg('book-open')+'<span>Аналитика</span>';
 root.querySelector('.np-u-left-foot > span:first-child').textContent='Чтение';

 // Left controls are views of the site-wide canonical preferences only.
 // W57's one-time legacy migration remains in reader_w57.js.
 const fontPanel=document.createElement('section');
 fontPanel.id='npUFontPanel';fontPanel.className='np-u-font-panel';
 fontPanel.setAttribute('role','region');fontPanel.hidden=true;
 fontPanel.setAttribute('aria-labelledby','npUFontPanelTitle');
 fontPanel.innerHTML='<header><strong id="npUFontPanelTitle">Настройки чтения</strong>'+
  '<button type="button" class="np-u-type-close" aria-label="Закрыть настройки чтения">×</button></header>'+
  '<div class="np-u-type-group"><span>Тема</span><div class="np-u-type-options">'+
  '<button type="button" data-np-u-type-theme="light"><span class="np-w57-swatch" aria-hidden="true" style="background:#fbf9f3"></span>День</button>'+
  '<button type="button" data-np-u-type-theme="sepia"><span class="np-w57-swatch" aria-hidden="true" style="background:#e5d2ad"></span>Сепия</button>'+
  '<button type="button" data-np-u-type-theme="dark"><span class="np-w57-swatch" aria-hidden="true" style="background:#2a2724"></span>Ночь</button></div></div>'+
  '<div class="np-u-type-group"><span>Книжная гарнитура</span><div class="np-u-type-options">'+
  '<button type="button" data-np-u-type-font="lora" class="np-u-type-lora"><span class="np-w57-fontname">Lora</span><span class="np-w57-fontsample">Слово и мысль</span></button>'+
  '<button type="button" data-np-u-type-font="cormorant" class="np-u-type-cormorant"><span class="np-w57-fontname">Cormorant Garamond</span><span class="np-w57-fontsample">Слово и мысль</span></button></div></div>'+
  '<div class="np-u-type-group"><span>Размер текста</span><div class="np-w57-size-control">'+
  '<button type="button" data-np-u-scale-step="-1" aria-label="Уменьшить размер текста">А−</button>'+
  '<div class="np-w57-size-center"><output class="np-w57-size-value" data-np-u-scale-value aria-live="polite" aria-atomic="true">100%</output>'+
  '<input class="np-w57-size-range" data-np-u-scale-range type="range" min="85" max="125" step="5" aria-label="Размер текста, проценты"></div>'+
  '<button type="button" data-np-u-scale-step="1" aria-label="Увеличить размер текста">А+</button></div></div>'+
  '<div class="np-u-type-group"><span>Межстрочный интервал</span><div class="np-u-type-options">'+
  '<button type="button" data-np-u-type-spacing="compact"><svg class="np-w57-glyph" viewBox="0 0 32 18" aria-hidden="true" fill="none"><line x1="5" x2="27" y1="6" y2="6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="5" x2="27" y1="9" y2="9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="5" x2="24" y1="12" y2="12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg><span>Плотный</span></button>'+
  '<button type="button" data-np-u-type-spacing="normal"><svg class="np-w57-glyph" viewBox="0 0 32 18" aria-hidden="true" fill="none"><line x1="5" x2="27" y1="4" y2="4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="5" x2="27" y1="9" y2="9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="5" x2="24" y1="14" y2="14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg><span>Книжный</span></button>'+
  '<button type="button" data-np-u-type-spacing="relaxed"><svg class="np-w57-glyph" viewBox="0 0 32 18" aria-hidden="true" fill="none"><line x1="5" x2="27" y1="2" y2="2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="5" x2="27" y1="9" y2="9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="5" x2="24" y1="16" y2="16" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg><span>Свободный</span></button></div></div>'+
  '<div class="np-u-type-group"><span>Ширина наборной полосы</span><div class="np-u-type-options">'+
  '<button type="button" data-np-u-type-width="narrow"><svg class="np-w57-glyph" viewBox="0 0 32 18" aria-hidden="true" fill="none"><rect x="1" y="1" width="30" height="16" rx="2" stroke="currentColor" opacity=".4"/><line x1="10" x2="22" y1="5" y2="5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="10" x2="22" y1="9" y2="9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="10" x2="19" y1="13" y2="13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg><span>Узкая</span></button>'+
  '<button type="button" data-np-u-type-width="normal"><svg class="np-w57-glyph" viewBox="0 0 32 18" aria-hidden="true" fill="none"><rect x="1" y="1" width="30" height="16" rx="2" stroke="currentColor" opacity=".4"/><line x1="6" x2="26" y1="5" y2="5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="6" x2="26" y1="9" y2="9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="6" x2="23" y1="13" y2="13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg><span>Книжная</span></button>'+
  '<button type="button" data-np-u-type-width="wide"><svg class="np-w57-glyph" viewBox="0 0 32 18" aria-hidden="true" fill="none"><rect x="1" y="1" width="30" height="16" rx="2" stroke="currentColor" opacity=".4"/><line x1="3" x2="29" y1="5" y2="5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="3" x2="29" y1="9" y2="9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="3" x2="26" y1="13" y2="13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg><span>Широкая</span></button></div></div>'+
  '<details class="np-w57-sample"><summary class="np-w57-sample-label">ОБРАЗЕЦ ЧТЕНИЯ</summary>'+
  '<p>Слово и мысль. Внимательное чтение открывает глубину текста.</p></details>'+
  '<div class="np-u-type-group"><span>Оформление текста</span><div class="np-u-type-options">'+
  '<button type="button" data-np-u-type-text="rich">Полное</button>'+
  '<button type="button" data-np-u-type-text="plain">Простое</button></div></div>'+
  '<div class="np-u-type-group"><span>Анимация</span><div class="np-u-type-options">'+
  '<button type="button" data-np-u-type-motion="system">Обычная</button>'+
  '<button type="button" data-np-u-type-motion="reduced">Спокойная</button></div></div>'+
  '<div class="np-u-type-group np-u-type-options">'+
  '<button type="button" data-np-u-type-reset><svg class="np-w57-reset-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 1 2.65 6.36 M3 5v7h7"/></svg>Сбросить настройки</button></div>';
 const fullFontButton=document.createElement('button');
 fullFontButton.type='button';fullFontButton.className='np-u-type-open';
 fullFontButton.textContent='Аа · Настройки';fullFontButton.setAttribute('aria-label','Настройки чтения');
 const compactFontButton=document.createElement('button');
 compactFontButton.type='button';compactFontButton.className='np-u-type-compact';
 compactFontButton.textContent='Аа';compactFontButton.setAttribute('aria-label','Настройки чтения');
 // Only the opt-in preview replaces the native settings action. Keep its
 // presentation and position, not its listener/ARIA binding to the old sheet.
 const nativeSettings=[...document.querySelectorAll('[data-gill-settings-open]')].map(original=>{
  const trigger=original.cloneNode(true);
  trigger.removeAttribute('data-gill-settings-open');
  original.replaceWith(trigger);
  return trigger;
 });
 const fontToggles=[fullFontButton,compactFontButton,...nativeSettings];
 let fontOpener=null;
 const restoreFontFocus=()=>fontOpener?.focus({preventScroll:true});
 for(const b of fontToggles){
  b.setAttribute('aria-controls','npUFontPanel');b.setAttribute('aria-expanded','false');
  b.addEventListener('click',event=>{
   event.preventDefault();event.stopImmediatePropagation();
   if(fontPanel.hidden)fontOpener=b;
   setFontOpen(fontPanel.hidden);
   if(fontPanel.hidden)restoreFontFocus();
  },true);
 }
 root.querySelector('.np-u-left-foot').prepend(fullFontButton);
 root.querySelector('.np-u-rail-spine').append(compactFontButton);
 // The mobile TOC has aria-modal=true. Reparent the SAME popup into it;
 // on desktop keep it outside the clipped left rail.
 const fontScrim=document.createElement('div');
 fontScrim.id='npUFontScrim';fontScrim.className='np-u-font-scrim';
 fontScrim.setAttribute('aria-hidden','true');fontScrim.hidden=true;
 const priorInert=new Map();
 function positionFontPanel(){
  const host=isMobile()?root.querySelector('#npUOutline'):root;
  if(isMobile()){
   if(fontScrim.parentElement!==host)host.append(fontScrim);
  }else fontScrim.remove();
  if(fontPanel.parentElement!==host)host.append(fontPanel);
 }
 function syncFontDialog(open){
  const mobile=open&&isMobile(),host=root.querySelector('#npUOutline');
  fontScrim.hidden=!mobile;
  fontPanel.setAttribute('role',mobile?'dialog':'region');
  for(const b of fontToggles)b.setAttribute('aria-haspopup',isMobile()?'dialog':'false');
  if(mobile)fontPanel.setAttribute('aria-modal','true');
  else fontPanel.removeAttribute('aria-modal');
  for(const child of host.children){
   if(child===fontPanel||child===fontScrim)continue;
   if(mobile){
    if(!priorInert.has(child))priorInert.set(child,child.inert);
    child.inert=true;
   }else if(priorInert.has(child)){
    child.inert=priorInert.get(child);priorInert.delete(child);
   }
  }
 }
 positionFontPanel();
 syncFontDialog(false);
 function setFontOpen(open){
  fontPanel.hidden=!open;
  syncFontDialog(open);
  for(const b of fontToggles)b.setAttribute('aria-expanded',String(open));
  if(open)fontPanel.querySelector('button[aria-pressed="true"]')?.focus({preventScroll:true});
 }
 fontPanel.addEventListener('click',event=>{
  if(event.target.closest('.np-u-type-close')){
   setFontOpen(false);
   restoreFontFocus();
   return;
  }
  const b=event.target.closest('button');
  if(!b)return;
  const canon=window.GBReaderPreferences;
  if(!canon||typeof canon.set!=='function')return;
   if(b.hasAttribute('data-np-u-type-reset')){canon.reset();return}
   const patch={};
   if(b.dataset.npUTypeTheme)patch.theme=b.dataset.npUTypeTheme;
   if(b.dataset.npUTypeText)patch.textMode=b.dataset.npUTypeText;
   if(b.dataset.npUTypeMotion)patch.motion=b.dataset.npUTypeMotion;
   if(b.dataset.npUTypeFont)patch.fontFamily=b.dataset.npUTypeFont;
   if(b.hasAttribute('data-np-u-scale-step')){
    const delta=Number(b.dataset.npUScaleStep);
    if(b.getAttribute('aria-disabled')!=='true'&&(delta===-1||delta===1))
      canon.set(v=>({fontScale:v.fontScale+delta/20}),{source:'argon-w57-left-settings'});
    return;
   }
   if(b.dataset.npUTypeSpacing)patch.lineHeight=b.dataset.npUTypeSpacing;
   if(b.dataset.npUTypeWidth)patch.measure=b.dataset.npUTypeWidth;
   if(Object.keys(patch).length)canon.set(patch,{source:'argon-w57-left-settings'});
 });
 fontPanel.addEventListener('input',event=>{
  if(event.target.matches('[data-np-u-scale-range]')){
   const value=Number(event.target.value);
   if(Number.isFinite(value))window.GBReaderPreferences?.set({fontScale:value/100},{source:'argon-w57-left-settings'});
  }
 });
 document.addEventListener('pointerdown',event=>{
  if(!fontPanel.hidden&&!fontPanel.contains(event.target)&&!fontToggles.some(b=>b.contains(event.target))){
   setFontOpen(false);
   restoreFontFocus();
  }
 },true);
 document.addEventListener('keydown',event=>{
  if(fontPanel.hidden)return;
  // A native Product Library/Search dialog remains higher priority.
  if(event.target.closest?.('#gb-hl-panel,.cp-backdrop'))return;
  if(event.key==='Escape'){
   // Close the topmost settings popup without simultaneously closing mobile TOC.
   event.preventDefault();event.stopImmediatePropagation();
   setFontOpen(false);
   restoreFontFocus();
   return;
  }
  if(event.key==='Tab'){
   // The settings popup is a descendant of the mobile TOC modal DOM.
   const controls=[...fontPanel.querySelectorAll('button:not([disabled]),input:not([disabled]),summary')]
    .filter(el=>el.getClientRects().length&&!el.closest('[hidden],[inert]'));
   const first=controls[0],last=controls.at(-1),active=document.activeElement;
   if(first&&event.shiftKey&&(active===first||!fontPanel.contains(active))){
    event.preventDefault();last.focus({preventScroll:true});
   }else if(first&&!event.shiftKey&&(active===last||!fontPanel.contains(active))){
    event.preventDefault();first.focus({preventScroll:true});
   }
   event.stopImmediatePropagation();
  }
 });
 // Canonical bootstrap and W57 subscription set the initial presentation.

 // Optional native Product adapter for older hrail/FloatingControls pages.
 // Move the original controls, not copies. Core event owners and TTS state remain
 // unchanged; suppress duplicated visual navigation ONLY after all controls dock.
 function dockLegacyChrome(){
  if(document.body.classList.contains('np-u-legacy-chrome-docked'))return true;
  const legacy=document.querySelector('aside.hrail');
  const floater=document.getElementById('gbFloatingControls');
  const bottom=legacy?.querySelector('.hrail-bottom');
  if(!legacy||!floater||!bottom)return false;
  const left=root.querySelector('#npUOutline');
  const header=left?.querySelector('.np-u-left-head');
  const foot=left?.querySelector('.np-u-left-foot');
  if(!header||!foot)return false;
  const shelf=document.createElement('section');
  shelf.id='npUNativeTools';
  shelf.className='np-u-native-tools';
  shelf.setAttribute('aria-label','Инструменты чтения');
  shelf.innerHTML='<div class="np-u-native-tools-title">ИНСТРУМЕНТЫ ЧТЕНИЯ</div><div class="np-u-native-toolrows"></div>';
  const actions=shelf.querySelector('.np-u-native-toolrows');
  left.insertBefore(shelf,foot);
  actions.append(floater,bottom);
  // The native tools shelf is hidden by ARGON product mode. Keep the actual
  // menu/share/export owners in the permanent left utility row instead.
  const utilityActions=Array.from(bottom.querySelectorAll(':scope > #hMobileMenuBtn,:scope > [data-action="share"],:scope > [data-action="print"]'));
  if(utilityActions.length){
    const utility=document.createElement('div');
    utility.className='np-u-narrow-series-actions np-u-legacy-utility-actions';
    utility.setAttribute('role','group');utility.setAttribute('aria-label','Меню сайта и действия с чтением');
    left.insertBefore(utility,foot);
    utility.append(...utilityActions);
  }
  // ARGON LEFTNAV: the REAL Product Play, its rate buttons, a compact
  // audio caption and an inline speed chooser. All Product handlers persist.
  const playWrap=floater.querySelector('.gb-ember-playwrap');
  const speeds=playWrap?.querySelector('.gb-ember-expand');
  const favorite=floater.querySelector('.gb-save');
  if(playWrap&&speeds&&favorite){
    floater.classList.add('np-u-argon-audio');
    const caption=document.createElement('span');
    caption.className='np-u-argon-audio-caption';
    caption.innerHTML='<strong><span class="np-u-audio-label-long">Чтение вслух</span><span class="np-u-audio-label-short">Чтение</span></strong><small><span class="np-u-audio-label-long">Озвучивание</span><span class="np-u-audio-label-short">Аудио</span></small>';
    const trigger=document.createElement('button');
    trigger.type='button';trigger.className='np-u-argon-rate-trigger';
    trigger.setAttribute('aria-label','Выбрать скорость чтения');
    trigger.setAttribute('aria-controls',speeds.id);
    trigger.setAttribute('aria-expanded','false');
    const badge=playWrap.querySelector('.gbs-rail-spdbadge');
    trigger.textContent=badge?.textContent?.trim()||'1×';
    floater.insertBefore(caption,favorite);
    floater.insertBefore(trigger,favorite);
    floater.appendChild(speeds);
    const toggle=(isOpen)=>{
      floater.classList.toggle('np-u-argon-rate-open',!!isOpen);
      trigger.setAttribute('aria-expanded',String(!!isOpen));
      speeds.inert=!isOpen;
    };
    trigger.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      const opened=!floater.classList.contains('np-u-argon-rate-open');
      toggle(opened);
      if(opened)speeds.querySelector('[aria-checked="true"]')?.focus({preventScroll:true});
    });
    new MutationObserver(()=>{
      if(floater.classList.contains('np-u-argon-rate-open')&&speeds.inert)speeds.inert=false;
    }).observe(speeds,{attributes:true,attributeFilter:['inert']});
    speeds.addEventListener('click',event=>{
      if(event.target.closest('[data-speed],[data-fc-action="stop"]')){
        requestAnimationFrame(()=>toggle(false));
        trigger.focus({preventScroll:true});
      }
    });
    document.addEventListener('pointerdown',event=>{
      if(!floater.contains(event.target))toggle(false);
    },true);
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&floater.classList.contains('np-u-argon-rate-open')){
        toggle(false);trigger.focus({preventScroll:true});
      }
    });
    const updateSpeed=()=>{if(badge)trigger.textContent=badge.textContent.trim();};
    window.addEventListener('gb:tts-rate-change',updateSpeed);
    if(badge)new MutationObserver(updateSpeed).observe(badge,{childList:true,characterData:true,subtree:true});
    toggle(false);
  }
  // Move the actual native theme/search buttons into "Аналитика".
  // Both controls carry their original Product listeners and states.
  const right=root.querySelector('#npUResearch');
  const rightScroll=right?.querySelector('.np-u-right-scroll');
  const theme=floater.querySelector('#gbFcTheme');
  const search=floater.querySelector('#gbFcSearch');
  if(rightScroll&&theme&&search){
    const researchActions=document.createElement('div');
    researchActions.id='npUNativeResearchActions';
    researchActions.setAttribute('role','group');
    researchActions.setAttribute('aria-label','Тема и поиск');
    researchActions.append(theme,search);
    theme.title='Переключить тему';
    search.title='Поиск по сайту';
    for(const [button,caption] of [[theme,'Тема'],[search,'Поиск']]){
      if(!button.querySelector('.np-u-global-action-label')){
        const label=document.createElement('span');
        label.className='np-u-global-action-label';label.textContent=caption;
        button.append(label);
      }
    }
    right.insertBefore(researchActions,rightScroll);
    // On desktop these are library-wide controls. Place the REAL Product
    // buttons in the left rail, not the closable research panel.
    if(matchMedia('(min-width:1121px)').matches){
      const toc=left.querySelector('.np-u-left-full');
      if(toc)left.insertBefore(researchActions,toc);
    }
  }
  const back=legacy.querySelector('.hrail-back');
  if(back){
    // Argon has exactly ONE folding button in its header. Keep native Back
    // functional, but put it in the existing Product utility row.
    back.classList.add('np-u-native-back');
    bottom.append(back);
  }
  legacy.inert=true;
  legacy.setAttribute('aria-hidden','true');
  legacy.dataset.npPilotDocked='true';
  document.body.classList.add('np-u-legacy-chrome-docked');
  return true;
 }

 // Series pages (Gill, Baptists, etc.) have a different REAL Product rail:
 // .gbs-theme-corner instead of aside.hrail/#gbFloatingControls. Dock those
 // existing controls too, without manufacturing fake theme/search buttons.
 // Product places the SAME action cluster under .reader-rail-compact-tools
  // when a previously folded rail is restored on navigation. Find both
  // direct and nested ownership: this must work on EVERY series chapter.
  const nativeSeriesRoot=document.querySelector('.gbs2-world .gbs-theme-corner[data-fc-root]');
 const nativeLegacyRoot=document.getElementById('gbFloatingControls');
 const nativeLegacyHome=nativeLegacyRoot?.parentElement;
 function dockSeriesChrome(){
  const native=nativeSeriesRoot;
  if(!native||native.dataset.npPilotDocked==='true')return false;
  const left=root.querySelector('#npUOutline'),right=root.querySelector('#npUResearch');
  const theme=native.querySelector('button[data-fc-action="theme"]');
  const search=native.querySelector('button[data-fc-action="search"]');
  const audio=native.querySelector('.gbs-rail-playwrap');
  const favorite=native.querySelector('.gb-save');
  // Preserve Product's action-cluster scope when relocating the original
  // audio control. Without it a document-capture fallback plus the native
  // button listener each toggle TTS: playing -> paused in one click.
  const nativeAudioScope=audio?.closest('[data-fc-root],[data-fc-controls]');
  if(!left||!right||!theme||!search)return false;
  // Product controls are unique on each page. IDs are assigned only where
  // absent to share the ARGON presentation; their original listeners remain.
  theme.id='gbFcTheme';search.id='gbFcSearch';
  theme.title='Переключить тему';search.title='Поиск по сайту';
  for(const [button,caption] of [[theme,'Тема'],[search,'Поиск']]){
   if(!button.querySelector('.np-u-global-action-label')){
    const label=document.createElement('span');
    label.className='np-u-global-action-label';label.textContent=caption;
    button.append(label);
   }
  }
  const bar=document.createElement('div');
  bar.id='npUNativeResearchActions';
  bar.setAttribute('role','group');bar.setAttribute('aria-label','Тема и поиск');
  bar.append(theme,search);
  right.insertBefore(bar,right.querySelector('.np-u-right-scroll'));
  const toc=left.querySelector('.np-u-left-full');
  if(matchMedia('(min-width:1121px)').matches&&toc)left.insertBefore(bar,toc);
  if(audio){
   const shelf=document.createElement('section');
   shelf.id='npUNativeTools';shelf.className='np-u-native-tools np-u-series-native-tools';
   shelf.setAttribute('aria-label','Инструменты чтения');
   if(nativeAudioScope?.hasAttribute('data-fc-root')){
    shelf.setAttribute('data-fc-root',nativeAudioScope.getAttribute('data-fc-root'));
   }else if(nativeAudioScope?.hasAttribute('data-fc-controls')){
    shelf.setAttribute('data-fc-controls',nativeAudioScope.getAttribute('data-fc-controls'));
   }
   const wrap=document.createElement('div');wrap.className='np-u-native-toolrows';
   shelf.append(wrap);left.insertBefore(shelf,left.querySelector('.np-u-left-foot'));
   wrap.append(audio);
   // Product's Stop command was delegated to the original .gbs-theme-corner.
   // Moving the authentic playwrap preserves direct Play/rate handlers, but
   // detaches Stop from that original event owner. Bind this one action to
   // Product's existing TTS singleton at the docking seam: no second engine,
   // no synthesized click, and no replacement of the native button.
   const nativeStop=audio.querySelector('button[data-fc-action="stop"]');
   if(nativeStop&&!nativeStop.dataset.npUStopBound){
    nativeStop.dataset.npUStopBound='1';
    nativeStop.addEventListener('click',()=>window.GBReaderTTS?.stop?.());
   }
   // Both Product page variants use ONE audio row. Reparent the original
   // Save control inside the existing Product audio host; its listeners stay.
   if(favorite)audio.append(favorite);
  }
  native.dataset.npPilotDocked='true';
  document.body.classList.add('np-u-legacy-chrome-docked');
  return true;
 }

 // Use the REAL Product floating action cluster on desktop, not SVG replicas.
 // When viewport returns to mobile, put the same DOM controls back into the
 // existing Reader shelf; no duplicate controllers, new TTS or new storage.
 function syncNativeSeriesControlMode(){
  if(!nativeSeriesRoot)return;
  const mobile=matchMedia('(max-width:1120px)').matches;
  const currentlyFloating=nativeSeriesRoot.dataset.npUNativeFloating==='1';
  if(mobile===!currentlyFloating){
   // The native Product responsive handler may move its own cluster back
   // into .gbs2-world *after* our resize listener. Keep the SAME DOM node.
   if(!mobile&&currentlyFloating&&nativeSeriesRoot.parentElement!==document.body)
    document.body.append(nativeSeriesRoot);
   return;
  }
  const bar=root.querySelector('#npUNativeResearchActions');
  const shelf=root.querySelector('#npUNativeTools');
  const card=shelf?.querySelector('.np-u-audio-card');
  const top=nativeSeriesRoot.querySelector('[data-fc-action="scroll-top"]');
  if(!bar||!shelf||!top)return;
  if(!mobile){
   const theme=bar.querySelector('#gbFcTheme'),search=bar.querySelector('#gbFcSearch');
   const audio=shelf.querySelector('.gbs-rail-playwrap');
   const save=audio?.querySelector('.gb-save');
   if(!(theme&&search&&audio&&save))return;
   // W15 created optional Product-series text/speed extras. Stash their
   // ORIGINAL nodes in the hidden audio card, preserving their listeners.
   // The native Product speed popup inside the audio wrap stays untouched.
   for(const extra of audio.querySelectorAll(':scope > .np-u-wave16-audio-caption,:scope > .np-u-wave15-series-rate')){
    extra.dataset.npUNativeStash='1';
    (card||shelf).append(extra);
   }
   audio.classList.remove('np-u-wave15-speed-open');
   const popup=audio.querySelector('.gb-ember-expand');
   if(popup)popup.inert=false;
   nativeSeriesRoot.insertBefore(theme,top);
   nativeSeriesRoot.insertBefore(search,top);
   nativeSeriesRoot.insertBefore(audio,top);
   nativeSeriesRoot.insertBefore(save,top);
   nativeSeriesRoot.classList.add('np-u-product-native-floating');
   // Root is appended directly to BODY to avoid being occluded by
   // #npUResearch. Native delegated handlers remain on this SAME node.
   document.body.append(nativeSeriesRoot);
   nativeSeriesRoot.dataset.npUNativeFloating='1';
   document.body.classList.add('np-u-native-product-actions');
   rightEdge.setAttribute('aria-label','Сворачивание панели «Аналитика»');
  }else{
   const theme=nativeSeriesRoot.querySelector('#gbFcTheme');
   const search=nativeSeriesRoot.querySelector('#gbFcSearch');
   const audio=nativeSeriesRoot.querySelector('.gbs-rail-playwrap');
   const save=nativeSeriesRoot.querySelector('.gb-save');
   if(!(theme&&search&&audio&&save))return;
   bar.append(theme,search);
   (card||shelf.querySelector('.np-u-native-toolrows')||shelf).prepend(audio);
   audio.append(save);
   // Reconnect the SAME W15 controls and their listeners.
   shelf.querySelectorAll('[data-np-u-native-stash="1"]').forEach(extra=>{
    audio.append(extra);
    delete extra.dataset.npUNativeStash;
   });
   nativeSeriesRoot.classList.remove('np-u-product-native-floating');
   nativeSeriesRoot.dataset.npUNativeFloating='0';
   document.body.classList.remove('np-u-native-product-actions');
   const world=document.querySelector('.gbs2-world');
   if(world)world.append(nativeSeriesRoot);
   rightEdge.setAttribute('aria-label','Быстрые действия чтения');
  }
 }
 // Restore the original Product #gbFloatingControls (legacy article pages).
 // Its genuine hover-speed popup and Save listener must remain inside the
 // original Product event root. Mobile keeps the existing Reader dock.
 function syncNativeLegacyControlMode(){
  if(!nativeLegacyRoot||nativeSeriesRoot)return;
  const mobile=matchMedia('(max-width:1120px)').matches;
  const floating=nativeLegacyRoot.dataset.npUNativeFloating==='1';
  if(mobile===!floating){
   if(!mobile&&floating&&nativeLegacyRoot.parentElement!==document.body)
    document.body.append(nativeLegacyRoot);
   return;
  }
  const bar=root.querySelector('#npUNativeResearchActions');
  const shelf=root.querySelector('#npUNativeTools');
  const card=shelf?.querySelector('.np-u-audio-card');
  const audio=nativeLegacyRoot.querySelector('.gb-ember-playwrap');
  const popup=nativeLegacyRoot.querySelector('.gb-ember-expand');
  if(!(bar&&shelf&&card&&audio))return;
  if(!mobile){
   const theme=bar.querySelector('#gbFcTheme');
   const search=bar.querySelector('#gbFcSearch');
   const save=nativeLegacyRoot.querySelector(':scope > .gb-save');
   if(!(theme&&search&&save))return;
   // The W15 accessory buttons retain their original event listeners and
   // are stashed in the hidden Reader shelf, not recreated on each resize.
   for(const extra of nativeLegacyRoot.querySelectorAll(':scope > .np-u-argon-audio-caption,:scope > .np-u-argon-rate-trigger')){
    extra.dataset.npUNativeStash='1';
    card.append(extra);
   }
   for(const extra of audio.querySelectorAll(':scope > .np-u-wave16-audio-caption,:scope > .np-u-wave15-series-rate')){
    extra.dataset.npUNativeStash='1';
    card.append(extra);
   }
   if(popup){
    (audio.querySelector('.gb-ember-wrap')||audio).append(popup);
    popup.inert=false;
   }
   nativeLegacyRoot.classList.remove('np-u-argon-audio','np-u-argon-rate-open');
   nativeLegacyRoot.insertBefore(theme,audio);
   nativeLegacyRoot.insertBefore(search,audio);
   nativeLegacyRoot.append(save);
   nativeLegacyRoot.classList.add('np-u-native-legacy-float');
   document.body.append(nativeLegacyRoot);
   nativeLegacyRoot.dataset.npUNativeFloating='1';
   document.body.classList.add('np-u-native-product-actions');
   rightEdge.setAttribute('aria-label','Сворачивание панели «Аналитика»');
  }else{
   const theme=nativeLegacyRoot.querySelector('#gbFcTheme');
   const search=nativeLegacyRoot.querySelector('#gbFcSearch');
   if(!(theme&&search))return;
   bar.append(theme,search);
   if(popup){
    nativeLegacyRoot.append(popup);
    popup.inert=true;
   }
   for(const extra of card.querySelectorAll('[data-np-u-native-stash="1"]')){
    nativeLegacyRoot.insertBefore(extra,nativeLegacyRoot.querySelector(':scope > .gb-save'));
    delete extra.dataset.npUNativeStash;
   }
   nativeLegacyRoot.classList.remove('np-u-native-legacy-float');
   nativeLegacyRoot.classList.add('np-u-argon-audio');
   nativeLegacyRoot.dataset.npUNativeFloating='0';
   document.body.classList.remove('np-u-native-product-actions');
   card.prepend(nativeLegacyRoot);
   rightEdge.setAttribute('aria-label','Быстрые действия чтения');
  }
 }
 // Native Product FAB remains floating in desktop native controls mode.
 // Mobile retains the original Reader dock.
 function dockNativeLibrary(){
  const fab=document.getElementById('gb-hl-fab');
  libraryButton.disabled=!(fab&&typeof window.GBHighlights?.open==='function');
  if(!fab)return false;
  if((nativeSeriesRoot||nativeLegacyRoot)&&!isMobile()){
   if(fab.parentElement!==document.body)document.body.append(fab);
   fab.classList.remove('np-u-library-native');
   return true;
  }
  const host=isMobile()?$('.np-u-mobilebar-title',root):$('.np-u-left-foot',root);
  if(!host)return false;
  if(fab.parentElement!==host)host.prepend(fab);
  fab.classList.remove('gb-hl-fab--docked','hrail-bottom-btn','hmbar-btn','gb-icon','bar-icon-btn');
  fab.classList.add('np-u-library-native');
  if(!fab.getAttribute('title'))fab.title='Библиотека: заметки и выделения';
  // The genuine Product FAB keeps its own handlers and stored notes.
  return true;
 }
 // Original Product supplies all real actions. Reader adds only ONE button:
 // fold / unfold «Аналитика», with no fake Play/Save/Notes/Search copies.
 const rightEdge=document.createElement('div');
 rightEdge.id='npURightEdgeRail';
 rightEdge.setAttribute('role','group');
 rightEdge.setAttribute('aria-label','Управление панелью «Аналитика»');
 rightEdge.innerHTML=
  '<button type="button" id="npUEdgeToggle" aria-controls="npUResearch" aria-expanded="true" title="Свернуть «Аналитика»" aria-label="Свернуть «Аналитика»">'+argonSvg('panel-right-close')+'</button>';
 const edgeToggle=rightEdge.querySelector('#npUEdgeToggle');
 root.appendChild(rightEdge);
 document.body.appendChild(root);
 document.body.classList.add('np-u-preview');
 function copyProductGlyph(target,sourceSelector,cssClass){
  const svg=document.querySelector(sourceSelector);
  if(!target||!svg)return false;
  const copy=svg.cloneNode(true);
  copy.setAttribute('class',cssClass||'np-u-product-glyph');
  copy.removeAttribute('style');
  copy.setAttribute('aria-hidden','true');
  target.replaceChildren(copy);
  return true;
 }

 // W29B: Native Product's compact rail hides [data-reader-fold-content].
 // Display chapter shortcuts using the REAL Product card hrefs, not replicas.
 function mountNativeCompactRomans(){
   const rail=document.querySelector('.gbs2-world > .gbs-rail[data-reader-integrated-rail="series"]');
   if(!rail||rail.querySelector(':scope > .np-u-native-roman-compact'))return;
   // W53: preserve this opt-in Reader across ALL authentic Gill series links,
   // not only the compact I-IV shortcuts. This keeps the native full rail
   // and editorial series cards on the same Reader design after navigation.
   const pilotArgs=new URLSearchParams(location.search);
   if(pilotArgs.get('reader-pilot')==='1'){
     for(const link of document.querySelectorAll(
       '.gbs2-world>.gbs-rail a.gbs-rail-card, article .gill-card a[href]')){
       const href=link.getAttribute('href');
       if(!href||href.startsWith('#'))continue;
       const target=new URL(href,location.href);
       if(target.origin!==location.origin||!target.pathname.startsWith('/articles/'))continue;
       target.searchParams.set('reader-pilot','1');
       const paper=pilotArgs.get('paper');
       if(paper==='space'||paper==='book')target.searchParams.set('paper',paper);
       link.href=target.pathname+target.search+target.hash;
     }
   }
   const entries=[];
   for(const card of rail.querySelectorAll('a.gbs-rail-card')){
     const mark=card.querySelector('.gb-roman');
     const roman=mark?.textContent?.trim();
     const href=card.getAttribute('href');
     if(!/^[IVXLCDM]+$/.test(roman||'')||!href)continue;
     entries.push({roman,href,title:card.querySelector('.gbs-rail-card__info b')?.textContent?.trim()||card.textContent.trim(),active:false});
   }
   const current=rail.querySelector('.gbs2-current');
   const match=current?.textContent?.match(/Часть\s+([IVXLCDM]+)\./i);
   if(match)entries.push({roman:match[1],href:null,title:(document.querySelector('main h1')?.textContent?.replace(/\s+/g,' ').trim()||current.textContent.trim().slice(0,90)),active:true});
   if(entries.length<2)return;
   const romanValue=s=>{
     const values={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};
     let sum=0,previous=0;
     for(let i=s.length-1;i>=0;i--){const value=values[s[i]];sum+=value<previous?-value:value;previous=value;}
     return sum;
   };
   entries.sort((a,b)=>romanValue(a.roman)-romanValue(b.roman));
   const unique=new Map();
   for(const item of entries)if(!unique.has(item.roman)||item.active)unique.set(item.roman,item);
   const nav=document.createElement('nav');
   nav.className='np-u-native-roman-compact';
   nav.setAttribute('aria-label','Части серии: компактная навигация');
   for(const item of unique.values()){
     const el=document.createElement(item.href?'a':'span');
     el.className='np-u-roman-shortcut';
     el.textContent=item.roman;
     el.title=item.title;
     if(item.href){
        const target=new URL(item.href,location.href);
        if(target.origin===location.origin&&new URLSearchParams(location.search).get('reader-pilot')==='1'){
          target.searchParams.set('reader-pilot','1');
          const paper=new URLSearchParams(location.search).get('paper');
          if(paper==='space'||paper==='book')target.searchParams.set('paper',paper);
        }
        el.href=target.pathname+target.search+target.hash;
        el.setAttribute('aria-label','Глава '+item.roman+': '+item.title);
      }
     if(item.active)el.setAttribute('aria-current','page');
     nav.append(el);
   }
   rail.append(nav);
 }

 // W15: adapt only the existing Product audio elements. The original play,
 // rate radios and their controller remain the single source of state.
 function mountWave15Audio(){
  const shelf=root.querySelector('#npUNativeTools');
  if(!shelf||shelf.dataset.npW15Audio==='1')return;
  const button=shelf.querySelector('.gb-ember[data-fc-action="play"]');
  const popup=shelf.querySelector('.gb-ember-expand[role="radiogroup"]');
  if(!button||!popup)return;
  const legacy=!!shelf.querySelector('#gbFloatingControls.np-u-argon-audio');
  const host=legacy?shelf.querySelector('#gbFloatingControls'):shelf.querySelector('.gbs-rail-playwrap');
  if(!host)return;
  let trigger=shelf.querySelector('.np-u-argon-rate-trigger');
  if(!trigger){
   trigger=document.createElement('button');
   trigger.type='button';
   trigger.className='np-u-argon-rate-trigger np-u-wave15-series-rate';
   trigger.setAttribute('aria-label','Выбрать скорость озвучивания');
   trigger.setAttribute('aria-controls',popup.id);
   trigger.setAttribute('aria-expanded','false');
   host.append(trigger);
   const toggle=open=>{
    host.classList.toggle('np-u-wave15-speed-open',open);
    trigger.setAttribute('aria-expanded',String(open));
    popup.inert=!open;
    button.setAttribute('aria-expanded',String(open));
   };
   trigger.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    toggle(!host.classList.contains('np-u-wave15-speed-open'));
   });
   popup.addEventListener('click',e=>{
    if(e.target.closest('[data-speed],[data-fc-action="stop"]')){
     requestAnimationFrame(()=>{toggle(false);trigger.focus({preventScroll:true})});
    }
   });
   document.addEventListener('pointerdown',e=>{
    if(!host.contains(e.target))toggle(false);
   },true);
   document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&host.classList.contains('np-u-wave15-speed-open'))toggle(false);
   });
   new MutationObserver(()=>{
    if(host.classList.contains('np-u-wave15-speed-open')&&popup.inert)popup.inert=false;
   }).observe(popup,{attributes:true,attributeFilter:['inert']});
   toggle(false);
  }
  if(!legacy&&!host.querySelector('.np-u-wave16-audio-caption')){
   // Series pages previously displayed only an orphan Play circle and save
   // button. Keep native controls, add the same editorial caption as articles.
   const caption=document.createElement('span');
   caption.className='np-u-wave16-audio-caption';
   caption.innerHTML='<strong><span class="np-u-audio-label-long">Чтение вслух</span><span class="np-u-audio-label-short">Чтение</span></strong><span><span class="np-u-audio-label-long">Озвучивание</span><span class="np-u-audio-label-short">Аудио</span></span>';
   host.append(caption);
  }
  // One book-like reading card, shared by ordinary and series pages.
  // Move actual Product elements; do not create a second player or timer.
  const card=document.createElement('div');
  card.className='np-u-audio-card';
  shelf.querySelector('.np-u-native-toolrows')?.before(card);
  card.append(host);
  const track=document.createElement('div');
  track.className='np-u-wave15-audio-progress';
  track.setAttribute('role','progressbar');
  track.setAttribute('aria-label','Прогресс аудиочтения');
  track.setAttribute('aria-valuemin','0');
  track.setAttribute('aria-valuemax','100');
  track.innerHTML='<div class="np-u-wave15-progress-meta"><span>Прогресс озвучивания</span><output>0%</output></div>'+
    '<div class="np-u-wave15-progress-track"><span class="np-u-wave15-progress-fill"></span></div>';
  card.appendChild(track);
  const update=()=>{
   const speed=popup.querySelector('[data-speed][aria-checked="true"]');
   if(speed)trigger.textContent=speed.textContent.trim();
   // Product's --p is a FRACTION in [0,1], as confirmed against its
   // native SVG ring. The old bar incorrectly treated it as 0–100%.
   const fraction=Number.parseFloat(button.style.getPropertyValue('--p')||'0');
   const pct=Number.isFinite(fraction)?Math.min(100,Math.max(0,fraction*100)):0;
   track.querySelector('.np-u-wave15-progress-fill').style.width=pct+'%';
   track.querySelector('output').textContent=(pct>0&&pct<1?pct.toFixed(2):pct.toFixed(0))+'%';
   track.setAttribute('aria-valuenow',pct.toFixed(2));
   shelf.dataset.npW15State=button.dataset.state||'idle';
  };
  new MutationObserver(update).observe(button,{attributes:true,attributeFilter:['style','data-state']});
  new MutationObserver(update).observe(popup,{subtree:true,attributes:true,attributeFilter:['aria-checked']});
  update();
  shelf.dataset.npW15Audio='1';
 }

 // W37: reparent the ORIGINAL Product series I-IV nav and progress when
 // narrow desktop ARGON sidebar is folded. Restore both on resize.
 // The Product node, links, event handlers and ring remain unique.
 const narrowActionOrigins=new Map();
 function syncNarrowSeriesActions(rail,outline,narrow){
  const footer=rail.querySelector('.gbs-rail-foot');
  let slot=outline.querySelector(':scope > .np-u-narrow-series-actions');
  if(!footer)return;
  if(narrow){
   const actions=Array.from(footer.querySelectorAll(':scope > #hMobileMenuBtn,:scope > [data-action="print"],:scope > [data-action="share"]'));
   if(!slot&&actions.length>=2){
    slot=document.createElement('div');
    slot.className='np-u-narrow-series-actions';
    slot.setAttribute('role','group');slot.setAttribute('aria-label','Меню сайта и действия с чтением');
    outline.querySelector('.np-u-left-foot').before(slot);
    for(const action of actions){
     const marker=document.createComment('original series action position');
     action.before(marker);narrowActionOrigins.set(action,marker);slot.append(action);
    }
   }
  }else if(slot){
   for(const [action,marker] of narrowActionOrigins){marker.replaceWith(action);}
   narrowActionOrigins.clear();slot.remove();
  }
 }
 function syncNarrowNativeSeriesNavigation(){
  const rail=document.querySelector('.gbs2-world > .gbs-rail[data-reader-integrated-rail="series"]');
  const outline=root.querySelector('#npUOutline');
  if(!rail||!outline)return;
  const spine=outline.querySelector('.np-u-rail-spine');
  const nav=rail.querySelector(':scope > .np-u-native-roman-compact')||
            spine?.querySelector(':scope > .np-u-native-roman-compact');
  const slot=outline.querySelector(':scope > .np-u-series-progress-slot');
  const progress=rail.querySelector(':scope > .gbs2-rprogress')||
                 slot?.querySelector(':scope > .gbs2-rprogress');
  const narrow=matchMedia('(min-width:1121px) and (max-width:1359px)').matches;
  syncNarrowSeriesActions(rail,outline,narrow);
  if(!spine||!nav||!progress)return;
  if(narrow){
   let host=slot;
   if(!host){
    host=document.createElement('div');
    host.className='np-u-series-progress-slot';
    outline.querySelector('.np-u-left-head')?.after(host);
   }
   if(progress.parentElement!==host)host.append(progress);
   if(nav.parentElement!==spine)spine.prepend(nav);
   progress.inert=false;
   progress.removeAttribute('aria-hidden');
  }else{
   if(progress.parentElement!==rail)rail.insertBefore(progress,rail.querySelector('.gbs2-rmid'));
   if(nav.parentElement!==rail)rail.append(nav);
   slot?.remove();
   const compact=rail.classList.contains('reader-integrated-rail--compact');
   progress.inert=compact;
   if(compact)progress.setAttribute('aria-hidden','true');
   else progress.removeAttribute('aria-hidden');
  }
 }
 dockLegacyChrome();
 dockSeriesChrome();
 mountNativeCompactRomans();
 syncNarrowNativeSeriesNavigation();
 mountWave15Audio();
 syncNativeSeriesControlMode();
 syncNativeLegacyControlMode();
 // The native Product library system docks again after async module load.
 // Observe only direct BODY insertions (not the full article subtree) and
 // reintegrate the SAME button when the Product controller moves it back.
 // No timer, clone or replacement event handler; at most 1 reparent per move.
 dockNativeLibrary();
 const libObserver=new MutationObserver(records=>{
  if(records.some(record=>[...record.addedNodes].some(node=>node.id==='gb-hl-fab'))){
   dockNativeLibrary();
  }
 });
 libObserver.observe(document.body,{childList:true});
 // Product's resize handler reinserts the floating cluster one frame later.
 // Observe only DIRECT children of its original home (not article subtree).
 // Reposition the SAME node after Product's own resize, with no replacement
 // controls and no timers or document-wide mutation monitoring.
 if(nativeSeriesRoot){
  const nativeWorld=document.querySelector('.gbs2-world');
  if(nativeWorld)new MutationObserver(()=>{
   if(!isMobile()&&nativeSeriesRoot.dataset.npUNativeFloating==='1'&&
      nativeSeriesRoot.parentElement!==document.body)document.body.append(nativeSeriesRoot);
  }).observe(nativeWorld,{childList:true});
  // W47: Product relocates the SAME real action cluster into its narrow
  // native rail after a fold. In Reader desktop this would create a second
  // visual owner and collide with Roman shortcuts. Keep the Product
  // event-owning node at BODY, so open=one toolbar row, closed=one right stack.
  const compactHome=nativeWorld?.querySelector('.gbs-rail .reader-rail-compact-tools');
  if(compactHome)new MutationObserver(()=>{
   if(!isMobile()&&nativeSeriesRoot.dataset.npUNativeFloating==='1'&&
      nativeSeriesRoot.parentElement===compactHome)document.body.append(nativeSeriesRoot);
  }).observe(compactHome,{childList:true});
 }
 if(nativeLegacyRoot&&nativeLegacyHome&&nativeLegacyHome!==document.body){
  new MutationObserver(()=>{
   if(!isMobile()&&nativeLegacyRoot.dataset.npUNativeFloating==='1'&&
      nativeLegacyRoot.parentElement!==document.body)document.body.append(nativeLegacyRoot);
  }).observe(nativeLegacyHome,{childList:true});
 }
 const left=$('#npUOutline',root),right=$('#npUResearch',root),sectionHost=$('#npUSectionHost',root);
 const backdrop=$('#npUBackdrop',root), fold=$('#npUFold',root);
 // Reuse the original Product series rail when its native desktop layout exists.
 // Its real progress, chapter links and persisted selection stay owned by Product.
 const hasNativeSeriesRail=!!document.querySelector('.gbs2-world > .gbs-rail[data-reader-integrated-rail="series"]');
 if(hasNativeSeriesRail)document.body.classList.add('np-u-native-series-rail');
 const useNativeSeriesRail=()=>hasNativeSeriesRail&&matchMedia('(min-width:1360px)').matches;
 function positionSeriesAudio(){
   const shelf=$('#npUNativeTools',root);
   if(!shelf?.classList.contains('np-u-series-native-tools'))return;
   if(useNativeSeriesRail()){
     if(shelf.parentElement!==right)right.append(shelf);
   }else{
     const foot=left.querySelector('.np-u-left-foot');
     if(foot&&shelf.parentElement!==left)left.insertBefore(shelf,foot);
   }
 }
 function positionProductGlobalActions(){
   const bar=$('#npUNativeResearchActions',root);
   if(!bar)return;
   if(matchMedia('(max-width:1120px)').matches){
     // W52: the authentic Product theme/search buttons share the MOBILE
     // research header in proper keyboard order; no secondary toolbar row.
     const head=right.querySelector('.np-u-right-head');
     const actions=head?.querySelector('.np-u-right-actions');
     if(head&&actions&&bar.parentElement!==head)head.insertBefore(bar,actions);
   }else if(useNativeSeriesRail()){
     const scroll=right.querySelector('.np-u-right-scroll');
     if(scroll&&bar.parentElement!==right)right.insertBefore(bar,scroll);
   }else{
     const full=left.querySelector('.np-u-left-full');
     if(full&&bar.parentElement!==left)left.insertBefore(bar,full);
   }
 }
 positionProductGlobalActions();
 positionSeriesAudio();
 // Accordion: one top-level right research card at a time; nested verse/lexicon
 // disclosures retain their own states and no global "expand everything" action.
 root.addEventListener('toggle',event=>{
  const opened=event.target;
  if(!opened?.open||!opened.matches?.('#npW57NotesDetails,.np-u-research-module > details.np-u-window'))return;
  for(const card of root.querySelectorAll('#npW57NotesDetails[open],.np-u-research-module > details.np-u-window[open]')){
   if(card!==opened)card.open=false;
  }
 },true);
 root.addEventListener('toggle',event=>{
  const details=event.target;
  if(!details?.matches?.('.np-u-window--figures[open]'))return;
  for(const img of $$('img[data-np-u-thumb]',details)){
    img.src=img.dataset.npUThumb;
    img.removeAttribute('data-np-u-thumb');
  }
 },true);
  // W57 accepted UX: research starts FOLDED on every desktop width.
  // One canonical Reader link has no special query parameters; a deliberate
  // click opens it. The optional panel=open parameter is retained strictly
  // for QA screenshots / direct-state checks, not normal navigation.
  const previewPanel=new URLSearchParams(location.search).get('panel');
  let manualRightChoice=!isMobile()&&['open','closed'].includes(previewPanel);
  if(!isMobile()){
    const initiallyFolded=previewPanel!=='open';
    root.classList.toggle('np-u-hide-right',initiallyFolded);
    document.body.classList.toggle('np-u-hide-right',initiallyFolded);
  }
  function applyIntermediateWidth(){
    if(isMobile()||manualRightChoice)return;
    root.classList.add('np-u-hide-right');
    document.body.classList.add('np-u-hide-right');
  }
 const browserStore={active:-1};
 function inRange(el,begin,end){
  if(!el||!begin)return false;
  const a=begin.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING;
  const b=!end || !(end.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING);
  return Boolean(a&&b);
 }
 // ReaderState owns reading geometry and scroll-lock semantics. Map its
 // canonical section identity into the existing visual groups, not a second
 // viewport threshold. Supplemental headings inherit the preceding group.
 function currentGroupIndex(state=readerState.getSnapshot()){
  if(!state)return Math.max(0,browserStore.active);
  if(state.phase==='before-content')return 0;
  if(state.phase==='after-content')return Math.max(0,sections.length-1);
  const id=state.sectionId;
  if(!id)return 0;
  const i=sections.findIndex(g=>g.id===id||g.items?.some(item=>item.id===id));
  if(i>=0)return i;
  const heading=document.getElementById(id);
  if(!heading)return Math.max(0,browserStore.active);
  let previous=0;
  sections.forEach((g,j)=>{
   const start=document.getElementById(g.id);
   if(start&&(start.compareDocumentPosition(heading)&Node.DOCUMENT_POSITION_FOLLOWING))previous=j;
  });
  return previous;
 }
 // Extract ONLY printed prose: Product glossary and Bible popovers, footnote
 // overlays and hidden accessibility metadata are separate UI, not author text.
 // Clone the paragraph so the original controls, data and citation handlers
 // remain untouched. This is the source of research quotations and summaries.
 function articlePlainText(element){
  if(!element)return '';
  const clone=element.cloneNode(true);
  clone.querySelectorAll('.gtip,.btip,.tooltip,.fn-marker,.footnote-ref,'+
   '[data-reader-exclude],[data-reader-linear-aux],[data-no-speech],'+
   '[data-note-registry-tooltip],[hidden],[inert],[aria-hidden="true"],script,style')
   .forEach(node=>node.remove());
  return clone.textContent.replace(/\s+/g,' ').trim();
 }
 // Keep canonical glossary identity separate from the display title and
 // from the particular DOM occurrence used by "Найти в тексте".
 const glossaryOccurrenceIds=new WeakMap(),glossaryOccurrences=new Map();
 let nextGlossaryOccurrence=0;
 function glossaryOccurrence(el){
  if(!glossaryOccurrenceIds.has(el))glossaryOccurrenceIds.set(el,nextGlossaryOccurrence++);
  const id=glossaryOccurrenceIds.get(el);
  glossaryOccurrences.set(id,el);
  return id;
 }
 function glossaryProjection(el){
  if(!el?.matches('.gterm[data-term]')||el.closest('nav,aside,footer,.related-articles,.faq-accordion,[data-reader-exclude]'))return null;
  const key=(el.dataset.term||'').trim();
  if(!key)return null;
  const tip=window.SiteUtils?.getGlossaryTip?.(el)||el;
  const brief=tip.querySelector('.gtip-brief')?.textContent?.replace(/\s+/g,' ').trim()||'';
  return brief?{key,title:(el.dataset.termTitle||'').trim()||key,brief,
   detail:tip.querySelector('.gtip-papyrus')?.textContent?.replace(/\s+/g,' ').trim()||'',category:el.dataset.category||''}:null;
 }
 function collectGlossaryTerms(items,limit=Infinity){
  const seen=new Set(),terms=[];
  for(const el of items){
   const term=glossaryProjection(el);
   if(!term||seen.has(term.key))continue;
   seen.add(term.key);
   terms.push({...term,index:glossaryOccurrence(el)});
   if(terms.length>=limit)break;
  }
  return terms;
 }
 function glossaryTermsForSection(index){
  const group=sections[index];
  if(!group)return [];
  const start=document.getElementById(group.id),end=sections[index+1]?document.getElementById(sections[index+1].id):null;
  return collectGlossaryTerms($$('.gterm[data-term]',article).filter(el=>inRange(el,start,end)));
 }
 function getGroupMaterial(index){
  const group=sections[index],start=document.getElementById(group.id),end=sections[index+1]?document.getElementById(sections[index+1].id):null;
  const allPars=$$('p,blockquote',article);
  const pars=allPars.filter(p=>inRange(p,start,end)&&!p.closest('nav,footer,aside,.quiz,.related-articles,.faq-accordion,figcaption'));
  // Retain exact DOM evidence anchors as well as the text. The Research
  // reader can then send a reader back to the original paragraph rather
  // than presenting untraceable excerpt cards.
  const evidence=pars.map(el=>({
   text:articlePlainText(el),
   index:allPars.indexOf(el)
  })).filter(item=>item.text.length>70);
  const extracts=evidence.map(item=>item.text);
  const refs=[...new Set($$('button.bref[data-ref]',article).filter(el=>inRange(el,start,end)).map(el=>el.dataset.ref).filter(Boolean))];
  const notes=$$('.fn-marker,.footnote-ref,[data-footnote-ref]',article).filter(el=>inRange(el,start,end));
  // Real Product glossary terms, never illustrative/fabricated terms from
  // the standalone ARGON demo. Brief definitions retain their source text.
  const terms=glossaryTermsForSection(index);
  const figuresAll=$$('figure',article);
  const figures=figuresAll.filter(el=>inRange(el,start,end)).map(el=>{
    const caption=el.querySelector('figcaption')?.textContent?.replace(/\s+/g,' ').trim()||'';
    const photo=el.querySelector('img');
    const alt=photo?.getAttribute('alt')?.trim()||'';
    // Use the image already present in the original article; do not create
    // a duplicate source, citation, or replacement lightbox.
    const src=photo?.currentSrc||photo?.src||'';
    return {caption,alt,src,index:figuresAll.indexOf(el)};
  });
  return {extracts,evidence,refs,notes,figures,terms};
 }
 // CLASSIC ARGON: research windows should be useful on FIRST OPEN.
 // When the opening section lacks tagged notes, safely offer real material
 // from later sections, visibly marked as drawn from the whole article.
 const articleStudyRefs=[...new Set($$('button.bref[data-ref]',article)
  .map(el=>el.dataset.ref).filter(Boolean))].slice(0,12);
 const articleStudyTerms=[];
 function collectArticleTerms(){
  for(const [id,source] of glossaryOccurrences){
   if(!article.contains(source)||!source.matches('.gterm[data-term]'))glossaryOccurrences.delete(id);
  }
  const terms=collectGlossaryTerms($$('.gterm[data-term]',article),12);
  articleStudyTerms.splice(0,articleStudyTerms.length,...terms);
  return articleStudyTerms.length;
 }
 collectArticleTerms();
 // Original ARGON's "Коротко" and "Полное оглавление" live IN the book folio.
 // An authored summary remains the canonical DOM and disclosure owner; only
 // articles without an authored summary may receive source-derived extracts.
 function installArgonCentralOverview(){
  if(document.querySelector('[data-np-u-central-overview]'))return;
  const host=article;
  const source=host.querySelector(':scope > .summary-card');
  if(source){
   // Never hide or copy the authored summary. Its IDs, Speakable selectors,
   // rich text, links, print content and canonical disclosure stay intact.
   const heading=source.querySelector(':scope > .summary-card__head')||
    [...source.querySelectorAll(':scope > h2,:scope > h3')].find(el=>
     ['коротко','краткое содержание'].includes(el.textContent.trim().toLocaleLowerCase('ru')));
   if(heading&&source.querySelector(':scope > .summary-card__body'))heading.classList.add('summary-card__head');
   window.GBSummaryDisclosure?.initialize(host);
   source.dataset.npUCentralOverview='authored';
  }
  const extractOne=(index,depth=0)=>{
   const lines=getGroupMaterial(index).extracts;
   const tokens=sections[index].title.toLocaleLowerCase('ru').match(/[а-яё]{6,}/gu)||[];
   const candidates=[];
   lines.slice(0,12).forEach((text,paragraph)=>{
    const clean=text.replace(/\s+/g,' ').trim();
    clean.split(/(?<=[.!?])\s+(?=[А-ЯЁ«])/u).slice(0,5).forEach(sentence=>{
     const item=sentence.trim();
     if(item.length<60||item.length>250||!/[.!?]$/.test(item))return;
     let score=0;
     score+=item.length>=85&&item.length<=200?5:2;
     score+=Math.max(0,5-paragraph*.65);
     const lower=item.toLocaleLowerCase('ru');
     if(tokens.some(word=>lower.includes(word.slice(0,Math.max(5,word.length-2)))))score+=3;
     if(/\b(означает|является|представляет|свидетельствует|показывает|утверждает|основан|подтверждает|состоит|содержит)\b/u.test(lower))score+=2;
     if(/\b(мы|нам|можем|рассмотрим|стоит|можно|зададимся|переходя)\b/u.test(lower))score-=7;
     if(/^(начиная|имея это в виду|размышляя|итак|можно задаться|в таком случае|как мы|таким образом,\s*мы)/iu.test(item))score-=8;
     if(item.includes('?'))score-=6;
     candidates.push({item,score});
    });
   });
   candidates.sort((a,b)=>b.score-a.score);
   if(candidates.length)return candidates[depth]?.item||null;
   const fallback=depth===0?lines.find(t=>t.length>=55)||'':'';
   if(!fallback)return null;
   const text=fallback.replace(/\s+/g,' ').trim();
   return text.length>225?text.slice(0,222).replace(/\s+\S*$/u,'').trimEnd()+'…':text;
  };
  const points=[];
  // Only a page without authored summary content gets verbatim extracts.
  if(!source){
   for(let depth=0;depth<6&&points.length<6;depth++){
    for(let i=0;i<sections.length&&points.length<6;i++){
     const line=extractOne(i,depth);
     if(line&&!points.includes(line))points.push(line);
    }
   }
  }
  // Editorial coverage for Gill II: six literal source sentences from
  // six *different* named sections. These are extracted from the page DOM,
  // not newly composed claims, and remain attached to authentic paragraphs.
  if(!source&&/\/articles\/dzhon-gill-chast-2-uchenyi\/?$/.test(location.pathname)){
   const sectionIds=[
    'sec-hebrew','sec-canticles','sec-commentary',
    'sec-covenant','sec-hebrew-diss','sec-lectures'
   ];
   const selected=[];
   for(const id of sectionIds){
    const h=document.getElementById(id);
    let node=h?.nextElementSibling;
    while(node&&!/^H[2-6]$/.test(node.tagName)&&node.tagName!=='P')node=node.nextElementSibling;
    if(!node||node.tagName!=='P')continue;
    const copy=node.cloneNode(true);
    copy.querySelectorAll('.gtip,.btip,[inert],[aria-hidden="true"]').forEach(el=>el.remove());
    const text=copy.textContent.replace(/\s+/g,' ').trim();
    const first=text.match(/^.+?[.!?](?=\s+\p{Lu}|$)/u)?.[0]?.trim();
    if(first&&first.length>=65&&first.length<=240)selected.push(first);
   }
   if(selected.length===6)points.splice(0,points.length,...selected);
  }
  // A thin 1-3 item list is not a useful synopsis. Keep the full TOC.
  const hasOverview=!source&&points.length>=4;
  const count=points.length;
  // The fallback is verbatim source fragments, not authored editorial theses.
  const countNoun='фрагмент';
  const short=document.createElement('details');
  short.className='np-u-central-overview';
  short.dataset.npUCentralOverview='true';
  short.dataset.printPolicy='exclude';
  short.innerHTML='<summary><span>Коротко</span><span class="np-u-central-meta">'+count+' '+(countNoun==='тезис'?plural(count,'тезис','тезиса','тезисов'):plural(count,'фрагмент','фрагмента','фрагментов'))+' <span class="np-u-central-chevron" aria-hidden="true">›</span></span></summary>'+
   '<ol class="np-u-central-points">'+points.map(t=>'<li>'+escape(t)+'</li>').join('')+'</ol>';
  const full=document.createElement('nav');
  full.className='np-u-central-contents';
  full.dataset.printPolicy='exclude';
  full.setAttribute('aria-label','Полное оглавление материала');
  // W47 full source TOC: resolve real heading IDs before making links.
  // Some published h3 headings have no id, while their source-derived
  // ReaderContract entries expose a stable expected ID. Attach it only to
  // that exact existing heading, never create a duplicate or fake section.
  const headingNodes=[...main.querySelectorAll('h2,h3,h4,h5,h6')];
  const normTitle=text=>String(text||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru');
  const resolveTocId=(id,label)=>{
    if(id&&document.getElementById(id))return id;
    const name=normTitle(label);
    const matches=headingNodes.filter(h=>normTitle(h.textContent)===name);
    if(matches.length!==1)return null;
    const heading=matches[0];
    if(heading.id)return heading.id;
    if(!id||document.getElementById(id))return null;
    heading.id=id;
    return id;
  };
  const completeGroups=outlineEntries.map(({s,sub})=>{
    const mainId=resolveTocId(s.id,s.title);
    const mainLabel='<span class="np-u-toc-roman">'+escape(s.numeral)+'.</span><strong>'+escape(s.title)+'</strong>';
    const header=mainId?'<a class="np-u-toc-chapter-link" href="#'+escape(mainId)+'">'+mainLabel+'</a>':
      '<span class="np-u-toc-chapter-link">'+mainLabel+'</span>';
    const children=sub.filter(t=>t.id&&t.label&&t.id!==s.id);
    return '<li class="np-u-toc-chapter">'+header+
      (children.length?'<ol class="np-u-toc-subchapters">'+children.map(t=>{
        const target=resolveTocId(t.id,t.label);
        return '<li>'+(target?'<a href="#'+escape(target)+'">'+escape(t.label)+'</a>':
         '<span>'+escape(t.label)+'</span>')+'</li>';
      }).join('')+'</ol>':'')+'</li>';
  });
  const subTotal=outlineEntries.reduce((count,{s,sub})=>count+sub.filter(t=>t.id&&t.id!==s.id).length,0);
  full.innerHTML='<details><summary><span>Полное оглавление</span><span class="np-u-central-meta">'+sections.length+' '+plural(sections.length,'раздел','раздела','разделов')+' · '+subTotal+' '+plural(subTotal,'подраздел','подраздела','подразделов')+' <span class="np-u-central-chevron" aria-hidden="true">›</span></span></summary>'+
    '<ol class="np-u-toc-chapters">'+completeGroups.join('')+'</ol></details>';
  // Article layouts differ: some keep their masthead inside article,
  // others have hero/header siblings above it.
  const inArticleHeader=host.querySelector(':scope > header.article-header');
  if(source){
   // Keep the authored card exactly where its author placed it, inside the
   // projection root. Place the adjacent TOC after that same original node.
   source.after(full);
  }else if(inArticleHeader){
   // The compact study companion is authored immediately after the masthead.
   // Reader-owned summaries/TOC must never split that product boundary.
   // Use the existing semantic CTA attributes, not the route or CSS geometry.
   const companion=inArticleHeader.nextElementSibling;
   const rights=inArticleHeader.querySelector(':scope > .notice');
   const insertion=companion?.matches('[data-bible-app-chapter][data-bible-app-variant="compact"]')
    ?companion:(rights||inArticleHeader);
   insertion.after(...(hasOverview?[short,full]:[full]));
  }else{host.before(...(hasOverview?[short,full]:[full]));}
 }

 const icons={
  section:'M4 6h16M4 12h16M4 18h10',
  scripture:'M12 20.5C10.3 19.5 7.9 19 4 19V4.5c3.5 0 6.1.5 8 1.5v14.5zM12 6c1.9-1 4.5-1.5 8-1.5V19c-3.9 0-6.3.5-8 1.5',
  notes:'M6 3h12v18l-6-4-6 4z',
  figures:'M4 4h16v16H4zM8 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM4 17l5-5 3 3 3-3 5 5',
  outline:'M4 6h3M10 6h10M4 12h3M10 12h10M4 18h3M10 18h10',
  sources:'M5 3h13v18H5zM8 7h7M8 11h7M8 15h5',
  series:'M4 7h8M4 12h14M4 17h16'
 };
  const researchNumbers={section:'01',scripture:'02',notes:'03',figures:'04',outline:'05',sources:'06',series:'07'};
  let shortExpanded=true,focusedModule=null;
  const pinnedMarkup=new Map();
  let pinnedLexiconIndex=null, lexiconStamp='', lexiconFrame=0;
  const pinnable=new Set(['scripture','lexicon','section']);
  function sectionCard(title,inner,open=true,metadata='',kind='section'){
   // The module has the same primary visual hierarchy as the ORIGINAL
   // Argon ResearchWindow: instrument number / header / focus / fold.
   // Keep native details semantics, original content, existing test selectors.
   const number=researchNumbers[kind]||'08';
   const focusSvg='<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg>';
   const pinSvg='<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 3 8 0 0 5 3 3v2H5v-2l3-3zM12 13v8"/></svg>';
   const pinControl=pinnable.has(kind)?'<button type="button" class="np-u-module-pin" data-np-u-pin="'+escape(kind)+'" aria-pressed="false" aria-label="Закрепить '+escape(title)+'" title="Не менять при прокрутке статьи">'+pinSvg+'</button>':'';
   return '<section class="np-u-research-module" data-np-u-module="'+escape(kind)+'">'+
    '<details class="np-u-window np-u-window--'+escape(kind)+'"'+(open?' open':'')+'>'+
    '<summary><span class="np-u-instrument-number" aria-hidden="true">'+number+'</span><strong>'+escape(title)+'</strong>'+
    '<span class="np-u-window-meta">'+escape(metadata)+'</span><span class="np-u-window-chevron" aria-hidden="true">'+argonSvg('chevron-down')+'</span></summary>'+
    '<div class="np-u-window-body">'+inner+'</div></details>'+
    pinControl+
    '<button type="button" class="np-u-module-focus" data-np-u-focus="'+escape(kind)+'" aria-label="Развернуть '+escape(title)+' на всю панель" title="Больше места для исследования" aria-pressed="false">'+focusSvg+'</button>'+
    '</section>';
  }
  function syncModuleFocus(){
   const windows=$$('.np-u-research-module',root);
   // Original ARGON numbers windows by their real order, not by type. This
   // prevents nonsensical 01 / 03 / 06 numbering when a chapter lacks refs.
   windows.forEach((window,index)=>{
     const number=window.querySelector('.np-u-instrument-number');
     if(number)number.textContent=String(index+1).padStart(2,'0');
   });
   if(focusedModule&&!windows.some(el=>el.dataset.npUModule===focusedModule))focusedModule=null;
   root.classList.toggle('np-u-research-focused',!!focusedModule);
   for(const window of windows){
    const chosen=focusedModule===window.dataset.npUModule;
    window.classList.toggle('is-focused',chosen);
    const btn=window.querySelector('.np-u-module-focus[data-np-u-focus]');
    if(btn){
     btn.setAttribute('aria-pressed',String(chosen));
     btn.setAttribute('aria-label',chosen?'Вернуть все окна':'Развернуть '+window.querySelector('summary strong')?.textContent+' на всю панель');
     btn.title=chosen?'Вернуть все окна':'Больше места для исследования';
    }
    const expandReading=window.querySelector('[data-np-u-reading-expand]');
    if(expandReading){
     expandReading.textContent=chosen?'Вернуть все окна':'Читать в большом окне ↗';
     expandReading.setAttribute('aria-pressed',String(chosen));
    }
    if(chosen)window.querySelector('details').open=true;
   }
  }
  root.addEventListener('toggle',event=>{
   if(event.target.matches('.np-u-window--section')&&root.contains(event.target))shortExpanded=event.target.open;
  },true);


 // The native Product tooltip is the only authority for biblical text and
 // translation. Read it through the SAME original verse-button controller,
 // then close the temporary popup; do not fabricate verses or copy ARGON demo.
 function renderScriptureAt(module,index){
  const pick=module?.querySelector('[data-np-u-scripture-picker]');
  if(!pick||!pick.options.length)return;
  const n=Math.max(0,Math.min(pick.options.length-1,index));
  pick.selectedIndex=n;
  const ref=pick.value;
  const counter=module.querySelector('[data-np-u-scripture-count]');
  if(counter)counter.textContent=(n+1)+' / '+pick.options.length;
  for(const button of module.querySelectorAll('[data-np-u-scripture-step]')){
   button.disabled=n+Number(button.dataset.npUScriptureStep)<0||
    n+Number(button.dataset.npUScriptureStep)>=pick.options.length;
  }
  const spot=module.querySelector('[data-np-u-scripture-reading]');
  const native=$$('button.bref[data-ref]',article).find(el=>el.dataset.ref===ref);
  // Read Product's ALREADY-RENDERED, inert citation source directly.
  // Opening/closing the native tooltip as a data API caused giant
  // transient overlays, stale popups and jank on both browser engines.
  // This is read-only and never touches Product event handlers or copy.
  // The Product controller may temporarily move the SAME tooltip out of
  // its citation into BODY on hover. Find it by exact reference in either
  // location without opening it or depending on its CSS state.
  const own=native?.parentElement?.querySelector(':scope > .btip');
  const tip=own?.querySelector('.btip__reference')?.textContent?.trim()===ref
    ?own:[...document.querySelectorAll('.btip')]
      .find(el=>el.querySelector('.btip__reference')?.textContent?.trim()===ref);
  const valid=!!tip;
  const passage=valid?{
    text:tip.querySelector('.btip__text')?.textContent?.trim()||'',
    source:tip.querySelector('.btip__source')?.textContent?.trim()||''
  }:null;
  if(!spot)return;
  if(!passage?.text){
   spot.innerHTML='<p class="np-u-muted">Текст отрывка не загружен штатным источником. Откройте ссылку в статье.</p>';
   spot.dataset.npUScriptureText='';
   spot.dataset.npUScriptureCredit='';
  }else{
   spot.dataset.npUScriptureText=passage.text;
   spot.dataset.npUScriptureCredit=passage.source;
   spot.innerHTML='<blockquote class="np-u-scripture-quote">'+escape(passage.text)+'</blockquote>'+
    '<p class="np-u-scripture-credit">'+escape(passage.source||'Перевод указан в исходном тексте')+'</p>';
  }
  // Changing a verse must begin at its first line, not at the old
  // passage's previous scroll position. Reset confirmation state as well.
  spot.scrollTop=0;
  const note=module.querySelector('[data-np-u-scripture-scroll-note]');
  if(note)note.hidden=!passage?.text||passage.text.length<=480;
  const copy=module.querySelector('[data-np-u-scripture-copy]');
  if(copy)copy.textContent='Копировать текст';
  if(pinnedMarkup.has('scripture'))pinnedMarkup.set('scripture',module.outerHTML);
 }
 function renderLexiconAt(module,index){
  const pick=module?.querySelector('[data-np-u-lex-picker]');
  if(!pick||!pick.options.length)return;
  const i=Math.max(0,Math.min(index,pick.options.length-1));
  // Serialize the selected option in the existing pinned markup snapshot.
  for(const [j,option] of [...pick.options].entries())option.defaultSelected=j===i;
  pick.selectedIndex=i;
  const counter=module.querySelector('[data-np-u-lex-count]');
  if(counter)counter.textContent=(i+1)+' / '+pick.options.length;
  for(const btn of module.querySelectorAll('[data-np-u-lex-step]')){
   btn.disabled=i+Number(btn.dataset.npULexStep)<0||
    i+Number(btn.dataset.npULexStep)>=pick.options.length;
  }
  for(const entry of module.querySelectorAll('[data-np-u-lex-entry]')){
   entry.hidden=entry.dataset.npULexEntry!==pick.value;
  }
  if(pinnedMarkup.has('lexicon'))pinnedMarkup.set('lexicon',module.outerHTML);
 }
 root.addEventListener('change',event=>{
  const picker=event.target;
  if(picker.matches('[data-np-u-scripture-picker]'))
   renderScriptureAt(picker.closest('.np-u-research-module'),picker.selectedIndex);
  if(picker.matches('[data-np-u-lex-picker]'))
   renderLexiconAt(picker.closest('.np-u-research-module'),picker.selectedIndex);
 });

 // Editorial notes are REVIEWED per source paragraph, not generated at runtime.
 // Every label is strictly gated by the current article's paragraph prefix.
 // On an edited article, mismatches safely fall back to the unannotated route.
 const editorialRoutes={"chau":[[{"start":"Начиная исследование христоцентричного метода, нам необходимо о","title":"Исходные понятия","role":"Постановка задачи","link":"Оценка метода начинается с различения значения и значимости текста.","len":288,"hash":"0caa4828"},{"start":"Значение относится к конкретным идеям внутри текста в данном ко","title":"Значение текста","role":"Определение","link":"Здесь ставится вопрос об авторском замысле и границах передаваемого смысла.","len":648,"hash":"1515edd9"},{"start":"Значимость — это еще одна важная концепция в герменевтике. Знач","title":"Значимость текста","role":"Определение","link":"Далее отделяются применения и следствия от непосредственного значения.","len":439,"hash":"a232f684"},{"start":"В сумме, значение и значимость — две важные идеи в оценке герме","title":"Критерии оценки","role":"Синтез","link":"Сопоставляются источник значения, двойное авторство и способ вывода следствий.","len":469,"hash":"7af9f1f0"},{"start":"Имея это в виду, мы можем перейти к рассмотрению христоцентричн","title":"Богословские предпосылки","role":"Переход","link":"Автор переходит к рамке, которая направляет выбор метода толкования.","len":594,"hash":"f5ff6db1"}],[{"start":"Имея это в виду, мы можем перейти к рассмотрению христоцентричн","title":"Богословская рамка","role":"Переход","link":"Исследование модели связывается с богословскими предпосылками.","len":594,"hash":"f5ff6db1"},{"start":"Христоцентричный подход имеет долгую и разнообразную историю. Ф","title":"Варианты подхода","role":"Область исследования","link":"Речь идёт прежде всего о современных версиях, между которыми есть различия.","len":516,"hash":"5fd21c17"},{"start":"1. Христоцентричный подход фундаментально желает представить ка","title":"Связь текста со Христом","role":"Первый признак","link":"В изложении модели каждый текст рассматривается в отношении ко Христу.","len":113,"hash":"2e73ac30"},{"start":"2. Христоцентричный подход подчеркивает единство Писания. Из-за","title":"Единство Писания","role":"Второй признак","link":"Отмечено единство Писания и оговорено употребление термина «искупительно-исторический».","len":212,"hash":"a81af092"},{"start":"3. Христоцентричный подход делает акцент на богословии Писания.","title":"Проповедь доктрины","role":"Третий признак","link":"Богословская проповедь противопоставляется сведению повествования к морализму.","len":297,"hash":"1e7c24ac"}],[{"start":"Размышляя над христоцентричной герменевтикой, мы можем найти мн","title":"Признание сильных сторон","role":"Уступка","link":"Автор отмечает ценность библейского богословия и единства Писания.","len":689,"hash":"b5984368"},{"start":"С учётом этого, как нам следует обдумать христоцентричное предл","title":"Исключения из правила?","role":"Центральный вопрос","link":"Дальнейшая оценка сосредоточена на границах обычного метода толкования.","len":437,"hash":"76a538a2"},{"start":"Этот акцент заслуживает похвалы, ибо он библейский. Даже самые ","title":"Авторский замысел","role":"Методологический аргумент","link":"В защиту буквального смысла привлекается язык библейского текста.","len":1365,"hash":"e7e79e1d"},{"start":"С другой стороны, вопрос, который поднимает христоцентричная ге","title":"Граница метода","role":"Возражение","link":"Обсуждается возможность исключений и связь значения со значимостью.","len":714,"hash":"e04ca16f"},{"start":"Так должны ли у нас быть такие исключения из правила? Как обсуж","title":"Проверка исключений","role":"Задача исследования","link":"Предлагается проверить библейские тексты и основания таких исключений.","len":333,"hash":"4214924d"}],[{"start":"Можно задаться вопросом, не является ли это обсуждение чисто те","title":"«Канон внутри канона»","role":"Обозначение проблемы","link":"Объясняется опасность доминирующего фильтра при чтении всего Писания.","len":484,"hash":"e8e11ee7"},{"start":"Фокусируясь на Христе как контролирующей идее значения и значим","title":"Тринитарный риск","role":"Первое следствие","link":"Автор опасается сужения полноценного учения о Троице.","len":909,"hash":"7b8587bd"},{"start":"Троица — не единственная доктрина под угрозой. Поскольку христо","title":"Остальные доктрины","role":"Второе следствие","link":"Показан риск вытеснения других богословских тем.","len":1096,"hash":"aa2192e7"},{"start":"В этом же русле канон внутри канона по своей сути унижает Писан","title":"Детали библейского текста","role":"Третье следствие","link":"Критика касается также утраты внимания к отдельным деталям Писания.","len":1109,"hash":"30253cfc"},{"start":"Возможно, наиболее иронично то, что христоцентричная герменевти","title":"Связи со Христом","role":"Итоговая критика","link":"Искусственные параллели могут заслонять действительно обоснованные связи.","len":842,"hash":"e2121a82"}],[{"start":"Итак, если кто-то желает проповедовать Христа в Его полной слав","title":"Предлагаемый метод","role":"Основной тезис","link":"Автор защищает грамматико-историческое чтение как путь к полному изложению Писания.","len":267,"hash":"5a005806"},{"start":"Как мы кратко наблюдали, авторы Ветхого Завета устанавливали ко","title":"Траектория Ветхого Завета","role":"Обоснование","link":"Рассматриваются связи, которые устанавливают сами ветхозаветные авторы.","len":562,"hash":"373585af"},{"start":"Во-первых, Ветхий Завет пророчествует прямо о Христе. Начиная с","title":"Мессианские пророчества","role":"Первая линия доводов","link":"Перечислены тексты, прямо связываемые автором со Христом.","len":582,"hash":"567b02a3"},{"start":"Следовательно, в Ветхом Завете существует множество пророчеств ","title":"Связность пророчеств","role":"Промежуточный вывод","link":"Пророчества понимаются как связанная линия, а не случайный набор предсказаний.","len":118,"hash":"cb4355c0"},{"start":"Во-вторых, Ветхий Завет подготавливает к Христу. Это видно в ег","title":"Подготовка к Христу","role":"Вторая линия доводов","link":"Искупительная история Ветхого Завета соотносится с Новым Заветом.","len":332,"hash":"fd3b61b4"}],[{"start":"Как мы чтим Христа в нашем изучении и провозглашении Писания? М","title":"Послушание в толковании","role":"Заключительный принцип","link":"Почтение ко Христу связывается и с исследовательской работой, а не только с кафедрой.","len":158,"hash":"bde8c0f7"},{"start":"В конце концов, Писание предписывает, чтобы экзегет искал замыс","title":"Внимание к автору","role":"Методологический итог","link":"Финальный аргумент направлен на язык и исторический контекст библейского текста.","len":644,"hash":"2d7c28c2"},{"start":"Для этого есть веская причина. Мы видели, как ошибочная гермене","title":"Предостережение об избирательности","role":"Следствие","link":"Автор связывает «канон внутри канона» с неполнотой богословского изложения.","len":515,"hash":"bfdd6edd"},{"start":"Итак, нам нужно иметь уверенность, что метод, предписанный в Пи","title":"Полнота провозглашения","role":"Итоговый призыв","link":"Призыв исследовать реальные связи библейских книг без подмены их смысла.","len":372,"hash":"dde66f32"}]],"gill":[[{"start":"Гилл стал пастором в 1720 году — на следующий год после спора в","title":"Солтерс-Холл","role":"Исторический контекст","link":"Различаются голосование, подписка и неоднородность позиций диссентеров.","len":693,"hash":"948599d7"},{"start":"Непосредственным поводом к написанию «Учения о Троице» (1731) с","title":"Повод к трактату","role":"Ближайшая причина","link":"Показан внутренний церковный конфликт, связанный с полемикой вокруг Троицы.","len":626,"hash":"9ba15b69"},{"start":"Майкл Хайкин рассматривает защиту тринитарной ортодоксии как од","title":"Оценка историка","role":"Историографическая оговорка","link":"Позицию Хайкина нельзя механически распространять на все общины.","len":441,"hash":"1f197eaf"},{"start":"К началу XVIII века в Англии набирала силу унитаристская волна.","title":"Унитарианские споры","role":"Богословский фон","link":"Описана обстановка, в которой формировалась защита тринитарного учения.","len":287,"hash":"774dfb14"},{"start":"Гилл маршировал через отцов Церкви: Игнатий, Поликарп, Иустин М","title":"Апелляция к древности","role":"Позиция Гилла","link":"В трактате преемственность церковного исповедания служит аргументом.","len":323,"hash":"5782700f"}],[{"start":"Историография отношений Гилла с Джорджем Уайтфилдом неоднородна","title":"Гилл и Уайтфилд","role":"Историографическая проблема","link":"Отношения двух служителей нельзя свести к простой формуле «за» или «против».","len":448,"hash":"3264c5dd"},{"start":"Защитительную линию наиболее последовательно проводит Джордж Эл","title":"Свидетельства и возражения","role":"Сопоставление оценок","link":"Представлены как защитительная реконструкция, так и свидетельства, осложняющие её.","len":708,"hash":"d0b2c064"},{"start":"В 1729 году Гилл начал еженедельную вечернюю лекцию по средам в","title":"Лекции в Истчипе","role":"Проверяемая хронология","link":"Даты 1729–1756 фиксируют продолжительность еженедельной лекции.","len":423,"hash":"97f21b85"},{"start":"Этим «серьёзным трудом» было не что иное, как «Толкование Ветхо","title":"Девятитомный комментарий","role":"Результат служения","link":"Кабинетная работа сопоставляется с итогом многолетней экзегезы.","len":263,"hash":"ec800fb0"},{"start":"Риппон связывает открытие Истчипской лекции с Пс. 71:16 и сообщ","title":"Граница доказуемого","role":"Источниковедческая оговорка","link":"Для спорного утверждения об аренде залов нужны документы эпохи.","len":265,"hash":"6bab25b5"}]]};
 const editorialPageKey=location.pathname.includes('dzhon-gill-chast-2-uchenyi')?'gill':
  location.pathname.includes('hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki')?'chau':null;
 // FNV-1a over all UTF-16 code units of visible source prose.
 // Detect edits anywhere in the paragraph, not just its opening words.
 function editorialTextChecksum(value){
  let hash=2166136261;
  for(let i=0;i<value.length;i++)
   hash=Math.imul(hash^value.charCodeAt(i),16777619);
  return (hash>>>0).toString(16).padStart(8,'0');
 }
 function verifiedEditorialRoute(chapterIndex,nodes){
  const notes=editorialRoutes[editorialPageKey]?.[chapterIndex];
  if(!notes||notes.length!==nodes.length)return null;
  return notes.every((note,i)=>nodes[i].text.length===note.len&&
   editorialTextChecksum(nodes[i].text)===note.hash)?notes:null;
 }
 function lexiconContent(studyTerms,lexiconScope,articleWide=false){
  const lex=studyTerms.map((term,i)=>
   '<div class="np-u-lexicon-entry" data-np-u-lex-entry="'+term.index+'" data-np-u-lex-key="'+escape(term.key)+'"'+(i?' hidden':'')+'>'+
     '<div class="np-u-lexicon-kicker">'+escape(term.category)+'</div>'+
     '<h4>'+escape(term.title)+'</h4><p>'+escape(term.brief)+'</p>'+
     (term.detail?'<details open class="np-u-lex-definition"><summary>Определение и границы понятия</summary><p>'+escape(term.detail)+'</p></details>':'')+
     '<button type="button" data-np-u-term-index="'+term.index+'" data-np-u-term-key="'+escape(term.key)+'">Найти в тексте ↗</button></div>').join('');
  const lexContent=studyTerms.length?
   '<p class="np-u-research-data-caption">'+lexiconScope+'</p>'+
   '<div class="np-u-study-picker"><label for="npULexiconPick">Богословское понятие</label>'+
    '<div class="np-u-study-picker-row"><select id="npULexiconPick" data-np-u-lex-picker aria-label="Выбрать понятие">'+
      studyTerms.map(term=>'<option value="'+term.index+'" data-np-u-lex-key="'+escape(term.key)+'">'+escape(term.title)+'</option>').join('')+
    '</select><span class="np-u-study-picker-counter" data-np-u-lex-count>1 / '+studyTerms.length+'</span>'+
    '<button type="button" data-np-u-lex-step="-1" aria-label="Предыдущее понятие">‹</button>'+
    '<button type="button" data-np-u-lex-step="1" aria-label="Следующее понятие">›</button></div></div>'+
    '<div class="np-u-lexicon-list" data-np-u-term-scope="'+(articleWide?'article':'section')+'">'+lex+'</div>':
    '<p class="np-u-muted">В этом разделе нет отмеченных терминов.</p>';
  return lexContent;
 }
 function contextTermMarkup(terms,hasRefs){
  return terms.length?'<div class="np-u-context-links">'+terms.slice(0,8).map(term=>
   '<button type="button" data-np-u-term-index="'+term.index+'" data-np-u-term-key="'+escape(term.key)+'">'+escape(term.title)+'</button>').join('')+'</div>':
   (hasRefs?'':'<p class="np-u-muted">Связанные ссылки и понятия в этом разделе не размечены.</p>');
 }
 function refreshContextTerms(){
  const region=sectionHost.querySelector('[data-np-u-context-section]');
  if(!region||region.contains(document.activeElement))return;
  const local=glossaryTermsForSection(Number(region.dataset.npUContextSection)).slice(0,8);
  const hasRefs=!!region.parentElement.querySelector('[data-np-u-ref]');
  const buttons=[...region.querySelectorAll('[data-np-u-term-index]')];
  const unchanged=buttons.length===local.length&&buttons.every((button,i)=>
   button.dataset.npUTermIndex===String(local[i].index)&&button.dataset.npUTermKey===local[i].key&&button.textContent===local[i].title);
  if(unchanged&&(local.length||!!region.querySelector('.np-u-muted')===!hasRefs))return;
  region.innerHTML=contextTermMarkup(local,hasRefs);
 }
 function resolveGlossaryAction(target){
  const key=target.dataset.npUTermKey;
  if(!key)return null;
  const source=glossaryOccurrences.get(Number(target.dataset.npUTermIndex));
  const context=target.closest('[data-np-u-context-section]');
  const articleWide=target.closest('[data-np-u-term-scope]')?.dataset.npUTermScope==='article';
  const index=context?Number(context.dataset.npUContextSection):(pinnedLexiconIndex??browserStore.active);
  const group=sections[index],start=group&&document.getElementById(group.id),end=sections[index+1]?document.getElementById(sections[index+1].id):null;
  if(source&&article.contains(source)&&glossaryProjection(source)?.key===key&&
   (articleWide||inRange(source,start,end)))return source;
  const terms=articleWide?collectGlossaryTerms($$('.gterm[data-term]',article)):glossaryTermsForSection(index);
  const match=terms.find(term=>term.key===key);
  return match?glossaryOccurrences.get(match.index):null;
 }
 function refreshLexicon(){
  if(browserStore.active<0)return;
  collectArticleTerms();
  refreshContextTerms();
  const module=sectionHost.querySelector('.np-u-research-module[data-np-u-module="lexicon"]');
  if(!module)return;
  const body=module.querySelector('.np-u-window-body');
  if(!body||body.contains(document.activeElement))return;
  const index=pinnedLexiconIndex??browserStore.active;
  const local=glossaryTermsForSection(index);
  const terms=local.length?local:articleStudyTerms;
  const scope=local.length?'Понятия текущего раздела':'Понятия из всей статьи';
  const stamp=JSON.stringify([scope,terms]);
  if(stamp===lexiconStamp)return;
  const previous=body.querySelector('[data-np-u-lex-picker]')?.selectedOptions[0]?.dataset.npULexKey;
  const disclosure=new Map([...body.querySelectorAll('[data-np-u-lex-entry]')].map(el=>[el.dataset.npULexKey,el.querySelector('details')?.open]));
  body.innerHTML=lexiconContent(terms,scope,!local.length);
  const meta=module.querySelector('.np-u-window-meta');
  if(meta)meta.textContent=terms.length?String(terms.length):'—';
  for(const el of body.querySelectorAll('[data-np-u-lex-entry]')){
   const detail=el.querySelector('details');
   if(detail&&disclosure.has(el.dataset.npULexKey))detail.open=disclosure.get(el.dataset.npULexKey);
  }
  const picker=body.querySelector('[data-np-u-lex-picker]');
  if(picker)renderLexiconAt(module,Math.max(0,[...picker.options].findIndex(opt=>opt.dataset.npULexKey===previous)));
  if(pinnedMarkup.has('lexicon'))pinnedMarkup.set('lexicon',module.outerHTML);
  lexiconStamp=stamp;
 }
 function scheduleLexiconRefresh(){
  if(lexiconFrame)return;
  lexiconFrame=requestAnimationFrame(()=>{lexiconFrame=0;refreshLexicon();});
 }
 function glossaryMutation(record){
  const target=record.target.nodeType===1?record.target:record.target.parentElement;
  if(record.type==='attributes'&&record.attributeName==='class'){
   // Ignore hover, reveal, selection and other class churn unrelated to glossary eligibility.
   const before=new Set((record.oldValue||'').split(/\s+/));
   if(!['gterm','related-articles','faq-accordion','gtip-brief','gtip-papyrus'].some(c=>before.has(c)!==target.classList.contains(c)))return false;
   return !!(target.closest('.gterm')||target.querySelector('.gterm')||before.has('gterm'));
  }
  if(record.type==='attributes'&&record.attributeName==='data-reader-exclude')return !!(target.closest('.gterm')||target.querySelector('.gterm'));
  return !!target?.closest('.gterm')||[...record.addedNodes,...record.removedNodes].some(el=>
   el.nodeType===1&&(el.matches('.gterm')||el.querySelector('.gterm')));
 }
 function makeSection(index){
  const group=sections[index],data=getGroupMaterial(index);
  const excerpt=t=>'<blockquote class="np-u-quotation">'+escape(t.length>450?t.slice(0,447).trimEnd()+'…':t)+'</blockquote>';
  const snippets=data.extracts.length?excerpt(data.extracts[0]):'';
  const extraCount=Math.min(Math.max(0,data.extracts.length-1),2);
  const extras=extraCount?'<details class="np-u-source-extra"><summary>Читать ещё '+extraCount+' '+plural(extraCount,'фрагмент','фрагмента','фрагментов')+'</summary>'+data.extracts.slice(1,3).map(excerpt).join('')+'</details>':'';
  const heading=group.title.replace(new RegExp('^'+group.numeral+'[.)]\\s+','i'),'');
  const stats=[];
  if(data.refs.length)stats.push('<span>'+data.refs.length+' '+plural(data.refs.length,'ссылка','ссылки','ссылок')+' Писания</span>');
  if(data.notes.length)stats.push('<span>'+data.notes.length+' '+plural(data.notes.length,'сноска','сноски','сносок')+'</span>');
  if(group.items.length>1)stats.push('<span>'+String(group.items.length-1)+' '+plural(group.items.length-1,'подраздел','подраздела','подразделов')+'</span>');
  if(data.figures.length)stats.push('<span>'+data.figures.length+' '+plural(data.figures.length,'иллюстрация','иллюстрации','иллюстраций')+'</span>');
  const body='<div class="np-u-section-kicker">РАЗДЕЛ '+escape(group.numeral)+' · '+escape(types[model.kind]||'')+'</div>'+
    '<h3>'+escape(heading)+'</h3>'+
    (snippets?'<p class="np-u-source-heading">Из текста '+(model.kind==='book-chapter'||model.kind==='series-chapter'?'главы':'статьи')+'</p>':'')+
    (snippets+extras||'<p class="np-u-muted">Начало раздела — по заголовку в тексте.</p>')+
    (stats.length?'<div class="np-u-metrics">'+stats.join('')+'</div>':'')+
    '<button type="button" class="np-u-jump" data-np-u-goto="'+escape(group.id)+'">Перейти к разделу <span aria-hidden="true">↗</span></button>';
  // ARGON UPDATE's order: scripture, lexicon, thought trajectory.
  // Every entry is grounded in the actual opened article, never demo data.
  let html='';
  // The three ARGON research windows stay in a stable order. If this
  // section has no tags, show sourced article-wide research immediately
  // rather than three empty windows. Provenance is displayed explicitly.
  const studyRefs=data.refs.length?data.refs:articleStudyRefs;
  const studyTerms=data.terms.length?data.terms:(collectArticleTerms(),articleStudyTerms);
  const scriptureScope=data.refs.length?'Места текущего раздела':'Из других разделов этой статьи';
  const lexiconScope=data.terms.length?'Понятия текущего раздела':'Понятия из всей статьи';
  const scriptureContent=studyRefs.length
   ?'<p class="np-u-research-data-caption">'+scriptureScope+'</p>'+
    '<div class="np-u-study-picker"><label for="npUScripturePick">Место Писания</label>'+
    '<div class="np-u-study-picker-row"><select id="npUScripturePick" data-np-u-scripture-picker aria-label="Выбрать место Писания">'+
      studyRefs.map(ref=>'<option value="'+escape(ref)+'">'+escape(ref)+'</option>').join('')+
    '</select><span class="np-u-study-picker-counter" data-np-u-scripture-count>1 / '+studyRefs.length+'</span>'+
    '<button type="button" data-np-u-scripture-step="-1" aria-label="Предыдущее место Писания">‹</button>'+
    '<button type="button" data-np-u-scripture-step="1" aria-label="Следующее место Писания">›</button></div></div>'+
    '<div class="np-u-scripture-reading" data-np-u-scripture-reading aria-live="off"><p class="np-u-muted">Выберите место Писания, чтобы прочитать текст здесь.</p></div>'+
    '<div class="np-u-scripture-scroll-note" data-np-u-scripture-scroll-note hidden><span>Продолжение отрывка — прокрутите текст.</span><button type="button" data-np-u-reading-expand data-np-u-focus="scripture" aria-pressed="false">Читать в большом окне ↗</button></div>'+
    '<p class="np-u-research-data-caption np-u-related-caption">Другие связанные ссылки</p>'+
    '<div class="np-u-classic-related">'+studyRefs.slice(0,5).map(ref=>
      '<button type="button" class="np-u-verse-chip" data-np-u-ref="'+escape(ref)+'">'+escape(ref)+'</button>').join('')+'</div>'+
    '<div class="np-u-study-actions"><button type="button" data-np-u-scripture-source>Найти в статье ↗</button>'+
    '<button type="button" data-np-u-scripture-copy>Копировать текст</button></div>'
   :'<p class="np-u-muted">В этом разделе нет размеченных ссылок на Писание.</p>';
  html+=sectionCard('Писание',scriptureContent,!!studyRefs.length,studyRefs.length?String(studyRefs.length):'—','scripture');
  html+=sectionCard('Лексикон',lexiconContent(studyTerms,lexiconScope,!data.terms.length),!!studyTerms.length,studyTerms.length?String(studyTerms.length):'—','lexicon');
  if(!pinnedMarkup.has('lexicon'))lexiconStamp=JSON.stringify([lexiconScope,studyTerms]);
  // ARGON's three argument views. Never generate a theological conclusion:
  // all statements and links below come from the already published chapter.
  const argumentTabs='<div class="np-u-thought-tabs" role="tablist" aria-label="Способы изучения раздела">'+
   '<button type="button" role="tab" aria-selected="true" aria-controls="npUThoughtArgument" tabindex="0" data-np-u-thought-tab="argument">Аргумент</button>'+
   '<button type="button" role="tab" aria-selected="false" aria-controls="npUThoughtAnalysis" tabindex="-1" data-np-u-thought-tab="analysis">Разбор текста</button>'+
   '<button type="button" role="tab" aria-selected="false" aria-controls="npUThoughtLinks" tabindex="-1" data-np-u-thought-tab="links">Связи</button></div>';
  const analysis='<p class="np-u-research-data-caption">Проверяемые фрагменты из публикации. Каждый открывается в исходном контексте.</p>'+
   (data.evidence.length?data.evidence.slice(0,3).map((item,i)=>
     '<div class="np-u-thought-evidence"><span>'+String(i+1).padStart(2,'0')+'</span>'+
       excerpt(item.text)+
       '<button type="button" class="np-u-evidence-jump" data-np-u-evidence-index="'+item.index+'">Показать исходный абзац ↗</button>'+
     '</div>').join(''):
     '<p class="np-u-muted">Подходящие фрагменты не обнаружены. Изучайте полный текст раздела.</p>');
  const connections='<p class="np-u-research-data-caption">Связи по разметке статьи</p>'+
   (data.refs.length?'<div class="np-u-verse-chips">'+data.refs.slice(0,12).map(ref=>'<button type="button" class="np-u-verse-chip" data-np-u-ref="'+escape(ref)+'">'+escape(ref)+'</button>').join('')+'</div>':'')+
   '<div data-np-u-context-section="'+index+'">'+contextTermMarkup(data.terms,!!data.refs.length)+'</div>';
  // Do not end a five-step route on a short paragraph introducing a quote
  // with a colon; prefer the next complete source paragraph instead.
  const thoughtNodes=data.evidence.filter(item=>
   !(item.text.length<240&&/:\s*$/u.test(item.text))&&
   !/^(?:Примечание о переводах[.:]|Перевод выполнен на основе английского оригинала)/iu.test(item.text))
   .slice(0,5).map(item=>({...item,origin:'Текущий раздел'}));
  // Where the introductory chapter is shorter, show a naturally following
  // SOURCE paragraph as the fifth node, visibly labelled. Nothing invented.
  if(thoughtNodes.length<5&&index+1<sections.length){
   for(const item of getGroupMaterial(index+1).evidence){
    if(thoughtNodes.length>=5)break;
    thoughtNodes.push({...item,origin:'Следующий раздел'});
   }
  }
  // The flow is a SOURCE READING ROUTE, not a generated argument.
  // Sentence boundaries keep excerpts readable without importing tooltip
  // texts or tearing through an unrelated footnote bibliographic record.
  function thoughtPreview(source,maxLength=320){
   if(source.length<=maxLength)return source;
   const head=source.slice(0,maxLength);
   const endings=[...head.matchAll(/[.!?](?=\s|$)/gu)]
    .filter(match=>match.index>=105);
   if(endings.length)return head.slice(0,endings[endings.length-1].index+1);
   return head.slice(0,maxLength-3).replace(/\s+\S*$/u,'').trimEnd()+'…';
  }
  const thoughtN=thoughtNodes.length;
  const editorial=verifiedEditorialRoute(index,thoughtNodes);
  const argumentFlow=thoughtN?
   '<div class="np-u-argument-intro"><span class="np-u-argument-eyebrow">'+
    (editorial?'Редакционная карта аргумента':'Маршрут чтения')+' · Раздел '+escape(group.numeral)+'</span>'+
    '<strong>'+escape(heading)+'</strong>'+
    '<p>'+thoughtN+' '+plural(thoughtN,'узел','узла','узлов')+
      (editorial?'. Подписи поясняют ход текста; выдержки ниже взяты из публикации.':
       ' по порядку публикации. Каждый открывается в своём абзаце.')+'</p></div>'+
   '<div class="np-u-argument-map" role="group" aria-label="Навигация по узлам" style="--np-u-route-count:'+thoughtN+'">'+
     thoughtNodes.map((item,i)=>'<button type="button" data-np-u-node-jump="'+i+
      '" aria-pressed="'+(i===0?'true':'false')+'"'+
      (editorial?' title="'+escape(editorial[i].title)+'"':'')+
      ' aria-label="Перейти к узлу '+(i+1)+(editorial?': '+escape(editorial[i].title):'')+'">'+
      String(i+1).padStart(2,'0')+'</button>').join('')+'</div>'+
   '<ol class="np-u-argument-nodes">'+thoughtNodes.map((item,i)=>{
     const note=editorial?.[i];
     const fragment=thoughtPreview(item.text,note?235:320);
     const scope=item.origin==='Следующий раздел'?'Следующий раздел':'Текущий раздел';
     return '<li data-np-u-argument-node="'+i+'" tabindex="-1"'+(i===0?' class="is-selected"':'')+'>'+
      '<span class="np-u-argument-num">'+String(i+1).padStart(2,'0')+'</span>'+
      '<div class="np-u-argument-node-body">'+
       '<span class="np-u-argument-origin">Источник · '+scope+'</span>'+
       (note?'<span class="np-u-argument-role">'+escape(note.role)+'</span>'+
        '<strong class="np-u-argument-node-title">'+escape(note.title)+'</strong>'+
        '<div class="np-u-argument-editorial">'+escape(note.link)+'</div>':'')+
       '<p>'+escape(fragment)+'</p>'+
       '<button type="button" data-np-u-evidence-index="'+item.index+'">Читать исходный абзац ↗</button></div></li>';
   }).join('')+'</ol>'+
   '<p class="np-u-argument-provenance">'+
     (editorial?'Редакционные подписи — ориентиры по опубликованному тексту, не цитаты и не самостоятельные доказательства. ':
      'Это фрагменты публикации, а не новые богословские выводы. ')+
     'Полный контекст, примечания и подтверждения — в исходных абзацах.</p>'
   :body;
  const thought=argumentTabs+
   '<div id="npUThoughtArgument" class="np-u-thought-pane" role="tabpanel" data-np-u-thought-pane="argument">'+argumentFlow+'</div>'+
   '<div id="npUThoughtAnalysis" class="np-u-thought-pane" role="tabpanel" data-np-u-thought-pane="analysis" hidden>'+analysis+'</div>'+
   '<div id="npUThoughtLinks" class="np-u-thought-pane" role="tabpanel" data-np-u-thought-pane="links" hidden>'+connections+'</div>';
  html+=sectionCard('Ход мысли',thought,shortExpanded,group.numeral+' / '+sections.length,'section');
  if(data.notes.length){
    const noteButtons=data.notes.slice(0,20).map((note,i)=>{
      const id=note.id;
      if(!id)return '';
      const number=note.dataset.noteOrdinal||String(i+1);
      const label=note.getAttribute('aria-label')?.trim()||'Открыть сноску '+number;
      return '<button type="button" class="np-u-note-link" data-np-u-note="'+escape(id)+'"><span>'+escape(number)+'</span><span>'+escape(label)+'</span></button>';
    }).join('');
    if(noteButtons)html+=sectionCard('Сноски','<p class="np-u-muted">Открой исходное примечание в тексте.</p><div class="np-u-note-list">'+noteButtons+'</div>',false,String(data.notes.length),'notes');
  }
  if(data.figures.length){
    const rows=data.figures.map((f,i)=>{
      const text=f.caption||f.alt||'Без текстовой подписи';
      const kind=f.caption?'Подпись':f.alt?'Описание изображения':'Иллюстрация';
      const preview=f.src?'<img class="np-u-figure-thumb" data-np-u-thumb="'+escape(f.src)+'" alt="'+escape(f.alt||'Иллюстрация '+String(i+1))+'" loading="lazy" decoding="async">':'';
      return '<button type="button" class="np-u-figure-row" data-np-u-figure="'+f.index+'">'+preview+'<span class="np-u-figure-copy"><b>'+escape(kind)+'</b><span>'+escape(text)+'</span><em>К изображению ↗</em></span></button>';
    }).join('');
    html+=sectionCard('Иллюстрации','<div class="np-u-figure-list">'+rows+'</div>',false,String(data.figures.length),'figures');
  }
  const sub=group.items.filter(x=>x.id!==group.id);
  if(sub.length)html+=sectionCard('Подразделы','<div class="np-u-context-links">'+sub.slice(0,15).map(x=>'<button type="button" data-np-u-goto="'+escape(x.id)+'">'+escape(x.label)+'</button>').join('')+'</div>',false,String(sub.length),'outline');
   // Capture live disclosure/tab/selection state before replacing the host.
   for(const kind of pinnedMarkup.keys()){
    const live=sectionHost.querySelector('.np-u-research-module[data-np-u-module="'+kind+'"]');
    if(live)pinnedMarkup.set(kind,live.outerHTML);
   }
   sectionHost.innerHTML=html;
   // A pinned research instrument preserves its original chapter's content
   // while the other windows follow the reader's current position.
   for(const [kind,markup] of pinnedMarkup){
    const fresh=sectionHost.querySelector('.np-u-research-module[data-np-u-module="'+kind+'"]');
    if(fresh)fresh.outerHTML=markup;
   }
   root.querySelector('#npUFollowChapter').textContent='Раздел '+group.numeral;
   const peek=tocPeek.querySelector('[data-np-u-toc-peek]');
   peek.textContent=group.numeral+'. '+group.title;
   peek.href='#'+group.id;
   peek.dataset.npUGoto=group.id;
   syncModuleFocus();
   const scriptureModule=sectionHost.querySelector('.np-u-research-module[data-np-u-module="scripture"]');
   if(scriptureModule&&!pinnedMarkup.has('scripture'))renderScriptureAt(scriptureModule,0);
   const sourceIndex=sections.length?index:0;
  $$('.np-u-group',root).forEach((el,i)=>el.classList.toggle('is-current',i===sourceIndex));
  $$('.np-u-spine-item',root).forEach(el=>el.classList.toggle('is-current',el.dataset.npUGoto===group.id));
 }
 function supplemental(){
  let html='';
  if(model.appendices?.length)html+=sectionCard('Источники и материалы',
    '<div class="np-u-context-links">'+model.appendices.map(x=>'<button type="button" data-np-u-goto="'+escape(x.id)+'">'+escape(x.label)+'</button>').join('')+'</div>',false,String(model.appendices.length),'sources');
  if(model.relations?.length)html+=sectionCard('В серии',
    '<div class="np-u-context-links">'+model.relations.map(x=>'<a href="'+escape(x.href)+'">'+escape(x.title)+'</a>').join('')+'</div>',false,String(model.relations.length),'series');
   $('#npUOtherHost',root).innerHTML=html;
   syncModuleFocus();
  }
 function show(i){
  if(i<0||i>=sections.length)return;
  if(i!==browserStore.active){
   browserStore.active=i;makeSection(i);recordHistory(i);
   // Argon BookTOC: follow the current chapter and collapse unrelated branches.
   $$('.np-u-group',root).forEach((group,j)=>{
    const branch=group.querySelector('.np-u-sub');
    if(branch)branch.open=j===i;
    const link=group.querySelector('.np-u-major-link');
    if(link){
      if(j===i)link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    }
   });
  }
 }
 function updateScroll(state){if(followEnabled)show(currentGroupIndex(state));}
 function navigate(id){
  const el=document.getElementById(id);
  if(!el)return;
  // Update the research panel synchronously with TOC navigation. Waiting
  // for a passive scroll event left one frame of stale research content,
  // which could be clicked on WebKit immediately after a chapter change.
  const sectionIndex=sections.findIndex(group=>group.id===id||
   group.items?.some(item=>item.id===id));
  if(sectionIndex>=0)show(sectionIndex);
  el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});
  // Preserve the direct link for copying and bookmarking, without adding a
  // new history entry for every chapter click or resetting scroll position.
  const next='#'+encodeURIComponent(id);
  if(location.hash!==next)history.replaceState(history.state,'',location.pathname+location.search+next);
  historyDrawer.hidden=true;
  historyButton.setAttribute('aria-expanded','false');
  closeMobile();
 }
 let mobileOpener=null;
 function isMobile(){return matchMedia('(max-width:1120px)').matches;}
 // W55: move the ORIGINAL mobile Product event owner into the open
 // research header. It retains data-fc-root, TTS/Save listeners and speed radios.
 const productMobileToolbar=document.querySelector('[data-mobile-topbar][data-fc-root]');
 const productMobileToolbarHome=productMobileToolbar?.parentElement;
 const productMobileToolbarNext=productMobileToolbar?.nextSibling;
 function syncMobileResearchToolbar(){
  if(!productMobileToolbar||!productMobileToolbarHome)return;
  const research=root.querySelector('#npUResearch');
  const header=research?.querySelector('.np-u-right-head');
  const dock=isMobile()&&root.classList.contains('np-u-show-right');
  // Keep native <header> a sibling, never nest two landmark headers.
  if(dock&&productMobileToolbar.parentElement!==research)
   research.insertBefore(productMobileToolbar,header);
  else if(!dock&&productMobileToolbar.parentElement!==productMobileToolbarHome){
   const next=productMobileToolbarNext?.parentNode===productMobileToolbarHome
    ?productMobileToolbarNext:null;
   productMobileToolbarHome.insertBefore(productMobileToolbar,next);
  }
  productMobileToolbar.classList.toggle('np-u-w55-docked-mobile',dock);
  document.body.classList.toggle('np-u-w55-mobile-research-actions',dock);
 }
 function syncInteractivity(){
  const mobile=isMobile();
  syncMobileResearchToolbar();
  const leftOpen=root.classList.contains('np-u-show-left');
  const rightOpen=root.classList.contains('np-u-show-right');
  const rightHidden=root.classList.contains('np-u-hide-right');
  // W55: the right research pane caps at 390px on wide desktops.
  // The true rendered edge is authoritative for positioning native Play.
  if(!mobile&&!rightHidden){
   document.body.style.setProperty('--np-u-w55-play-left',
    (right.getBoundingClientRect().left+12).toFixed(1)+'px');
  }
  // W38: align real Product buttons with the single research header row.
  // Keep their original BODY event owner and un-clipped Play speed popup.
  document.body.classList.toggle('np-u-inline-header-actions',
   !mobile&&!rightHidden&&!!((nativeSeriesRoot||nativeLegacyRoot)?.dataset.npUNativeFloating==='1'));
  for(const [el,visible] of [
    [left,!mobile||leftOpen],
    [right,mobile?rightOpen:!rightHidden]
  ]){
    el.inert=!visible;
    el.setAttribute('aria-hidden',String(!visible));
    if(mobile&&visible){el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');}
    else{el.removeAttribute('role');el.removeAttribute('aria-modal');}
  }
  edgeToggle.setAttribute('aria-expanded',String(!rightHidden));
  if(rightHidden)edgeToggle.innerHTML=argonSvg('panel-right-open');
  else if(!copyProductGlyph(edgeToggle,'#npUCloseRight svg','np-u-product-glyph'))
   edgeToggle.innerHTML=argonSvg('panel-right-close');
  const edgeTitle=rightHidden?'Развернуть «Аналитика»':'Свернуть «Аналитика»';
  edgeToggle.setAttribute('aria-label',edgeTitle);
  edgeToggle.title=edgeTitle;
  rightEdge.inert=mobile;
  rightEdge.setAttribute('aria-hidden',String(mobile));
 }
 function closeMobile(restoreFocus=true){
  if(isMobile()&&!fontPanel.hidden)setFontOpen(false);
  const hadOpen=root.classList.contains('np-u-show-left')||root.classList.contains('np-u-show-right');
  root.classList.remove('np-u-show-left','np-u-show-right');
  backdrop.hidden=true;
  document.body.classList.remove('np-u-modal-open');
  $('#npUOpenToc',root).setAttribute('aria-expanded','false');
  $('#npUOpenResearch',root).setAttribute('aria-expanded','false');
  syncInteractivity();
  if(hadOpen&&restoreFocus&&mobileOpener?.isConnected)mobileOpener.focus({preventScroll:true});
  mobileOpener=null;
 }
 function openMobile(side){
  // WebKit does not always focus tapped buttons, so remember the semantic
  // opener rather than relying on document.activeElement.
  mobileOpener=side==='left'?$('#npUOpenToc',root):$('#npUOpenResearch',root);
  root.classList.toggle('np-u-show-left',side==='left');
  root.classList.toggle('np-u-show-right',side==='right');
  document.body.classList.add('np-u-modal-open');backdrop.hidden=false;
  $('#npUOpenToc',root).setAttribute('aria-expanded',String(side==='left'));
  $('#npUOpenResearch',root).setAttribute('aria-expanded',String(side==='right'));
  syncInteractivity();
  if(side==='left')fold?.focus({preventScroll:true});else $('#npUCloseRight',root)?.focus({preventScroll:true});
 }
 function toggleLeft(){
  if(isMobile()){
    if(root.classList.contains('np-u-show-left'))closeMobile();
    else openMobile('left');
    return;
  }
  document.body.classList.toggle('np-u-compact');
  const expanded=!document.body.classList.contains('np-u-compact');
  fold.setAttribute('aria-expanded',String(expanded));
  fold.innerHTML=argonSvg(expanded?'panel-left-close':'panel-left-open');
  fold.title=expanded?'Свернуть оглавление':'Развернуть оглавление';
  fold.setAttribute('aria-label',fold.title);
 }
 root.addEventListener('click',event=>{
  const target=event.target.closest('button,a');
  if(!target)return;
  const thoughtTab=target.dataset.npUThoughtTab;
  if(thoughtTab){
   event.preventDefault();
   const host=target.closest('.np-u-window-body');
   if(!host)return;
   $$('[data-np-u-thought-tab]',host).forEach(button=>{
    const selected=button.dataset.npUThoughtTab===thoughtTab;
    button.setAttribute('aria-selected',String(selected));
    button.setAttribute('tabindex',selected?'0':'-1');
   });
   $$('[data-np-u-thought-pane]',host).forEach(panel=>{
    panel.hidden=panel.dataset.npUThoughtPane!==thoughtTab;
   });
   return;
  }
  const nodeJump=target.dataset.npUNodeJump;
  if(nodeJump!==undefined){
   event.preventDefault();
   const pane=target.closest('.np-u-thought-pane');
   const node=pane?.querySelector('[data-np-u-argument-node="'+nodeJump+'"]');
   if(node){
    pane.querySelectorAll('[data-np-u-node-jump]').forEach(button=>
     button.setAttribute('aria-pressed',String(button===target)));
    pane.querySelectorAll('[data-np-u-argument-node]').forEach(item=>
     item.classList.toggle('is-selected',item===node));
    node.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'nearest'});
    node.focus({preventScroll:true});
   }
   return;
  }
  const pin=target.dataset.npUPin;
  if(pin){
   event.preventDefault();
   const module=target.closest('.np-u-research-module');
   if(pinnedMarkup.has(pin)){
    pinnedMarkup.delete(pin);
    if(pin==='lexicon')pinnedLexiconIndex=null;
    makeSection(browserStore.active);
   }else if(module){
    module.dataset.npUPinned='true';
    target.setAttribute('aria-pressed','true');
    target.setAttribute('aria-label','Снять закрепление '+module.querySelector('summary strong')?.textContent);
    target.title='Снять закрепление';
    pinnedMarkup.set(pin,module.outerHTML);
    if(pin==='lexicon')pinnedLexiconIndex=browserStore.active;
   }
   return;
  }
  const focus=target.dataset.npUFocus;
  if(focus){
   event.preventDefault();
   focusedModule=focusedModule===focus?null:focus;
   syncModuleFocus();
   return;
  }
  const goto=target.dataset.npUGoto;
  if(goto){event.preventDefault();navigate(goto);return;}
  const step=target.dataset.npUScriptureStep;
  if(step!==undefined){
   const module=target.closest('.np-u-research-module');
   const picker=module?.querySelector('[data-np-u-scripture-picker]');
   if(picker)renderScriptureAt(module,picker.selectedIndex+Number(step));
   return;
  }
  const lexStep=target.dataset.npULexStep;
  if(lexStep!==undefined){
   const module=target.closest('.np-u-research-module');
   const picker=module?.querySelector('[data-np-u-lex-picker]');
   if(picker)renderLexiconAt(module,picker.selectedIndex+Number(lexStep));
   return;
  }
  if(target.matches('[data-np-u-scripture-source]')){
   const module=target.closest('.np-u-research-module');
   const ref=module?.querySelector('[data-np-u-scripture-picker]')?.value;
   const native=$$('button.bref[data-ref]',article).find(el=>el.dataset.ref===ref);
   if(native){
    closeMobile();
    native.scrollIntoView({behavior:'instant',block:'center'});
    // Native Product opens a tooltip on FOCUS, not just on click.
    // Focus the contextual paragraph instead, keeping the source
    // discoverable without opening a second floating Bible reader.
    const paragraph=native.closest('p,blockquote')||native.parentElement;
    paragraph.setAttribute('tabindex','-1');
    paragraph.focus({preventScroll:true});
    // Highlight the exact original citation. Do NOT reopen a second long
    // tooltip over the article: the full passage is already in «Писание».
    native.classList.remove('np-u-source-flash');
    void native.offsetWidth;
    native.classList.add('np-u-source-flash');
   }
   return;
  }
  if(target.matches('[data-np-u-scripture-copy]')){
   const module=target.closest('.np-u-research-module');
   const ref=module?.querySelector('[data-np-u-scripture-picker]')?.value||'';
   const source=module?.querySelector('[data-np-u-scripture-reading]');
   const verse=source?.dataset.npUScriptureText||'';
   const credit=source?.dataset.npUScriptureCredit||'';
   if(!verse){target.textContent='Текст недоступен';return;}
   if(!navigator.clipboard?.writeText){target.textContent='Буфер недоступен';return;}
   navigator.clipboard.writeText([ref,verse,credit].filter(Boolean).join('\n')).then(()=>{
    target.textContent='Скопировано';
   }).catch(()=>{target.textContent='Не удалось скопировать';});
   return;
  }
  const evidenceIndex=target.dataset.npUEvidenceIndex;
  if(evidenceIndex!==undefined){
   const source=$$('p,blockquote',article)[Number(evidenceIndex)];
   if(source){
    closeMobile();
    source.scrollIntoView({behavior:'instant',block:'center'});
    source.setAttribute('tabindex','-1');
    source.focus({preventScroll:true});
    source.classList.remove('np-u-evidence-highlight');
    void source.offsetWidth;
    source.classList.add('np-u-evidence-highlight');
   }
   return;
  }
  const termIndex=target.dataset.npUTermIndex;
  if(termIndex!==undefined){
   const source=resolveGlossaryAction(target);
   if(source){
    closeMobile();source.scrollIntoView({behavior:'instant',block:'center'});source.focus?.({preventScroll:true});
   }
   return;
  }
  const ref=target.dataset.npURef;
  if(ref){
   const module=sectionHost.querySelector('.np-u-research-module[data-np-u-module="scripture"]');
   const picker=module?.querySelector('[data-np-u-scripture-picker]');
   const options=picker?[...picker.options]:[];
   const index=options.findIndex(option=>option.value===ref);
   if(index>=0){
    module.querySelector(':scope > details').open=true;
    renderScriptureAt(module,index);
   }else{
    const native=$$('button.bref[data-ref]',article).find(el=>el.dataset.ref===ref);
    if(native)native.click();
   }
   return;
  }
  const noteId=target.dataset.npUNote;
  const figureId=target.dataset.npUFigure;
  const source=noteId?document.getElementById(noteId):figureId!==undefined?$$('figure',article)[Number(figureId)]:null;
  if(source){
    closeMobile();
    source.scrollIntoView({behavior:'instant',block:'center'});
    if(noteId){
      requestAnimationFrame(()=>{
        source.focus?.({preventScroll:true});
        source.click?.();
      });
    }
  }
 });
 // W16: in pilot Reader, inline Scripture opens the single shared
 // study window instead of creating a huge second floating popup.
 // Product's original tooltip markup remains untouched and is read-only.
 window.addEventListener('click',event=>{
  const citation=event.target.closest?.('button.bref[data-ref]');
  if(!citation||!article.contains(citation)||pinnedMarkup.has('scripture'))return;
  const ref=citation.dataset.ref;
  let mod=sectionHost.querySelector('.np-u-research-module[data-np-u-module="scripture"]');
  let pick=mod?.querySelector('[data-np-u-scripture-picker]');
  let idx=pick?[...pick.options].findIndex(x=>x.value===ref):-1;
  if(idx<0){
   const groupIndex=sections.findIndex((_,i)=>getGroupMaterial(i).refs.includes(ref));
   if(groupIndex<0)return;
   show(groupIndex);
   mod=sectionHost.querySelector('.np-u-research-module[data-np-u-module="scripture"]');
   pick=mod?.querySelector('[data-np-u-scripture-picker]');
   idx=pick?[...pick.options].findIndex(x=>x.value===ref):-1;
  }
  if(idx<0)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  focusedModule=null;syncModuleFocus();
  mod.querySelector(':scope>details').open=true;
  renderScriptureAt(mod,idx);
  if(isMobile())openMobile('right');
  else if(root.classList.contains('np-u-hide-right')){
   root.classList.remove('np-u-hide-right');document.body.classList.remove('np-u-hide-right');syncInteractivity();
  }
  mod.scrollIntoView({block:'nearest',behavior:'instant'});
 },true);
 // Capture before Product's document-level ArrowRight/ArrowLeft shortcuts.
 window.addEventListener('keydown',event=>{
  // Keep Product's global chapter arrows away from focused native selectors.
  // Do NOT preventDefault here: the browser must still navigate options.
  if(event.target.matches?.('[data-np-u-scripture-picker],[data-np-u-lex-picker]')&&
     ['ArrowLeft','ArrowRight'].includes(event.key)){
   event.stopImmediatePropagation();
   return;
  }
  const tab=event.target.closest?.('button[data-np-u-thought-tab]');
  if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const tabs=$$('button[data-np-u-thought-tab]',tab.parentElement);
  const current=tabs.indexOf(tab);
  const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:
   (current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  event.preventDefault();
  event.stopImmediatePropagation();
  tabs[index]?.focus({preventScroll:true});
  tabs[index]?.click();
 },true);
 $('#npUFold',root).addEventListener('click',toggleLeft);
 const setRightOpen=(isOpen)=>{
  manualRightChoice=true;
  root.classList.toggle('np-u-hide-right',!isOpen);
  document.body.classList.toggle('np-u-hide-right',!isOpen);
  syncInteractivity();
 };
 // Only the edge button is visible on desktop, in both states.
 edgeToggle.addEventListener('click',()=>{
  setRightOpen(root.classList.contains('np-u-hide-right'));
  edgeToggle.focus({preventScroll:true});
 });
 $('#npUCloseRight',root).addEventListener('click',()=>{
  if(isMobile())closeMobile();
  else edgeToggle.click();
 });
 $('#npUOpenToc',root).addEventListener('click',()=>openMobile('left'));
 $('#npUOpenResearch',root).addEventListener('click',()=>openMobile('right'));
 backdrop.addEventListener('click',()=>closeMobile());
 document.addEventListener('keydown',e=>{
  const opened=root.classList.contains('np-u-show-left')?left:root.classList.contains('np-u-show-right')?right:null;
  // W55: the native library/search dialogs are above the Reader panel.
  // Escape dismisses the TOPMOST dialog first, not both layers at once.
  if(e.key==='Escape'){
   const fromProductDialog=!!e.target.closest?.('#gb-hl-panel,.cp-backdrop');
   const libraryFab=document.getElementById('gb-hl-fab');
   const productDialogActive=e.defaultPrevented||libraryButton.getAttribute('aria-busy')==='true'||
    libraryFab?.getAttribute('aria-busy')==='true'||libraryFab?.getAttribute('aria-expanded')==='true'||
    !!document.querySelector('.cp-backdrop.is-open');
   if(fromProductDialog||productDialogActive)return;
  }
  if(e.key==='Escape'&&opened){e.preventDefault();closeMobile();return;}
  if(e.key!=='Tab'||!opened||!isMobile())return;
  const focusable=$$('button:not([disabled]),a[href],summary,select:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex="0"]',opened)
    .filter(el=>!el.inert&&!el.closest('[inert],[aria-hidden="true"]')&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden');
  const first=focusable[0],last=focusable.at(-1);
  if(!first)return;
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 });
 function responsiveFocusVisible(el){
  return !!(el?.isConnected&&el!==document.body&&el!==document.documentElement&&!el.disabled&&!el.closest('[inert],[hidden],[aria-hidden="true"]')&&
   el.getClientRects().length&&getComputedStyle(el).visibility==='visible');
 }
 let layoutWidth=innerWidth,layoutHeight=innerHeight,lostResponsiveFocus=null;
 document.addEventListener('focusout',event=>{
  if(!event.relatedTarget&&(innerWidth!==layoutWidth||innerHeight!==layoutHeight)&&
   (root.contains(event.target)||fontToggles.includes(event.target))&&!responsiveFocusVisible(event.target))lostResponsiveFocus=event.target;
 },true);
 document.addEventListener('focusin',()=>{lostResponsiveFocus=null;},true);
 function resizeReader(){
  const before=document.activeElement;
  const previous=(before===document.body||before===document.documentElement)?lostResponsiveFocus||before:before;
  lostResponsiveFocus=null;layoutWidth=innerWidth;layoutHeight=innerHeight;
  const closingFont=!fontPanel.hidden;
  const fontOwned=closingFont&&fontPanel.contains(previous);
  const fontControlOwned=fontToggles.includes(previous);
  const leftOwned=left.contains(previous)||previous===tocMobile;
  const rightOwned=right.contains(previous)||rightEdge.contains(previous)||previous===rightMobile;
  const hadMobilePanel=!!mobileOpener;
  const mobileSide=mobileOpener===rightMobile?'right':'left';
  if(closingFont)setFontOpen(false);
  positionFontPanel();
  syncFontDialog(false);
  if(!isMobile()&&hadMobilePanel)closeMobile(false);
  syncNativeSeriesControlMode();syncNativeLegacyControlMode();syncNarrowNativeSeriesNavigation();
  positionProductGlobalActions();positionSeriesAudio();applyIntermediateWidth();syncInteractivity();
  requestAnimationFrame(dockNativeLibrary);
  // Only repair displaced focus. Never take it from an unrelated active dialog.
  const active=document.activeElement;
  if(active!==previous&&active!==document.body&&active!==document.documentElement&&responsiveFocusVisible(active))return;
  if(!fontOwned&&responsiveFocusVisible(previous)&&active===previous)return;
  const lostMobile=hadMobilePanel&&!isMobile()&&(previous===document.body||previous===document.documentElement);
  const candidates=fontOwned?[fontOpener,...fontToggles,isMobile()?tocMobile:fold]:
   fontControlOwned?[previous,...fontToggles,isMobile()?tocMobile:fold]:
   leftOwned||(lostMobile&&mobileSide==='left')?[previous,isMobile()?tocMobile:fold,...fontToggles]:
   rightOwned||(lostMobile&&mobileSide==='right')?[previous,isMobile()?rightMobile:edgeToggle]:
   [previous];
  if(!fontOwned&&!fontControlOwned&&!leftOwned&&!rightOwned&&!lostMobile)return;
  const next=candidates.find(responsiveFocusVisible);
  if(next&&next!==active)next.focus({preventScroll:true});
 }
 addEventListener('resize',resizeReader,{passive:true});
 applyIntermediateWidth();
 syncInteractivity();
 installArgonCentralOverview();
 supplemental();show(currentGroupIndex());
 const unsubscribeReadingState=readerState.subscribe(updateScroll,{immediate:false});
 // Keep the subscription on BFCache entry; only a permanently leaving
 // document relinquishes the presenter subscription.
 const glossaryReady=new MutationObserver(records=>{if(records.some(glossaryMutation))scheduleLexiconRefresh();});
 glossaryReady.observe(article,{subtree:true,childList:true,characterData:true,attributes:true,
  attributeFilter:['data-term','data-term-title','data-category','data-reader-exclude','class'],attributeOldValue:true});
 sectionHost.addEventListener('focusout',scheduleLexiconRefresh);
 window.addEventListener('pagehide',event=>{
  if(lexiconFrame)cancelAnimationFrame(lexiconFrame);
  lexiconFrame=0;
  if(!event.persisted){unsubscribeReadingState();glossaryReady.disconnect();}
 });
 window.addEventListener('pageshow',event=>{if(event.persisted)scheduleLexiconRefresh();});
 window.__NP_UNIVERSAL_PREVIEW__={
  ready:true,source:'real-article',kind:model.kind,counts:model.counts,
  groups:sections.map(s=>({id:s.id,roman:s.numeral})),
  features:model.supports,hasNativeReader:model.supports.nativeRail,
  // Single research owner for desktop and mobile; do not clone panels.
  openResearchForAnnotation(){
   if(isMobile()){
    if(!root.classList.contains('np-u-show-right'))openMobile('right');
   }else setRightOpen(true);
   return true;
  },
  closeResearchForAnnotation(){
   if(isMobile()&&root.classList.contains('np-u-show-right'))closeMobile(false);
   return true;
  }
 };
 console.info('NP_UNIVERSAL_PREVIEW_READY',JSON.stringify(window.__NP_UNIVERSAL_PREVIEW__));
})();
