#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = process.env.DIST_ROOT || path.join(ROOT, 'dist');
const AUDIT = path.join(__dirname, 'interactive-audit.js');

function contentType(filePath) {
  return {
    '.avif': 'image/avif',
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.xml': 'application/xml; charset=utf-8',
  }[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolveRequestFile(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl || '/', 'http://127.0.0.1').pathname);
  } catch (_) {
    return null;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const filePath = path.resolve(DIST, pathname.replace(/^\/+/, ''));
  const distPrefix = `${path.resolve(DIST)}${path.sep}`;
  if (filePath !== path.resolve(DIST) && !filePath.startsWith(distPrefix)) return null;
  return filePath;
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const filePath = resolveRequestFile(request.url);
      if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        response.statusCode = 404;
        response.end('404');
        return;
      }
      response.setHeader('Content-Type', contentType(filePath));
      response.setHeader('Cache-Control', 'no-store');
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      fs.createReadStream(filePath)
        .on('error', (error) => {
          if (!response.headersSent) response.statusCode = 500;
          response.end(error.message);
        })
        .pipe(response);
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function runAudit(baseUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [AUDIT, ...process.argv.slice(2)], {
      cwd: ROOT,
      env: { ...process.env, AUDIT_BASE: baseUrl },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) {
        console.error(`Interactive audit terminated by signal ${signal}`);
        resolve(1);
        return;
      }
      resolve(code == null ? 1 : code);
    });
  });
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
}

(async () => {
  const explicitBase = String(process.env.AUDIT_BASE || '').trim().replace(/\/$/, '');
  if (explicitBase) {
    process.exitCode = await runAudit(explicitBase);
    return;
  }
  if (!fs.existsSync(DIST) || !fs.statSync(DIST).isDirectory()) {
    throw new Error(`dist not found at ${DIST} — run npm run strangler:build:production-like first`);
  }

  const server = await startServer();
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Interactive audit local dist server: ${baseUrl}`);
  try {
    process.exitCode = await runAudit(baseUrl);
  } finally {
    await closeServer(server);
  }
})().catch((error) => {
  console.error('FATAL', error);
  process.exitCode = 1;
});
