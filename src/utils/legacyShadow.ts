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
  const headInner = matchOne(html, /<head[^>]*>([\s\S]*?)<\/head>/i);

  const styleLinks = [...headInner.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/gi)].map((m) => m[0]).join('\n');
  const preloadLinks = [...headInner.matchAll(/<link[^>]+rel="preload"[^>]*>/gi)].map((m) => m[0]).join('\n');
  const scriptBlocks = [...headInner.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[0]).join('\n');
  // Inline <style> blocks from <head> (critical for map pages whose entire
  // CSS lives in <head> as a <style> element — without this, shadow-wrapped
  // maps like /karty/avraam/ render completely unstyled).
  const styleBlocks = [...headInner.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map((m) => m[0]).join('\n');
  // CSP <meta http-equiv="Content-Security-Policy"> — defense-in-depth must
  // survive the shadow wrapper, otherwise whitelists for external map tiles /
  // Wikimedia images / GSAP are silently dropped.
  const cspMeta = [...headInner.matchAll(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi)].map((m) => m[0]).join('\n');
  // theme-color meta (some pages set dark/light variants differently).
  const themeColorMetas = [...headInner.matchAll(/<meta[^>]+name=["']theme-color["'][^>]*>/gi)].map((m) => m[0]).join('\n');
  const headHtml = [cspMeta, preloadLinks, styleLinks, styleBlocks, scriptBlocks, themeColorMetas].filter(Boolean).join('\n');

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
