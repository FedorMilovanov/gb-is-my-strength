/* ARGON W57: personal in-article annotations inside the REAL Product Library.
   No article HTML rewriting, no second notes store, no public/user-data upload. */
(()=>{'use strict';
  const $=s=>document.querySelector(s);
  const qKey='gb-highlights-v1',nKey='gb-reader-notes-v1';
  const colors=['amber','sage','lime','rose','blue'];
  const kinds=['marker','underline','quote'];
  const hex={amber:'#eacb93',sage:'#c6d5ae',lime:'#d9dc8b',rose:'#dab7ba',blue:'#bfd2da'};
  const normalize=s=>String(s||'').replace(/\s+/g,' ').trim();
  const pathname=()=>location.pathname.replace(/\/+$/,'')||'/';
  const samePage=r=>{try{return new URL(r.url||'',location.origin).pathname.replace(/\/+$/,'')===pathname()}catch(_){return false}};
  const read=key=>{try{let x=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}};
  const write=(key,list)=>{
    try{
      const old=localStorage.getItem(key);
      localStorage.setItem(key,JSON.stringify(list));
      window.dispatchEvent(new StorageEvent('storage',{key,oldValue:old,
        newValue:JSON.stringify(list),storageArea:localStorage,url:location.href}));
      return true;
    }catch(e){console.error('W57_LIBRARY_STORE_FAILED',e);return false}
  };
  const hash=s=>{
    let h=2166136261;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
    return(h>>>0).toString(36);
  };
  // The canonical Product library now owns capture, projection and exact
  // anchors at both widths. Do not revive a second W57 resolver here.
  const {capture,resolve} = window.GBReaderAnchors || {};
  function start(){
    if(!document.body.classList.contains('np-w57-ready')||!window.GBHighlights)return false;
    if(window.__NP_W57_ANNOTATIONS__)return true;
    const article=window.GBReaderContract?.articleRoot?.(document);
    const rightScroll=$('#npUResearch .np-u-right-scroll');
    // Only the one selected source ARTICLE owns ranges; catalog MAINs do not.
    if(!article?.matches('article')||!article.closest('main.np-u-reader-main')||!rightScroll)
      return false;
    let currentColor='amber',lastSelection=null,lastUndo=null;
    const section=document.createElement('details');
    section.id='npW57NotesDetails';section.className='np-w57-accordion';
    section.innerHTML='<summary><span class="np-w57-summary-label">✎ Пометы <span class="np-w57-count" id="npW57NotesCount">0</span></span></summary>'+
      '<div class="np-w57-detail-body">'+
       '<p class="np-w57-tool-help">Выделите фразу в статье. Маркер, подчёркивание, цитата и заметка сохраняются в существующей библиотеке Product.</p>'+
       '<div class="np-w57-palette" role="group" aria-label="Цвет выделения" id="npW57Palette"></div>'+
       '<div id="npW57NotesStatus" role="status" aria-live="polite" class="np-w57-tool-help"></div>'+
       '<div id="npW57NoteEditor" class="np-w57-comment" hidden><label for="npW57NoteText">Заметка к выбранной цитате</label>'+
       '<textarea id="npW57NoteText" maxlength="12000" placeholder="Ваша мысль, вопрос или наблюдение"></textarea>'+
       '<div class="np-w57-note-actions"><button type="button" id="npW57SaveNote">Сохранить заметку</button>'+
       '<button type="button" id="npW57CancelNote">Отмена</button></div></div>'+
       '<ol id="npW57NotesList" class="np-w57-annotation-list"></ol></div>';
    rightScroll.insertBefore(section,rightScroll.firstElementChild);
    const palette=section.querySelector('#npW57Palette');
    const list=section.querySelector('#npW57NotesList');
    const count=section.querySelector('#npW57NotesCount');
    const status=section.querySelector('#npW57NotesStatus');
    const editor=section.querySelector('#npW57NoteEditor');
    const noteText=section.querySelector('#npW57NoteText');
    const toolbar=document.createElement('div');
    toolbar.id='npW57SelectionToolbar';toolbar.hidden=true;
    toolbar.setAttribute('role','toolbar');
    toolbar.setAttribute('aria-label','Действия с выделенным текстом');
    toolbar.innerHTML='<button type="button" data-w57-action="marker">Маркер</button>'+
      '<button type="button" data-w57-action="underline">Подчеркнуть</button>'+
      '<button type="button" data-w57-action="quote">Цитата</button>'+
      '<button type="button" data-w57-action="note">Заметка</button>';
    document.body.append(toolbar);
    const edgeLayer=document.createElement('div');
    edgeLayer.id='npW57EdgeLayer';edgeLayer.setAttribute('aria-hidden','true');
    document.body.append(edgeLayer);
    function paintFrayedEnds(saved){
      const fragment=document.createDocumentFragment();
      let caps=0;
      for(const item of saved){
        if(item.annotation?.kind!=='marker'||item.annotation?.version!==1)continue;
        const range=rangeById.get(item.id);
        if(!range)continue;
        const source=[...range.getClientRects()].filter(x=>x.width>2&&x.height>7).sort((a,b)=>a.top-b.top||a.left-b.left);
        const lines=[];
        for(const r of source){
          const line=lines.find(x=>Math.abs(x.top-r.top)<4);
          if(line){line.left=Math.min(line.left,r.left);line.right=Math.max(line.right,r.right);line.height=Math.max(line.height,r.height)}
          else lines.push({top:r.top,left:r.left,right:r.right,height:r.height});
        }
        for(const line of lines){
          if(caps>=1200)break;
          const h=Math.max(10,Math.min(19,line.height*.61));
          for(const side of ['start','end']){
            const cap=document.createElement('span');
            cap.className='np-w57-frayed-end np-w57-frayed-'+side;
            cap.style.setProperty('--np-w57-fray-color',hex[item.annotation.color]||hex.amber);
            cap.style.left=(window.scrollX+(side==='start'?line.left-4:line.right-3))+'px';
            cap.style.top=(window.scrollY+line.top+(line.height-h)*.5)+'px';
            cap.style.height=h+'px';
            fragment.append(cap);caps++;
          }
        }
        if(caps>=1200)break;
      }
      edgeLayer.replaceChildren(fragment);
    }
    let repaintFrame=0;
    function scheduleFrayed(){
      if(repaintFrame)return;
      repaintFrame=requestAnimationFrame(()=>{repaintFrame=0;paintFrayedEnds(entries())});
    }
    new ResizeObserver(scheduleFrayed).observe(article);
    new MutationObserver(scheduleFrayed).observe(document.body,{attributes:true,attributeFilter:['class']});
    window.GBReaderPreferences?.subscribe?.(scheduleFrayed);
    document.fonts?.ready?.then(scheduleFrayed).catch(()=>{});
    for(const color of colors){
      const b=document.createElement('button');b.type='button';
      b.dataset.color=color;b.style.setProperty('--swatch',hex[color]);
      b.setAttribute('aria-label',{'amber':'Янтарный','sage':'Оливковый','lime':'Мягкий лаймовый','rose':'Пыльно-розовый','blue':'Голубой'}[color]);
      b.title=b.getAttribute('aria-label');b.setAttribute('aria-pressed',String(color===currentColor));
      b.textContent='✓';b.style.color=color===currentColor?'#3c2c26':'transparent';
      palette.append(b);
    }
    const entries=()=>read(qKey).filter(x=>samePage(x) &&
      (x?.annotation?.version===1 || !!x.color)).map(x=>
      x?.annotation?.version===1 ? x : {...x,
        annotation:{version:0,kind:x.kind||'marker',color:x.color||'amber',noteId:null}});
    const all=()=>read(qKey);
    let rangeById=new Map(),pendingNoteId=null,pendingNoteSnapshot=null,pendingRecolorId=null;
    function paint(){
      rangeById=new Map();
      const groups={};
      for(const kind of ['marker','underline'])for(const color of colors)groups[kind+'-'+color]=[];
      let missing=0;
      for(const item of entries()){
        const a=item.annotation;
        const r=a.version===1 ? resolve(article,a.anchor)
          : window.GBHighlights.resolveRange(item,article);
        if(!r){missing++;continue}
        rangeById.set(item.id,r);
        // Native Product already paints legacy ranges; this renderer owns v1.
        if(a.version===1&&groups[a.kind+'-'+a.color])
          groups[a.kind+'-'+a.color].push(r);
      }
      if(typeof CSS!=='undefined'&&CSS.highlights&&typeof Highlight!=='undefined'){
        for(const [key,ranges] of Object.entries(groups)){
          const name='np-w57-'+key;
          if(ranges.length)CSS.highlights.set(name,new Highlight(...ranges));
          else CSS.highlights.delete(name);
        }
      }
      paintFrayedEnds(entries());
      return missing;
    }
    function say(text){status.textContent=text;status.hidden=!text}
    function repaint(){
      const saved=entries();
      count.textContent=String(saved.length);
      const missing=paint();list.replaceChildren();
      if(!saved.length){
        const msg=document.createElement('li');msg.className='np-w57-tool-help';
        msg.textContent='Выделений ещё нет. Выберите предложение в статье — появятся редакторские действия.';
        list.append(msg);return;
      }
      for(const record of saved.slice().sort((a,b)=>(b.savedAt||0)-(a.savedAt||0))){
        const li=document.createElement('li');li.dataset.id=record.id;
        const quote=document.createElement('span');quote.className='np-w57-annotation-quote';
        quote.textContent=record.text.slice(0,230)+(record.text.length>230?'…':'');
        li.append(quote);
        // Linked note uses Product's existing store; never make a second copy.
        const existingNote=linkedNote(record);
        if(existingNote?.text){
          const preview=document.createElement('div');preview.className='np-w57-note-preview';
          const name=document.createElement('span');name.className='np-w57-note-preview-label';
          name.textContent='Личная заметка';
          const content=document.createElement('p');content.className='np-w57-note-preview-text';
          content.textContent=existingNote.text;
          preview.append(name,content);li.append(preview);
        }
        const meta=document.createElement('div');meta.className='np-w57-annotation-meta';
        const state=document.createElement('span');
        state.textContent=(record.annotation.kind==='marker'?'Маркер':record.annotation.kind==='underline'?'Подчёркнуто':'Цитата')+
          ' · '+({'amber':'янтарь','sage':'оливка','lime':'лайм','rose':'розовый','blue':'голубой'}[record.annotation.color]||'янтарь');
        meta.append(state);
        for(const [action,label] of [['goto','К тексту'],['switch','Сменить тип'],['recolor','Цвет'],['edit','Заметка'],['delete','Удалить']]){
          const b=document.createElement('button');b.type='button';b.dataset.action=action;
          b.textContent=action==='edit'?(existingNote?'Изменить заметку':'Добавить заметку'):label;
          if(action==='recolor')b.title='Выбрать цвет этой пометы';
          meta.append(b);
        }
        if(!rangeById.has(record.id)){
          const warn=document.createElement('span');warn.textContent='Фрагмент не найден';warn.title='Текст статьи изменился или фраза неоднозначна';meta.prepend(warn);
        }
        li.append(meta);list.append(li);
      }
      if(missing)say('Часть выделений не удалось уверенно привязать. Исходные записи сохранены.');
    }
    function save(selection,kind){
      if(!selection||!kinds.includes(kind))return null;
      const store=window.GBHighlights,old=all();
      const record={
        id:'quote-w57-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),
        text:selection.text,articleTitle:document.title.split(' | ')[0],
        url:location.origin+location.pathname+'#:~:text='+encodeURIComponent(normalize(selection.text).slice(0,150)),
        before:selection.anchor.prefix,after:selection.anchor.suffix,savedAt:Date.now(),
        annotation:{version:1,kind,color:currentColor,anchor:selection.anchor,noteId:null}
      };
      const key=store.highlightKey(record);
      const previous=old.find(x=>store.highlightKey(x)===key);
      if(previous){say('Это место текста уже сохранено.');return previous}
      if(old.length>=200){say('Достигнут лимит 200 цитат. Экспортируйте библиотеку перед удалением.');return null}
      const next=store.addHighlight(old,record);
      // Comparing array lengths is wrong if native data included legacy
      // duplicates; inspect the inserted record ID instead.
      if(!next.some(x=>x.id===record.id)){
        say('Помету не удалось добавить: исходные записи оставлены без изменений.');
        return null;
      }
      if(!write(qKey,next)){say('Ошибка сохранения — библиотека не изменена.');return null}
      repaint();
      const canPaint=kind==='quote'||(typeof CSS!=='undefined'&&CSS.highlights&&typeof Highlight!=='undefined');
      say(canPaint?'Помета сохранена в библиотеке.':
        'Помета сохранена, но этот браузер не поддерживает цветное выделение в тексте.');
      return record;
    }
    function updateRecord(id,updater){
      const old=all(),i=old.findIndex(x=>x.id===id &&
        (x.annotation?.version===1 || !!x.color));
      if(i<0)return null;
      const positional=old[i].annotation?.version===1;
      const updated={...old[i],annotation:{...old[i].annotation,
        kind:old[i].annotation?.kind||old[i].kind||'marker',
        color:old[i].annotation?.color||old[i].color||'amber'}};
      updater(updated);
      if(positional){
        updated.color=updated.annotation.color;
        updated.kind=updated.annotation.kind;
      } else {
        updated.color=updated.annotation.color;
        updated.kind=updated.annotation.kind;
        delete updated.annotation; // legacy position is never invented
      }
      const next=old.slice();next[i]=updated;
      if(!write(qKey,next)){say('Не удалось обновить помету.');return null}
      repaint();return updated;
    }
    // The Product Library owns the same note list and the shared mutation lock.
    // W57 must refuse when that owner is not loaded; no independent fallback.
    const sameId=(a,b)=>a!=null&&b!=null&&String(a)===String(b);
    function resolveLinked(record,notes){
      const explicit=record.annotation?.noteId;
      const reverse=notes.filter(x=>x&&sameId(x.quoteId,record.id));
      if(explicit!=null){
        const matches=notes.filter(x=>x&&sameId(x.id,explicit));
        if(matches.length!==1)return{conflict:true,note:null};
        const note=matches[0];
        if((note.quoteId!=null&&!sameId(note.quoteId,record.id))||reverse.some(x=>x!==note))
          return{conflict:true,note:null};
        return{note};
      }
      if(reverse.length>1)return{conflict:true,note:null};
      const note=reverse[0]||null;
      if(note&&notes.filter(x=>x&&sameId(x.id,note.id)).length!==1)return{conflict:true,note:null};
      return{note};
    }
    function linkedNote(record){return resolveLinked(record,read(nKey)).note}
    function captureNoteSnapshot(record){
      const linked=linkedNote(record);
      return Object.freeze({
        quoteId:record.id,
        quoteState:JSON.stringify(record),
        noteId:linked?.id??null,
        noteState:linked?JSON.stringify(linked):null
      });
    }
    function openNoteEditor(record){
      pendingNoteId=record.id;
      pendingNoteSnapshot=captureNoteSnapshot(record);
      noteText.value=linkedNote(record)?.text||'';
      editor.hidden=false;section.open=true;
      window.__NP_UNIVERSAL_PREVIEW__?.openResearchForAnnotation?.();
      requestAnimationFrame(()=>noteText.focus({preventScroll:true}));
    }
    async function saveLinkedNote(record,value,openingSnapshot){
      const owner=window.GBHighlights;
      if(typeof owner?.mutateLibrary!=='function')
        return{ok:false,message:'Безопасное сохранение недоступно. Черновик остаётся в редакторе.'};
      const snapshot=openingSnapshot||captureNoteSnapshot(record);
      const result=await owner.mutateLibrary([qKey,nKey],stores=>{
        const quotes=stores[qKey],notes=stores[nKey];
        if(snapshot.noteId!=null&&!notes.some(x=>x&&sameId(x.id,snapshot.noteId)))
          return{reason:'deleted'};
        const matches=quotes.filter(x=>x&&sameId(x.id,snapshot.quoteId));
        if(matches.length!==1)return{reason:'conflict'};
        const raw=matches[0];
        const current=raw.annotation?.version===1?raw:{...raw,
          annotation:{version:0,kind:raw.kind||'marker',color:raw.color||'amber',noteId:null}};
        if(JSON.stringify(current)!==snapshot.quoteState)return{reason:'conflict'};
        const resolved=resolveLinked(current,notes),existing=resolved.note;
        if(resolved.conflict||((snapshot.noteId==null)!=(existing==null))||
          (existing&&(!sameId(snapshot.noteId,existing.id)||JSON.stringify(existing)!==snapshot.noteState)))
          return{reason:'conflict'};
        let note;
        if(existing)note={...existing,text:value};
        else{
          if(notes.length>=500)return{reason:'capacity'};
          const id='note-w57-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
          if(notes.some(x=>x&&sameId(x.id,id)))return{reason:'id-collision'};
          note={id,text:value,quoteText:raw.text,articleTitle:raw.articleTitle,
            url:raw.url,savedAt:Date.now(),quoteId:raw.id};
        }
        const changes={[nKey]:existing?notes.map(x=>x===existing?note:x):[note,...notes]};
        // Stage both arrays before writing; do not change a quote on refusal.
        // Legacy quotes without positional metadata keep their original shape.
        if(raw.annotation?.version===1&&raw.annotation.noteId!==note.id)
          changes[qKey]=quotes.map(x=>x===raw?{...raw,annotation:{...raw.annotation,noteId:note.id}}:x);
        return{changes,result:{updated:!!existing}};
      });
      if(!result.ok){
        const message=result.reason==='deleted'
          ?'Связанная заметка удалена в другой вкладке. Новая запись не создана; черновик остаётся в редакторе.'
          :result.reason==='conflict'
            ?'Заметка или её связь изменилась в другой вкладке. Ваш черновик остаётся в редакторе; скопируйте его или откройте заметку заново.'
            :result.reason==='capacity'
              ?'Лимит 500 заметок. Экспортируйте библиотеку перед добавлением.'
              :result.reason==='partial-write'
                ?'Ошибка сохранения и восстановления связи. Черновик остаётся в редакторе; экспортируйте библиотеку.'
                :'Ошибка сохранения. Черновик остаётся в редакторе.';
        return{ok:false,message};
      }
      return{ok:true,message:result.updated?'Заметка обновлена.':'Заметка сохранена в библиотеке.'};
    }
    function locate(id){
      const r=rangeById.get(id);
      if(!r)return say('Фрагмент не найден. Исходная цитата сохранена.');
      section.open=false;
      window.__NP_UNIVERSAL_PREVIEW__?.closeResearchForAnnotation?.();
      const el=r.startContainer.parentElement?.closest('p,li,blockquote')||r.startContainer.parentElement;
      el?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'center'});
      if(el){if(!el.hasAttribute('tabindex'))el.setAttribute('tabindex','-1');el.focus?.({preventScroll:true})}
      say('Переход к выделенному фрагменту.');
    }
    function showToolbar(data){
      if(!data){toolbar.hidden=true;return}
      lastSelection=data;toolbar.hidden=false;
      const r=data.rect;
      const w=toolbar.offsetWidth,h=toolbar.offsetHeight;
      const left=Math.max(9,Math.min(innerWidth-w-9,r.left+r.width/2-w/2));
      const top=r.top-h-12>=8?r.top-h-12:Math.min(innerHeight-h-9,r.bottom+9);
      toolbar.style.left=left+'px';toolbar.style.top=Math.max(8,top)+'px';
    }
    let selectFrame=0;
    function selectionChanged(){
      if(selectFrame)cancelAnimationFrame(selectFrame);
      selectFrame=requestAnimationFrame(()=>{
        selectFrame=0;
        if(!toolbar.hidden&&toolbar.matches(':hover'))return;
        showToolbar(capture(article));
      });
    }
    document.addEventListener('mouseup',e=>{
      if(!e.target?.closest?.('#npW57SelectionToolbar,#npW57NotesDetails,#npUFontPanel'))selectionChanged();
    });
    document.addEventListener('touchend',e=>{
      if(!e.target?.closest?.('#npW57SelectionToolbar,#npW57NotesDetails,#npUFontPanel'))setTimeout(selectionChanged,110);
    },{passive:true});
    // Keyboard text selection (Shift + arrows) has no mouseup event.
    // Let the selection settle before trying to show contextual actions.
    let selectionTimer=0;
    document.addEventListener('selectionchange',()=>{
      clearTimeout(selectionTimer);
      selectionTimer=setTimeout(()=>{
        if(toolbar.hidden)selectionChanged();
      },110);
    });
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!toolbar.hidden){toolbar.hidden=true;return}
      if((e.shiftKey&&e.key.startsWith('Arrow'))||e.key==='Shift'){
        clearTimeout(selectionTimer);
        selectionTimer=setTimeout(selectionChanged,120);
      }
    });
    document.addEventListener('pointerdown',e=>{
      if(!toolbar.hidden&&!toolbar.contains(e.target)&&!article.contains(e.target))toolbar.hidden=true;
    },true);
    document.addEventListener('scroll',()=>{if(!toolbar.hidden)toolbar.hidden=true},{passive:true});
    toolbar.addEventListener('click',e=>{
      const b=e.target.closest('[data-w57-action]');if(!b)return;
      const kind=b.dataset.w57Action;
      const s=lastSelection;
      toolbar.hidden=true;
      if(!s)return;
      const record=save(s,kind==='note'?'quote':kind);
      if(kind==='note'&&record){
        openNoteEditor(record);
        requestAnimationFrame(()=>editor.scrollIntoView({block:'nearest'}));
      }else if(record){
        section.open=true;
        window.__NP_UNIVERSAL_PREVIEW__?.openResearchForAnnotation?.();
        rightScroll.scrollTop=0;
      }
      window.getSelection()?.removeAllRanges();
    });
    palette.addEventListener('click',e=>{
      const button=e.target.closest('[data-color]');if(!button)return;
      const chosenColor=button.dataset.color,targetId=pendingRecolorId;
      if(targetId){
        const updated=updateRecord(targetId,x=>{x.annotation.color=chosenColor});
        if(!updated){say('Цвет не сохранён. Выберите цвет ещё раз или нажмите Escape.');return}
        pendingRecolorId=null;
        palette.setAttribute('aria-label','Цвет выделения');
      }
      currentColor=chosenColor;
      for(const b of palette.querySelectorAll('button')){
        const chosen=b.dataset.color===currentColor;
        b.setAttribute('aria-pressed',String(chosen));b.style.color=chosen?'#3c2c26':'transparent';
      }
      say((targetId?'Цвет сохранённой пометы изменён: ':'Выбран цвет: ')+button.getAttribute('aria-label')+'.');
    });
    palette.addEventListener('keydown',e=>{
      if(e.key!=='Escape'||!pendingRecolorId)return;
      e.preventDefault();e.stopPropagation();
      pendingRecolorId=null;
      palette.setAttribute('aria-label','Цвет выделения');
      say('Смена цвета отменена. Помета не изменена.');
    });
    list.addEventListener('click',e=>{
      const b=e.target.closest('[data-action]'),li=b?.closest('li[data-id]');if(!li)return;
      const id=li.dataset.id,action=b.dataset.action,record=entries().find(x=>x.id===id);
      if(!record)return;
      if(action==='goto'){locate(id);return}
      if(action==='switch'){
        updateRecord(id,x=>{x.annotation.kind=x.annotation.kind==='marker'?'underline':x.annotation.kind==='underline'?'marker':'marker'});
      }else if(action==='recolor'){
        pendingRecolorId=id;
        palette.setAttribute('aria-label','Выберите новый цвет сохранённой пометы');
        say('Выберите цвет этой пометы в палитре выше. Escape — отмена.');
        palette.querySelector('[data-color="'+record.annotation.color+'"]')?.focus({preventScroll:true});
        palette.scrollIntoView({block:'nearest'});
      }else if(action==='edit'){
        openNoteEditor(record);
      }else if(action==='delete'){
        const old=all(),deleted=old.find(x=>x.id===id);
        if(write(qKey,old.filter(x=>x.id!==id))){
          if(pendingNoteId===id){pendingNoteId=null;pendingNoteSnapshot=null;editor.hidden=true}
          if(pendingRecolorId===id){pendingRecolorId=null;palette.setAttribute('aria-label','Цвет выделения')}
          lastUndo=deleted;repaint();say('Помета удалена. Связанная заметка остаётся в библиотеке. ');
          const undo=document.createElement('button');undo.type='button';undo.textContent='Отменить';
          undo.setAttribute('aria-label','Восстановить удалённую помету');
          undo.addEventListener('click',()=>{
            if(!lastUndo||lastUndo.id!==deleted.id)return;
            const next=all();
            if(next.some(x=>x.id===deleted.id)){lastUndo=null;say('Помета уже восстановлена.');return}
            if(next.length>=200){say('Нет места для восстановления: сохраните экспорт библиотеки.');return}
            if(write(qKey,[deleted,...next])){
              lastUndo=null;repaint();say('Помета восстановлена.');
            }else{
          // Preserve the SAME undo button and handler after a failed write.
          // Replacing status.textContent here would erase the only retry.
          status.replaceChildren(document.createTextNode('Восстановление не удалось. Повторите попытку. '),undo);
        }
          });
          status.append(undo);
        }
      }
    });
    section.querySelector('#npW57CancelNote').addEventListener('click',()=>{
      pendingNoteId=null;pendingNoteSnapshot=null;noteText.value='';editor.hidden=true;
      say('Редактирование отменено; сохранённые заметки не изменены.');
    });
    section.querySelector('#npW57SaveNote').addEventListener('click',async()=>{
      const value=noteText.value.trim(),id=pendingNoteId;
      if(!value||!id){say('Введите текст заметки.');return}
      const record=entries().find(x=>x.id===id);
      if(!record){say('Исходное выделение не найдено. Текст остаётся в редакторе.');return}
      const result=await saveLinkedNote(record,value,pendingNoteSnapshot);
      if(!result.ok){say(result.message);return}
      pendingNoteId=null;pendingNoteSnapshot=null;noteText.value='';editor.hidden=true;
      // Same-tab localStorage writes never emit a storage event: update the card.
      repaint();
      say(result.message);
    });
    let libraryFrame=0;
    function onLibraryCommit(key){
      if(key!==qKey&&key!==nKey&&key!==null)return;
      if(!libraryFrame)libraryFrame=requestAnimationFrame(()=>{libraryFrame=0;repaint()});
    }
    window.addEventListener('storage',e=>onLibraryCommit(e.key));
    window.addEventListener('gb:library-committed',e=>onLibraryCommit(e.detail?.key));
    window.addEventListener('resize',()=>{if(!toolbar.hidden)toolbar.hidden=true},{passive:true});
    repaint();
    window.__NP_W57_ANNOTATIONS__={
      ready:true,version:1,refresh:repaint,
      count:()=>entries().length,
      orphanCount:()=>entries().filter(x=>!rangeById.has(x.id)).length
    };
    if(window.__NP_W57__)window.__NP_W57__.annotations=true;
    console.info('NP_W57_ANNOTATIONS_READY');
    return true;
  }
  let tries=0;
  function init(){if(start())return;if(++tries<300)requestAnimationFrame(init)}
  init();
})();
