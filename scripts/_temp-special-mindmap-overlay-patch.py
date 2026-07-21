#!/usr/bin/env python3
from pathlib import Path


def once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)


mind_path = Path('_build-tools/konfessii-baptizm/MindMap3D.tsx')
mind = mind_path.read_text(encoding='utf-8')

mind = once(
    mind,
    "const NIGHT_MAP_DATA_URL: string | null = (() => {\n",
    "let mindMapOverlaySequence = 0;\n\nconst NIGHT_MAP_DATA_URL: string | null = (() => {\n",
    'MindMap3D owner sequence',
)

mind = once(
    mind,
    "  const [showLegend, setShowLegend] = useState(false);\n\n  const nightMapUrl = NIGHT_MAP_DATA_URL;\n",
    "  const [showLegend, setShowLegend] = useState(false);\n  const [fullscreenOverlayOwner] = useState(() => `special:mindmap3d:fullscreen:${++mindMapOverlaySequence}`);\n\n  const nightMapUrl = NIGHT_MAP_DATA_URL;\n",
    'MindMap3D stable owner',
)

old_effect = '''  useEffect(() => {
    if (!isFullscreen || typeof document === 'undefined') return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [isFullscreen]);
'''
new_effect = '''  useEffect(() => {
    if (!isFullscreen || typeof window === 'undefined') return;
    const siteUtils = (window as any).SiteUtils;
    const runtime = (window as any).OverlayRuntime || siteUtils?.OverlayRuntime;
    if (runtime?.lockScroll && runtime?.unlockScroll) {
      runtime.lockScroll(fullscreenOverlayOwner);
      return () => runtime.unlockScroll(fullscreenOverlayOwner);
    }
    siteUtils?.lockScroll?.(fullscreenOverlayOwner);
    return () => siteUtils?.unlockScroll?.(fullscreenOverlayOwner);
  }, [isFullscreen, fullscreenOverlayOwner]);
'''
mind = once(mind, old_effect, new_effect, 'MindMap3D fullscreen ownership effect')
mind_path.write_text(mind, encoding='utf-8')

contract_path = Path('scripts/overlay-runtime-contract-test.js')
contract = contract_path.read_text(encoding='utf-8')
contract = once(
    contract,
    "const mapEngine = fs.readFileSync('karty/_engine/map-engine.js', 'utf8');\n",
    "const mapEngine = fs.readFileSync('karty/_engine/map-engine.js', 'utf8');\nconst mindMap3D = fs.readFileSync('_build-tools/konfessii-baptizm/MindMap3D.tsx', 'utf8');\n",
    'MindMap3D contract source',
)
contract = once(
    contract,
    "assert.ok(!directWriter.test(mapEngine), 'map special overlays must not write body lock styles');\n",
    "assert.ok(!directWriter.test(mapEngine), 'map special overlays must not write body lock styles');\nconst specialDirectWriter = /(?:document\\.(?:body|documentElement)|(?:body|html))\\.style\\.(?:overflow|position|top|left|right|width|overscrollBehavior)\\s*=/;\nassert.ok(!specialDirectWriter.test(mindMap3D), 'MindMap3D must not write html/body lock styles');\n",
    'MindMap3D direct writer guard',
)
contract = once(
    contract,
    "assert.ok(!mapEngine.includes(\"document.addEventListener('keydown', e => { if (e.key === 'Escape')\"), 'photo modal must not own a competing Escape listener');\n",
    "assert.ok(!mapEngine.includes(\"document.addEventListener('keydown', e => { if (e.key === 'Escape')\"), 'photo modal must not own a competing Escape listener');\nassert.ok(mindMap3D.includes('special:mindmap3d:fullscreen:'), 'MindMap3D must use a namespaced fullscreen owner');\nassert.ok(mindMap3D.includes('runtime.lockScroll(fullscreenOverlayOwner)') && mindMap3D.includes('runtime.unlockScroll(fullscreenOverlayOwner)'), 'MindMap3D must delegate fullscreen lock lifecycle to OverlayRuntime');\n",
    'MindMap3D ownership assertions',
)
contract_path.write_text(contract, encoding='utf-8')

print('MindMap3D canonical fullscreen ownership prepared')
