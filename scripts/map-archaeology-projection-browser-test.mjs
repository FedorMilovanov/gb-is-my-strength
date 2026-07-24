import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from 'playwright';

const browserName = process.env.MAP_ARCHAEOLOGY_BROWSER || 'chromium';
const browserType = { chromium, firefox, webkit }[browserName];
if (!browserType) throw new Error(`unsupported MAP_ARCHAEOLOGY_BROWSER=${browserName}`);

const adapter = fs.readFileSync('karty/_engine/map-archaeology-adapter.js', 'utf8');
const projection = {
  schemaVersion: '1.0.0',
  mapId: 'avraam',
  allowedTabs: ['arch', 'sci'],
  byPlace: {
    ur: [{
      claimId: 'ur-ancient-city-context',
      status: 'accepted-context',
      statement: 'Ur supplies the governed archaeological context.',
      limitations: 'No personal Abraham artefact is claimed.',
      evidenceSourceIds: ['field-source'],
      interpretationSourceIds: ['yec-source'],
    }],
    hammam: [{
      claimId: 'tall-el-hammam-airburst-rejected',
      status: 'rejected',
      statement: 'The retracted airburst paper is not positive evidence.',
      limitations: 'Retraction is retained only as negative evidence.',
      evidenceSourceIds: ['retracted-source'],
      interpretationSourceIds: [],
    }],
  },
  sourceMeta: {
    'field-source': {
      id: 'field-source',
      title: 'Excavation report',
      organization: 'Museum',
      url: 'https://example.test/report',
      year: 2025,
      accessedAt: '2026-07-24',
      status: 'active',
      verification: 'verified',
      evidenceUse: 'high',
      perspective: 'academic',
    },
    'yec-source': {
      id: 'yec-source',
      title: 'YEC chronology analysis',
      organization: 'Research journal',
      url: 'https://example.test/interpretation',
      year: 2012,
      accessedAt: '2026-07-24',
      status: 'active',
      verification: 'verified',
      evidenceUse: 'interpretation',
      perspective: 'yec',
    },
    'retracted-source': {
      id: 'retracted-source',
      title: 'Retraction notice',
      organization: 'Journal',
      url: 'javascript:alert(1)',
      year: 2025,
      accessedAt: '2026-07-24',
      status: 'retracted',
      verification: 'verified',
      evidenceUse: 'negative',
      perspective: 'academic',
    },
  },
};

const browser = await browserType.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.message));

await page.route('https://example.test/karty/avraam/**', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: `<!doctype html><html><head></head><body>
      <div id="map-archaeology-projection" hidden></div>
      <div id="stage">
        <div class="me-tabs">
          <button class="me-tab me-tab--active" data-tab="story">Story</button>
          <button class="me-tab" data-tab="arch">Arch</button>
          <button class="me-tab" data-tab="sci">Science</button>
        </div>
        <div class="me-content"><p>Story body</p><div class="me-arch-footer">legacy</div></div>
      </div>
      <script>
        document.getElementById('map-archaeology-projection').dataset.projection = ${JSON.stringify(JSON.stringify(projection))};
        document.querySelectorAll('.me-tab').forEach(function(button){
          button.addEventListener('click', function(){
            document.querySelectorAll('.me-tab').forEach(function(item){ item.classList.remove('me-tab--active'); });
            button.classList.add('me-tab--active');
            document.querySelector('.me-content').innerHTML = '<p>' + button.dataset.tab + ' body</p><div class="me-arch-footer">legacy again</div>';
          });
        });
      </script>
    </body></html>`,
  });
});

await page.goto('https://example.test/karty/avraam/?place=ur');
await page.addScriptTag({ content: adapter });
await page.waitForFunction(() => document.querySelectorAll('.me-arch-footer').length === 0);
assert.equal(await page.locator('[data-archaeology-projection-root]').count(), 0, 'story tab must not receive archaeology projection');

await page.locator('[data-tab="arch"]').click();
await page.waitForSelector('[data-archaeology-projection-root][data-place-id="ur"]');
assert.equal(await page.locator('.me-arch-footer').count(), 0);
assert.equal(await page.locator('[data-claim-id="ur-ancient-city-context"]').count(), 1);
assert.equal(await page.locator('[data-source-id="field-source"][data-evidence-use="high"][data-source-verification="verified"]').count(), 1);
assert.equal(await page.locator('[data-source-id="yec-source"][data-source-perspective="yec"][data-source-verification="verified"]').count(), 1);
assert.equal(await page.locator('[data-source-id="field-source"] a').getAttribute('href'), 'https://example.test/report');
assert.match(await page.locator('[data-source-id="field-source"]').innerText(), /source: field-source/);
assert.match(await page.locator('[data-source-id="field-source"]').innerText(), /проверено 2026-07-24/);

await page.locator('[data-tab="story"]').click();
await page.waitForFunction(() => document.querySelectorAll('[data-archaeology-projection-root], .me-arch-footer').length === 0);

await page.locator('[data-tab="sci"]').click();
await page.waitForSelector('[data-archaeology-projection-root][data-place-id="ur"]');
await page.evaluate(() => {
  history.replaceState(null, '', '/karty/avraam/?place=hammam');
  document.querySelector('.me-content').innerHTML = '<p>new place</p><div class="me-arch-footer">legacy after place change</div>';
});
await page.waitForSelector('[data-claim-id="tall-el-hammam-airburst-rejected"]');
assert.equal(await page.locator('.me-arch-footer').count(), 0);
assert.equal(await page.locator('[data-source-id="retracted-source"] a').count(), 0, 'non-HTTPS source must not become a link');
assert.equal(await page.locator('[data-source-id="retracted-source"][data-evidence-use="negative"][data-source-status="retracted"][data-source-verification="verified"]').count(), 1);
assert.match(await page.locator('[data-source-id="retracted-source"]').innerText(), /source: retracted-source/);
assert.deepEqual(consoleErrors, []);

await browser.close();
console.log(JSON.stringify({ browser: browserName, viewport: '390x844', tabs: ['story', 'arch', 'sci'], consoleErrors: 0 }, null, 2));
