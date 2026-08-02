from pathlib import Path
import re
import xml.etree.ElementTree as ET

root=Path('.')
engine=root/'karty/_engine/map-engine.js'
svgf=root/'karty/avraam/base.svg'
harness=root/'scripts/avraam-reference-baseline.mjs'

# ── Shared engine: story purity + reduced-motion ──
s=engine.read_text('utf-8')

story_attr="g.setAttribute('data-story-active',inStory?'1':'0');"
if story_attr not in s:
    old="""        g.setAttribute('data-place-id', place.id);
        g.setAttribute('data-screen-anchor','place');g.setAttribute('data-map-x',String(place.x));g.setAttribute('data-map-y',String(place.y));
"""
    new="""        g.setAttribute('data-place-id', place.id);
        g.setAttribute('data-story-active',inStory?'1':'0');
        g.setAttribute('data-screen-anchor','place');g.setAttribute('data-map-x',String(place.x));g.setAttribute('data-map-y',String(place.y));
"""
    if old not in s: raise SystemExit('MISSING marker story-attribute anchor')
    s=s.replace(old,new,1)

story_opacity="g.style.opacity=inStory?'1':(activeStoryId==='main'?'.15':'0');"
if story_opacity not in s:
    candidates=[
        "g.style.opacity=inStory?'1':'.15';",
        "g.style.opacity = inStory ? '1' : '.15';",
    ]
    for old in candidates:
        if old in s:
            s=s.replace(old,story_opacity,1)
            break
    else:
        raise SystemExit('MISSING marker story opacity anchor')

motion_marker="svg.setAttribute('data-reduced-motion',reduceMotion?'1':'0');"
if motion_marker not in s:
    old="""          while (geoRoot.firstChild) baseGeoG.appendChild(geoRoot.firstChild);
          svg.insertBefore(baseGeoG, svg.firstChild);
"""
    new="""          while (geoRoot.firstChild) baseGeoG.appendChild(geoRoot.firstChild);
          svg.insertBefore(baseGeoG, svg.firstChild);
          const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
          svg.setAttribute('data-reduced-motion',reduceMotion?'1':'0');
          if(reduceMotion&&typeof svg.pauseAnimations==='function'){
            try{svg.pauseAnimations();svg.setAttribute('data-smil-paused','1')}
            catch{svg.setAttribute('data-smil-paused','0')}
          }
"""
    if old not in s: raise SystemExit('MISSING base SVG reduced-motion anchor')
    s=s.replace(old,new,1)
engine.write_text(s,'utf-8')

# ── SVG: open topographic ridges + static trade-road context ──
v=svgf.read_text('utf-8')
new_ridges='''  <!-- Гевал и Геризим: открытые топографические гряды вокруг долины Сихема. -->
  <g id="shechemRidges" class="lbl-z1" opacity=".7" fill="none" stroke-linecap="round" pointer-events="none">
    <!-- Северная гряда Гевала -->
    <path d="M602,731 C611,724 616,714 625,707 C634,711 642,720 653,729"
      stroke="rgba(145,126,87,.10)" stroke-width="12"/>
    <path d="M602,731 C611,724 616,714 625,707 C634,711 642,720 653,729"
      stroke="#9b8d6a" stroke-width="1.05"/>
    <path d="M608,730 C616,723 620,716 627,712 C635,716 641,722 648,728"
      stroke="#b19e72" stroke-width=".62" opacity=".68"/>
    <path d="M614,728 C620,722 624,718 629,716 C635,720 639,724 643,727"
      stroke="#c0ab7a" stroke-width=".36" opacity=".48"/>
    <text class="lbl-z2" x="626" y="701" font-size="4.8" fill="#b9a578" text-anchor="middle" letter-spacing=".12em">ГЕВАЛ</text>
    <text class="lbl-z2" x="626" y="696" font-size="3.5" fill="#cdbd95" text-anchor="middle" opacity=".62">עֵיבָל · 940 м</text>

    <!-- Южная гряда Геризима -->
    <path d="M603,771 C612,765 617,755 626,748 C635,752 643,761 653,770"
      stroke="rgba(145,126,87,.09)" stroke-width="11"/>
    <path d="M603,771 C612,765 617,755 626,748 C635,752 643,761 653,770"
      stroke="#9b8d6a" stroke-width="1"/>
    <path d="M609,770 C616,763 621,756 628,753 C636,757 641,763 648,769"
      stroke="#b19e72" stroke-width=".6" opacity=".66"/>
    <path d="M615,768 C621,762 625,758 630,757 C636,761 640,765 644,768"
      stroke="#c0ab7a" stroke-width=".34" opacity=".46"/>
    <text class="lbl-z2" x="628" y="778" font-size="4.8" fill="#b9a578" text-anchor="middle" letter-spacing=".1em">ГЕРИЗИМ</text>
    <text class="lbl-z2" x="628" y="783" font-size="3.5" fill="#cdbd95" text-anchor="middle" opacity=".62">גְּרִזִּים · 881 м</text>

    <!-- Долина Сихема между грядами -->
    <path d="M611,739 C620,741 633,741 645,738 M611,744 C621,746 634,746 646,743"
      stroke="#6f795f" stroke-width=".42" opacity=".32"/>
  </g>

  </g>

<!-- ============ ДОПОЛНИТЕЛЬНЫЙ РЕЛЬЕФ ============ -->'''
if 'id="shechemRidges"' not in v:
    pattern=r'  <!-- Горный hatch texture под Гевалом -->.*?\n  </g>\n\n</g>\n\n<!-- ============ ДОПОЛНИТЕЛЬНЫЙ РЕЛЬЕФ ============ -->'
    v,n=re.subn(pattern,new_ridges,v,count=1,flags=re.S)
    if n!=1: raise SystemExit(f'MISSING Shechem mountain section: {n}')

trade_match=re.search(r'<g id="tradeRoutes".*?</g>',v,re.S)
if not trade_match: raise SystemExit('MISSING tradeRoutes group')
trade=trade_match.group(0)
trade_static=re.sub(r'\s*<animate attributeName="stroke-dashoffset"[^>]*/>','',trade)
if trade_static!=trade:
    v=v[:trade_match.start()]+trade_static+v[trade_match.end():]
svgf.write_text(v,'utf-8')
ET.parse(svgf)

# ── Browser evidence: story purity + reduced-motion ──
h=harness.read_text('utf-8')

old_describe="const describe=(el)=>({tag:el.tagName.toLowerCase(),id:el.id||null,className:typeof el.className==='string'?el.className:el.className?.baseVal||null,text:(el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,160),placeId:el.getAttribute('data-place-id'),story:el.getAttribute('data-story'),tab:el.getAttribute('data-tab'),ariaLabel:el.getAttribute('aria-label')});"
new_describe="const describe=(el)=>({tag:el.tagName.toLowerCase(),id:el.id||null,className:typeof el.className==='string'?el.className:el.className?.baseVal||null,text:(el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,160),placeId:el.getAttribute('data-place-id'),storyActive:el.getAttribute('data-story-active'),story:el.getAttribute('data-story'),tab:el.getAttribute('data-tab'),ariaLabel:el.getAttribute('aria-label')});"
if new_describe not in h:
    if old_describe not in h: raise SystemExit('MISSING describe() anchor')
    h=h.replace(old_describe,new_describe,1)

motion_return="motion:{prefersReducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,smilAnimations:svg?svg.querySelectorAll('animate,animateTransform,animateMotion,set').length:0,smilPaused:svg?.getAttribute('data-smil-paused')==='1'},"
if motion_return not in h:
    old="""      stateId,url:location.href,title:document.title,activeStory:activeStory?.getAttribute('data-story')||null,
      viewport:{width,height,devicePixelRatio,scrollX,scrollY},
"""
    new="""      stateId,url:location.href,title:document.title,activeStory:activeStory?.getAttribute('data-story')||null,
      motion:{prefersReducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,smilAnimations:svg?svg.querySelectorAll('animate,animateTransform,animateMotion,set').length:0,smilPaused:svg?.getAttribute('data-smil-paused')==='1'},
      viewport:{width,height,devicePixelRatio,scrollX,scrollY},
"""
    if old not in h: raise SystemExit('MISSING geometry return anchor')
    h=h.replace(old,new,1)

motion_gate="reduced motion did not pause SVG animations"
if motion_gate not in h:
    old="""    if(result.overview.map.zoomBucket!=='overview')result.verificationFailures.push(`unexpected overview zoom bucket: ${result.overview.map.zoomBucket}`);

    const themeButton=page.locator('.me-theme-btn').first();
"""
    new="""    if(result.overview.map.zoomBucket!=='overview')result.verificationFailures.push(`unexpected overview zoom bucket: ${result.overview.map.zoomBucket}`);
    if(result.overview.motion.prefersReducedMotion&&result.overview.motion.smilAnimations>0&&!result.overview.motion.smilPaused)result.verificationFailures.push('reduced motion did not pause SVG animations');

    const themeButton=page.locator('.me-theme-btn').first();
"""
    if old not in h: raise SystemExit('MISSING overview motion-gate anchor')
    h=h.replace(old,new,1)

purity_gate="story irrelevant markers"
if purity_gate not in h:
    old="""        if(story.id!=='main'&&geometry.counts.routes===0)result.verificationFailures.push(`story route missing: ${story.id}`);
        const overlapLimit=viewport.width<=560?4:6;
"""
    new="""        if(story.id!=='main'&&geometry.counts.routes===0)result.verificationFailures.push(`story route missing: ${story.id}`);
        const irrelevantMarkers=story.id==='main'?[]:geometry.markers.filter(marker=>marker.storyActive==='0');
        if(irrelevantMarkers.length)result.verificationFailures.push(`story irrelevant markers ${story.id}: ${irrelevantMarkers.map(marker=>marker.placeId||marker.text||marker.id).join(', ')}`);
        const overlapLimit=viewport.width<=560?4:6;
"""
    if old not in h: raise SystemExit('MISSING story-purity anchor')
    h=h.replace(old,new,1)
harness.write_text(h,'utf-8')

print('PASS7 APPLIED')
