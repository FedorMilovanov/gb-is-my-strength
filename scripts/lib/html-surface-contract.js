'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SITE_ORIGIN = 'https://gospod-bog.ru';
const SITE_NAME = 'Господь Бог — Сила Моя';

function routeToHtmlFile(root, route) {
  const clean = String(route || '/').split(/[?#]/, 1)[0];
  if (clean === '/') return path.join(root, 'index.html');
  if (clean.endsWith('/')) return path.join(root, clean.replace(/^\/+/, ''), 'index.html');
  return path.join(root, clean.replace(/^\/+/, ''));
}

function stripSvg(html) {
  return String(html || '').replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ');
}

function getAttr(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tag.match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2] ?? null;
}

function tags(html, tagName) {
  return [...String(html || '').matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi'))].map((match) => match[0]);
}

function metaContent(html, key, attr = 'property') {
  for (const tag of tags(html, 'meta')) {
    if ((getAttr(tag, attr) || '').toLowerCase() === key.toLowerCase()) return getAttr(tag, 'content') || '';
  }
  return '';
}

function canonicalHref(html) {
  for (const tag of tags(html, 'link')) {
    const rel = (getAttr(tag, 'rel') || '').toLowerCase().split(/\s+/);
    if (rel.includes('canonical')) return getAttr(tag, 'href') || '';
  }
  return '';
}

function normalizeTitle(value) {
  let title = String(value || '').replace(/\s+/g, ' ').trim();
  for (const suffix of [` — ${SITE_NAME}`, ` | ${SITE_NAME}`, ' | Господь Бог']) {
    if (title.endsWith(suffix)) {
      title = title.slice(0, -suffix.length).trim();
      break;
    }
  }
  return title;
}

function localPathExists(root, pathname) {
  const clean = decodeURIComponent(String(pathname || '/')).replace(/^\/+/, '');
  if (!clean) return fs.existsSync(path.join(root, 'index.html'));
  const direct = path.join(root, clean);
  if (fs.existsSync(direct)) return true;
  if (clean.endsWith('/')) return fs.existsSync(path.join(root, clean, 'index.html'));
  return fs.existsSync(path.join(root, clean, 'index.html'));
}

function resolveLocalReference(raw, route) {
  const value = String(raw || '').trim();
  if (!value || value.startsWith('#') || /^(?:data|blob|mailto|tel|sms|javascript):/i.test(value)) return null;
  if (value.startsWith('//')) {
    const parsed = new URL(`https:${value}`);
    return parsed.origin === SITE_ORIGIN ? parsed : null;
  }
  try {
    const parsed = new URL(value, `${SITE_ORIGIN}${route}`);
    return parsed.origin === SITE_ORIGIN ? parsed : null;
  } catch {
    return { invalid: true, raw: value };
  }
}

function srcsetCandidates(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function extractJsonLdBlocks(html) {
  return [...String(html || '').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => /\btype\s*=\s*["']application\/ld\+json["']/i.test(match[1] || ''))
    .map((match) => match[2] || '');
}

function flattenSchemas(value) {
  const roots = Array.isArray(value) ? value : [value];
  const out = [];
  for (const root of roots) {
    if (root && Array.isArray(root['@graph'])) out.push(...root['@graph']);
    else out.push(root);
  }
  return out.filter(Boolean);
}

function normQuestion(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[«»“”"'’–—-]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^q\d+\s+/, '')
    .trim();
}

function auditInlineScripts(html, issue) {
  let index = 0;
  for (const match of String(html || '').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    index += 1;
    const attrs = match[1] || '';
    const code = match[2] || '';
    if (/\bsrc\s*=\s*/i.test(attrs)) continue;
    if (/\btype\s*=\s*["'](?:application\/(?:ld\+json|json)|module)["']/i.test(attrs)) continue;
    if (!code.trim()) continue;
    try {
      new vm.Script(code, { filename: `inline-script-${index}` });
    } catch (error) {
      issue('error', 'inline-script-syntax', `inline script #${index}: ${error.message}`);
    }
  }
}

function auditFaqParity(html, issue) {
  const ldQuestions = [];
  for (const raw of extractJsonLdBlocks(html)) {
    let parsed;
    try {
      parsed = JSON.parse(raw.trim());
    } catch (error) {
      issue('error', 'jsonld-parse', `invalid JSON-LD: ${error.message}`);
      continue;
    }
    for (const schema of flattenSchemas(parsed)) {
      if (schema?.['@type'] !== 'FAQPage' || !Array.isArray(schema.mainEntity)) continue;
      for (const question of schema.mainEntity) {
        if (question?.['@type'] === 'Question' && String(question.name || '').trim()) {
          ldQuestions.push(String(question.name).trim());
        }
      }
    }
  }

  const accordionQuestions = [...String(html || '').matchAll(
    /<button[^>]*class=["'][^"']*faq-accordion__q[^"']*["'][^>]*>([\s\S]*?)(?:<span[^>]*class=["'][^"']*faq-accordion__icon|<\/button>)/gi
  )].map((match) => match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);

  if (!ldQuestions.length && !accordionQuestions.length) return;
  if (!ldQuestions.length) {
    issue('warning', 'faq-jsonld-missing', `accordion has ${accordionQuestions.length} question(s), FAQPage JSON-LD missing`);
    return;
  }
  if (!accordionQuestions.length) {
    issue('warning', 'faq-accordion-missing', `FAQPage JSON-LD has ${ldQuestions.length} question(s), accordion missing`);
    return;
  }

  const ld = new Set(ldQuestions.map(normQuestion));
  const acc = new Set(accordionQuestions.map(normQuestion));
  if (ldQuestions.length !== accordionQuestions.length) {
    issue('warning', 'faq-count-drift', `JSON-LD ${ldQuestions.length}, accordion ${accordionQuestions.length}`);
  }
  for (const question of ldQuestions) {
    if (!acc.has(normQuestion(question))) issue('warning', 'faq-question-missing-in-html', question.slice(0, 140));
  }
  for (const question of accordionQuestions) {
    if (!ld.has(normQuestion(question))) issue('warning', 'faq-question-missing-in-jsonld', question.slice(0, 140));
  }
}

function auditHtmlDocument({ html, route, entry, root, knownRoutes = new Set() }) {
  const issues = [];
  const issue = (severity, contract, detail) => issues.push({ route, severity, contract, detail: String(detail || '') });
  const source = String(html || '');
  const surface = entry?.surface || null;
  const routeRole = entry?.routeRole || null;

  const title = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '';
  if (!title) issue('error', 'document-title', 'missing or empty <title>');

  const canonical = canonicalHref(source);
  const expectedCanonical = `${SITE_ORIGIN}${route}`;
  if (!canonical) issue('error', 'canonical', 'missing canonical');
  else if (canonical !== expectedCanonical) issue('error', 'canonical', `${canonical} != ${expectedCanonical}`);

  const ogTitle = metaContent(source, 'og:title');
  if (title && ogTitle && normalizeTitle(title) !== normalizeTitle(ogTitle)) {
    issue('warning', 'title-og-drift', `${normalizeTitle(title)} != ${normalizeTitle(ogTitle)}`);
  }

  if (surface !== 'special') {
    const h1Count = (source.match(/<h1\b/gi) || []).length;
    if (h1Count !== 1) issue('error', 'document-h1', `expected 1 h1, found ${h1Count}`);
  }

  const noSvg = stripSvg(source);
  const ids = [...noSvg.matchAll(/\bid\s*=\s*(["'])(.*?)\1/gi)].map((match) => match[2]).filter(Boolean);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) issue('error', 'duplicate-id', id);
    seen.add(id);
  }

  for (const tag of tags(source, 'img')) {
    if (getAttr(tag, 'alt') == null) issue('error', 'img-alt', tag.slice(0, 180));
  }

  const mediaTags = [...tags(source, 'img'), ...tags(source, 'source')];
  for (const tag of mediaTags) {
    const refs = [];
    const src = getAttr(tag, 'src');
    if (src) refs.push(src);
    const srcset = getAttr(tag, 'srcset');
    if (srcset) refs.push(...srcsetCandidates(srcset));
    for (const ref of refs) {
      const resolved = resolveLocalReference(ref, route);
      if (!resolved) continue;
      if (resolved.invalid) issue('error', 'media-url', `invalid reference: ${ref}`);
      else if (!localPathExists(root, resolved.pathname)) issue('error', 'media-target', `${ref} -> ${resolved.pathname}`);
    }
  }

  for (const tag of tags(source, 'a')) {
    const href = getAttr(tag, 'href');
    if (href == null) continue;
    const resolved = resolveLocalReference(href, route);
    if (!resolved) continue;
    if (resolved.invalid) {
      issue('error', 'link-url', `invalid href: ${href}`);
      continue;
    }
    const pathname = resolved.pathname;
    if (knownRoutes.has(pathname)) continue;
    if (!localPathExists(root, pathname)) issue('error', 'link-target', `${href} -> ${pathname}`);
  }

  if (/javascript:void\s*\(\s*0\s*\)/i.test(source)) issue('warning', 'javascript-void', 'javascript:void(0) present');
  auditInlineScripts(source, issue);
  auditFaqParity(source, issue);

  if (routeRole === 'reading') {
    const ogType = metaContent(source, 'og:type');
    if (ogType && ogType !== 'article') issue('warning', 'reading-og-type', ogType);
    if (!metaContent(source, 'article:modified_time')) issue('warning', 'article-modified-time', 'missing article:modified_time');
    if (!metaContent(source, 'article:section') && !entry?.section) issue('warning', 'article-section', 'missing article:section/profile section');
    if (!/class=["'][^"']*(?:article-byline|byline)[^"']*["']/i.test(source)) issue('warning', 'article-byline', 'no byline marker');
  }

  return issues;
}

function auditProductionSurfaces({ root, registry }) {
  const issues = [];
  const entries = registry.entries.filter((entry) => entry.status === 'production-dist' && !entry.route.includes('/_app/'));
  const knownRoutes = new Set(entries.map((entry) => entry.route));
  for (const entry of entries) {
    const file = routeToHtmlFile(root, entry.route);
    if (!fs.existsSync(file)) {
      issues.push({ route: entry.route, severity: 'error', contract: 'dist-html', detail: path.relative(root, file) });
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    issues.push(...auditHtmlDocument({ html, route: entry.route, entry, root, knownRoutes }));
  }
  return { entries, issues };
}

module.exports = {
  SITE_ORIGIN,
  SITE_NAME,
  routeToHtmlFile,
  localPathExists,
  resolveLocalReference,
  auditHtmlDocument,
  auditProductionSurfaces,
};
