from pathlib import Path

path = Path('scripts/interactive-audit.js')
text = path.read_text(encoding='utf-8')
old = '''async function checkGlossary(browser) {
  for (const url of GLOSSARY_URLS) {
    const page = await openPage(browser, url, { width: 900, height: 650 });
    const summaryTerms = await page.locator('.summary-card .gterm, .summary-card .gtip').count();
    if (summaryTerms) push('summary-has-glossary-terms', url, summaryTerms);
    const count = await page.locator('article .gterm:not(.summary-card .gterm)').count();
    if (count > 0) {
      await page.locator('article .gterm:not(.summary-card .gterm)').first().hover({ force: true });
      await page.waitForTimeout(250);
      const state = await page.evaluate(() => {
        const tip = document.querySelector('.gtip.gb-floating-tip.is-open');
        if (!tip) return null;
        const r = tip.getBoundingClientRect();
        const inner = tip.querySelector('.gtip-luxury');
        const cs = getComputedStyle(tip);
        return {
          w: Math.round(r.width),
          h: Math.round(r.height),
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          bg: cs.backgroundColor,
          innerDisplay: inner ? getComputedStyle(inner).display : null,
        };
      });
      if (!state || state.w < 100 || state.h < 50 || state.top < 0 || state.bottom > 651 || /rgba\\(0, 0, 0, 0\\)/.test(state.bg) || state.innerDisplay !== 'block') {
        push('glossary-tooltip-bad-layout', url, state);
      }
    }
    stats.glossary++;
    await page.close();
  }
}
'''
new = '''async function checkGlossary(browser) {
  const selector = 'article .gterm:not(.summary-card .gterm)';
  for (const url of GLOSSARY_URLS) {
    const page = await openPage(browser, url, { width: 900, height: 650 });
    const summaryTerms = await page.locator('.summary-card .gterm, .summary-card .gtip').count();
    if (summaryTerms) push('summary-has-glossary-terms', url, summaryTerms);
    const terms = page.locator(selector);
    const count = await terms.count();
    if (count > 0) {
      let readinessError = null;
      try {
        await page.waitForFunction((termSelector) => {
          const runtime = window.__gbGlossaryRuntime;
          const target = document.querySelector(termSelector);
          return Boolean(
            runtime && runtime.dict && runtime.policy && runtime.aliasToCanonical &&
            window.SiteUtils && typeof window.SiteUtils.initGlossaryTooltips === 'function' &&
            target && target.getAttribute('data-term') && target.querySelector('.gtip')
          );
        }, selector, { timeout: 5000 });
      } catch (error) {
        readinessError = String(error.message || error).slice(0, 500);
      }

      const target = terms.first();
      if (!readinessError) {
        await target.scrollIntoViewIfNeeded();
        await target.hover();
        try {
          await page.waitForSelector('.gtip.gb-floating-tip.is-open', { state: 'attached', timeout: 2000 });
        } catch (error) {
          readinessError = `open timeout: ${String(error.message || error).slice(0, 400)}`;
        }
      }

      const state = await page.evaluate((termSelector) => {
        const runtime = window.__gbGlossaryRuntime;
        const target = document.querySelector(termSelector);
        const tip = document.querySelector('.gtip.gb-floating-tip.is-open');
        const targetRect = target ? target.getBoundingClientRect() : null;
        const tipRect = tip ? tip.getBoundingClientRect() : null;
        const inner = tip ? tip.querySelector('.gtip-luxury') : null;
        const tipStyle = tip ? getComputedStyle(tip) : null;
        return {
          runtime: {
            initialized: window.__gbGlossaryInitialized === true,
            dict: Boolean(runtime && runtime.dict),
            policy: Boolean(runtime && runtime.policy),
            aliases: Boolean(runtime && runtime.aliasToCanonical),
            initFunction: Boolean(window.SiteUtils && typeof window.SiteUtils.initGlossaryTooltips === 'function'),
          },
          target: target ? {
            term: target.getAttribute('data-term'),
            role: target.getAttribute('role'),
            tabindex: target.getAttribute('tabindex'),
            ariaExpanded: target.getAttribute('aria-expanded'),
            hasInlineTip: Boolean(target.querySelector('.gtip')),
            w: targetRect ? Math.round(targetRect.width) : null,
            h: targetRect ? Math.round(targetRect.height) : null,
          } : null,
          floatingCount: document.querySelectorAll('.gb-floating-tip').length,
          tip: tip ? {
            w: Math.round(tipRect.width),
            h: Math.round(tipRect.height),
            top: Math.round(tipRect.top),
            bottom: Math.round(tipRect.bottom),
            bg: tipStyle.backgroundColor,
            innerDisplay: inner ? getComputedStyle(inner).display : null,
          } : null,
        };
      }, selector);

      if (readinessError) {
        const kind = state.runtime.dict && state.runtime.policy && state.runtime.aliases && state.runtime.initFunction
          ? 'glossary-tooltip-did-not-open'
          : 'glossary-tooltip-runtime-not-ready';
        push(kind, url, { error: readinessError, ...state });
      } else if (!state.tip || state.tip.w < 100 || state.tip.h < 50 || state.tip.top < 0 || state.tip.bottom > 651 || /rgba\\(0, 0, 0, 0\\)/.test(state.tip.bg) || state.tip.innerDisplay !== 'block') {
        push('glossary-tooltip-bad-layout', url, state);
      }
    }
    stats.glossary++;
    await page.close();
  }
}
'''
count = text.count(old)
if count != 1:
    raise SystemExit(f'glossary audit anchor count={count}')
updated = text.replace(old, new)
required = [
    'glossary-tooltip-runtime-not-ready',
    'glossary-tooltip-did-not-open',
    "page.waitForSelector('.gtip.gb-floating-tip.is-open'",
    'runtime && runtime.dict && runtime.policy && runtime.aliasToCanonical',
    'await target.hover();',
]
missing = [item for item in required if item not in updated]
if missing:
    raise SystemExit(f'missing contracts: {missing}')
path.write_text(updated, encoding='utf-8')
