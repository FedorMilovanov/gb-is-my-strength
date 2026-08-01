#!/usr/bin/env node
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const MALICIOUS_GLOSSARY = {
  "диссентер": {
    definition: "Кратко <img src=x onerror=\"window.__glossaryBriefXss=1\">",
    detail: "До <em>разрешённого акцента</em> после <img src=x onerror=\"window.__glossaryDetailXss=1\"><script>window.__glossaryScriptXss=1</script><a href=\"javascript:window.__glossaryLinkXss=1\">ссылка</a>",
    aliases: ["диссентер", "диссентеры", "диссентеров", "диссентерами"],
    category: "История церкви",
    categorySlug: "church-history"
  }
};

function fixtureHtml() {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Glossary trust-boundary fixture</title>
  <style>.gtip { display: none; }</style>
</head>
<body>
  <article data-pagefind-body>
    <p id="target">Первый диссентер получает определение.</p>
  </article>
  <script>
    window.__glossaryBriefXss = 0;
    window.__glossaryDetailXss = 0;
    window.__glossaryScriptXss = 0;
    window.__glossaryLinkXss = 0;
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

function startServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/fixture/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end(fixtureHtml());
      return;
    }
    if (url.pathname === "/data/glossary.json") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(JSON.stringify(MALICIOUS_GLOSSARY));
      return;
    }
    if (url.pathname === "/data/glossary-policy.json") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(JSON.stringify({ cadence: { minWordGap: 0, minBlockGap: 0, maxPerArticle: 3 } }));
      return;
    }
    if (url.pathname === "/js/glossary.js") {
      const filePath = path.join(ROOT, "js", "glossary.js");
      response.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
      fs.createReadStream(filePath).pipe(response);
      return;
    }
    response.writeHead(404);
    response.end("Not found");
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
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
    await page.waitForFunction(() => document.querySelector("#target .gterm[data-tooltip-ready='1']"));

    const result = await page.evaluate(() => {
      const term = document.querySelector("#target .gterm");
      const brief = term.querySelector(".gtip-brief");
      const detail = term.querySelector(".gtip-papyrus");
      return {
        briefText: brief.textContent,
        detailText: detail.textContent,
        emCount: detail.querySelectorAll("em").length,
        emText: detail.querySelector("em")?.textContent || "",
        forbiddenNodes: term.querySelectorAll("img,script,a").length,
        inlineHandlers: term.querySelectorAll("[onerror],[onclick],[onload]").length,
        flags: [
          window.__glossaryBriefXss,
          window.__glossaryDetailXss,
          window.__glossaryScriptXss,
          window.__glossaryLinkXss
        ]
      };
    });

    assert.match(result.briefText, /<img src=x onerror=/, "brief markup must remain inert visible text");
    assert.equal(result.emCount, 1, "only the allowlisted semantic emphasis may become an element");
    assert.equal(result.emText, "разрешённого акцента");
    assert.match(result.detailText, /<img src=x onerror=/, "forbidden detail markup must remain inert text");
    assert.match(result.detailText, /<script>/, "script markup must remain inert text");
    assert.match(result.detailText, /<a href=/, "link markup must remain inert text");
    assert.equal(result.forbiddenNodes, 0, "dictionary data must not create img/script/a elements");
    assert.equal(result.inlineHandlers, 0, "dictionary data must not create inline event handlers");
    assert.deepEqual(result.flags, [0, 0, 0, 0], "no glossary payload may execute");
    assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join("; ")}`);
    console.log("Glossary trust-boundary browser contract passed.");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
