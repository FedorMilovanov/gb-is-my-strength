import fs from 'node:fs';

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

const sitePath = 'css/site.css';
let site = fs.readFileSync(sitePath, 'utf8');
const early = '@keyframes fx-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}';
const canonical = '@keyframes fx-breathe{0%,100%{transform:scale(1);opacity:.82}50%{transform:scale(1.06);opacity:1}}';
if (count(site, early) !== 1) throw new Error('expected exactly one dead scale-only fx-breathe owner');
if (count(site, canonical) !== 1) throw new Error('expected exactly one canonical scale+opacity fx-breathe owner');
site = site.replace(early, '');
if (count(site, '@keyframes fx-breathe') !== 1 || count(site, canonical) !== 1) {
  throw new Error('fx-breathe did not converge to one canonical owner');
}
fs.writeFileSync(sitePath, site);

const floatingPath = 'css/floating-cluster.css';
let floating = fs.readFileSync(floatingPath, 'utf8');
const repeatedStandalone = `  .gb-floater {
    top: auto;
    left: 50%;
    right: auto;
    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    transform: translateX(-50%);
    flex-direction: row;
    gap: 2px;
    padding: 3px;
    border: 1px solid color-mix(in srgb, var(--color-border, #e5e2dc) 86%, transparent);
    border-radius: 24px;
    background: color-mix(in srgb, var(--color-surface, #fff) 94%, transparent);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
    backdrop-filter: blur(16px) saturate(160%);
    z-index: var(--z-bottom-bar, 2000);
  }

  html.dark .gb-floater {
    background: color-mix(in srgb, var(--color-surface, #161a21) 94%, transparent);
    border-color: rgba(255, 255, 255, 0.08);
  }

  body.gb-cluster-single-active .article-main {
    padding-bottom: 88px;
  }

`;
if (count(floating, repeatedStandalone) !== 1) {
  throw new Error('expected exactly one later repeated standalone mobile owner');
}
const earlyOwnerMarker = `  body.fc-single-active .article-main,
  body.gb-cluster-single-active .article-main {
    padding-bottom: 88px;
  }`;
if (count(floating, earlyOwnerMarker) !== 1) throw new Error('early canonical/legacy standalone owner missing');
if (!floating.includes('  /* Series-lite mobile */')) throw new Error('series-lite mobile owner missing before cleanup');
floating = floating.replace(repeatedStandalone, '');
if (count(floating, earlyOwnerMarker) !== 1) throw new Error('early standalone owner changed');
if (!floating.includes('  /* Series-lite mobile */') || !floating.includes('  .gb-floater--series-lite {')) {
  throw new Error('series-lite rules changed/removed');
}
fs.writeFileSync(floatingPath, floating);

console.log('CSS duplicate-owner cleanup applied: one fx-breathe owner; one standalone mobile floater owner; series-lite preserved.');
