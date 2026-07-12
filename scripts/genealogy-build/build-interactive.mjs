#!/usr/bin/env node
/**
 * build-interactive.mjs — впрыск графа в HTML-шаблон интерактивного прототипа.
 *
 * Читает interactive-template.html (тело: <style>…<div id="app">…<script>) и
 * genealogy-graph.json, заменяет плейсхолдер /*__GRAPH__*\/ на JSON, и пишет:
 *   1) data/genealogy/v2/build/genealogy-interactive.html — самодостаточный документ;
 *   2) <scratchpad>/genealogy-interactive.artifact.html   — тело для публикации артефактом.
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

async function main() {
  const tpl = await readFile(path.join(HERE, 'interactive-template.html'), 'utf8');
  const graph = await readFile(path.join(OUT, 'genealogy-graph.json'), 'utf8');
  const json = JSON.stringify(JSON.parse(graph));            // компактно
  if (!tpl.includes('/*__GRAPH__*/')) throw new Error('плейсхолдер /*__GRAPH__*/ не найден в шаблоне');
  const body = tpl.replace('/*__GRAPH__*/', json);

  // артефакт: только тело (обёртку <head> добавляет паблишер)
  await writeFile(path.join(SCRATCH, 'genealogy-interactive.artifact.html'), body);

  // самодостаточный документ для репозитория
  const doc = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Живое древо — Генеалогия Спасителя (интерактив)</title>
</head>
<body>
${body}
</body>
</html>
`;
  await writeFile(path.join(OUT, 'genealogy-interactive.html'), doc);
  console.log(`[build-interactive] тело ${body.length} симв. · граф ${json.length} симв. → artifact + standalone`);
}

main().catch(e => { console.error(e); process.exit(1); });
