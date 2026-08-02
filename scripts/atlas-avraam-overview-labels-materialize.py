from pathlib import Path

root = Path(__file__).resolve().parents[1]
svg_path = root / 'karty/avraam/base.svg'
witness_path = root / 'scripts/avraam-reference-baseline.mjs'
self_path = root / 'scripts/atlas-avraam-overview-labels-materialize.py'
workflow_path = root / '.github/workflows/atlas-avraam-overview-labels-materialize.yml'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)


svg = svg_path.read_text(encoding='utf-8')
svg = replace_once(
    svg,
    '<text class="sea-label lbl-overview" x="300" y="555" font-size="26" transform="rotate(-8 300 555)">ВЕЛИКОЕ&#160;&#160;МОРЕ</text>',
    '<text class="sea-label lbl-overview" x="360" y="555" font-size="26" transform="rotate(-8 360 555)">ВЕЛИКОЕ&#160;&#160;МОРЕ</text>',
    'Great Sea overview label',
)
svg = replace_once(
    svg,
    '<text class="region-label lbl-overview" x="938" y="262" font-size="12" letter-spacing=".2em">ПАДАН-АРАМ</text>',
    '<text class="region-label lbl-overview" x="830" y="262" font-size="12" letter-spacing=".2em">ПАДАН-АРАМ</text>',
    'Padan Aram overview label',
)
svg = replace_once(
    svg,
    '<text class="region-label lbl-overview" x="520" y="1170" font-size="14" letter-spacing=".3em">СИНАЙ</text>',
    '<text class="region-label lbl-overview" x="520" y="1145" font-size="14" letter-spacing=".3em">СИНАЙ</text>',
    'Sinai overview label',
)
svg_path.write_text(svg, encoding='utf-8')

witness = witness_path.read_text(encoding='utf-8')
old = """    if(result.overview.map.zoomBucket!=='overview')result.verificationFailures.push(`unexpected overview zoom bucket: ${result.overview.map.zoomBucket}`);
    if(result.overview.motion.prefersReducedMotion&&result.overview.motion.smilAnimations>0&&!result.overview.motion.smilPaused)result.verificationFailures.push('reduced motion did not pause SVG animations');
"""
new = """    if(result.overview.map.zoomBucket!=='overview')result.verificationFailures.push(`unexpected overview zoom bucket: ${result.overview.map.zoomBucket}`);
    const clippedOverviewLabels=result.overview.offscreenLabels.filter(label=>String(label.className||'').split(/\\s+/).includes('lbl-overview'));
    if(clippedOverviewLabels.length)result.verificationFailures.push(`overview labels outside safe area: ${clippedOverviewLabels.map(label=>label.text||label.id||label.index).join(', ')}`);
    if(result.overview.motion.prefersReducedMotion&&result.overview.motion.smilAnimations>0&&!result.overview.motion.smilPaused)result.verificationFailures.push('reduced motion did not pause SVG animations');
"""
witness = replace_once(witness, old, new, 'overview safe-area witness')
if witness.count('overview labels outside safe area') != 1:
    raise SystemExit('overview safe-area marker drift')
witness_path.write_text(witness, encoding='utf-8')

self_path.unlink()
workflow_path.unlink()
