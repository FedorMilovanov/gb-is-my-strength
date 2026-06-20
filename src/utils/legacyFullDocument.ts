import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface LegacyFullDocument {
  headHtml: string;
  bodyHtml: string;
  bodyAttributes: Record<string, string>;
}

export function parseHtmlAttributes(source: string): Record<string, string> {
  return Object.fromEntries(
    [...String(source || '').matchAll(/([\\w:-]+)(?:="([^"]*)")?/g)].map((m) => [m[1], m[2] ?? ''])
  );
}

/**
 * Enhanced full-document loader that preserves ALL critical head elements.
 *
 * Beyond basic <head>/<body> extraction, this ensures:
 * - Inline <style> blocks (critical for map pages whose entire CSS lives in <head>)
 * - CSP <meta http-equiv="Content-Security-Policy"> (defense-in-depth for external tile servers)
 * - Preload links (fonts, images, route.json)
 * - Theme-color meta (some pages set dark/light variants differently)
 * - Script blocks in <head> (inline analytics, SITE_CONFIG)
 *
 * Without these, visually critical pages (e.g., /karty/avraam/ with 1138-line inline CSS)
 * render completely unstyled in dist.
 */
export function loadLegacyFullDocument(filePath: string): LegacyFullDocument {
  const legacyHtml = readFileSync(path.join(process.cwd(), filePath), 'utf8');

  // --- Extract full <head> inner and <body> ---
  const headInner = legacyHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  const bodyMatch = legacyHtml.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
  const bodyAttrs = bodyMatch?.[1] || '';
  const bodyHtml = bodyMatch?.[2] || '';

  // --- Extract critical elements from <head> ---
  // 1. All <link> stylesheets (keep relative order)
  const styleLinks = [...headInner.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/gi)].map((m) => m[0]);

  // 2. Preload links (fonts, route.json, images)
  const preloadLinks = [...headInner.matchAll(/<link[^>]+rel="preload"[^>]*>/gi)].map((m) => m[0]);

  // 3. Inline <style> blocks (critical for map pages with inline CSS bundles)
  const styleBlocks = [...headInner.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map((m) => m[0]);

  // 4. Script blocks in <head> (inline analytics, SITE_CONFIG, structured data JSON-LD)
  const scriptBlocks = [...headInner.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[0]);

  // 5. CSP meta — defense-in-depth for external map tiles, Wikimedia images, GSAP
  const cspMeta = [...headInner.matchAll(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi)].map((m) => m[0]);

  // 6. Theme-color meta (dark/light variants)
  const themeColorMetas = [...headInner.matchAll(/<meta[^>]+name=["']theme-color["'][^>]*>/gi)].map((m) => m[0]);

  // 7. All other <meta> tags (charset, viewport, OG, twitter, description, robots, etc.)
  const otherMetas = [...headInner.matchAll(/<meta[^>]+>/gi)]
    .map((m) => m[0])
    .filter((tag) => !/Content-Security-Policy/i.test(tag) && !/theme-color/i.test(tag));

  // 8. <title> tag
  const titleTag = headInner.match(/<title>[\s\S]*?<\/title>/i)?.[0] || '';

  // 9. Canonical link
  const canonicalLink = headInner.match(/<link[^>]+rel="canonical"[^>]*>/i)?.[0] || '';

  // --- Build complete headHtml ---
  // Order: title → metas → canonical → preloads → stylesheets → style blocks → CSP → theme-color → scripts
  const allHeadParts = [
    titleTag,
    ...otherMetas,
    canonicalLink,
    ...preloadLinks,
    ...styleLinks,
    ...styleBlocks,
    ...cspMeta,
    ...themeColorMetas,
    ...scriptBlocks,
  ].filter(Boolean);

  // Deduplicate by normalized content (trimmed, single-space)
  const seen = new Set<string>();
  const headHtml = allHeadParts
    .filter((part) => {
      const key = part.replace(/\s+/g, ' ').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join('\n');

  return {
    headHtml,
    bodyHtml,
    bodyAttributes: parseHtmlAttributes(bodyAttrs),
  };
}