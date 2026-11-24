import assert from 'node:assert/strict';
import { join } from 'node:path';
import { waitForCanonicalFonts } from './wait-for-canonical-fonts.mjs';

// Two deliberately targeted states per fixture, within existing browser cases.
export const interactionTarget=(width,dark,js,desktop)=>width===320&&dark&&!js||width===desktop&&!dark&&js;

export function assertFocusWitness(state,label='keyboard focus'){
  assert.ok(state.active,label+' did not receive native keyboard focus');
  assert.ok(state.keyboard,label+' is not :focus-visible');
  assert.ok(state.indicatorVisible,label+' has no painted focus indicator');
  assert.ok(state.boundsInside,label+' focus indicator is clipped by viewport');
  assert.ok(state.unobscured,label+' focus target is obscured by an overlay');
  assert.ok(state.visible,label+' target and focus indicator are not fully visible');
  return state;
}

export async function captureKeyboardScale(page,{url,dark,js,evidence,stem,scaleSelector,citations,external,returns}){
  // Keep the mobile witness deliberately short: full-page height must not mask
  // clipping or fixed/sticky overlays at the actual reading viewport.
  const original=page.viewportSize();
  const viewport={width:original.width,height:original.width<=430?640:768};
  await page.setViewportSize(viewport);
  const target=new URL(url);target.searchParams.set('qa-keyboard','2x-short-viewport');
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
  const sizes=()=>page.locator(scaleSelector).evaluateAll(nodes=>nodes.map(el=>parseFloat(getComputedStyle(el).fontSize)));
  const base=await sizes();assert.ok(base.length>0&&base.every(n=>n>0),stem+' scale text missing');
  const focusState=async index=>{
    const state=await links.nth(index).evaluate(el=>{
      const rect=el.getBoundingClientRect(),css=getComputedStyle(el);
      const outlineWidth=parseFloat(css.outlineWidth)||0,outlineOffset=parseFloat(css.outlineOffset)||0;
      const outlineColorVisible=css.outlineColor!=='transparent'&&!/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/u.test(css.outlineColor);
      const outlineVisible=css.outlineStyle!=='none'&&outlineWidth>0&&outlineColorVisible;
      const shadowVisible=css.boxShadow!=='none'&&!/rgba\([^)]*,\s*0(?:\.0+)?\s*\)/u.test(css.boxShadow);
      const indicatorVisible=outlineVisible||shadowVisible;
      const outset=outlineVisible?Math.max(0,outlineWidth+outlineOffset):shadowVisible?2:0;
      const paint={left:rect.left-outset,right:rect.right+outset,top:rect.top-outset,bottom:rect.bottom+outset};
      const targetInside=rect.width>0&&rect.height>0&&rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight;
      const boundsInside=paint.left>=0&&paint.top>=0&&paint.right<=innerWidth&&paint.bottom<=innerHeight;
      const center=document.elementFromPoint((rect.left+rect.right)/2,(rect.top+rect.bottom)/2);
      const centerVisible=!!center&&(center===el||el.contains(center));
      const samples=[[paint.left+.5,(rect.top+rect.bottom)/2],[paint.right-.5,(rect.top+rect.bottom)/2],[(rect.left+rect.right)/2,paint.top+.5],[(rect.left+rect.right)/2,paint.bottom-.5]];
      const overlayAt=(x,y)=>{
        if(x<0||y<0||x>=innerWidth||y>=innerHeight)return false;
        const top=document.elementFromPoint(x,y);
        if(!top||top===document.body||top===document.documentElement||top===el||el.contains(top)||top.contains(el))return false;
        const style=getComputedStyle(top),z=style.zIndex==='auto'?null:Number(style.zIndex);
        return style.visibility!=='hidden'&&Number(style.opacity)>0&&style.pointerEvents!=='none'&&
          (style.position==='fixed'||style.position==='sticky'||(['absolute','relative'].includes(style.position)&&z!==null&&z>=0));
      };
      const unobscured=centerVisible&&!samples.some(([x,y])=>overlayAt(x,y));
      return {
        active:document.activeElement===el,keyboard:el.matches(':focus-visible'),
        targetInside,boundsInside,indicatorVisible,unobscured,
        visible:targetInside&&boundsInside&&indicatorVisible&&unobscured,
        scale:2,viewport:{width:innerWidth,height:innerHeight},
        paint,outline:css.outlineStyle,outlineWidth:css.outlineWidth,
        outlineOffset:css.outlineOffset,outlineColor:css.outlineColor,boxShadow:css.boxShadow
      };
    });
    return assertFocusWitness(state,stem+' link '+index);
  };
  try{
    await page.evaluate(()=>{document.documentElement.style.setProperty('--gb-reader-font-scale','2');window.scrollTo(0,0);});
    const scaled=await sizes();
    assert.equal(scaled.length,base.length);assert.ok(scaled.every((n,i)=>Math.abs(n/base[i]-2)<.01),stem+' scale ratio');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,stem+' enlarged overflow');
    const states=[];
    // Native Tab is exercised only after the 2x Reader scale is active.
    for(let index=0;index<kinds.length;index++){
      await page.keyboard.press('Tab');
      states.push(await focusState(index));
      if(index===0){
        await page.screenshot({path:join(evidence,stem+'-citation-focus.png')});
        await page.screenshot({path:join(evidence,stem+'-scale2-full.png'),fullPage:true});
        await page.screenshot({path:join(evidence,stem+'-scale2-viewport.png')});
      }
      if(index===kinds.length-1)await page.screenshot({path:join(evidence,stem+'-return-focus.png')});
    }
    await page.keyboard.press('Shift+Tab');await focusState(kinds.length-2);
    assert.deepEqual(await sizes(),scaled,stem+' scale changed during keyboard navigation');
    return {stem,tabs:kinds.length,reverse:true,citations,external,returns,scale:2,scaledElements:base.length,viewport,focus:states};
  }finally{
    await page.evaluate(()=>document.documentElement.style.removeProperty('--gb-reader-font-scale'));
    assert.deepEqual(await sizes(),base,stem+' scale reset');
  }
}
