'use strict';

const base = require('./route-source-contract');
const { normalizeRouteMatrix } = require('./route-matrix-normalizer');

function loadRouteRecords() {
  const loaded = base.loadRouteRecords();
  const normalized = normalizeRouteMatrix(loaded.matrix, loaded.ownership);
  const matrix = normalized.next;
  const records = loaded.records.map((record) => ({
    ...record,
    matrix: matrix.routes?.[record.route] || null,
  }));

  return {
    ...loaded,
    matrix,
    records,
    matrixDiagnostics: {
      derivedRoutes: normalized.derivedRoutes,
      removedMarkers: normalized.removedMarkers,
      ignoredOrphanRoutes: normalized.ignoredOrphanRoutes,
    },
  };
}

module.exports = {
  ...base,
  loadRouteRecords,
};
