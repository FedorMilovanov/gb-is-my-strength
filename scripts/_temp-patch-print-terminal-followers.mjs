#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const runtimePath = 'js/print-pagination.js';
let runtime = fs.readFileSync(runtimePath, 'utf8');

runtime = replaceOnce(runtime,
`  function markTerminalRegion(group, scope) {
    var count = 0;
    var nodes = [];
    try { nodes = Array.prototype.slice.call((scope || document).querySelectorAll('*')); } catch (_) {}
    for (var i = 0; i < nodes.length; i++) {
      if (!precedes(group, nodes[i])) continue;
      mark(nodes[i], 'data-print-terminal-flow', '1');
      count += 1;
    }
    var terminal = group.parentElement;
    while (terminal && terminal !== document.body && terminal !== document.documentElement) {
      mark(terminal, 'data-print-terminal-flow', '1');
      count += 1;
      terminal = terminal.parentElement;
    }
    return count;
  }`,
`  function hasMeaningfulFollowingContent(anchor, scope) {
    var nodes = [];
    try { nodes = Array.prototype.slice.call((scope || document).querySelectorAll('*')); } catch (_) {}
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!precedes(anchor, node) || !isVisible(node)) continue;
      var text = String(node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim();
      if (text.length > 0) return true;
      if (node.matches && node.matches('img,svg,canvas,video,table,figure')) return true;
    }
    return false;
  }

  function markTerminalRegion(group, scope) {
    var result = { flow: 0, followers: 0 };
    var nodes = [];
    try { nodes = Array.prototype.slice.call((scope || document).querySelectorAll('*')); } catch (_) {}
    for (var i = 0; i < nodes.length; i++) {
      if (!precedes(group, nodes[i])) continue;
      mark(nodes[i], 'data-print-terminal-flow', '1');
      mark(nodes[i], 'data-print-terminal-follower', '1');
      result.flow += 1;
      result.followers += 1;
    }
    var terminal = group.parentElement;
    while (terminal && terminal !== document.body && terminal !== document.documentElement) {
      mark(terminal, 'data-print-terminal-flow', '1');
      result.flow += 1;
      terminal = terminal.parentElement;
    }
    return result;
  }`,
'print terminal helpers');

runtime = replaceOnce(runtime,
`      '  html body [data-print-terminal-flow] { break-before: auto !important; page-break-before: auto !important; break-after: auto !important; page-break-after: auto !important; }',`,
`      '  html body [data-print-terminal-flow] { min-height: 0 !important; height: auto !important; break-before: auto !important; page-break-before: auto !important; break-after: auto !important; page-break-after: auto !important; }',
      '  html body [data-print-terminal-follower] { display: none !important; }',`,
'print terminal CSS');

runtime = replaceOnce(runtime,
`      nodes[i].removeAttribute('data-print-terminal-flow');`,
`      nodes[i].removeAttribute('data-print-terminal-flow');
      nodes[i].removeAttribute('data-print-terminal-follower');`,
'print terminal cleanup');

runtime = replaceOnce(runtime,
`var stats = { candidates: candidates.length, atomic: 0, splittable: 0, rows: 0, keepNext: 0, tailPairs: 0, closingGroups: 0, terminalFlow: 0, tails: 0 };`,
`var stats = { candidates: candidates.length, atomic: 0, splittable: 0, rows: 0, keepNext: 0, tailPairs: 0, closingGroups: 0, terminalFlow: 0, terminalFollowers: 0, nonTerminalTails: 0, tails: 0 };`,
'print terminal stats');

runtime = replaceOnce(runtime,
`      stats.tails += 1;
      var previous = previousSemanticFlow(tail, scope, candidates);`,
`      stats.tails += 1;
      if (hasMeaningfulFollowingContent(tail, scope)) {
        stats.nonTerminalTails += 1;
        continue;
      }
      var previous = previousSemanticFlow(tail, scope, candidates);`,
'non-terminal tail guard');

runtime = replaceOnce(runtime,
`        if (group) {
          stats.terminalFlow += markTerminalRegion(group, scope);
          stats.tailPairs += 1;`,
`        if (group) {
          var terminalRegion = markTerminalRegion(group, scope);
          stats.terminalFlow += terminalRegion.flow;
          stats.terminalFollowers += terminalRegion.followers;
          stats.tailPairs += 1;`,
'print terminal grouping');

fs.writeFileSync(runtimePath, runtime, 'utf8');

const sweepPath = 'scripts/engine-sweep.mjs';
let sweep = fs.readFileSync(sweepPath, 'utf8');
sweep = replaceOnce(sweep,
`    const terminalNodes = [...document.querySelectorAll('[data-print-terminal-flow]')];`,
`    const terminalNodes = [...document.querySelectorAll('[data-print-terminal-flow]')];
    const terminalFollowers = [...document.querySelectorAll('[data-print-terminal-follower]')];`,
'engine sweep terminal followers');
sweep = replaceOnce(sweep,
`      terminalNodes: terminalNodes.length, forcedTerminalBreaks: forcedTerminalBreaks.slice(0, 8).map((node) => ({ tag: node.tagName, className: typeof node.className === 'string' ? node.className.slice(0, 120) : '' })),`,
`      terminalNodes: terminalNodes.length, terminalFollowers: terminalFollowers.length, forcedTerminalBreaks: forcedTerminalBreaks.slice(0, 8).map((node) => ({ tag: node.tagName, className: typeof node.className === 'string' ? node.className.slice(0, 120) : '' })),`,
'engine sweep terminal report');
sweep = replaceOnce(sweep,
`  R(id, 'print: terminal region has no forced page breaks', pagination.terminalNodes > 0 && pagination.forcedTerminalBreaks.length === 0, JSON.stringify({ terminalNodes: pagination.terminalNodes, forced: pagination.forcedTerminalBreaks }));`,
`  R(id, 'print: terminal region has no forced page breaks',
    (pagination.report?.stats?.closingGroups === 0 || pagination.terminalNodes > 0) && pagination.forcedTerminalBreaks.length === 0,
    JSON.stringify({ closingGroups: pagination.report?.stats?.closingGroups, terminalNodes: pagination.terminalNodes, terminalFollowers: pagination.terminalFollowers, forced: pagination.forcedTerminalBreaks }));
  R(id, 'print: in-flow closing marks are not misclassified as terminal',
    id !== 'paginate-book' || (pagination.report?.stats?.nonTerminalTails > 0 && pagination.firstGroups === 0 && pagination.secondGroups === 0),
    JSON.stringify({ id, nonTerminalTails: pagination.report?.stats?.nonTerminalTails, firstGroups: pagination.firstGroups, secondGroups: pagination.secondGroups }));`,
'engine sweep terminal assertions');
fs.writeFileSync(sweepPath, sweep, 'utf8');

execFileSync(process.execPath, ['--check', runtimePath], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js'], { stdio: 'inherit' });
console.log('Print terminal follower patch materialized.');
