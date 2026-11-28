/* W49: measured editorial simplification on the real local Product Reader.
 * No replacement TTS, favorites, search, history or theme controllers. */
(() => {
 'use strict';
 const mount=()=>{
  if(!document.body.classList.contains('np-u-preview'))return false;
  if(!window.__NP_UNIVERSAL_PREVIEW__?.ready)return false;
  if(document.body.dataset.npUEditorialRefinement==='ready')return true;
  document.body.dataset.npUEditorialRefinement='ready';
 const article=document.querySelector('main.np-u-reader-main > article.article-body');
 // All four genuine Gill chapters contain the same series navigation, but
 // parts I/III/IV use a plain .note-box instead of .gill-series-overview.
 // Detect the original source cards and heading, never invent series entries.
 const overview=document.querySelector('main.np-u-reader-main .gill-series-overview')||
  [...(article?.querySelectorAll(':scope > .note-box')||[])].find(box=>
   !!box.querySelector(':scope > .grid .gill-card')&&
   box.textContent.includes('\u0421\u0435\u0440\u0438\u044f \u043e \u0414\u0436\u043e\u043d\u0435 \u0413\u0438\u043b\u043b\u0435'));
 if(overview&&!overview.classList.contains('gill-series-overview'))overview.classList.add('gill-series-overview');
 if(overview && !overview.dataset.npUEditorial && overview.querySelector(':scope > .grid .gill-card')){
  const cards=overview.querySelector(':scope > .grid');
  const disclosure=document.createElement('details');
  disclosure.className='np-u-series-disclosure';
  const summary=document.createElement('summary');
  const title=document.createElement('span');title.className='np-u-series-disclosure__label';
  title.textContent='\u0412\u0441\u0435 \u0447\u0430\u0441\u0442\u0438 \u0441\u0435\u0440\u0438\u0438';
  const count=document.createElement('span');count.className='np-u-series-disclosure__count';
  const n=cards.querySelectorAll('.gill-card').length;
  count.textContent=String(n)+' \u0447\u0430\u0441\u0442\u0438';
  const mark=document.createElement('span');mark.className='np-u-series-disclosure__chevron';
  mark.setAttribute('aria-hidden','true');mark.textContent='\u203a';
  summary.append(title,count,mark);
  const introduction=overview.querySelector(':scope > div:first-child p');
  if(introduction){introduction.classList.add('np-u-series-expanded-intro');disclosure.append(summary,introduction,cards);}
  else disclosure.append(summary,cards);
  overview.append(disclosure);
  overview.dataset.npUEditorial='condensed';
  // Keep pre-existing deep links into the original introductory paragraph
  // and series cards usable even though the directory starts collapsed.
  const revealAnchor=()=>{
   if(!location.hash)return;
   let id;
   try{id=decodeURIComponent(location.hash.slice(1))}catch{return}
   const target=document.getElementById(id);
   if(target&&disclosure.contains(target))disclosure.open=true;
  };
  addEventListener('hashchange',revealAnchor);
  revealAnchor();
 }
 // W50: large comparative tables in Gill I/II/IV are source evidence,
 // not mandatory reading interruptions. Keep every original cell and header.
 // We use the real source headings for labels; small tables remain inline.
 const gillText=document.querySelector('main.np-u-reader-main h1')?.textContent||'';
 if(article&&gillText.includes('\u0414\u0436\u043e\u043d \u0413\u0438\u043b\u043b')){
  const tables=[...article.querySelectorAll(':scope > table.manuscript-table')].
   filter(table=>table.rows.length>=7);
  for(const comparison of tables){
   if(comparison.closest('.np-u-evidence-disclosure'))continue;
   const headings=[...comparison.querySelectorAll(':scope > thead th')].
    map(cell=>cell.textContent.trim());
   const first=headings[0]||'';
   let label=headings.slice(0,2).join(' \u2014 ');
   if(first==='\u0418\u0441\u0441\u043b\u0435\u0434\u043e\u0432\u0430\u0442\u0435\u043b\u044c'){
    label='\u0421\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u0435 \u0438\u0441\u0441\u043b\u0435\u0434\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0445 \u043e\u0446\u0435\u043d\u043e\u043a';
   }else if(first==='\u0421\u0442\u0430\u0442\u044c\u044f'){
    label='\u0414\u0432\u0435\u043d\u0430\u0434\u0446\u0430\u0442\u044c \u0441\u0442\u0430\u0442\u0435\u0439 \u0434\u0435\u043a\u043b\u0430\u0440\u0430\u0446\u0438\u0438';
   }else if(first==='\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a'){
    label='\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438 \u0438 \u0438\u0445 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u0435 \u0413\u0438\u043b\u043b\u043e\u043c';
   }
   const details=document.createElement('details');
   details.className='np-u-evidence-disclosure';
   details.dataset.printDisclosure='editorial';
   const summary=document.createElement('summary');
   summary.className='np-u-evidence-disclosure__summary';
   const name=document.createElement('span');name.textContent=label;
   const count=document.createElement('span');count.className='np-u-evidence-disclosure__count';
   count.textContent=comparison.querySelectorAll('tbody tr').length+' \u043f\u043e\u0437\u0438\u0446\u0438\u0439';
   const mark=document.createElement('span');
   mark.setAttribute('aria-hidden','true');mark.textContent='\u203a';
   const region=document.createElement('div');region.className='np-u-evidence-scroll';
   region.tabIndex=0;region.setAttribute('role','region');
   region.setAttribute('aria-label',label);
   summary.append(name,count,mark);
   comparison.before(details);
   details.append(summary,region);
   const hint=document.createElement('small');
   hint.className='np-u-evidence-mobile-hint';
   hint.textContent='\u041b\u0438\u0441\u0442\u0430\u0439\u0442\u0435 \u0442\u0430\u0431\u043b\u0438\u0446\u0443 \u0432 \u0441\u0442\u043e\u0440\u043e\u043d\u0443';
   region.append(hint,comparison);
   const openTarget=()=>{
    if(!location.hash)return;
    let id;try{id=decodeURIComponent(location.hash.slice(1))}catch{return}
    const target=document.getElementById(id);
    if(target&&details.contains(target))details.open=true;
   };
   addEventListener('hashchange',openTarget);
   openTarget();
  }
 }
 // Use the genuine native scroll-top action; expose it progressively in the
 // quiet margin after the reading column, instead of always in the right header.
 const topAction=document.querySelector(
  'body > .gbs-theme-corner.np-u-product-native-floating [data-fc-action="scroll-top"],body > #gbFloatingControls.np-u-native-legacy-float [data-fc-action="scroll-top"]'
 );
 if(!topAction)return true;
 let raf=0;
 const sync=()=>{
  raf=0;
  if(innerWidth<=1120){document.body.classList.remove('np-u-return-visible');topAction.removeAttribute('tabindex');return}
  const main=document.querySelector('main.np-u-reader-main');
  if(!main)return;
  const reading=main.querySelector(':scope > article.article-body')||main;
  const b=reading.getBoundingClientRect();
  const panel=document.querySelector('#npUResearch');
  const pr=panel?.getBoundingClientRect();
  const panelIsVisible=pr&&pr.width>0&&!document.body.classList.contains('np-u-hide-right');
  const maxX=panelIsVisible?pr.left-42:innerWidth-48;
  const left=Math.max(8,Math.min(b.right+10,maxX));
  const inset=Math.max(10,innerWidth-left-38);
  document.body.style.setProperty('--np-u-return-inset',inset.toFixed(1)+'px');
  const show=scrollY>Math.max(1000,innerHeight*1.15);
  document.body.classList.toggle('np-u-return-visible',show);
  topAction.tabIndex=show?0:-1;
 };
 const schedule=()=>{if(!raf)raf=requestAnimationFrame(sync)};
 document.addEventListener('scroll',schedule,{passive:true});
 addEventListener('resize',schedule,{passive:true});
 // The sidebar can move the reading column without resizing the viewport.
 document.addEventListener('click',e=>{
  if(e.target.closest('#npUEdgeToggle,#npUCloseRight,.gbs2-world .gbs-rail [data-reader-rail-toggle]')){
   schedule();
   setTimeout(sync,220);
  }
 },{capture:true});
 sync();
 return true;
 };
 let attempts=0;
 const gate=()=>{
  if(mount())return;
  if(++attempts<300)requestAnimationFrame(gate);
 };
 gate();
 addEventListener('load',gate,{once:true});
})();
