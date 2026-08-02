from pathlib import Path

root=Path('.')
engine=root/'karty/_engine/map-engine.js'
harness=root/'scripts/avraam-reference-baseline.mjs'
s=engine.read_text('utf-8')
if 'Premium quiet panel navigation' in s and 'themeAlternative' in harness.read_text('utf-8'):
    print('PASS5 ALREADY MATERIALIZED')
    raise SystemExit(0)

def rep(text,old,new,label,count=1):
    n=text.count(old)
    if n<count:
        raise SystemExit(f'MISSING {label}: {n}')
    return text.replace(old,new,count)

# Keep the canvas primary: chronology is contextual, north-up needs no floating
# compass, and controls use a quieter circular treatment.
quiet_css='''
/* Premium quiet panel navigation: map first, contextual detail second. */
.me-life{display:none!important}
.me-map #me-compass{display:none!important}
.me-theme-btn,.me-share-btn,.me-zoom-btn{border-radius:999px}
.me-layers{border-radius:14px}
'''
s=rep(s,'/* Theme toggle */',quiet_css+'\n/* Theme toggle */','quiet chrome css')
s=rep(s,'  .me-life{display:block}\n','  .me-life{display:none!important}\n','desktop life rail')

s=rep(s,
'.me-tabs{display:flex;gap:0;padding:0 12px;border-bottom:1px solid rgba(255,255,255,.06);overflow-x:auto}',
'.me-tabs{display:flex;gap:2px;padding:0 38px 0 12px;border-bottom:1px solid rgba(255,255,255,.06);overflow-x:auto;scrollbar-width:none;scroll-snap-type:x proximity;overscroll-behavior-x:contain;mask-image:linear-gradient(to right,#000 0,#000 calc(100% - 34px),transparent)}.me-tabs::-webkit-scrollbar{display:none}',
'premium tabs')
s=rep(s,
'.me-tab{padding:8px 14px;min-height:44px;font-size:11px;border:none;background:none;color:#9aa2ae;cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;font-family:inherit;white-space:nowrap;position:relative;top:1px;display:inline-flex;align-items:center;justify-content:center}',
'.me-tab{padding:8px 14px;min-height:44px;font-size:11px;border:none;background:none;color:#9aa2ae;cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;font-family:inherit;white-space:nowrap;position:relative;top:1px;display:inline-flex;align-items:center;justify-content:center;scroll-snap-align:center;flex:0 0 auto}',
'tab snap')
s=rep(s,
".me-tabs::after{content:'';position:sticky;right:0;width:20px;flex-shrink:0;background:linear-gradient(to right,transparent,rgba(13,17,26,.9));pointer-events:none}",
".me-tabs::after{content:'';position:sticky;right:-38px;width:38px;flex:0 0 38px;background:linear-gradient(to right,transparent,var(--me-panel-bg,rgba(13,17,26,.96)) 72%);pointer-events:none}",
'tab fade')

old_nav_css='''.me-nav__dots{flex:1;display:flex;justify-content:center;gap:4px}
.me-nav__dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.15);transition:all .2s}
.me-nav__dot--active{background:#e8c879;transform:scale(1.4)}
.me-nav__info{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1}
.me-nav__counter{font-size:10px;color:#e8c879;font-weight:700;letter-spacing:.04em}'''
new_nav_css='''.me-nav__info{display:flex;flex-direction:column;align-items:center;gap:7px;flex:1;min-width:0}
.me-nav__counter{font-size:10px;color:var(--me-accent,#e8c879);font-weight:700;letter-spacing:.08em}
.me-nav__progress{width:min(160px,100%);height:3px;border-radius:999px;background:rgba(255,255,255,.09);overflow:hidden}
.me-nav__progress-fill{display:block;height:100%;border-radius:inherit;background:linear-gradient(to right,color-mix(in srgb,var(--me-accent,#e8c879) 58%,transparent),var(--me-accent,#e8c879));transition:width .3s ease}'''
s=rep(s,old_nav_css,new_nav_css,'nav progress css')

# Soften map labels: retain contrast without turning every place into a black badge.
s=rep(s,"labelBg.setAttribute('fill','var(--me-label-bg,rgba(7,10,16,.68))');","labelBg.setAttribute('fill','var(--me-label-bg,rgba(7,10,16,.52))');",'label background')
s=rep(s,"labelBg.setAttribute('stroke-width','0.5');","labelBg.setAttribute('stroke-width','0.35');",'label border width')
s=rep(s,"labelBg.setAttribute('opacity',inStory?'0.68':'0');","labelBg.setAttribute('opacity',inStory?'0.54':'0');",'label opacity')

# Keep the chosen tab visible in a long dossier strip.
s=rep(s,
"""          btn.classList.add('me-tab--active');
          renderTabContent(btn.dataset.tab||'story',place);
""",
"""          btn.classList.add('me-tab--active');
          btn.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
          renderTabContent(btn.dataset.tab||'story',place);
""",'active tab centering')
s=rep(s,
"""      // Content
      renderTabContent(activeTab,place);
""",
"""      requestAnimationFrame(()=>tabsEl.querySelector('.me-tab--active')?.scrollIntoView({block:'nearest',inline:'start'}));

      // Content
      renderTabContent(activeTab,place);
""",'initial tab visibility')

old_nav="""    nav.innerHTML=`
        <button ${idx<=0?'disabled':''} id="me-prev" title="${idx>0?esc(vis[idx-1].name):''}">←</button>
        <div class="me-nav__info"><span class="me-nav__counter">${idx+1} / ${vis.length}</span><div class="me-nav__dots">${vis.map((p,i)=>`<div class="me-nav__dot${i===idx?' me-nav__dot--active':''}"></div>`).join('')}</div></div>
        <button ${idx>=vis.length-1?'disabled':''} id="me-next" title="${idx<vis.length-1?esc(vis[idx+1].name):''}">→</button>
      `;
"""
new_nav="""    const progressPct=vis.length>1?Math.round((Math.max(0,idx)/(vis.length-1))*100):100;
    nav.innerHTML=`
        <button ${idx<=0?'disabled':''} id="me-prev" title="${idx>0?esc(vis[idx-1].name):''}">←</button>
        <div class="me-nav__info"><span class="me-nav__counter">${idx+1} / ${vis.length}</span><div class="me-nav__progress" aria-hidden="true"><span class="me-nav__progress-fill" style="width:${progressPct}%"></span></div></div>
        <button ${idx>=vis.length-1?'disabled':''} id="me-next" title="${idx<vis.length-1?esc(vis[idx+1].name):''}">→</button>
      `;
"""
s=rep(s,old_nav,new_nav,'panel progress markup')
s=rep(s,
"""      // Clickable nav dots
      nav.querySelectorAll('.me-nav__dot').forEach((dot,i) => {
        dot.style.cursor = 'pointer';
        dot.addEventListener('click', () => { if (i !== idx) open(vis[i].id); });
      });
""",'', 'remove nav dots handlers')
engine.write_text(s,'utf-8')

h=harness.read_text('utf-8')
h=rep(h,
"const result={viewport,route:ROUTE_URL,introDismissed:false,overview:null,stories:[],places:[],tabs:[],keyboard:{},verificationFailures:[],consoleEvents,failedRequests,fatal:null};",
"const result={viewport,route:ROUTE_URL,introDismissed:false,overview:null,surfaces:{},stories:[],places:[],tabs:[],keyboard:{},verificationFailures:[],consoleEvents,failedRequests,fatal:null};",
'baseline surfaces result')
anchor="""    if(result.overview.map.zoomBucket!=='overview')result.verificationFailures.push(`unexpected overview zoom bucket: ${result.overview.map.zoomBucket}`);

    const stories=await storyMetadata(page);
"""
insert="""    if(result.overview.map.zoomBucket!=='overview')result.verificationFailures.push(`unexpected overview zoom bucket: ${result.overview.map.zoomBucket}`);

    const themeButton=page.locator('.me-theme-btn').first();
    if(await themeButton.isVisible().catch(()=>false)){
      await themeButton.evaluate(el=>el.click());await page.waitForTimeout(180);
      await screenshot(page,dir,'02-theme-alt.png');
      result.surfaces.themeAlternative=await collectGeometry(page,`${viewport.id}:theme-alt`);
      if(result.surfaces.themeAlternative.counts.offscreenControls>0)result.verificationFailures.push(`theme-alt offscreen controls: ${result.surfaces.themeAlternative.counts.offscreenControls}`);
      if(result.surfaces.themeAlternative.counts.undersizedControls>0)result.verificationFailures.push(`theme-alt controls <44px: ${result.surfaces.themeAlternative.counts.undersizedControls}`);
      await themeButton.evaluate(el=>el.click());await page.waitForTimeout(150);
    }else result.verificationFailures.push('theme toggle missing');

    const layerSummary=page.locator('.me-layers__summary').first();
    if(await layerSummary.isVisible().catch(()=>false)){
      await layerSummary.evaluate(el=>el.click());await page.waitForTimeout(160);
      await screenshot(page,dir,'03-layers-expanded.png');
      result.surfaces.layersExpanded=await collectGeometry(page,`${viewport.id}:layers-expanded`);
      if(result.surfaces.layersExpanded.counts.offscreenControls>0)result.verificationFailures.push(`layers offscreen controls: ${result.surfaces.layersExpanded.counts.offscreenControls}`);
      if(result.surfaces.layersExpanded.counts.undersizedControls>0)result.verificationFailures.push(`layers controls <44px: ${result.surfaces.layersExpanded.counts.undersizedControls}`);
      await layerSummary.evaluate(el=>el.click());await page.waitForTimeout(120);
    }else result.verificationFailures.push('layers summary missing');

    const stories=await storyMetadata(page);
"""
h=rep(h,anchor,insert,'theme and layers evidence')
harness.write_text(h,'utf-8')
print('PASS5 APPLIED')
