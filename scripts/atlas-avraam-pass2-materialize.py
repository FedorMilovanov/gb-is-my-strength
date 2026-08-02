from pathlib import Path
import re

root=Path('.')
engine=root/'karty/_engine/map-engine.js'
harness=root/'scripts/avraam-reference-baseline.mjs'
s=engine.read_text('utf-8')
if 'Premium cartographic light palette' in s and 'mobile story strip fits' in s:
    print('PASS51 ALREADY MATERIALIZED')
    raise SystemExit(0)

def rep(text,old,new,label,count=1):
    n=text.count(old)
    if n<count:
        raise SystemExit(f'MISSING {label}: {n}')
    return text.replace(old,new,count)

# The light theme is a real cartographic palette, not a global sepia wash.
light_pattern=r"light:Object\.freeze\(\{id:'light'.*?\}\)"
light_replacement="light:Object.freeze({id:'light',bg:'#e4d8c1',panelBg:'rgba(250,246,236,.98)',text:'#2e2418',muted:'#6b5b47',accent:'#8b5a0b',controlBg:'rgba(255,250,239,.94)',border:'rgba(72,51,27,.25)',labelBg:'rgba(255,249,235,.92)',labelText:'#2d2317',baseFill:'#d7c5a4',baseOpacity:'0.22',svgFilter:'none'})"
s,n=re.subn(light_pattern,light_replacement,s,count=1)
if n!=1:
    raise SystemExit(f'MISSING light palette object: {n}')

light_css='''
/* Premium cartographic light palette: independent land, water, labels and chrome. */
.me-map[data-map-theme="light"] .me-canvas svg{filter:none}
.me-map[data-map-theme="light"] #me-base-geo [fill="url(#landG)"]{fill:#d7c29d!important}
.me-map[data-map-theme="light"] #me-base-geo [fill="url(#richLandG)"]{fill:#bca57d!important;opacity:.16!important;filter:none!important}
.me-map[data-map-theme="light"] #me-base-geo [fill="url(#seaG)"]{fill:#86a6b6!important;stroke:#5f8092!important;stroke-opacity:.65!important}
.me-map[data-map-theme="light"] #me-base-geo .region-label{fill:#5b4933!important;opacity:.68}
.me-map[data-map-theme="light"] #me-base-geo .sea-label{fill:#315c70!important;opacity:.76}
.me-map[data-map-theme="light"] #me-base-geo .region-he{fill:#715d43!important;opacity:.62}
.me-map[data-map-theme="light"] .me-route-main{filter:drop-shadow(0 1px .8px rgba(255,255,255,.92))}
.me-map[data-map-theme="light"] .me-route-underlay{mix-blend-mode:multiply}
.me-map[data-map-theme="light"] .me-story-chip--active{background:#ead8ad;border-color:#a77a25;color:#684300}
.me-map[data-map-theme="light"] .me-zoom{background:transparent!important;border-color:transparent!important;color:inherit}
.me-map[data-map-theme="light"] .me-zoom-btn{background:rgba(255,250,239,.94);border-color:rgba(72,51,27,.25);color:#5e5140}
.me-map[data-map-theme="light"] .me-zoom-btn:hover{background:#fff8e9;color:#7a4d05;border-color:#a77a25}
.me-map[data-map-theme="light"] .me-scale{color:#655846}
'''
s=rep(s,'/* Semantic zoom: the authored base already marks regional/detail objects with',light_css+'\n/* Semantic zoom: the authored base already marks regional/detail objects with','light cartographic css')

# Stable screenshot and quieter UX: the icon/aria state is enough feedback.
s=rep(s,
"themeBtn.addEventListener('click',()=>applyMapTheme(activeTheme==='dark'?'light':'dark'));",
"themeBtn.addEventListener('click',()=>applyMapTheme(activeTheme==='dark'?'light':'dark',true,false));",
'theme toggle quiet')

# SVG place labels must follow the palette instead of staying cream on cream.
s=rep(s,
"label.setAttribute('fill',inStory?'#f4eedd':'#555');",
"label.setAttribute('fill',inStory?'var(--me-label-text,#f4eedd)':'var(--me-muted,#555)');",
'label text palette')
s=rep(s,
"leaderLine.setAttribute('stroke','rgba(244,238,221,.38)');",
"leaderLine.setAttribute('stroke','var(--me-label-text,rgba(244,238,221,.38))');",
'leader line palette')

# mobile story strip fits all five controls inside the viewport; no clipped
# pseudo-carousel button and no wasted 52px second offset.
s=rep(s,
"  .me-stories{position:relative;top:auto;right:auto;max-width:none;display:flex;flex-wrap:nowrap;overflow-x:auto;gap:6px;margin-top:52px;padding:0 18px 6px 0;scrollbar-width:none;overscroll-behavior-x:contain;mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent)}",
"  .me-header>div:first-child{height:44px}\n  .me-stories{position:relative;top:auto;right:auto;max-width:none;display:flex;flex-wrap:nowrap;overflow:hidden;gap:4px;margin-top:8px;padding:0;scrollbar-width:none;overscroll-behavior-x:none;mask-image:none}",
'mobile story strip')
s=rep(s,
"  .me-story-chip{flex:0 0 auto}",
"  .me-story-chip{flex:1 1 0;min-width:0;padding:8px 4px;font-size:9px;letter-spacing:-.015em}",
'mobile story chip fit')
engine.write_text(s,'utf-8')

# The surface evidence must assert the active theme rather than only geometry.
h=harness.read_text('utf-8')
h=rep(h,
"""      result.surfaces.themeAlternative=await collectGeometry(page,`${viewport.id}:theme-alt`);
      if(result.surfaces.themeAlternative.counts.offscreenControls>0)result.verificationFailures.push(`theme-alt offscreen controls: ${result.surfaces.themeAlternative.counts.offscreenControls}`);
""",
"""      result.surfaces.themeAlternative=await collectGeometry(page,`${viewport.id}:theme-alt`);
      result.surfaces.themeAlternative.theme=await page.locator('.me-map').first().getAttribute('data-map-theme');
      if(result.surfaces.themeAlternative.theme!=='light')result.verificationFailures.push(`theme toggle did not reach light palette: ${result.surfaces.themeAlternative.theme}`);
      if(result.surfaces.themeAlternative.counts.offscreenControls>0)result.verificationFailures.push(`theme-alt offscreen controls: ${result.surfaces.themeAlternative.counts.offscreenControls}`);
""",
'theme state gate')
harness.write_text(h,'utf-8')
print('PASS51 APPLIED')
