#!/usr/bin/env node
/**
 * atlas-gate.js <slug> — сводный гейт сдачи карты (KA-5, G1–G8 автоматом).
 *
 * Прогоняет по карте:
 *   G1  route.json валиден (MapEngine.validateRoute)
 *   G2  label-audit карты: 0 коллизий подписей и наездов на маркеры
 *   G4  placeId-миграция: каждое место карты связано с реестром (и обратно)
 *   G6  инвентарь-паритет (счётчики ≥ базовой линии) — общий скрипт
 *   G7  данные реестра валидны (atlas-data-check) — общий скрипт
 *   G8  publication-статусы консистентны (maps:validate часть 2 — отдельно)
 * G3 (мобильный контракт), G5 (3-секундный тест) и G9 (owner review) —
 * визуальные/владельческие: закрываются скрин-пакетом в AuditRepo, здесь
 * печатается напоминание-чеклист.
 *
 * Запуск: node scripts/atlas-gate.js ishod
 * Выход: exit 1 при любом красном автогейте.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const slug = process.argv[2];
if (!slug) { console.error('usage: node scripts/atlas-gate.js <slug>'); process.exit(2); }

const routePath = path.join(ROOT, 'karty', slug, 'route.json');
if (!fs.existsSync(routePath)) { console.error(`нет карты: ${routePath}`); process.exit(2); }

let fails = 0;
const gate = (name, ok, detail) => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) fails++;
};

// G1: route валиден движковым валидатором (движок исполняем в vm, DOM не нужен)
const engineSrc = fs.readFileSync(path.join(ROOT, 'karty', '_engine', 'map-engine.js'), 'utf8');
const sandbox = { window: {}, document: undefined, console };
vm.createContext(sandbox);
try { vm.runInContext(engineSrc, sandbox); } catch (e) { /* DOM-часть падает после экспорта API — ок */ }
const ME = sandbox.window.MapEngine || {};
const route = JSON.parse(fs.readFileSync(routePath, 'utf8'));
if (ME.validateRoute) {
  const v = ME.validateRoute(route);
  gate('G1 route.json валиден (MapEngine.validateRoute)', !!v.ok, v.ok ? `${(route.places || []).length} мест` : JSON.stringify(v.errors).slice(0, 200));
} else {
  gate('G1 route.json валиден', false, 'MapEngine.validateRoute недоступен в vm');
}

// G2: label-audit конкретной карты
try {
  const out = execFileSync('node', [path.join(ROOT, 'scripts', 'atlas-label-audit.js')], { encoding: 'utf8' });
  const line = out.split('\n').find((l) => l.includes(` ${slug}:`)) || '';
  const ok = line.includes('✅') && line.includes('0 пересечений') && line.includes('0 наездов');
  gate('G2 подписи карты: 0 коллизий', ok, line.trim().replace(/^[✅❌]\s*/, ''));
} catch (e) { gate('G2 подписи карты', false, 'label-audit упал: ' + String(e.message).slice(0, 120)); }

// G4: placeId-связность карта↔реестр
{
  const reg = new Map();
  for (const f of fs.readdirSync(path.join(ROOT, 'data', 'atlas', 'places'))) {
    if (!f.endsWith('.json')) continue;
    const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'atlas', 'places', f), 'utf8'));
    for (const m of p.maps || []) if (m.slug === slug) reg.set(m.localId, p.id);
  }
  const missing = (route.places || []).filter((pl) => !pl.placeId);
  const dangling = (route.places || []).filter((pl) => pl.placeId && reg.get(pl.id) !== pl.placeId);
  gate('G4 placeId-миграция мест', missing.length === 0 && dangling.length === 0,
    `${(route.places || []).length - missing.length}/${(route.places || []).length} связано` +
    (missing.length ? `; без placeId: ${missing.map((m) => m.id).join(',')}` : '') +
    (dangling.length ? `; расхождение: ${dangling.map((m) => m.id).join(',')}` : ''));
}

// G6 + G7: общие скрипты
for (const [name, script, args] of [
  ['G6 инвентарь-паритет', 'atlas-inventory.js', ['--check']],
  ['G7 реестры валидны', 'atlas-data-check.js', []],
]) {
  try {
    const out = execFileSync('node', [path.join(ROOT, 'scripts', script), ...args], { encoding: 'utf8' });
    gate(name, out.includes('✅'), out.trim().split('\n').pop().slice(0, 140));
  } catch (e) { gate(name, false, String(e.stdout || e.message).slice(0, 140)); }
}

console.log('');
console.log('Чек-лист вне автогейта (закрывается скрин-пакетом в AuditRepo verification/atlas/' + slug + '/):');
console.log('  G3 мобильный контракт (390×844: полноэкран, таргеты ≥44px)');
console.log('  G5 3-секундный тест истории с обзора (1280×900)');
console.log('  G9 owner review — пометка «awaiting G9»');

if (fails) { console.error(`\n❌ atlas:gate:${slug} — красных: ${fails}`); process.exit(1); }
console.log(`\n✅ atlas:gate:${slug} — все автогейты зелёные`);
