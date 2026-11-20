/* ARGON W57: personal in-article annotations inside the REAL Product Library.
   No article HTML rewriting, no second notes store, no public/user-data upload. */
(()=>{'use strict';
  const $=s=>document.querySelector(s);
  const qKey='gb-highlights-v1',nKey='gb-reader-notes-v1';
  const colors=['amber','sage','lime','rose','blue'];
  const kinds=['marker','underline','quote'];
  const hex={amber:'#eacb93',sage:'#c6d5ae',lime:'#d6ee50',rose:'#dab7ba',blue:'#bfd2da'};
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
  const blocks=(article)=>[...article.querySelectorAll('p,li,blockquote')]
    .filter(e=>!e.closest('.np-u-central-overview,.np-u-central-contents,.gill-card,figcaption,.np-u-series-disclosure')&&
      normalize(e.textContent).length>=6);
  function chooseBlock(node,article){
    const el=node?.nodeType===1?node:node?.parentElement;
    const parent=el?.closest('p,li,blockquote');
    return parent&&article.contains(parent)?parent:null;
  }
  function spanOffsets(block,range){
    const head=range.cloneRange();head.selectNodeContents(block);
    head.setEnd(range.startContainer,range.startOffset);
    const tail=range.cloneRange();tail.selectNodeContents(block);
    tail.setEnd(range.endContainer,range.endOffset);
    return[head.toString().length,tail.toString().length];
  }
  function makeRange(block,start,end){
    if(start<0||end<=start)return null;
    const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);
    const r=document.createRange();let n,at=0,started=false,ended=false;
    while((n=walker.nextNode())){
      let len=n.nodeValue.length;
      if(!started&&start<=at+len){r.setStart(n,Math.max(0,start-at));started=true}
      if(started&&end<=at+len){r.setEnd(n,Math.max(0,end-at));ended=true;break}
      at+=len;
    }
    return started&&ended?r:null;
  }
  function capture(article){
    const sel=window.getSelection?.();
    if(!sel||sel.isCollapsed||!sel.rangeCount)return null;
    const r=sel.getRangeAt(0).cloneRange();
    const block=chooseBlock(r.startContainer,article);
    if(!block||chooseBlock(r.endContainer,article)!==block)return null;
    // A hidden Product glossary/metadata paragraph cannot be selected by readers.
    // Do not persist a synthetic/off-screen source node that hydration may remove.
    const visual=r.getBoundingClientRect();
    if(visual.width<2||visual.height<2||
       visual.bottom<0||visual.top>innerHeight||
       !block.getClientRects().length||block.closest('[hidden],[inert],[aria-hidden="true"]'))
      return null;
    const text=r.toString();
    if(normalize(text).length<6||text.length>3000)return null;
    const list=blocks(article),index=list.indexOf(block);
    if(index<0)return null;
    const [start,end]=spanOffsets(block,r);
    const source=block.textContent||'';
    if(source.slice(start,end)!==text)return null;
    const prefix=source.slice(Math.max(0,start-64),start);
    const suffix=source.slice(end,end+64);
    const anchor={
      blockId:block.id||'',blockIndex:index,start,end,
      exact:text,prefix,suffix,
      blockHash:hash(normalize(source)),
      fingerprint:hash(pathname()+'|'+index+'|'+start+':'+end+'|'+text)
    };
    return{text,anchor,range:r,rect:r.getBoundingClientRect()};
  }
  function resolve(article,anchor){
    if(!anchor||!anchor.exact)return null;
    const list=blocks(article);
    const probe=(block)=>{
      if(!block)return null;
      const raw=block.textContent||'';
      if(raw.slice(anchor.start,anchor.end)===anchor.exact)
        return makeRange(block,anchor.start,anchor.end);
      return null;
    };
    const preferred=anchor.blockId?article.querySelector('#'+CSS.escape(anchor.blockId)):list[anchor.blockIndex];
    const original=probe(preferred);
    if(original)return original;
    // Conservative re-anchoring: exact string and nearby context must identify
    // one position in one block, never silently attach a theological quote elsewhere.
    const candidates=[];
    for(const b of list){
      const raw=b.textContent||'';
      let at=0;
      while((at=raw.indexOf(anchor.exact,at))!==-1){
        const before=raw.slice(Math.max(0,at-64),at),after=raw.slice(at+anchor.exact.length,at+anchor.exact.length+64);
        const beforeScore=anchor.prefix?before.endsWith(anchor.prefix.slice(-Math.min(24,anchor.prefix.length))):true;
        const afterScore=anchor.suffix?after.startsWith(anchor.suffix.slice(0,Math.min(24,anchor.suffix.length))):true;
        if(beforeScore&&afterScore)candidates.push(makeRange(b,at,at+anchor.exact.length));
        at+=Math.max(1,anchor.exact.length);
      }
    }
    if(candidates.length===1)return candidates[0];
    if(candidates.length>1)return null;
    // A unique exact quote remains safe when editorial changes move the
    // paragraph but its immediate prefix/suffix change.
    const unique=[];
    for(const b of list){
      const raw=b.textContent||'';
      let at=0;
      while((at=raw.indexOf(anchor.exact,at))!==-1){
        unique.push(makeRange(b,at,at+anchor.exact.length));
        at+=Math.max(1,anchor.exact.length);
      }
    }
    return unique.length===1?unique[0]:null;
  }
  function start(){
    if(!document.body.classList.contains('np-w57-ready')||!window.GBHighlights)return false;
    if(window.__NP_W57_ANNOTATIONS__)return true;
    const article=$('main.np-u-reader-main article.article-body')||$('article.article-body');
    const rightScroll=$('#npUResearch .np-u-right-scroll');
    const reading=$('#npW57ReadingDetails');
    if(!article||!rightScroll||!reading)return false;
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
       '<button type="button" id="npW57SaveNote">Сохранить заметку</button></div>'+
       '<ol id="npW57NotesList" class="np-w57-annotation-list"></ol></div>';
    reading.after(section);
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
        if(item.annotation?.kind!=='marker')continue;
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
      b.setAttribute('aria-label',{'amber':'Янтарный','sage':'Оливковый','lime':'Яркий жёлто-зелёный','rose':'Пыльно-розовый','blue':'Голубой'}[color]);
      b.title=b.getAttribute('aria-label');b.setAttribute('aria-pressed',String(color===currentColor));
      b.textContent='✓';b.style.color=color===currentColor?'#3c2c26':'transparent';
      palette.append(b);
    }
    const entries=()=>read(qKey).filter(x=>x?.annotation?.version===1&&samePage(x));
    const all=()=>read(qKey);
    let rangeById=new Map(),pendingNoteId=null;
    function paint(){
      rangeById=new Map();
      const groups={};
      for(const kind of ['marker','underline'])for(const color of colors)groups[kind+'-'+color]=[];
      let missing=0;
      for(const item of entries()){
        const a=item.annotation,r=resolve(article,a.anchor);
        if(!r){missing++;continue}
        rangeById.set(item.id,r);
        if(groups[a.kind+'-'+a.color])groups[a.kind+'-'+a.color].push(r);
      }
      if(CSS?.highlights&&typeof Highlight!=='undefined'){
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
        const meta=document.createElement('div');meta.className='np-w57-annotation-meta';
        const state=document.createElement('span');
        state.textContent=(record.annotation.kind==='marker'?'Маркер':record.annotation.kind==='underline'?'Подчёркнуто':'Цитата')+
          ' · '+({'amber':'янтарь','sage':'оливка','lime':'лайм','rose':'розовый','blue':'голубой'}[record.annotation.color]||'янтарь');
        meta.append(state);
        for(const [action,label] of [['goto','К тексту'],['switch','Сменить тип'],['recolor','Цвет'],['edit','Заметка'],['delete','Удалить']]){
          const b=document.createElement('button');b.type='button';b.dataset.action=action;b.textContent=label;meta.append(b);
        }
        if(!rangeById.has(record.id)){
          const warn=document.createElement('span');warn.textContent='Фрагмент не найден';warn.title='Текст статьи изменился или фраза неоднозначна';meta.prepend(warn);
        }
        li.append(meta);list.append(li);
      }
      if(missing)say('Часть выделений не удалось уверенно привязать. Исходные записи сохранены.');
    }
    function save(selection,kind){
      if(!selection)return null;
      if(!kinds.includes(kind))return null;
      const store=window.GBHighlights;
      const old=all();
      if(old.length>=200){say('Достигнут лимит 200 цитат. Экспортируйте библиотеку перед удалением.');return null}
      const record={
        id:'quote-w57-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),
        text:selection.text,articleTitle:document.title.split(' | ')[0],
        url:location.origin+location.pathname+'#:~:text='+encodeURIComponent(normalize(selection.text).slice(0,150)),
        before:selection.anchor.prefix,after:selection.anchor.suffix,
        savedAt:Date.now(),
        annotation:{version:1,kind,color:currentColor,anchor:selection.anchor,noteId:null}
      };
      const next=store.addHighlight(old,record);
      if(next.length===old.length){say('Этот фрагмент уже сохранён.');return old.find(x=>x?.annotation?.anchor?.fingerprint===record.annotation.anchor.fingerprint)||null}
      if(!write(qKey,next)){say('Ошибка сохранения — библиотека не изменена.');return null}
      repaint();say('Сохранено в вашей библиотеке.');return record;
    }
    function updateRecord(id,updater){
      const old=all(),i=old.findIndex(x=>x.id===id&&x.annotation?.version===1);
      if(i<0)return null;
      const updated={...old[i],annotation:{...old[i].annotation}};
      updater(updated);
      const next=old.slice();next[i]=updated;
      if(!write(qKey,next)){say('Не удалось обновить помету.');return null}
      repaint();return updated;
    }
    function locate(id){
      const r=rangeById.get(id);
      if(!r)return say('Фрагмент не найден. Исходная цитата сохранена.');
      const el=r.startContainer.parentElement;
      el?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'center'});
      document.querySelector('#npW57NotesDetails')?.removeAttribute('open');
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
      if(!e.target?.closest?.('#npW57SelectionToolbar,#npW57NotesDetails,#npW57ReadingDetails'))selectionChanged();
    });
    document.addEventListener('touchend',e=>{
      if(!e.target?.closest?.('#npW57SelectionToolbar,#npW57NotesDetails,#npW57ReadingDetails'))setTimeout(selectionChanged,110);
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
        pendingNoteId=record.id;editor.hidden=false;section.open=true;
        $('#npW57NoteText').value='';
        setTimeout(()=>{rightScroll.scrollTo({top:0,behavior:'instant'});editor.scrollIntoView({block:'nearest'});noteText.focus({preventScroll:true})},20);
      }else if(record){
        section.open=true;
        rightScroll.scrollTop=0;
      }
      window.getSelection()?.removeAllRanges();
    });
    palette.addEventListener('click',e=>{
      const button=e.target.closest('[data-color]');if(!button)return;
      currentColor=button.dataset.color;
      for(const b of palette.querySelectorAll('button')){
        const chosen=b.dataset.color===currentColor;
        b.setAttribute('aria-pressed',String(chosen));b.style.color=chosen?'#3c2c26':'transparent';
      }
      say('Выбран цвет: '+button.getAttribute('aria-label')+'.');
    });
    list.addEventListener('click',e=>{
      const b=e.target.closest('[data-action]'),li=b?.closest('li[data-id]');if(!li)return;
      const id=li.dataset.id,action=b.dataset.action,record=entries().find(x=>x.id===id);
      if(!record)return;
      if(action==='goto'){locate(id);return}
      if(action==='switch'){
        updateRecord(id,x=>{x.annotation.kind=x.annotation.kind==='marker'?'underline':x.annotation.kind==='underline'?'marker':'marker'});
      }else if(action==='recolor'){
        updateRecord(id,x=>{x.annotation.color=colors[(colors.indexOf(x.annotation.color)+1)%colors.length]});
      }else if(action==='edit'){
        pendingNoteId=id;editor.hidden=false;section.open=true;noteText.value='';
        noteText.focus({preventScroll:true});
      }else if(action==='delete'){
        const old=all(),deleted=old.find(x=>x.id===id);
        if(write(qKey,old.filter(x=>x.id!==id))){
          lastUndo=deleted;repaint();say('Помета удалена. ');
          const undo=document.createElement('button');undo.type='button';undo.textContent='Отменить';
          undo.addEventListener('click',()=>{
            if(!lastUndo)return;
            const next=all();if(next.length>=200)return;
            next.unshift(lastUndo);lastUndo=null;
            if(write(qKey,next)){repaint();say('Помета восстановлена.')}
          },{once:true});status.append(undo);
        }
      }
    });
    section.querySelector('#npW57SaveNote').addEventListener('click',()=>{
      const value=noteText.value.trim(),id=pendingNoteId;
      if(!value||!id){say('Введите текст заметки.');return}
      const record=entries().find(x=>x.id===id);if(!record)return;
      const old=read(nKey);
      if(old.length>=500){say('Лимит 500 заметок: сначала экспортируйте библиотеку.');return}
      const newId='note-w57-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
      const note={id:newId,text:value,quoteText:record.text,
        articleTitle:record.articleTitle,url:record.url,savedAt:Date.now(),quoteId:id};
      if(!write(nKey,[note,...old])){say('Не удалось сохранить заметку.');return}
      updateRecord(id,x=>{x.annotation.noteId=newId});
      pendingNoteId=null;noteText.value='';editor.hidden=true;
      say('Заметка сохранена в Product Library.');
    });
    window.addEventListener('storage',e=>{if(e.key===qKey)repaint()});
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
