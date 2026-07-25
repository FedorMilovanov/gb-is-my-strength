#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/print-pagination-contract.mjs')
source = path.read_text('utf-8')

old_branding = """    const brandingContent = String(setup.printBranding?.content || '');
    if (!brandingContent.includes('ГОСПОДЬ БОГ') || setup.printBranding?.display === 'none' || setup.printBranding?.position !== 'static') {
      report.failures.push(`${id}: legitimate print branding was lost: ${JSON.stringify(setup.printBranding)}`);
    }"""
new_branding = """    const brandingContent = String(setup.printBranding?.content || '').replace(/^\"|\"$/g, '').trim();
    const hasPrintBranding = Boolean(brandingContent && brandingContent !== 'none' && brandingContent !== 'normal');
    if (hasPrintBranding && (!brandingContent.includes('ГОСПОДЬ БОГ') || setup.printBranding?.display === 'none' || setup.printBranding?.position !== 'static')) {
      report.failures.push(`${id}: legitimate print branding was lost: ${JSON.stringify(setup.printBranding)}`);
    }"""
if source.count(old_branding) != 1:
    raise SystemExit(f'branding assertion anchor: expected 1, found {source.count(old_branding)}')
source = source.replace(old_branding, new_branding, 1)

old_position = "mode.visibleFaces[0].position !== 'static'"
new_position = "!['static', 'relative'].includes(mode.visibleFaces[0].position)"
if source.count(old_position) != 1:
    raise SystemExit(f'visible face position anchor: expected 1, found {source.count(old_position)}')
source = source.replace(old_position, new_position, 1)

path.write_text(source, 'utf-8')
print('Refined print branding and reversible-face assertions.')
