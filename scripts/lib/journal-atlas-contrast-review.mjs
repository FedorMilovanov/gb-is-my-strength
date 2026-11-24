// Candidate helper for MAX0-owned browser QA. No axe rules disabled.
import assert from 'node:assert/strict';
import { financeModel } from '../../src/components/journal/g3-graphics/finance-model.mjs';
const root='.g3g-atlas';
const svg=root+' .g3g-atlas-map svg';
const specs=[
 ['#g3g-history-atlas-heading','Места конференций и встречи по заявлению','html'],
 [svg+' text[x="105"][y="116"]','100° з. д.','svg'],
 [svg+' text[x="305"][y="116"]','90°','svg'],
 [svg+' text[x="505"][y="116"]','80°','svg'],
 [svg+' text[x="8"][y="188"]','35° с. ш.','svg'],
 [svg+' text[x="8"][y="308"]','30°','svg'],
 [svg+' text[x="290"][y="142"]','Соединённые Штаты','svg'],
 [svg+' text[x="315"][y="379"]','Мексиканский залив','svg'],
 [svg+' text[x="62"][y="379"]','Мексика','svg'],
 [svg+' text[x="472"][y="192"]','1','svg'],
 [svg+' text[x="235"][y="270"]','2','svg'],
 [svg+' text[x="87"][y="264"]','3','svg'],
 [svg+' text[x="85"][y="151"]','4','svg'],
 [svg+' text[font-size="12"][x="0"][y="17"]','С','svg'],
 [root+' .g3g-atlas-map > figcaption','Natural Earth, 1:110 млн; обзорный контур и примерные центры городов. Линии ведут к выноскам, а не обозначают маршруты.','html']
];
// Exact adopted inputs from G3Dossier.astro at 8f9130a9; review fails closed on changes.
const financeRoot='.g3g-finance .g3g-chart svg';
const fm=financeModel({total:1061800,conferences:817283,advertising:246511});
const at=(cls,x,y)=>financeRoot+' text'+cls+'[x="'+x+'"][y="'+y+'"]';
const shortSpecs=[
 ['.g3g-history > header .g3g-deck','Избранные даты и места по документам, каталогам и свидетельствам участников.','html'],
 [root+' .g3g-map-key > span:nth-child(1)','Место конференции или анонса','html'],
 [root+' .g3g-map-key > span:nth-child(2)','Встреча по заявлению 2018 года','html'],
 [at('.g3g-tick',12,20),'тыс. USD','finance'],
 ...fm.ticks.map(t=>[at('.g3g-tick',65,t.y+4),t.label,'finance']),
 ...fm.rows.map(t=>[at('',t.x+45,293),t.short,'finance']),
 ...fm.rows.filter((_,i)=>i!==2).map(t=>[at('.g3g-value-label',t.x+45,t.y-9),t.display,'finance']),
 [at('.g3g-annotation-label',fm.rows[2].x+45,fm.rows[2].y-34),fm.rows[2].display,'finance'],
];
const allowedSummaries={
 html:["Element's background color could not be determined because it is overlapped by another element"],
 svg:["Element's background color could not be determined because it is overlapped by another element","Element's background color could not be determined because element contains an image node","Element content is too short to determine if it is actual text content"]
};
const settle=async page=>{let prev='',stable=0;for(let i=0;i<60;i++){const now=await page.evaluate(()=>JSON.stringify([scrollY,document.querySelector('.mcp-top')?.getBoundingClientRect().bottom,document.querySelector('[data-journal-contents]')?.getBoundingClientRect().bottom]));stable=now===prev?stable+1:0;if(stable>=3)return;prev=now;await page.waitForTimeout(50)}throw Error('atlas viewport did not settle')};
// Returns only exact atlas reviews; unrelated reviews are left to existing strict TOC reviewer.
export async function reviewAtlasContrast(page,reviews,{short=false}={}){
 const activeSpecs=short?[...specs,...shortSpecs]:specs;
 const pending=[],remaining=[];
 for(const rule of reviews){const rest=[];for(const node of rule.nodes){
  const match=await page.evaluate(({target,specs,short})=>{if(target.length!==1)return null;const hits=document.querySelectorAll(target[0]);if(hits.length!==1)return null;const el=hits[0];if(!el.closest('.g3g-atlas')&&!(short&&(el.closest('.g3g-finance')||el.matches('.g3g-history > header .g3g-deck'))))return null;const hit=specs.findIndex(([sel])=>document.querySelectorAll(sel).length===1&&document.querySelector(sel)===el);return {hit,text:el.textContent.trim()}},{target:node.target,specs:activeSpecs,short});
  if(match===null){rest.push(node);continue}
  assert.equal(rule.id,'color-contrast');assert(match.hit>=0,'unknown atlas axe node: '+JSON.stringify(node));const [sel,expected,kind]=activeSpecs[match.hit];assert.equal(match.text,expected);assert(allowedSummaries[kind==='finance'?'svg':kind].some(s=>node.summary?.includes(s)),'unknown atlas axe reason: '+JSON.stringify(node));assert(!pending.some(x=>x.sel===sel),'duplicate atlas review');pending.push({sel,expected,kind,target:node.target,summary:node.summary});
 }if(rest.length)remaining.push({...rule,nodes:rest});}
 if(!pending.length)return {witnesses:[],remaining};
 if(pending.some(x=>x.sel.startsWith(root)||x.sel==='#g3g-history-atlas-heading'))assert.equal(await page.locator(svg+' text').count(),13);
 if(pending.some(x=>x.kind==='finance'))assert.equal(await page.locator(financeRoot+' text').count(),14);
 const saved=await page.evaluate(()=>({x:scrollX,y:scrollY,rail:document.querySelector('.je-editorial-rail__scrollport')?.scrollTop,open:document.querySelector('[data-journal-contents]')?.open,focus:document.activeElement?.outerHTML}));
 const witnesses=[];
 try{for(const item of pending){
  // Native document scrolling only; preserve open TOC, theme, focus and CSS.
  let state;
  for(const fraction of [.68,.8,.9,.55,.4]){
   await page.locator(item.sel).evaluate((e,f)=>{const r=e.getBoundingClientRect();window.scrollTo({top:scrollY+r.top+r.height/2-innerHeight*f,behavior:'instant'})},fraction);
   await settle(page);
   state=await page.locator(item.sel).evaluate((e,kind)=>{
    const figure=e.closest('.g3g-atlas')||e.closest('.g3g-history')?.querySelector('.g3g-atlas')||e.closest('.g3g-finance');
    const svg=figure.querySelector('svg'),land=svg.querySelector('.g3g-atlas-land');
    const parse=s=>{const m=s.match(/^rgba?\(([\d.,\s]+)\)$/);if(!m)return null;const a=m[1].split(',').map(Number);return a.length>=3&&(a[3]??1)===1?a.slice(0,3):null};
    const lum=c=>c.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
    const contrast=(a,b)=>{if(!a||!b)return 0;const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
    const fg=parse(getComputedStyle(e)[kind!=='html'?'fill':'color']);
    const paper=parse(getComputedStyle(svg).backgroundColor),panel=land?parse(getComputedStyle(land).fill):null;
    let parent=e,flat=true,htmlBackground=null;
    while(parent){const st=getComputedStyle(parent);flat&&=Number(st.opacity)===1&&st.filter==='none'&&st.mixBlendMode==='normal'&&st.backgroundImage==='none';if(!htmlBackground){const color=parse(st.backgroundColor);if(color)htmlBackground=color;}parent=parent.parentElement;}
    const r=e.getBoundingClientRect(),s=svg.getBoundingClientRect();const inset=Math.min(1,r.width/4,r.height/4);const xs=[r.left+inset,(r.left+r.right)/2,r.right-inset],ys=[r.top+inset,(r.top+r.bottom)/2,r.bottom-inset];const hit=[];
    for(const x of xs)for(const y of ys){const h=document.elementFromPoint(x,y);hit.push({x,y,ok:!!h&&(kind!=='html'?svg.contains(h):e.contains(h)),target:h?.tagName,className:h?.getAttribute('class')});}
    const bounds=r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=document.documentElement.clientWidth+1&&r.bottom<=innerHeight+1&&(kind==='html'||(r.left>=s.left-1&&r.right<=s.right+1&&r.top>=s.top-1&&r.bottom<=s.bottom+1));
    const intersections=[];let stateGlyphReviews=[];
    if(kind==='finance'){
     // Test filled and stroked geometry, including zero-height grid/connector lines.
     const shapes=[...svg.querySelectorAll('rect,path,line,circle')];
     if(shapes.length!==13||svg.querySelectorAll('rect').length!==4||svg.querySelectorAll('line').length!==8||svg.querySelectorAll('path').length!==1)intersections.push({shape:'unexpected geometry',ratio:0});
     for(const shape of shapes){
      const st=getComputedStyle(shape),b=shape.getBoundingClientRect(),m=shape.getScreenCTM();
      const stroke=st.stroke==='none'?0:parseFloat(st.strokeWidth)*Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d))/2;
      const overlap=(pad)=>b.left-pad<r.right&&b.right+pad>r.left&&b.top-pad<r.bottom&&b.bottom+pad>r.top;
      for(const [paint,pad] of [[shape.tagName.toLowerCase()==='rect'?st.fill:'none',0],[st.stroke,stroke]])if(paint!=='none'&&overlap(pad))intersections.push({shape:shape.getAttribute('class'),paint,ratio:contrast(fg,parse(paint))});
     }
     // SVG text element rectangles include font ascender/descender whitespace.
     // Compare actual glyph ink bounds only when coarse text boxes intersect.
     const glyphBoxes=t=>{
      const st=getComputedStyle(t),matrix=t.getScreenCTM(),ctx=document.createElement('canvas').getContext('2d');
      if(!matrix||!ctx||Math.abs(matrix.b)>1e-7||Math.abs(matrix.c)>1e-7||matrix.a<=0||matrix.d<=0||st.writingMode!=='horizontal-tb'||st.direction!=='ltr'||st.fontStyle!=='normal'||st.stroke!=='none')return null;
      ctx.font=st.fontWeight+' '+st.fontSize+' '+st.fontFamily;ctx.textBaseline='alphabetic';ctx.textAlign='left';
      const chars=Array.from(t.textContent);
      if(chars.length!==t.getNumberOfChars())return null;
      const boxes=[];
      for(let i=0;i<chars.length;i++){
       if(/\s/u.test(chars[i]))continue;
       if(Math.abs(t.getRotationOfChar(i))>1e-7)return null;
       const p=t.getStartPositionOfChar(i),m=ctx.measureText(chars[i]),a=[m.actualBoundingBoxLeft,m.actualBoundingBoxRight,m.actualBoundingBoxAscent,m.actualBoundingBoxDescent];
       if(!a.every(Number.isFinite)||a[0]+a[1]<=0||a[2]+a[3]<=0)return null;
       boxes.push({left:matrix.a*(p.x-a[0])+matrix.e,right:matrix.a*(p.x+a[1])+matrix.e,top:matrix.d*(p.y-a[2])+matrix.f,bottom:matrix.d*(p.y+a[3])+matrix.f});
      }
      return boxes.length?boxes:null;
     };
     const intersects=(a,b,pad=0)=>a.left-pad<b.right&&a.right+pad>b.left&&a.top-pad<b.bottom&&a.bottom+pad>b.top;
     const glyphReviews=[];
     for(const t of svg.querySelectorAll('text'))if(t!==e){
      const b=t.getBoundingClientRect();
      if(!intersects(r,b))continue;
      const a=glyphBoxes(e),c=glyphBoxes(t);
      const collision=!a||!c||a.some(x=>c.some(y=>intersects(x,y,.5)));
      glyphReviews.push({other:t.textContent,coarse:b.toJSON(),glyphs:a,otherGlyphs:c,collision});
      if(collision)intersections.push({shape:'other text',text:t.textContent,ratio:0});
     }
     stateGlyphReviews=glyphReviews;
    }
    return {fg,paper,panel,htmlBackground,flat,bounds,hit,intersections,glyphReviews:stateGlyphReviews,ratios:kind==='svg'?[contrast(fg,paper),contrast(fg,panel)]:[contrast(fg,htmlBackground),...intersections.map(x=>x.ratio)],rect:r.toJSON()};
   },item.kind);
   if(state.bounds&&state.hit.every(x=>x.ok))break;
  }
  assert(state.bounds&&state.hit.every(x=>x.ok)&&state.flat&&state.ratios.every(x=>x>=4.5),'unresolved atlas contrast '+JSON.stringify({item,state}));witnesses.push({...item,...state});
 }}finally{
  await page.evaluate(({x,y,rail})=>{window.scrollTo({left:x,top:y,behavior:'instant'});const el=document.querySelector('.je-editorial-rail__scrollport');if(el&&rail!==undefined)el.scrollTop=rail;},saved);await settle(page);
  const restored=await page.evaluate(()=>({x:scrollX,y:scrollY,rail:document.querySelector('.je-editorial-rail__scrollport')?.scrollTop,open:document.querySelector('[data-journal-contents]')?.open,focus:document.activeElement?.outerHTML}));
  assert(Math.abs(restored.x-saved.x)<2&&Math.abs(restored.y-saved.y)<2&&restored.open===saved.open&&restored.focus===saved.focus&&restored.rail===saved.rail,'atlas review changed native navigation state');
 }
 return {witnesses,remaining};
}
