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

function contentType(filePath) {
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function startServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");

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

    console.log("Universal glossary browser contract passed, including Gill Part I residuals.");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});