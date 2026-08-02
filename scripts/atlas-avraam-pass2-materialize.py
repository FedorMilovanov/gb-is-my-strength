from pathlib import Path

engine=Path('karty/_engine/map-engine.js')
harness=Path('scripts/avraam-reference-baseline.mjs')

# Selected-story membership outranks ordinary layer defaults for every
# story-owned map element, not only route paths.
s=engine.read_text('utf-8')
old="""        const selectedStoryRoute=activeStoryId!=='main'&&el.getAttribute('data-story-active')==='1'&&el.matches('.me-route-main,.me-route-underlay,[data-route-segment]');
        const hidden=!selectedStoryRoute&&(restrictive.some(id=>layerState.get(id)===false)||(alternatives.length>0&&!alternatives.some(id=>layerState.get(id)!==false)));
"""
new="""        const selectedStoryElement=activeStoryId!=='main'&&el.getAttribute('data-story-active')==='1';
        const hidden=!selectedStoryElement&&(restrictive.some(id=>layerState.get(id)===false)||(alternatives.length>0&&!alternatives.some(id=>layerState.get(id)!==false)));
"""
if new not in s:
    if old not in s:
        raise SystemExit('MISSING selected-story layer-priority anchor')
    s=s.replace(old,new,1)
engine.write_text(s,'utf-8')

# A narrative state must expose every non-candidate place explicitly declared
# by its source story. Candidate alternatives remain optional/layer-driven.
h=harness.read_text('utf-8')
target="""        const sourceStory=(SOURCE_ROUTE.stories||[]).find(item=>item.id===story.id);
        const sourcePlaces=new Map((SOURCE_ROUTE.places||[]).map(place=>[place.id,place]));
        const requiredStoryPlaces=(sourceStory?.places||sourceStory?.place_ids||[]).filter(id=>sourcePlaces.get(id)?.type!=='cand');
        const visibleStoryPlaces=new Set(geometry.markers.map(marker=>marker.placeId).filter(Boolean));
        const missingStoryPlaces=story.id==='main'?[]:requiredStoryPlaces.filter(id=>!visibleStoryPlaces.has(id));
        if(missingStoryPlaces.length)result.verificationFailures.push(`story required markers missing ${story.id}: ${missingStoryPlaces.join(', ')}`);
"""
if target not in h:
    old_gate="""        const irrelevantMarkers=story.id==='main'?[]:geometry.markers.filter(marker=>marker.storyActive==='0');
        if(irrelevantMarkers.length)result.verificationFailures.push(`story irrelevant markers ${story.id}: ${irrelevantMarkers.map(marker=>marker.placeId||marker.text||marker.id).join(', ')}`);
        const overlapLimit=viewport.width<=560?4:6;
"""
    new_gate="""        const irrelevantMarkers=story.id==='main'?[]:geometry.markers.filter(marker=>marker.storyActive==='0');
        if(irrelevantMarkers.length)result.verificationFailures.push(`story irrelevant markers ${story.id}: ${irrelevantMarkers.map(marker=>marker.placeId||marker.text||marker.id).join(', ')}`);
        const sourceStory=(SOURCE_ROUTE.stories||[]).find(item=>item.id===story.id);
        const sourcePlaces=new Map((SOURCE_ROUTE.places||[]).map(place=>[place.id,place]));
        const requiredStoryPlaces=(sourceStory?.places||sourceStory?.place_ids||[]).filter(id=>sourcePlaces.get(id)?.type!=='cand');
        const visibleStoryPlaces=new Set(geometry.markers.map(marker=>marker.placeId).filter(Boolean));
        const missingStoryPlaces=story.id==='main'?[]:requiredStoryPlaces.filter(id=>!visibleStoryPlaces.has(id));
        if(missingStoryPlaces.length)result.verificationFailures.push(`story required markers missing ${story.id}: ${missingStoryPlaces.join(', ')}`);
        const overlapLimit=viewport.width<=560?4:6;
"""
    if old_gate not in h:
        raise SystemExit('MISSING story-completeness gate anchor')
    h=h.replace(old_gate,new_gate,1)
harness.write_text(h,'utf-8')

print('PASS7.2 APPLIED')
