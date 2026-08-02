from pathlib import Path
import json
import re
import xml.etree.ElementTree as ET

root=Path('.')
routef=root/'karty/avraam/route.json'
svgf=root/'karty/avraam/base.svg'
harness=root/'scripts/avraam-reference-baseline.mjs'

# ── Route truth: explicit totals, reusable semantic zoom and story cameras ──
r=json.loads(routef.read_text('utf-8'))
meta=r.setdefault('meta',{})
stats=meta.setdefault('stats',{})
route_places=[place for place in r.get('places',[]) if isinstance(place.get('stage'),int)]
context_places=[place for place in r.get('places',[]) if not isinstance(place.get('stage'),int)]
stats.update({
    'places':len(r.get('places',[])),
    'route_places':len(route_places),
    'context_places':len(context_places),
    'verified_waypoints':len(r.get('verified_waypoints',[])),
})
meta['semantic_zoom']={
    'overview_min_w':1292,
    'detail_max_w':380,
    'overview_min_units_per_pixel':1.25,
    'detail_max_units_per_pixel':0.72,
}
story_views={
    'lot':[640,835,520],
    'war':[660,700,600],
    'akeda':[610,850,400],
}
for story in r.get('stories',[]):
    desired=story_views.get(story.get('id'))
    if desired:
        story['cam']=desired[:]
        story['viewport']=desired[:]
routef.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n','utf-8')

# ── SVG depth: calm overview, detail-only symbols, asymmetric relief ──
v=svgf.read_text('utf-8')
old_negev='<text class="region-label" x="528" y="910" font-size="11" letter-spacing=".22em">НЕГЕВ</text>'
new_negev='<text class="region-label lbl-overview" x="528" y="910" font-size="11" letter-spacing=".22em">НЕГЕВ</text>'
if new_negev not in v:
    if old_negev not in v: raise SystemExit('MISSING NEGEV label')
    v=v.replace(old_negev,new_negev,1)

if '<g id="sinaiPeak" class="lbl-z2"' not in v:
    if '<g id="sinaiPeak" class="lbl-z1"' not in v: raise SystemExit('MISSING sinaiPeak')
    v=v.replace('<g id="sinaiPeak" class="lbl-z1"','<g id="sinaiPeak" class="lbl-z2"',1)

new_hermon='''<!-- Хермон — протяжённый контурный массив у Дана; только detail. -->
<g id="hermonRelief" class="lbl-z2" transform="translate(668,594)" opacity=".62" fill="none" stroke-linecap="round">
  <path d="M-22,10 C-17,8 -14,3 -11,-2 C-8,-7 -5,-13 0,-16 C4,-13 7,-7 10,-3 C13,2 17,6 22,9"
    stroke="#6080a0" stroke-width="1.05"/>
  <path d="M-17,11 C-13,7 -11,3 -8,-1 C-5,-6 -2,-10 1,-12 C5,-8 7,-4 10,0 C13,4 16,7 19,10"
    stroke="#7894ae" stroke-width=".62" opacity=".72"/>
  <path d="M-10,10 C-7,6 -5,2 -2,-2 C0,-5 2,-7 4,-8 C7,-5 9,-1 12,3 C14,6 16,8 18,10"
    stroke="#9ab0c2" stroke-width=".38" opacity=".5"/>
  <text x="1" y="17" text-anchor="middle" font-size="4.3" fill="#7090b8" letter-spacing=".1em">ХЕРМОН</text>
  <text x="1" y="22" font-size="3.1" fill="#6080a8" text-anchor="middle" opacity=".78">2814 м · הַר חֶרְמוֹן</text>
</g>'''
if 'id="hermonRelief"' not in v:
    match=re.search(r'<!-- Хермон — гора у Дана -->\n<g class="lbl-z1" transform="translate\(668,594\)" opacity="\.4">.*?</g>',v,re.S)
    if not match: raise SystemExit('MISSING Hermon group')
    v=v[:match.start()]+new_hermon+v[match.end():]

new_relief='''<g id="highlandRelief" class="lbl-z1" fill="none" stroke-linecap="round" pointer-events="none">
  <!-- Центральное нагорье Ханаана: несколько несимметричных контуров вместо условной оси. -->
  <path d="M625,681 C617,709 621,734 612,760 C603,785 614,810 604,837 C597,862 588,891 576,920"
    stroke="rgba(139,125,90,.10)" stroke-width="22"/>
  <path d="M625,681 C617,709 621,734 612,760 C603,785 614,810 604,837 C597,862 588,891 576,920"
    stroke="#8b7d5a" stroke-width="1.2" opacity=".56"/>
  <path d="M616,687 C610,714 613,738 604,763 C598,786 606,809 596,835 C590,858 581,885 570,910"
    stroke="#a18f65" stroke-width=".68" opacity=".38"/>
  <path d="M634,688 C628,715 632,739 622,767 C615,791 624,817 614,846 C607,871 599,898 590,926"
    stroke="#6f644b" stroke-width=".68" opacity=".4"/>
  <path d="M628,700 C624,724 626,746 618,771 C612,794 619,816 611,839"
    stroke="#b19d73" stroke-width=".42" opacity=".32"/>

  <!-- Заиорданское плато: Галаад и Моав, разорванные долинами. -->
  <path d="M703,646 C710,682 707,720 714,756 C718,781 710,807 714,834 C717,874 721,918 735,968"
    stroke="rgba(122,108,76,.085)" stroke-width="18"/>
  <path d="M703,646 C710,682 707,720 714,756 C718,781 710,807 714,834 C717,874 721,918 735,968"
    stroke="#776b50" stroke-width="1" opacity=".43"/>
  <path d="M694,653 C701,687 697,724 704,759 C708,784 700,810 704,838 C707,878 711,918 723,958"
    stroke="#9a875f" stroke-width=".58" opacity=".3"/>
  <path d="M713,651 C719,687 717,722 724,758 C728,784 722,809 726,835 C730,874 734,912 744,948"
    stroke="#665c46" stroke-width=".5" opacity=".28"/>

  <!-- Синайские массивы: длинные дуги, а не эмблема одиночной горы. -->
  <path d="M463,1048 C500,1017 543,1004 584,1019 C629,1035 666,1076 704,1144"
    stroke="rgba(143,105,61,.09)" stroke-width="27"/>
  <path d="M463,1048 C500,1017 543,1004 584,1019 C629,1035 666,1076 704,1144"
    stroke="#8c6d49" stroke-width="1.05" opacity=".44"/>
  <path d="M480,1057 C516,1030 550,1022 584,1034 C620,1047 653,1082 688,1135"
    stroke="#a17b4e" stroke-width=".62" opacity=".34"/>
  <path d="M498,1064 C528,1044 555,1038 581,1048 C611,1059 639,1088 671,1129"
    stroke="#b1895b" stroke-width=".4" opacity=".25"/>
</g>
<!-- Оронт'''
if 'несколько несимметричных контуров вместо условной оси' not in v:
    match=re.search(r'<g id="highlandRelief" class="lbl-z1".*?</g>\n<!-- Оронт',v,re.S)
    if not match: raise SystemExit('MISSING highlandRelief')
    v=v[:match.start()]+new_relief+v[match.end():]
svgf.write_text(v,'utf-8')
ET.parse(svgf)

# ── Evidence: recompute source statistics and record route visual mass ──
h=harness.read_text('utf-8')
source_block=r'''
const SOURCE_ROUTE_PATH=path.resolve('karty/avraam/route.json');
const SOURCE_ROUTE=JSON.parse(fs.readFileSync(SOURCE_ROUTE_PATH,'utf8'));
function sourceDataAudit(route){
  const places=Array.isArray(route.places)?route.places:[],stages=Array.isArray(route.stages)?route.stages:[],stories=Array.isArray(route.stories)?route.stories:[],ctx=Array.isArray(route.ctx)?route.ctx:[];
  const routePlaces=places.filter(place=>Number.isInteger(place.stage));
  const contextPlaces=places.filter(place=>!Number.isInteger(place.stage));
  const photos=routePlaces.reduce((sum,place)=>sum+(Array.isArray(place.photos)?place.photos.length:0),0);
  const scientificVariants=Object.values(route.scientific_variants||{}).reduce((sum,value)=>sum+(Array.isArray(value)?value.length:0),0);
  const stats=route.meta?.stats||{},failures=[];
  const expect=(label,actual,expected)=>{if(actual!==expected)failures.push(`${label}: ${actual} != ${expected}`)};
  expect('stats.places',stats.places,places.length);
  expect('stats.route_places',stats.route_places,routePlaces.length);
  expect('stats.context_places',stats.context_places,contextPlaces.length);
  expect('stats.stages',stats.stages,stages.length);
  expect('stats.stories',stats.stories,stories.length);
  expect('stats.ctx_points',stats.ctx_points,ctx.length);
  expect('stats.photos',stats.photos,photos);
  expect('stats.verified_waypoints',stats.verified_waypoints,(route.verified_waypoints||[]).length);
  expect('stats.scientific_variants',stats.scientific_variants,scientificVariants);
  expect('places_index length',(route.places_index||[]).length,routePlaces.length);
  const ids=places.map(place=>place.id),idSet=new Set(ids);
  if(idSet.size!==ids.length)failures.push(`duplicate place ids: ${ids.length-idSet.size}`);
  routePlaces.forEach(place=>{if(place.stage<0||place.stage>=stages.length)failures.push(`invalid stage ${place.id}: ${place.stage}`)});
  stories.forEach(story=>{
    (story.places||[]).forEach(id=>{if(!idSet.has(id))failures.push(`story ${story.id} missing place: ${id}`)});
    (story.stages||[]).forEach(stage=>{if(!Number.isInteger(stage)||stage<0||stage>=stages.length)failures.push(`story ${story.id} invalid stage: ${stage}`)});
  });
  return{counts:{places:places.length,routePlaces:routePlaces.length,contextPlaces:contextPlaces.length,stages:stages.length,stories:stories.length,ctx:ctx.length,photos,verifiedWaypoints:(route.verified_waypoints||[]).length,scientificVariants},failures};
}
const SOURCE_DATA_AUDIT=sourceDataAudit(SOURCE_ROUTE);
function routeVisualMass(geometry){
  const boxes=(geometry.routes||[]).map(route=>route.screenBox).filter(Boolean);
  if(!boxes.length)return null;
  const left=Math.min(...boxes.map(box=>box.left)),top=Math.min(...boxes.map(box=>box.top)),right=Math.max(...boxes.map(box=>box.right)),bottom=Math.max(...boxes.map(box=>box.bottom));
  const width=Math.max(0,right-left),height=Math.max(0,bottom-top),vw=geometry.viewport.width,vh=geometry.viewport.height;
  return{left,top,right,bottom,width,height,widthRatio:width/vw,heightRatio:height/vh,centerXRatio:(left+right)/(2*vw),centerYRatio:(top+bottom)/(2*vh)};
}
'''
if 'const SOURCE_DATA_AUDIT=sourceDataAudit(SOURCE_ROUTE);' not in h:
    anchor="const KEY_PLACES = ['ur','harran','shechem','bethel','egypt','hebron','sodom','dan','beersheba','salem'];\n"
    if anchor not in h: raise SystemExit('MISSING KEY_PLACES anchor')
    h=h.replace(anchor,anchor+source_block,1)

old_result="const result={viewport,route:ROUTE_URL,introDismissed:false,overview:null,surfaces:{},stories:[],places:[],tabs:[],keyboard:{},verificationFailures:[],consoleEvents,failedRequests,fatal:null};"
new_result="const result={viewport,route:ROUTE_URL,sourceData:SOURCE_DATA_AUDIT,introDismissed:false,overview:null,surfaces:{},stories:[],places:[],tabs:[],keyboard:{},verificationFailures:[...SOURCE_DATA_AUDIT.failures.map(failure=>`source data: ${failure}`)],consoleEvents,failedRequests,fatal:null};"
if new_result not in h:
    if old_result not in h: raise SystemExit('MISSING result object')
    h=h.replace(old_result,new_result,1)

old_story="""        const geometry=await collectGeometry(page,`${viewport.id}:story:${story.id}`);
        result.stories.push({...story,...selection,file,geometry});
"""
new_story="""        const geometry=await collectGeometry(page,`${viewport.id}:story:${story.id}`);
        const visualMass=routeVisualMass(geometry);
        result.stories.push({...story,...selection,file,geometry,visualMass});
"""
if new_story not in h:
    if old_story not in h: raise SystemExit('MISSING story geometry block')
    h=h.replace(old_story,new_story,1)
harness.write_text(h,'utf-8')

print('PASS6 APPLIED')
