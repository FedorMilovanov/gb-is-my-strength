#!/usr/bin/env node
/**
 * External source-link audit with a pragmatic allowlist.
 * Hard-fails browser-invalid links (bad URL, bad TLS/cert, 404/410, banned hosts,
 * non-allowed http). Bot blocks/rate limits (403/405/429/timeouts/5xx) are warnings.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const ROOT = path.resolve(__dirname, '..');
const TIMEOUT_MS = Number(process.env.SOURCE_LINK_TIMEOUT_MS || 10000);
const CONCURRENCY = Number(process.env.SOURCE_LINK_CONCURRENCY || 6);

const hard = [];
const warn = [];
function walk(dir, out=[]) {
  for (const ent of fs.readdirSync(dir,{withFileTypes:true})) {
    if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p,out); else out.push(p);
  }
  return out;
}
function rel(p){ return path.relative(ROOT,p).replace(/\\/g,'/'); }
const BAD_HOSTS = new Set(['arthistoryresources.net']);
const HTTP_ALLOW = [/^http:\/\/www\.w3\.org\//i, /^http:\/\/web\.archive\.org\//i, /^http:\/\/viaf\.org\//i];
const IGNORE_HOSTS = [/^gospod-bog\.ru$/i, /(^|\.)yandex\./i, /^mc\.yandex\./i, /^localhost$/i, /^127\.0\.0\.1$/];
function shouldIgnore(u) { return IGNORE_HOSTS.some(rx => rx.test(u.hostname)); }
function httpAllowed(url) { return HTTP_ALLOW.some(rx => rx.test(url)); }
function classifyError(err) {
  const code = err && (err.code || err.name || err.message || 'ERROR');
  if (/CERT|SSL|HOSTNAME|SELF_SIGNED|UNABLE_TO_VERIFY|DEPTH_ZERO/i.test(String(code))) return 'hard';
  if (/ENOTFOUND|ERR_INVALID_URL|Invalid URL/i.test(String(code))) return 'hard';
  return 'warn';
}
function requestOnce(url, method='HEAD') {
  return new Promise((resolve,reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request(u, {
      method,
      timeout: TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GBSourceAudit/1.0; +https://gospod-bog.ru)',
        'Accept': '*/*',
        ...(method === 'GET' ? { 'Range': 'bytes=0-256' } : {})
      }
    }, res => {
      res.resume();
      resolve({ status: res.statusCode, location: res.headers.location || '', method });
    });
    req.on('timeout', () => { req.destroy(Object.assign(new Error('timeout'), { code:'TIMEOUT' })); });
    req.on('error', reject);
    req.end();
  });
}
async function checkUrl(url) {
  let current = url;
  for (let redirects=0; redirects<4; redirects++) {
    let r;
    try { r = await requestOnce(current, 'HEAD'); }
    catch (e) {
      // Some hosts reject HEAD. Try small GET before deciding.
      try { r = await requestOnce(current, 'GET'); }
      catch (e2) { return { error: e2 }; }
    }
    if ([301,302,303,307,308].includes(r.status) && r.location) {
      current = new URL(r.location, current).href;
      continue;
    }
    if (r.status === 405) {
      try { r = await requestOnce(current, 'GET'); } catch (e) { return { error:e, status:405 }; }
    }
    return { status: r.status, finalUrl: current, method: r.method };
  }
  return { error: Object.assign(new Error('too many redirects'), { code:'REDIRECTS' }) };
}
function extractLinks() {
  const files = walk(ROOT).filter(f => f.endsWith('.html'));
  const map = new Map();
  const hrefRe = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  for (const f of files) {
    const html = fs.readFileSync(f,'utf8');
    let m;
    while ((m = hrefRe.exec(html))) {
      const raw = m[1].replace(/&amp;/g,'&').trim();
      if (!/^https?:\/\//i.test(raw)) continue;
      let u;
      try { u = new URL(raw); } catch { hard.push({ url: raw, file: rel(f), reason:'invalid URL' }); continue; }
      if (shouldIgnore(u)) continue;
      if (!map.has(u.href)) map.set(u.href, new Set());
      map.get(u.href).add(rel(f));
    }
  }
  return [...map.entries()].map(([url,files]) => ({ url, files:[...files] }));
}
async function runPool(items, worker) {
  let i=0;
  async function next() {
    while (i < items.length) {
      const item = items[i++];
      await worker(item);
    }
  }
  await Promise.all(Array.from({length: Math.min(CONCURRENCY, items.length)}, next));
}

(async()=>{
  const links = extractLinks();
  await runPool(links, async item => {
    let u;
    try { u = new URL(item.url); } catch { return; }
    if (BAD_HOSTS.has(u.hostname)) {
      hard.push({ url:item.url, files:item.files, reason:'known browser-bad/SSL-bad host' });
      return;
    }
    if (u.protocol === 'http:' && !httpAllowed(item.url)) {
      hard.push({ url:item.url, files:item.files, reason:'plain http not allowlisted' });
      return;
    }
    const result = await checkUrl(item.url);
    if (result.error) {
      const bucket = classifyError(result.error);
      (bucket === 'hard' ? hard : warn).push({ url:item.url, files:item.files, reason:String(result.error.code || result.error.message || result.error).slice(0,160) });
      return;
    }
    const st = result.status;
    if (st === 404 || st === 410) hard.push({ url:item.url, files:item.files, reason:`HTTP ${st}` });
    else if (st >= 400) warn.push({ url:item.url, files:item.files, reason:`HTTP ${st}` });
  });
  console.log('\nGB SOURCE LINK AUDIT');
  console.log(`Checked external links: ${links.length}`);
  if (warn.length) {
    console.log(`⚠️ Warnings (${warn.length}) — bot blocks/rate limits/timeouts, review if persistent:`);
    warn.slice(0,40).forEach(w => console.log(`- ${w.reason}: ${w.url} (${(w.files||[]).slice(0,3).join(', ')})`));
  }
  if (hard.length) {
    console.log(`❌ Hard errors (${hard.length}):`);
    hard.forEach(h => console.log(`- ${h.reason}: ${h.url} (${(h.files||[h.file]).slice(0,4).join(', ')})`));
    process.exit(1);
  }
  console.log('✅ Source links hard-check passed');
})();
