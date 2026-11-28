import {setTimeout as delay} from 'node:timers/promises';

// Firefox with page JavaScript disabled can leave the FontFaceSet.ready
// promise unresolved even when every actual canonical font has loaded.
// Keep the same font acceptance gate, observe its concrete state and bound
// the wait in the Node host instead of awaiting a page-owned promise.
export async function waitForCanonicalFonts(page){
  const required=['Lora','Playfair Display','Source Sans 3'];
  const deadline=Date.now()+15000;
  let last;
  while(Date.now()<deadline){
    let timer;
    try{
      last=await Promise.race([
        page.evaluate(()=>({status:document.fonts.status,loaded:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family.replace(/['"]/g,''))})),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Font state evaluation timed out')),Math.max(1,deadline-Date.now()));}),
      ]);
    }finally{clearTimeout(timer);}
    if(last.status==='loaded'&&required.every(f=>last.loaded.includes(f)))return last;
    await delay(100);
  }
  throw Error('Canonical font state did not become ready within 15s: '+JSON.stringify(last));
}
