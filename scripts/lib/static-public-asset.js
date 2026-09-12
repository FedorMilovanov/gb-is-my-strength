'use strict';

const fs = require('fs');
const path = require('path');

function normalizePublicAssetPath(value) {
  const raw = String(value || '').split(/[?#]/, 1)[0].trim();
  if (!raw.startsWith('/') || raw.startsWith('//')) return '';
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return '';
  }
  const rel = decoded.replace(/^\/+/, '').replace(/\\/g, '/');
  if (!rel || rel.includes('\0') || rel.split('/').includes('..')) return '';
  if (rel === 'public' || rel.startsWith('public/')) return '';
  return rel;
}

function staticAssetCandidates(root, publicPath) {
  const rel = normalizePublicAssetPath(publicPath);
  if (!rel) return [];
  return [
    path.join(root, 'public', rel),
    path.join(root, rel),
  ];
}

function resolveStaticAsset(root, publicPath) {
  for (const candidate of staticAssetCandidates(root, publicPath)) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // Missing, inaccessible or non-file candidates are not static assets.
    }
  }
  return null;
}

function staticAssetExists(root, publicPath) {
  return resolveStaticAsset(root, publicPath) !== null;
}

function repositoryStaticAssetPath(root, publicPath) {
  const resolved = resolveStaticAsset(root, publicPath);
  return resolved ? path.relative(root, resolved).replace(/\\/g, '/') : '';
}

module.exports = {
  normalizePublicAssetPath,
  staticAssetCandidates,
  resolveStaticAsset,
  staticAssetExists,
  repositoryStaticAssetPath,
};
