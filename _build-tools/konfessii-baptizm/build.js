'use strict';
const fs = require('fs');
const path = require('path');
const D = require('./data.js');

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;');
// для атрибутов / inline-текста, без двойного экранирования &nbsp; и т.п.
const txt = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const OUT = path.join(__dirname, '..', '..', 'konfessii', 'russkij-baptizm', 'index.html');

// ───────────────────────────────────────────── HEAD + CSS
const HEAD = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com; img-src 'self' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com wss://mc.yandex.ru wss://*.yandex.ru wss://mc.yandex.com wss://*.yandex.com; frame-src 'self' https://mc.yandex.ru https://*.yandex.ru https://mc.yandex.com https://*.yandex.com; object-src 'none'; base-uri 'self';">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Карта Русского Баптизма — интерактивная история | Господь Бог — Сила Моя</title>
<meta name="description" content="Интерактивная «Карта Русского Баптизма»: три истока (Тифлис, Украина, Петербург), карта связей, хронология, гонения, ВСЕХБ и раскол, фигуры, глоссарий, викторина.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://gospod-bog.ru/konfessii/russkij-baptizm/">
<meta property="og:title" content="Карта Русского Баптизма — интерактивная история | Господь Бог — Сила Моя">
<meta property="og:type" content="website">
<meta property="og:url" content="https://gospod-bog.ru/konfessii/russkij-baptizm/">
  <meta property="og:locale" content="ru_RU">
<meta property="og:description" content="От истоков к современности: три истока, карта связей, хронология, съезды, гонения, ВСЕХБ и раскол, ключевые фигуры, глоссарий и викторина.">
<meta property="og:image" content="https://gospod-bog.ru/images/og-konfessii-russkij-baptizm-1200x630.webp">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/webp">
<meta property="og:image:alt" content="Тёмная карта-созвездие истории русского баптизма: золотые узлы и нити связей над тёмной старинной картой Российской империи, три ярких узла-истока — Тифлис, Петербург, Южная Украина — и тонкий золотой крест">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Карта Русского Баптизма — интерактивная история">
<meta name="twitter:description" content="Три истока, карта связей, хронология, гонения, ВСЕХБ и раскол, ключевые фигуры, глоссарий и викторина.">
<meta name="twitter:image" content="https://gospod-bog.ru/images/og-konfessii-russkij-baptizm-1200x630.webp">
<meta name="twitter:site" content="@FedorMilovanov">
<meta name="twitter:creator" content="@FedorMilovanov">
<meta name="theme-color" content="#08080e" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#08080e" media="(prefers-color-scheme: light)">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","@id":"https://gospod-bog.ru/#organization","name":"Господь Бог — Сила Моя","url":"https://gospod-bog.ru/","logo":{"@type":"ImageObject","url":"https://gospod-bog.ru/icons/icon-512.png","width":512,"height":512},"sameAs":["https://t.me/fedormilovanov","https://vk.com/curtmf"]},{"@type":"WebSite","@id":"https://gospod-bog.ru/#website","name":"Господь Бог — Сила Моя","url":"https://gospod-bog.ru/","inLanguage":"ru","publisher":{"@id":"https://gospod-bog.ru/#organization"}},{"@type":"WebPage","@id":"https://gospod-bog.ru/konfessii/russkij-baptizm/#webpage","url":"https://gospod-bog.ru/konfessii/russkij-baptizm/","name":"Карта Русского Баптизма — интерактивная история","description":"Интерактивная история русского евангельско-баптистского движения от истоков к современности.","inLanguage":"ru","isPartOf":{"@id":"https://gospod-bog.ru/#website"},"breadcrumb":{"@id":"https://gospod-bog.ru/konfessii/russkij-baptizm/#breadcrumb"}},{"@type":"BreadcrumbList","@id":"https://gospod-bog.ru/konfessii/russkij-baptizm/#breadcrumb","itemListElement":[{"@type":"ListItem","position":1,"name":"Главная","item":"https://gospod-bog.ru/"},{"@type":"ListItem","position":2,"name":"Конфессии и Деноминации","item":"https://gospod-bog.ru/konfessii/"},{"@type":"ListItem","position":3,"name":"Карта Русского Баптизма","item":"https://gospod-bog.ru/konfessii/russkij-baptizm/"}]}]}</script>
<script>(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();</script>
<style>
${CSS()}
</style>
  <link rel="alternate" type="application/rss+xml" title="Господь Бог — Сила Моя — RSS" href="https://gospod-bog.ru/feed.xml">
  <link rel="manifest" href="/manifest.json">
</head>`;

function CSS() {
  return `
:root{
  --gold:#e8c879;--gold-d:#c4a67e;--gold-l:#f0d896;--gold-soft:rgba(232,200,121,.55);--gold-dim:rgba(232,200,121,.20);
  --bg:#08080e;--bg2:#0d0d16;--panel:rgba(15,16,26,.78);--line:rgba(232,200,121,.16);--line2:rgba(255,255,255,.07);
  --txt:#f0ece6;--txt2:#cdc7be;--muted:#8a857f;--muted2:#6a655f;
  --serif:"Playfair Display",Georgia,"Times New Roman",serif;
  --sans:"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif;
  --mono:"SF Mono",ui-monospace,Menlo,Consolas,monospace;
  --maxw:1200px;
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
html,body{min-height:100%}
body{background:var(--bg);color:var(--txt);font-family:var(--sans);-webkit-font-smoothing:antialiased;overflow-x:hidden;line-height:1.55}
body::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;
  background:
   radial-gradient(ellipse 80% 50% at 50% -8%,rgba(196,166,126,.08),transparent 60%),
   radial-gradient(ellipse 60% 50% at 12% 18%,rgba(196,166,126,.05),transparent 55%),
   radial-gradient(ellipse 60% 50% at 88% 78%,rgba(138,80,130,.05),transparent 55%),
   radial-gradient(ellipse at center,transparent 50%,rgba(3,4,8,.6) 100%);}
.skip{position:absolute;left:-9999px;top:0;background:var(--gold);color:#1a1208;padding:10px 18px;border-radius:0 0 10px 0;z-index:999;font-weight:700}
.skip:focus{left:0}
a{color:inherit}
/* progress */
#progress{position:fixed;top:0;left:0;height:3px;width:0;z-index:90;background:linear-gradient(90deg,var(--gold-d),var(--gold-l));box-shadow:0 0 12px rgba(232,200,121,.5);transition:width .1s linear}
/* top bar */
.topbar{position:sticky;top:0;z-index:80;backdrop-filter:blur(14px);background:rgba(8,8,14,.72);border-bottom:1px solid var(--line2)}
.topbar .inner{width:min(var(--maxw),94vw);margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 0}
.back{color:var(--muted);text-decoration:none;font-size:13px;letter-spacing:.05em;display:flex;align-items:center;gap:7px;transition:color .2s;white-space:nowrap}
.back:hover{color:var(--gold)}
.back svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.crumb{font-size:10.5px;color:#5e5a54;letter-spacing:.14em;text-transform:uppercase;text-align:right}
.crumb a{color:#7a756e;text-decoration:none}.crumb a:hover{color:var(--gold)}
/* layout */
.wrap{position:relative;z-index:1}
section{position:relative}
.sec{width:min(var(--maxw),92vw);margin:0 auto;padding:78px 0}
.sec.narrow{max-width:860px}
.sec.mid{max-width:1020px}
.shead{text-align:center;margin-bottom:46px}
.badge{display:inline-flex;align-items:center;gap:7px;font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);border:1px solid var(--gold-dim);background:rgba(232,200,121,.05);padding:6px 14px;border-radius:999px;margin-bottom:18px}
.badge svg{width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.stitle{font-family:var(--serif);font-weight:700;font-size:clamp(26px,4vw,42px);letter-spacing:-.01em;color:#f6f0df;line-height:1.1}
.ssub{margin:16px auto 0;max-width:680px;color:var(--muted);font-size:15px;line-height:1.7}
.rule{width:84px;height:1px;margin:24px auto 0;background:linear-gradient(90deg,transparent,var(--gold),transparent)}
/* cards */
.card{border:1px solid var(--line2);border-radius:18px;background:linear-gradient(160deg,rgba(22,24,33,.62),rgba(11,13,20,.74));transition:border-color .3s,transform .3s,box-shadow .3s}
.card:hover{border-color:var(--gold-dim);box-shadow:0 14px 40px rgba(0,0,0,.4)}
.grid{display:grid;gap:20px}
.g2{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.g3{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
.kick{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold-soft);font-weight:700}
.mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
/* HERO */
#hero{min-height:100svh;display:flex;align-items:center;justify-content:center;text-align:center;overflow:hidden;padding:120px 5vw 70px;position:relative}
#hero .dots{position:absolute;inset:0;background-image:radial-gradient(circle at 1px 1px,rgba(255,255,255,.025) 1px,transparent 0);background-size:52px 52px;pointer-events:none}
.cross{width:64px;height:84px;margin:0 auto 34px;position:relative}
.cross .glow{position:absolute;inset:-24px;border-radius:50%;background:radial-gradient(circle,rgba(196,166,126,.14),transparent 68%);filter:blur(8px)}
.cross svg{position:relative;height:100%;width:100%;filter:drop-shadow(0 10px 28px rgba(0,0,0,.55))}
#hero .he{font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-soft);margin-bottom:26px}
#hero h1{font-family:var(--serif);font-weight:800;font-size:clamp(2.6rem,8vw,6rem);line-height:.97;letter-spacing:-.02em;color:var(--txt)}
#hero h1 .acc{color:var(--gold-l);display:block}
#hero .lead{margin-top:22px;font-size:clamp(15px,2.4vw,20px);font-weight:300;letter-spacing:.02em;color:var(--txt2)}
#hero .sub{margin:10px auto 0;max-width:540px;font-size:12.5px;line-height:1.7;color:var(--muted)}
.hstats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;max-width:560px;margin:42px auto 0}
.hstat{border:1px solid var(--gold-dim);background:rgba(255,255,255,.025);border-radius:14px;padding:16px 8px}
.hstat b{display:block;font-family:var(--serif);font-size:clamp(18px,4vw,30px);font-weight:700;color:var(--gold-l)}
.hstat span{display:block;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-top:5px}
.hbtns{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:42px}
.btn{display:inline-flex;align-items:center;gap:9px;border-radius:999px;font-weight:600;font-size:14px;padding:14px 28px;text-decoration:none;transition:transform .25s,box-shadow .25s,border-color .25s}
.btn-p{background:linear-gradient(135deg,var(--gold-d),var(--gold-l));color:#1a1208;box-shadow:0 8px 28px rgba(196,166,126,.28)}
.btn-p:hover{transform:translateY(-2px);box-shadow:0 12px 34px rgba(196,166,126,.4)}
.btn-s{border:1px solid var(--gold-dim);background:rgba(255,255,255,.04);color:var(--txt)}
.btn-s:hover{transform:translateY(-2px);border-color:var(--gold-soft)}
.btn svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.hhint{margin-top:34px;font-size:11px;letter-spacing:.1em;color:var(--muted2)}
/* sec nav (sticky chips) */
.secnav{position:sticky;top:49px;z-index:70;background:rgba(8,8,14,.82);backdrop-filter:blur(12px);border-bottom:1px solid var(--line2)}
.secnav .inner{width:min(var(--maxw),96vw);margin:0 auto;display:flex;gap:8px;overflow-x:auto;padding:11px 0;scrollbar-width:thin}
.secnav .inner::-webkit-scrollbar{height:5px}
.secnav .inner::-webkit-scrollbar-thumb{background:var(--gold-dim);border-radius:5px}
.secnav a{flex:0 0 auto;font-size:12px;color:var(--muted);text-decoration:none;padding:6px 13px;border-radius:999px;border:1px solid transparent;white-space:nowrap;transition:.2s}
.secnav a:hover{color:var(--gold);border-color:var(--gold-dim);background:rgba(232,200,121,.05)}
/* origins */
.origin{padding:26px}
.origin .oy{font-family:var(--serif);font-size:40px;font-weight:700;line-height:1}
.origin .om{font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin:6px 0 2px;font-weight:700}
.origin h3{font-family:var(--serif);font-size:23px;margin:10px 0 4px;color:#f4eedd}
.origin .ofig{font-size:13px;color:var(--gold-soft);margin-bottom:10px}
.origin p{font-size:13px;line-height:1.65;color:var(--txt2)}
.origin .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.chip{font-size:11px;padding:4px 10px;border-radius:999px;border:1px solid var(--line2);background:rgba(255,255,255,.03);color:var(--muted)}
.ofocus{margin-top:12px;font-size:11.5px;color:var(--gold-soft)}
/* MAP */
#mapwrap{position:relative;border:1px solid var(--line);border-radius:22px;overflow:hidden;background:radial-gradient(ellipse at 50% 30%,#0e0f1a,#070710);box-shadow:0 20px 60px rgba(0,0,0,.5);margin-top:18px}
#mapcanvas{display:block;width:100%;height:600px;cursor:grab;touch-action:none}
#mapcanvas:active{cursor:grabbing}
.maptop{position:absolute;top:0;left:0;right:0;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:14px;background:linear-gradient(180deg,rgba(7,7,16,.85),transparent);z-index:5}
.routebar{display:flex;gap:7px;flex-wrap:wrap}
.routebtn{font-size:11.5px;color:var(--muted);background:rgba(15,16,26,.7);border:1px solid var(--line2);padding:6px 12px;border-radius:999px;cursor:pointer;transition:.2s;display:flex;align-items:center;gap:6px}
.routebtn:hover{color:var(--txt);border-color:var(--gold-dim)}
.routebtn.on{color:#1a1208;background:var(--gold);border-color:var(--gold);font-weight:600}
.routebtn .dot{width:8px;height:8px;border-radius:50%}
.mapsearchwrap{margin-left:auto;position:relative}
.mapsearch{display:flex;align-items:center;gap:8px;background:rgba(15,16,26,.8);border:1px solid var(--line2);border-radius:999px;padding:7px 14px;min-width:200px}
.mapsearch:focus-within{border-color:var(--gold-soft)}
.mapsearch svg{width:15px;height:15px;stroke:var(--gold-soft);fill:none;stroke-width:2}
.mapsearch input{background:transparent;border:0;outline:0;color:var(--txt);font-size:13px;width:100%}
.mapsearch input::placeholder{color:var(--muted2)}
#mapresults{position:absolute;top:calc(100% + 6px);right:0;width:260px;background:rgba(13,14,22,.97);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:none;box-shadow:0 16px 40px rgba(0,0,0,.5);max-height:300px;overflow-y:auto}
#mapresults.show{display:block}
.mres{display:flex;align-items:center;gap:10px;padding:10px 13px;cursor:pointer;border-bottom:1px solid var(--line2);transition:background .15s}
.mres:last-child{border-bottom:0}
.mres:hover,.mres.kbd{background:rgba(232,200,121,.08)}
.mres .mc{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
.mres b{font-size:13px;font-weight:600}
.mres span{display:block;font-size:10.5px;color:var(--muted)}
.mapbtns{position:absolute;right:14px;bottom:14px;display:flex;flex-direction:column;gap:7px;z-index:5}
.mapbtns button{width:38px;height:38px;border-radius:11px;background:rgba(15,16,26,.85);border:1px solid var(--line2);color:var(--gold-soft);font-size:18px;cursor:pointer;display:grid;place-items:center;transition:.2s}
.mapbtns button:hover{border-color:var(--gold-dim);color:var(--gold)}
.maplegend{position:absolute;left:14px;bottom:14px;display:flex;flex-wrap:wrap;gap:6px;z-index:5;max-width:60%}
.lg{display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--muted);background:rgba(13,14,22,.7);border:1px solid var(--line2);padding:4px 9px;border-radius:999px}
.lg i{width:8px;height:8px;border-radius:50%}
.mapcard{position:absolute;z-index:6;width:248px;background:rgba(13,14,22,.97);border:1px solid var(--gold-dim);border-radius:16px;padding:16px;box-shadow:0 18px 46px rgba(0,0,0,.6);pointer-events:none;opacity:0;transform:translateY(6px);transition:opacity .18s,transform .18s}
.mapcard.show{opacity:1;transform:translateY(0);pointer-events:auto}
.mapcard .mk{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-soft)}
.mapcard h4{font-family:var(--serif);font-size:18px;margin:5px 0 3px;color:#f4eedd}
.mapcard .my{font-size:11px;color:var(--muted);font-family:var(--mono)}
.mapcard p{font-size:12px;line-height:1.55;color:var(--txt2);margin-top:9px}
.mapcard .mlinks{margin-top:9px;font-size:11px;color:var(--gold-soft)}
.maphint{text-align:center;font-size:12px;color:var(--muted);margin-top:14px}
.mapstats{text-align:center;font-size:11px;color:var(--muted2);margin-top:6px;letter-spacing:.04em}
/* timeline */
.tlfilters{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:30px}
.tlf{font-size:12px;padding:6px 13px;border-radius:999px;border:1px solid var(--line2);background:rgba(255,255,255,.03);color:var(--muted);cursor:pointer;transition:.2s;display:flex;align-items:center;gap:6px}
.tlf i{width:8px;height:8px;border-radius:50%}
.tlf.on{color:var(--txt);border-color:var(--gold-dim);background:rgba(232,200,121,.06)}
.tl{position:relative;padding-left:30px}
.tl::before{content:"";position:absolute;left:9px;top:6px;bottom:6px;width:2px;background:linear-gradient(to bottom,var(--gold-dim),var(--line2),transparent)}
.tlitem{position:relative;margin-bottom:14px}
.tlitem .node{position:absolute;left:-27px;top:8px;width:13px;height:13px;border-radius:50%;border:2px solid var(--bg);box-shadow:0 0 0 2px currentColor}
.tlcard{border:1px solid var(--line2);border-radius:14px;background:rgba(255,255,255,.022);padding:15px 18px;cursor:pointer;transition:.2s}
.tlcard:hover{border-color:var(--gold-dim);background:rgba(255,255,255,.04)}
.tlcard .tly{font-family:var(--mono);font-weight:700;font-size:13px}
.tlcard h3{font-size:15px;margin:3px 0 5px;color:#f4eedd}
.tlcard p{font-size:13px;color:var(--txt2);line-height:1.6}
.tldet{font-size:12.5px;color:var(--muted);line-height:1.65;margin-top:10px;padding-top:10px;border-top:1px solid var(--line2);display:none}
.tldet.show{display:block}
.tldet .src{display:block;margin-top:8px;font-size:11px;color:var(--gold-soft)}
/* congresses / generic record cards */
.rec{padding:20px}
.rec .ry{font-family:var(--mono);font-size:12px;color:var(--gold);font-weight:700}
.rec h3{font-family:var(--serif);font-size:19px;margin:5px 0 8px;color:#f4eedd}
.rec p{font-size:13px;line-height:1.6;color:var(--txt2)}
.rec ul{list-style:none;margin-top:12px;display:flex;flex-direction:column;gap:7px}
.rec ul li{font-size:12.5px;color:var(--muted);display:flex;gap:8px;line-height:1.5}
.rec ul li::before{content:"";margin-top:7px;width:5px;height:5px;border-radius:50%;background:var(--gold);flex:0 0 auto}
.src{font-size:11px;color:var(--gold-soft);margin-top:12px}
.place-tag{font-size:11px;color:var(--muted);display:inline-flex;align-items:center;gap:5px;margin-bottom:6px}
/* two paths */
.paths{display:grid;gap:26px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.pathhead{border-radius:18px;border:1px solid;padding:20px;margin-bottom:18px}
.pathhead h3{font-size:22px;font-weight:800}
.pathhead .pp{font-size:12px;font-weight:600;margin-top:3px}
.pathhead .pdesc{font-size:12.5px;line-height:1.6;color:var(--txt2);margin-top:10px}
.pathbadge{float:right;font-family:var(--mono);font-weight:800;font-size:13px;padding:5px 11px;border-radius:11px;border:1px solid}
.evlist{position:relative;padding-left:22px;display:flex;flex-direction:column;gap:8px}
.evlist::before{content:"";position:absolute;left:3px;top:4px;bottom:4px;width:1px}
.ev{position:relative;border:1px solid var(--line2);background:rgba(255,255,255,.022);border-radius:12px;padding:9px 13px}
.ev .en{position:absolute;left:-22px;top:14px;width:8px;height:8px;border-radius:50%}
.ev b{font-family:var(--mono);font-size:11px;margin-right:8px}
.ev span{font-size:12.5px;color:var(--txt2)}
/* persecution */
.pstats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px}
.pstat{border:1px solid rgba(239,68,68,.22);background:rgba(239,68,68,.05);border-radius:16px;padding:22px;text-align:center}
.pstat b{display:block;font-family:var(--serif);font-size:30px;color:#ff8b8b}
.pstat span{font-size:11px;letter-spacing:.06em;color:var(--muted);text-transform:uppercase;margin-top:6px;display:block}
/* organizations */
.org{padding:22px;border-top:3px solid}
.org .on{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap}
.org h3{font-family:var(--serif);font-size:22px;color:#f4eedd}
.org .oy{font-family:var(--mono);font-size:12px;color:var(--muted)}
.org .ofull{font-size:12.5px;color:var(--gold-soft);margin:4px 0 12px}
.org .meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.org .meta div{font-size:12px;color:var(--txt2)}
.org .meta b{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted2);margin-bottom:2px}
.org ul{list-style:none;display:flex;flex-direction:column;gap:6px;margin:6px 0 12px}
.org ul li{font-size:12px;color:var(--muted);display:flex;gap:8px;line-height:1.45}
.org ul li::before{content:"";margin-top:7px;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.6;flex:0 0 auto}
.org .leaders{display:flex;flex-wrap:wrap;gap:6px}
/* persons */
.pcard{padding:22px;cursor:pointer}
.pcard .ph{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.pcard h3{font-family:var(--serif);font-size:20px;color:#f4eedd}
.pcard .py{font-family:var(--mono);font-size:12px;color:var(--gold-soft)}
.pcard .prole{font-size:12.5px;color:var(--gold-soft);margin:6px 0 4px;font-weight:500}
.pcard .preg{font-size:11.5px;color:var(--muted)}
.pcard .pcontrib{font-size:12.5px;color:var(--txt2);line-height:1.6;margin-top:10px}
.pcard .pmore{font-size:11px;color:var(--gold);margin-top:12px;letter-spacing:.08em}
.pdetail{display:none;margin-top:14px;padding-top:14px;border-top:1px solid var(--line2)}
.pdetail.show{display:block}
.pdetail h4{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-soft);margin:12px 0 8px}
.pdetail ul{list-style:none;display:flex;flex-direction:column;gap:7px}
.pdetail ul li{font-size:12.5px;color:var(--txt2);line-height:1.55;display:flex;gap:8px}
.pdetail ul li::before{content:"";margin-top:7px;width:5px;height:5px;border-radius:50%;background:var(--gold);flex:0 0 auto}
.chrono{display:flex;flex-direction:column;gap:8px}
.chrow{display:flex;gap:12px}
.chrow .cy{flex:0 0 90px;font-family:var(--mono);font-size:11.5px;color:var(--gold-soft)}
.chrow .ct{font-size:12.5px;color:var(--txt2);line-height:1.5}
.pfate{font-size:12px;color:var(--muted);margin-top:12px;font-style:italic}
/* table */
.tablewrap{border-radius:18px;overflow:hidden;border:1px solid var(--line2)}
table.ptable{width:100%;border-collapse:collapse;font-size:13px}
table.ptable th,table.ptable td{padding:14px 18px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line2)}
table.ptable th{background:rgba(255,255,255,.03);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
table.ptable td{color:var(--txt2);line-height:1.55}
table.ptable .blue{color:#7fb4ff}table.ptable .red{color:#ff9b9b}
table.ptable tr:last-child td{border-bottom:0}
.cmpmobile{display:none;flex-direction:column;gap:14px}
/* glossary */
.gsearch{display:flex;align-items:center;gap:10px;max-width:440px;margin:0 auto 26px;border:1px solid var(--line2);background:rgba(255,255,255,.03);border-radius:999px;padding:10px 18px}
.gsearch:focus-within{border-color:var(--gold-soft)}
.gsearch svg{width:16px;height:16px;stroke:var(--gold-soft);fill:none;stroke-width:2}
.gsearch input{flex:1;background:transparent;border:0;outline:0;color:var(--txt);font-size:14px}
.gsearch input::placeholder{color:var(--muted2)}
.gsearch .ct{font-family:var(--mono);font-size:11px;color:var(--muted2)}
.gitem{border:1px solid var(--line2);border-radius:14px;background:rgba(255,255,255,.022);margin-bottom:8px;overflow:hidden;transition:.25s}
.gitem.open{border-color:var(--gold-dim);background:rgba(232,200,121,.05)}
.gitem button{width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px 18px;background:none;border:0;color:var(--txt);cursor:pointer;text-align:left;font-size:15px;font-weight:600}
.gitem .gi-ic{width:26px;height:26px;border-radius:50%;border:1px solid var(--line2);display:grid;place-items:center;flex:0 0 auto;transition:.25s}
.gitem.open .gi-ic{border-color:var(--gold-soft);background:rgba(232,200,121,.12);transform:rotate(180deg)}
.gitem .gi-ic svg{width:14px;height:14px;stroke:var(--gold-soft);fill:none;stroke-width:2}
.gdef{max-height:0;overflow:hidden;transition:max-height .3s ease}
.gdef p{padding:0 18px 16px;font-size:13.5px;line-height:1.7;color:var(--txt2)}
.gnone{text-align:center;color:var(--muted);font-size:13px}
/* quiz */
.quizbox{border:1px solid var(--line);border-radius:20px;background:linear-gradient(160deg,rgba(22,24,33,.6),rgba(11,13,20,.78));padding:30px;max-width:680px;margin:0 auto}
.qprog{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:10px}
.qbar{height:5px;border-radius:5px;background:rgba(255,255,255,.06);overflow:hidden;margin-bottom:24px}
.qbar i{display:block;height:100%;background:linear-gradient(90deg,var(--gold-d),var(--gold-l));transition:width .4s}
.qq{font-family:var(--serif);font-size:21px;line-height:1.35;color:#f4eedd;margin-bottom:22px}
.qopts{display:flex;flex-direction:column;gap:10px}
.qopt{text-align:left;border:1px solid var(--line2);background:rgba(255,255,255,.025);color:var(--txt);border-radius:13px;padding:14px 18px;cursor:pointer;font-size:14px;transition:.18s;display:flex;align-items:center;gap:12px}
.qopt:hover:not(:disabled){border-color:var(--gold-dim);background:rgba(232,200,121,.05)}
.qopt .ql{width:24px;height:24px;border-radius:7px;border:1px solid var(--line2);display:grid;place-items:center;font-size:12px;color:var(--muted);flex:0 0 auto}
.qopt.correct{border-color:#5dd39e;background:rgba(93,211,158,.12);color:#bff0d8}
.qopt.correct .ql{border-color:#5dd39e;color:#5dd39e}
.qopt.wrong{border-color:#ff8b8b;background:rgba(255,139,139,.1);color:#ffd2d2}
.qexpl{margin-top:18px;border:1px solid var(--line2);border-radius:13px;padding:16px;font-size:13px;line-height:1.65;color:var(--txt2);display:none}
.qexpl.show{display:block}
.qexpl .src{margin-top:8px;color:var(--gold-soft);font-size:11.5px}
.qnav{display:flex;justify-content:flex-end;margin-top:20px}
.qresult{text-align:center}
.qresult .score{font-family:var(--serif);font-size:54px;color:var(--gold-l);font-weight:700}
.qresult p{color:var(--muted);margin:10px 0 22px}
/* simple list cards */
.listcard{padding:22px}
.listcard h3{font-family:var(--serif);font-size:19px;color:#f4eedd;margin-bottom:14px;display:flex;align-items:center;gap:10px}
.listcard h3 svg{width:20px;height:20px;stroke:var(--gold);fill:none;stroke-width:1.8}
.listcard ul{list-style:none;display:flex;flex-direction:column;gap:9px}
.listcard ul li{font-size:13px;color:var(--txt2);line-height:1.6;display:flex;gap:9px}
.listcard ul li::before{content:"";margin-top:8px;width:5px;height:5px;border-radius:50%;background:var(--gold);flex:0 0 auto}
.tags{display:flex;flex-wrap:wrap;gap:7px}
.tag{font-size:11.5px;padding:4px 11px;border-radius:999px;border:1px solid var(--gold-dim);background:rgba(232,200,121,.08);color:var(--gold)}
.subcard{border:1px solid var(--line2);border-radius:12px;background:rgba(255,255,255,.022);padding:14px;margin-bottom:10px}
.subcard h4{font-size:14px;color:#f4eedd;margin-bottom:4px;display:flex;justify-content:space-between;gap:10px}
.subcard h4 .y{font-family:var(--mono);font-size:12px;color:var(--gold-soft)}
.subcard p{font-size:12.5px;color:var(--txt2);line-height:1.55}
.subcard .who{font-size:11.5px;color:var(--muted);margin-bottom:6px}
.kr-step{display:flex;gap:12px;margin-bottom:11px}
.kr-step .kn{flex:0 0 26px;height:26px;border-radius:50%;border:1px solid var(--gold-dim);color:var(--gold);display:grid;place-items:center;font-size:12px}
.kr-step .kt{font-size:12.5px;color:var(--txt2);line-height:1.55}
.dispute{border:1px solid var(--line2);border-radius:13px;background:rgba(255,255,255,.022);padding:16px;margin-bottom:12px}
.dispute .dp{font-size:14px;font-weight:700;color:#f4eedd}
.dispute .di{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted2);margin:2px 0 10px}
.dispute .dv{display:grid;gap:9px;grid-template-columns:1fr 1fr}
.dispute .dvc{border:1px solid var(--line2);background:rgba(255,255,255,.02);border-radius:10px;padding:11px;font-size:12px;color:var(--txt2);line-height:1.5}
.dispute .dn{font-size:12px;color:var(--muted);line-height:1.55;margin-top:10px}
/* footer */
.endsdg{display:flex;justify-content:center;padding:30px 0 6px;color:var(--gold-soft)}
.endsdg .sdg{display:none}
footer.site{text-align:center;padding:30px 5vw 44px;font-size:11.5px;color:var(--muted2);letter-spacing:.05em;border-top:1px solid var(--line2);margin-top:40px}
footer.site a{color:var(--muted);text-decoration:none}
footer.site a:hover{color:var(--gold)}
footer.site .ed{margin-top:8px;color:#55514c}
/* scroll-top */
#stop{position:fixed;right:18px;bottom:18px;width:44px;height:44px;border-radius:50%;background:rgba(15,16,26,.9);border:1px solid var(--gold-dim);color:var(--gold);display:grid;place-items:center;cursor:pointer;opacity:0;pointer-events:none;transition:.3s;z-index:60}
#stop.show{opacity:1;pointer-events:auto}
#stop:hover{background:rgba(232,200,121,.12)}
#stop svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.reveal{opacity:0;transform:translateY(22px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
.reveal.in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}html{scroll-behavior:auto}}
/* keyboard focus visibility (a11y) — единый видимый фокус для тёмной темы */
a:focus-visible,button:focus-visible,input:focus-visible,[tabindex]:focus-visible,
.routebtn:focus-visible,.tlf:focus-visible,.qopt:focus-visible,.gitem button:focus-visible,
.mapbtns button:focus-visible,.secnav a:focus-visible,.btn:focus-visible,#stop:focus-visible,
.tlcard:focus-visible,.pcard:focus-visible{outline:2px solid var(--gold);outline-offset:2px;border-radius:8px}
#mapsearch:focus-visible,#gsearch:focus-visible{outline:2px solid var(--gold);outline-offset:3px}
canvas#mapcanvas:focus-visible{outline:2px solid var(--gold);outline-offset:-2px}
@media(max-width:760px){
  .sec{padding:56px 0}
  .hstats{grid-template-columns:repeat(2,1fr)}
  .dispute .dv{grid-template-columns:1fr}
  .org .meta{grid-template-columns:1fr}
  #mapcanvas{height:460px}
  table.ptable{display:none}
  .cmpmobile{display:flex}
  .maplegend{max-width:48%}
  .crumb{display:none}
  /* touch targets ≥44px (Apple HIG / a11y) on touch devices */
  .routebtn{padding:13px 15px;font-size:12.5px;min-height:44px}
  .tlf{padding:13px 15px;min-height:44px}
  .mapbtns button{width:44px;height:44px}
  .secnav a{padding:12px 15px;min-height:44px;display:flex;align-items:center}
  .mapsearch{padding:12px 15px}
  .gsearch{padding:14px 18px}
}
`;
}

// placeholder: body assembled in build2 (appended below via require ordering)
module.exports = { HEAD, esc, txt, D, OUT };
