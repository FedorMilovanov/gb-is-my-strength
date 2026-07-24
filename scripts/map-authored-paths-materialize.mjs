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
  'data-route-dash',
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

const startToken = '      // Stage paths\n      const stagePaths=Array.from({length:(route.stages||[]).length},()=>[]);';
const endToken = "        requestAnimationFrame(() => { path.style.strokeDashoffset = '0'; });\n      });";
const start = source.indexOf(startToken);
const endStart = source.indexOf(endToken, start);
if (
  start < 0 ||
  endStart < 0 ||
  source.indexOf(startToken, start + 1) >= 0 ||
  source.indexOf(endToken, endStart + 1) >= 0
) {
  throw new Error('stage renderer guard failed: expected one current stagePaths renderer block');
}
const end = endStart + endToken.length;

const renderer = String.raw`      // Stage paths — authored SVG geometry is authoritative when valid.
      function normalizeAuthoredStagePaths(stage={}){
        return (Array.isArray(stage.paths)?stage.paths:[]).map((entry,index)=>{
          const d=String(entry&&entry.d||'').trim();
          if(!/^[Mm](?:\s|[-+.\d])/.test(d))return null;
          try{
            const probe=document.createElementNS('http://www.w3.org/2000/svg','path');
            probe.setAttribute('d',d);
            const length=probe.getTotalLength();
            if(!Number.isFinite(length)||length<=0)return null;
          }catch(e){return null}
          return {d,colorKey:String(entry&&entry.c||'').trim(),dash:!!(entry&&entry.dash),index,source:'authored'};
        }).filter(Boolean);
      }

      function resolveRoutePathColor(colorKey,stageIndex){
        const fallback=STAGE_COLORS[stageIndex%STAGE_COLORS.length]||STAGE_COLORS[0];
        const key=String(colorKey||'').trim();
        if(!key||key==='stage')return fallback;
        if(ROUTE_PATH_COLORS[key])return ROUTE_PATH_COLORS[key];
        if(/^(?:#|rgba?\(|hsla?\(|var\(|currentColor$)/i.test(key))return key;
        return fallback;
      }

      function applyRouteLayerMembership(element,membership){
        element.setAttribute('data-layer',membership.tokens.join(' '));
        element.setAttribute('data-layer-all',membership.all.join(' '));
        element.setAttribute('data-layer-any',membership.any.join(' '));
      }

      function ensureAuthoredArrowMarker(stageIndex,pathIndex,color){
        const id='me-arrow-authored-'+stageIndex+'-'+pathIndex;
        if(defs.querySelector('#'+id))return id;
        const marker=document.createElementNS('http://www.w3.org/2000/svg','marker');
        marker.setAttribute('id',id);marker.setAttribute('markerWidth','10');marker.setAttribute('markerHeight','8');
        marker.setAttribute('refX','9');marker.setAttribute('refY','4');marker.setAttribute('orient','auto');
        const arrow=document.createElementNS('http://www.w3.org/2000/svg','path');
        arrow.setAttribute('d','M0,0 L10,4 L0,8 L3,4 Z');arrow.setAttribute('fill',color);arrow.setAttribute('opacity','0.7');
        marker.appendChild(arrow);defs.appendChild(marker);
        return id;
      }

      function appendRenderedRoutePath(stageIndex,pathIndex,spec,membership){
        const color=resolveRoutePathColor(spec.colorKey,stageIndex);
        const sourceKind=spec.source||'generated';
        const markerId=sourceKind==='authored'
          ?ensureAuthoredArrowMarker(stageIndex,pathIndex,color)
          :'me-arrow-'+(stageIndex%STAGE_COLORS.length);
        const common=(element,kind,className)=>{
          element.setAttribute('d',spec.d);element.setAttribute('fill','none');element.setAttribute('stroke',color);
          element.setAttribute('stroke-linecap','round');element.setAttribute('stroke-linejoin','round');
          element.setAttribute('data-stage',String(stageIndex));element.setAttribute('data-stage-index',String(stageIndex));
          element.setAttribute('data-route-kind',kind);element.setAttribute('data-route-source',sourceKind);
          element.setAttribute('data-route-path-index',String(pathIndex));element.setAttribute('data-route-color-key',spec.colorKey||'stage');
          element.setAttribute('data-route-dash',spec.dash?'1':'0');element.setAttribute('class',className);
          applyRouteLayerMembership(element,membership);
        };

        const under=document.createElementNS('http://www.w3.org/2000/svg','path');
        common(under,'underlay','me-route-underlay');
        under.setAttribute('stroke-width','9');under.setAttribute('opacity','0.11');
        if(spec.dash)under.setAttribute('stroke-dasharray','10 8');
        pathsG.appendChild(under);

        const path=document.createElementNS('http://www.w3.org/2000/svg','path');
        common(path,'main','me-route-main');
        path.setAttribute('stroke-width','3');path.setAttribute('opacity','0.5');path.setAttribute('marker-end','url(#'+markerId+')');
        if(spec.dash){
          path.setAttribute('stroke-dasharray','10 8');
        }else{
          const length=path.getTotalLength();
          path.setAttribute('stroke-dasharray',String(length));path.setAttribute('stroke-dashoffset',String(length));
          path.style.transition='stroke-dashoffset 1.5s '+(stageIndex*0.3+pathIndex*0.08)+'s cubic-bezier(.4,0,.2,1), opacity .4s ease, stroke-width .4s ease, filter .4s ease';
          requestAnimationFrame(()=>{path.style.strokeDashoffset='0'});
        }
        pathsG.appendChild(path);
        return path;
      }

      const stagePaths=Array.from({length:(route.stages||[]).length},()=>[]);
      allPlaces.forEach(p=>{
        if(!Number.isInteger(p.stage)||p.stage<0||p.stage>=stagePaths.length)return;
        stagePaths[p.stage].push(p);
      });
      stagePaths.forEach((places,i)=>{
        const stage=route.stages?.[i]||{};
        const authored=normalizeAuthoredStagePaths(stage);
        const specs=authored.length
          ?authored
          :(places.length>=2?[{
              d:places.map((p,j)=>(j===0?'M':'L')+p.x+','+p.y).join(' '),
              colorKey:'stage',dash:false,index:0,source:'generated'
            }]:[]);
        if(!specs.length)return;
        const stageMembership=getStageLayerMembership(route,i);
        const rendered=specs.map((spec,pathIndex)=>appendRenderedRoutePath(i,pathIndex,spec,stageMembership));

        let labelX,labelY;
        if(places.length){
          const mid=places[Math.floor(places.length/2)];labelX=mid.x+10;labelY=mid.y-10;
        }else{
          try{
            const first=rendered[0],mid=first.getPointAtLength(first.getTotalLength()/2);labelX=mid.x+10;labelY=mid.y-10;
          }catch(e){return}
        }
        const label=document.createElementNS('http://www.w3.org/2000/svg','text');
        label.setAttribute('x',String(labelX));label.setAttribute('y',String(labelY));label.setAttribute('class','me-route-label');
        label.setAttribute('data-stage',String(i));label.setAttribute('data-stage-index',String(i));
        applyRouteLayerMembership(label,stageMembership);label.textContent=stage.n||(''+(i+1));
        pathsG.appendChild(label);
      });`;

source = source.slice(0, start) + renderer + source.slice(end);

const postconditions = [
  'map-engine.js v0.55',
  'const ROUTE_PATH_COLORS=Object.freeze',
  "source:'authored'",
  "source:'generated'",
  "element.setAttribute('data-route-source',sourceKind)",
  "element.setAttribute('data-route-dash',spec.dash?'1':'0')",
  "common(under,'underlay','me-route-underlay')",
  "common(path,'main','me-route-main')",
  "if(spec.dash)under.setAttribute('stroke-dasharray','10 8')",
  "path.setAttribute('stroke-dasharray','10 8')"
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
