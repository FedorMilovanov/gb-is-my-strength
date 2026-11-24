import assert from 'node:assert/strict';

// Native-only contracts deliberately exercise the underlying Grok/Classic
// owner. The default desktop presentation is tested separately in W57 QA.
export async function gotoNativeReader(page, href, options) {
  const target = new URL(href);
  target.searchParams.set('reader-pilot', '0');
  const response = await page.goto(target.href, options);
  const state = await page.evaluate(() => ({
    optedOut: new URL(location.href).searchParams.getAll('reader-pilot').join(',') === '0',
    active: [...document.querySelectorAll('link[data-gb-reader-desktop-css]')].some(link => matchMedia(link.media).matches),
    argon: document.body.classList.contains('np-w57-ready') || !!document.getElementById('npUniversalDemo'),
  }));
  assert.deepEqual(state, {optedOut:true,active:false,argon:false}, 'Native Grok fixture must never test ARGON');
  return response;
}
