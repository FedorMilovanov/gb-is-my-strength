// Private specimen projection only. Authority is supplied by the admitted claim.
const nonempty=v=>typeof v==='string'&&v.trim().length>0;
const fail=reason=>{throw Error('Evidence family partition: '+reason)};
export function groupEvidenceFamilies(sources,citations,groups){
 if(!Array.isArray(sources)||!sources.length||!Array.isArray(citations)||!Array.isArray(groups)||!groups.length)fail('nonempty inputs required');
 const byId=new Map(), byCitation=new Map();
 for(const source of sources){
  if(!source||!nonempty(source.id)||!nonempty(source.family)||!nonempty(source.locator)||byId.has(source.id))fail('invalid or duplicate source');
  byId.set(source.id,source);
 }
 for(const citation of citations){
  const id=citation?.source?.id,source=byId.get(id);
  if(!source||citation.source!==source||byCitation.has(id)||citation.locator!==source.locator)fail('citation does not match unique admitted source and locator');
  byCitation.set(id,citation);
 }
 if(byCitation.size!==byId.size)fail('incomplete citation set');
 const used=new Set(),labels=new Set(),families=new Set();
 const entries=Array.from(groups,group=>{
  const label=typeof group?.label==='string'?group.label.trim():'';
  if(!nonempty(label)||labels.has(label)||!Array.isArray(group.sourceIds)||!group.sourceIds.length)fail('invalid, empty or duplicate group');
  labels.add(label);
  let family;
  const rows=Array.from(group.sourceIds,id=>{
   const source=byId.get(id),citation=byCitation.get(id);
   if(!source||!citation||used.has(id))fail('unknown or duplicate membership');
   if(family!==undefined&&family!==source.family)fail('mixed families');
   family=source.family;used.add(id);
   return {source,citation};
  });
  if(families.has(family))fail('family split across groups');
  families.add(family);
  return {label,rows};
 });
 if(used.size!==byId.size||entries.flatMap(g=>g.rows).length!==citations.length)fail('incomplete partition');
 return entries;
}
