from pathlib import Path
import json

root=Path('.')
engine=root/'karty/_engine/map-engine.js'
routef=root/'karty/avraam/route.json'
harness=root/'scripts/avraam-reference-baseline.mjs'

# ── Declarative story hierarchy and cameras ──
r=json.loads(routef.read_text('utf-8'))
roles={
  'lekh-lekha':{'focus':['ur','harran','damascus','shechem','bethel'],'context':[]},
  'lot':{'focus':['bethel','sodom','zoar'],'context':[]},
  'war':{'focus':['hebron','dan','hovah','salem'],'context':[]},
  'akeda':{'focus':['beersheba','salem'],'context':['kadesh']},
}
for story in r.get('stories',[]):
    spec=roles.get(story.get('id'))
    if spec:
        story['focus_places']=spec['focus']
        story['context_places']=spec['context']
    if story.get('id')=='war':
        story['cam']=[720,690,520]
        story['viewport']=[720,690,520]
    if story.get('id')=='akeda':
        story['cam']=[610,850,340]
        story['viewport']=[610,850,340]
r.setdefault('meta',{}).setdefault('mobile_story_viewports',{}).update({
    'war':[720,690,500],
    'akeda':[610,850,300],
})
# The return from Hobah to Salem is a distinct eastward arc, not a technical chord.
war_paths=r['stages'][4].get('paths',[])
if len(war_paths)<2:
    raise SystemExit('MISSING war return path')
war_paths[1]['d']='M752,556 C835,610 844,684 792,738 C748,780 684,799 623,800'
routef.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n','utf-8')

# ── Shared engine: focus/context/candidate roles ──
s=engine.read_text('utf-8')
old="""  function getStoryState(route,storyId){
    const story=(route.stories||[]).find(s=>s.id===storyId);
    return story?{story,placeIds:story.places||story.place_ids||null,stageIds:story.stages||story.stage_ids||null}:null;
  }
"""
new="""  function getStoryState(route,storyId){
    const story=(route.stories||[]).find(s=>s.id===storyId);
    return story?{
      story,
      placeIds:story.places||story.place_ids||null,
      focusPlaceIds:story.focus_places||story.focusPlaceIds||null,
      contextPlaceIds:story.context_places||story.contextPlaceIds||null,
      stageIds:story.stages||story.stage_ids||null
    }:null;
  }
"""
if new not in s:
    if old not in s: raise SystemExit('MISSING getStoryState anchor')
    s=s.replace(old,new,1)

role_setup="""      const activeFocusPlaceIds=new Set(activeStoryState?.focusPlaceIds||[]);
      const activeContextPlaceIds=new Set(activeStoryState?.contextPlaceIds||[]);
      function resolveStoryRole(place,inStory){
        if(!inStory)return 'hidden';
        if(activeStoryId==='main')return 'overview';
        if(place.type==='cand')return 'candidate';
        if(activeContextPlaceIds.has(place.id))return 'context';
        if(activeFocusPlaceIds.size===0||activeFocusPlaceIds.has(place.id))return 'focus';
        return 'context';
      }
"""
anchor="""      const activeStoryState=getStoryState(route,activeStoryId);
      const activeStoryStages=new Set(activeStoryState?.stageIds||[]);
"""
if role_setup not in s:
    if anchor not in s: raise SystemExit('MISSING active story state anchor')
    s=s.replace(anchor,anchor+role_setup,1)

old_marker="""        const inStory=visIds.has(place.id);
        const isActive=place.id===activePlaceId;
        const color=getStageColor(place.stage);
"""
new_marker="""        const inStory=visIds.has(place.id);
        const storyRole=resolveStoryRole(place,inStory);
        const isFocusRole=storyRole==='focus'||storyRole==='overview';
        const isSecondaryRole=storyRole==='context'||storyRole==='candidate';
        const baseMarkerR=isFocusRole?4.8:(storyRole==='context'?3.5:3.2);
        const roleLabelOpacity=isFocusRole?.92:(storyRole==='context'?.68:.56);
        const roleBgOpacity=isFocusRole?.54:(storyRole==='context'?.28:.20);
        const roleFontSize=isFocusRole?10:8;
        const isActive=place.id===activePlaceId;
        const color=getStageColor(place.stage);
"""
if new_marker not in s:
    if old_marker not in s: raise SystemExit('MISSING marker role anchor')
    s=s.replace(old_marker,new_marker,1)

old_attr="""        g.setAttribute('data-place-id', place.id);
        g.setAttribute('data-story-active',inStory?'1':'0');
"""
new_attr="""        g.setAttribute('data-place-id', place.id);
        g.setAttribute('data-story-active',inStory?'1':'0');
        g.setAttribute('data-story-role',storyRole);
"""
if new_attr not in s:
    if old_attr not in s: raise SystemExit('MISSING story role attribute anchor')
    s=s.replace(old_attr,new_attr,1)

old_hover="""        g.addEventListener('mouseenter',()=>{if(inStory){const d=g.querySelector('.me-marker-dot');if(d){d.setAttribute('r','6');d.setAttribute('filter','url(#me-gold-glow)');}const r2=g.querySelector('circle:nth-child(2)');if(r2){r2.setAttribute('opacity','0.6');r2.setAttribute('r','14');}}});
        g.addEventListener('mouseleave',()=>{const d=g.querySelector('.me-marker-dot');if(d){d.setAttribute('r',(place.id===activePlaceId)?'7':'4.5');d.setAttribute('filter',(place.id===activePlaceId)?'url(#me-glow-strong)':'url(#me-shadow)');}const r2=g.querySelector('circle:nth-child(2)');if(r2){r2.setAttribute('opacity',(place.id===activePlaceId)?'0.5':'0');r2.setAttribute('r','12');}});
"""
new_hover="""        g.addEventListener('mouseenter',()=>{if(inStory){const d=g.querySelector('.me-marker-dot');if(d){d.setAttribute('r',String(Math.max(5.4,baseMarkerR+1.2)));d.setAttribute('filter','url(#me-gold-glow)');}const r2=g.querySelector('circle:nth-child(2)');if(r2){r2.setAttribute('opacity','0.6');r2.setAttribute('r','14');}}});
        g.addEventListener('mouseleave',()=>{const d=g.querySelector('.me-marker-dot');if(d){d.setAttribute('r',(place.id===activePlaceId)?'7':String(baseMarkerR));d.setAttribute('filter',(place.id===activePlaceId)?'url(#me-glow-strong)':'url(#me-shadow)');}const r2=g.querySelector('circle:nth-child(2)');if(r2){r2.setAttribute('opacity',(place.id===activePlaceId)?'0.5':'0');r2.setAttribute('r','12');}});
"""
if new_hover not in s:
    if old_hover not in s: raise SystemExit('MISSING marker hover anchor')
    s=s.replace(old_hover,new_hover,1)

old_badge="if (typeof place.stage === 'number' && inStory) {"
new_badge="if (typeof place.stage === 'number' && inStory && isFocusRole) {"
if new_badge not in s:
    if old_badge not in s: raise SystemExit('MISSING marker badge anchor')
    s=s.replace(old_badge,new_badge,1)

old_dot="""        dot.setAttribute('r',isActive?'7':'4.5');dot.setAttribute('fill',isActive?'#fff':color);
"""
new_dot="""        dot.setAttribute('r',isActive?'7':String(baseMarkerR));dot.setAttribute('fill',isActive?'#fff':color);
        dot.setAttribute('opacity',isFocusRole?'1':(storyRole==='context'?'0.76':'0.66'));
"""
if new_dot not in s:
    if old_dot not in s: raise SystemExit('MISSING marker dot anchor')
    s=s.replace(old_dot,new_dot,1)

old_font="""        const fontSize=10;
        const textWidth=labelText.length*fontSize*0.6;
"""
new_font="""        const fontSize=roleFontSize;
        const textWidth=labelText.length*fontSize*0.6;
"""
if new_font not in s:
    if old_font not in s: raise SystemExit('MISSING label font anchor')
    s=s.replace(old_font,new_font,1)

s=s.replace("leaderLine.setAttribute('opacity',inStory?'0.9':'0');","leaderLine.setAttribute('opacity',inStory?String(isFocusRole?.9:(storyRole==='context'?.45:.34)):'0');",1)
s=s.replace("labelBg.setAttribute('opacity',inStory?'0.54':'0');","labelBg.setAttribute('opacity',inStory?String(roleBgOpacity):'0');",1)
s=s.replace("label.setAttribute('opacity','0.9');","label.setAttribute('opacity',String(roleLabelOpacity));",1)
engine.write_text(s,'utf-8')

# ── Evidence: semantic roles and visible hierarchy ──
h=harness.read_text('utf-8')
old_desc="storyActive:el.getAttribute('data-story-active'),story:el.getAttribute('data-story')"
new_desc="storyActive:el.getAttribute('data-story-active'),storyRole:el.getAttribute('data-story-role'),story:el.getAttribute('data-story')"
if new_desc not in h:
    if old_desc not in h: raise SystemExit('MISSING describe story role anchor')
    h=h.replace(old_desc,new_desc,1)

old_markers="""    const markers=[...document.querySelectorAll('[data-place-id]')].filter(isVisible).map(el=>({...describe(el),box:rect(el)}));
"""
new_markers="""    const markers=[...document.querySelectorAll('[data-place-id]')].filter(isVisible).map(el=>{
      const label=el.querySelector('.me-place-label'),bg=el.querySelector('.me-place-label-bg'),dot=el.querySelector('.me-marker-dot');
      return{...describe(el),box:rect(el),labelOpacity:label?Number(getComputedStyle(label).opacity):null,labelFontSize:label?parseFloat(getComputedStyle(label).fontSize):null,labelBgOpacity:bg?Number(getComputedStyle(bg).opacity):null,dotRadius:dot?Number(dot.getAttribute('r')):null};
    });
"""
if new_markers not in h:
    if old_markers not in h: raise SystemExit('MISSING marker evidence anchor')
    h=h.replace(old_markers,new_markers,1)

role_gate="story focus role mismatch"
if role_gate not in h:
    old="""        const missingStoryPlaces=story.id==='main'?[]:requiredStoryPlaces.filter(id=>!visibleStoryPlaces.has(id));
        if(missingStoryPlaces.length)result.verificationFailures.push(`story required markers missing ${story.id}: ${missingStoryPlaces.join(', ')}`);
        const overlapLimit=viewport.width<=560?4:6;
"""
    new="""        const missingStoryPlaces=story.id==='main'?[]:requiredStoryPlaces.filter(id=>!visibleStoryPlaces.has(id));
        if(missingStoryPlaces.length)result.verificationFailures.push(`story required markers missing ${story.id}: ${missingStoryPlaces.join(', ')}`);
        const markerById=new Map(geometry.markers.map(marker=>[marker.placeId,marker]));
        const focusIds=sourceStory?.focus_places||sourceStory?.focusPlaceIds||requiredStoryPlaces;
        const contextIds=sourceStory?.context_places||sourceStory?.contextPlaceIds||[];
        const focusRoleMismatch=story.id==='main'?[]:focusIds.filter(id=>markerById.get(id)?.storyRole!=='focus');
        if(focusRoleMismatch.length)result.verificationFailures.push(`story focus role mismatch ${story.id}: ${focusRoleMismatch.join(', ')}`);
        const contextRoleMismatch=story.id==='main'?[]:contextIds.filter(id=>markerById.get(id)?.storyRole!=='context');
        if(contextRoleMismatch.length)result.verificationFailures.push(`story context role mismatch ${story.id}: ${contextRoleMismatch.join(', ')}`);
        const candidateRoleMismatch=story.id==='main'?[]:(sourceStory?.places||[]).filter(id=>sourcePlaces.get(id)?.type==='cand'&&markerById.get(id)?.storyRole!=='candidate');
        if(candidateRoleMismatch.length)result.verificationFailures.push(`story candidate role mismatch ${story.id}: ${candidateRoleMismatch.join(', ')}`);
        const focusVisuals=focusIds.map(id=>markerById.get(id)).filter(Boolean),secondaryVisuals=[...contextIds,...(sourceStory?.places||[]).filter(id=>sourcePlaces.get(id)?.type==='cand')].map(id=>markerById.get(id)).filter(Boolean);
        if(focusVisuals.length&&secondaryVisuals.length&&Math.min(...focusVisuals.map(marker=>marker.labelOpacity??0))<=Math.max(...secondaryVisuals.map(marker=>marker.labelOpacity??0)))result.verificationFailures.push(`story visual hierarchy failed ${story.id}`);
        const overlapLimit=viewport.width<=560?4:6;
"""
    if old not in h: raise SystemExit('MISSING role evidence gate anchor')
    h=h.replace(old,new,1)

# Source schema integrity for role arrays.
old_story_audit="""  stories.forEach(story=>{
    (story.places||[]).forEach(id=>{if(!idSet.has(id))failures.push(`story ${story.id} missing place: ${id}`)});
    (story.stages||[]).forEach(stage=>{if(!Number.isInteger(stage)||stage<0||stage>=stages.length)failures.push(`story ${story.id} invalid stage: ${stage}`)});
  });
"""
new_story_audit="""  stories.forEach(story=>{
    const storyIds=new Set(story.places||[]),focusIds=story.focus_places||story.focusPlaceIds||[],contextIds=story.context_places||story.contextPlaceIds||[];
    (story.places||[]).forEach(id=>{if(!idSet.has(id))failures.push(`story ${story.id} missing place: ${id}`)});
    [...focusIds,...contextIds].forEach(id=>{if(!storyIds.has(id))failures.push(`story ${story.id} role place outside story: ${id}`)});
    focusIds.forEach(id=>{if(contextIds.includes(id))failures.push(`story ${story.id} focus/context overlap: ${id}`)});
    (story.stages||[]).forEach(stage=>{if(!Number.isInteger(stage)||stage<0||stage>=stages.length)failures.push(`story ${story.id} invalid stage: ${stage}`)});
  });
"""
if new_story_audit not in h:
    if old_story_audit not in h: raise SystemExit('MISSING source story audit anchor')
    h=h.replace(old_story_audit,new_story_audit,1)
harness.write_text(h,'utf-8')

print('PASS8 APPLIED')
