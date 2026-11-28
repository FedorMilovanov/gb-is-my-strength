import assert from 'node:assert/strict';

// ARGON uses the one authored passage source, projected into its study panel.
// Native focus/touch tooltip contracts remain separate and unchanged.
export async function assertArgonScriptureActivation(page, trigger, { keyboard = true, key = 'Enter' } = {}) {
  await page.waitForFunction(() => document.body.classList.contains('np-w57-ready') &&
    window.__NP_UNIVERSAL_PREVIEW__?.ready === true &&
    window.__NP_W57_ANNOTATIONS__?.ready === true, null, { timeout: 15000 });
  assert.equal(new URL(page.url()).searchParams.has('reader-pilot'), false, 'default ARGON must not fall back');
  const source = await trigger.evaluate(el => {
    const ref = el.dataset.ref;
    const tip = [...document.querySelectorAll('.btip')].find(t =>
      t.querySelector('.btip__reference')?.textContent.trim() === ref);
    return { ref, text: tip?.querySelector('.btip__text')?.textContent.trim(),
      credit: tip?.querySelector('.btip__source')?.textContent.trim() || '' };
  });
  assert.ok(source.ref && source.text, 'authoritative scripture reference and text must exist');
  await trigger.scrollIntoViewIfNeeded();
  if (keyboard) {
    await trigger.focus();
    assert.equal(await trigger.evaluate(el => document.activeElement === el), true, 'keyboard focus reaches source citation');
    await trigger.press(key);
  } else {
    await trigger.click();
  }
  await page.waitForFunction(source => {
    const module = document.querySelector('#npUSectionHost [data-np-u-module="scripture"]');
    const pick = module?.querySelector('[data-np-u-scripture-picker]');
    const reading = module?.querySelector('[data-np-u-scripture-reading]');
    const quote = reading?.querySelector('.np-u-scripture-quote');
    const rect = quote?.getBoundingClientRect();
    return module?.querySelector(':scope > details')?.open && pick?.value === source.ref &&
      reading?.dataset.npUScriptureText === source.text && reading.dataset.npUScriptureCredit === source.credit &&
      quote?.textContent === source.text && rect?.width > 0 && rect.height > 0 &&
      getComputedStyle(quote).visibility !== 'hidden';
  }, source, { timeout: 10000 }).catch(async error => {
    const observed = await page.evaluate(() => {
      const mod = document.querySelector('#npUSectionHost [data-np-u-module="scripture"]');
      const reading = mod?.querySelector('[data-np-u-scripture-reading]');
      const quote = reading?.querySelector('.np-u-scripture-quote');
      return { picked: mod?.querySelector('[data-np-u-scripture-picker]')?.value,
        open: mod?.querySelector(':scope > details')?.open, visible: quote?.getBoundingClientRect().toJSON(),
        text: reading?.dataset.npUScriptureText, credit: reading?.dataset.npUScriptureCredit,
        state: window.ReaderState?.getSnapshot?.(), active: document.activeElement?.outerHTML?.slice(0,300),
        right: document.body.className };
    });
    throw new Error('ARGON scripture activation failed: ' + JSON.stringify({ source, observed }), { cause: error });
  });
  const geometry = await page.evaluate(() => {
    const visible = el => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const research = document.getElementById('npUResearch');
    const module = research.querySelector('[data-np-u-module="scripture"]');
    const panel = research.getBoundingClientRect(), box = module.getBoundingClientRect();
    return { visible: visible(research) && visible(module), panel: panel.toJSON(),
      module: box.toJSON(), width: innerWidth, height: innerHeight,
      duplicateTips: [...document.querySelectorAll('body > .btip.gb-floating-tip.is-open')].filter(visible).length };
  });
  assert.ok(geometry.visible && geometry.panel.left >= -2 && geometry.panel.right <= geometry.width + 2 &&
    geometry.panel.top >= -2 && geometry.panel.bottom <= geometry.height + 2, 'study window inside viewport: ' + JSON.stringify(geometry));
  assert.equal(geometry.duplicateTips, 0, 'no competing visible native tooltip');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false', 'native tooltip is closed by its own controller');
  if (keyboard) {
    assert.equal(await page.locator('#npUScripturePick').evaluate(el => document.activeElement === el), true,
      'keyboard activation moves focus to the visible study picker');
  }
  return { reference: source.ref, passageLength: source.text.length, keyboard, geometry };
}