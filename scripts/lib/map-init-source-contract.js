'use strict';

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findEngineAvailabilityGuard(source) {
  const text = String(source || '');
  const pattern = /if\s*\(\s*!window\.MapEngine\s*\|\|\s*typeof\s+window\.MapEngine\.createMap\s*!==\s*['"]function['"]\s*\)\s*\{?[\s\S]{0,240}?throw\s+new\s+Error\s*\(/g;
  const match = pattern.exec(text);
  return match ? { index: match.index } : null;
}

function findCreateMapAssignment(source) {
  const text = String(source || '');
  const pattern = /(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*window\.MapEngine\.createMap\s*\(/g;
  const match = pattern.exec(text);
  return match ? { variable: match[1], index: match.index } : null;
}

function findNullGuardBeforeReady(source, assignment) {
  if (!assignment) return null;
  const text = String(source || '');
  const tail = text.slice(assignment.index, assignment.index + 2400);
  const readyIndex = tail.search(/setAttribute\(\s*['"]data-map-state['"]\s*,\s*['"]ready['"]\s*\)/);
  const guard = new RegExp(
    'if\\s*\\(\\s*!\\s*' + escapeRegExp(assignment.variable) + '\\s*\\)\\s*(?:\\{\\s*)?throw\\s+new\\s+Error\\s*\\('
  );
  const match = guard.exec(tail);
  if (!match || (readyIndex !== -1 && match.index >= readyIndex)) return null;
  return { index: assignment.index + match.index };
}

function inspectMapInitSource(source) {
  const text = String(source || '');
  const assignment = findCreateMapAssignment(text);
  const engineGuard = findEngineAvailabilityGuard(text);
  const nullGuard = findNullGuardBeforeReady(text, assignment);
  return {
    engineGuard: Boolean(assignment && engineGuard && engineGuard.index < assignment.index),
    createMapAssigned: Boolean(assignment),
    nullGuardBeforeReady: Boolean(nullGuard),
    resultVariable: assignment?.variable || null,
  };
}

function hasFailClosedMapInit(source) {
  const result = inspectMapInitSource(source);
  return result.engineGuard && result.createMapAssigned && result.nullGuardBeforeReady;
}

module.exports = {
  findCreateMapAssignment,
  findEngineAvailabilityGuard,
  findNullGuardBeforeReady,
  hasFailClosedMapInit,
  inspectMapInitSource,
};
