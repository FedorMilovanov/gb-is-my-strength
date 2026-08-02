from pathlib import Path
import json
import re
import xml.etree.ElementTree as ET

root=Path('.')
engine=root/'karty/_engine/map-engine.js'
routef=root/'karty/avraam/route.json'
svgf=root/'karty/avraam/base.svg'
harness=root/'scripts/avraam-reference-baseline.mjs'
s=engine.read_text('utf-8')
if 'selectedStoryRoute' in s and 'highlandRelief' in svgf.read_text('utf-8'):
    print('PASS4 ALREADY MATERIALIZED')
    raise SystemExit(0)

def rep(text,old,new,label,count=1):
    n=text.count(old)
    if n<count:
        raise SystemExit(f'MISSING {label}: {n}')
    return text.replace(old,new,count)

# A selected narrative must reveal its own route even when that optional layer
# is disabled in the ordinary all-map overview.
s=rep(s,
"""        const hidden=restrictive.some(id=>layerState.get(id)===false)||(alternatives.length>0&&!alternatives.some(id=>layerState.get(id)!==false));
        el.setAttribute('data-me-layer-hidden',hidden?'1':'0');
""",
"""        const selectedStoryRoute=activeStoryId!=='main'&&el.getAttribute('data-story-active')==='1'&&el.matches('.me-route-main,.me-route-underlay,[data-route-segment]');
        const hidden=!selectedStoryRoute&&(restrictive.some(id=>layerState.get(id)===false)||(alternatives.length>0&&!alternatives.some(id=>layerState.get(id)!==false)));
        el.setAttribute('data-me-layer-hidden',hidden?'1':'0');
""",'story route layer override')
engine.write_text(s,'utf-8')

r=json.loads(routef.read_text('utf-8'))
# Story entry points use a calm regional scale. Detail labels appear only after
# an intentional user zoom rather than flooding every story transition.
views={
    'main':[1000,620,1950],
    'lekh-lekha':[900,500,1480],
    'lot':[648,838,720],
    'war':[678,692,760],
    'akeda':[600,850,700],
}
for story in r.get('stories',[]):
    if story.get('id') in views:
        story['viewport']=views[story['id']]
r.setdefault('meta',{})['mobile_story_viewports']={
    'main':[650,710,640],
    'lekh-lekha':[900,520,700],
    'lot':[648,838,420],
    'war':[678,692,460],
    'akeda':[600,850,420],
}
routef.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n','utf-8')

# Replace icon-like alpine triangles with coherent schematic relief.
v=svgf.read_text('utf-8')
v=v.replace('baseFrequency=".4 .35" numOctaves="4" seed="12"','baseFrequency=".018 .012" numOctaves="3" seed="12"')
v=v.replace('0 0 0 .08 0" result="tinted"','0 0 0 .13 0" result="tinted"')
v=v.replace('fill="url(#richLandG)" opacity=".48" filter="url(#terrainTex)"','fill="url(#richLandG)" opacity=".3" filter="url(#terrainTex)"')
mountains=re.search(r'  <g id="mountains" opacity="\.55">.*?\n  </g>\n\n</g>',v,re.S)
if not mountains:
    raise SystemExit('mountains group not found')
new_mountains='''  <g id="mountains" opacity=".72" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <!-- Гевал и Геризим: парные контурные хребты, без фантазийных снежных пиктограмм. -->
    <g class="lbl-z1" data-relief="ebal-gerizim">
      <path d="M607,734 C613,725 617,711 628,700 C639,710 644,724 649,734 Z"
        fill="rgba(145,126,87,.10)" stroke="#9b8d6a" stroke-width="1.15"/>
      <path d="M614,730 C620,720 622,711 628,706 C634,712 638,722 642,730"
        stroke="#b19e72" stroke-width=".7" opacity=".72"/>
      <path d="M619,726 C623,719 625,714 628,711 C632,716 635,721 638,726"
        stroke="#c0ab7a" stroke-width=".45" opacity=".52"/>
      <text x="628" y="697" font-size="5" fill="#b9a578" text-anchor="middle" letter-spacing=".12em">ГЕВАЛ</text>
      <text x="628" y="692" font-size="3.7" fill="#cdbd95" text-anchor="middle" opacity=".65">עֵיבָל · 940 м</text>

      <path d="M607,774 C613,765 617,751 628,741 C639,751 644,764 649,774 Z"
        fill="rgba(145,126,87,.09)" stroke="#9b8d6a" stroke-width="1.1"/>
      <path d="M614,770 C620,760 622,752 628,747 C634,753 638,762 642,770"
        stroke="#b19e72" stroke-width=".68" opacity=".7"/>
      <path d="M619,766 C623,759 625,755 628,752 C632,757 635,761 638,766"
        stroke="#c0ab7a" stroke-width=".42" opacity=".5"/>
      <text x="628" y="781" font-size="5" fill="#b9a578" text-anchor="middle" letter-spacing=".1em">ГЕРИЗИМ</text>
      <text x="628" y="786" font-size="3.7" fill="#cdbd95" text-anchor="middle" opacity=".65">גְּרִזִּים · 881 м</text>
    </g>
  </g>

</g>'''
v=v[:mountains.start()]+new_mountains+v[mountains.end():]
relief_block=re.search(r'<!-- ============ ДОПОЛНИТЕЛЬНЫЙ РЕЛЬЕФ ============ -->.*?</g>\n<!-- Оронт',v,re.S)
if not relief_block:
    raise SystemExit('additional relief block not found')
new_relief='''<!-- ============ ДОПОЛНИТЕЛЬНЫЙ РЕЛЬЕФ ============ -->
<!-- Непрерывные хребты: схематическая гипсометрия, не точные изолинии. -->
<g id="highlandRelief" class="lbl-z1" fill="none" stroke-linecap="round" pointer-events="none">
  <!-- Центральное нагорье Ханаана: Самария → Иудея → Негев. -->
  <path d="M625,686 C617,726 615,770 612,812 C608,848 600,884 586,918"
    stroke="rgba(139,125,90,.11)" stroke-width="24"/>
  <path d="M625,686 C617,726 615,770 612,812 C608,848 600,884 586,918"
    stroke="#8b7d5a" stroke-width="1.25" opacity=".58"/>
  <path d="M617,690 C610,732 607,774 604,814 C601,850 593,882 580,912"
    stroke="#a18f65" stroke-width=".72" opacity=".38"/>
  <path d="M634,690 C627,731 625,773 621,814 C618,849 610,886 594,922"
    stroke="#6f644b" stroke-width=".72" opacity=".42"/>

  <!-- Заиорданское плато: Галаад и Моав. -->
  <path d="M704,646 C712,704 715,763 713,824 C712,874 718,923 732,972"
    stroke="rgba(122,108,76,.09)" stroke-width="20"/>
  <path d="M704,646 C712,704 715,763 713,824 C712,874 718,923 732,972"
    stroke="#776b50" stroke-width="1.05" opacity=".44"/>
  <path d="M694,652 C702,710 704,770 703,828 C702,878 708,925 719,965"
    stroke="#9a875f" stroke-width=".6" opacity=".3"/>

  <!-- Синайские массивы: мягкие слои без одиночной эмблемы-горы. -->
  <path d="M470,1040 C510,1010 557,1008 603,1030 C646,1052 680,1092 704,1142"
    stroke="rgba(143,105,61,.10)" stroke-width="30"/>
  <path d="M470,1040 C510,1010 557,1008 603,1030 C646,1052 680,1092 704,1142"
    stroke="#8c6d49" stroke-width="1.1" opacity=".45"/>
  <path d="M488,1052 C527,1028 563,1027 600,1046 C636,1064 664,1098 686,1134"
    stroke="#a17b4e" stroke-width=".65" opacity=".34"/>
</g>
<!-- Оронт'''
v=v[:relief_block.start()]+new_relief+v[relief_block.end():]
sinai=re.search(r'<g id="sinaiPeak" class="lbl-z1" transform="translate\(588,1120\)" opacity="\.5">.*?</g>',v,re.S)
if not sinai:
    raise SystemExit('sinaiPeak not found')
new_sinai='''<g id="sinaiPeak" class="lbl-z1" transform="translate(588,1120)" opacity=".66" fill="none" stroke-linecap="round">
  <path d="M-24,15 C-16,4 -11,-8 0,-21 C11,-8 16,4 24,15" stroke="#9c7840" stroke-width="1.15"/>
  <path d="M-16,13 C-10,4 -6,-4 0,-12 C7,-4 11,5 16,13" stroke="#bc9460" stroke-width=".65" opacity=".65"/>
  <path d="M-8,10 C-4,4 -2,0 0,-4 C3,1 5,5 8,10" stroke="#d0aa73" stroke-width=".4" opacity=".5"/>
  <text x="0" y="26" text-anchor="middle" font-size="4.8" fill="#aa824d" letter-spacing=".14em">СИНАЙ</text>
  <text x="0" y="32" font-size="3.5" fill="#9a7648" text-anchor="middle" opacity=".72">הַר סִינַי · традиционный массив</text>
</g>'''
v=v[:sinai.start()]+new_sinai+v[sinai.end():]
svgf.write_text(v,'utf-8')
ET.parse(svgf)

# Strengthen the evidence harness: only viewport-intersecting text participates
# in clipping/collision checks, and every selected story must expose a route.
h=harness.read_text('utf-8')
h=rep(h,
"""    const labels=[...document.querySelectorAll('svg text')].filter(isVisible).map((el,index)=>({index,...describe(el),box:rect(el)}));
    const offscreenLabels=labels.filter(({box})=>box.left<-1||box.top<-1||box.right>width+1||box.bottom>height+1);
""",
"""    const allLabels=[...document.querySelectorAll('svg text')].filter(isVisible).map((el,index)=>({index,...describe(el),box:rect(el)}));
    const labels=allLabels.filter(({box})=>box.right>0&&box.bottom>0&&box.left<width&&box.top<height);
    const offscreenLabels=labels.filter(({box})=>box.left<-1||box.top<-1||box.right>width+1||box.bottom>height+1);
""",'viewport label filtering')
h=rep(h,
"""        if(!selection.active||geometry.activeStory!==story.id)result.verificationFailures.push(`story activation failed: ${story.id}; active=${geometry.activeStory}`);
""",
"""        if(!selection.active||geometry.activeStory!==story.id)result.verificationFailures.push(`story activation failed: ${story.id}; active=${geometry.activeStory}`);
        if(story.id!=='main'&&geometry.counts.routes===0)result.verificationFailures.push(`story route missing: ${story.id}`);
        const overlapLimit=viewport.width<=560?4:6;
        const clippedLimit=viewport.width<=560?4:6;
        if(geometry.counts.labelOverlaps>overlapLimit)result.verificationFailures.push(`story label overlaps ${story.id}: ${geometry.counts.labelOverlaps}>${overlapLimit}`);
        if(geometry.counts.offscreenLabels>clippedLimit)result.verificationFailures.push(`story clipped labels ${story.id}: ${geometry.counts.offscreenLabels}>${clippedLimit}`);
""",'story geometry gates')
harness.write_text(h,'utf-8')
print('PASS4 APPLIED')
