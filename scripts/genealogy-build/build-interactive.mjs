#!/usr/bin/env node
/**
 * build-interactive.mjs — впрыск графа в общий HTML-движок интерактива.
 *
 * Один движок (interactive-template.html, тело: <style>…<div id="app">…<script>)
 * питается разными графами (та же схема nodes/edges/families/iconDefs). Плейсхолдер
 * /*__GRAPH__*\/ заменяется на JSON. Для каждого графа пишем самодостаточный
 * документ в build/ и «тело» для публикации артефактом в scratchpad.
 *
 * Цели:
 *   1) Живое древо — genealogy-graph.json → genealogy-interactive.html
 *   2) Карта народов — nations-graph.json → nations-interactive.html
 *
 * Pure Node, без зависимостей. Детерминизм.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(ROOT, 'data', 'genealogy', 'v2', 'build');
const SCRATCH = process.argv[2] || '/tmp/claude-0/-home-user/929a9a64-a6ab-5e37-bb8c-a4e74ec5a4cf/scratchpad';

const TARGETS = [
  { graph: 'genealogy-graph.json', out: 'genealogy-interactive.html', artifact: 'genealogy-interactive.artifact.html', title: 'Живое древо — Генеалогия Спасителя (интерактив)',
    h1: 'Живое древо', sub: 'Генеалогия Спасителя · интерактив' },
  { graph: 'nations-graph.json',   out: 'nations-interactive.html',   artifact: 'nations-interactive.artifact.html',   title: 'Карта народов — Таблица народов (Бытие 10)',
    h1: 'Карта народов', sub: 'Таблица народов · Бытие 10 · интерактив' },
];

const HEADER_TPL = '<h1>Живое древо</h1><p>Генеалогия Спасителя · интерактив</p>';

async function build(tpl, t) {
  const json = JSON.stringify(JSON.parse(await readFile(path.join(OUT, t.graph), 'utf8')));
  let body = tpl.replace('/*__GRAPH__*/', json);
  if (!body.includes(HEADER_TPL)) throw new Error('шапка-плейсхолдер не найдена в шаблоне');
  body = body.replace(HEADER_TPL, `<h1>${t.h1}</h1><p>${t.sub}</p>`);
  await writeFile(path.join(SCRATCH, t.artifact), body);
  const doc = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t.title}</title>
</head>
<body>
${body}
</body>
</html>
`;
  await writeFile(path.join(OUT, t.out), doc);
  console.log(`[build-interactive] ${t.out} · тело ${body.length} симв. · граф ${json.length} симв.`);
}

async function main() {
  const tpl = await readFile(path.join(HERE, 'interactive-template.html'), 'utf8');
  if (!tpl.includes('/*__GRAPH__*/')) throw new Error('плейсхолдер /*__GRAPH__*/ не найден в шаблоне');
  for (const t of TARGETS) {
    try { await build(tpl, t); }
    catch (e) { if (e.code === 'ENOENT') console.warn(`[build-interactive] пропуск ${t.graph} (нет файла)`); else throw e; }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
