/* ARGON W57: one geometry axis and canonical Product typography.
   Real Product actions are not cloned. Integrates only in ?reader-pilot=1. */
(()=>{'use strict';
  const $=s=>document.querySelector(s);
  const body=document.body;
  const choices={
    size:{sm:.9,md:1,lg:1.1,xl:1.2},
    spacing:{compact:'compact',normal:'normal',relaxed:'relaxed'},
    width:{narrow:'narrow',normal:'normal',wide:'wide'},
    font:{lora:'lora',cormorant:'cormorant'}
  };
  const valid=()=>body.classList.contains('np-u-preview')&&!!$('#npUResearch .np-u-right-scroll');
  function begin(){
    if(body.classList.contains('np-w57-ready'))return true;
    if(!valid())return false;
    const fontPanel=$('#npUFontPanel');
    const fontControls=fontPanel?.querySelector('.np-u-type-options');
    if(!fontPanel||!fontControls||!window.GBReaderPreferences)return false;
    const canon=window.GBReaderPreferences;
    fontPanel.setAttribute('aria-label','Настройки чтения');
    // If user selected a non-default ARGON font in the old pilot, migrate once,
    // but never erase an explicit canonical choice.
    const migrationKey='np-w57-prefs-migrated-v1';
    if(!localStorage.getItem(migrationKey)){
      let legacy=null;
      try{legacy=JSON.parse(localStorage.getItem('np-u-argon-reading-v1')||'null')}catch(_){}
      const current=canon.get();
      const patch={};
      if(legacy&&typeof legacy==='object'){
        if(current.fontFamily==='lora'&&legacy.font==='cormorant')patch.fontFamily='cormorant';
        if(current.fontScale===1&&choices.size[legacy.size]&&legacy.size!=='md')
          patch.fontScale=choices.size[legacy.size];
        if(current.lineHeight==='normal'&&legacy.spacing==='relaxed')patch.lineHeight='relaxed';
        if(current.measure==='normal'&&legacy.width==='wide')patch.measure='wide';
      }
      if(Object.keys(patch).length)canon.set(patch,{source:'argon-w57-migrate'});
      try{localStorage.setItem(migrationKey,'1')}catch(_){}
    }
    const nearest=(scale)=>{
      const arr=Object.entries(choices.size);
      arr.sort((a,b)=>Math.abs(a[1]-scale)-Math.abs(b[1]-scale));
      return arr[0][0];
    };
    function syncTypography(){
      const v=canon.get();
      body.dataset.npUFont=v.fontFamily||'lora';
      body.style.setProperty('--np-w57-reading-measure',
        v.measure==='narrow'?'576px':v.measure==='wide'?'736px':'688px');
      const selection={
        font:v.fontFamily||'lora',
        size:nearest(v.fontScale),
        spacing:choices.spacing[v.lineHeight]||'normal',
        theme:v.theme,
        text:v.textMode,
        motion:v.motion,
        width:v.measure==='narrow'?'narrow':v.measure==='wide'?'wide':'normal'
      };
      for(const [type,value] of Object.entries(selection)){
        for(const el of fontPanel.querySelectorAll('[data-np-u-type-'+type+']')){
          el.setAttribute('aria-pressed',String(el.getAttribute('data-np-u-type-'+type)===value));
        }
      }
      body.dataset.npUWidth=selection.width;
      body.dataset.npUSize=selection.size;
      body.dataset.npUSpacing=selection.spacing;
    }
    // Input events are handled exclusively by the original left settings owner.
    if(typeof canon.subscribe==='function')canon.subscribe(syncTypography);
    window.addEventListener('storage',e=>{
      if(e.key===canon.storageKey)syncTypography();
    });
    syncTypography();
    // The two 44px floating actions use the same right-based CSS reference
    // as the 40px real reading tools. No self-measurement, custom X property,
    // or viewport-width/scrollbar-width discrepancy is needed.
    body.classList.add('np-w57-ready');
    window.__NP_W57__={ready:true,version:'57',canonicalPrefs:true,annotations:false};
    console.info('NP_W57_CORE_READY');
    return true;
  }
  let attempts=0;
  function gate(){if(begin())return;if(++attempts<300)requestAnimationFrame(gate)}
  gate();
})();
