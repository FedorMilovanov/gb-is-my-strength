#!/usr/bin/env node
'use strict';

// Exercise the actual visible article share trigger in Chromium/WebKit.
// Only platform APIs are mocked: the reader action handler and DOM are real.
// The legacy throw case is a red witness on Product main before its cleanup fix.
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');

const BASE = String(process.env.AUDIT_BASE || 'https://gospod-bog.ru').replace(/\/$/, '');
const ARTICLE = '/articles/dzhon-gill-chast-1-chelovek/';
const BROWSERS = String(process.env.GB_SHARE_BROWSERS || 'chromium,webkit').split(',').map(x => x.trim()).filter(Boolean);
const VIEWPORTS = [
  { label: 'desktop', width: 1280, height: 900 },
  { label: 'mobile', width: 390, height: 850 },
  { label: 'wide-desktop', width: 1440, height: 900 },
];
const OWNER_WIDTHS = [390,1120,1121,1280,1359,1360,1440];
const PROBE_ONLY = process.env.GB_SHARE_OWNER_PROBE === '1';
const CASES = [
  { api: 'webShare', outcome: 'success', status: 'shared' },
  { api: 'webShare', outcome: 'cancel', status: null },
  { api: 'webShare', outcome: 'reject', status: 'failed' },
  { api: 'clipboard', outcome: 'success', status: 'copied' },
  { api: 'clipboard', outcome: 'reject', status: 'failed' },
  { api: 'legacy', outcome: 'true', status: 'copied' },
  { api: 'legacy', outcome: 'false', status: 'failed' },
  { api: 'legacy', outcome: 'throw', status: 'failed' },
  { api: 'legacy', outcome: 'selectThrow', status: 'failed' },
];

async function installPlatformOutcomes(page, test) {
  await page.evaluate(({ api, outcome }) => {
    window.__gbShareOutcomeCalls = [];
    if (window.SiteUtils && typeof window.SiteUtils.copyText === 'function') {
      // The native reader must use its own documented fallback owner here.
      // A newly introduced shared copy delegate belongs in a separate test.
      throw new Error('Unexpected SiteUtils.copyText delegate on Gill article');
    }
    const fault = (kind) => {
      const error = new Error('share browser contract: ' + kind);
      if (kind === 'cancel') error.name = 'AbortError';
      throw error;
    };
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    if (api === 'webShare') {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async payload => {
          window.__gbShareOutcomeCalls.push({ api: 'webShare', value: payload?.url });
          if (outcome === 'cancel' || outcome === 'reject') fault(outcome);
        },
      });
    } else if (api === 'clipboard') {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async value => {
            window.__gbShareOutcomeCalls.push({ api: 'clipboard', value });
            if (outcome === 'reject') fault(outcome);
          },
        },
      });
    } else if (api === 'legacy') {
      document.execCommand = (command) => {
        window.__gbShareOutcomeCalls.push({ api: 'legacy', value: command });
        if (outcome === 'throw') fault(outcome);
        return outcome === 'true';
      };
      if (outcome === 'selectThrow') {
        HTMLTextAreaElement.prototype.select = () => fault('select');
      }
    } else {
      throw new Error('Unsupported platform outcome mode: ' + api);
    }
  }, test);
}

async function openArticle(page, identifier) {
  const response = await page.goto(BASE + ARTICLE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  assert.equal(response?.status(), 200, identifier + ': article HTTP');
  await page.waitForFunction(() => window.GBReaderActions?.version === 1, null, { timeout: 18000 });
  const admitted = await page.evaluate(() => Boolean(document.querySelector('[data-gb-reader-desktop-bootstrap]')));
  const width = page.viewportSize().width;
  if (admitted && width >= 1121) {
    await page.waitForFunction(() => document.body.classList.contains('np-w57-ready') &&
      !!window.__NP_UNIVERSAL_PREVIEW__?.ready && !!window.__NP_W57_ANNOTATIONS__?.ready,
      null, { timeout: 18000 });
    assert.equal(new URL(page.url()).searchParams.get('reader-pilot'), null, identifier + ': no fallback/Classic substitution');
  }
  await page.evaluate(() => document.fonts.ready);
}

async function ownerSnapshot(page) {
  return page.evaluate(() => {
    const classify = node => {
      const r = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const visible = !!node.getClientRects().length && r.width > 0 && r.height > 0 &&
        style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > .01;
      const excluded = !!node.closest('[hidden],[inert],[aria-hidden="true"]');
      const inViewport = r.left >= -.5 && r.top >= -.5 && r.right <= innerWidth + .5 && r.bottom <= innerHeight + .5;
      const hit = visible && inViewport && node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
      return {action:node.dataset.action, name:node.getAttribute('aria-label')||node.title||node.textContent.trim(),
        className:node.className, parent:node.parentElement?.className, visible, excluded, disabled:node.disabled,
        inViewport, hit, x:r.x,y:r.y,w:r.width,h:r.height,
        direct:visible&&!excluded&&!node.disabled&&inViewport&&hit};
    };
    const rows=[...document.querySelectorAll('button[data-action="share"],button[data-action="print"]')].map(classify);
    return {width:innerWidth,argon:document.body.classList.contains('np-w57-ready'),url:location.href,
      overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth),rows,
      share:rows.filter(x=>x.action==='share'&&x.direct).length,
      print:rows.filter(x=>x.action==='print'&&x.direct).length};
  });
}

async function getAction(page, action, identifier) {
  // Do not select a class or the first hidden copy. Resolve the one enabled
  // and hit-testable control in the actual active presentation.
  let result;
  try {
    result=await page.waitForFunction(action=>{
      const live=[...document.querySelectorAll('button[data-action="'+action+'"]')].filter(node=>{
        const r=node.getBoundingClientRect(),style=getComputedStyle(node);
        return !node.disabled&&!node.closest('[hidden],[inert],[aria-hidden="true"]')&&
          style.visibility!=='hidden'&&style.display!=='none'&&Number(style.opacity)>.01&&
          r.width>0&&r.height>0&&r.left>=-.5&&r.top>=-.5&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5&&
          node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
      });
      return live.length===1?live[0]:false;
    },action,{timeout:12000});
  } catch(error) {
    throw new Error(identifier+': '+action+' unique live owner not found '+JSON.stringify(await ownerSnapshot(page)));
  }
  const button=result.asElement();
  assert.ok(button,identifier+': live action element');
  // Retain the previous stability contract, with the native compact footer's
  // existing 32px geometry distinguished from the 40px mobile/narrow target.
  await button.evaluate(async target=>{
    const nativeWide=matchMedia('(min-width:1360px)').matches&&!!target.closest('.gbs-rail-foot');
    const minimum=nativeWide?31.5:40;
    await new Promise((resolve,reject)=>{
      let previous=null,stable=0,ticks=0;
      const sample=()=>{
        const r=target.getBoundingClientRect();
        const ready=target.isConnected&&r.width>=minimum&&r.height>=minimum&&
          r.top>=-.5&&r.left>=-.5&&r.bottom<=innerHeight+.5&&r.right<=innerWidth+.5&&
          !target.closest('[hidden],[inert],[aria-hidden="true"]')&&
          target.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
        const same=ready&&previous&&Math.abs(r.top-previous.top)<.2&&Math.abs(r.left-previous.left)<.2&&Math.abs(r.width-previous.width)<.2;
        stable=same?stable+1:0;previous=ready?{top:r.top,left:r.left,width:r.width}:null;
        if(stable>=8)return resolve();
        if(++ticks>300)return reject(new Error('Action target never stabilized in viewport'));
        requestAnimationFrame(sample);
      };requestAnimationFrame(sample);
    });
  });
  return button;
}

// Diagnostic mode records the exact current owner, without altering the
// product or substituting a comparison URL. Used before a gate repair.
async function probeOwner(browser, browserName, width) {
  const identifier=browserName+'/owner/'+width;
  const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
  try {
    await openArticle(page,identifier);
    const snapshot=await ownerSnapshot(page);
    console.log('OWNER '+identifier+' '+JSON.stringify(snapshot));
    return {identifier,pass:snapshot.share===1&&snapshot.print===1&&snapshot.overflow===0,snapshot};
  } catch(error) {
    return {identifier,pass:false,reason:String(error.message)};
  } finally {await page.close();}
}

async function checkPrint(browser,browserName,width) {
  const identifier=browserName+'/print/'+width;
  const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
  try {
    await openArticle(page,identifier);
    const button=await getAction(page,'print',identifier);
    // Only stub the OS dialog. The production capture handler, print
    // preparation and cleanup remain the actual Reader implementation.
    await page.evaluate(()=>{window.__gbNativePrintCalls=0;window.print=()=>{window.__gbNativePrintCalls++;};});
    await button.click({timeout:12000});
    await page.waitForFunction(()=>window.__gbNativePrintCalls===1);
    const receipt=await page.evaluate(()=>({calls:window.__gbNativePrintCalls,report:window.GBPrintEngine.getReport()}));
    assert.equal(receipt.calls,1,identifier+': exactly one native dialog request');
    assert.equal(receipt.report?.prepared,true,identifier+': canonical print prepared');
    assert.equal(receipt.report?.source,'button',identifier+': actual button dispatch');
    await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
    assert.equal(await page.evaluate(()=>window.GBPrintEngine.getReport()),null,identifier+': native afterprint cleanup');
    console.log('PASS '+identifier+' canonical print request (OS dialog stubbed)');
    return {identifier,pass:true};
  } catch(error) {
    console.error('FAIL '+identifier+' '+String(error.message).slice(0,1500));
    return {identifier,pass:false,reason:String(error.message)};
  } finally {await page.close();}
}

async function checkOne(browser, browserName, viewport, test) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  const identifier = [browserName, viewport.label, test.api, test.outcome].join('/');
  try {
    await openArticle(page, identifier);
    const button = await getAction(page, 'share', identifier);
    const baseline = await page.locator('textarea').count();
    await installPlatformOutcomes(page, test);
    await button.click({ timeout: 12000 });

    if (test.status) {
      await page.waitForFunction(
        ({target,expected}) => target.isConnected && target.dataset.shareStatus === expected,
        {target:button,expected:test.status}, { timeout: 6000 },
      );
    } else {
      // AbortError deliberately leaves the trigger unchanged: no false failure
      // or false success feedback. The abort is resolved asynchronously.
      await page.waitForTimeout(160);
    }
    const status = await button.getAttribute('data-share-status');
    assert.equal(status, test.status, identifier + ': truthful status');

    const remaining = await page.locator('textarea').count();
    assert.equal(remaining, baseline, identifier + ': no leaked temporary textarea');

    const calls = await page.evaluate(() => window.__gbShareOutcomeCalls);
    const expectedCalls = test.outcome === 'selectThrow' ? 0 : 1;
    assert.equal(calls.length, expectedCalls, identifier + ': platform call count');
    if (calls.length && test.api === 'legacy') {
      assert.equal(calls[0].value, 'copy', identifier + ': legacy command');
    } else if (calls.length) {
      assert.equal(calls[0].value, page.url(), identifier + ': supplied URL');
    }

    if (test.status === 'copied' || test.status === 'failed') {
      const toast = page.locator('.gb-fc-toast span').first();
      await toast.waitFor({ state: 'attached', timeout: 3000 });
      const message = (await toast.textContent()) || '';
      if (test.status === 'copied') assert.equal(message.trim(), 'Ссылка скопирована', identifier + ': copy success copy');
      else assert.match(message, /Не удалось/, identifier + ': failure feedback');
    } else {
      const toast = await page.locator('.gb-fc-toast.is-open').count();
      assert.equal(toast, 0, identifier + ': no false toast on native share/cancel');
    }
    console.log('PASS ' + identifier + ' status=' + (status || 'unset'));
    return { identifier, status, pass: true };
  } catch (error) {
    console.error('FAIL ' + identifier + ': ' + String(error.message).slice(0, 800));
    return { identifier, pass: false, reason: String(error.message).slice(0, 800) };
  } finally {
    await page.close();
  }
}

(async () => {
  const results = [];
  for (const name of BROWSERS) {
    const engine = { chromium, webkit }[name];
    if (!engine) throw new Error('Unsupported browser: ' + name);
    const browser = await engine.launch({ headless: true });
    try {
      for (const width of OWNER_WIDTHS) results.push(await probeOwner(browser,name,width));
      if (!PROBE_ONLY) {
        for (const viewport of VIEWPORTS) {
          for (const test of CASES) results.push(await checkOne(browser,name,viewport,test));
        }
        for (const width of OWNER_WIDTHS) results.push(await checkPrint(browser,name,width));
      }
    } finally {
      await browser.close();
    }
  }
  const passed = results.filter(result => result.pass).length;
  console.log((PROBE_ONLY?'Reader action owner diagnostic':'Reader share/print browser outcome contract') + ': ' + passed + '/' + results.length + ' PASS');
  if (passed !== results.length) {
    console.error('Failing cases: ' + JSON.stringify(results.filter(result => !result.pass)));
    process.exitCode = 1;
  }
})().catch(error => {
  console.error('Reader share browser contract setup failed', error);
  process.exitCode = 1;
});
