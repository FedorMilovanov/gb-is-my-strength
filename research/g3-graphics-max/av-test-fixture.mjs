// Synthetic test-only input. Never import from a public route or canonical evidence ledger.
export function fixture(){
 const sessionId='TEST-SESSION',excerptId='TEST-EXCERPT',recordingId='TEST-RECORDING';
 const recordingUrl='https://example.invalid/test-recording',playbackHref=recordingUrl+'?start=12';
 const accepted={status:'accepted',reviewRef:'TEST-ONLY',sessionId,excerptId};
 const originalQuote='SYNTHETIC INTERFACE TOKEN',translatedQuote='СИНТЕТИЧЕСКИЙ ТЕСТОВЫЙ ТЕКСТ';
 const frame={sessionId,recordingId,recordingUrl,src:'/test-card.png',width:640,height:360,alt:'Геометрический тестовый образец; не видеокадр',timestampMs:13000,sha256:'a'.repeat(64),credit:'СИНТЕТИЧЕСКИЙ ОБРАЗЕЦ',crop:'test rectangle',rights:{...accepted,sha256:'a'.repeat(64),src:'/test-card.png'}};
 return {sessionId,excerptId,recordingId,speaker:'ТЕСТОВАЯ АТРИБУЦИЯ (не человек)',event:'ЗАКРЫТЫЙ ТЕСТ',sessionTitle:'СИНТЕТИЧЕСКИЙ МАКЕТ',sessionDate:'2000-01-01',startMs:12000,endMs:18000,durationMs:60000,recordingUrl,playbackHref,textMode:'verified-quote',originalQuote,translatedQuote,publication:accepted,audio:{...accepted,recordingId,recordingUrl,playbackHref,startMs:12000,endMs:18000},quoteRights:{...accepted,text:originalQuote},translationRights:{...accepted,text:translatedQuote},sourceLinks:[{id:'TEST-SOURCE',label:'Тестовый источник',href:'#src-TEST-SOURCE',citationId:'cite-test-av'}],frame};
}
