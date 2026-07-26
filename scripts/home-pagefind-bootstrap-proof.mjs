import assert from 'node:assert/strict';

function isExactPagefindAssetRequest(request, baseUrl) {
  try {
    const url = new URL(request.url());
    return url.origin === baseUrl && url.pathname === '/pagefind/pagefind.js';
  } catch {
    return false;
  }
}

async function closeSearch(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const overlay = document.querySelector('.cp-backdrop');
    return !overlay || getComputedStyle(overlay).display === 'none' || !overlay.classList.contains('open');
  });
}

export async function assertPagefindBootstrap({
  page,
  browserName,
  baseUrl,
  runtimeErrors,
  ignoredDiagnostics,
}) {
  const successfulHeadResponses = new WeakSet();
  let headAbortCount = 0;
  let headResponseCount = 0;
  let moduleLoadCount = 0;

  const observeHeadResponse = (response) => {
    const request = response.request();
    if (
      response.status() >= 200
      && response.status() < 300
      && request.method() === 'HEAD'
      && request.resourceType() === 'fetch'
      && isExactPagefindAssetRequest(request, baseUrl)
    ) {
      successfulHeadResponses.add(request);
      headResponseCount += 1;
    }
  };
  const observeModuleLoad = (request) => {
    if (
      request.method() === 'GET'
      && request.resourceType() === 'script'
      && isExactPagefindAssetRequest(request, baseUrl)
    ) {
      moduleLoadCount += 1;
    }
  };
  const observeFailure = (request) => {
    const diagnostic = `requestfailed: ${request.method()} ${request.url()} — ${request.failure()?.errorText || 'unknown'} (${request.resourceType()})`;
    const knownSuccessfulHeadAbort = browserName === 'chromium'
      && request.method() === 'HEAD'
      && request.resourceType() === 'fetch'
      && isExactPagefindAssetRequest(request, baseUrl)
      && request.failure()?.errorText === 'net::ERR_ABORTED'
      && successfulHeadResponses.has(request);
    if (knownSuccessfulHeadAbort) {
      headAbortCount += 1;
      ignoredDiagnostics.push(diagnostic);
    } else {
      runtimeErrors.push(diagnostic);
    }
  };

  page.on('response', observeHeadResponse);
  page.on('requestfinished', observeModuleLoad);
  page.on('requestfailed', observeFailure);
  try {
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await page.keyboard.press('Meta+K');
    const searchInput = page.locator('.cp-input');
    await searchInput.waitFor({ state: 'visible' });
    assert.equal(
      await searchInput.evaluate((element) => element === document.activeElement),
      true,
      'canonical Meta+K: search input did not receive focus',
    );
    assert.equal(
      await page.locator('.cp-backdrop').count(),
      1,
      'canonical Meta+K: search initialized more than once',
    );
    await page.waitForFunction(() => window.__pagefindReady__ === true || window.__pagefindFailed__ === true);
    const loadState = await page.evaluate(() => ({
      failed: window.__pagefindFailed__ === true,
      ready: window.__pagefindReady__ === true,
    }));
    assert.equal(loadState.failed, false, 'canonical Meta+K: Pagefind bootstrap reported failure');
    assert.equal(loadState.ready, true, 'canonical Meta+K: Pagefind bootstrap did not reach ready state');
    await closeSearch(page);

    assert.equal(headResponseCount, 1, 'Pagefind bootstrap did not receive exactly one successful HEAD response');
    assert.equal(moduleLoadCount, 1, 'Pagefind bootstrap did not finish exactly one module GET');
    assert.ok(headAbortCount <= 1, 'Pagefind bootstrap emitted duplicate successful HEAD aborts');
    return {
      headAborts: headAbortCount,
      headResponses: headResponseCount,
      moduleLoads: moduleLoadCount,
    };
  } finally {
    page.off('response', observeHeadResponse);
    page.off('requestfinished', observeModuleLoad);
    page.off('requestfailed', observeFailure);
  }
}
