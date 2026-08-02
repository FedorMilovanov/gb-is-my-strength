from pathlib import Path
import json, re
root=Path('.')
engine=root/'karty/_engine/map-engine.js'
routef=root/'karty/avraam/route.json'
svgf=root/'karty/avraam/base.svg'
s=engine.read_text('utf-8')
if 'overview_min_units_per_pixel' in s:
    print('PASS3 ALREADY MATERIALIZED')
    raise SystemExit(0)

def rep(old,new,label,count=1):
 global s
 n=s.count(old)
 if n<count: raise SystemExit(f'MISSING {label}: {n}')
 s=s.replace(old,new,count)

# Semantic zoom follows rendered density, not raw map width. This keeps portrait overview quiet.
old="""    function semanticZoomBucket(width=view.w){
      if(width >= semanticOverviewMinW) return 'overview';
      if(width > semanticDetailMaxW) return 'region';
      return 'detail';
    }
"""
new="""    function semanticZoomBucket(width=view.w){
      const renderedWidth=(canvas.isConnected?canvas:container).getBoundingClientRect().width;
      if(renderedWidth>1){
        const unitsPerPixel=width/renderedWidth;
        const overviewMinDensity=Number(semanticZoomConfig.overview_min_units_per_pixel ?? semanticZoomConfig.overviewMinUnitsPerPixel) || 1.25;
        const detailMaxDensity=Number(semanticZoomConfig.detail_max_units_per_pixel ?? semanticZoomConfig.detailMaxUnitsPerPixel) || 0.72;
        if(unitsPerPixel>=overviewMinDensity)return 'overview';
        if(unitsPerPixel>detailMaxDensity)return 'region';
        return 'detail';
      }
      if(width >= semanticOverviewMinW) return 'overview';
      if(width > semanticDetailMaxW) return 'region';
      return 'detail';
    }
"""
rep(old,new,'semantic density')

# Screen-space anchoring must happen after marker groups exist.
rep("""      renderSignatureOverlay();
      renderStoryFocus();
      applyViewBox();

      // Overview labels""",
"""      renderSignatureOverlay();
      renderStoryFocus();

      // Overview labels""",'remove early viewbox')
rep("""      applyLayerVisibility();
    }



    // ── Panel rendering ──""",
"""      applyLayerVisibility();
      applyViewBox();
    }



    // ── Panel rendering ──""",'late viewbox')

# Remove duplicate stage numerals from the canvas; the story rail carries navigation.
rep(".me-route-label{font-size:7px;letter-spacing:.12em;fill:rgba(232,200,121,.62);stroke:#070a10;stroke-width:2;paint-order:stroke;pointer-events:none;text-transform:uppercase}.me-map svg:not([data-zoom-bucket=\"overview\"]) .me-route-label{display:none}",
".me-route-label{display:none}", 'hide route numerals')

# Premium cartographic hierarchy: base is readable, overview words do not intrude into details.
insert='''\n.me-map #me-base-geo{opacity:.74;transition:opacity .35s ease}\n.me-map[data-map-theme="light"] #me-base-geo{opacity:.86}\n.me-map svg:not([data-zoom-bucket="overview"]) #me-base-geo .lbl-overview{display:none}\n'''
rep(".me-map svg[data-zoom-bucket=\"overview\"] #me-base-geo .lbl-z1,", insert+"\n.me-map svg[data-zoom-bucket=\"overview\"] #me-base-geo .lbl-z1,",'base hierarchy css')

# Softer label plates, respecting active palette.
rep("labelBg.setAttribute('fill','rgba(7,10,16,.75)');", "labelBg.setAttribute('fill','var(--me-label-bg,rgba(7,10,16,.68))');", 'label fill')
rep("labelBg.setAttribute('stroke','rgba(255,255,255,.06)');", "labelBg.setAttribute('stroke','var(--me-border,rgba(255,255,255,.08))');", 'label stroke')
rep("labelBg.setAttribute('opacity',inStory?'0.85':'0');", "labelBg.setAttribute('opacity',inStory?'0.68':'0');", 'label opacity')

rep("const stageIds=story?.stage_ids||Array.from({length:(route.stages||[]).length},(_,i)=>i);",
    "const stageIds=story?.stages||story?.stage_ids||Array.from({length:(route.stages||[]).length},(_,i)=>i);", 'tour story stages')

engine.write_text(s,'utf-8')

r=json.loads(routef.read_text('utf-8'))
# Explicit semantic ownership of route stages per story.
stage_ids={
 'main':[],
 'lekh-lekha':[0,1],
 'lot':[3,5],
 'war':[4],
 'akeda':[7],
}
viewports={
 'main':[1000,620,1950],
 'lekh-lekha':[900,500,1480],
 'lot':[648,838,420],
 'war':[678,692,520],
 'akeda':[580,868,430],
}
for story in r.get('stories',[]):
 sid=story.get('id')
 if sid in stage_ids: story.pop('stageIds',None); story['stages']=stage_ids[sid]
 if sid in viewports: story['viewport']=viewports[sid]
r.setdefault('meta',{})['mobile_story_viewports']={
 'main':[650,710,640],
 'lekh-lekha':[900,520,700],
 'lot':[648,838,250],
 'war':[678,692,300],
 'akeda':[580,868,260],
}
# The victory route returns to Salem/Moriah, not back to Hebron.
stage4=r['stages'][4]
if len(stage4.get('paths',[]))>1:
 stage4['paths'][1]['d']='M752,556 C710,650 652,748 623,800'
routef.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n','utf-8')

v=svgf.read_text('utf-8')
# Classify large cartographic words as overview-only.
for old,new in [
 ('class="sea-label" x="300" y="555"','class="sea-label lbl-overview" x="300" y="555"'),
 ('class="sea-label" x="1846" y="1014"','class="sea-label lbl-overview" x="1846" y="1014"'),
 ('class="region-label" x="1150" y="395"','class="region-label lbl-overview" x="1150" y="395"'),
 ('class="region-label" x="120" y="1040"','class="region-label lbl-overview" x="120" y="1040"'),
 ('class="region-label" x="520" y="1170"','class="region-label lbl-overview" x="520" y="1170"'),
 ('class="region-label" x="900" y="168"','class="region-label lbl-overview" x="900" y="168"'),
 ('class="region-label" x="1230" y="1030"','class="region-label lbl-overview" x="1230" y="1030"'),
 ('class="region-label" x="938" y="262"','class="region-label lbl-overview" x="938" y="262"'),
 ('class="region-label" x="1075" y="1000"','class="region-label lbl-overview" x="1075" y="1000"'),
]:
 v=v.replace(old,new)
# Canaan remains on overview but no longer dominates the Hebron cluster.
v=v.replace('class="region-label" font-size="13" letter-spacing=".48em"><textPath href="#canaanRidge" startOffset="6%">',
            'class="region-label lbl-overview" font-size="9" letter-spacing=".38em"><textPath href="#canaanRidge" startOffset="18%">')
svgf.write_text(v,'utf-8')
print('PASS3 APPLIED')
