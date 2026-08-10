#!/usr/bin/env node
import fs from 'node:fs';

function patchFile(file, replacements) {
  let source = fs.readFileSync(file, 'utf8');
  for (const [label, before, after] of replacements) {
    const first = source.indexOf(before);
    if (first < 0) throw new Error(`${file} ${label}: marker missing`);
    if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${file} ${label}: marker not unique`);
    source = source.slice(0, first) + after + source.slice(first + before.length);
  }
  fs.writeFileSync(file, source);
}

patchFile('scripts/astro-cache-bust-postbuild.js', [
  ['projector declaration', "const EDITORIAL_PROJECTOR = path.join(ROOT, 'scripts', 'editorial-metadata-registry.js');", "const EDITORIAL_PROJECTOR = path.join(ROOT, 'scripts', 'editorial-metadata-registry.js');\nconst READER_LINEAR_PROJECTOR = path.join(ROOT, 'scripts', 'project-reader-linear-text-to-dist.mjs');"],
  ['projector requirePath', "requirePath(EDITORIAL_PROJECTOR, 'scripts/editorial-metadata-registry.js not found.');", "requirePath(EDITORIAL_PROJECTOR, 'scripts/editorial-metadata-registry.js not found.');\nrequirePath(READER_LINEAR_PROJECTOR, 'scripts/project-reader-linear-text-to-dist.mjs not found.');"],
  ['projector execution', "if (editorialProjector.error) throw editorialProjector.error;\nif (editorialProjector.status !== 0) throw new Error(`Editorial metadata projector failed with exit code ${editorialProjector.status}`);\n\nconst sitemapImages = projectSitemapImages({ root: DIST, htmlFiles, dryRun: DRY_RUN });", "if (editorialProjector.error) throw editorialProjector.error;\nif (editorialProjector.status !== 0) throw new Error(`Editorial metadata projector failed with exit code ${editorialProjector.status}`);\n\nconst readerLinearProjector = spawnSync(process.execPath, [READER_LINEAR_PROJECTOR, '--root', 'dist', ...(DRY_RUN ? ['--dry-run'] : [])], { cwd: ROOT, stdio: 'inherit', encoding: 'utf8' });\nif (readerLinearProjector.error) throw readerLinearProjector.error;\nif (readerLinearProjector.status !== 0) throw new Error(`Reader linear-text projector failed with exit code ${readerLinearProjector.status}`);\n\nconst sitemapImages = projectSitemapImages({ root: DIST, htmlFiles, dryRun: DRY_RUN });"],
  ['completion message', "✅ dist asset, CSP, Atlas, relation, editorial metadata and sitemap image drift → 0", "✅ dist asset, CSP, Atlas, relation, editorial metadata, reader semantic projection and sitemap image drift → 0"],
]);

patchFile('scripts/project-reader-linear-text-to-dist.mjs', [
  ['dry-run idempotence', "if (!totals.articles) throw new Error('reader linear-text projector found no data-pagefind-body article surfaces');\nif (!totals.metadata && !totals.popups) throw new Error('reader linear-text projector made no semantic projection claims');", "if (!totals.articles) throw new Error('reader linear-text projector found no data-pagefind-body article surfaces');\nif (!totals.metadata && !totals.popups && !DRY_RUN) throw new Error('reader linear-text projector made no semantic projection claims');\nif (DRY_RUN && totals.changed) throw new Error(`reader linear-text projector dry-run detected ${totals.changed} file(s) with semantic drift`);"],
]);

patchFile('js/glossary.js', [
  ['boundary helper', 'function term(v,k,d){var t=document.createElement("abbr");', 'function linearBoundary(position,label){var e=document.createElement("span");e.hidden=true;e.setAttribute("aria-hidden","true");e.setAttribute("data-pagefind-ignore","");e.setAttribute("data-reader-linear-boundary",position);e.textContent=position==="start"?" ⟦"+label+": ":"⟧ ";return e}\nfunction linearText(e){var c=e.cloneNode(true);Array.from(c.querySelectorAll("[data-reader-linear-boundary]")).forEach(function(n){n.remove()});return String(c.textContent||"").trim()}\nfunction term(v,k,d){var t=document.createElement("abbr");'],
  ['runtime generated tip boundaries', 'function tip(d,k){var m=meta(d,k),x=def(d,k),t=document.createElement("span");t.className="gtip";if(m.category)t.dataset.category=m.category;if(m.categorySlug)t.dataset.categorySlug=m.categorySlug;render(t,x.brief,x.detail);return t}', 'function tip(d,k){var m=meta(d,k),x=def(d,k),t=document.createElement("span");t.className="gtip";t.setAttribute("data-pagefind-ignore","");t.setAttribute("data-reader-linear-aux","definition");if(m.category)t.dataset.category=m.category;if(m.categorySlug)t.dataset.categorySlug=m.categorySlug;t.appendChild(linearBoundary("start","определение"));render(t,x.brief,x.detail);t.appendChild(linearBoundary("end","определение"));return t}'],
  ['static tip upgrade boundaries', 'function upgrade(t,x,k,d){if(t.dataset.gtipUpgraded==="1")return;var h=x.querySelector(".gtip-luxury__definition")||x;if(h.querySelector(".gtip-brief")){t.dataset.gtipUpgraded="1";return}var z=def(d,k),b=String(h.textContent||"").trim()||z.brief;h.textContent="";render(h,b,z.detail);t.dataset.gtipUpgraded="1"}', 'function upgrade(t,x,k,d){if(t.dataset.gtipUpgraded==="1")return;var h=x.querySelector(".gtip-luxury__definition")||x;if(h.querySelector(".gtip-brief")){t.dataset.gtipUpgraded="1";return}var z=def(d,k),b=linearText(h)||z.brief;h.textContent="";h.appendChild(linearBoundary("start","определение"));render(h,b,z.detail);h.appendChild(linearBoundary("end","определение"));t.dataset.gtipUpgraded="1"}'],
]);

console.log('Reader linear-text projection integration patch applied');
