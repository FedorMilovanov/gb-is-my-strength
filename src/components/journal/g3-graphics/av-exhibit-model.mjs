// Presentation guard only. The canonical evidence ledger and MAX 0 own approval.
const clean=v=>typeof v==='string'&&v.trim().length>0&&v===v.trim();
const token=v=>clean(v)&&/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const https=v=>{if(!clean(v))return false;try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false}};
const local=v=>clean(v)&&/^\/(?!\/)[A-Za-z0-9/_.,~-]+\.(?:avif|webp|png|jpe?g)$/i.test(v)&&!v.split('/').some(x=>x==='..'||x==='.');
const date=v=>{if(!clean(v)||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===v};
const approval=(a,sessionId,excerptId)=>a?.status==='accepted'&&token(a.reviewRef)&&a.sessionId===sessionId&&a.excerptId===excerptId;
export function clock(ms,ceil=false){const seconds=ceil?Math.ceil(ms/1000):Math.floor(ms/1000);const h=Math.floor(seconds/3600),m=Math.floor(seconds/60)%60,s=seconds%60;return (h?h+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
export function exhibitView(input){
 if(!input||typeof input!=='object')return null;
 const {sessionId,excerptId,recordingId,speaker,event,sessionTitle,sessionDate,startMs,endMs,durationMs,recordingUrl,playbackHref,textMode,sourceLinks,publication,audio,quoteRights,translationRights,originalQuote,translatedQuote,paraphrase,frame}=input;
 if(![sessionId,excerptId,recordingId].every(token)||![speaker,event,sessionTitle].every(clean)||!date(sessionDate)||!integer(startMs)||!integer(endMs)||endMs<=startMs||!integer(durationMs)||endMs>durationMs||!https(recordingUrl)||!https(playbackHref))return null;
 if(!approval(publication,sessionId,excerptId)||!approval(audio,sessionId,excerptId)||audio.recordingId!==recordingId||audio.startMs!==startMs||audio.endMs!==endMs||audio.recordingUrl!==recordingUrl||audio.playbackHref!==playbackHref)return null;
 if(!Array.isArray(sourceLinks)||!sourceLinks.length||sourceLinks.some(s=>!token(s?.id)||!clean(s.label)||!/^#(?:src-|history-source-)[A-Za-z0-9._:-]+$/.test(s.href)||!token(s.citationId))||new Set(sourceLinks.map(s=>s.citationId)).size!==sourceLinks.length)return null;
 // Bind the reviewed presentation to the actual payload; approval is not a generic switch.
 if(publication.textMode!==textMode||publication.recordingId!==recordingId||publication.speaker!==speaker||publication.event!==event||publication.sessionTitle!==sessionTitle||publication.sessionDate!==sessionDate||publication.startMs!==startMs||publication.endMs!==endMs||publication.durationMs!==durationMs||publication.recordingUrl!==recordingUrl||publication.playbackHref!==playbackHref)return null;
 if(!Array.isArray(publication.sourceIds)||publication.sourceIds.length!==sourceLinks.length||sourceLinks.some((s,i)=>s.id!==publication.sourceIds[i]))return null;
 if(textMode==='verified-quote'){
   if(!clean(originalQuote)||!clean(translatedQuote)||!approval(quoteRights,sessionId,excerptId)||!approval(translationRights,sessionId,excerptId)||audio.originalQuote!==originalQuote||publication.originalQuote!==originalQuote||publication.translatedQuote!==translatedQuote||quoteRights.text!==originalQuote||translationRights.text!==translatedQuote)return null;
 }else if(textMode==='attributed-paraphrase'){
   if(!clean(paraphrase)||publication.paraphrase!==paraphrase||originalQuote!==undefined||translatedQuote!==undefined)return null;
 }else return null;
 const validFrame=frame&&frame.sessionId===sessionId&&frame.recordingId===recordingId&&frame.recordingUrl===recordingUrl&&integer(frame.timestampMs)&&frame.timestampMs<=durationMs&&integer(frame.width)&&frame.width>0&&integer(frame.height)&&frame.height>0&&local(frame.src)&&/^[a-f0-9]{64}$/i.test(frame.sha256||'')&&[frame.alt,frame.credit,frame.crop].every(clean)&&approval(frame.rights,sessionId,excerptId)&&frame.rights.sha256===frame.sha256&&frame.rights.src===frame.src&&frame.rights.recordingId===recordingId&&frame.rights.timestampMs===frame.timestampMs&&frame.rights.crop===frame.crop&&frame.rights.credit===frame.credit;
 return {...input,frame:validFrame?frame:null,interval:clock(startMs)+'–'+clock(endMs,true),frameTime:validFrame?clock(frame.timestampMs):null};
}
