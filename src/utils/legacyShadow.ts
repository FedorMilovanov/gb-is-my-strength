import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface LegacyShadowPage {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogImageAlt: string;
  bodyClass: string;
  bodyHtml: string;
  headHtml: string;
}

function matchOne(source: string, pattern: RegExp, fallback = '') {
  return source.match(pattern)?.[1]?.trim() || fallback;
}

export function loadLegacyShadowPage(filePath: string | URL): LegacyShadowPage {
  const resolved = typeof filePath === 'string' && !path.isAbsolute(filePath)
    ? path.join(process.cwd(), filePath)
    : filePath;
  const html = readFileSync(resolved, 'utf8');
  const title = matchOne(html, /<title>([\s\S]*?)<\/title>/i);
  const description = matchOne(html, /<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
  const canonical = matchOne(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i);
  const ogTitle = matchOne(html, /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i, title);
  const ogDescription = matchOne(html, /<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i, description);
  const ogImage = matchOne(html, /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
  const ogImageAlt = matchOne(html, /<meta[^>]+property="og:image:alt"[^>]+content="([^"]+)"/i, ogTitle || title);
  const bodyClass = matchOne(html, /<body[^>]+class="([^"]+)"/i);
  const bodyHtml = matchOne(html, /<body[^>]*>([\s\S]*?)<\/body>/i);

  const styleLinks = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/gi)].map((m) => m[0]).join('\n');
  const preloadLinks = [...html.matchAll(/<link[^>]+rel="preload"[^>]*>/gi)].map((m) => m[0]).join('\n');
  const scriptBlocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[0]).join('\n');
  const headHtml = [preloadLinks, styleLinks, scriptBlocks].filter(Boolean).join('\n');

  return {
    title,
    description,
    canonical,
    ogTitle,
    ogDescription,
    ogImage,
    ogImageAlt,
    bodyClass,
    bodyHtml,
    headHtml,
  };
}
