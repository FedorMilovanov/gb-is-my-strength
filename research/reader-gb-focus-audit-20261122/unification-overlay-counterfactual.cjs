// Diagnostic ONLY. Run from the exact Product archive; does not write Product files.
// It proves the rest of the existing source contract still runs after removing
// the retired Learning owner requirement and adding explicit replacement guards.
const fs = require('fs');
const Module = require('module');
const path = require('path');
const filename = path.join(process.cwd(), 'scripts/overlay-runtime-contract-test.js');
let source = fs.readFileSync(filename, 'utf8');
const before = "'gill-part-toc', 'gill-learning', 'gill-settings'";
if (source.split(before).length !== 2) throw Error('Exact baseline contract changed; re-audit instead of applying diagnostic');
source = source.replace(before, "'gill-part-toc', 'gill-settings'");
source += `
assert.ok(!floating.includes('gill-learning'), 'retired Learning owner must not return');
const chrome = fs.readFileSync('src/components/article-pilots/_shared/series/SeriesReaderChrome.astro', 'utf8');
assert.equal((chrome.match(/<GillAnalyticsStudy\\s/g) || []).length, 1, 'canonical single quiz composition retained');
console.log('COUNTERFACTUAL ONLY: retired owner removed, negative guard added, remaining assertions pass');
`;
const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = module.paths;
compiled._compile(source, filename);
