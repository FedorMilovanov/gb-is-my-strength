const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENGINE = path.join(ROOT, 'karty', '_engine', 'map-engine.js');
const source = fs.readFileSync(ENGINE, 'utf8');

const failures = [];
const requireSource = (condition, message) => {
  if (!condition) failures.push(message);
};

const handlerStart = source.indexOf("_on(document,'keydown',function kh(e){");
const handlerEnd = source.indexOf("\n    });\n\n    // ── Marker entrance animation", handlerStart);
requireSource(handlerStart >= 0, 'document keydown handler is missing');
requireSource(handlerEnd > handlerStart, 'document keydown handler boundary is missing');

const handler = handlerStart >= 0 && handlerEnd > handlerStart
  ? source.slice(handlerStart, handlerEnd)
  : '';

requireSource(
  /function isEditableShortcutTarget\(target\)/.test(source),
  'editable shortcut target helper is missing',
);
requireSource(
  /input,textarea,select,\[contenteditable\]:not\(\[contenteditable="false"\]\),\[role="textbox"\]/.test(source),
  'editable target selector must cover form fields, contenteditable and role=textbox',
);
requireSource(
  /function visibleTabButtons\(\)/.test(source),
  'visible tab DOM helper is missing',
);
requireSource(
  /panel\.querySelectorAll\('\.me-tabs \.me-tab\[data-tab\]'\)/.test(source),
  'numeric tab navigation must derive from rendered tab buttons',
);
requireSource(
  /e\.isComposing\|\|editableTarget\|\|e\.altKey\|\|e\.ctrlKey\|\|e\.metaKey/.test(handler),
  'keyboard handler must ignore composition, editable targets and system modifiers',
);
requireSource(
  /const numericTabs=visibleTabButtons\(\)/.test(handler),
  'numeric shortcuts must use visible DOM tabs',
);
requireSource(
  /targetTab\.click\(\)/.test(handler),
  'numeric shortcuts must invoke the canonical tab click handler',
);
requireSource(
  !/TAB_KEYS\.filter/.test(handler),
  'keyboard handler must not maintain a second hardcoded tab-availability policy',
);
requireSource(
  !/renderTabContent\(tabKey/.test(handler),
  'keyboard handler must not bypass canonical tab click behavior',
);

if (failures.length) {
  console.error('❌ Map keyboard source contract failed:');
  failures.forEach(failure => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log('✅ Map keyboard source contract passed');
console.log('   editable fields/modifiers isolated; numeric tabs are DOM-derived and click-driven');
