'use strict';

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasEngineAvailabilityGuard(source) {
  return /if\s*\(\s*!window\.MapEngine\s*\|\|\s*typeof\s+window\.MapEngine\.createMap\s*!==\s*['"]function['"]\s*\)\s*\{?[\s\S]{0,240}?throw\s+new\s+Error\s*\(/.test(String(source || ''));
}

function findFailClosedCreateMap(source) {
  const text = String(source || '');
  const assignment = /(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*window\.MapEngine\.createMap\s*\(/g;
  let match;

  while ((match = assignment.exec(text))) {
    const variable = match[1];
    const tail = text.slice(match.index, match.index + 2400);
    const readyIndex = tail.search(/setAttribute\(\s*['"]data-map-state['"]\s*,\s*['"]ready['"]\s*\)/);
    const guard = new RegExp(
      'if\\s*\\(\\s*!\\s*' + escapeRegExp(variable) + '\\s*\\)\\s*(?:\\{\\s*)?throw\\s+new\\s+Error\\s*\\('
    );
    const guardMatch = guard.exec(tail);

    if (guardMatch && (readyIndex === -1 || guardMatch.index < readyIndex)) {
      return { variable, assignmentIndex: match.index, guardIndex: match.index + guardMatch.index };
    }
  }
  return null;
}

function inspectMapInitSource(source) {
  const createMap = findFailClosedCreateMap(source);
  return {
    engineGuard: hasEngineAvailabilityGuard(source),
    createMapAssigned: Boolean(createMap),
    nullGuardBeforeReady: Boolean(createMap),
    resultVariable: createMap?.variable || null,
  };
}

function hasFailClosedMapInit(source) {
  const result = inspectMapInitSource(source);
  return result.engineGuard && result.createMapAssigned && result.nullGuardBeforeReady;
}

module.exports = {
  findFailClosedCreateMap,
  hasEngineAvailabilityGuard,
  hasFailClosedMapInit,
  inspectMapInitSource,
};
