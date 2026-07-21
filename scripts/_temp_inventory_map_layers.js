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
  rows.push({
    route: entry.name,
    layers: layers.map((layer) => ({
      id: layer.id,
      on: layer.on !== false,
      selector: layer.selector || null,
      place_ids: layer.place_ids || layer.places || null,
      stage_ids: layer.stage_ids || layer.stages || null,
      types: layer.types || layer.place_types || null,
    })),
    stageClasses: [...new Set(stages.map((stage) => stage && stage.cls).filter(Boolean))],
    placeTypes: [...new Set(places.map((place) => place && place.type).filter(Boolean))],
    placeLayers: [...new Set(places.flatMap((place) => {
      const value = place && (place.layer || place.layers);
      return Array.isArray(value) ? value : value ? [value] : [];
    }))],
  });
}
console.log(JSON.stringify(rows, null, 2));
