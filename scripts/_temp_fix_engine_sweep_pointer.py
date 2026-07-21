#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/engine-sweep.mjs')
text = path.read_text(encoding='utf-8')

old_helper = '''async function newPage(vp, { speech = false } = {}) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.route(/gospod-bog\\.ru|mc\\.yandex/, (r) => r.abort());
  page.on('pageerror', (e) => R('JS', 'pageerror', false, String(e).slice(0, 120)));
  if (speech) await page.addInitScript(SPEECH_STUB);
  return { ctx, page };
}
'''
new_helper = old_helper + '''
async function clickVisibleCenter(page, selector) {
  const hit = await page.evaluate((value) => {
    const el = document.querySelector(value);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return {
      x,
      y,
      width: Math.round(r.width),
      height: Math.round(r.height),
      visible: r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none',
      hit: top === el || el.contains(top),
      top: top ? (top.id || top.className || top.tagName) : null,
    };
  }, selector);
  if (hit && hit.visible && hit.hit) await page.mouse.click(hit.x, hit.y);
  return hit;
}
'''
if text.count(old_helper) != 1:
    raise SystemExit(f'newPage insertion point count={text.count(old_helper)}')
text = text.replace(old_helper, new_helper, 1)

old_desktop = '''  await page.click('#railSettingsBtn');
  await page.waitForTimeout(450);
'''
new_desktop = '''  const settingsHit = await clickVisibleCenter(page, '#railSettingsBtn');
  R(id, 'desk: rail ⚙ hit-target', !!settingsHit && settingsHit.visible && settingsHit.hit, JSON.stringify(settingsHit));
  if (settingsHit && settingsHit.visible && settingsHit.hit) {
    await page.waitForFunction(() => document.querySelector('#gillSettingsOverlay')?.classList.contains('is-open'), null, { timeout: 8000 });
  }
  await page.waitForTimeout(450);
'''
if text.count(old_desktop) != 1:
    raise SystemExit(f'desktop click block count={text.count(old_desktop)}')
text = text.replace(old_desktop, new_desktop, 1)

old_mobile = '''  const gear = await page.$('#mobSettingsBtn');
  if (gear) {
    await gear.click(); await page.waitForTimeout(450);
'''
new_mobile = '''  const gear = await page.$('#mobSettingsBtn');
  if (gear) {
    const gearHit = await clickVisibleCenter(page, '#mobSettingsBtn');
    R(id, 'mob: ⚙ hit-target', !!gearHit && gearHit.visible && gearHit.hit, JSON.stringify(gearHit));
    if (gearHit && gearHit.visible && gearHit.hit) {
      await page.waitForFunction(() => document.querySelector('#gillSettingsOverlay')?.classList.contains('is-open'), null, { timeout: 8000 });
    }
    await page.waitForTimeout(450);
'''
if text.count(old_mobile) != 1:
    raise SystemExit(f'mobile click block count={text.count(old_mobile)}')
text = text.replace(old_mobile, new_mobile, 1)

path.write_text(text, encoding='utf-8')
print('patched engine sweep pointer witnesses')
