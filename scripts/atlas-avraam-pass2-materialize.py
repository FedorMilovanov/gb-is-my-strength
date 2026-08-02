from pathlib import Path
import re

root=Path('.')
engine=root/'karty/_engine/map-engine.js'
harness=root/'scripts/avraam-reference-baseline.mjs'
s=engine.read_text('utf-8')

MARKER='Premium cartographic light palette'
MOBILE_MARKER='mobile story strip fits all five controls'

def ensure_regex(text,pattern,replacement,label,flags=0):
    if replacement in text:
        return text
    text,n=re.subn(pattern,replacement,text,count=1,flags=flags)
    if n!=1:
        raise SystemExit(f'MISSING {label}: {n}')
    return text

def ensure_exact(text,old,new,label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'MISSING {label}: 0')
    return text.replace(old,new,1)

# The light theme is an independent cartographic palette, not a global wash.
light_replacement="light:Object.freeze({id:'light',bg:'#e4d8c1',panelBg:'rgba(250,246,236,.98)',text:'#2e2418',muted:'#6b5b47',accent:'#8b5a0b',controlBg:'rgba(255,250,239,.94)',border:'rgba(72,51,27,.25)',labelBg:'rgba(255,249,235,.92)',labelText:'#2d2317',baseFill:'#d7c5a4',baseOpacity:'0.22',svgFilter:'none'})"
s=ensure_regex(
    s,
    r"light:Object\.freeze\(\{id:'light'.*?\}\)",
    light_replacement,
    'light palette object',
)

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
if MARKER not in s:
    anchor='/* Semantic zoom: the authored base already marks regional/detail objects with'
    if anchor not in s:
        raise SystemExit('MISSING semantic zoom anchor')
    s=s.replace(anchor,light_css+'\n'+anchor,1)

# Theme changes are quiet; aria/icon state supplies feedback.
theme_target="themeBtn.addEventListener('click',()=>applyMapTheme(activeTheme==='dark'?'light':'dark',true,false));"
if theme_target not in s:
    s,n=re.subn(
        r"themeBtn\.addEventListener\('click',\(\)=>applyMapTheme\(activeTheme==='dark'\?'light':'dark'(?:,[^)]]*)?\)\);",
        theme_target,
        s,
        count=1,
    )
    if n!=1:
        raise SystemExit(f'MISSING theme toggle listener: {n}')

# Place-label geometry follows the active palette.
label_target="label.setAttribute('fill',inStory?'var(--me-label-text,#f4eedd)':'var(--me-muted,#666)');"
if label_target not in s:
    label_patterns=[
        "label.setAttribute('fill',inStory?'var(--me-label-text,#f4eedd)':'#666');",
        "label.setAttribute('fill',inStory?'var(--me-label-text,#f4eedd)':'#555');",
        "label.setAttribute('fill',inStory?'#f4eedd':'#555');",
    ]
    for candidate in label_patterns:
        if candidate in s:
            s=s.replace(candidate,label_target,1)
            break
    else:
        raise SystemExit('MISSING place label fill')

leader_target="leaderLine.setAttribute('stroke','var(--me-label-text,rgba(244,238,221,.38))');"
s=ensure_exact(
    s,
    "leaderLine.setAttribute('stroke','rgba(244,238,221,.38)');",
    leader_target,
    'leader line palette',
)

# mobile story strip fits all five controls inside the viewport; no clipped
# pseudo-carousel button and no wasted 52px offset.
mobile_target="  .me-header>div:first-child{height:44px}\n  .me-stories{position:relative;top:auto;right:auto;max-width:none;display:flex;flex-wrap:nowrap;overflow:hidden;gap:4px;margin-top:8px;padding:0;scrollbar-width:none;overscroll-behavior-x:none;mask-image:none}"
if mobile_target not in s:
    s,n=re.subn(
        r"  \.me-stories\{position:relative;top:auto;right:auto;max-width:none;display:flex;flex-wrap:nowrap;overflow-x:auto;gap:6px;margin-top:52px;padding:0 18px 6px 0;scrollbar-width:none;overscroll-behavior-x:contain;mask-image:linear-gradient\(to right,#000 calc\(100% - 28px\),transparent\)\}",
        mobile_target,
        s,
        count=1,
    )
    if n!=1:
        raise SystemExit(f'MISSING mobile story strip: {n}')

chip_target="  .me-story-chip{flex:1 1 0;min-width:0;padding:8px 4px;font-size:9px;letter-spacing:-.015em}"
if chip_target not in s:
    s,n=re.subn(r"  \.me-story-chip\{flex:0 0 auto\}",chip_target,s,count=1)
    if n!=1:
        raise SystemExit(f'MISSING mobile story chip: {n}')

# Durable source marker for reviewers and idempotence.
if MOBILE_MARKER not in s:
    s=s.replace('/* mobile story strip fits all five controls inside the viewport; no clipped',
                '/* mobile story strip fits all five controls inside the viewport; no clipped',1)

engine.write_text(s,'utf-8')

# Surface evidence must prove the theme state, not only clickability.
h=harness.read_text('utf-8')
theme_gate="result.surfaces.themeAlternative.theme=await page.locator('.me-map').first().getAttribute('data-map-theme');"
if theme_gate not in h:
    old="""      result.surfaces.themeAlternative=await collectGeometry(page,`${viewport.id}:theme-alt`);
      if(result.surfaces.themeAlternative.counts.offscreenControls>0)result.verificationFailures.push(`theme-alt offscreen controls: ${result.surfaces.themeAlternative.counts.offscreenControls}`);
"""
    new="""      result.surfaces.themeAlternative=await collectGeometry(page,`${viewport.id}:theme-alt`);
      result.surfaces.themeAlternative.theme=await page.locator('.me-map').first().getAttribute('data-map-theme');
      if(result.surfaces.themeAlternative.theme!=='light')result.verificationFailures.push(`theme toggle did not reach light palette: ${result.surfaces.themeAlternative.theme}`);
      if(result.surfaces.themeAlternative.counts.offscreenControls>0)result.verificationFailures.push(`theme-alt offscreen controls: ${result.surfaces.themeAlternative.counts.offscreenControls}`);
"""
    if old not in h:
        raise SystemExit('MISSING theme state gate anchor')
    h=h.replace(old,new,1)
harness.write_text(h,'utf-8')

print('PASS51 APPLIED')
