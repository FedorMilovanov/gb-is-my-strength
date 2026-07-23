const { chromium } = require('playwright');
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const DEFAULT_LIVE_MAPS = ['ishod','avraam'];
const HOLDING_MAPS = ['pavel','melachim','shoftim','shvatim','yeshua','maccabim','early-church','revelation'];
const MAPS = (process.env.MAP_SMOKE_ROUTES || DEFAULT_LIVE_MAPS.join(','))
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
(async () => {
  if (!process.env.MAP_SMOKE_ROUTES && HOLDING_MAPS.length) {
    console.log(`ℹ️ Skipping holding map routes until owner-approved live MapEngine launch: ${HOLDING_MAPS.join(', ')}`);
  }
  const browser = await chromium.launch();
  const problems = [];
  for (const m of MAPS) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));
    try {
      await page.goto(`${BASE}/karty/${m}/`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      const svgCircles = await page.locator('svg circle').count().catch(()=>0);
      const mapW = await page.evaluate(()=>{const el=document.querySelector('.me-map,#mapRoot');return el?el.getBoundingClientRect().width:0;}).catch(()=>0);
      const overflow = await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth).catch(()=>0);
      const routeViz = await page.evaluate(()=>{
        const vb = (document.querySelector('.me-canvas svg')?.getAttribute('viewBox') || '').split(/\s+/).map(Number);
        return {
          underlays: document.querySelectorAll('.me-route-underlay').length,
          routeLabels: document.querySelectorAll('.me-route-label').length,
          mainRoutes: document.querySelectorAll('.me-route-main').length,
          viewW: vb[2] || 0,
          viewH: vb[3] || 0,
        };
      }).catch(()=>({underlays:0,routeLabels:0,mainRoutes:0,viewW:0,viewH:0}));
      const signature = await page.evaluate(async () => {
        try {
          const route = await fetch('./route.json').then(r => r.json());
          if (!route.signature) return {expected:false, ok:true, nodes:0};
          const root = document.querySelector('#me-signature');
          const nodes = document.querySelectorAll('#me-signature .me-signature').length;
          const kind = route.signature.type;
          const note = document.querySelector('.me-signature-note');
          const noteOk = !!note && note.getAttribute('data-signature-note') === kind && note.textContent.includes(route.signature.label || '');
          const layerRow = document.querySelector('.me-layers__row[data-layer-id="signature"]');
          const toggle = layerRow?.querySelector('.me-layers__toggle');
          let toggleOk = false;
          if (toggle && root) {
            toggle.click();
            await new Promise(r => setTimeout(r, 80));
            const off = getComputedStyle(root).display === 'none' || Number(getComputedStyle(root).opacity || 1) < 0.3;
            toggle.click();
            await new Promise(r => setTimeout(r, 80));
            const on = getComputedStyle(root).display !== 'none' && Number(getComputedStyle(root).opacity || 1) >= 0.3;
            toggleOk = off && on;
          }
          return {expected:true, ok:nodes>0 && root?.getAttribute('data-signature-kind')===kind && noteOk && toggleOk, nodes, kind, noteOk, toggleOk};
        } catch (e) { return {expected:true, ok:false, reason:String(e && e.message || e)}; }
      }).catch(e=>({expected:true,ok:false,reason:String(e)}));
      const storyFocus = await page.evaluate(async () => {
        const chips = [...document.querySelectorAll('.me-story-chip')];
        const target = chips.find(ch => !ch.classList.contains('me-story-chip--active'));
        if (!target) return {tested:false, reason:'no-inactive-story'};
        const svg = document.querySelector('.me-canvas svg');
        const before = svg?.getAttribute('viewBox') || '';
        target.click();
        await new Promise(r => setTimeout(r, 950));
        const after = svg?.getAttribute('viewBox') || '';
        const halo = document.querySelector('.me-story-focus');
        const haloBox = halo ? {w:Number(halo.getAttribute('width')||0), h:Number(halo.getAttribute('height')||0), story:halo.getAttribute('data-story-focus')} : null;
        return {tested:true, ok:before !== after && !!halo && haloBox.w >= 36 && haloBox.h >= 36, before, after, story:target.textContent.trim(), haloBox};
      }).catch(e=>({tested:true,ok:false,reason:String(e)}));
      const sci = await page.evaluate(async () => {
        try {
          const chips = [...document.querySelectorAll('.me-story-chip')];
          if (chips[0]) { chips[0].click(); await new Promise(r => setTimeout(r, 350)); }
          const route = await fetch('./route.json').then(r => r.json());
          const variants = route.scientific_variants || route.variants || {};
          const place = (route.places || []).find(p => variants[p.id] && document.querySelector(`[data-place-id="${p.id}"]`));
          if (!place) return {tested:false, reason:'no-place-with-variants'};
          const marker = document.querySelector(`[data-place-id="${place.id}"]`);
          marker.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
          await new Promise(r => setTimeout(r, 180));
          const sciTab = document.querySelector('.me-tab[data-tab="sci"]');
          if (!sciTab) return {tested:true, ok:false, reason:'no-sci-tab', place:place.id};
          sciTab.click();
          await new Promise(r => setTimeout(r, 120));
          const items = document.querySelectorAll('.me-sci-item').length;
          const statuses = [...document.querySelectorAll('.me-sci-status')].map(el => el.textContent.trim()).filter(Boolean);
          const archFooter = !!document.querySelector('.me-arch-footer');
          const sourceBadges = document.querySelectorAll('.me-source-badge').length;
          const moreButton = !!document.querySelector('.me-arch-more');
          return {tested:true, ok:items>0 && statuses.length>0 && archFooter && sourceBadges>0, place:place.id, items, statuses:statuses.slice(0,3), archFooter, sourceBadges, moreButton};
        } catch (e) { return {tested:true, ok:false, reason:String(e && e.message || e)}; }
      }).catch(e=>({tested:true,ok:false,reason:String(e)}));
      const keyboard = await page.evaluate(async () => {
        try {
          const route = await fetch('./route.json').then(r => r.json());
          const variants = route.scientific_variants || route.variants || {};
          const place = (route.places || []).find(p => variants[p.id] && document.querySelector(`[data-place-id="${p.id}"]`));
          if (!place) return {tested:false, reason:'no-place-with-scientific-tab'};
          const marker = document.querySelector(`[data-place-id="${place.id}"]`);
          marker.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true}));
          await new Promise(r => setTimeout(r, 180));

          const visibleTabs = [...document.querySelectorAll('.me-tabs .me-tab[data-tab]')].filter(tab => {
            const style = getComputedStyle(tab);
            return !tab.hidden && tab.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden';
          });
          const sciIndex = visibleTabs.findIndex(tab => tab.dataset.tab === 'sci');
          if (sciIndex < 0 || sciIndex > 7) {
            return {tested:true, ok:false, reason:'sci-tab-not-addressable', order:visibleTabs.map(tab => tab.dataset.tab)};
          }

          const storyTab = visibleTabs.find(tab => tab.dataset.tab === 'story');
          storyTab?.click();
          await new Promise(r => setTimeout(r, 60));

          const root = document.querySelector('.me-map,#mapRoot');
          const probe = document.createElement('input');
          probe.type = 'search';
          probe.setAttribute('aria-label', 'keyboard contract probe');
          root.appendChild(probe);
          probe.focus();
          const spaceEvent = new KeyboardEvent('keydown', {key:' ', bubbles:true, cancelable:true});
          probe.dispatchEvent(spaceEvent);
          const digitEvent = new KeyboardEvent('keydown', {key:String(sciIndex + 1), bubbles:true, cancelable:true});
          probe.dispatchEvent(digitEvent);
          await new Promise(r => setTimeout(r, 80));
          const inputActiveTab = document.querySelector('.me-tab--active')?.dataset.tab || '';
          probe.remove();

          storyTab?.click();
          await new Promise(r => setTimeout(r, 60));
          const numericEvent = new KeyboardEvent('keydown', {key:String(sciIndex + 1), bubbles:true, cancelable:true});
          document.dispatchEvent(numericEvent);
          await new Promise(r => setTimeout(r, 100));
          const numericActiveTab = document.querySelector('.me-tab--active')?.dataset.tab || '';

          storyTab?.click();
          await new Promise(r => setTimeout(r, 60));
          const modifiedEvent = new KeyboardEvent('keydown', {key:String(sciIndex + 1), ctrlKey:true, bubbles:true, cancelable:true});
          document.dispatchEvent(modifiedEvent);
          await new Promise(r => setTimeout(r, 80));
          const modifiedActiveTab = document.querySelector('.me-tab--active')?.dataset.tab || '';

          const ok = !spaceEvent.defaultPrevented
            && !digitEvent.defaultPrevented
            && inputActiveTab === 'story'
            && numericEvent.defaultPrevented
            && numericActiveTab === 'sci'
            && !modifiedEvent.defaultPrevented
            && modifiedActiveTab === 'story';
          return {
            tested:true,
            ok,
            order:visibleTabs.map(tab => tab.dataset.tab),
            sciKey:String(sciIndex + 1),
            input:{spacePrevented:spaceEvent.defaultPrevented,digitPrevented:digitEvent.defaultPrevented,activeTab:inputActiveTab},
            numeric:{prevented:numericEvent.defaultPrevented,activeTab:numericActiveTab},
            modified:{prevented:modifiedEvent.defaultPrevented,activeTab:modifiedActiveTab},
          };
        } catch (e) { return {tested:true, ok:false, reason:String(e && e.message || e)}; }
      }).catch(e=>({tested:true,ok:false,reason:String(e)}));
      const routeVizOk = routeViz.underlays > 0 && routeViz.mainRoutes > 0 && routeViz.viewW > 50 && routeViz.viewH > 35;
      const sciOk = !sci.tested || sci.ok;
      const storyOk = !storyFocus.tested || storyFocus.ok;
      const signatureOk = signature.ok !== false;
      const keyboardOk = !keyboard.tested || keyboard.ok;
      const status = errors.length===0 && mapW>0 && routeVizOk && sciOk && storyOk && signatureOk && keyboardOk ? '✅' : '❌';
      console.log(`${status} ${m}: svgCircles=${svgCircles}, routes=${routeViz.mainRoutes}/${routeViz.underlays}, labels=${routeViz.routeLabels}, viewW=${Math.round(routeViz.viewW)}, signature=${signature.expected?(signature.ok?'ok':'BAD'):'none'}, sigToggle=${signature.expected?(signature.toggleOk?'ok':'BAD'):'skip'}, storyFly=${storyFocus.tested?(storyFocus.ok?'ok':'BAD'):'skip'}, sci=${sci.tested?(sci.ok?'ok':'BAD'):'skip'}, keyboard=${keyboard.tested?(keyboard.ok?'ok':'BAD'):'skip'}, mapW=${Math.round(mapW)}px, overflow=${overflow}px, errors=${errors.length}`);
      if(errors.length) errors.slice(0,3).forEach(e=>console.log(`     ${e.slice(0,150)}`));
      if(!routeVizOk) console.log(`     route visual missing: ${JSON.stringify(routeViz)}`);
      if(!signatureOk) console.log(`     signature problem: ${JSON.stringify(signature)}`);
      if(!storyOk) console.log(`     story flyTo problem: ${JSON.stringify(storyFocus)}`);
      if(!sciOk) console.log(`     sci tab problem: ${JSON.stringify(sci)}`);
      if(!keyboardOk) console.log(`     keyboard problem: ${JSON.stringify(keyboard)}`);
      if(errors.length||mapW===0||!routeVizOk||!sciOk||!storyOk||!signatureOk||!keyboardOk) problems.push(m);
    } catch(e){ console.log(`❌ ${m}: ${e.message.slice(0,100)}`); problems.push(m); }
    await ctx.close();
  }
  await browser.close();
  console.log('\n'+(problems.length===0?'✅ All maps render cleanly':'❌ Problems: '+problems.join(', ')));
  process.exit(problems.length?1:0);
})();
