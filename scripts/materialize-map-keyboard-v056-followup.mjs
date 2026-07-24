import fs from 'node:fs';

function replaceOnce(file, source, search, replacement) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${file}: expected one exact anchor, found ${count}: ${search.slice(0, 140)}`);
  return source.replace(search, replacement);
}

let authored = fs.readFileSync('scripts/map-authored-paths-browser-test.js', 'utf8');
authored = replaceOnce(
  'scripts/map-authored-paths-browser-test.js',
  authored,
  `function normalizeColor(value) {
  return String(value || '').trim().toLowerCase().replace(/\\s+/g, '');
}
`,
  `function normalizeColor(value) {
  return String(value || '').trim().toLowerCase().replace(/\\s+/g, '');
}

function toSerializable(value) {
  const seen = new WeakSet();
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (item && typeof item === 'object') {
      if (seen.has(item)) return '[Circular]';
      seen.add(item);
    }
    return item;
  }));
}
`,
);
authored = replaceOnce(
  'scripts/map-authored-paths-browser-test.js',
  authored,
  `    assert(report.engineVersion === '0.55.0', 'MapEngine public version is not synchronized with v0.55 renderer', report);`,
  `    assert(report.engineVersion === '0.56.0', 'MapEngine public version is not synchronized with v0.56 renderer', { engineVersion: report.engineVersion });`,
);
authored = replaceOnce(
  'scripts/map-authored-paths-browser-test.js',
  authored,
  `    report.failures.push({ message: error.message, details: error.details || null, stack: error.stack, runtimeErrors });`,
  `    report.failures.push({ message: error.message, details: toSerializable(error.details || null), stack: error.stack, runtimeErrors });`,
);
fs.writeFileSync('scripts/map-authored-paths-browser-test.js', authored);

let smoke = fs.readFileSync('scripts/map-browser-smoke.js', 'utf8');
smoke = replaceOnce(
  'scripts/map-browser-smoke.js',
  smoke,
  `          const archFooter = !!document.querySelector('.me-arch-footer');
          const sourceBadges = document.querySelectorAll('.me-source-badge').length;
          const moreButton = !!document.querySelector('.me-arch-more');
          return {tested:true, ok:items>0 && statuses.length>0 && archFooter && sourceBadges>0, place:place.id, items, statuses:statuses.slice(0,3), archFooter, sourceBadges, moreButton};`,
  `          const legacyFooter = !!document.querySelector('.me-arch-footer');
          const projectionRoot = !!document.querySelector('[data-archaeology-projection-root]');
          const sourceBadges = document.querySelectorAll('.map-arch-badge').length;
          const sourceRecords = document.querySelectorAll('[data-source-id][data-evidence-use][data-source-status][data-source-verification]').length;
          return {
            tested:true,
            ok:items>0 && statuses.length>0 && projectionRoot && sourceBadges>0 && sourceRecords>0 && !legacyFooter,
            place:place.id,
            items,
            statuses:statuses.slice(0,3),
            projectionRoot,
            sourceBadges,
            sourceRecords,
            legacyFooter,
          };`,
);
fs.writeFileSync('scripts/map-browser-smoke.js', smoke);

let workflow = fs.readFileSync('.github/workflows/map-keyboard-contract.yml', 'utf8');
workflow = replaceOnce(
  '.github/workflows/map-keyboard-contract.yml',
  workflow,
  `            'map-engine.js v0.55',
            "version:'0.55.0',buildDate:'2026-07-24'",`,
  `            'map-engine.js v0.56',
            "version:'0.56.0',buildDate:'2026-07-25'",
            'cfg.archaeologyProjection',`,
);
workflow = replaceOnce(
  '.github/workflows/map-keyboard-contract.yml',
  workflow,
  `          if (missing.length || source.includes('stageIndex%STAGE_COLORS.length')) {
            console.error('Missing or stale map source contract:', {missing, staleModulo: source.includes('stageIndex%STAGE_COLORS.length')});`,
  `          const staleLegacyArchaeology = /ARCHAEOLOGY_REFERENCES|_classifySource|_renderArchaeologyFooter/.test(source);
          if (missing.length || source.includes('stageIndex%STAGE_COLORS.length') || staleLegacyArchaeology) {
            console.error('Missing or stale map source contract:', {missing, staleModulo: source.includes('stageIndex%STAGE_COLORS.length'), staleLegacyArchaeology});`,
);
fs.writeFileSync('.github/workflows/map-keyboard-contract.yml', workflow);

console.log(JSON.stringify({ version: '0.56.0', authoredFailureReport: 'cycle-safe', smoke: 'projection-hooks', legacyArchaeology: 'forbidden' }, null, 2));
