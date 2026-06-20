import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface LegacyFullDocument {
  headHtml: string;
  bodyHtml: string;
  bodyAttributes: Record<string, string>;
}

export function parseHtmlAttributes(source: string): Record<string, string> {
  return Object.fromEntries(
    [...String(source || '').matchAll(/([\w:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)].map((m) => [m[1], m[2] ?? m[3] ?? m[4] ?? ''])
  );
}

/**
 * Full-document visual parity loader.
 *
 * Refactoring 5.0 intentionally emits selected legacy pages as full-document
 * shadows until a componentized Astro version passes desktop/mobile screenshots
 * and owner review. For those routes the safest contract is not to rebuild or
 * reorder the <head>; it is to preserve the legacy head/body verbatim and only
 * expose body attributes as Astro props.
 */
export function loadLegacyFullDocument(filePath: string): LegacyFullDocument {
  const legacyHtml = readFileSync(path.join(process.cwd(), filePath), 'utf8');
  const headHtml = legacyHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  const bodyMatch = legacyHtml.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
  const bodyAttrs = bodyMatch?.[1] || '';
  const bodyHtml = bodyMatch?.[2] || '';

  return {
    headHtml,
    bodyHtml,
    bodyAttributes: parseHtmlAttributes(bodyAttrs),
  };
}
