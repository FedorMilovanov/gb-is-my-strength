#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "..");
const normalizer = path.join(
  repositoryRoot,
  "scripts",
  "glossary-placement-normalizer.js"
);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "glossary-normalizer-"));

try {
  fs.mkdirSync(path.join(tempRoot, "data"), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, "src"), { recursive: true });

  fs.writeFileSync(
    path.join(tempRoot, "data", "glossary-policy.json"),
    JSON.stringify(
      {
        placementForbiddenSelectors: [
          ".summary-card",
          ".note-box",
          ".reading-list",
          "table",
          "nav"
        ]
      },
      null,
      2
    )
  );

  const fixturePath = path.join(tempRoot, "src", "fixture.astro");
  fs.writeFileSync(
    fixturePath,
    [
      '<p>Разрешённый <span class="gterm" tabindex="0">термин<span class="gtip"><strong>Полное</strong> определение</span></span>.</p>',
      '<section class="summary-card"><p>Краткий <span class="gterm" tabindex="0">термин<span class="gtip">Определение</span></span>.</p></section>',
      '<div class="reading-list"><p>Список: <abbr class="gterm" data-term="термин">термин<span class="gtip"><span>Определение</span></span></abbr>.</p></div>',
      '<nav><span class="gterm">навигация<span class="gtip">Скрыто</span></span></nav>'
    ].join("\n")
  );

  const check = spawnSync(process.execPath, [normalizer], {
    cwd: tempRoot,
    encoding: "utf8"
  });
  assert.equal(check.status, 1, "check mode must report pending changes");
  assert.match(check.stdout, /WOULD FIX: src\/fixture\.astro/);

  const write = spawnSync(process.execPath, [normalizer, "--write"], {
    cwd: tempRoot,
    encoding: "utf8"
  });
  assert.equal(write.status, 0, write.stderr || write.stdout);
  assert.match(write.stdout, /FIXED: src\/fixture\.astro/);

  const output = fs.readFileSync(fixturePath, "utf8");
  assert.match(
    output,
    /<p>Разрешённый <span class="gterm"[^>]*>термин<span class="gtip">/,
    "normal prose glossary markup must remain"
  );
  assert.match(output, /<section class="summary-card"><p>Краткий термин\.<\/p><\/section>/);
  assert.match(output, /<div class="reading-list"><p>Список: термин\.<\/p><\/div>/);
  assert.match(output, /<nav>навигация<\/nav>/);
  assert.doesNotMatch(
    output.split('<section class="summary-card">')[1],
    /class="gterm"|class="gtip"/,
    "forbidden containers must contain no glossary payload"
  );

  const cleanCheck = spawnSync(process.execPath, [normalizer], {
    cwd: tempRoot,
    encoding: "utf8"
  });
  assert.equal(cleanCheck.status, 0, cleanCheck.stderr || cleanCheck.stdout);
  assert.match(cleanCheck.stdout, /source tree is clean/);

  console.log("Universal glossary placement normalizer test passed.");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
