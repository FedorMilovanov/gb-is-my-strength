from pathlib import Path
import json

root=Path('.')
engine=root/'karty/_engine/map-engine.js'
routef=root/'karty/avraam/route.json'
harness=root/'scripts/avraam-reference-baseline.mjs'

# ── Declarative story composition: tighter semantic framing, softer war arc ──
r=json.loads(routef.read_text('utf-8'))
for story in r.get('stories',[]):
    if story.get('id')=='war':
        story['cam']=[700,690,480]
        story['viewport']=[700,690,480]
    elif story.get('id')=='akeda':
        story['cam']=[590,860,260]
        story['viewport']=[590,860,260]
r.setdefault('meta',{}).setdefault('mobile_story_viewports',{}).update({
    'war':[700,690,340],
    'akeda':[590,855,190],
})
war_paths=r['stages'][4].get('paths',[])
if len(war_paths)<2:
    raise SystemExit('MISSING war return path')
war_paths[1]['d']='M752,556 C790,605 804,660 780,708 C750,757 690,789 623,800'
routef.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n','utf-8')

# ── Shared premium story styling: legible geography and editorial labels ──
s=engine.read_text('utf-8')
css='''
/* Premium narrative composition: geography remains legible without restoring
   forensic labels; focus/context/candidate read as editorial cartography. */
.me-map[data-map-theme="dark"][data-active-story]:not([data-active-story="main"]) #me-base-geo{
  opacity:.92;
  filter:brightness(1.18) contrast(1.06) saturate(.92);
}
.me-map[data-active-story]:not([data-active-story="main"]) .me-route-main[data-story-active="1"]{
  stroke-width:3.05!important;
  opacity:.96!important;
}
.me-map[data-active-story]:not([data-active-story="main"]) .me-route-underlay[data-story-active="1"]{
  stroke-width:7!important;
  opacity:.16!important;
}
.me-map [data-story-role="focus"] .me-place-label-bg{
  fill:rgba(5,9,14,.82);
  stroke:color-mix(in srgb,var(--me-accent,#e8c879) 38%,transparent);
  stroke-width:.7;
}
.me-map [data-story-role="focus"] .me-place-label{
  fill:#f7efd9;
  font-weight:650;
}
.me-map [data-story-role="context"] .me-place-label-bg{
  fill:rgba(7,11,16,.58);
  stroke:color-mix(in srgb,var(--me-accent,#e8c879) 16%,transparent);
  stroke-width:.45;
}
.me-map [data-story-role="context"] .me-place-label{
  fill:color-mix(in srgb,var(--me-label-text,#f4eedd) 76%,var(--me-muted,#9aa2ae));
  font-weight:520;
}
.me-map [data-story-role="candidate"] .me-place-label-bg{
  fill:rgba(7,11,16,.42);
  stroke:rgba(155,140,240,.28);
  stroke-width:.45;
  stroke-dasharray:2 2;
}
.me-map [data-story-role="candidate"] .me-place-label{
  fill:color-mix(in srgb,#b6a9ff 64%,var(--me-muted,#9aa2ae));
  font-style:italic;
}
.me-map[data-map-theme="light"] [data-story-role="focus"] .me-place-label-bg{
  fill:rgba(255,249,235,.94);
  stroke:rgba(126,82,12,.42);
}
.me-map[data-map-theme="light"] [data-story-role="focus"] .me-place-label{fill:#2d2317}
.me-map[data-map-theme="light"] [data-story-role="context"] .me-place-label-bg{fill:rgba(255,249,235,.72)}
.me-map[data-map-theme="light"] [data-story-role="candidate"] .me-place-label-bg{fill:rgba(249,244,255,.72)}
'''
marker='Premium narrative composition: geography remains legible'
if marker not in s:
    anchor='.me-map[data-active-story]:not([data-active-story="main"]) svg #me-base-geo .lbl-z2{display:none!important}\n'
    if anchor not in s:
        raise SystemExit('MISSING narrative-calm CSS anchor')
    s=s.replace(anchor,anchor+css,1)
engine.write_text(s,'utf-8')

# ── Evidence: route composition must be neither microscopic nor edge-biased ──
h=harness.read_text('utf-8')
composition_gate='story route visual mass too small'
if composition_gate not in h:
    old="""        if(story.id!=='main'&&geometry.counts.baseDetailLabels>0)result.verificationFailures.push(`story forensic background labels ${story.id}: ${geometry.counts.baseDetailLabels}`);
        const overlapLimit=viewport.width<=560?4:6;
"""
    new="""        if(story.id!=='main'&&geometry.counts.baseDetailLabels>0)result.verificationFailures.push(`story forensic background labels ${story.id}: ${geometry.counts.baseDetailLabels}`);
        if(story.id!=='main'&&visualMass){
          const dominant=Math.max(visualMass.widthRatio,visualMass.heightRatio);
          if(dominant<.16)result.verificationFailures.push(`story route visual mass too small ${story.id}: ${dominant.toFixed(3)}`);
          if(visualMass.centerXRatio<.25||visualMass.centerXRatio>.75||visualMass.centerYRatio<.18||visualMass.centerYRatio>.82)result.verificationFailures.push(`story route visual mass off-center ${story.id}: ${visualMass.centerXRatio.toFixed(3)},${visualMass.centerYRatio.toFixed(3)}`);
        }
        const overlapLimit=viewport.width<=560?4:6;
"""
    if old not in h:
        raise SystemExit('MISSING narrative composition gate anchor')
    h=h.replace(old,new,1)
harness.write_text(h,'utf-8')

# Exact-head verification marker: Pass 9 product files are already materialized;
# the next workflow must remain a no-op and run on this human-authored head.
print('PASS9 APPLIED')
