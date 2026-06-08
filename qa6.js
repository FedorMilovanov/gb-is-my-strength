const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8080/articles/dzhon-gill-chast-2-uchenyi/', {waitUntil:'load'});
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 4500));
  await page.waitForTimeout(500);
  await page.screenshot({path:'/home/user/shots/check-gill2-marker.png'});
  // Also check FC pill at top
  await page.goto('http://127.0.0.1:8080/articles/dzhon-gill-chast-2-uchenyi/', {waitUntil:'load'});
  await page.waitForTimeout(800);
  await page.screenshot({path:'/home/user/shots/check-gill2-top.png', clip:{x:1200,y:0,width:166,height:200}});
  await browser.close();
})();
