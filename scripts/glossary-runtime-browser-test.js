#!/usr/bin/env node
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");

function fillerParagraph(index) {
  const words = Array.from(
    { length: 65 },
    (_, wordIndex) => `слово${index}_${wordIndex}`
  ).join(" ");
  return `<p class="reveal">${words}</p>`;
}

function fixtureHtml() {
  const firstGap = Array.from({ length: 21 }, (_, index) =>
    fillerParagraph(index)
  ).join("");

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Universal glossary contract fixture</title>
  <style>.gtip { display: none; }</style>
</head>
<body>
  <article data-pagefind-body>
    <section class="summary-card">
      <p id="summary">Диссентеры находятся в краткой карточке.</p>
    </section>

    <div class="note-box">
      <p id="note">В примечании стоит ручной
        <abbr class="gterm" data-term="диссентер">диссентер<span class="gtip">ошибочное определение</span></abbr>.
      </p>
    </div>

    <p class="reveal" id="first">Первый диссентер получает определение.</p>
    <p class="reveal" id="close">Ближайшие диссентеров не должны повторять тултип.</p>

    ${firstGap}

    <p class="reveal" id="far">Позднее слово диссентерами снова получает определение.</p>
  </article>

  <script>
    window.SiteUtils = {
      initGlossaryTooltips(root) {
        root.querySelectorAll('.gterm').forEach((term) => {
          term.dataset.tooltipReady = '1';
        });
      }
    };
  </script>
  <script src="/js/glossary.js"></script>
</body>
</html>`;
}

function gillFixtureHtml() {
  const cadenceGap = Array.from({ length: 21 }, (_, index) =>
    fillerParagraph(`gill_${index}`)
  ).join("");

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Gill Part I glossary residual fixture</title>
  <style>.gtip { display: none; }</style>
</head>
<body>
  <article data-pagefind-body>
    <p class="reveal" id="gill-horsley-first">
      В 1719 году церковь в Хорслидаун пригласила Джона Гилла проповедовать.
      <span id="gill-southwark-first">Саутварк</span> остаётся географическим контекстом, а не glossary-term.
    </p>

    ${cadenceGap}

    <p class="reveal" id="gill-horsley-far">
      Поздний контекст снова называет Хорслидаун в
      <span id="gill-southwark-far">Саутварке</span>, а погребение в
      <span id="gill-bunhill">Bunhill Fields</span> отмечает нонконформистскую принадлежность.
    </p>
  </article>

  <script>
    window.SiteUtils = {
      initGlossaryTooltips(root) {
        root.querySelectorAll('.gterm').forEach((term) => {
          term.dataset.tooltipReady = '1';
        });
      }
    };
  </script>
  <script src="/js/glossary.js"></script>
</body>
</html>`;
}


function portalFixtureHtml(modern) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="/css/site.css">
  <style>article { margin: 120px auto; width: min(700px, 86vw); } body { min-height: 140vh; }</style>
  </head><body><article data-pagefind-body><p class="reveal">
  <span id="portal-term" class="gterm" tabindex="0" data-term="песнь песней" data-term-title="Песнь песней">Песнь песней<span class="gtip">Локальное определение.</span></span>
  </p><p><span id="portal-footnote" class="fn-marker" tabindex="0">1<span class="tooltip">Источник.</span></span></p>
  ${modern ? '<p><span id="registry-footnote" class="fn-marker" tabindex="0" data-note-id="qa-note" aria-describedby="qa-endnote" aria-controls="qa-tip">2<span id="qa-tip" class="tooltip">Канонический источник.</span></span></p><p><span id="shared-description" class="gterm" tabindex="0" aria-describedby="qa-independent">Термин<span id="qa-transient" class="gtip">Определение.</span></span></p><span id="qa-independent">Авторское пояснение.</span><ol data-note-registry-endnotes><li id="qa-endnote" data-note-id="qa-note">Канонический источник.</li></ol>' : ''}</article>
  <script>window.SITE_CONFIG={site:{name:'Fixture',baseUrl:'/',locale:'ru'},page:{type:'article',id:'glossary-portal-fixture',title:'Fixture'},features:{toc:false,share:false,quiz:{enabled:false}}};</script>
  <script src="/js/site-utils.js"></script><script src="/js/site.js"></script>
  <script type="module">
  ${modern ? "const { installArticleTooltips } = await import('/src/runtime/article-tooltips.js'); installArticleTooltips();" : ""}
  const script=document.createElement('script');script.src='/js/glossary.js';
  script.onload=()=>{window.portalFixtureReady=true;};document.head.append(script);
  </script></body></html>`;
}

function contentType(filePath) {
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function startServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");

    if (url.pathname === "/portal-fixture/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end(portalFixtureHtml(url.searchParams.get("modern") === "1"));
      return;
    }

    if (url.pathname === "/fixture/") {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      });
      response.end(fixtureHtml());
      return;
    }

    if (url.pathname === "/gill-fixture/") {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      });
      response.end(gillFixtureHtml());
      return;
    }

    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const filePath = path.resolve(ROOT, relativePath);

    if (!filePath.startsWith(ROOT + path.sep) || !fs.existsSync(filePath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "content-type": contentType(filePath),
      "cache-control": "no-store"
    });
    fs.createReadStream(filePath).pipe(response);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        origin: `http://127.0.0.1:${address.port}`
      });
    });
  });
}


async function portalAssertions(browser, origin, modern, mobile) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: mobile, hasTouch: mobile
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/data/glossary.json', async route => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto(origin + '/portal-fixture/?modern=' + Number(modern), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.portalFixtureReady === true);
    const anchor = page.locator('#portal-term');
    const label = (modern ? 'modern' : 'legacy') + '/' + (mobile ? 'mobile' : 'desktop');
    if (mobile) await anchor.tap(); else await anchor.click();
    await page.waitForFunction(() => document.querySelector('#portal-term')?.getAttribute('aria-expanded') === 'true');
    const original = await page.evaluate(() => {
      const anchor = document.querySelector('#portal-term');
      const tip = document.getElementById(anchor.getAttribute('aria-describedby'));
      window.portalWitness = { tip, heading: tip?.querySelector('.gtip-luxury__title'), close: tip?.querySelector('[data-tooltip-close]') };
      return { id: tip?.id, portaled: tip?.parentElement === document.body, heading: window.portalWitness.heading?.textContent };
    });
    assert.ok(original.id && original.portaled, label + ': original tooltip must be portaled');
    assert.equal(original.heading, 'Песнь песней', label + ': initial static title');
    release();
    await page.waitForFunction(() => document.querySelector('#portal-term')?.dataset.termTitle === 'Песнь Песней');
    await page.evaluate(() => window.SiteUtils.hydrateGlossaryTerms(document.querySelector('article')));
    const hydrated = await page.evaluate(() => {
      const anchor = document.querySelector('#portal-term');
      const { tip, heading, close } = window.portalWitness;
      return {
        sameTip: window.SiteUtils.getGlossaryTip(anchor) === tip,
        sameHeading: tip.querySelector('.gtip-luxury__title') === heading,
        sameClose: tip.querySelector('[data-tooltip-close]') === close,
        title: heading.textContent, brief: tip.querySelector('.gtip-brief')?.textContent,
        detail: !!tip.querySelector('.gtip-detail'),
        expanded: anchor.getAttribute('aria-expanded'),
        described: anchor.getAttribute('aria-describedby'),
        duplicate: anchor.querySelectorAll('.gtip').length,
        portaled: tip.parentElement === document.body,
        idCount: [...document.querySelectorAll('[id]')].filter(el => el.id === tip.id).length,
        inert: tip.hasAttribute('inert')
      };
    });
    assert.deepEqual(hydrated, {
      sameTip:true,sameHeading:true,sameClose:true,title:'Песнь Песней',brief:'Локальное определение.',
      detail:true,expanded:'true',described:original.id,duplicate:0,portaled:true,idCount:1,inert:false
    }, label + ': delayed and repeated dictionary hydration must preserve the active identity');
    const expand = page.locator('body > .gtip [data-gtip-expand]');
    await expand.click();
    assert.equal(await expand.getAttribute('aria-expanded'), 'true', label + ': expand works after late hydration');
    await expand.click();
    assert.equal(await expand.getAttribute('aria-expanded'), 'false', label + ': collapse works after late hydration');
    await page.locator('body > .gtip [data-tooltip-close]').click();
    await page.waitForFunction(() => document.querySelector('#portal-term')?.getAttribute('aria-expanded') === 'false');
    assert.equal(await page.evaluate(() => document.querySelector('#portal-term .gtip') === window.portalWitness.tip), true, label + ': close restores the same node');
    if (modern && !mobile) {
      await anchor.click();
      await anchor.press('Enter');
      assert.equal(await anchor.getAttribute('aria-expanded'), 'true', label + ': click-to-keyboard transition retains tip');
      await anchor.press('Enter');
      assert.equal(await anchor.getAttribute('aria-expanded'), 'false', label + ': second Enter closes');
      const footnote = page.locator('#portal-footnote');
      await footnote.focus();
      await page.waitForFunction(() => document.querySelector('#portal-footnote')?.getAttribute('aria-expanded') === 'true');
      await footnote.press('Space');
      assert.equal(await footnote.getAttribute('aria-expanded'), 'true', label + ': footnote focus-to-keyboard');
      await footnote.press('Space');
      assert.equal(await footnote.getAttribute('aria-expanded'), 'false', label + ': second Space closes footnote');
    }
    if (modern) {
      const note=page.locator('#registry-footnote');
      assert.equal(await note.getAttribute('aria-describedby'),'qa-endnote',label+': authored endnote survives initialization');
      await note.click();
      await page.waitForFunction(()=>document.querySelector('#registry-footnote').getAttribute('aria-expanded')==='true');
      assert.equal(await note.getAttribute('aria-describedby'),'qa-endnote',label+': canonical note is not announced twice');
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>document.querySelector('#registry-footnote').getAttribute('aria-expanded')==='false');
      assert.equal(await note.getAttribute('aria-describedby'),'qa-endnote',label+': authored endnote survives close');
      const term=page.locator('#shared-description');
      await term.click();
      await page.waitForFunction(()=>document.querySelector('#shared-description').getAttribute('aria-expanded')==='true');
      assert.equal(await term.getAttribute('aria-describedby'),'qa-independent qa-transient');
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>document.querySelector('#shared-description').getAttribute('aria-expanded')==='false');
      assert.equal(await term.getAttribute('aria-describedby'),'qa-independent',label+': only transient ID is removed');
    }
    assert.deepEqual(errors, [], label + ': page errors');
  } finally {
    release();
    await context.close();
  }
}

(async () => {
  const { server, origin } = await startServer();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto(`${origin}/fixture/`, { waitUntil: "networkidle" });

    await page.waitForFunction(() => {
      const first = document.querySelector("#first .gterm");
      return first && first.dataset.tooltipReady === "1";
    });

    const result = await page.evaluate(() => ({
      firstTerms: document.querySelectorAll("#first .gterm").length,
      closeTerms: document.querySelectorAll("#close .gterm").length,
      farTerms: document.querySelectorAll("#far .gterm").length,
      summaryTerms: document.querySelectorAll("#summary .gterm").length,
      noteTerms: document.querySelectorAll("#note .gterm").length,
      noteTips: document.querySelectorAll("#note .gtip").length,
      noteText: document.querySelector("#note").textContent.replace(/\s+/g, " ").trim(),
      firstCanonical:
        document.querySelector("#first .gterm") &&
        document.querySelector("#first .gterm").dataset.term,
      farCanonical:
        document.querySelector("#far .gterm") &&
        document.querySelector("#far .gterm").dataset.term,
      readyCount: document.querySelectorAll(".gterm[data-tooltip-ready='1']").length,
      totalTerms: document.querySelectorAll(".gterm").length
    }));

    assert.equal(result.firstTerms, 1, "first prose occurrence must hydrate");
    assert.equal(
      result.closeTerms,
      0,
      "nearby occurrence must respect the combined cadence"
    );
    assert.equal(
      result.farTerms,
      1,
      "distant occurrence must hydrate after word and block thresholds"
    );
    assert.equal(
      result.summaryTerms,
      0,
      "summary cards must never receive glossary markup"
    );
    assert.equal(
      result.noteTerms,
      0,
      "manual glossary markup in a forbidden block must become plain text"
    );
    assert.equal(
      result.noteTips,
      0,
      "forbidden blocks must not retain hidden definition payloads"
    );
    assert.match(
      result.noteText,
      /диссентер/,
      "normalization must preserve visible prose"
    );
    assert.equal(result.firstCanonical, "диссентер");
    assert.equal(
      result.farCanonical,
      "диссентер",
      "Russian inflection must resolve to the canonical entry"
    );
    assert.equal(
      result.readyCount,
      result.totalTerms,
      "all hydrated terms must enter the shared tooltip initializer"
    );

    await page.goto(`${origin}/gill-fixture/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => {
      const first = document.querySelector("#gill-horsley-first .gterm");
      const far = document.querySelector("#gill-horsley-far .gterm");
      const bunhill = document.querySelector("#gill-bunhill .gterm");
      return Boolean(
        first && far && bunhill &&
        first.dataset.tooltipReady === "1" &&
        far.dataset.tooltipReady === "1" &&
        bunhill.dataset.tooltipReady === "1"
      );
    });

    const gill = await page.evaluate(() => {
      const runtime = window.__gbGlossaryRuntime;
      const label = (node) => Array.from(node.childNodes)
        .filter((child) => child.nodeType === Node.TEXT_NODE)
        .map((child) => child.textContent || "")
        .join("")
        .trim();
      const terms = Array.from(document.querySelectorAll("article .gterm"));
      const horsleydown = terms
        .filter((node) => label(node) === "Хорслидаун")
        .map((node) => node.dataset.term);
      return {
        horsleydown,
        bunhill: document.querySelector("#gill-bunhill .gterm")?.dataset.term || null,
        southwarkTerms:
          document.querySelectorAll("#gill-southwark-first .gterm, #gill-southwark-far .gterm").length,
        horsleydownEnglishAlias: runtime?.aliasAll?.horsleydown || null,
        southwarkAlias: runtime?.aliasAll?.["саутварк"] || null,
        readyCount: document.querySelectorAll(".gterm[data-tooltip-ready='1']").length,
        totalTerms: document.querySelectorAll(".gterm").length
      };
    });

    assert.deepEqual(
      gill.horsleydown,
      ["хорслидаун", "хорслидаун"],
      "Gill Part I residual must hydrate two cadence-separated Horsleydown occurrences"
    );
    assert.equal(
      gill.bunhill,
      "банхилл-филдс",
      "visible English Bunhill Fields must resolve to the canonical Cyrillic entry"
    );
    assert.equal(
      gill.horsleydownEnglishAlias,
      "хорслидаун",
      "English Horsleydown alias must remain mapped to the canonical Gill entry"
    );
    assert.equal(
      gill.southwarkTerms,
      0,
      "Gill repair must not over-broaden Southwark into a glossary trigger"
    );
    assert.equal(gill.southwarkAlias, null, "Southwark must remain outside the glossary alias map");
    assert.equal(
      gill.readyCount,
      gill.totalTerms,
      "all Gill residual terms must enter the shared tooltip initializer"
    );
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);

    for (const modern of [false, true]) for (const mobile of [false, true]) await portalAssertions(browser, origin, modern, mobile);
    console.log("Universal glossary browser contract passed, including Gill Part I residuals and portal hydration.");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});