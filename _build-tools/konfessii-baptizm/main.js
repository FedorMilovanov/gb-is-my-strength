'use strict';
const fs = require('fs');
const { HEAD, OUT } = require('./build.js');
const { buildBody } = require('./body.js');
const { buildScript } = require('./runtime.js');

const YANDEX = `
<!-- Yandex.Metrika counter -->
<script type="text/javascript">
  (function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
  })(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=108353327','ym');
  window.dataLayer = window.dataLayer || [];
  ym(108353327,'init',{ssr:false,webvisor:true,clickmap:true,ecommerce:"dataLayer",referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});
</script>
<noscript><div><img decoding="async" src="https://mc.yandex.ru/watch/108353327" style="position:absolute;left:-9999px;" alt=""></div></noscript>
<!-- /Yandex.Metrika counter -->`;

const html = HEAD + '\n<body>\n' + buildBody() + '\n<script>\n' + buildScript() + '\n</script>\n' + YANDEX + '\n</body>\n</html>\n';

fs.writeFileSync(OUT, html, 'utf8');
console.log('Written', OUT, '—', (html.length/1024).toFixed(1)+'KB');
