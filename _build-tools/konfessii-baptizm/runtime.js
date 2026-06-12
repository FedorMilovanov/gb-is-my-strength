'use strict';
const { D } = require('./build.js');

// Inline runtime JS as a string. Data is injected as JSON.
function buildScript(){
  const NODES = JSON.stringify(D.graphNodes);
  const LINKS = JSON.stringify(D.graphLinks);
  const ROUTES = JSON.stringify(D.routePresets);
  const QUIZ = JSON.stringify(D.quiz);

  return `
(function(){
"use strict";
var RM = matchMedia('(prefers-color-scheme: reduce)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ===== reveal on scroll ===== */
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12});
document.querySelectorAll('.reveal').forEach(function(el){io.observe(el);});

/* ===== progress + scroll-top ===== */
var prog=document.getElementById('progress'),stop=document.getElementById('stop');
function onScroll(){var h=document.documentElement;var sc=h.scrollTop;var max=h.scrollHeight-h.clientHeight;prog.style.width=(max>0?(sc/max*100):0)+'%';stop.classList.toggle('show',sc>600);}
addEventListener('scroll',onScroll,{passive:true});onScroll();
stop.addEventListener('click',function(){scrollTo({top:0,behavior:RM?'auto':'smooth'});});

/* ===== timeline filters + toggle ===== */
var tlf=document.getElementById('tlfilters');
if(tlf){tlf.addEventListener('click',function(e){var b=e.target.closest('.tlf');if(!b)return;tlf.querySelectorAll('.tlf').forEach(function(x){x.classList.remove('on');});b.classList.add('on');var cat=b.dataset.cat;document.querySelectorAll('#tl .tlitem').forEach(function(it){it.style.display=(cat==='all'||it.dataset.cat===cat)?'':'none';});});}
document.querySelectorAll('[data-toggle]').forEach(function(card){card.addEventListener('click',function(e){if(e.target.closest('a'))return;var det=card.querySelector('.tldet,.pdetail');if(det)det.classList.toggle('show');});});

/* ===== geo filters ===== */
var gf=document.getElementById('geofilters');
if(gf){gf.addEventListener('click',function(e){var b=e.target.closest('.tlf');if(!b)return;gf.querySelectorAll('.tlf').forEach(function(x){x.classList.remove('on');});b.classList.add('on');var k=b.dataset.gk;document.querySelectorAll('#geogrid [data-kind]').forEach(function(c){c.style.display=(k==='all'||c.dataset.kind===k)?'':'none';});});}

/* ===== glossary ===== */
(function(){
  var list=document.getElementById('glist'),search=document.getElementById('gsearch'),count=document.getElementById('gcount'),none=document.getElementById('gnone');
  if(!list)return;var total=list.querySelectorAll('.gitem').length;
  list.addEventListener('click',function(e){var btn=e.target.closest('button');if(!btn)return;var item=btn.parentElement;var open=item.classList.contains('open');
    list.querySelectorAll('.gitem.open').forEach(function(o){if(o!==item){o.classList.remove('open');o.querySelector('.gdef').style.maxHeight='0';o.querySelector('button').setAttribute('aria-expanded','false');}});
    item.classList.toggle('open',!open);var def=item.querySelector('.gdef');def.style.maxHeight=open?'0':def.scrollHeight+'px';btn.setAttribute('aria-expanded',String(!open));});
  search.addEventListener('input',function(){var q=search.value.trim().toLowerCase();var shown=0;
    list.querySelectorAll('.gitem').forEach(function(it){var m=!q||it.dataset.term.indexOf(q)>=0;it.style.display=m?'':'none';if(m)shown++;});
    count.textContent=shown+'/'+total;none.style.display=shown?'none':'block';if(!shown)none.textContent='По запросу «'+search.value+'» ничего не найдено.';});
})();

/* ===== quiz ===== */
(function(){
  var Q=${QUIZ};var box=document.getElementById('quizbox');if(!box)return;var i=0,score=0,answered=false;
  function render(){
    if(i>=Q.length){var pct=Math.round(score/Q.length*100);
      box.innerHTML='<div class="qresult"><div class="score">'+score+' / '+Q.length+'</div><p>Верных ответов: '+pct+'%</p><button type="button" class="btn btn-p" id="qrestart" style="margin:0 auto">Пройти заново</button></div>';
      document.getElementById('qrestart').addEventListener('click',function(){i=0;score=0;answered=false;render();});return;}
    var q=Q[i];answered=false;var letters=['А','Б','В','Г'];
    box.innerHTML='<div class="qprog"><span>Вопрос '+(i+1)+' из '+Q.length+'</span><span>Счёт: '+score+'</span></div>'+
      '<div class="qbar"><i style="width:'+(i/Q.length*100)+'%"></i></div>'+
      '<div class="qq">'+q.q+'</div>'+
      '<div class="qopts">'+q.options.map(function(o,idx){return '<button type="button" class="qopt" data-i="'+idx+'"><span class="ql">'+letters[idx]+'</span><span>'+o+'</span></button>';}).join('')+'</div>'+
      '<div class="qexpl" id="qexpl"></div>'+
      '<div class="qnav"><button type="button" class="btn btn-s" id="qnext" style="display:none">'+(i===Q.length-1?'Результат':'Дальше')+' →</button></div>';
    box.querySelectorAll('.qopt').forEach(function(btn){btn.addEventListener('click',function(){if(answered)return;answered=true;var sel=+btn.dataset.i;var correct=q.correct;
      box.querySelectorAll('.qopt').forEach(function(b){b.disabled=true;var bi=+b.dataset.i;if(bi===correct)b.classList.add('correct');else if(bi===sel)b.classList.add('wrong');});
      if(sel===correct)score++;var ex=document.getElementById('qexpl');ex.innerHTML=q.explanation+(q.source?'<div class="src">Источник: '+q.source+'</div>':'');ex.classList.add('show');
      document.getElementById('qnext').style.display='inline-flex';});});
    var nx=document.getElementById('qnext');nx.addEventListener('click',function(){i++;render();});
  }
  render();
})();

/* ===================== CONSTELLATION MAP v2 (premium) ===================== */
(function(){
  var NODES=${NODES};var LINKS=${LINKS};var ROUTES=${ROUTES};
  var GROUP_COLOR={root:'#f0d896',union:'#e8c879',merger:'#8b5cf6',split:'#ec4899',modern:'#06b6d4',leader:'#9aa2ae'};
  var canvas=document.getElementById('mapcanvas');if(!canvas)return;var ctx=canvas.getContext('2d');
  var byId={};NODES.forEach(function(n){byId[n.id]=n;});
  var edges=LINKS.map(function(l){return {a:byId[l.s],b:byId[l.t],label:l.label,desc:l.desc,id:l.id};}).filter(function(e){return e.a&&e.b;});
  var adj={};edges.forEach(function(e){(adj[e.a.id]=adj[e.a.id]||[]).push(e.b.id);(adj[e.b.id]=adj[e.b.id]||[]).push(e.a.id);});
  function degree(id){return (adj[id]||[]).length;}
  function hexRGB(c){c=c.replace('#','');return parseInt(c.substr(0,2),16)+','+parseInt(c.substr(2,2),16)+','+parseInt(c.substr(4,2),16);}

  /* deterministic seeded layout + force relax */
  function seeded(s){var x=Math.sin(s)*10000;return x-Math.floor(x);}
  var ringOrder=['root','union','merger','split','modern','leader'];
  NODES.forEach(function(n,i){
    var ring=ringOrder.indexOf(n.group);if(ring<0)ring=5;
    var r=n.group==='root'?0:(60+ring*46+seeded(i+1)*40);
    var ang=seeded(i*3.3+7)*Math.PI*2;
    n.x=Math.cos(ang)*r;n.y=Math.sin(ang)*r;n.vx=0;n.vy=0;
    n.ph=seeded(i*7.7+3)*Math.PI*2; /* breathing phase */
    n.ax=0;n.ay=0; /* drift anchor (set after relax) */
  });
  for(var iter=0;iter<340;iter++){
    for(var a=0;a<NODES.length;a++){for(var b=a+1;b<NODES.length;b++){var na=NODES[a],nb=NODES[b];var dx=nb.x-na.x,dy=nb.y-na.y;var d2=dx*dx+dy*dy||0.01;var d=Math.sqrt(d2);var rep=1500/d2;var ux=dx/d,uy=dy/d;na.vx-=ux*rep;na.vy-=uy*rep;nb.vx+=ux*rep;nb.vy+=uy*rep;}}
    edges.forEach(function(e){var dx=e.b.x-e.a.x,dy=e.b.y-e.a.y;var d=Math.sqrt(dx*dx+dy*dy)||0.01;var f=(d-98)*0.012;var ux=dx/d,uy=dy/d;e.a.vx+=ux*f;e.a.vy+=uy*f;e.b.vx-=ux*f;e.b.vy-=uy*f;});
    NODES.forEach(function(n){if(n.group==='root'){n.x*=0.6;n.y*=0.6;}n.vx-=n.x*0.0016;n.vy-=n.y*0.0016;n.x+=n.vx;n.y+=n.vy;n.vx*=0.82;n.vy*=0.82;});
  }
  NODES.forEach(function(n){n.ax=n.x;n.ay=n.y;}); /* freeze anchors */

  /* starfield (parallax) */
  var STARS=[];for(var s=0;s<70;s++){STARS.push({x:seeded(s*1.3+1)*2-1,y:seeded(s*2.1+5)*2-1,r:seeded(s*3.7)*1.3+0.3,tw:seeded(s*5.5)*Math.PI*2});}

  var view={x:0,y:0,scale:1},dpr=Math.min(devicePixelRatio||1,2);
  function resize(){var w=canvas.clientWidth,h=canvas.clientHeight;canvas.width=w*dpr;canvas.height=h*dpr;}
  function fit(){var minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9;NODES.forEach(function(n){minx=Math.min(minx,n.ax);miny=Math.min(miny,n.ay);maxx=Math.max(maxx,n.ax);maxy=Math.max(maxy,n.ay);});
    var w=canvas.clientWidth,h=canvas.clientHeight;var pad=78;var sx=(w-pad*2)/(maxx-minx||1),sy=(h-pad*2)/(maxy-miny||1);view.scale=Math.min(sx,sy,1.4);
    view.x=w/2-((minx+maxx)/2)*view.scale;view.y=h/2-((miny+maxy)/2)*view.scale;}

  var activeRoute='all',routeSet=null,hoverNode=null,pinNode=null,searchHi=null,introT=RM?1:0;
  var T0=performance.now(),clock=0;
  function toScreen(n){return {x:n.x*view.scale+view.x,y:n.y*view.scale+view.y};}
  function inRoute(id){return !routeSet||routeSet.has(id);}
  function focusNode(){return pinNode||hoverNode;}
  function edgeLit(e){var f=focusNode();return f&&(e.a.id===f.id||e.b.id===f.id);}

  /* ambient breathing/drift applied to render positions (anchors stay fixed) */
  function ambient(n){
    if(RM)return{x:n.ax,y:n.ay};
    var dr=2.4*Math.sin(clock*0.0006+n.ph);
    return {x:n.ax+Math.cos(n.ph+clock*0.00018)*dr, y:n.ay+Math.sin(n.ph*1.3+clock*0.00021)*dr};
  }

  function draw(){
    var w=canvas.clientWidth,h=canvas.clientHeight;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    /* starfield backdrop */
    if(!RM){for(var i=0;i<STARS.length;i++){var st=STARS[i];var sx=(st.x*0.5+0.5)*w+(view.x*0.02),sy=(st.y*0.5+0.5)*h+(view.y*0.02);var tw=0.25+0.55*(0.5+0.5*Math.sin(clock*0.001+st.tw));ctx.beginPath();ctx.arc(((sx%w)+w)%w,((sy%h)+h)%h,st.r,0,7);ctx.fillStyle='rgba(232,200,121,'+(tw*0.10*introT)+')';ctx.fill();}}

    /* edges */
    edges.forEach(function(e){
      var on=inRoute(e.a.id)&&inRoute(e.b.id);
      var lit=edgeLit(e);
      var aa=ambient(e.a),bb=ambient(e.b);
      var pa=toScreen(aa),pb=toScreen(bb);
      var mx=(pa.x+pb.x)/2,my=(pa.y+pb.y)/2;var nx=-(pb.y-pa.y),ny=(pb.x-pa.x);var ln=Math.sqrt(nx*nx+ny*ny)||1;var bow=18;mx+=nx/ln*bow;my+=ny/ln*bow;
      var ca=GROUP_COLOR[e.a.group]||'#9aa2ae',cb=GROUP_COLOR[e.b.group]||'#9aa2ae';
      ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.quadraticCurveTo(mx,my,pb.x,pb.y);
      ctx.lineWidth=lit?2.2:(on?1.1:0.8);
      if(lit){var g=ctx.createLinearGradient(pa.x,pa.y,pb.x,pb.y);g.addColorStop(0,'rgba('+hexRGB(ca)+',0.95)');g.addColorStop(1,'rgba('+hexRGB(cb)+',0.95)');ctx.strokeStyle=g;ctx.shadowColor='rgba(240,216,150,.55)';ctx.shadowBlur=10;}
      else ctx.strokeStyle=on?'rgba(232,200,121,'+(.16*introT)+')':'rgba(120,120,140,'+(.045*introT)+')';
      ctx.stroke();ctx.shadowBlur=0;
      /* flowing particle on lit edges */
      if(lit&&!RM){var prog=(clock*0.0004)%1;var t=prog,it=1-t;var px=it*it*pa.x+2*it*t*mx+t*t*pb.x,py=it*it*pa.y+2*it*t*my+t*t*pb.y;ctx.beginPath();ctx.arc(px,py,2.6,0,7);ctx.fillStyle='rgba(246,234,200,.95)';ctx.shadowColor='rgba(246,234,200,.8)';ctx.shadowBlur=8;ctx.fill();ctx.shadowBlur=0;
        /* edge label */
        if(view.scale>0.45&&e.label){ctx.font='600 10px "Segoe UI",system-ui,sans-serif';ctx.textAlign='center';var lbl=e.label+(e.desc?' · '+e.desc:'');var tw=ctx.measureText(lbl).width;ctx.fillStyle='rgba(10,11,18,.82)';ctx.fillRect(mx-tw/2-5,my-8,tw+10,16);ctx.fillStyle='rgba(240,228,196,.92)';ctx.fillText(lbl,mx,my+4);}
      }
    });

    /* nodes */
    NODES.forEach(function(n,idx){
      var aa=ambient(n);var p=toScreen(aa);var col=GROUP_COLOR[n.group]||'#9aa2ae';var on=inRoute(n.id);
      var pop=RM?1:Math.max(0,Math.min(1,(introT*NODES.length-idx)/3));if(pop<=0)return;
      var breathe=RM?1:(1+0.06*Math.sin(clock*0.0016+n.ph));
      var base=(n.size||7)*0.92*view.scale*(0.4+0.6*pop)*breathe;if(base<2)base=2;
      var dim=!on?0.16:1;
      var isHi=(searchHi===n.id)||(pinNode&&pinNode.id===n.id)||(hoverNode&&hoverNode.id===n.id);
      var pulse=isHi&&!RM?(1+0.22*Math.sin(clock*0.006)):1;
      var r=base*pulse;
      /* soft radial glow */
      var gr=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*(isHi?3.2:2.2));
      gr.addColorStop(0,'rgba('+hexRGB(col)+','+(0.30*dim*pop)+')');gr.addColorStop(1,'rgba('+hexRGB(col)+',0)');
      ctx.beginPath();ctx.arc(p.x,p.y,r*(isHi?3.2:2.2),0,7);ctx.fillStyle=gr;ctx.fill();
      /* pulse ring on highlight */
      if(isHi&&!RM){var pr=(clock*0.06)%1;ctx.beginPath();ctx.arc(p.x,p.y,r+pr*22,0,7);ctx.strokeStyle='rgba('+hexRGB(col)+','+((1-pr)*0.5)+')';ctx.lineWidth=1.4;ctx.stroke();}
      /* body */
      ctx.beginPath();ctx.arc(p.x,p.y,r,0,7);ctx.fillStyle='rgba(12,13,21,'+(0.94*pop)+')';ctx.fill();
      ctx.lineWidth=isHi?2.6:1.6;ctx.strokeStyle='rgba('+hexRGB(col)+','+(dim*pop)+')';
      if(isHi){ctx.shadowColor=col;ctx.shadowBlur=16;}ctx.stroke();ctx.shadowBlur=0;
      /* inner dot for root/merger emphasis */
      if(n.group==='root'){ctx.beginPath();ctx.arc(p.x,p.y,r*0.4,0,7);ctx.fillStyle='rgba('+hexRGB(col)+','+(0.85*pop)+')';ctx.fill();}
      /* label */
      if(view.scale>0.5&&on&&pop>0.5){ctx.font=(isHi?'700 ':'600 ')+Math.max(9,10.5*Math.min(view.scale,1.3))+'px "Segoe UI",system-ui,sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='rgba(8,8,14,.7)';ctx.strokeText(n.label,p.x,p.y+r+13);ctx.fillStyle='rgba(241,237,231,'+(0.86*dim)+')';ctx.fillText(n.label,p.x,p.y+r+13);}
    });
  }

  /* RAF loop — ambient life runs continuously (gentle); pauses when canvas off-screen or tab hidden */
  var rafId=null;
  function onScreen(){var r=canvas.getBoundingClientRect();return r.bottom>0 && r.top<(innerHeight||document.documentElement.clientHeight);}
  function needsAnimation(){return !RM && !document.hidden && onScreen();}
  function loop(now){clock=now-T0;if(introT<1)introT=Math.min(1,(now-introStart)/1100);draw();
    if(needsAnimation()){rafId=requestAnimationFrame(loop);} else {rafId=null;}}
  function kick(){if(rafId==null && needsAnimation()){rafId=requestAnimationFrame(loop);}}
  var introStart=0,flying=false;
  function animateIntro(){if(RM){introT=1;draw();return;}introStart=performance.now();introT=0;rafId=requestAnimationFrame(loop);}
  /* resume RAF on tab focus + on scroll into view */
  document.addEventListener('visibilitychange',function(){if(!document.hidden)kick();});
  addEventListener('scroll',function(){kick();},{passive:true});

  /* picking */
  function pick(mx,my){var best=null,bd=24;NODES.forEach(function(n){if(!inRoute(n.id))return;var aa=ambient(n);var p=toScreen(aa);var r=(n.size||7)*0.92*view.scale;var d=Math.hypot(mx-p.x,my-p.y);if(d<Math.max(r+10,bd)&&d<bd){bd=d;best=n;}});return best;}

  /* card */
  var card=document.getElementById('mapcard');
  function showCard(n){
    var col=GROUP_COLOR[n.group]||'#9aa2ae';var deg=degree(n.id);
    var kind=n.group==='leader'?'Деятель':(n.group==='root'?'Корень':(n.group==='merger'?'Объединение':(n.group==='split'?'Раскол':(n.group==='modern'?'Современность':'Союз / исток'))));
    var rels=(adj[n.id]||[]).slice(0,6).map(function(id){return (byId[id]&&byId[id].label)||id;});
    card.innerHTML='<div class="mk" style="color:'+col+'">'+kind+'</div><h4>'+n.label+'</h4><div class="my">'+(n.year||'')+'</div>'+(n.desc?'<p>'+n.desc+'</p>':'')+'<div class="mlinks">'+deg+' связ.: '+rels.join(', ')+'</div>';
    var aa=ambient(n);var p=toScreen(aa);var w=canvas.clientWidth;var cardW=252;var left=p.x+18;if(left+cardW>w-8)left=p.x-cardW-18;if(left<8)left=8;var top=p.y-20;if(top<8)top=8;if(top+170>canvas.clientHeight)top=canvas.clientHeight-180;
    card.style.left=left+'px';card.style.top=top+'px';card.classList.add('show');
  }
  function hideCard(){card.classList.remove('show');}

  /* events */
  var dragging=false,moved=false,lx=0,ly=0;
  canvas.addEventListener('pointerdown',function(e){dragging=true;moved=false;lx=e.clientX;ly=e.clientY;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',function(e){var rect=canvas.getBoundingClientRect();var mx=e.clientX-rect.left,my=e.clientY-rect.top;
    if(dragging){var dx=e.clientX-lx,dy=e.clientY-ly;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;view.x+=dx;view.y+=dy;lx=e.clientX;ly=e.clientY;kick();if(rafId==null)draw();return;}
    var n=pick(mx,my);if(n!==hoverNode){hoverNode=n;canvas.style.cursor=n?'pointer':'grab';if(!pinNode){if(n)showCard(n);else hideCard();}kick();if(rafId==null)draw();}});
  canvas.addEventListener('pointerup',function(e){var rect=canvas.getBoundingClientRect();var mx=e.clientX-rect.left,my=e.clientY-rect.top;dragging=false;
    if(!moved){var n=pick(mx,my);if(n){pinNode=(pinNode&&pinNode.id===n.id)?null:n;if(pinNode){showCard(pinNode);}else{hideCard();}}else{pinNode=null;hideCard();}kick();if(rafId==null)draw();}});
  canvas.addEventListener('pointerleave',function(){if(!pinNode){hoverNode=null;hideCard();if(rafId==null)draw();}});
  canvas.addEventListener('wheel',function(e){e.preventDefault();var rect=canvas.getBoundingClientRect();var mx=e.clientX-rect.left,my=e.clientY-rect.top;var f=e.deltaY<0?1.12:0.89;var ns=Math.max(0.35,Math.min(3.2,view.scale*f));var k=ns/view.scale;view.x=mx-(mx-view.x)*k;view.y=my-(my-view.y)*k;view.scale=ns;if(rafId==null)draw();},{passive:false});
  document.getElementById('mapzin').addEventListener('click',function(){zoomBtn(1.2);});
  document.getElementById('mapzout').addEventListener('click',function(){zoomBtn(0.83);});
  document.getElementById('mapfit').addEventListener('click',function(){fit();if(rafId==null)draw();});
  function zoomBtn(f){var w=canvas.clientWidth/2,h=canvas.clientHeight/2;var ns=Math.max(0.35,Math.min(3.2,view.scale*f));var k=ns/view.scale;view.x=w-(w-view.x)*k;view.y=h-(h-view.y)*k;view.scale=ns;if(rafId==null)draw();}

  /* routes */
  document.querySelector('.routebar').addEventListener('click',function(e){var b=e.target.closest('.routebtn');if(!b)return;
    document.querySelectorAll('.routebtn').forEach(function(x){x.classList.remove('on');x.setAttribute('aria-pressed','false');});b.classList.add('on');b.setAttribute('aria-pressed','true');
    activeRoute=b.dataset.route;var r=ROUTES.find(function(x){return x.id===activeRoute;});
    routeSet=(r&&r.nodes)?new Set(r.nodes):null;pinNode=null;hideCard();
    var hint=document.getElementById('maphint');hint.textContent=(r&&r.summary)?r.summary:'Перетаскивайте для перемещения · колесо для масштаба · клик по узлу — закрепить карточку';
    if(r&&r.focus){var fn=byId[r.focus];if(fn)flyTo(fn);else if(rafId==null)draw();}else{if(rafId==null)draw();}});

  function flyTo(n){var w=canvas.clientWidth,h=canvas.clientHeight;var ts=Math.max(view.scale,1.15);var tx=w/2-n.ax*ts,ty=h/2-n.ay*ts;searchHi=n.id;
    if(RM){view.x=tx;view.y=ty;view.scale=ts;draw();return;}
    var sx=view.x,sy=view.y,ss=view.scale,t0=performance.now();flying=true;kick();
    function step(now){var t=Math.min(1,(now-t0)/640);var e=1-Math.pow(1-t,3);view.x=sx+(tx-sx)*e;view.y=sy+(ty-sy)*e;view.scale=ss+(ts-ss)*e;if(t<1){requestAnimationFrame(step);}else{flying=false;}}
    requestAnimationFrame(step);}

  /* search */
  var si=document.getElementById('mapsearch'),sr=document.getElementById('mapresults');var kbd=-1,cur=[];
  function runSearch(){var q=si.value.trim().toLowerCase();if(!q){sr.classList.remove('show');sr.innerHTML='';return;}
    cur=NODES.filter(function(n){return n.label.toLowerCase().indexOf(q)>=0||(n.desc&&n.desc.toLowerCase().indexOf(q)>=0);}).slice(0,7);kbd=-1;
    if(!cur.length){sr.innerHTML='<div class="mres"><span style="color:var(--muted);font-size:12.5px">Ничего не найдено</span></div>';sr.classList.add('show');return;}
    sr.innerHTML=cur.map(function(n){var col=GROUP_COLOR[n.group]||'#9aa2ae';return '<div class="mres" data-id="'+n.id+'"><span class="mc" style="background:'+col+'"></span><div><b>'+n.label+'</b><span>'+(n.year||'')+'</span></div></div>';}).join('');sr.classList.add('show');}
  si.addEventListener('input',runSearch);
  si.addEventListener('keydown',function(e){if(!cur.length)return;if(e.key==='ArrowDown'){e.preventDefault();kbd=Math.min(cur.length-1,kbd+1);}else if(e.key==='ArrowUp'){e.preventDefault();kbd=Math.max(0,kbd-1);}else if(e.key==='Enter'){e.preventDefault();if(kbd>=0)select(cur[kbd]);else if(cur[0])select(cur[0]);return;}else if(e.key==='Escape'){sr.classList.remove('show');si.blur();return;}
    sr.querySelectorAll('.mres').forEach(function(el,i){el.classList.toggle('kbd',i===kbd);});});
  sr.addEventListener('click',function(e){var el=e.target.closest('.mres[data-id]');if(!el)return;select(byId[el.dataset.id]);});
  function select(n){if(!n)return;si.value=n.label;sr.classList.remove('show');if(routeSet&&!routeSet.has(n.id)){routeSet=null;activeRoute='all';document.querySelectorAll('.routebtn').forEach(function(x){var on=x.dataset.route==='all';x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on));});}flyTo(n);pinNode=n;showCard(n);kick();}
  document.addEventListener('click',function(e){if(!e.target.closest('.mapsearchwrap'))sr.classList.remove('show');});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){pinNode=null;searchHi=null;hideCard();if(rafId==null)draw();}});

  /* init on first viewport entry; RAF self-pauses via onScreen() when scrolled away (perf) */
  function init(){resize();fit();animateIntro();}
  var started=false;
  var mio=new IntersectionObserver(function(es){es.forEach(function(en){
    if(en.isIntersecting){if(!started){started=true;init();}else{kick();}}
  });},{threshold:0.01});
  mio.observe(canvas);
  addEventListener('resize',function(){resize();fit();if(rafId==null)draw();});
  setTimeout(function(){if(!started){var r=canvas.getBoundingClientRect();if(r.top<innerHeight&&r.bottom>0){started=true;init();}}},400);
})();
})();
`;
}
module.exports = { buildScript };
