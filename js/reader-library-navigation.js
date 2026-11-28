/* Tab-local ordered handoffs; canonical writes remain under the Library lock. */
function queue(raw) {
  const value=JSON.parse(raw);
  return Array.isArray(value)?value:value?[value]:[];
}
const valid=p=>typeof p?.anchor==='string' && Number.isFinite(p.ratio) &&
  p.ratio>=0 && p.ratio<=1 && Number.isFinite(p.updatedAt);
const fields=p=>({anchor:p.anchor,ratio:p.ratio,updatedAt:p.updatedAt});
export async function replayNavigation({navigationKey,cleanPath,exact,mutateResearch,updateProgress}) {
  let used, items=[], chain=new Map();
  try {
    const result=await mutateResearch('reading',map=>{
      // Read the latest queue inside the canonical lock, not before waiting.
      used=sessionStorage.getItem(navigationKey);
      try { items=queue(used); } catch { items=[]; }
      let next=map;
      for(const intent of items) {
        const key=intent?.key,p=intent?.progress,old=intent?.expected;
        if(typeof key!=='string'||!key||cleanPath(key)!==key||old?.state!=='reading'||!valid(p))continue;
        const live=next[key],prior=intent.ownProgress,previous=chain.get(key);
        const successor=valid(prior)&&prior.updatedAt<=p.updatedAt?{...old,...fields(prior)}:null;
        const own=previous&&exact(previous.old,old)&&previous.next.updatedAt<=p.updatedAt&&exact(live,previous.next);
        const expected=own?previous.next:successor&&exact(live,successor)?successor:old;
        const proposed={...old,...fields(p)};
        // A prior document may have committed the exact bytes before teardown.
        if(exact(live,proposed)){chain.set(key,{old,next:live});continue;}
        const outcome=updateProgress(next,key,expected,fields(p));
        if(outcome.value){next=outcome.value;chain.set(key,{old,next:next[key]});}
      }
      return {value:next};
    });
    if(!result.ok)return;
    const current=sessionStorage.getItem(navigationKey);
    if(current===used){sessionStorage.removeItem(navigationKey);return;}
    // New intent may have been appended after the lock's synchronous prepare.
    // Remove only the identical processed prefix; never delete a foreign queue.
    const all=queue(current);
    if(!items.length||!exact(all.slice(0,items.length),items))return;
    const rest=all.slice(items.length).map(intent=>{
      const prior=chain.get(intent?.key);
      return prior&&exact(intent.expected,prior.old)&&intent.progress?.updatedAt>=prior.next.updatedAt
        ? {...intent,expected:prior.next}:intent;
    });
    if(rest.length)sessionStorage.setItem(navigationKey,JSON.stringify(rest.length===1?rest[0]:rest));
    else sessionStorage.removeItem(navigationKey);
  } catch { /* malformed or unavailable queue must not block reading */ }
}
