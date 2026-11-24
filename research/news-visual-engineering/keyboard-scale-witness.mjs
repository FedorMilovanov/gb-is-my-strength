import assert from 'node:assert/strict';
import { join } from 'node:path';
import { waitForCanonicalFonts } from './wait-for-canonical-fonts.mjs';

// Two deliberately targeted states per fixture, within existing browser cases.
export const interactionTarget=(width,dark,js,desktop)=>width===320&&dark&&!js||width===desktop&&!dark&&js;

export async function captureKeyboardScale(page,{url,dark,js,evidence,stem,scaleSelector,citations,external,returns}){
  // A different query guarantees a fresh document rather than a fragment-only
  // navigation; the private fixture HTTP server ignores the query.
  const target=new URL(url);target.searchParams.set('qa-keyboard','1');
  await page.emulateMedia({media:'screen'});
  assert.equal((await page.goto(target.href)).status(),200);
  if(dark)await page.evaluate(()=>document.documentElement.classList.add('dark'));
  await waitForCanonicalFonts(page);
  if(js)await page.waitForFunction(()=>document.querySelector('[data-journal-source-navigation]').dataset.journalSourceNavigationBound==='true');
  const links=page.locator('[data-journal-source-navigation] a[href]');
  const kinds=await links.evaluateAll(nodes=>nodes.map(el=>el.hasAttribute('data-journal-citation')?'citation':el.hasAttribute('data-journal-source-return')?'return':el.protocol==='https:'?'external':'unexpected'));
  assert.equal(kinds.filter(k=>k==='citation').length,citations,stem+' citation count');
  assert.equal(kinds.filter(k=>k==='external').length,external,stem+' external count');
  assert.equal(kinds.filter(k=>k==='return').length,returns,stem+' return count');
  assert.equal(kinds.length,citations+external+returns,stem+' unexpected anchors');
  assert.ok(kinds.slice(0,citations).every(k=>k==='citation'),stem+' evidence links precede bibliography');
  assert.equal(kinds.at(-1),'return',stem+' last source return');
  assert.equal(await page.evaluate(()=>document.activeElement===document.body||document.activeElement===document.documentElement),true,stem+' initial focus');
  const focusState=async index=>{
    const state=await links.nth(index).evaluate(el=>{
      const rect=el.getBoundingClientRect(),css=getComputedStyle(el);
      return {active:document.activeElement===el,keyboard:el.matches(':focus-visible'),visible:rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth,outline:css.outlineStyle,outlineWidth:css.outlineWidth,outlineColor:css.outlineColor,boxShadow:css.boxShadow};
    });
    assert.ok(state.active&&state.keyboard&&state.visible,stem+' invalid keyboard focus at '+index+' '+JSON.stringify(state));
    return state;
  };
  const states=[];
  for(let index=0;index<kinds.length;index++){
    await page.keyboard.press('Tab');
    states.push(await focusState(index));
    if(index===0)await page.screenshot({path:join(evidence,stem+'-citation-focus.png')});
    if(index===kinds.length-1)await page.screenshot({path:join(evidence,stem+'-return-focus.png')});
  }
  await page.keyboard.press('Shift+Tab');await focusState(kinds.length-2);
  // Same scoped reading-scale token, not a claim of browser zoom compliance.
  const sizes=()=>page.locator(scaleSelector).evaluateAll(nodes=>nodes.map(el=>parseFloat(getComputedStyle(el).fontSize)));
  const base=await sizes();assert.ok(base.length>0&&base.every(n=>n>0),stem+' scale text missing');
  try{
    await page.evaluate(()=>{document.documentElement.style.setProperty('--gb-reader-font-scale','2');document.activeElement?.blur();window.scrollTo(0,0);});
    const scaled=await sizes();
    assert.equal(scaled.length,base.length);assert.ok(scaled.every((n,i)=>Math.abs(n/base[i]-2)<.01),stem+' scale ratio');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,stem+' enlarged overflow');
    await page.screenshot({path:join(evidence,stem+'-scale2-full.png'),fullPage:true});
    await page.screenshot({path:join(evidence,stem+'-scale2-viewport.png')});
  }finally{await page.evaluate(()=>document.documentElement.style.removeProperty('--gb-reader-font-scale'));}
  assert.deepEqual(await sizes(),base,stem+' scale reset');
  return {stem,tabs:kinds.length,reverse:true,citations,external,returns,scale:2,scaledElements:base.length,focus:states};
}
