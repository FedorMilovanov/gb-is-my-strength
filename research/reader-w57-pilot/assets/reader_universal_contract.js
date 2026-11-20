/* Unified Reader Document Contract v1
   Pure DOM inspector for articles, chapters, series and reference works.
   Never overwrites the Product's native controllers or article DOM.
   A structured model, not a second Reader. In local preview only.
   No invented section titles, Bible citations or footnotes. */
(() => {
 'use strict';
 if(window.GBReaderContract?.version==='1.0.0')return;
 const normalize=(s)=>String(s??'').replace(/\s+/g,' ').trim();
 const numerals=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
 const entry=(el,level)=>({id:el.id,level:level||Number(el.tagName.slice(1)),label:normalize(el.textContent)});
 function escapeBookHeading(h){
  return /^(?:\d+[\.\)]\s*|(?:часть|глава)\s+[IVXLCDM\d]+[:.\s—–-]*)/i.test(h.label);
 }
 function supplemental(h){
  const s=h.label.toLowerCase(),id=h.id;
  return /^summary-title-auto$|^sec-quiz$|^spravka$|^gbrelations|^gill-search-p-(?:0\d\d|1\d\d)$|^read-next-/.test(id) && /содержан|вопрос|проверь|источник|сверк|связ|чита|исследован|литератур|тест/i.test(s)
    || /^(?:краткое содержание|часто задаваемые вопросы|проверь себя|источники|источники и сверка|источники и литература|продолжить исследование|контекст и связи|читателю|похожие материалы)/i.test(s)
    || /^sources-|^bibliography-|^footnotes-|^endnotes-/.test(id);
 }
 function inferKind(doc,path,headings){
  const main=doc.querySelector('[data-reader-kind]');
  if(main?.dataset.readerKind)return main.dataset.readerKind;
  const title=doc.title.toLowerCase();
  if(/справочник|глоссарий|лексикон/i.test(title)||/(?:spravochnik|glossary)(?:\/|$)/.test(path))return 'reference';
  if(/^\/baptisty-rossii\//.test(path))return 'series-chapter';
  // Five actual chapters of the Sermon on the Mount, not an unrelated article.
  if(/^\/nagornaya\/chast-\d+\//.test(path))return 'series-chapter';
  if(/dzhon-gill-chast-/.test(path)||/chast-\d+/.test(path))return 'series-chapter';
  if(/\/(?:books|biblioteka|knigi|book)\//.test(path))return 'book-chapter';
  // Article-scoped series evidence only. A global site menu called
  // "Серии" must never reclassify every ordinary article as a chapter.
  const local=articleRoot(doc);
  const seriesNav=local?.querySelector('.series-toc,.book-chapter-nav,[data-reader-series],nav[aria-label*="серии" i]');
  if(seriesNav)return 'series-chapter';
  return 'article';
 }
 function articleRoot(doc){
  return doc.querySelector('article[data-reader-projection],article.article-body,main article[data-pagefind-body],main article')
   || doc.querySelector('[data-reader-projection]') || doc.querySelector('main');
 }
 function properRoman(label){
  const match=/^\s*(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)\s*[.)\:]\s+/i.exec(label);
  return match?.[1].toUpperCase()||null;
 }
 function buildGroups(items,kind){
  if(!items.length)return [];
  let primary=items.filter(h=>h.level===2&&!supplemental(h));
  if(!primary.length)primary=items.filter(h=>!supplemental(h));
  if(!primary.length)return [];
  const romanAlready=primary.every(h=>properRoman(h.label));
  // Do not invent 6 chapters for a 2-part biography or a 9-part reference work.
  // The full TOC is exhaustive; the collapsed rail must never carry 20
  // individual nodes. Preserve explicit Roman chapters as authored.
  const groupLimit=romanAlready?primary.length:primary.length>8?7:primary.length;
  const chunkSize=Math.ceil(primary.length/groupLimit);
  const out=[];
  for(let i=0;i<primary.length;i+=chunkSize){
   const part=primary.slice(i,i+chunkSize);
   const first=part[0],end=primary[i+chunkSize];
   const startIndex=items.findIndex(h=>h.id===first.id);
   const endIndex=end?items.findIndex(h=>h.id===end.id):items.length;
   const children=items.slice(startIndex,endIndex).filter(h=>!supplemental(h));
   const numeral=romanAlready?properRoman(first.label):(numerals[out.length]||String(out.length+1));
   out.push({id:first.id,numeral,title:first.label,grouped:part.length>1,
     primaryIds:part.map(h=>h.id),items:children,kind});
  }
  return out;
 }
 function hermeneuticsGroups(items){
  const ids=['sec-definitions','sec-explanation','sec-assessment','sec-consequences','sec-sufficiency','sec-conclusion'];
  if(!ids.every(id=>items.some(h=>h.id===id)))return null;
  const major=ids.map(id=>items.find(h=>h.id===id));
  const out=[];
  for(let i=0;i<major.length;i++){
   const start=items.findIndex(h=>h.id===major[i].id);
   const end=i+1<major.length?items.findIndex(h=>h.id===major[i+1].id):items.length;
   const nodes=items.slice(start,end).filter(h=>!supplemental(h));
   out.push({id:major[i].id,numeral:numerals[i],title:major[i].label,
     grouped:false,primaryIds:[major[i].id],items:nodes,kind:'article'});
  }
  return out;
 }
 function compactNodes(groups,maxVisible=7){
  if(groups.length<=maxVisible)return groups.map((g,index)=>({...g,sourceIndex:index}));
  const indexes=[];
  for(let i=0;i<maxVisible;i++){
    const index=Math.round(i*(groups.length-1)/(maxVisible-1));
    if(!indexes.includes(index))indexes.push(index);
  }
  return indexes.map(index=>({...groups[index],sourceIndex:index}));
 }
 function getContent(doc,root){
  const refUses=[...root.querySelectorAll('button.bref[data-ref]')].map(x=>normalize(x.dataset.ref)).filter(Boolean);
  const refs=[...new Set(refUses)];
  const noteRefs=root.querySelectorAll('.fn-marker,.footnote-ref,[data-footnote-ref]');
  const footnotes=root.querySelectorAll('[id^="fn-"],.footnotes li,.endnotes li');
  const sourceSections=[...root.querySelectorAll('h2[id],h3[id]')].filter(h=>supplemental(entry(h))).map(h=>entry(h));
  const anchors=[...root.querySelectorAll('h2[id],h3[id],h4[id],h5[id],h6[id]')].filter(h=>!h.closest('.faq-accordion,.related-articles,.footnotes,footer,aside,nav'))
    .map(h=>entry(h));
  const path=doc.location?.pathname||'';
  const kind=inferKind(doc,path,anchors);
  const groups=(/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/.test(path)?hermeneuticsGroups(anchors):null)
   ||buildGroups(anchors,kind);
  const articleLinks=[...root.querySelectorAll('a[href]')].filter(a=>a.closest('.series-nav,.book-chapter-nav,.related-series,[data-reader-series]'));
  const relations=articleLinks.map(a=>({href:a.getAttribute('href'),title:normalize(a.textContent)}))
   .filter(r=>r.href&&r.title).slice(0,60);
  const hLevelCounts=Object.fromEntries([2,3,4,5,6].map(i=>['h'+i,anchors.filter(a=>a.level===i).length]));
  const figures=[...root.querySelectorAll('figure')];
  const captionedFigures=figures.filter(f=>normalize(f.querySelector('figcaption')?.textContent).length>0);
  const imgs=[...root.querySelectorAll('img')];
  const imageWithAlt=imgs.filter(img=>normalize(img.getAttribute('alt')).length>0);
  const embeddedTables=root.querySelectorAll('table').length;
  const directQuotes=root.querySelectorAll('blockquote').length;
  const role=groups.length>15?'very-long':groups.length>7?'long':groups.length<=2?'compact':'medium';
  return {
   schemaVersion:1,
   path,title:doc.title,
   kind,role,
   supports:{
    manuscriptAudio:!!doc.querySelector('#gbFloatingControls [data-fc-action="play"]'),
    nativeRail:!!doc.querySelector('aside.hrail'),
    scripture:refs.length>0,
    notes:noteRefs.length>0||footnotes.length>0,
    seriesNav:relations.length>0,
    hierarchy:anchors.some(h=>h.level>2),
    media:imgs.length>0,
    captions:captionedFigures.length>0,
    tables:embeddedTables>0,
    quotations:directQuotes>0,
    pages:true
   },
   counts:{headings:anchors.length,sectionGroups:groups.length,scriptureRefs:refs.length,scriptureUses:refUses.length,
    footnoteMarkers:noteRefs.length,footnotes:footnotes.length,
    figures:figures.length,captionedFigures:captionedFigures.length,uncaptionedFigures:figures.length-captionedFigures.length,
    images:imgs.length,imagesWithAlt:imageWithAlt.length,tables:embeddedTables,blockquotes:directQuotes,
    hLevels:hLevelCounts},
   groups,compactOutline:compactNodes(groups),appendices:sourceSections,refs:refs.slice(0,200),relations,
   recommendedWindows: [
     {id:'context',show:true,label:'У этого абзаца'},
     {id:'section',show:groups.length>0,label:'В этом разделе'},
     {id:'scripture',show:refs.length>0,label:'Писание'},
     {id:'notes',show:noteRefs.length>0||footnotes.length>0,label:'Сноски'},
     {id:'series',show:relations.length>0,label:'В серии'}
   ].filter(w=>w.show)
  };
 }
 function inspect(doc=document){
  const root=articleRoot(doc);
  if(!root)return {schemaVersion:1,kind:'unsupported',groups:[],supports:{},counts:{},recommendedWindows:[]};
  return getContent(doc,root);
 }
 function validate(m){
  const ids=new Set();
  let broken=0,duplicate=0,unnamed=0;
  for(const group of m.groups){
   if(!group.id||!group.title)unnamed++;
   if(ids.has(group.id))duplicate++;
   ids.add(group.id);
   if(!group.items.length)broken++;
   for(const h of group.items){
    if(!h.id||!h.label)broken++;
   }
  }
  return {valid:!broken&&!duplicate&&!unnamed&&m.groups.length>0,
    broken,duplicate,unnamed,groups:m.groups.length,refs:m.counts.scriptureRefs};
 }
 window.GBReaderContract=Object.freeze({version:'1.1.0',articleRoot,inspect,validate,buildGroups,compactNodes,chapterNumerals:numerals});
})();
