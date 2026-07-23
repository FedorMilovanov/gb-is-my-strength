#!/usr/bin/env python3
from pathlib import Path

AUDIT = Path('scripts/audit-pro.js')
DEBUG = Path('reports/materializer-debug.txt')

debug = []
try:
    source = AUDIT.read_text(encoding='utf-8')
    if "require('./lib/audit-pro-source-corpus')" not in source:
        raise RuntimeError('audit-pro source corpus has not been materialized')

    linux_only = r"!/[\/]scripts[\/]/"
    cross_platform = r"!/[\\/]scripts[\\/]/"
    debug.append(f'linux-only separator count={source.count(linux_only)}')
    if source.count(linux_only) != 1:
        raise RuntimeError('expected exactly one Linux-only scripts separator regex')
    source = source.replace(linux_only, cross_platform, 1)

    verification_line = "const verificationFileRe = /^(google|yandex)[^/]*\\.html$/i;\n"
    debug.append(f'unused verification regex count={source.count(verification_line)}')
    if source.count(verification_line) != 1:
        raise RuntimeError('expected exactly one unused verification regex')
    source = source.replace(verification_line, '', 1)

    repeated_walk = "walk(ROOT).filter(f => f.endsWith('.html')"
    debug.append(f'remaining repeated HTML walk count={source.count(repeated_walk)}')
    if repeated_walk in source:
        raise RuntimeError('repeated HTML root walk remains after materialization')

    required = [
        "const htmlFiles = sourceCorpus.sourcePages.map",
        "const htmlPages = htmlFiles;",
        "for (const page of htmlFiles)",
        "const file = rel(page);",
        "const html = fs.readFileSync(page, 'utf8');",
    ]
    for token in required:
        if token not in source:
            raise RuntimeError(f'materialized audit-pro missing token: {token}')

    AUDIT.write_text(source, encoding='utf-8')
    debug.append('cross-platform cleanup written')
except BaseException as error:
    debug.append(f'exception={type(error).__name__}: {error}')
    raise
finally:
    DEBUG.parent.mkdir(parents=True, exist_ok=True)
    DEBUG.write_text('\n'.join(debug) + '\n', encoding='utf-8')
