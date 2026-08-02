from pathlib import Path
import json

root=Path('.')
engine=root/'karty/_engine/map-engine.js'
routef=root/'karty/avraam/route.json'
svgf=root/'karty/avraam/base.svg'
s=engine.read_text('utf-8')
if 'data-active-story' in s and 'detail-only cartographic labels' in svgf.read_text('utf-8'):
    print('PASS41 ALREADY MATERIALIZED')
    raise SystemExit(0)

def rep(text,old,new,label,count=1):
    n=text.count(old)
    if n<count: raise SystemExit(f'MISSING {label}: {n}')
    return text.replace(old,new,count)

s=rep(s,"    let activeStoryId = initialState.story;\n","    let activeStoryId = initialState.story;\n    container.setAttribute('data-active-story',activeStoryId);\n",'initial active story')
s=rep(s,"      activeStoryId=storyId;\n      close();","      activeStoryId=storyId;\n      container.setAttribute('data-active-story',activeStoryId);\n      close();",'story attribute')
s=rep(s,
'.me-map svg:not([data-zoom-bucket="overview"]) #me-base-geo .lbl-overview{display:none}\n',
'.me-map svg:not([data-zoom-bucket="overview"]) #me-base-geo .lbl-overview{display:none}\n.me-map[data-active-story]:not([data-active-story="main"]) #me-base-geo .lbl-overview{display:none}\n',
'non-main overview labels')
engine.write_text(s,'utf-8')

r=json.loads(routef.read_text('utf-8'))
r.setdefault('meta',{}).setdefault('mobile_story_viewports',{})['lekh-lekha']=[900,520,820]
routef.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n','utf-8')

v=svgf.read_text('utf-8')
# detail-only cartographic labels: keep route lines and relief visible at region
# scale, reveal their names only after deliberate close zoom.
v=v.replace('class="sea-label lbl-z1" x="644" y="730"','class="sea-label lbl-z2" x="644" y="730"')
v=v.replace('class="region-label lbl-z1" x="710" y="870"','class="region-label lbl-z2" x="710" y="870"')
v=v.replace('class="region-label lbl-z1" x="604" y="808"','class="region-label lbl-z2" x="604" y="808"')
for token in [
    '<text x="628" y="697"',
    '<text x="628" y="692"',
    '<text x="628" y="781"',
    '<text x="628" y="786"',
]:
    v=v.replace(token,token.replace('<text ','<text class="lbl-z2" '),1)
# Marker comment for idempotence and future reviewers.
v=v.replace('<!-- Гевал и Геризим: парные контурные хребты, без фантазийных снежных пиктограмм. -->',
            '<!-- Гевал и Геризим: парные контурные хребты; detail-only cartographic labels. -->')
svgf.write_text(v,'utf-8')
print('PASS41 APPLIED')
