/* W55 - direct, semantic Reader context actions. Original buttons/events only. */
(()=>{
 'use strict';
 const mount=()=>{
  if(!document.body.classList.contains('np-u-preview'))return false;
  const head=document.querySelector('#npUResearch .np-u-right-head');
  const actions=head?.querySelector('.np-u-right-actions');
  const follow=document.querySelector('#npUResearch .np-u-research-follow');
  const history=actions?.querySelector('#npUHistoryButton');
  const library=actions?.querySelector('#npULibraryButton');
  if(!actions||!follow||!history||!library)return false;
  if(follow.querySelector('.np-u-context-actions'))return true;
  const group=document.createElement('div');
  group.className='np-u-context-actions';
  group.setAttribute('role','group');
  group.setAttribute('aria-label','История чтения и библиотека');
  for(const [button,label] of [
   [history,'\u0418\u0441\u0442\u043e\u0440\u0438\u044f'],
   [library,'\u0411\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0430']]){
   button.classList.remove('np-u-editor-menu-action');
   button.classList.add('np-u-context-action');
   button.querySelectorAll('.np-u-editor-menu-label').forEach(el=>el.remove());
   const word=document.createElement('span');
   word.className='np-u-context-word';
   word.textContent=label;
   button.append(word);
   group.append(button);
  }
  const chapter=follow.querySelector('#npUFollowChapter');
  if(chapter)chapter.hidden=true;
  follow.append(group);
  const drawer=document.querySelector('#npUHistoryDrawer');
  if(drawer){
   const hide=()=>{
    if(drawer.hidden)return;
    drawer.hidden=true;
    history.setAttribute('aria-expanded','false');
   };
   document.addEventListener('pointerdown',event=>{
    if(!drawer.hidden&&!drawer.contains(event.target)&&!history.contains(event.target))hide();
   },{capture:true});
   document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!drawer.hidden){
     event.preventDefault();
     event.stopImmediatePropagation();
     hide();
     history.focus({preventScroll:true});
    }
   },{capture:true});
  }
  document.body.classList.add('np-u-w55-context-actions');
  return true;
 };
 let attempts=0;
 const gate=()=>{
  if(mount())return;
  if(++attempts<300)requestAnimationFrame(gate);
 };
 gate();
})();
