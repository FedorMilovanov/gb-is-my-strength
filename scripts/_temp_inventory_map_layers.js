#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'karty');
const rows = [];
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
  const file = path.join(root, entry.name, 'route.json');
  if (!fs.existsSync(file)) continue;
  const route = JSON.parse(fs.readFileSync(file, 'utf8'));
  const places = Array.isArray(route.places) ? route.places : (route.places_index || []);
  const stages = Array.isArray(route.stages) ? route.stages : (route.stages_index || []);
  const layers = route.layers || [];
  if (!layers.length) continue;
  const layerSummary = layers.map((layer) => {
    const details = [];
    if (layer.selector) details.push(`sel=${layer.selector}`);
    if (layer.place_ids || layer.places) details.push(`places=${(layer.place_ids || layer.places).length}`);
    if (layer.stage_ids || layer.stages) details.push(`stages=${(layer.stage_ids || layer.stages).join(',')}`);
    if (layer.types || layer.place_types) details.push(`types=${(layer.types || layer.place_types).join(',')}`);
    return `${layer.id}:${layer.on === false ? 'off' : 'on'}${details.length ? `[${details.join(';')}]` : ''}`;
  }).join('|');
  const stageClasses = [...new Set(stages.map((stage) => stage && stage.cls).filter(Boolean))].join(',') || '-';
  const placeTypes = [...new Set(places.map((place) => place && place.type).filter(Boolean))].join(',') || '-';
  const direct = [...new Set(places.flatMap((place) => {
    const value = place && (place.layer || place.layers);
    return Array.isArray(value) ? value : value ? [value] : [];
  }))].join(',') || '-';
  rows.push(`${entry.name} :: layers=${layerSummary} :: stage.cls=${stageClasses} :: place.type=${placeTypes} :: direct=${direct}`);
}
console.log('=== MAP_LAYER_INVENTORY_BEGIN ===');
for (const row of rows.sort()) console.log(row);
console.log('=== MAP_LAYER_INVENTORY_END ===');
