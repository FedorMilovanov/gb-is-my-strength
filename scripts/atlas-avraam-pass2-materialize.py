from pathlib import Path
import re

root=Path('.')
engine=root/'karty/_engine/map-engine.js'
base=root/'karty/avraam/base.svg'
harness=root/'scripts/avraam-reference-baseline.mjs'
s=engine.read_text('utf-8')
if 'Premium light cartography' in s and 'scrollReachable' in harness.read_text('utf-8'):
    print('PASS51 ALREADY MATERIALIZED')
    raise SystemExit(0)

def rep(text,old,new,label,count=1):
    n=text.count(old)
    if n<count:
        raise SystemExit(f'MISSING {label}: {n}')
    return text.replace(old,new,count)

# Light mode is a separate cartographic palette, not a washed-out global filter.
s=rep(s,
"light:Object.freeze({id:'light',bg:'#eee4d1',panelBg:'rgba(250,246,236,.97)',text:'#332b20',muted:'#6c6255',accent:'#986a16',controlBg:'rgba(250,246,236,.88)',border:'rgba(72,55,31,.22)',labelBg:'rgba(250,246,236,.9)',labelText:'#332b20',baseFill:'#d7c7a8',baseOpacity:'0.58',svgFilter:'sepia(.16) saturate(.72) brightness(1.28) contrast(.84)'})",
"light:Object.freeze({id:'light',bg:'#ded2b8',panelBg:'rgba(248,243,231,.97)',text:'#30291f',muted:'#675e52',accent:'#8b5e14',controlBg:'rgba(248,243,231,.92)',border:'rgba(74,57,35,.24)',labelBg:'rgba(249,245,234,.94)',labelText:'#30291f',baseFill:'#d2c3a6',baseOpacity:'0.34',svgFilter:'none'})",
'light palette')
light_css='''
/* Premium light cartography: authored colors per layer, never one global wash. */
.me-map[data-map-theme="light"] .me-canvas svg{filter:none}
.me-map[data-map-theme="light"] #me-base-geo{opacity:1}
.me-map[data-map-theme="light"] #terrain>rect:first-child{fill:#d8c9aa!important}
.me-map[data-map-theme="light"] #terrain>rect:nth-child(2){fill:#b7a47c!important;opacity:.16!important;filter:none!important}
.me-map[data-map-theme="light"] #terrain .water-body{fill:#9db9b8!important;stroke:#68898d!important;stroke-opacity:.72!important}
.me-map[data-map-theme="light"] #terrain .water-pattern{fill:#6f939a!important;opacity:.12!important}
.me-map[data-map-theme="light"] #terrain path[stroke="#2d4a66"],.me-map[data-map-theme="light"] #terrain path[stroke="#4a80a8"]{stroke:#5f8790!important}
.me-map[data-map-theme="light"] #terrain .sea-label{fill:#416772!important;opacity:.58}
.me-map[data-map-theme="light"] #terrain .region-label{fill:#665a43!important;opacity:.58}
.me-map[data-map-theme="light"] #terrain #tradeRoutes{opacity:.34}
.me-map[data-map-theme="light"] #me-paths .me-route-main{filter:brightness(.68) saturate(1.28)}
.me-map[data-map-theme="light"] #me-paths .me-route-underlay{mix-blend-mode:multiply;opacity:.09}
.me-map[data-map-theme="light"] .me-place-label{fill:var(--me-label-text,#30291f)!important}
.me-map[data-map-theme="light"] .me-stage-dot,.me-map[data-map-theme="light"] .me-subtitle{color:#655b4e}
'''
s=rep(s,'/* Media queries */',light_css+'\n/* Media queries */','light cartography css')

# Place text follows the active palette.
s=rep(s,"label.setAttribute('fill',inStory?'#f4eedd':'#555');","label.setAttribute('fill',inStory?'var(--me-label-text,#f4eedd)':'#666');",'palette label text')

# Story rail is an intentional, accessible horizontal scroll region.
s=rep(s,
"const storiesBar=document.createElement('div');storiesBar.className='me-stories';",
"const storiesBar=document.createElement('div');storiesBar.className='me-stories';storiesBar.setAttribute('data-horizontal-scroll','stories');storiesBar.setAttribute('role','tablist');storiesBar.setAttribute('aria-label','Сюжеты карты');",
'story rail semantics')
s=rep(s,
"""        <button class="me-story-chip${s.id===activeStoryId?' me-story-chip--active':''}" data-story="${s.id}">${esc(s.label)}</button>
""",
"""        <button class="me-story-chip${s.id===activeStoryId?' me-story-chip--active':''}" data-story="${s.id}" role="tab" aria-selected="${s.id===activeStoryId?'true':'false'}">${esc(s.label)}</button>
""",'story tab aria')
s=rep(s,
"""      storiesBar.querySelectorAll('.me-story-chip').forEach(chip=>{
        chip.addEventListener('click',()=>setStory(chip.dataset.story||'main'));
      });
""",
"""      storiesBar.querySelectorAll('.me-story-chip').forEach(chip=>{
        chip.addEventListener('click',()=>setStory(chip.dataset.story||'main'));
      });
      requestAnimationFrame(()=>storiesBar.querySelector('.me-story-chip--active')?.scrollIntoView({block:'nearest',inline:'nearest'}));
""",'active story reveal')
engine.write_text(s,'utf-8')

v=base.read_text('utf-8')
# Explicit water hooks let light mode recolor water without touching routes or text.
v=re.sub(r'<(path|ellipse)(?![^>]*class=)([^>]*?)fill="url\(#seaG\)"',r'<\1 class="water-body"\2fill="url(#seaG)"',v)
v=re.sub(r'<path(?![^>]*class=)([^>]*?)fill="url\(#seaPattern\)"',r'<path class="water-pattern"\1fill="url(#seaPattern)"',v)
v=v.replace('<path fill="#10263a" stroke="#2e4d6b"','<path class="water-body" fill="#10263a" stroke="#2e4d6b"')
base.write_text(v,'utf-8')

h=harness.read_text('utf-8')
h=rep(h,
"""    const controls=[...document.querySelectorAll('button,a,[role="button"],[tabindex]:not([tabindex="-1"])')].filter(isVisible).map(el=>({...describe(el),box:rect(el)}));
    const undersizedControls=controls.filter(({box})=>box.width<44||box.height<44);
    const offscreenControls=controls.filter(({box})=>box.left<-1||box.top<-1||box.right>width+1||box.bottom>height+1);
""",
"""    const controls=[...document.querySelectorAll('button,a,[role="button"],[tabindex]:not([tabindex="-1"])')].filter(isVisible).map(el=>{
      const box=rect(el),scroller=el.closest('[data-horizontal-scroll]'),scrollBox=scroller?rect(scroller):null;
      const scrollReachable=Boolean(scroller&&scroller.scrollWidth>scroller.clientWidth+1&&scrollBox&&box.bottom>scrollBox.top&&box.top<scrollBox.bottom);
      return{...describe(el),box,scrollReachable};
    });
    const undersizedControls=controls.filter(({box})=>box.width<44||box.height<44);
    const offscreenControls=controls.filter(({box,scrollReachable})=>!scrollReachable&&(box.left<-1||box.top<-1||box.right>width+1||box.bottom>height+1));
""",'scroll aware controls')
h=rep(h,
"counts:{labels:labels.length,markers:markers.length,controls:controls.length,routes:routes.length,offscreenLabels:offscreenLabels.length,labelOverlaps:labelOverlaps.length,undersizedControls:undersizedControls.length,offscreenControls:offscreenControls.length},",
"counts:{labels:labels.length,markers:markers.length,controls:controls.length,routes:routes.length,offscreenLabels:offscreenLabels.length,labelOverlaps:labelOverlaps.length,undersizedControls:undersizedControls.length,offscreenControls:offscreenControls.length,scrollReachableControls:controls.filter(control=>control.scrollReachable).length},",
'scroll count')
h=rep(h,
"""  return{active,before,after:await svg.getAttribute('viewBox'),panelVisible:Boolean(await page.locator(panelSelector).count())};
""",
"""  const rail=await target.evaluate(el=>{const scroller=el.closest('[data-horizontal-scroll]');if(!scroller)return{present:false,fullyVisible:true};const a=el.getBoundingClientRect(),b=scroller.getBoundingClientRect();return{present:true,fullyVisible:a.left>=b.left-1&&a.right<=b.right+1,scrollLeft:scroller.scrollLeft,scrollWidth:scroller.scrollWidth,clientWidth:scroller.clientWidth}});
  return{active,before,after:await svg.getAttribute('viewBox'),panelVisible:Boolean(await page.locator(panelSelector).count()),rail};
""",'story rail proof')
h=rep(h,
"if(!selection.active||geometry.activeStory!==story.id)result.verificationFailures.push(`story activation failed: ${story.id}; active=${geometry.activeStory}`);",
"if(!selection.active||geometry.activeStory!==story.id)result.verificationFailures.push(`story activation failed: ${story.id}; active=${geometry.activeStory}`);\n        if(selection.rail?.present&&!selection.rail.fullyVisible)result.verificationFailures.push(`active story clipped in rail: ${story.id}`);",
'story rail gate')
h=rep(h,'await themeButton.evaluate(el=>el.click());await page.waitForTimeout(180);','await themeButton.evaluate(el=>el.click());await page.waitForTimeout(1350);','theme settle')
h=rep(h,'await themeButton.evaluate(el=>el.click());await page.waitForTimeout(150);','await themeButton.evaluate(el=>el.click());await page.waitForTimeout(1350);','theme restore settle')
harness.write_text(h,'utf-8')
print('PASS51 APPLIED')
