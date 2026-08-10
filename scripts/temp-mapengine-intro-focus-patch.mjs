#!/usr/bin/env node
import fs from 'node:fs';

const file = 'karty/_engine/map-engine.js';
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: source marker missing`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: source marker is not unique`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  "    const panelOverlayOwner = `${mapOwnerStem}:panel`;\n    const photoOverlayOwner = `${mapOwnerStem}:photo`;",
  "    const introOverlayOwner = `${mapOwnerStem}:intro`;\n    const panelOverlayOwner = `${mapOwnerStem}:panel`;\n    const photoOverlayOwner = `${mapOwnerStem}:photo`;",
  'intro overlay owner',
);

const introStartMarker = '    // ── Intro screen ──\n';
const introEndMarker = '    // Loading progress';
const introStart = source.indexOf(introStartMarker);
const introEnd = source.indexOf(introEndMarker, introStart + introStartMarker.length);
if (introStart < 0 || introEnd < 0 || introEnd <= introStart) throw new Error('intro block bounds missing');
if (source.indexOf(introStartMarker, introStart + introStartMarker.length) >= 0) throw new Error('intro start marker is not unique');

const introBlock = `    // ── Intro screen ──\n\n    // Intro screen: one shared special-overlay lifecycle owns underlay inerting,\n    // focus entry, Escape/background/button dismissal and post-dismissal focus.\n    if (opts.showIntro !== false) {\n      const intro = document.createElement('div');\n      intro.className = 'me-intro';\n      intro.innerHTML = \`\n        <div class=\"me-intro__bg\"></div>\n        <div class=\"me-intro__content\">\n          <h2 class=\"me-intro__title\">\${esc(route.meta?.title || '')}</h2>\n          \${route.meta?.title_he ? \`<p class=\"me-intro__he\" lang=\"he\" dir=\"rtl\">\${esc(route.meta.title_he)}</p>\` : ''}\n          \${route.meta?.subtitle ? \`<p class=\"me-intro__sub\">\${esc(route.meta.subtitle)}</p>\` : ''}\n          <div class=\"me-intro__stats\">\n            \${(route.places||[]).length ? \`<span>\${route.places.length} мест</span>\` : ''}\n            \${(route.stories||[]).length ? \`<span>\${route.stories.length} сюжетов</span>\` : ''}\n          </div>\n          <button class=\"me-intro__btn\">Начать изучение</button>\n        </div>\`;\n      container.appendChild(intro);\n\n      let introDismissed = false;\n      const focusMapOwner = () => focusSpecialTarget(\n        container.querySelector('.me-story-chip--active') || container.querySelector('.me-search')\n      );\n      const dismissIntro = (reason = 'button') => {\n        if (introDismissed) return false;\n        introDismissed = true;\n        closeSpecialOverlay(introOverlayOwner, reason, {restoreFocus:false});\n        intro.style.opacity = '0';\n        intro.style.transform = 'scale(0.95)';\n        intro.style.transition = 'opacity .4s ease, transform .4s cubic-bezier(.4,0,.2,1)';\n        intro.style.pointerEvents = 'none';\n        _tm(() => { intro.remove(); focusMapOwner(); }, 450);\n        return true;\n      };\n\n      _on(intro.querySelector('.me-intro__btn'), 'click', () => dismissIntro('button'));\n      _on(intro.querySelector('.me-intro__bg'), 'click', () => dismissIntro('backdrop'));\n      _on(intro, 'keydown', event => {\n        if (event.key !== 'Escape' && event.key !== 'Esc') return;\n        event.preventDefault();\n        dismissIntro('escape');\n      });\n\n      openSpecialOverlay(introOverlayOwner, {\n        element: intro,\n        focusTarget: () => intro.querySelector('.me-intro__btn'),\n        inertTargets: specialInertTargets([intro]),\n        onRequestClose: reason => dismissIntro(reason || 'request'),\n      });\n    }\n\n    `;
source = source.slice(0, introStart) + introBlock + source.slice(introEnd);

replaceOnce(
  "        destroySpecialOverlay(photoOverlayOwner);\n        destroySpecialOverlay(panelOverlayOwner);",
  "        destroySpecialOverlay(photoOverlayOwner);\n        destroySpecialOverlay(panelOverlayOwner);\n        destroySpecialOverlay(introOverlayOwner);",
  'intro overlay cleanup',
);

fs.writeFileSync(file, source);
console.log('MapEngine Intro focus patch applied');
