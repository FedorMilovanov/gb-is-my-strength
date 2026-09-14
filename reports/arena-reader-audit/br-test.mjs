import { chromium } from 'playwright';
import sparticuz from '@sparticuz/chromium';
const exe = process.env.CHROME_EXE || '/home/user/.cache/chromium-sp/headless_shell';
console.log('exe:', exe);
const browser = await chromium.launch({
  executablePath: exe,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu',
         '--no-zygote','--single-process','--font-render-hinting=none','--hide-scrollbars'],
});
console.log('launched, version:', browser.version());
const page = await browser.newPage({ viewport:{width:1280,height:800} });
await page.setContent('<h1 id=t>Привет, браузер</h1><p style="width:300px">x</p>');
console.log('title text:', await page.textContent('#t'));
console.log('h1 box:', await page.$eval('#t', e=>JSON.stringify(e.getBoundingClientRect())));
await page.screenshot({ path:'reports/arena-reader-audit/shot-test.png' });
console.log('screenshot ok');
await browser.close();
