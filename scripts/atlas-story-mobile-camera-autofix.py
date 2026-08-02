from pathlib import Path
import json

root = Path('.')
engine_path = root / 'karty/_engine/map-engine.js'
route_path = root / 'karty/avraam/route.json'

route = json.loads(route_path.read_text(encoding='utf-8'))
stories = {story.get('id'): story for story in route.get('stories', [])}
required = {'lekh-lekha', 'lot', 'war', 'akeda'}
if not required.issubset(stories):
    raise SystemExit(f'missing required stories: {sorted(required - set(stories))}')

stories['war']['cam'] = [690, 693, 620]
stories['war']['viewport'] = [690, 693, 620]

meta = route.setdefault('meta', {})
mobile = meta.setdefault('mobile_story_viewports', {})
mobile.update({
    'lekh-lekha': [1167, 520, 1140],
    'lot': [648, 838, 300],
    'war': [690, 693, 360],
    'akeda': [590, 850, 170],
})
meta['mobile_story_min_widths'] = {
    'lot': 300,
    'akeda': 170,
}

stages = route.get('stages', [])
if len(stages) <= 4 or len(stages[4].get('paths', [])) < 2:
    raise SystemExit('missing war return path')
stages[4]['paths'][1]['d'] = 'M752,556 C770,628 748,702 704,748 C672,780 644,794 623,800'

route_path.write_text(json.dumps(route, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

source = engine_path.read_text(encoding='utf-8')
anchor = """    let activeStoryId = initialState.story;
    container.setAttribute('data-active-story',activeStoryId);
"""
replacement = """    let activeStoryId = initialState.story;
    container.setAttribute('data-active-story',activeStoryId);
    function activeMinViewWidth(){
      const authored=matchMedia('(max-width:560px)').matches
        ?route.meta?.mobile_story_min_widths?.[activeStoryId]
        :route.meta?.story_min_widths?.[activeStoryId];
      const parsed=Number(authored);
      return Number.isFinite(parsed)&&parsed>0?Math.min(cfg.minW,parsed):cfg.minW;
    }
"""
if source.count(anchor) != 1:
    raise SystemExit(f'expected one active-story anchor, found {source.count(anchor)}')
source = source.replace(anchor, replacement, 1)

replacements = {
    "const initW=clamp(Number.isFinite(rawW)&&rawW>0?rawW:cfg.W0,cfg.minW,cfg.maxW);":
        "const initW=clamp(Number.isFinite(rawW)&&rawW>0?rawW:cfg.W0,activeMinViewWidth(),cfg.maxW);",
    "const w=clamp(width,cfg.minW,cfg.maxW),h=viewHeightForWidth(w);":
        "const w=clamp(width,activeMinViewWidth(),cfg.maxW),h=viewHeightForWidth(w);",
    "const nw=dir==='in'?Math.max(cfg.minW,view.w*0.85):Math.min(cfg.maxW,view.w*1.15);":
        "const nw=dir==='in'?Math.max(activeMinViewWidth(),view.w*0.85):Math.min(cfg.maxW,view.w*1.15);",
    "w = clamp(w || cfg.W0, cfg.minW, cfg.maxW);":
        "w = clamp(w || cfg.W0, activeMinViewWidth(), cfg.maxW);",
    "const nw = clamp(pinchView0.w * scale, cfg.minW, cfg.maxW);":
        "const nw = clamp(pinchView0.w * scale, activeMinViewWidth(), cfg.maxW);",
    "const nw=clamp(view.w*Math.exp(e.deltaY*.0014),cfg.minW,cfg.maxW);":
        "const nw=clamp(view.w*Math.exp(e.deltaY*.0014),activeMinViewWidth(),cfg.maxW);",
}
for old, new in replacements.items():
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'expected one engine anchor, found {count}: {old}')
    source = source.replace(old, new, 1)

if source.count('function activeMinViewWidth(){') != 1:
    raise SystemExit('active story minimum-width helper did not materialize exactly once')
if source.count('activeMinViewWidth()') != 7:
    raise SystemExit(f'unexpected activeMinViewWidth usage count: {source.count("activeMinViewWidth()")}')

engine_path.write_text(source, encoding='utf-8')
print('STORY MOBILE CAMERAS APPLIED')
