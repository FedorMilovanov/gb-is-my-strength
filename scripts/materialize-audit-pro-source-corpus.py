#!/usr/bin/env python3
from pathlib import Path

AUDIT = Path('scripts/audit-pro.js')
DEBUG = Path('reports/materializer-debug.txt')

debug = []
try:
    source = AUDIT.read_text(encoding='utf-8')
    if "require('./lib/audit-pro-source-corpus')" in source:
        debug.append('already materialized')
        raise SystemExit(0)

    old_require = "const { auditSitemapCoverage, contractProblems } = require('./lib/sitemap-route-contract');\n"
    debug.append(f'require count={source.count(old_require)}')
    if source.count(old_require) != 1:
        raise RuntimeError('unexpected sitemap require count')
    source = source.replace(
        old_require,
        old_require + "const { buildPublicSurfaceRegistry } = require('./lib/public-surface-registry');\nconst { buildAuditProSourceCorpus } = require('./lib/audit-pro-source-corpus');\n",
        1,
    )

    start_marker = 'const allFiles = walk(ROOT);'
    end_marker = '\n\nfunction getMeta'
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    legacy_corpus = source[start:end]
    debug.append('legacy corpus=' + repr(legacy_corpus))
    for required in ['const htmlFiles = allFiles.filter', 'const htmlPages = htmlFiles.filter', 'verificationFileRe']:
        if required not in legacy_corpus:
            raise RuntimeError(f'legacy corpus missing expected token: {required}')

    new_corpus = """const allFiles = walk(ROOT);
const allHtmlFiles = allFiles.filter(p => p.endsWith('.html') && !/[\\/]scripts[\\/]/.test(p)).sort();
const surfaceRegistry = buildPublicSurfaceRegistry();
for (const error of surfaceRegistry.errors) R.err(`Public surface registry: ${error}`);
const sourceCorpus = buildAuditProSourceCorpus({
  root: ROOT,
  entries: surfaceRegistry.entries,
  allHtmlFiles,
});
const htmlFiles = sourceCorpus.sourcePages.map((item) => item.file).sort();
const htmlPages = htmlFiles;

if (sourceCorpus.duplicateRootMappings.length) {
  for (const item of sourceCorpus.duplicateRootMappings) {
    R.err(`Duplicate route-to-root mapping: ${item.routes.join(' + ')} -> ${rel(item.file)}`);
  }
}
if (sourceCorpus.unregisteredRootHtml.length) {
  R.err(`Unregistered root HTML outside the canonical route registry:\n  - ${sourceCorpus.unregisteredRootHtml.map((item) => item.relative).join('\\n  - ')}`);
} else {
  R.ok(`Source HTML corpus is registry-owned (${htmlPages.length} committed production shadows)`);
}
R.note(`Production HTML corpus: ${sourceCorpus.productionRoutes} routes = ${htmlPages.length} committed source shadows + ${sourceCorpus.distOnly.length} dist-only routes delegated to mandatory production contracts`);
if (sourceCorpus.registeredNonProduction.length) {
  R.note(`Registered non-production root HTML excluded from public source checks: ${sourceCorpus.registeredNonProduction.map((item) => item.route).join(', ')}`);
}
"""
    source = source[:start] + new_corpus + source[end:]

    walk_expr = "walk(ROOT).filter(f => f.endsWith('.html') && !/[\\\\/]scripts[\\\\/]/.test(f))"
    walk_count = source.count(walk_expr)
    debug.append(f'repeated HTML walk count={walk_count}')
    if walk_count < 1:
        raise RuntimeError('repeated HTML walk matcher found nothing')
    source = source.replace(walk_expr, 'htmlPages')

    guard_marker = '(function russianQuotePolicyGuard()'
    quote_start = source.index('  for (const file of htmlFiles) {', source.index(guard_marker))
    quote_end = source.index('    const body =', quote_start)
    legacy_quote = source[quote_start:quote_end]
    debug.append('legacy quote=' + repr(legacy_quote))
    for required in ["file.startsWith('articles/')", 'const html = read(file);']:
        if required not in legacy_quote:
            raise RuntimeError(f'quote loop missing expected token: {required}')
    replacement_quote = """  for (const page of htmlFiles) {
    const file = rel(page);
    if (!file.startsWith('articles/') && !file.startsWith('nagornaya/')) continue;
    const html = fs.readFileSync(page, 'utf8');
"""
    source = source[:quote_start] + replacement_quote + source[quote_end:]
    source = source.replace(
        ' * - SEO/PWA/resource/link basics\n',
        ' * - source-shadow contracts; production breadth is delegated to mandatory registry/dist gates\n',
        1,
    )

    AUDIT.write_text(source, encoding='utf-8')
    debug.append('materialization written')
except BaseException as error:
    debug.append(f'exception={type(error).__name__}: {error}')
    raise
finally:
    DEBUG.parent.mkdir(parents=True, exist_ok=True)
    DEBUG.write_text('\n'.join(debug) + '\n', encoding='utf-8')
