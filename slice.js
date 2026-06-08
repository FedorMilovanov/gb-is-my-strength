const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const targets = [
    'gill-1','/articles/dzhon-gill-chast-1-chelovek/',
    'gill-2','/articles/dzhon-gill-chast-2-uchenyi/',
    'gill-3','/articles/dzhon-gill-chast-3-nasledie/',
    'gill-context','/articles/dzhon-gill-istoricheskiy-kontekst/',
    'gill-handbook','/articles/dzhon-gill-spravochnik/',
  ];
  for (let i=0; i<targets.length; i+=2){
    const name=targets[i], url=targets[i+1];
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8080'+url, {waitUntil:'load'});
    await page.waitForTimeout(1200);
    const docH = await page.evaluate(() => document.body.scrollHeight);
    const steps = Math.min(6, Math.ceil(docH/900));
    for (let s=0; s<steps; s++){
      const y = Math.round((docH-900)*s/(steps-1));
      await page.evaluate((y)=>window.scrollTo(0,y), y);
      await page.waitForTimeout(500);
      await page.screenshot({path:`/home/user/shots/slice-${name}-${s}.png`});
    }
    await page.close();
    console.log('✓',name);
  }
  await browser.close();
})();
