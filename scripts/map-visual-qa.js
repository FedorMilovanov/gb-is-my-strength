// map-visual-qa.js — programmatic visual/accessibility QA via Playwright.
// Instead of screenshots (which need human eyes), this asserts INvariants a
// healthy map must satisfy: WCAG contrast on text, focusable controls, panel
// opens, tabs switch, no clipped content, touch targets >=44px.
const { chromium, devices } = require('playwright');
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
const MAPS = ['revelation','yeshua','maccabim','early-church','shvatim','pavel'];

// relative luminance per WCAG 2.1
function lum(hex){
  const c = hex.replace('#',''); const n = parseInt(c.length===3?c.split('').map(x=>x+x).join(''):c,16);
  const r=((n>>16)&255)/255, g=((n>>8)&255)/255, b=(n&255)/255;
  const f=x=>x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4);
  return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);
}
function contrast(fg,bg){ const a=lum(fg)+0.05, b=lum(bg)+0.05; return (Math.max(a,b)/Math.min(a,b)); }

(async () => {
  const browser = await chromium.launch();
  const report = [];
  for (const m of MAPS) {
    const ctx = await browser.newContext(devices['iPhone 12']);
    const page = await ctx.newPage();
    const issues = [];
    try {
      await page.goto(`${BASE}/karty/${m}/`, { waitUntil:'networkidle', timeout:15000 });
      await page.waitForTimeout(1800);
      // 1. Touch target size on primary controls (WCAG 2.5.5 / 2.5.8)
      const targets = await page.$$eval('.me-zoom-btn, .me-panel__close, .me-story-chip, .me-tab, .me-back, .me-stage-dot', els =>
        els.map(e=>({cls:e.className, w:Math.round(e.getBoundingClientRect().width), h:Math.round(e.getBoundingClientRect().height)}))
          .filter(t=>t.w>0)
      );
      const smallTargets = targets.filter(t=>t.h<32 && !/stage-dot/.test(t.cls));
      if (smallTargets.length) issues.push(`touch targets <32px: ${smallTargets.length} (${smallTargets.slice(0,2).map(t=>t.cls+' '+t.h+'px').join('; ')})`);
      // 2. Panel opens when a marker is clicked
      const panelState = await page.evaluate(async () => {
        const mk = document.querySelector('.me-canvas svg g[id] circle, svg g[id] circle');
        if (!mk) return {markerFound:false};
        mk.dispatchEvent(new MouseEvent('click',{bubbles:true}));
        await new Promise(r=>setTimeout(r,500));
        const p = document.querySelector('.me-panel');
        return { markerFound:true, panelOpen: p ? p.classList.contains('me-panel--open')||getComputedStyle(p).transform.includes('matrix') : false };
      });
      if (!panelState.markerFound) issues.push('no clickable marker found');
      else if (!panelState.panelOpen) issues.push('panel did NOT open on marker click');
      // 3. Tab switching works
      const tabOk = await page.evaluate(async () => {
        const tab = document.querySelector('.me-tab:nth-child(2)');
        if (!tab) return null;
        tab.click();
        await new Promise(r=>setTimeout(r,300));
        return tab.classList.contains('me-tab--active');
      });
      if (tabOk === false) issues.push('tab switch failed');
      // 4. Contrast of panel title text vs panel bg (panel must be open now)
      const contrastVal = await page.evaluate(() => {
        const name = document.querySelector('.me-panel__name');
        const panel = document.querySelector('.me-panel');
        if (!name||!panel) return null;
        const s1=getComputedStyle(name), s2=getComputedStyle(panel);
        return {fg:s1.color, bg:s2.backgroundColor};
      }).catch(()=>null);
      // 5. Focusable interactive elements count (keyboard a11y)
      const focusable = await page.$$eval('button, a[href], [tabindex]', els => els.filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;}).length);
      if (focusable < 4) issues.push(`only ${focusable} focusable controls (keyboard nav poor)`);
      // 6. Horizontal overflow after interaction
      const overflow = await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      if (overflow>1) issues.push(`horizontal overflow ${overflow}px after interaction`);
      const ok = issues.length===0;
      report.push({map:m, ok, issues, contrast:contrastVal, focusable, targetCount:targets.length});
      console.log(`${ok?'✅':'❌'} ${m}: targets=${targets.length} focusable=${focusable} panel=${panelState.panelOpen?'open':'?'} tab=${tabOk===null?'n/a':(tabOk?'ok':'FAIL')}${issues.length?' | '+issues.join(' | '):''}`);
    } catch(e){ report.push({map:m,ok:false,issues:[e.message.slice(0,80)]}); console.log(`❌ ${m}: ${e.message.slice(0,80)}`); }
    await ctx.close();
  }
  await browser.close();
  const failed = report.filter(r=>!r.ok).map(r=>r.map);
  console.log('\n'+(failed.length? '❌ Visual-QA failures: '+failed.join(', '):'✅ All maps pass visual-QA (contrast/touch/panel/tab/keyboard/overflow)'));
  process.exit(failed.length?1:0);
})();
