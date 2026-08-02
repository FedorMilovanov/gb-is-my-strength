from pathlib import Path

p=Path('karty/_engine/map-engine.js')
s=p.read_text('utf-8')
if 'density only resolves narrow portrait canvases' in s:
    print('PASS31 ALREADY MATERIALIZED')
    raise SystemExit(0)

def rep(old,new,label,count=1):
    global s
    n=s.count(old)
    if n<count:
        raise SystemExit(f'MISSING {label}: {n}')
    s=s.replace(old,new,count)

old="""    function semanticZoomBucket(width=view.w){
      const renderedWidth=(canvas.isConnected?canvas:container).getBoundingClientRect().width;
      if(renderedWidth>1){
        const unitsPerPixel=width/renderedWidth;
        const overviewMinDensity=Number(semanticZoomConfig.overview_min_units_per_pixel ?? semanticZoomConfig.overviewMinUnitsPerPixel) || 1.25;
        const detailMaxDensity=Number(semanticZoomConfig.detail_max_units_per_pixel ?? semanticZoomConfig.detailMaxUnitsPerPixel) || 0.72;
        if(unitsPerPixel>=overviewMinDensity)return 'overview';
        if(unitsPerPixel>detailMaxDensity)return 'region';
        return 'detail';
      }
      if(width >= semanticOverviewMinW) return 'overview';
      if(width > semanticDetailMaxW) return 'region';
      return 'detail';
    }
"""
new="""    function semanticZoomBucket(width=view.w){
      // Authored map width remains the primary semantic contract. Rendered
      // density only resolves narrow portrait canvases where raw width lies.
      if(width>=semanticOverviewMinW)return 'overview';
      const renderedWidth=(canvas.isConnected?canvas:container).getBoundingClientRect().width;
      if(renderedWidth>1){
        const unitsPerPixel=width/renderedWidth;
        const overviewMinDensity=Number(semanticZoomConfig.overview_min_units_per_pixel ?? semanticZoomConfig.overviewMinUnitsPerPixel) || 1.25;
        const detailMaxDensity=Number(semanticZoomConfig.detail_max_units_per_pixel ?? semanticZoomConfig.detailMaxUnitsPerPixel) || 0.72;
        if(unitsPerPixel>=overviewMinDensity)return 'overview';
        if(width<=semanticDetailMaxW&&unitsPerPixel<=detailMaxDensity)return 'detail';
        return 'region';
      }
      if(width>semanticDetailMaxW)return 'region';
      return 'detail';
    }
"""
rep(old,new,'hybrid semantic zoom')
rep('.me-story-focus{fill:none;stroke:rgba(232,200,121,.24);stroke-width:1;stroke-dasharray:3 8;vector-effect:non-scaling-stroke;pointer-events:none;opacity:.42}.me-map svg[data-zoom-bucket="overview"] .me-story-focus{display:none}',
    '.me-story-focus{display:none}', 'hide debug focus')
insert='''\n.me-map svg[data-zoom-bucket="region"] #me-base-geo #tradeRoutes{opacity:.18}\n.me-map svg[data-zoom-bucket="detail"] #me-base-geo #tradeRoutes{opacity:.1}\n.me-map svg[data-zoom-bucket="detail"] #me-base-geo #routeWaypoints{opacity:.2}\n'''
rep('.me-map svg[data-zoom-bucket="detail"] #me-ctx{opacity:.55}',
    '.me-map svg[data-zoom-bucket="detail"] #me-ctx{opacity:.55}'+insert, 'background road hierarchy')
rep("under.setAttribute('stroke-width','5.5');under.setAttribute('opacity',storyActive?'0.12':'0.018');",
    "under.setAttribute('stroke-width','5.5');under.setAttribute('opacity',storyActive?'0.16':'0.004');", 'under contrast')
rep("path.setAttribute('stroke-width','2.2');path.setAttribute('opacity',storyActive?'0.72':'0.055');path.setAttribute('marker-end',storyActive?'url(#'+markerId+')':'');",
    "path.setAttribute('stroke-width','2.6');path.setAttribute('opacity',storyActive?'0.9':'0.012');path.setAttribute('marker-end',storyActive?'url(#'+markerId+')':'');", 'path contrast')
rep("p.setAttribute('opacity', storyActive ? (isUnder ? '0.12' : '0.72') : (isUnder ? '0.018' : '0.055'));\n        p.setAttribute('stroke-width', isUnder ? '5.5' : '2.2');",
    "p.setAttribute('opacity', storyActive ? (isUnder ? '0.16' : '0.9') : (isUnder ? '0.004' : '0.012'));\n        p.setAttribute('stroke-width', isUnder ? '5.5' : '2.6');", 'close path contrast')
p.write_text(s,'utf-8')
print('PASS31 APPLIED')
