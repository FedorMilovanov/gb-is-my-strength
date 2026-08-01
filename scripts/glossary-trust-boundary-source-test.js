#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const runtime = fs.readFileSync(path.join(ROOT, "js", "glossary.js"), "utf8");
const browserFixture = fs.readFileSync(path.join(ROOT, "scripts", "glossary-security-browser-test.js"), "utf8");

assert.doesNotMatch(runtime, /\binnerHTML\s*=/, "glossary dictionary data must never enter innerHTML");
assert.doesNotMatch(runtime, /\binsertAdjacentHTML\s*\(|\bouterHTML\s*=/, "alternate raw-HTML sinks must remain absent");
assert.match(runtime, /function\s+inline\s*\(/, "runtime must retain the explicit inline allowlist renderer");
assert.match(runtime, /document\.createElement\("em"\)/, "semantic emphasis must be created through DOM APIs");
assert.match(runtime, /document\.createTextNode\(s\.slice\(/, "non-allowlisted markup must remain text");
assert.match(runtime, /brief\.textContent\s*=/, "brief definitions must remain textContent-owned");
assert.match(runtime, /h\.textContent\s*=\s*""/, "legacy tooltip upgrades must clear DOM without innerHTML");

for (const payload of ["<img", "onerror", "<script>", "javascript:"]) {
  assert.ok(browserFixture.includes(payload), `browser fixture must retain adversarial payload: ${payload}`);
}
assert.match(browserFixture, /querySelectorAll\("img,script,a"\)/, "browser fixture must reject forbidden created elements");
assert.match(browserFixture, /querySelectorAll\("\[onerror\],\[onclick\],\[onload\]"\)/, "browser fixture must reject inline event handlers");
assert.match(browserFixture, /emCount,\s*1/, "browser fixture must preserve exactly one allowlisted emphasis element");

console.log("Glossary dictionary trust-boundary source contract passed.");
