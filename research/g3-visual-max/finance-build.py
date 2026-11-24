from pathlib import Path
import json
p=Path(__file__).parent
proposal=json.loads((p/'finance-proposal.json').read_text())
assert proposal['state']=='PUBLICATION_HOLD'
D=proposal['rows']
assert len(D)==7 and all(r['revenue']-r['expenses']==r['result'] for r in D)
css=(p.parent.parent/'src/components/journal/g3-visual/finance.css').read_text()
base='''html{color-scheme:light;--je-paper:#faf7f0;--je-ink:#142536;--je-gold:#896020;--je-rule:#d5cbb9;--je-muted:#5e5b54;--je-serif:Georgia,serif;--je-ui:system-ui,sans-serif}html.dark{color-scheme:dark;--je-paper:#111c27;--je-ink:#f2eadd;--je-gold:#e2bb79;--je-rule:#354554;--je-muted:#bcb8af}body{margin:0;background:var(--je-paper);color:var(--je-ink)}main{width:min(100%,850px);margin:auto;padding:12px;box-sizing:border-box}@media print{html,html.dark{color-scheme:light;background:white}body{background:white}main{padding:0;width:100%}}'''
def ticks(labels):
    return '<div class="gaf-ticks">'+''.join(f'<span style="top:{i*100/(len(labels)-1)}%">{l}</span>' for i,l in enumerate(labels))+'</div>'
years='<div class="gaf-years">'+''.join(f'<span>{r["fy"]}</span>' for r in D)+'</div>'
grid='<path class="gaf-grid" d="M0 0H700 M0 40H700 M0 80H700 M0 120H700 M0 160H700"/>'
zero='<path class="gaf-axis" d="M0 160H700"/>'
primary=''.join(f'<rect class="gaf-revenue" x="{i*100+12}" y="{160-r["revenue"]/2200000*160}" width="32" height="{r["revenue"]/2200000*160}"/>'+f'<rect class="gaf-expense" x="{i*100+56}" y="{160-r["expenses"]/2200000*160}" width="32" height="{r["expenses"]/2200000*160}"/>' for i,r in enumerate(D))
result=''.join(f'<rect class="{"gaf-negative" if r["result"]<0 else "gaf-revenue"}" x="{i*100+24}" y="{80-max(0,r["result"])/800000*80}" width="52" height="{abs(r["result"])/800000*80}"/>' for i,r in enumerate(D))
points=' '.join(f'{i*100+50},{160-r["netAssets"]/1400000*160}' for i,r in enumerate(D))
def plot(labels,markup):return f'<div class="gaf-plot" aria-hidden="true">{ticks(labels)}<div><svg viewBox="0 0 700 160" preserveAspectRatio="none">{grid}{markup}</svg>{years}</div></div>'
labels=['Год','Доходы','Расходы','Результат','Чистые активы']
fmt=lambda x:f'{x:,}'.replace(',','\u00a0').replace('-','−')
rows=''.join(f'<tr role="row"><th scope="row" role="rowheader">{r["fy"]}</th>'+''.join(f'<td role="cell" data-label="{l}">{fmt(r[k])}</td>' for l,k in zip(labels[1:],['revenue','expenses','result','netAssets']))+'</tr>' for r in D)
html=f'''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>G3 — annual financial review</title><style>{base}\n{css}</style></head><body><main><section class="g3-annual-finance" aria-label="Годовая финансовая отчётность"><p class="gaf-hold">Внутренняя приёмка · публикация не разрешена</p><h2>Доходы, расходы и активы</h2><p class="gaf-meta">Финансовые годы, заканчивающиеся в декабре · USD</p><figure class="gaf-primary"><h3>Доходы и расходы</h3><div class="gaf-legend"><span class="gaf-key gaf-revenue">Доходы</span><span class="gaf-key gaf-expense">Расходы</span><span>млн $</span></div>{plot(['2,2','1,65','1,1','0,55','0'],primary+zero)}<figcaption>Общая нулевая шкала. Доходы 2019 года — 100 долларов.</figcaption></figure><div class="gaf-pair"><figure><h3>Годовой результат · млн $</h3>{plot(['+0,8','+0,4','0','−0,4','−0,8'],result+'<path class="gaf-axis" d="M0 80H700"/>')}<figcaption>Доходы минус расходы.</figcaption></figure><figure><h3>Чистые активы · млн $</h3>{plot(['1,4','1,05','0,7','0,35','0'],'<polyline class="gaf-line" points="'+points+'"/>'+zero)}<figcaption>На конец года, не остаток денежных средств.</figcaption></figure></div><table role="table"><caption>Точные значения · USD</caption><thead role="rowgroup"><tr role="row">{''.join(f'<th scope="col" role="columnheader">{l}</th>' for l in labels)}</tr></thead><tbody role="rowgroup">{rows}</tbody></table><p class="gaf-source">IRS Form 990 (2019 — 990-EZ), <a href="https://projects.propublica.org/nonprofits/organizations/842403597">годовые декларации</a>. Не внешний аудит.</p></section></main></body></html>'''
(p/'finance-compact.html.txt').write_text(html)
