#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'karty/_engine/map-engine.js');
const write = process.argv.includes('--write');
let source = fs.readFileSync(TARGET, 'utf8');

const installed = [
  'map-engine.js v0.55',
  'const ROUTE_PATH_COLORS=Object.freeze',
  'data-route-source',
  'me-arrow-authored-',
  "source:'authored'",
  "source:'generated'"
].every((needle) => source.includes(needle));

if (installed) {
  console.log('PASS karty/_engine/map-engine.js already renders authored stage paths');
  process.exit(0);
}

const replaceExactlyOnce = (oldText, newText, label) => {
  const count = source.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one occurrence, found ${count}`);
  }
  source = source.replace(oldText, newText);
};

replaceExactlyOnce(
  ' * map-engine.js v0.54 — reusable biblical map rendering engine. Viewport-bound panels + signature controls + story focus halo.',
  ' * map-engine.js v0.55 — reusable biblical map rendering engine. Authored route geometry + viewport-bound panels + signature controls.',
  'version header guard'
);

replaceExactlyOnce(
  "  const STAGE_COLORS = ['#e8c879','#e0813f','#4a9e6e','#cf5b6b','#8b6b4a','#4a80b4'];",
  "  const STAGE_COLORS = ['#e8c879','#e0813f','#4a9e6e','#cf5b6b','#8b6b4a','#4a80b4'];\n  const ROUTE_PATH_COLORS=Object.freeze({gold:STAGE_COLORS[0],lot:STAGE_COLORS[1],war:STAGE_COLORS[3]});",
  'route color palette guard'
);

const startToken = '    const routePathsByStage = {};';
const endToken = '      pathsG.appendChild(label);\n    });';
const start = source.indexOf(startToken);
const endStart = source.indexOf(endToken, start);
if (start < 0 || endStart < 0 || source.indexOf(startToken, start + 1) >= 0 || source.indexOf(endToken, endStart + 1) >= 0) {
  throw new Error('stage renderer guard failed: expected one exact renderer block');
}
const end = endStart + endToken.length;

const renderer = `    function normalizeAuthoredStagePaths(stage={}) {
      return (Array.isArray(stage.paths)?stage.paths:[]).map((entry,index)=>{
        const d=String(entry&&entry.d||'').trim();
        const colorKey=String(entry&&entry.c||'').trim();
        return {d,colorKey,dash:!!(entry&&entry.dash),index};
      }).filter(entry=>/^[Mm](?:\\s|[-+.\\d])/.test(entry.d));
    }

    function resolveRoutePathColor(colorKey,stageIndex) {
      const fallback=STAGE_COLORS[stageIndex%STAGE_COLORS.length];
      const key=String(colorKey||'').trim();
      if(!key||key==='stage')return fallback;
      if(ROUTE_PATH_COLORS[key])return ROUTE_PATH_COLORS[key];
      if(/^(?:#|rgba?\\(|hsla?\\(|var\\(|currentColor$)/i.test(key))return key;
      return fallback;
    }

    function ensureAuthoredArrowMarker(stageIndex,pathIndex,color) {
      const id='me-arrow-authored-'+stageIndex+'-'+pathIndex;
      if(defs.querySelector('#'+id))return id;
      const marker=document.createElementNS('http://www.w3.org/2000/svg','marker');
      marker.setAttribute('id',id);
      marker.setAttribute('markerWidth','10');marker.setAttribute('markerHeight','8');
      marker.setAttribute('refX','9');marker.setAttribute('refY','4');marker.setAttribute('orient','auto');
      const arrow=document.createElementNS('http://www.w3.org/2000/svg','path');
      arrow.setAttribute('d','M0,0 L10,4 L0,8 L3,4 Z');arrow.setAttribute('fill',color);arrow.setAttribute('opacity','0.7');
      marker.appendChild(arrow);defs.appendChild(marker);
      return id;
    }

    function appendRenderedRoutePath(stageIndex,pathIndex,spec,layerMembership) {
      const color=resolveRoutePathColor(spec.colorKey,stageIndex);
      const sourceKind=spec.source||'generated';
      const markerId=sourceKind==='authored'
        ?ensureAuthoredArrowMarker(stageIndex,pathIndex,color)
        :'me-arrow-'+(stageIndex%STAGE_COLORS.length);
      const under=document.createElementNS('http://www.w3.org/2000/svg','path');
      under.setAttribute('d',spec.d);under.setAttribute('class','me-route-under');
      under.setAttribute('stroke',color);under.setAttribute('fill','none');under.setAttribute('stroke-width','8');under.setAttribute('opacity','0.18');
      under.setAttribute('data-route-source',sourceKind);under.setAttribute('data-stage-index',String(stageIndex));under.setAttribute('data-route-path-index',String(pathIndex));
      if(spec.dash)under.setAttribute('stroke-dasharray','10 8');
      setLayerMembership(under,layerMembership);pathsG.appendChild(under);

      const main=document.createElementNS('http://www.w3.org/2000/svg','path');
      main.setAttribute('d',spec.d);main.setAttribute('class','me-route stage-'+stageIndex);
      main.setAttribute('stroke',color);main.setAttribute('fill','none');main.setAttribute('stroke-width','2.5');main.setAttribute('opacity','0.8');
      main.setAttribute('marker-end','url(#'+markerId+')');
      main.setAttribute('data-route-source',sourceKind);main.setAttribute('data-stage-index',String(stageIndex));main.setAttribute('data-route-path-index',String(pathIndex));
      main.setAttribute('data-route-color-key',spec.colorKey||'stage');
      setLayerMembership(main,layerMembership);pathsG.appendChild(main);

      if(spec.dash){
        main.setAttribute('stroke-dasharray','10 8');
      }else{
        try{
          const length=main.getTotalLength();
          main.style.strokeDasharray=length;main.style.strokeDashoffset=length;
          _tm(()=>{main.style.transition='stroke-dashoffset 1.2s ease '+(stageIndex*0.15+pathIndex*0.08)+'s';main.style.strokeDashoffset='0'},100);
        }catch(e){}
      }
      return main;
    }

    const routePathsByStage = {};
    const stageLabels = {};
    // Route paths — authored SVG geometry is authoritative when present.
    (route.stages||[]).forEach((st,i)=>{
      const points=(route.places||[]).filter(p=>p.stage===i&&!p.noRoute);
      const authored=normalizeAuthoredStagePaths(st);
      const specs=authored.length
        ?authored.map(entry=>({...entry,source:'authored'}))
        :(points.length>=2?[{
            d:points.map((p,j)=>(j?'L':'M')+p.x+','+p.y).join(' '),
            colorKey:'stage',dash:false,index:0,source:'generated'
          }]:[]);
      const stagePathElements=[];
      const layerMembership=getStageLayerMembership(route,i);
      specs.forEach((spec,pathIndex)=>{
        stagePathElements.push(appendRenderedRoutePath(i,pathIndex,spec,layerMembership));
      });
      routePathsByStage[i]=stagePathElements;
      if(!stagePathElements.length)return;

      let labelX=0,labelY=0;
      if(points.length){
        labelX=points.reduce((s,p)=>s+p.x,0)/points.length;
        labelY=points.reduce((s,p)=>s+p.y,0)/points.length-18;
      }else{
        try{
          const first=stagePathElements[0],mid=first.getPointAtLength(first.getTotalLength()/2);
          labelX=mid.x;labelY=mid.y-18;
        }catch(e){return}
      }
      const label=document.createElementNS('http://www.w3.org/2000/svg','text');
      label.setAttribute('x',labelX);label.setAttribute('y',labelY);
      label.setAttribute('text-anchor','middle');label.setAttribute('class','me-stage-label');
      label.setAttribute('fill',STAGE_COLORS[i%STAGE_COLORS.length]);label.setAttribute('font-size','11');label.setAttribute('font-weight','700');label.setAttribute('letter-spacing','1');
      label.setAttribute('data-stage-index',String(i));setLayerMembership(label,layerMembership);
      label.textContent=st.n||('ЭТАП '+(i+1));stageLabels[i]=label;
      pathsG.appendChild(label);
    });`;

source = source.slice(0, start) + renderer + source.slice(end);

const postconditions = [
  'map-engine.js v0.55',
  'const ROUTE_PATH_COLORS=Object.freeze',
  "source:'authored'",
  "source:'generated'",
  "main.setAttribute('data-route-source',sourceKind)",
  "under.setAttribute('data-route-source',sourceKind)",
  "if(spec.dash)under.setAttribute('stroke-dasharray','10 8')",
  "main.setAttribute('stroke-dasharray','10 8')"
];
for (const needle of postconditions) {
  if (!source.includes(needle)) throw new Error(`postcondition failed: ${needle}`);
}

if (write) {
  fs.writeFileSync(TARGET, source, 'utf8');
  console.log('UPDATED karty/_engine/map-engine.js — authored stage paths are now authoritative');
} else {
  console.log('PASS authored stage path materializer guards');
}
