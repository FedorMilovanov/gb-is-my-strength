// Candidate helper for MAX0-owned browser QA. No axe rules disabled.
import assert from 'node:assert/strict';
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
const allowedSummaries={
 html:["Element's background color could not be determined because it is overlapped by another element"],
 svg:["Element's background color could not be determined because it is overlapped by another element","Element's background color could not be determined because element contains an image node","Element content is too short to determine if it is actual text content"]
};
const settle=async page=>{let prev='',stable=0;for(let i=0;i<60;i++){const now=await page.evaluate(()=>JSON.stringify([scrollY,document.querySelector('.mcp-top')?.getBoundingClientRect().bottom,document.querySelector('[data-journal-contents]')?.getBoundingClientRect().bottom]));stable=now===prev?stable+1:0;if(stable>=3)return;prev=now;await page.waitForTimeout(50)}throw Error('atlas viewport did not settle')};
// Returns only exact atlas reviews; unrelated reviews are left to existing strict TOC reviewer.
export async function reviewAtlasContrast(page,reviews){
 const pending=[],remaining=[];
 for(const rule of reviews){const rest=[];for(const node of rule.nodes){
  const match=await page.evaluate(({target,specs})=>{if(target.length!==1)return null;const hits=document.querySelectorAll(target[0]);if(hits.length!==1)return null;const el=hits[0];if(!el.closest('.g3g-atlas'))return null;const hit=specs.findIndex(([sel])=>document.querySelectorAll(sel).length===1&&document.querySelector(sel)===el);return {hit,text:el.textContent.trim()}},{target:node.target,specs});
  if(match===null){rest.push(node);continue}
  assert.equal(rule.id,'color-contrast');assert(match.hit>=0,'unknown atlas axe node: '+JSON.stringify(node));const [sel,expected,kind]=specs[match.hit];assert.equal(match.text,expected);assert(allowedSummaries[kind].some(s=>node.summary?.includes(s)),'unknown atlas axe reason: '+JSON.stringify(node));assert(!pending.some(x=>x.sel===sel),'duplicate atlas review');pending.push({sel,expected,kind,target:node.target,summary:node.summary});
 }if(rest.length)remaining.push({...rule,nodes:rest});}
 if(!pending.length)return {witnesses:[],remaining};
 assert.equal(await page.locator(svg+' text').count(),13);
 const saved=await page.evaluate(()=>({x:scrollX,y:scrollY,open:document.querySelector('[data-journal-contents]')?.open,focus:document.activeElement?.outerHTML}));
 const witnesses=[];
 try{for(const item of pending){
  // Native document scrolling only; preserve open TOC, theme, focus and CSS.
  let state;
  for(const fraction of [.68,.8,.9,.55,.4]){
   await page.locator(item.sel).evaluate((e,f)=>{const r=e.getBoundingClientRect();window.scrollTo({top:scrollY+r.top+r.height/2-innerHeight*f,behavior:'instant'})},fraction);
   await settle(page);
   state=await page.locator(item.sel).evaluate((e,kind)=>{
    const figure=e.closest('.g3g-atlas'),svg=figure.querySelector('svg'),land=svg.querySelector('.g3g-atlas-land');
    const parse=s=>{const m=s.match(/^rgba?\(([\d.,\s]+)\)$/);if(!m)return null;const a=m[1].split(',').map(Number);return a.length>=3&&(a[3]??1)===1?a.slice(0,3):null};
    const lum=c=>c.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
    const contrast=(a,b)=>{if(!a||!b)return 0;const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
    const fg=parse(getComputedStyle(e)[kind==='svg'?'fill':'color']);
    const paper=parse(getComputedStyle(svg).backgroundColor),panel=parse(getComputedStyle(land).fill);
    let parent=e,flat=true,htmlBackground=null;
    while(parent){const st=getComputedStyle(parent);flat&&=Number(st.opacity)===1&&st.filter==='none'&&st.mixBlendMode==='normal'&&st.backgroundImage==='none';if(!htmlBackground){const color=parse(st.backgroundColor);if(color)htmlBackground=color;}parent=parent.parentElement;}
    const r=e.getBoundingClientRect(),s=svg.getBoundingClientRect();const inset=Math.min(1,r.width/4,r.height/4);const xs=[r.left+inset,(r.left+r.right)/2,r.right-inset],ys=[r.top+inset,(r.top+r.bottom)/2,r.bottom-inset];const hit=[];
    for(const x of xs)for(const y of ys){const h=document.elementFromPoint(x,y);hit.push({x,y,ok:!!h&&(kind==='svg'?svg.contains(h):e.contains(h)),target:h?.tagName,className:h?.getAttribute('class')});}
    const bounds=r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=document.documentElement.clientWidth+1&&r.bottom<=innerHeight+1&&(kind!=='svg'||(r.left>=s.left-1&&r.right<=s.right+1&&r.top>=s.top-1&&r.bottom<=s.bottom+1));
    return {fg,paper,panel,htmlBackground,flat,bounds,hit,ratios:kind==='svg'?[contrast(fg,paper),contrast(fg,panel)]:[contrast(fg,htmlBackground)],rect:r.toJSON()};
   },item.kind);
   if(state.bounds&&state.hit.every(x=>x.ok))break;
  }
  assert(state.bounds&&state.hit.every(x=>x.ok)&&state.flat&&state.ratios.every(x=>x>=4.5),'unresolved atlas contrast '+JSON.stringify({item,state}));witnesses.push({...item,...state});
 }}finally{
  await page.evaluate(({x,y})=>window.scrollTo({left:x,top:y,behavior:'instant'}),saved);await settle(page);
  const restored=await page.evaluate(()=>({x:scrollX,y:scrollY,open:document.querySelector('[data-journal-contents]')?.open,focus:document.activeElement?.outerHTML}));
  assert(Math.abs(restored.x-saved.x)<2&&Math.abs(restored.y-saved.y)<2&&restored.open===saved.open&&restored.focus===saved.focus,'atlas review changed native navigation state');
 }
 return {witnesses,remaining};
}
