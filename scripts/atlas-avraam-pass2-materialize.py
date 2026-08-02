from pathlib import Path

engine=Path('karty/_engine/map-engine.js')
harness=Path('scripts/avraam-reference-baseline.mjs')

# Narrative story selection must remain cartographically calm even when a tight
# camera would normally cross into the forensic detail bucket. Story-owned
# markers stay visible; base lbl-z2 evidence waits for free exploration.
s=engine.read_text('utf-8')
rule='.me-map[data-active-story]:not([data-active-story="main"]) svg #me-base-geo .lbl-z2{display:none!important}'
if rule not in s:
    anchor='.me-map[data-active-story]:not([data-active-story="main"]) #me-base-geo .lbl-overview{display:none}\n'
    if anchor not in s:
        raise SystemExit('MISSING non-main overview-label anchor')
    s=s.replace(anchor,anchor+rule+'\n',1)
engine.write_text(s,'utf-8')

# Persist the narrative-calm contract in browser evidence, not only CSS.
h=harness.read_text('utf-8')
detail_decl="const visibleBaseDetailLabels=[...document.querySelectorAll('#me-base-geo .lbl-z2')].filter(isVisible);"
if detail_decl not in h:
    anchor="""    const labels=allLabels.filter(({box})=>box.right>0&&box.bottom>0&&box.left<width&&box.top<height);
    const offscreenLabels=labels.filter(({box})=>box.left<-1||box.top<-1||box.right>width+1||box.bottom>height+1);
"""
    replacement="""    const labels=allLabels.filter(({box})=>box.right>0&&box.bottom>0&&box.left<width&&box.top<height);
    const visibleBaseDetailLabels=[...document.querySelectorAll('#me-base-geo .lbl-z2')].filter(isVisible);
    const offscreenLabels=labels.filter(({box})=>box.left<-1||box.top<-1||box.right>width+1||box.bottom>height+1);
"""
    if anchor not in h:
        raise SystemExit('MISSING label collection anchor')
    h=h.replace(anchor,replacement,1)

old_counts="counts:{labels:labels.length,markers:markers.length,controls:controls.length,routes:routes.length,offscreenLabels:offscreenLabels.length,labelOverlaps:labelOverlaps.length,undersizedControls:undersizedControls.length,offscreenControls:offscreenControls.length,scrollReachableControls:controls.filter(control=>control.scrollReachable).length},"
new_counts="counts:{labels:labels.length,baseDetailLabels:visibleBaseDetailLabels.length,markers:markers.length,controls:controls.length,routes:routes.length,offscreenLabels:offscreenLabels.length,labelOverlaps:labelOverlaps.length,undersizedControls:undersizedControls.length,offscreenControls:offscreenControls.length,scrollReachableControls:controls.filter(control=>control.scrollReachable).length},"
if new_counts not in h:
    if old_counts not in h:
        raise SystemExit('MISSING geometry counts anchor')
    h=h.replace(old_counts,new_counts,1)

calm_gate="story forensic background labels"
if calm_gate not in h:
    old="""        if(focusVisuals.length&&secondaryVisuals.length&&Math.min(...focusVisuals.map(marker=>marker.labelOpacity??0))<=Math.max(...secondaryVisuals.map(marker=>marker.labelOpacity??0)))result.verificationFailures.push(`story visual hierarchy failed ${story.id}`);
        const overlapLimit=viewport.width<=560?4:6;
"""
    new="""        if(focusVisuals.length&&secondaryVisuals.length&&Math.min(...focusVisuals.map(marker=>marker.labelOpacity??0))<=Math.max(...secondaryVisuals.map(marker=>marker.labelOpacity??0)))result.verificationFailures.push(`story visual hierarchy failed ${story.id}`);
        if(story.id!=='main'&&geometry.counts.baseDetailLabels>0)result.verificationFailures.push(`story forensic background labels ${story.id}: ${geometry.counts.baseDetailLabels}`);
        const overlapLimit=viewport.width<=560?4:6;
"""
    if old not in h:
        raise SystemExit('MISSING narrative-calm gate anchor')
    h=h.replace(old,new,1)
harness.write_text(h,'utf-8')

print('PASS8.1 APPLIED')
