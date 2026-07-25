#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

function replaceRegexOnce(source, pattern, replacement, label) {
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
  const matches = [...source.matchAll(new RegExp(pattern.source, flags))];
  if (matches.length !== 1) throw new Error(`${label}: expected one match, found ${matches.length}`);
  return source.replace(pattern, replacement);
}

function insertAfterUniqueLine(source, marker, line, label) {
  const lines = source.split('\n');
  const hits = lines.map((value, index) => value.includes(marker) ? index : -1).filter((index) => index >= 0);
  if (hits.length !== 1) throw new Error(`${label}: expected one marker line, found ${hits.length}`);
  lines.splice(hits[0] + 1, 0, line);
  return lines.join('\n');
}

const runtimePath = 'js/print-pagination.js';
let runtime = fs.readFileSync(runtimePath, 'utf8');

runtime = replaceRegexOnce(
  runtime,
  /  function markTerminalRegion\(group, scope\) \{[\s\S]*?\n  \}\n\n  function classifyCandidates/,
`  function hasMeaningfulFollowingContent(anchor, scope) {
    var nodes = [];
    try { nodes = Array.prototype.slice.call((scope || document).querySelectorAll('p,li,dt,dd,h1,h2,h3,h4,h5,h6,table,figure,blockquote,pre,section,article,[data-pagefind-body]')); } catch (_) {}
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!precedes(anchor, node) || !isVisible(node)) continue;
      var text = String(node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim();
      if (text.length > 0) return true;
      if (node.matches && node.matches('img,svg,canvas,video,table,figure')) return true;
    }
    return false;
  }

  function isMeaningfulPrintBlock(node) {
    if (!isVisible(node)) return false;
    var text = String(node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim();
    if (text.length > 0) return true;
    return !!(node.matches && node.matches('img,svg,canvas,video,table,figure'));
  }

  function findTerminalAnchor(root, scope) {
    var selector = 'p,li,dt,dd,h1,h2,h3,h4,h5,h6,table,figure,blockquote,pre,.timeline-entry,.timeline-card,.chronology-item,.milestone,.event-item,.history-item,.note-box,.info-box,.warn-box,.quote-box,.summary-card,.callout,.fact-card,.source-card,.author-card,.series-map,.series-roadmap,.series-overview,.overview-grid,.diagram,.diagram-card,[data-print-tail]';
    var nodes = [];
    try { nodes = Array.prototype.slice.call((root || scope || document).querySelectorAll(selector)); } catch (_) {}
    var last = null;
    for (var i = 0; i < nodes.length; i++) {
      if (isMeaningfulPrintBlock(nodes[i])) last = nodes[i];
    }
    return last || root || null;
  }

  function markTerminalRegion(anchor, scope) {
    var result = { flow: 0, followers: 0 };
    if (!anchor) return result;
    mark(document.documentElement, 'data-print-terminal-root', '1');
    mark(document.body, 'data-print-terminal-root', '1');
    var nodes = [];
    try { nodes = Array.prototype.slice.call((scope || document).querySelectorAll('*')); } catch (_) {}
    for (var i = 0; i < nodes.length; i++) {
      if (!precedes(anchor, nodes[i])) continue;
      mark(nodes[i], 'data-print-terminal-flow', '1');
      mark(nodes[i], 'data-print-terminal-follower', '1');
      result.flow += 1;
      result.followers += 1;
    }
    var terminal = anchor.parentElement;
    while (terminal && terminal !== document.body && terminal !== document.documentElement) {
      mark(terminal, 'data-print-terminal-flow', '1');
      result.flow += 1;
      terminal = terminal.parentElement;
    }
    return result;
  }

  function classifyCandidates`,
  'semantic terminal helper boundary'
);

runtime = runtime
  .replace(/^\s*'  \/\* GB_PRINT_TERMINAL_SEAL_V2_CSS \*\/',$\n/gm, '')
  .replace(/^\s*'  [^'\n]*data-print-terminal-root[^'\n]*',$\n/gm, '')
  .replace(/^\s*'  [^'\n]*data-print-terminal-flow[^'\n]*',$\n/gm, '')
  .replace(/^\s*'  [^'\n]*data-print-terminal-follower[^'\n]*',$\n/gm, '');

const cssAnchor = `      '  html body [data-print-flow] { box-shadow: none; }',`;
const cssHits = runtime.split(cssAnchor).length - 1;
if (cssHits !== 1) throw new Error(`semantic terminal CSS anchor: expected one match, found ${cssHits}`);
const canonicalTerminalCss = `      '  /* GB_PRINT_TERMINAL_SEAL_V2_CSS */',
      '  html[data-print-terminal-root], html[data-print-terminal-root] body { min-height: 0 !important; height: auto !important; padding-bottom: 0 !important; margin-bottom: 0 !important; overflow: visible !important; break-after: auto !important; page-break-after: auto !important; }',
      '  html body [data-print-terminal-flow] { min-height: 0 !important; height: auto !important; padding-bottom: 0 !important; margin-bottom: 0 !important; overflow: visible !important; break-before: auto !important; page-break-before: auto !important; break-after: auto !important; page-break-after: auto !important; }',
      '  html[data-print-terminal-root]::before, html[data-print-terminal-root]::after, html[data-print-terminal-root] body::before, html[data-print-terminal-root] body::after, html body [data-print-terminal-flow]::before, html body [data-print-terminal-flow]::after { break-before: auto !important; page-break-before: auto !important; break-after: auto !important; page-break-after: auto !important; }',
      '  html body [data-print-terminal-follower] { display: none !important; }',`;
runtime = runtime.replace(cssAnchor, `${canonicalTerminalCss}\n${cssAnchor}`);

if (!runtime.includes("nodes[i].removeAttribute('data-print-terminal-follower');")) {
  runtime = insertAfterUniqueLine(runtime, "nodes[i].removeAttribute('data-print-terminal-flow');", "      nodes[i].removeAttribute('data-print-terminal-follower');", 'terminal follower cleanup');
}
if (!runtime.includes("nodes[i].removeAttribute('data-print-terminal-root');")) {
  runtime = insertAfterUniqueLine(runtime, "nodes[i].removeAttribute('data-print-terminal-follower');", "      nodes[i].removeAttribute('data-print-terminal-root');", 'terminal root cleanup');
}

runtime = replaceRegexOnce(
  runtime,
  /var stats = \{ candidates: candidates\.length,[^\n;]+\};/,
`var stats = { candidates: candidates.length, atomic: 0, splittable: 0, rows: 0, keepNext: 0, tailPairs: 0, closingGroups: 0, terminalFlow: 0, terminalFollowers: 0, terminalAnchors: 0, nonTerminalTails: 0, tails: 0 };`,
  'semantic terminal stats line'
);

if (!runtime.includes('hasMeaningfulFollowingContent(tail, scope)')) {
  runtime = insertAfterUniqueLine(
    runtime,
    'stats.tails += 1;',
`      if (hasMeaningfulFollowingContent(tail, scope)) {
        stats.nonTerminalTails += 1;
        continue;
      }`,
    'non-terminal tail guard'
  );
}

runtime = replaceRegexOnce(
  runtime,
  /        if \(group\) \{\n(?:          var terminalRegion = markTerminalRegion\(group, scope\);\n          stats\.terminalFlow \+= terminalRegion\.flow;\n          stats\.terminalFollowers \+= terminalRegion\.followers;|          stats\.terminalFlow \+= markTerminalRegion\(group, scope\);)\n          stats\.tailPairs \+= 1;/,
`        if (group) {
          stats.tailPairs += 1;`,
  'deferred terminal sealing block'
);

runtime = replaceRegexOnce(
  runtime,
  /    \}\n    return stats;\n  \}\n\n  function prepare\(\) \{/,
`    }
    var terminalAnchor = closingGroups.length ? closingGroups[closingGroups.length - 1].group : findTerminalAnchor(root, scope);
    if (terminalAnchor) {
      var terminalRegion = markTerminalRegion(terminalAnchor, scope);
      stats.terminalFlow += terminalRegion.flow;
      stats.terminalFollowers += terminalRegion.followers;
      stats.terminalAnchors += 1;
    }
    return stats;
  }

  function prepare() {`,
  'actual terminal anchor sealing'
);

fs.writeFileSync(runtimePath, runtime, 'utf8');

const sweepPath = 'scripts/engine-sweep.mjs';
let sweep = fs.readFileSync(sweepPath, 'utf8');
if (!sweep.includes("const terminalFollowers = [...document.querySelectorAll('[data-print-terminal-follower]')];")) {
  sweep = insertAfterUniqueLine(sweep, "const terminalNodes = [...document.querySelectorAll('[data-print-terminal-flow]')];", "    const terminalFollowers = [...document.querySelectorAll('[data-print-terminal-follower]')];", 'engine sweep terminal followers');
}

sweep = replaceRegexOnce(
  sweep,
  /      terminalNodes: terminalNodes\.length,[^\n]+forcedTerminalBreaks:[^\n]+/,
`      terminalNodes: terminalNodes.length, terminalFollowers: terminalFollowers.length, forcedTerminalBreaks: forcedTerminalBreaks.slice(0, 8).map((node) => ({ tag: node.tagName, className: typeof node.className === 'string' ? node.className.slice(0, 120) : '' })),`,
  'engine sweep terminal report'
);

sweep = replaceRegexOnce(
  sweep,
  /  R\(id, 'print: terminal region has no forced page breaks',[\s\S]*?\n  R\(id, 'print: source semantic order is restored after every reset',/,
`  R(id, 'print: actual terminal semantic region is sealed',
    pagination.report?.stats?.terminalAnchors === 1 && pagination.terminalNodes > 0 && pagination.forcedTerminalBreaks.length === 0,
    JSON.stringify({ terminalAnchors: pagination.report?.stats?.terminalAnchors, terminalNodes: pagination.terminalNodes, terminalFollowers: pagination.terminalFollowers, forced: pagination.forcedTerminalBreaks }));
  R(id, 'print: in-flow closing marks remain in document order',
    id !== 'paginate-book' || (pagination.report?.stats?.nonTerminalTails > 0 && pagination.firstGroups === 0 && pagination.secondGroups === 0),
    JSON.stringify({ id, nonTerminalTails: pagination.report?.stats?.nonTerminalTails, firstGroups: pagination.firstGroups, secondGroups: pagination.secondGroups }));
  R(id, 'print: source semantic order is restored after every reset',`,
  'engine sweep terminal assertions'
);

fs.writeFileSync(sweepPath, sweep, 'utf8');

execFileSync(process.execPath, ['--check', runtimePath], { stdio: 'inherit' });
execFileSync(process.execPath, ['--check', sweepPath], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js'], { stdio: 'inherit' });
console.log('Actual terminal semantic boundary patch materialized.');
