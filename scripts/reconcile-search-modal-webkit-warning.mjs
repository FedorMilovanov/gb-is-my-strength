#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browserTarget = path.join(ROOT, 'scripts/search-modal-browser-contract.mjs');
const homeTarget = path.join(ROOT, 'src/components/home/HomePageChromeStyles.astro');

function replaceOnce(text, before, after, label) {
  const first = text.indexOf(before);
  assert.notEqual(first, -1, `missing exact anchor: ${label}`);
  assert.equal(text.indexOf(before, first + before.length), -1, `non-unique exact anchor: ${label}`);
  return text.slice(0, first) + after + text.slice(first + before.length);
}

let homeText = fs.readFileSync(homeTarget, 'utf8');
homeText = replaceOnce(
  homeText,
  `  body.home-page .cp-scope-chip {
    min-height: 36px;
    padding-inline: 13px;
  }`,
  `  body.home-page .cp-scope-chip {
    min-height: 44px;
    padding-inline: 13px;
  }`,
  'Home scope chip authored touch target',
);
assert.match(
  homeText,
  /body\.home-page \.cp-scope-chip \{\s*min-height: 44px;\s*padding-inline: 13px;/,
  'Home scope chip must retain an explicit 44px minimum',
);
fs.writeFileSync(homeTarget, homeText);

let text = fs.readFileSync(browserTarget, 'utf8');

text = replaceOnce(
  text,
  `  const consoleErrors = [];
  const pageErrors = [];`,
  `  const consoleErrors = [];
  const engineWarnings = [];
  const pageErrors = [];`,
  'engine warning ledger',
);

text = replaceOnce(
  text,
  `  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });`,
  `  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    const expectedWebKitViewportWarning =
      text === 'Viewport argument key "interactive-widget" not recognized and ignored.';
    if (browserName === 'webkit' && expectedWebKitViewportWarning) {
      engineWarnings.push(text);
      return;
    }
    consoleErrors.push(text);
  });`,
  'exact WebKit engine warning classification',
);

text = replaceOnce(
  text,
  `      const chips = [...document.querySelectorAll('.cp-scope-chip')].map((node) => {
        const box = node.getBoundingClientRect();
        return { width: box.width, height: box.height };
      });`,
  `      const chips = [...document.querySelectorAll('.cp-scope-chip')].map((node) => {
        const box = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          width: box.width,
          height: box.height,
          computedHeight: Number.parseFloat(style.height),
          computedMinHeight: Number.parseFloat(style.minHeight),
          boxSizing: style.boxSizing,
        };
      });`,
  'computed 44px chip evidence',
);

text = replaceOnce(
  text,
  `      const chip = document.querySelector('.cp-scope-chip');
      chip?.focus();
      const chipStyle = chip ? getComputedStyle(chip) : null;
      return {
        trigger: rect('#search-modal-contract-trigger'),
        chips,
        outline: chipStyle?.outlineStyle,
        shadow: chipStyle?.boxShadow,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };`,
  `      const chip = document.querySelector('.cp-scope-chip');
      chip?.focus();
      const chipStyle = chip ? getComputedStyle(chip) : null;
      const chipCascade = [];
      const visitRules = (rules, href, context = []) => {
        for (const rule of rules) {
          if (rule.type === CSSRule.STYLE_RULE) {
            let matches = false;
            try { matches = Boolean(chip?.matches(rule.selectorText)); } catch {}
            if (matches && (rule.style.height || rule.style.minHeight || rule.style.minBlockSize)) {
              chipCascade.push({
                href,
                context,
                selector: rule.selectorText,
                height: rule.style.height || null,
                minHeight: rule.style.minHeight || null,
                minBlockSize: rule.style.minBlockSize || null,
                heightPriority: rule.style.getPropertyPriority('height') || null,
                minHeightPriority: rule.style.getPropertyPriority('min-height') || null,
                minBlockSizePriority: rule.style.getPropertyPriority('min-block-size') || null,
                cssText: rule.cssText,
              });
            }
            continue;
          }
          if (!('cssRules' in rule)) continue;
          if (rule.type === CSSRule.MEDIA_RULE && !matchMedia(rule.conditionText).matches) continue;
          const label = rule.conditionText || rule.name || rule.cssText.split('{', 1)[0].trim();
          visitRules(rule.cssRules, href, [...context, label]);
        }
      };
      for (const sheet of document.styleSheets) {
        try { visitRules(sheet.cssRules, sheet.href || 'inline'); } catch {}
      }
      return {
        trigger: rect('#search-modal-contract-trigger'),
        chips,
        chipCascade,
        outline: chipStyle?.outlineStyle,
        shadow: chipStyle?.boxShadow,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };`,
  'exact matching cascade evidence',
);

text = replaceOnce(
  text,
  `    assert.ok(geometry.chips.length >= 4 && geometry.chips.every((chip) => chip.height >= 44), 'scope chips must be 44px tall');`,
  `    assert.ok(
      geometry.chips.length >= 4 && geometry.chips.every((chip) =>
        chip.computedHeight === 44 &&
        chip.computedMinHeight === 44 &&
        chip.boxSizing === 'border-box' &&
        chip.height >= 43.5
      ),
      \`scope chips must author exact 44px geometry with <=0.5px engine quantization: \${JSON.stringify({ chips: geometry.chips, chipCascade: geometry.chipCascade })}\`,
    );`,
  'strict authored height with bounded WebKit quantization',
);

text = replaceOnce(
  text,
  `    return { browser: browserName, viewport, aria, focusableCount, geometry, layer };`,
  `    return { browser: browserName, viewport, aria, focusableCount, geometry, layer, engineWarnings };`,
  'engine warning evidence return',
);

text = replaceOnce(
  text,
  `    return { browser: browserName, viewport, aria, focusableCount, geometry, layer, engineWarnings };
  } finally {`,
  `    return { browser: browserName, viewport, aria, focusableCount, geometry, layer, engineWarnings };
  } catch (error) {
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(
      path.join(reportDir, \`failure-\${ordinal}-\${browserName}-\${viewport.width}x\${viewport.height}.json\`),
      \`\${JSON.stringify({
        browser: browserName,
        viewport,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
        consoleErrors,
        engineWarnings,
        pageErrors,
      }, null, 2)}\\n\`,
    );
    throw error;
  } finally {`,
  'fail-closed per-case diagnostic evidence',
);

assert.match(text, /expectedWebKitViewportWarning/, 'exact WebKit warning classifier missing');
assert.match(text, /engineWarnings\.push\(text\)/, 'engine warning ledger mutation missing');
assert.match(text, /consoleErrors\.push\(text\)/, 'unexpected console error barrier missing');
assert.match(text, /computedHeight === 44/, 'exact authored 44px height assertion missing');
assert.match(text, /computedMinHeight === 44/, 'exact authored 44px min-height assertion missing');
assert.match(text, /chip\.height >= 43\.5/, 'bounded WebKit quantization tolerance missing');
assert.match(text, /chipCascade/, 'matching cascade evidence missing');
assert.match(text, /minHeightPriority/, 'cascade priority evidence missing');
assert.match(text, /assert\.deepEqual\(consoleErrors, \[\], `\$\{browserName\} console errors`\)/, 'strict unexpected console error assertion missing');
assert.match(text, /layer, engineWarnings \}/, 'engine warning evidence missing from report');
assert.match(text, /failure-\$\{ordinal\}-\$\{browserName\}/, 'per-case failure artifact missing');
assert.match(text, /throw error;/, 'failure must remain blocking');

fs.writeFileSync(browserTarget, text);
console.log('Home Search chips reconciled to authored 44px geometry; exact WebKit warning and cascade evidence retained');
