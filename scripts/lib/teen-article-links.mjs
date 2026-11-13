import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'parse5';

function walk(node, visit) {
  visit(node);
  for (const child of node.childNodes || []) walk(child, visit);
}

function attribute(node, name) {
  return node.attrs?.find((item) => item.name === name)?.value;
}

// Check reader-facing links only, not links supplied by the shared series rail.
// External sites and non-web protocols remain outside this local build contract.
export function checkTeenArticleLinks({ dist, routes, site }) {
  const errors = [];
  const baseDir = path.resolve(dist);
  const siteHost = new URL(site).host;
  const documents = new Map();
  let checked = 0;

  function document(file) {
    if (!documents.has(file)) documents.set(file, parse(fs.readFileSync(file, 'utf8')));
    return documents.get(file);
  }

  for (const route of routes) {
    const articleFile = path.join(baseDir, route.replace(/^\/+/, ''), 'index.html');
    if (!fs.existsSync(articleFile)) {
      errors.push(`${route}: article HTML missing`);
      continue;
    }
    let article;
    walk(document(articleFile), (node) => {
      if (attribute(node, 'id') === 'article-content') article = node;
    });
    if (!article) {
      errors.push(`${route}: #article-content missing`);
      continue;
    }

    walk(article, (node) => {
      if (node.tagName !== 'a') return;
      const href = attribute(node, 'href');
      if (href === undefined || href === '') return;
      let url;
      try {
        url = new URL(href, new URL(route, site));
      } catch {
        errors.push(`${route}: invalid link URL (${href})`);
        return;
      }
      if (!['http:', 'https:'].includes(url.protocol) || url.host !== siteHost) return;
      checked++;
      let pathname;
      let fragment;
      try {
        pathname = decodeURIComponent(url.pathname);
        // A text directive is not an element id; preserve any preceding id.
        fragment = decodeURIComponent(url.hash.slice(1).split(':~:')[0]);
      } catch {
        errors.push(`${route}: invalid link encoding (${href})`);
        return;
      }
      let target = path.resolve(baseDir, `.${pathname}`);
      if (target !== baseDir && !target.startsWith(`${baseDir}${path.sep}`)) {
        errors.push(`${route}: link escapes dist (${href})`);
        return;
      }
      if (!path.extname(target) || (fs.existsSync(target) && fs.statSync(target).isDirectory())) {
        target = path.join(target, 'index.html');
      }
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        errors.push(`${route}: local link target missing (${href})`);
        return;
      }
      if (!fragment || fragment === 'top') return;
      if (!target.endsWith('.html')) return;
      let found = false;
      walk(document(target), (candidate) => {
        if (attribute(candidate, 'id') === fragment || (candidate.tagName === 'a' && attribute(candidate, 'name') === fragment)) found = true;
      });
      if (!found) errors.push(`${route}: local link fragment missing (${href})`);
    });
  }
  return { checked, errors };
}
