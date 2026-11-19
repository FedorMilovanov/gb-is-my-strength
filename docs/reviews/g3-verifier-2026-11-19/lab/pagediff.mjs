import fs from 'node:fs';
const [a,b]=[process.argv[2],process.argv[3]];
const rd=p=>fs.readFileSync(p,'utf8');
const links=s=>new Set([...s.matchAll(/href="(\/[^"#?]*)(?:[#?][^"]*)?"/g)].map(m=>m[1]).filter(h=>!/\.(css|js|png|jpe?g|webp|avif|svg|ico|woff2|xml|json)$/.test(h)));
const meta=s=>{const o={};for(const m of s.matchAll(/<meta\s+(?:name|property)="([^"]+)"\s+content="([^"]*)"/g))o[m[1]]=m[2];const c=s.match(/<link rel="canonical" href="([^"]+)"/);o.canonical=c&&c[1];o.title=(s.match(/<title>([^<]*)/)||[])[1];o.robots=o.robots||'(none)';return o;};
const ld=s=>[...s.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>{try{const j=JSON.parse(m[1]);return (j['@graph']||[j]).map(x=>x['@type']).flat().join(',')}catch{return 'PARSE_ERR'}});
const text=s=>s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|\s+/g,' ');
for(const page of ['articles/index.html','journal/index.html','journal/dossiers/g3/index.html']){
  const A=rd(`${a}/${page}`),B=rd(`${b}/${page}`);
  const la=links(A),lb=links(B);
  const lost=[...la].filter(x=>!lb.has(x)),added=[...lb].filter(x=>!la.has(x));
  const ma=meta(A),mb=meta(B);const md=Object.keys({...ma,...mb}).filter(k=>ma[k]!==mb[k]);
  console.log(`\n## ${page}\n links lane=${la.size} a8=${lb.size} lost=${JSON.stringify(lost)} added=${JSON.stringify(added.slice(0,12))}${added.length>12?' …+'+(added.length-12):''}`);
  console.log(' meta changed:',md.map(k=>`${k}: «${(ma[k]||'').slice(0,70)}» → «${(mb[k]||'').slice(0,70)}»`).join('\n   ')||'none');
  console.log(' JSON-LD types lane',ld(A),'a8',ld(B));
  console.log(' text words lane',text(A).split(' ').length,'a8',text(B).split(' ').length);
}
