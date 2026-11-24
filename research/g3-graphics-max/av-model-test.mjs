import assert from 'node:assert/strict';
import {exhibitView,clock} from '../../src/components/journal/g3-graphics/av-exhibit-model.mjs';
import {fixture} from './av-test-fixture.mjs';
const v=fixture();let passes=0;
const test=(name,fn)=>{fn();passes++;console.log('PASS',name)};
test('approved synthetic full view',()=>assert.equal(exhibitView(v).frame.src,'/test-card.png'));
test('no frame text-only',()=>assert.equal(exhibitView({...v,frame:undefined}).frame,null));
for(const [name,mutation] of Object.entries({
 'no publication':{publication:null},'pending audio':{audio:{...v.audio,status:'pending'}},'wrong audio session':{audio:{...v.audio,sessionId:'OTHER'}},'wrong recording':{audio:{...v.audio,recordingId:'OTHER'}},'wrong time link':{playbackHref:'https://example.invalid/other'},'negative start':{startMs:-1},'inverted interval':{endMs:1},'beyond duration':{durationMs:1},'wrong audio interval':{audio:{...v.audio,endMs:19000}},'missing quote rights':{quoteRights:null},'missing translation rights':{translationRights:null},'changed original':{originalQuote:'OTHER'},'changed translation':{translatedQuote:'OTHER'},'invalid date':{sessionDate:'2026-02-31'},'unsafe recording URL':{recordingUrl:'javascript:alert(1)'},'unsafe playback URL':{playbackHref:'http://example.invalid'},'no sources':{sourceLinks:[]},'wrong citation target':{sourceLinks:[{...v.sourceLinks[0],href:'https://example.invalid'}]},'duplicate citations':{sourceLinks:[v.sourceLinks[0],v.sourceLinks[0]]},'unknown text mode':{textMode:'other'},'paraphrase with quote':{textMode:'attributed-paraphrase',paraphrase:'TEST'}
}))test(name,()=>assert.equal(exhibitView({...v,...mutation}),null));
for(const [name,mutation] of Object.entries({'frame wrong session':{sessionId:'OTHER'},'frame wrong recording':{recordingId:'OTHER'},'frame timestamp beyond duration':{timestampMs:99999},'frame pending rights':{rights:{...v.frame.rights,status:'pending'}},'frame wrong hash':{sha256:'b'.repeat(64)},'frame traversal':{src:'/../test-card.png'},'frame external':{src:'https://example.invalid/card.png'},'frame empty alt':{alt:''},'frame invalid width':{width:0}}))test(name,()=>assert.equal(exhibitView({...v,frame:{...v.frame,...mutation}}).frame,null));
test('paraphrase distinct',()=>{const {originalQuote,translatedQuote,...rest}=v;assert.equal(exhibitView({...rest,textMode:'attributed-paraphrase',paraphrase:'SYNTHETIC PARAPHRASE',frame:undefined}).textMode,'attributed-paraphrase')});
test('hour and subsecond time',()=>{assert.equal(clock(3600000),'1:00:00');assert.equal(clock(18001,true),'00:19')});
console.log('AV_MODEL_PASS='+passes);
