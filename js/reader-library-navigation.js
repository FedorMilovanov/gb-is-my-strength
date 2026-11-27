/* Replay a tab-local handoff through the canonical Library mutation owner. */
export async function replayNavigation(raw,{navigationKey,cleanPath,exact,mutateResearch,updateProgress}) {
  try {
    const intent = JSON.parse(raw), p = intent?.progress;
    if (typeof intent?.key !== 'string' || !intent.key || cleanPath(intent.key)!==intent.key ||
        intent.expected?.state!=='reading' || typeof p?.anchor!=='string' ||
        !Number.isFinite(p.ratio) || p.ratio<0 || p.ratio>1 || !Number.isFinite(p.updatedAt)) return;
    await mutateResearch('reading',map=>{
      const live=map[intent.key], prior=intent.ownProgress;
      const successor=typeof prior?.anchor==='string' && Number.isFinite(prior.ratio) &&
        prior.ratio>=0 && prior.ratio<=1 && Number.isFinite(prior.updatedAt) && prior.updatedAt<=p.updatedAt
        ? {...intent.expected,anchor:prior.anchor,ratio:prior.ratio,updatedAt:prior.updatedAt} : null;
      const expected=successor && exact(live,successor) ? successor : intent.expected;
      return updateProgress(map,intent.key,expected,{anchor:p.anchor,ratio:p.ratio,updatedAt:p.updatedAt});
    });
  } catch { /* malformed handoff must not block reading */ }
  finally {
    try { if (sessionStorage.getItem(navigationKey)===raw) sessionStorage.removeItem(navigationKey); } catch {}
  }
}
