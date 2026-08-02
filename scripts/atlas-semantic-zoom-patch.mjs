#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const changed = [];

function patch(rel, edits) {
  const file = path.join(root, rel);
  let source = fs.readFileSync(file, 'utf8');
  for (const { label, old, next } of edits) {
    if (source.includes(next)) continue;
    const count = source.split(old).length - 1;
    if (count !== 1) throw new Error(`${rel}: ${label}: expected one match, found ${count}`);
    source = source.replace(old, next);
  }
  if (source !== fs.readFileSync(file, 'utf8')) {
    fs.writeFileSync(file, source, 'utf8');
    changed.push(rel);
  }
}

patch('karty/_engine/map-engine.js', [
  {
    label: 'semantic zoom CSS',
    old: `.me-map .me-story-chip,.me-map .me-back,.me-map .me-search,.me-map .me-theme-btn,.me-map .me-share-btn,.me-map .me-zoom,.me-map .me-layers,.me-map .me-legend{background:var(--me-control-bg,rgba(0,0,0,.55));border-color:var(--me-border,rgba(255,255,255,.12));color:var(--me-muted,#9aa2ae)}\n`,
    next: `.me-map .me-story-chip,.me-map .me-back,.me-map .me-search,.me-map .me-theme-btn,.me-map .me-share-btn,.me-map .me-zoom,.me-map .me-layers,.me-map .me-legend{background:var(--me-control-bg,rgba(0,0,0,.55));border-color:var(--me-border,rgba(255,255,255,.12));color:var(--me-muted,#9aa2ae)}

/* Semantic zoom: the authored base already marks regional/detail objects with
   lbl-z1/lbl-z2. Overview stays calm; regional and close views reveal evidence
   progressively without mutating route truth or using a map-specific branch. */
.me-map svg[data-zoom-bucket="overview"] #me-base-geo .lbl-z1,
.me-map svg[data-zoom-bucket="overview"] #me-base-geo .lbl-z2,
.me-map svg[data-zoom-bucket="overview"] #me-base-geo .region-he,
.me-map svg[data-zoom-bucket="overview"] #me-base-geo #routeWaypoints,
.me-map svg[data-zoom-bucket="overview"] #me-base-geo #tradeRoutes,
.me-map svg[data-zoom-bucket="overview"] #me-base-geo #coordGrid,
.me-map svg[data-zoom-bucket="overview"] #me-base-geo #starDeep,
.me-map svg[data-zoom-bucket="overview"] #me-base-geo #starMid,
.me-map svg[data-zoom-bucket="overview"] #me-base-geo #starField,
.me-map svg[data-zoom-bucket="overview"] #me-base-geo #starMilky,
.me-map svg[data-zoom-bucket="overview"] #me-base-geo #starShoot,
.me-map svg[data-zoom-bucket="overview"] #me-base-geo #starMoriah,
.me-map svg[data-zoom-bucket="overview"] #me-ctx,
.me-map svg[data-zoom-bucket="overview"] #me-markers [data-label-priority="detail"] .me-place-label-part,
.me-map svg[data-zoom-bucket="region"] #me-base-geo .lbl-z2,
.me-map svg[data-zoom-bucket="region"] #me-base-geo .region-he,
.me-map svg[data-zoom-bucket="region"] #me-base-geo #coordGrid{display:none}
.me-map svg[data-zoom-bucket="region"] #me-ctx{opacity:.35}
.me-map svg[data-zoom-bucket="detail"] #me-ctx{opacity:.55}
`,
  },
  {
    label: 'semantic thresholds after cfg',
    old: `    const cfg = {...DEFAULTS, ...opts};\n`,
    next: `    const cfg = {...DEFAULTS, ...opts};
    const semanticZoomConfig = route.meta?.semantic_zoom || route.semantic_zoom || {};
    const semanticOverviewMinW = Number(semanticZoomConfig.overview_min_w ?? semanticZoomConfig.overviewMinW) || cfg.W0 * 0.68;
    const semanticDetailMaxW = Number(semanticZoomConfig.detail_max_w ?? semanticZoomConfig.detailMaxW) || cfg.W0 * 0.34;
`,
  },
  {
    label: 'initial zoom bucket attribute',
    old: `    svg.setAttribute('viewBox',\`\${view.x} \${view.y} \${view.w} \${view.h}\`);\n    svg.setAttribute('preserveAspectRatio','xMidYMid meet');\n`,
    next: `    svg.setAttribute('viewBox',\`\${view.x} \${view.y} \${view.w} \${view.h}\`);
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    function semanticZoomBucket(width=view.w){
      if(width >= semanticOverviewMinW) return 'overview';
      if(width > semanticDetailMaxW) return 'region';
      return 'detail';
    }
    function applySemanticZoom(){
      const bucket=semanticZoomBucket(view.w);
      svg.setAttribute('data-zoom-bucket',bucket);
      container.setAttribute('data-zoom-bucket',bucket);
      return bucket;
    }
    applySemanticZoom();
`,
  },
  {
    label: 'apply semantic zoom and anchored compass',
    old: `    function applyViewBox(){
      svg.setAttribute('viewBox',\`\${view.x} \${view.y} \${view.w} \${view.h}\`);
      // Parallax compass tilt
      const compass = document.getElementById('me-compass');
      if (compass) {
        const tiltX = (view.x / cfg.W0 - 0.5) * 3;
        compass.style.transform = \`rotate(\${tiltX.toFixed(1)}deg)\`;
      }
      // Update scale bar
`,
    next: `    function applyViewBox(){
      svg.setAttribute('viewBox',\`\${view.x} \${view.y} \${view.w} \${view.h}\`);
      applySemanticZoom();
      // Compass is anchored in screen space, not at a fixed map coordinate.
      const compass = svg.querySelector('#me-compass');
      if (compass) {
        const canvasRect=canvas.getBoundingClientRect();
        const unitsPerPixel=view.w/Math.max(1,canvasRect.width);
        const tiltX=(view.x/cfg.W0-0.5)*3;
        const compassX=view.x+34*unitsPerPixel;
        const compassY=view.y+54*unitsPerPixel;
        compass.setAttribute('transform',\`translate(\${compassX.toFixed(2)},\${compassY.toFixed(2)}) scale(\${unitsPerPixel.toFixed(4)}) rotate(\${tiltX.toFixed(1)})\`);
      }
      // Update scale bar
`,
  },
  {
    label: 'overview label owner before marker loop',
    old: `      // Place markers\n      allPlaces.forEach(place=>{\n`,
    next: `      // Overview labels: explicit data wins; otherwise one non-candidate
      // representative per stage plus route endpoints. Dots remain visible.
      const overviewLabelIds=new Set(
        (route.meta?.overview_places||route.overview_places||[]).map(String)
      );
      vis.forEach(place=>{
        if(place.overviewLabel===true||place.label_level==='overview')overviewLabelIds.add(place.id);
      });
      const representedStages=new Set(
        [...overviewLabelIds].map(id=>allPlaces.find(p=>p.id===id)?.stage).filter(Number.isFinite)
      );
      vis.forEach(place=>{
        if(Number.isFinite(place.stage)&&!representedStages.has(place.stage)&&place.type!=='cand'){
          overviewLabelIds.add(place.id);representedStages.add(place.stage);
        }
      });
      if(vis[0])overviewLabelIds.add(vis[0].id);
      if(vis.at(-1))overviewLabelIds.add(vis.at(-1).id);

      // Place markers
      allPlaces.forEach(place=>{
`,
  },
  {
    label: 'marker label priority',
    old: `        g.setAttribute('data-place-id', place.id);\n        const membership=getPlaceLayerMembership(route,place);\n`,
    next: `        g.setAttribute('data-place-id', place.id);
        g.setAttribute('data-label-priority',overviewLabelIds.has(place.id)?'overview':'detail');
        const membership=getPlaceLayerMembership(route,place);
`,
  },
  {
    label: 'leader semantic class',
    old: `          leaderLine.classList.add('me-leader');\n`,
    next: `          leaderLine.classList.add('me-leader','me-place-label-part','me-place-label-leader');
`,
  },
  {
    label: 'label background semantic class',
    old: `        labelBg.style.pointerEvents = 'none';\n        g.appendChild(labelBg);\n`,
    next: `        labelBg.style.pointerEvents = 'none';
        labelBg.classList.add('me-place-label-part','me-place-label-bg');
        g.appendChild(labelBg);
`,
  },
  {
    label: 'label semantic class',
    old: `        label.style.transition = 'opacity .3s';\n        label.textContent=labelText;\n`,
    next: `        label.style.transition = 'opacity .3s';
        label.classList.add('me-place-label-part','me-place-label');
        label.textContent=labelText;
`,
  },
]);

patch('karty/avraam/base.svg', [
  {
    label: 'red sea becomes regional label',
    old: `<text class="sea-label" x="676" y="1330" font-size="15" transform="rotate(38 676 1330)">КРАСНОЕ&#160;МОРЕ</text>`,
    next: `<text class="sea-label lbl-z1" x="676" y="1330" font-size="15" transform="rotate(38 676 1330)">КРАСНОЕ&#160;МОРЕ</text>`,
  },
]);

patch('scripts/avraam-reference-baseline.mjs', [
  {
    label: 'reliable DOM intro click',
    old: `  if(await start.isVisible().catch(()=>false)){
    await start.click({force:true});
    await intro.waitFor({state:'detached',timeout:1600}).catch(()=>{});
  }`,
    next: `  if(await start.isVisible().catch(()=>false)){
    await start.evaluate(el=>el.click());
    await intro.waitFor({state:'detached',timeout:1600}).catch(()=>{});
  }`,
  },
  {
    label: 'record semantic zoom bucket',
    old: `      map:{box:map?rect(map):null,canvasBox:canvas?rect(canvas):null,svgBox:svg?rect(svg):null,viewBox:svg?.getAttribute('viewBox')||null,canvasTransform:canvas?getComputedStyle(canvas).transform:null,svgTransform:svg?getComputedStyle(svg).transform:null},`,
    next: `      map:{box:map?rect(map):null,canvasBox:canvas?rect(canvas):null,svgBox:svg?rect(svg):null,viewBox:svg?.getAttribute('viewBox')||null,zoomBucket:svg?.getAttribute('data-zoom-bucket')||null,canvasTransform:canvas?getComputedStyle(canvas).transform:null,svgTransform:svg?getComputedStyle(svg).transform:null},`,
  },
  {
    label: 'fail closed overview bucket',
    old: `    result.overview=await collectGeometry(page,\`\${viewport.id}:overview\`);\n\n    const stories=await storyMetadata(page);`,
    next: `    result.overview=await collectGeometry(page,\`\${viewport.id}:overview\`);
    if(result.overview.map.zoomBucket!=='overview')result.verificationFailures.push(\`unexpected overview zoom bucket: \${result.overview.map.zoomBucket}\`);

    const stories=await storyMetadata(page);`,
  },
]);

console.log(changed.length ? `Patched: ${changed.join(', ')}` : 'Semantic zoom patch already materialized.');
