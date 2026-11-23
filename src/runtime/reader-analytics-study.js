/* W121 — one quiz session for inline article and existing Analytics surfaces. */
import { normalizeQuizExplanation, renderQuizRich, selectQuizResult } from './article-quiz.js';

export function initReaderAnalyticsStudy() {
  function boot() {
    const root=document.getElementById('gbAnalyticsStudy');
    if(!root||root.dataset.gbStudyReady==='1')return;
    root.dataset.gbStudyReady='1';
    let data={series:[],outlines:[]};
    try{data=JSON.parse(root.getAttribute('data-study')||'{}')}catch(_){}
    const series=Array.isArray(data.series)?data.series.filter(q=>q&&Array.isArray(q.answers)&&q.answers.length>=2&&Number.isInteger(q.correctIndex)&&q.correctIndex>=0&&q.correctIndex<q.answers.length):[];
    const editorConfig=window.SITE_CONFIG?.quiz||{};
    const editor=Array.isArray(editorConfig.questions)?editorConfig.questions.filter(q=>q&&Array.isArray(q.options)&&q.options.length>=2):[];
    const panel=document.getElementById('gbrMarginalia');
    const mobileContent=document.getElementById('gbrMarginaliaContent');
    const inline=document.getElementById('quizPlaceholder');
    const article=document.querySelector('article.article-body')||document.querySelector('main article');
    const screen=root.querySelector('#gbAnalyticsQuiz');
    const count=root.querySelector('#gbAnalyticsStudyCount');
    const modeButtons=[...root.querySelectorAll('[data-study-mode]')];
    if(!series.length&&!editor.length){root.remove();return;}
    root.hidden=false;
    const sessionKey='gb-reader-study-v1:'+location.pathname;
    const signature=JSON.stringify({article:editor.map(q=>q.question),series:series.map(q=>q.id)});
    let current={mode:editor.length?'article':'series',step:0,score:0,cycle:[],last:-1,confidence:null,
      answered:false,selected:-1,seen:0,calibrated:0,streak:0,best:0,practiceScore:0,finished:false};
    try{const saved=JSON.parse(sessionStorage.getItem(sessionKey)||'null');
      if(saved&&saved.version===1&&saved.signature===signature&&saved.state){
        current={...current,...saved.state};
      }
    }catch(_){}
    const save=()=>{try{sessionStorage.setItem(sessionKey,JSON.stringify({version:1,signature,state:current}))}catch(_){}};
    const el=(tag,className='',text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=String(text);return e;};
    const button=(text,handler,cls='')=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',handler);return b;};
    const shuffle=list=>{const arr=list.slice();for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;};
    const readyMode=mode=>mode==='article'?editor.length>0:series.length>0;
    const defaultMode=()=>editor.length?'article':'series';
    function choose(mode){if(!readyMode(mode))return;current={...current,mode,step:0,score:0,cycle:[],last:-1,confidence:null,answered:false,selected:-1,seen:0,calibrated:0,streak:0,best:0,practiceScore:0,finished:false};save();render();}
    function ensureCycle(){if(!Array.isArray(current.cycle)||current.cycle.length!==series.length){
      const cycle=shuffle(series.map((_,i)=>i));if(cycle.length>1&&cycle[0]===current.last)[cycle[0],cycle[1]]=[cycle[1],cycle[0]];
      current.cycle=cycle;current.step=0;current.answered=false;current.selected=-1;save();
    }}
    function setModes(){
      modeButtons.forEach(b=>{
        const kind=b.dataset.studyMode;
        b.hidden=!readyMode(kind)||(kind==='series'&&editor.length&&!current.finished&&current.mode!=='series');
        b.setAttribute('aria-pressed',String(kind===current.mode));
      });
      count.textContent=current.mode==='article'?' · '+editor.length+' вопроса по статье':' · '+series.length+' по серии';
    }
    function closeForSource(){
      root.open=false;
      const modal=document.getElementById('partTocOverlay');
      if(modal?.classList.contains('is-open'))modal.querySelector('.toc-sheet__handle')?.click();
    }
    function sourceLink(href,label){
      if(!href)return null;
      const link=el('a','', 'Перечитать раздел'+(label?' · '+label:''));
      link.href=href;
      // Cross-article evidence links must not throw W57 readers back to old desktop.
      try {
        const url=new URL(href,location.href);
        if(url.origin===location.origin&&url.pathname!==location.pathname &&
          new URLSearchParams(location.search).get('reader-pilot')==='1'){
          url.searchParams.set('reader-pilot','1');
          const paper=new URLSearchParams(location.search).get('paper');
          if(paper==='space'||paper==='book')url.searchParams.set('paper',paper);
          link.href=url.pathname+url.search+url.hash;
        }
      } catch(_){}
      link.addEventListener('keydown',event=>{
        if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){
          event.preventDefault();window.open(link.href,'_blank','noopener');
        }
      });
      link.addEventListener('click',event=>{
        if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
        let url;try{url=new URL(href,location.href)}catch(_){event.preventDefault();return;}
        if(url.origin===location.origin&&url.pathname===location.pathname){
          const target=url.hash&&document.getElementById(decodeURIComponent(url.hash.slice(1)));
          if(!target){event.preventDefault();return;}
          event.preventDefault();closeForSource();save();
          if(location.hash!==url.hash)history.pushState(null,'',url.hash);
          target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
          if(!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');
          target.focus({preventScroll:true});return;
        }
        save();closeForSource(); // Browser owns navigation and Back.
      });return link;
    }
    function feedbackBlock(correct,explanation,full,sourceHref,sourceLabel){
      const f=el('div','gb-study-feedback');
      f.append(el('strong','',correct?'Верно':'Неверно'));
      if(explanation){const p=el('p');renderQuizRich(p,explanation);f.append(p);}
      if(full){const p=el('p');renderQuizRich(p,full);f.append(p);}
      const link=sourceLink(sourceHref,sourceLabel);if(link)f.append(link);
      return f;
    }
    function editorFinished(){
      screen.replaceChildren();
      const selection=selectQuizResult(editorConfig,current.score,editor.length);
      screen.append(el('p','gb-study-score','Результат: '+current.score+' из '+editor.length));
      const title=el('h4');renderQuizRich(title,selection.title||'Результат');
      const desc=el('p');renderQuizRich(desc,selection.desc||'');screen.append(title,desc);
      screen.append(button('Пройти по статье ещё раз',()=>choose('article'),'gb-study-next'));
      if(series.length)screen.append(button('Проверить себя по всей серии · '+series.length+' вопросов',()=>choose('series'),'gb-study-next'));
    }
    function renderArticle(){
      if(current.step>=editor.length){current.finished=true;save();return editorFinished();}
      const item=editor[current.step],correct=Number(item.correct);
      screen.replaceChildren();
      screen.append(el('p','gb-study-status','Вопрос '+(current.step+1)+' из '+editor.length));
      const title=el('h4');renderQuizRich(title,item.question||'Вопрос');screen.append(title);
      const options=el('div','gb-study-options');
      item.options.forEach((answer,i)=>{
        const b=button('',()=>{
          if(current.answered)return;
          current.answered=true;current.selected=i;if(i===correct)current.score++;
          save();render();
          const next=screen.querySelector('.gb-study-next');next?.focus({preventScroll:true});
        });
        renderQuizRich(b,answer);
        if(current.answered){
          b.disabled=true;b.classList.toggle('is-correct',i===correct);
          b.classList.toggle('is-wrong',i===current.selected&&i!==correct);
        }
        options.append(b);
      });
      screen.append(options);
      if(current.answered){
        const x=normalizeQuizExplanation(item.explanation);
        screen.append(feedbackBlock(current.selected===correct,x.short,x.full,item.sourceRef?.href,item.sourceRef?.label));
        screen.append(button(current.step+1===editor.length?'Показать результат':'Следующий вопрос',()=>{
          current.step++;current.answered=false;current.selected=-1;
          if(current.step>=editor.length)current.finished=true;
          save();render();
        },'gb-study-next'));
      }
    }
    function renderSeries(){
      ensureCycle();
      if(current.step>=series.length){
        screen.replaceChildren(el('h4','','Тренировка по серии завершена'));
        screen.append(el('p','gb-study-score','Правильных ответов: '+(Number(current.practiceScore)||0)+' из '+series.length));
        screen.append(el('p','gb-study-status','Калибровка уверенности: '+(current.seen?Math.round(current.calibrated/current.seen*100):0)+' % · лучший ряд: '+current.best));
        screen.append(button('Повторить тренировку',()=>choose('series'),'gb-study-next'));
        return;
      }
      const idx=current.cycle[current.step],item=series[idx];
      screen.replaceChildren();screen.append(el('p','gb-study-status','Вопрос '+(current.step+1)+' из '+series.length+' · '+(item.category||'')));
      screen.append(el('h4','',item.question));
      const conf=el('div','gb-study-confidence');
      if(!current.answered){
        conf.append(el('strong','','Насколько вы уверены?'));
        const row=el('div');
        for(const [kind,label] of [['sure','Точно знаю'],['guess','Кажется'],['random','Наугад']]){
          const b=button(label,()=>{
            if(current.confidence)return;
            current.confidence=kind;save();renderSeries();
            screen.querySelector('.gb-study-options button')?.focus({preventScroll:true});
          });
          b.disabled=!!current.confidence;b.setAttribute('aria-pressed',String(current.confidence===kind));row.append(b);
        }
        conf.append(row);
      }
      const options=el('div','gb-study-options');
      // Persist the answer order while a question is in progress, including after Back.
      if(!Array.isArray(current.answerOrder)||current.answerFor!==idx||current.answerOrder.length!==item.answers.length){
        current.answerOrder=shuffle(item.answers.map((_,i)=>i));current.answerFor=idx;save();
      }
      current.answerOrder.forEach(i=>{
        const b=button(item.answers[i],()=>{
          if(!current.confidence||current.answered)return;
          current.answered=true;current.selected=i;current.seen++;
          const correct=i===item.correctIndex;
          if(correct){current.streak++;current.practiceScore=(Number(current.practiceScore)||0)+1;current.best=Math.max(current.best,current.streak);}else current.streak=0;
          if((current.confidence==='sure'&&correct)||(current.confidence!=='sure'&&!correct))current.calibrated++;
          save();renderSeries();
          screen.querySelector('.gb-study-next')?.focus({preventScroll:true});
        });
        b.disabled=!current.confidence||current.answered;
        if(current.answered){b.classList.toggle('is-correct',i===item.correctIndex);
          b.classList.toggle('is-wrong',i===current.selected&&i!==item.correctIndex);}
        options.append(b);
      });
      if(!current.answered)screen.append(conf,options);
      else{
        screen.append(options,feedbackBlock(current.selected===item.correctIndex,item.explanation,'',item.sourceHref,item.sourceLabel));
        screen.append(el('p','gb-study-status','Калибровка уверенности: '+Math.round(current.calibrated/current.seen*100)+' % · '+current.streak+' подряд'));
        screen.append(button('Следующий вопрос',()=>{
          current.last=idx;current.step++;current.answered=false;current.selected=-1;
          current.confidence=null;current.answerOrder=null;current.answerFor=null;
          save();render();
        },'gb-study-next'));
      }
    }
    function render(){setModes();if(current.mode==='article'&&editor.length)renderArticle();else renderSeries();}
    modeButtons.forEach(b=>b.addEventListener('click',()=>{const mode=b.dataset.studyMode;if(mode!==current.mode)choose(mode);}));
    render();
    const inlineLaunch=inline?button('Проверить себя · '+(editor.length?editor.length+' вопроса по статье':series.length+' вопросов по серии'),()=>{
      root.open=true;
      const visibleRoot=()=>root.getClientRects().length>0&&getComputedStyle(root).visibility!=='hidden';
      if(!visibleRoot())inline.append(root);
      root.querySelector('summary')?.focus({preventScroll:true});
      root.scrollIntoView({behavior:'auto',block:'nearest'});
    },'gb-study-inline-launch'):null;
    if(inlineLaunch){inlineLaunch.setAttribute('aria-controls','gbAnalyticsStudy');inlineLaunch.hidden=true;}
    function launchAtEnd(){
      if(!inline)return;
      if(!inline.contains(root))inline.replaceChildren(root);
      if(inlineLaunch&&!inline.contains(inlineLaunch))inline.append(inlineLaunch);
    }
    if(inline){launchAtEnd();}
    else if(article)article.append(root);
    else document.querySelector('main')?.append(root);
    function moveTo(host){
      if(!host||root.parentElement===host)return;
      const focusWasInside=root.contains(document.activeElement);
      host.append(root);if(focusWasInside)root.querySelector('summary')?.focus({preventScroll:true});
    }
    function researchVisible(){
      const desktop=matchMedia('(min-width:1121px)').matches;
      const research=document.getElementById('npUResearch');
      const w57=desktop&&document.body.classList.contains('np-w57-ready')&&research&&
        !document.body.classList.contains('np-u-hide-right')&&
        !document.getElementById('npUniversalDemo')?.classList.contains('np-u-hide-right')&&
        research.getBoundingClientRect().width>120;
      const native=matchMedia('(max-width:1120px)').matches&&panel&&!panel.hidden&&
        document.getElementById('partTocOverlay')?.classList.contains('is-open');
      return{w57,native,research};
    }
    function place(){
      const v=researchVisible();
      if(v.native){ // native Analytics rebuilds via replaceChildren; attach after render.
        if(mobileContent)moveTo(mobileContent);
      }else if(v.w57){const host=v.research.querySelector('.np-u-right-scroll');if(host)moveTo(host);}
      else if(inline)moveTo(inline);
      else if(article)moveTo(article);
      if(inlineLaunch)inlineLaunch.hidden=root.parentElement===inline;
    }
    // W121: targeted mutation observers, not a page-wide subtree observer
    // (the latter would force layout on every glossary/annotation mutation).
    let queued=false, w57Observed=null;
    function schedulePlace(){
      if(queued)return;queued=true;
      requestAnimationFrame(()=>{
        queued=false;
        const w57=document.getElementById('npUniversalDemo');
        if(w57&&w57!==w57Observed){
          w57Observed=w57;
          new MutationObserver(schedulePlace).observe(w57,{attributes:true,attributeFilter:['class']});
        }
        place();
      });
    }
    new MutationObserver(schedulePlace).observe(document.body,{
      attributes:true,attributeFilter:['class'],childList:true
    });
    const nativeOverlay=document.getElementById('partTocOverlay');
    if(nativeOverlay)new MutationObserver(schedulePlace).observe(nativeOverlay,{
      attributes:true,attributeFilter:['class','aria-hidden']
    });
    if(panel)new MutationObserver(schedulePlace).observe(panel,{attributes:true,attributeFilter:['hidden']});
    if(mobileContent)new MutationObserver(schedulePlace).observe(mobileContent,{childList:true});
    window.addEventListener('resize',schedulePlace,{passive:true});
    document.addEventListener('gb:analytics-study-place',schedulePlace);
    document.addEventListener('gb:analytics-study-open',()=>{schedulePlace();root.open=true;root.scrollIntoView({block:'nearest',behavior:'auto'});});
    schedulePlace();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
}