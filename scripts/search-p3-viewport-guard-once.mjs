#!/usr/bin/env node
import fs from 'node:fs';

const file = 'scripts/search-modal-browser-contract.mjs';
const write = process.argv.includes('--write');

function count(text, needle) {
  return text.split(needle).length - 1;
}

function once(text, needle, replacement, label) {
  const found = count(text, needle);
  if (found !== 1) {
    throw new Error(`[search-p3-viewport] ${label}: expected exactly 1 match, got ${found}`);
  }
  return text.replace(needle, replacement);
}

function transform(source) {
  if (!source.includes("assert.deepEqual(page.viewportSize(), viewport, 'continuation fixture must use requested viewport');")) {
    source = once(
      source,
      "    const page = await context.newPage();\n    activePage = page;",
      "    const page = await context.newPage();\n    assert.deepEqual(page.viewportSize(), viewport, 'continuation fixture must use requested viewport');\n    activePage = page;",
      'assert actual continuation viewport',
    );
  }

  source = once(
    source,
    "      });\n      await input.fill('fixture-pagefind');",
    "      }, viewport);\n      await input.fill('fixture-pagefind');",
    'Pagefind fixture receives matrix viewport',
  );

  source = once(
    source,
    "      });\n      await input.fill('fixturefallback');",
    "      }, viewport);\n      await input.fill('fixturefallback');",
    'fallback fixture receives matrix viewport',
  );

  source = once(
    source,
    "      });\n      await input.fill('stalerace');",
    "      }, viewport);\n      await input.fill('stalerace');",
    'Scripture fixture receives matrix viewport',
  );

  return source;
}

function validate(source) {
  const required = [
    "assert.deepEqual(page.viewportSize(), viewport, 'continuation fixture must use requested viewport');",
    "await input.fill('fixture-pagefind');",
    "await input.fill('fixturefallback');",
    "await input.fill('stalerace');",
    "continuationDesktopMobile: true",
    "runContinuationContract(browserType, browserName, port, viewport)",
  ];
  for (const marker of required) {
    if (!source.includes(marker)) throw new Error(`[search-p3-viewport] missing final marker: ${marker}`);
  }

  for (const [needle, label] of [
    ["      });\n      await input.fill('fixture-pagefind');", 'Pagefind default viewport leak'],
    ["      });\n      await input.fill('fixturefallback');", 'fallback default viewport leak'],
    ["      });\n      await input.fill('stalerace');", 'Scripture default viewport leak'],
  ]) {
    if (source.includes(needle)) throw new Error(`[search-p3-viewport] ${label} survived`);
  }

  const viewportCalls = count(source, '}, viewport);');
  if (viewportCalls < 4) {
    throw new Error(`[search-p3-viewport] expected at least four explicit matrix viewport fixture calls, got ${viewportCalls}`);
  }
}

let source = fs.readFileSync(file, 'utf8');
if (write) {
  source = transform(source);
  validate(source);
  fs.writeFileSync(file, source);
  console.log('[search-p3-viewport] applied');
} else {
  validate(source);
  console.log('[search-p3-viewport] final contract OK');
}
