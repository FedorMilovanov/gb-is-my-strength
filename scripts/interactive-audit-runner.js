#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = process.env.DIST_ROOT || path.join(ROOT, 'dist');
const AUDIT = path.join(__dirname, 'interactive-audit.js');
const HERMENEVTIKA_REGRESSION_GUARD = path.join(__dirname, 'hermenevtika-regression-guard.mjs');
const STANDALONE_READER_LAYOUT_GUARD = path.join(__dirname, 'standalone-reader-layout-guard.mjs');
const ARTICLE_CONTROL_CENSUS = path.join(__dirname, 'article-controls-browser-contract.mjs');
const HOME_DESIGN_AUDIT = path.join(__dirname, 'home-design-audit-pro.mjs');
const HOME_DESIGN_REPORT = path.join(ROOT, 'reports', 'home-design-audit-pro');
const INTERACTIVE_REPORT = path.join(ROOT, 'reports', 'interactive-audit');

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

function runNodeScript(script, args = [], extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: ROOT,
      env: { ...process.env, ...extraEnv },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) {
        console.error(`${path.basename(script)} terminated by signal ${signal}`);
        resolve(1);
        return;
      }
      resolve(code == null ? 1 : code);
    });
  });
}

function runAudit(baseUrl) {
  return runNodeScript(AUDIT, process.argv.slice(2), { AUDIT_BASE: baseUrl });
}

function runHermenevtikaRegressionGuard(baseUrl) {
  if (!fs.existsSync(HERMENEVTIKA_REGRESSION_GUARD)) {
    throw new Error(`Hermenevtika regression guard is missing at ${HERMENEVTIKA_REGRESSION_GUARD}`);
  }
  return runNodeScript(HERMENEVTIKA_REGRESSION_GUARD, [], { AUDIT_BASE: baseUrl });
}

function runStandaloneReaderLayoutGuard(baseUrl) {
  if (!fs.existsSync(STANDALONE_READER_LAYOUT_GUARD)) {
    throw new Error(`Standalone reader layout guard is missing at ${STANDALONE_READER_LAYOUT_GUARD}`);
  }
  return runNodeScript(STANDALONE_READER_LAYOUT_GUARD, [], { AUDIT_BASE: baseUrl });
}

function runArticleControlCensus(baseUrl) {
  if (!fs.existsSync(ARTICLE_CONTROL_CENSUS)) {
    throw new Error(`Article control census is missing at ${ARTICLE_CONTROL_CENSUS}`);
  }
  return runNodeScript(ARTICLE_CONTROL_CENSUS, [], { AUDIT_BASE: baseUrl });
}

async function runInteractiveContracts(baseUrl) {
  const auditCode = await runAudit(baseUrl);
  if (auditCode !== 0) return auditCode;
  const tooltipCode = await runHermenevtikaRegressionGuard(baseUrl);
  if (tooltipCode !== 0) return tooltipCode;
  const standaloneCode = await runStandaloneReaderLayoutGuard(baseUrl);
  if (standaloneCode !== 0) return standaloneCode;
  return runArticleControlCensus(baseUrl);
}

async function runHomeDesignAudits() {
  if (!fs.existsSync(HOME_DESIGN_AUDIT)) {
    throw new Error(`Home Design Audit Pro is missing at ${HOME_DESIGN_AUDIT}`);
  }

  fs.rmSync(HOME_DESIGN_REPORT, { recursive: true, force: true });
  for (const browser of ['chromium', 'webkit']) {
    console.log(`Home Design Audit Pro: ${browser}`);
    const code = await runNodeScript(HOME_DESIGN_AUDIT, [], { HOME_DESIGN_BROWSER: browser });
    if (code !== 0) return code;
  }

  const artifactTarget = path.join(INTERACTIVE_REPORT, 'home-design-audit-pro');
  fs.rmSync(artifactTarget, { recursive: true, force: true });
  fs.mkdirSync(INTERACTIVE_REPORT, { recursive: true });
  fs.cpSync(HOME_DESIGN_REPORT, artifactTarget, { recursive: true });
  return 0;
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
}

(async () => {
  const explicitBase = String(process.env.AUDIT_BASE || '').trim().replace(/\/$/, '');
  if (explicitBase) {
    const auditCode = await runInteractiveContracts(explicitBase);
    process.exitCode = auditCode === 0 ? await runHomeDesignAudits() : auditCode;
    return;
  }
  if (!fs.existsSync(DIST) || !fs.statSync(DIST).isDirectory()) {
    throw new Error(`dist not found at ${DIST} — run npm run strangler:build:production-like first`);
  }

  const server = await startServer();
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Interactive audit local dist server: ${baseUrl}`);
  let auditCode = 1;
  try {
    auditCode = await runInteractiveContracts(baseUrl);
  } finally {
    await closeServer(server);
  }
  process.exitCode = auditCode === 0 ? await runHomeDesignAudits() : auditCode;
})().catch((error) => {
  console.error('FATAL', error);
  process.exitCode = 1;
});
