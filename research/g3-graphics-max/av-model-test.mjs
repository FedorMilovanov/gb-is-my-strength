import assert from 'node:assert/strict';
import {exhibitView,clock} from '../../src/components/journal/g3-graphics/av-exhibit-model.mjs';
import {fixture,paraphraseFixture} from './av-test-fixture.mjs';
const v=fixture();let passes=0;
const test=(name,fn)=>{fn();passes++;console.log('PASS',name)};
test('approved synthetic full view',()=>assert.equal(exhibitView(v).frame.src,'/test-card.png'));
test('no frame text-only',()=>assert.equal(exhibitView({...v,frame:undefined}).frame,null));
for(const [name,mutation] of Object.entries({
 'no publication':{publication:null},'pending audio':{audio:{...v.audio,status:'pending'}},'wrong audio session':{audio:{...v.audio,sessionId:'OTHER'}},'wrong recording':{audio:{...v.audio,recordingId:'OTHER'}},'wrong time link':{playbackHref:'https://example.invalid/other'},'negative start':{startMs:-1},'inverted interval':{endMs:1},'beyond duration':{durationMs:1},'wrong audio interval':{audio:{...v.audio,endMs:19000}},'missing quote rights':{quoteRights:null},'missing translation rights':{translationRights:null},'changed original':{originalQuote:'OTHER'},'changed translation':{translatedQuote:'OTHER'},'invalid date':{sessionDate:'2026-02-31'},'unsafe recording URL':{recordingUrl:'javascript:alert(1)'},'unsafe playback URL':{playbackHref:'http://example.invalid'},'no sources':{sourceLinks:[]},'wrong citation target':{sourceLinks:[{...v.sourceLinks[0],href:'https://example.invalid'}]},'duplicate citations':{sourceLinks:[v.sourceLinks[0],v.sourceLinks[0]]},'changed attribution':{speaker:'OTHER'},'changed valid date':{sessionDate:'2026-01-01'},'changed source id':{sourceLinks:[{...v.sourceLinks[0],id:'OTHER'}]},'changed audio words':{audio:{...v.audio,originalQuote:'OTHER'}},'wrong publication text':{publication:{...v.publication,translatedQuote:'OTHER'}},'wrong publication mode':{publication:{...v.publication,textMode:'attributed-paraphrase'}},'unknown text mode':{textMode:'other'},'paraphrase with quote':{textMode:'attributed-paraphrase',paraphrase:'TEST'}
}))test(name,()=>assert.equal(exhibitView({...v,...mutation}),null));
for(const [name,mutation] of Object.entries({'frame wrong session':{sessionId:'OTHER'},'frame wrong recording':{recordingId:'OTHER'},'frame timestamp beyond duration':{timestampMs:99999},'frame pending rights':{rights:{...v.frame.rights,status:'pending'}},'frame wrong hash':{sha256:'b'.repeat(64)},'frame traversal':{src:'/../test-card.png'},'frame external':{src:'https://example.invalid/card.png'},'frame empty alt':{alt:''},'frame invalid width':{width:0},'frame moved timestamp':{timestampMs:14000},'frame changed crop':{crop:'OTHER'},'frame changed credit':{credit:'OTHER'}}))test(name,()=>assert.equal(exhibitView({...v,frame:{...v.frame,...mutation}}).frame,null));
test('paraphrase distinct',()=>{assert.equal(exhibitView(paraphraseFixture(v)).textMode,'attributed-paraphrase')});
test('changed reviewed paraphrase',()=>assert.equal(exhibitView({...paraphraseFixture(v),paraphrase:'OTHER'}),null));
test('hour and subsecond time',()=>{assert.equal(clock(3600000),'1:00:00');assert.equal(clock(18001,true),'00:19')});
test('accepted source id cannot point at another valid fragment',()=>assert.equal(exhibitView({...v,sourceLinks:[{...v.sourceLinks[0],href:'#src-OTHER'}]}),null));
test('accepted source label cannot be replaced',()=>assert.equal(exhibitView({...v,sourceLinks:[{...v.sourceLinks[0],label:'OTHER'}]}),null));
test('old id-only approval fails closed',()=>assert.equal(exhibitView({...v,publication:{...v.publication,sourceLinks:undefined,sourceIds:['TEST-SOURCE']}}),null));
test('missing reviewed source entry',()=>assert.equal(exhibitView({...v,publication:{...v.publication,sourceLinks:Array(1)}}),null));
test('sparse source input fails closed',()=>assert.equal(exhibitView({...v,sourceLinks:Array(1)}),null));
test('citation occurrence can vary without changing source identity',()=>assert.equal(exhibitView({...v,sourceLinks:[{...v.sourceLinks[0],citationId:'cite-another-occurrence'}]}).sourceLinks[0].citationId,'cite-another-occurrence'));
test('duplicate source identity even with new occurrence',()=>assert.equal(exhibitView({...v,sourceLinks:[v.sourceLinks[0],{...v.sourceLinks[0],citationId:'cite-other'}],publication:{...v.publication,sourceLinks:[v.publication.sourceLinks[0],v.publication.sourceLinks[0]]}}),null));
test('non-string source fragment fails closed without throwing',()=>assert.equal(exhibitView({...v,sourceLinks:[{...v.sourceLinks[0],href:Symbol('bad')}]}),null));
test('coerced source fragment is not a reviewed string',()=>{const href=[v.sourceLinks[0].href];assert.equal(exhibitView({...v,sourceLinks:[{...v.sourceLinks[0],href}],publication:{...v.publication,sourceLinks:[{...v.publication.sourceLinks[0],href}]}}),null)});
test('non-string frame hash omits frame without throwing',()=>assert.equal(exhibitView({...v,frame:{...v.frame,sha256:Symbol('bad')}}).frame,null));
test('coerced frame hash is not an approved hash string',()=>{const sha256=[v.frame.sha256];assert.equal(exhibitView({...v,frame:{...v.frame,sha256,rights:{...v.frame.rights,sha256}}}).frame,null)});
// URL(string) without a base can accept a different destination than an HTML href.
const withUrl=(field,url)=>({...v,[field]:url,publication:{...v.publication,[field]:url},audio:{...v.audio,[field]:url}});
for(const field of ['recordingUrl','playbackHref']){
 for(const [name,url] of Object.entries({'same-scheme relative':'https:example.invalid/test-recording','extra slash':'https:///example.invalid/test-recording','embedded tab':'https://example.invalid/te\tst','backslash':'https:\\example.invalid\\test-recording','raw space':'https://example.invalid/raw space'}))test(field+' rejects '+name,()=>assert.equal(exhibitView(withUrl(field,url)),null));
 for(const [name,url] of Object.entries({'encoded space':'https://example.invalid/test%20recording','query and fragment':'https://example.invalid/watch?v=abc&start=12#time','IPv6 with port':'https://[2001:db8::1]:8443/test','uppercase scheme':'HTTPS://example.invalid/recording'}))test(field+' accepts '+name,()=>assert.ok(exhibitView(withUrl(field,url))));
}
console.log('AV_MODEL_PASS='+passes);
