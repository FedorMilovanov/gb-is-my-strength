# A03 tooltip controller ownership

Head: `dd60050ea12f12de25a812f9522eb5e60d684615`
Registrations: **3**

## 1. `js/site.js` @ 84860

```text
ef")||e.textContent.trim(),i=t[n]||e.getAttribute("data-tip")||e.getAttribute("title")||"Библейская ссылка: <strong>"+n+"</strong>";if(!e.querySelector(".btip")){var o=document.createElement("span");o.className="btip",o.innerHTML="<div>"+i+"</div>",e.appendChild(o)}}),document.querySelector(".bref[data-ref] .btip")&&r.makeTooltipController(".bref[data-ref]",".btip",{extraCloseSelectors:[".btoc-nav",".btoc-panel","#toc-panel"]})}(),(n=document.querySelectorAll(".fn-marker")).length&&(n.forEach(function(e){var t=e.previousSibling;if(t&&t.nodeType===Node.TEXT_NODE&&(t.textContent=t.textContent.replace(/\s+$/,""),/\u2060$/.test(t.textContent)||(t.textContent+="\u2060")),!e.getAttribute("aria-label")){var n=(e.childNodes[0]?e.childNodes[0].textContent:"").trim();e.setAttribute("aria-label","Источник"+(n?" "+n:"")+" — нажмите, чтобы открыть"),e.setAttribute("role","button"),e.getAttribute("tabindex")||e.setAttribute("tabindex","0")}}),r.makeTooltipController(".fn-marker",".tooltip",{mobileSheet:!0,mobileSheetBreakpoint:768})),function(){var e=!1;function t(e){return String(e||"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim()}function n(e,n){var i=e.querySelector(".gtip");if(i&&"true"!==i.datase
```

## 2. `js/site.js` @ 85485

```text
/.test(t.textContent)||(t.textContent+="\u2060")),!e.getAttribute("aria-label")){var n=(e.childNodes[0]?e.childNodes[0].textContent:"").trim();e.setAttribute("aria-label","Источник"+(n?" "+n:"")+" — нажмите, чтобы открыть"),e.setAttribute("role","button"),e.getAttribute("tabindex")||e.setAttribute("tabindex","0")}}),r.makeTooltipController(".fn-marker",".tooltip",{mobileSheet:!0,mobileSheetBreakpoint:768})),function(){var e=!1;function t(e){return String(e||"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim()}function n(e,n){var i=e.querySelector(".gtip");if(i&&"true"!==i.dataset.luxury){var o=e.getAttribute("data-term-title")||function(e,t){var n="";return Array.prototype.forEach.call(e.childNodes,function(e){e!==t&&(n+=e.textContent||"")}),n.replace(/\s+/g," ").trim()}(e,i)||e.getAttribute("data-term")||"Термин",r=function(e,n){for(var i=t(e.getAttribute("data-term")||n)+" "+t(n),o=[{slug:"heresy",label:"Ереси и споры",rx:/(ариан|гност|валентиниан|докет|демиург|монтан)/},{slug:"doctrine",label:"Богословие",rx:/(хамартиолог|пелагиан|полупелагиан|арминиан|тотальн.*испорт|остаточн.*грех|остаточн.*порч|mortificatur|simul iustus)/},{slug:"confession",label:"Исповедания",rx:/(вестминстер|гейдель
```

## 3. `js/site.js` @ 88822

```text
ent("span");h.className="gtip-luxury__body",h.appendChild(c);var g=document.createElement("span");g.className="gtip-luxury__divider",g.setAttribute("aria-hidden","true"),h.appendChild(g),d.appendChild(h),i.appendChild(d)}}function i(t){(t&&t.querySelectorAll?t:document).querySelectorAll(".gterm").forEach(n),e||(e=!0,r.makeTooltipController(".gterm",".gtip",{useFocusBlur:!0,mobileSheet:!0,mobileSheetBreakpoint:768}))}r.initGlossaryTooltips=i,window.SiteUtils&&window.SiteUtils!==r&&(window.SiteUtils.initGlossaryTooltips=i),i(document)}(),function(){var e=/ (—) /g,t=/ (–) /g,n={CODE:1,PRE:1,SCRIPT:1,STYLE:1};function i(i){var o=i.parentElement;if(o&&!n[o.tagName]){var r=i.nodeValue;!r||-1===r.indexOf("—")&&-1===r.indexOf("–")||(i.nodeValue=r.replace(e," $1 ").replace(t," $1 "))}}function o(e){for(var t,n=document.createTreeWalker(e,NodeFilter.SHOW_TEXT,null);t=n.nextNode();)i(t)}r.ready(function(){document.querySelectorAll(".article-body, article").forEach(o)})}(),function(){var e=null,t=null;function n(n,i){e||((e=document.createElement("div")).className="kbd-hint-toast",document.body.appendChild(e)),e.innerHTML="<kbd>"+n+"</kbd> "+i,e.classList.add("visible"),clearTimeout(t),t=setTimeout(function(){e.c
```
