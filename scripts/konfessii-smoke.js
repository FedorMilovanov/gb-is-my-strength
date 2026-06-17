const { chromium, devices } = require('playwright');
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:8090';
(async () => {
  const browser = await chromium.launch();
  for (const [label, ctx] of [['DESKTOP',{viewport:{width:1366,height:900}}],['MOBILE',devices['iPhone 12']]]) {
    const page = await (await browser.newContext(ctx)).newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if(m.type()==='error') errs.push('C:'+m.text().slice(0,90)); });
    try {
      await page.goto(`${BASE}/konfessii/russkij-baptizm/`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(5000);
      const r = await page.evaluate(() => {
        const iframe = document.querySelector('#appframe, iframe');
        const loader = document.querySelector('.loader, .app-loader, [class*=loader]');
        const canvas = document.querySelector('iframe')?.contentDocument?.querySelector('canvas');
        return {
          iframeExists: !!iframe, iframeH: iframe?Math.round(iframe.getBoundingClientRect().height):0,
          loaderVisible: loader ? getComputedStyle(loader).display !== 'none' : false,
          overflow: document.documentElement.scrollWidth - window.innerWidth
        };
      });
      console.log(`[${label}] iframeH=${r.iframeH}px, loaderVisible=${r.loaderVisible}, overflow=${r.overflow}px, errors=${errs.length}`);
      if(errs.length) errs.slice(0,3).forEach(e=>console.log('     '+e.slice(0,130)));
    } catch(e) { console.log(`[${label}] ERR: ${e.message.slice(0,90)}`); }
    await page.context().close();
  }
  await browser.close();
})();
