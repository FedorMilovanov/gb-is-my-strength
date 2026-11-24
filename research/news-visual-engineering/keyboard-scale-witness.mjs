import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { waitForCanonicalFonts } from './wait-for-canonical-fonts.mjs';

// Two deliberately targeted states per fixture, within existing browser cases.
export const interactionTarget=(width,dark,js,desktop)=>width===320&&dark&&!js||width===desktop&&!dark&&js;

export function assertFocusWitness(state,label='keyboard focus'){
  assert.ok(state.active,label+' did not receive native keyboard focus');
  assert.ok(state.keyboard,label+' is not :focus-visible');
  assert.ok(state.outlineWidth>=2&&state.outlineStyle==='solid'&&state.outline>=2&&state.outlineColorVisible,
    label+' fails the existing G3 painted-outline contract');
  assert.ok(state.indicatorVisible,label+' has no painted focus indicator');
  assert.ok(state.boundsInside,label+' focus indicator is clipped by viewport/header');
  assert.ok(state.clipInside,label+' focus indicator is clipped by an ancestor scrollport');
  assert.ok(Array.isArray(state.fragments)&&state.fragments.length>0&&state.fragments.every(fragment=>fragment.centerVisible===true),label+' actual link fragment is obscured');
  assert.ok(state.unobscured,label+' focus target is obscured by an overlay');
  assert.ok(state.visible,label+' target and focus indicator are not fully visible');
  return state;
}

export async function captureKeyboardScale(page,{url,dark,js,evidence,stem,scaleSelector,citations,external,returns}){
  // Borrow the production G3 harness' short-window sizes and native focus rules.
  // A short height must not be masked by a tall full-page viewport.
  const original=page.viewportSize();
  const viewport={width:original.width,height:original.width<=430?640:768};
  await page.setViewportSize(viewport);
  const target=new URL(url);target.searchParams.set('qa-keyboard','g3-native-focus-2x');
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
  const settleNativeScroll=async()=>{
    let previous,stable=0;
    for(let attempt=0;attempt<90;attempt++){
      const current=await page.evaluate(()=>{
        const rect=document.activeElement.getBoundingClientRect(),header=document.querySelector('.mcp-top');
        const style=header&&getComputedStyle(header);
        const headerBottom=style&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)>0?Math.max(0,header.getBoundingClientRect().bottom):0;
        return [scrollY,rect.top,rect.bottom,headerBottom];
      });
      stable=previous&&current.every((value,index)=>Math.abs(value-previous[index])<.5)?stable+1:0;
      if(stable>=5)return;
      previous=current;
      await page.waitForTimeout(50);
    }
    throw new Error(stem+' native focus scrolling did not settle');
  };
  let phase='scale',lastState=null;
  const measureFocus=async index=>links.nth(index).evaluate(el=>{
      const rect=el.getBoundingClientRect(),css=getComputedStyle(el);
      const outlineWidth=parseFloat(css.outlineWidth)||0,outlineOffset=parseFloat(css.outlineOffset)||0;
      const outline=Math.max(0,outlineWidth+outlineOffset);
      const outlineColorVisible=css.outlineColor!=='transparent'&&!/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/u.test(css.outlineColor);
      const outlineStyle=css.outlineStyle;
      const indicatorVisible=outlineWidth>=2&&outlineStyle==='solid'&&outline>=2&&outlineColorVisible;
      const paint={left:rect.left-outline,right:rect.right+outline,top:rect.top-outline,bottom:rect.bottom+outline};
      const header=document.querySelector('.mcp-top'),headerStyle=header&&getComputedStyle(header);
      const headerBottom=headerStyle&&headerStyle.display!=='none'&&headerStyle.visibility!=='hidden'&&Number(headerStyle.opacity)>0?Math.max(0,header.getBoundingClientRect().bottom):0;
      const usableViewportWidth=document.documentElement.clientWidth;
      const targetInside=rect.width>0&&rect.height>0&&rect.left>=-1&&rect.right<=usableViewportWidth+1&&rect.top>=headerBottom-1&&rect.bottom<=innerHeight+1;
      const boundsInside=paint.left>=-1&&paint.right<=usableViewportWidth+1&&paint.top>=headerBottom-1&&paint.bottom<=innerHeight+1;
      // A multi-line inline anchor's union rectangle includes empty space
      // between/after lines. Hit-test every actual nonempty fragment instead.
      const describe=node=>node?{tag:node.tagName,id:node.id,className:String(node.className||'')}:null;
      const fragments=[...el.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>{
        const hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
        return {rect:r.toJSON(),centerVisible:!!hit&&(hit===el||el.contains(hit)),hit:describe(hit)};
      });
      const centerVisible=fragments.length>0&&fragments.every(f=>f.centerVisible);
      const clippingAncestors=[];
      for(let ancestor=el.parentElement;ancestor&&ancestor!==document.body&&ancestor!==document.documentElement;ancestor=ancestor.parentElement){
        const style=getComputedStyle(ancestor),r=ancestor.getBoundingClientRect();
        const clipX=['hidden','clip','auto','scroll'].includes(style.overflowX);
        const clipY=['hidden','clip','auto','scroll'].includes(style.overflowY);
        if(!clipX&&!clipY)continue;
        const clip={left:r.left+ancestor.clientLeft,right:r.left+ancestor.clientLeft+ancestor.clientWidth,
          top:r.top+ancestor.clientTop,bottom:r.top+ancestor.clientTop+ancestor.clientHeight};
        const clipped=(clipX&&(paint.left<clip.left-1||paint.right>clip.right+1))||
          (clipY&&(paint.top<clip.top-1||paint.bottom>clip.bottom+1));
        if(clipped)clippingAncestors.push({tag:ancestor.tagName,id:ancestor.id,className:String(ancestor.className||''),clip});
      }
      const clipInside=clippingAncestors.length===0;
      const samples=fragments.flatMap(({rect:r})=>[[r.left-outline+.5,(r.top+r.bottom)/2],[r.right+outline-.5,(r.top+r.bottom)/2],[(r.left+r.right)/2,r.top-outline+.5],[(r.left+r.right)/2,r.bottom+outline-.5]]);
      const overlayAt=(x,y)=>{
        if(x<0||y<0||x>=usableViewportWidth||y>=innerHeight)return false;
        const top=document.elementFromPoint(x,y);
        if(!top||top===document.body||top===document.documentElement||top===el||el.contains(top)||top.contains(el))return false;
        const style=getComputedStyle(top),z=style.zIndex==='auto'?null:Number(style.zIndex);
        return style.visibility!=='hidden'&&Number(style.opacity)>0&&style.pointerEvents!=='none'&&
          (style.position==='fixed'||style.position==='sticky'||(['absolute','relative'].includes(style.position)&&z!==null&&z>=0));
      };
      const overlayHits=samples.filter(([x,y])=>overlayAt(x,y)).map(([x,y])=>({x,y,hit:describe(document.elementFromPoint(x,y))}));
      const unobscured=centerVisible&&overlayHits.length===0;
      return {
        active:document.activeElement===el,keyboard:el.matches(':focus-visible'),
        targetInside,boundsInside,clipInside,clippingAncestors,indicatorVisible,outlineWidth,outlineOffset,outline,outlineStyle,
        outlineColor:css.outlineColor,outlineColorVisible,unobscured,fragments,overlayHits,
        target:{id:el.id,href:el.getAttribute('href'),text:el.textContent.trim().slice(0,240),rect:rect.toJSON(),scrollMarginTop:css.scrollMarginTop,scrollMarginBottom:css.scrollMarginBottom},
        activeElement:describe(document.activeElement),scrollY,scrollHeight:document.documentElement.scrollHeight,
        visible:targetInside&&boundsInside&&clipInside&&indicatorVisible&&unobscured,
        scale:2,viewport:{width:innerWidth,height:innerHeight},headerBottom,usableViewportWidth,paint
      };
    });
  const focusState=async index=>{
    lastState=await measureFocus(index);
    // Match the proven G3 driver-side bounded visibility wait, without
    // scrolling or refocusing from the test. A persistent failure still fails.
    for(let step=0;step<45&&lastState.active&&lastState.keyboard&&!lastState.boundsInside;step++){
      await page.waitForTimeout(75);
      lastState=await measureFocus(index);
    }
    return assertFocusWitness(lastState,stem+' link '+index);
  };
  try{
    await page.evaluate(()=>{document.documentElement.style.setProperty('--gb-reader-font-scale','2');window.scrollTo(0,0);});
    const scaled=await sizes();
    assert.equal(scaled.length,base.length);assert.ok(scaled.every((n,i)=>Math.abs(n/base[i]-2)<.01),stem+' scale ratio');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false,stem+' enlarged overflow');
    const states=[];
    // Native Tab is exercised only after the 2x Reader scale is active.
    for(let index=0;index<kinds.length;index++){
      phase='forward Tab '+index+' '+kinds[index];lastState=null;
      await page.keyboard.press('Tab');
      await settleNativeScroll();
      states.push(await focusState(index));
      if(index===0){
        await page.screenshot({path:join(evidence,stem+'-citation-focus.png')});
        await page.screenshot({path:join(evidence,stem+'-scale2-viewport.png')});
      }
      if(index===kinds.length-1)await page.screenshot({path:join(evidence,stem+'-return-focus.png')});
    }
    phase='reverse Shift+Tab';lastState=null;
    await page.keyboard.press('Shift+Tab');
    await settleNativeScroll();
    await focusState(kinds.length-2);
    assert.deepEqual(await sizes(),scaled,stem+' scale changed during keyboard navigation');
    // Full-page capture may temporarily alter browser scroll/layout; do it only
    // after the complete native traversal, not between consecutive Tab events.
    phase='full-page evidence';
    await page.screenshot({path:join(evidence,stem+'-scale2-full.png'),fullPage:true});
    return {stem,tabs:kinds.length,reverse:true,citations,external,returns,scale:2,scaledElements:base.length,viewport,focus:states};
  }catch(error){
    const diagnostic={stem,phase,error:error.message,state:lastState,url:page.url(),viewport};
    await writeFile(join(evidence,stem+'-focus-failure.json'),JSON.stringify(diagnostic,null,2));
    console.error('KEYBOARD_FOCUS_FAILURE '+JSON.stringify(diagnostic));
    await page.screenshot({path:join(evidence,stem+'-focus-failure.png'),timeout:8000}).catch(e=>console.error('FOCUS_SCREENSHOT_FAILURE '+e.message));
    throw error;
  }finally{
    await page.evaluate(()=>document.documentElement.style.removeProperty('--gb-reader-font-scale'));
    assert.deepEqual(await sizes(),base,stem+' scale reset');
  }
}
