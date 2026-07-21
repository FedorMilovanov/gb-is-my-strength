#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/_temp_apply_map_layers_theme.py')
text = path.read_text(encoding='utf-8')

replacements = []

old_before = '''"""      if (q) {
        const mc = markersG.querySelectorAll('g[transform]').length;
        let visibleCount = 0;
        markersG.querySelectorAll('g[transform]').forEach(g => {
          if (g.style.opacity !== '0.08' && g.style.opacity !== '.08') visibleCount++;
        });
        if (visibleCount > 0 && visibleCount < mc) {
          showToast('Найдено: ' + visibleCount, 1500);
        }
      }
    }, 200);""",'''
new_before = '''"""    // Show match count (was: at handler entry; crashed: q not in scope here)
    if (q) {
      const mc = markersG.querySelectorAll('g[transform]').length;
      let visibleCount = 0;
      markersG.querySelectorAll('g[transform]').forEach(g => {
        if (g.style.opacity !== '0.08' && g.style.opacity !== '.08') visibleCount++;
      });
      if (visibleCount > 0 && visibleCount < mc) {
        showToast('Найдено: ' + visibleCount, 1500);
      }
    }
  }, 200);""",'''
replacements.append(('search before signature', old_before, new_before))

old_after = '''"""      if (q) {
        const mc = markersG.querySelectorAll('g[transform]').length;
        let visibleCount = 0;
        markersG.querySelectorAll('g[transform]').forEach(g => {
          if (g.style.opacity !== '0.08' && g.style.opacity !== '.08') visibleCount++;
        });
        if (visibleCount > 0 && visibleCount < mc) {
          showToast('Найдено: ' + visibleCount, 1500);
        }
      }
      applyLayerVisibility();
    }, 200);""",'''
new_after = '''"""    // Show match count (was: at handler entry; crashed: q not in scope here)
    if (q) {
      const mc = markersG.querySelectorAll('g[transform]').length;
      let visibleCount = 0;
      markersG.querySelectorAll('g[transform]').forEach(g => {
        if (g.style.opacity !== '0.08' && g.style.opacity !== '.08') visibleCount++;
      });
      if (visibleCount > 0 && visibleCount < mc) {
        showToast('Найдено: ' + visibleCount, 1500);
      }
    }
    applyLayerVisibility();
  }, 200);""",'''
replacements.append(('search after signature', old_after, new_after))

old_place = '''      const story=(route.stories||[]).find(item=>item&&item.id===id);
      if(story){
        const placeIds=story.places||story.place_ids||[];
        const stageIds=story.stages||story.stage_ids||[];
        if(placeIds.includes(place.id)||(Number.isInteger(place.stage)&&stageIds.includes(place.stage)))any.add(id);
      }
      const placeIds=_layerRefs(layer,'place_ids','places');
      const stageIds=_layerRefs(layer,'stage_ids','stages');
      const types=_layerRefs(layer,'types','place_types');
      if(placeIds.includes(place.id)||(Number.isInteger(place.stage)&&stageIds.includes(place.stage))||(place.type&&types.includes(place.type)))all.add(id);
      if(id===(stage&&stage.cls)||id===place.type)all.add(id);'''
new_place = '''      const placeIds=_layerRefs(layer,'place_ids','places');
      const stageIds=_layerRefs(layer,'stage_ids','stages');
      const types=_layerRefs(layer,'types','place_types');
      const explicitFacet=placeIds.includes(place.id)||(Number.isInteger(place.stage)&&stageIds.includes(place.stage))||(place.type&&types.includes(place.type))||id===(stage&&stage.cls)||id===place.type;
      if(explicitFacet)all.add(id);
      const story=(route.stories||[]).find(item=>item&&item.id===id);
      if(story&&!explicitFacet){
        const storyPlaceIds=story.places||story.place_ids||[];
        const storyStageIds=story.stages||story.stage_ids||[];
        if(storyPlaceIds.includes(place.id)||(Number.isInteger(place.stage)&&storyStageIds.includes(place.stage)))any.add(id);
      }'''
replacements.append(('place facet precedence', old_place, new_place))

old_stage = '''      const story=(route.stories||[]).find(item=>item&&item.id===id);
      if(story&&((story.stages||story.stage_ids||[]).includes(stageIndex)))any.add(id);
      if(_layerRefs(layer,'stage_ids','stages').includes(stageIndex)||id===stage.cls)all.add(id);'''
new_stage = '''      const explicitFacet=_layerRefs(layer,'stage_ids','stages').includes(stageIndex)||id===stage.cls;
      if(explicitFacet)all.add(id);
      const story=(route.stories||[]).find(item=>item&&item.id===id);
      if(story&&!explicitFacet&&((story.stages||story.stage_ids||[]).includes(stageIndex)))any.add(id);'''
replacements.append(('stage facet precedence', old_stage, new_stage))

for label, old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('exact signatures and layer precedence corrected')
