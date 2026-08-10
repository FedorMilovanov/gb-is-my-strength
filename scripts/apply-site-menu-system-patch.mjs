#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

function read(path){ return fs.readFileSync(path,'utf8'); }
function write(path, text){ fs.writeFileSync(path,text); }
function replaceExact(path, oldText, newText, expectedCount = 1){
  let text = read(path);
  const count = text.split(oldText).length - 1;
  if (count !== expectedCount) throw new Error(`${path}: expected ${expectedCount} occurrence(s), found ${count}`);
  text = text.split(oldText).join(newText);
  write(path,text);
}
function sha(path){ return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${fs.statSync(path).size}\0`), fs.readFileSync(path)])).digest('hex'); }
function expectSha(path, expected){ const actual=sha(path); if(actual!==expected) throw new Error(`${path}: blob ${actual} != ${expected}`); }

replaceExact(
  'js/site.js',
  'window.closeMobileNav=v,s&&s.addEventListener("click",function(){u?v():c&&s&&(u=!0,c.classList.add("open"),c.removeAttribute("aria-hidden"),s.classList.add("is-open"),s.setAttribute("aria-expanded","true"),s.setAttribute("aria-label","Закрыть меню"),d&&d.classList.add("open"),window.SiteUtils&&window.SiteUtils.lockScroll&&window.SiteUtils.lockScroll("home-mobile-menu"))}),d&&d.addEventListener("click",v),document.addEventListener("keydown",function(e){u&&SiteUtils.isEscape(e)&&v()}',
  'c&&"canonical"===c.getAttribute("data-gb-site-menu-runtime")||(window.closeMobileNav=v,s&&s.addEventListener("click",function(){u?v():c&&s&&(u=!0,c.classList.add("open"),c.removeAttribute("aria-hidden"),s.classList.add("is-open"),s.setAttribute("aria-expanded","true"),s.setAttribute("aria-label","Закрыть меню"),d&&d.classList.add("open"),window.SiteUtils&&window.SiteUtils.lockScroll&&window.SiteUtils.lockScroll("home-mobile-menu"))}),d&&d.addEventListener("click",v),document.addEventListener("keydown",function(e){u&&SiteUtils.isEscape(e)&&v()})'
);

for (const path of [
  'src/components/about/AboutPageChrome.astro',
  'src/components/baptisty-rossii/BaptistyRossiiBody.astro',
  'src/components/baptisty-rossii/BaptistyRossiiBookLanding.astro',
]) replaceExact(path, 'site.js?v=8009e039', 'site.js?v=c6b5ccf7');

replaceExact(
  'src/components/home/HomePageChrome.astro',
  '---\n/**\n * HomePageChrome.astro — native body chrome + runtime shell for /.\n */',
  "---\nimport SiteSectionsMenuRuntime from '@/components/article-pilots/_shared/SiteSectionsMenuRuntime.astro';\n\n/**\n * HomePageChrome.astro — native body chrome + runtime shell for /.\n */"
);
replaceExact(
  'src/components/home/HomePageChrome.astro',
  '<div class="h-mobile-nav" id="hMobileNav" role="dialog" aria-modal="true" aria-labelledby="hMobileNavTitle" aria-hidden="true">',
  '<div class="h-mobile-nav" id="hMobileNav" role="dialog" aria-modal="true" aria-labelledby="hMobileNavTitle" aria-hidden="true" inert data-gb-site-menu-runtime="canonical">'
);
replaceExact(
  'src/components/home/HomePageChrome.astro',
  '<div id="hMobileBackdrop" class="h-mobile-backdrop" aria-hidden="true"></div>',
  '<div id="hMobileBackdrop" class="h-mobile-backdrop" aria-hidden="true"></div>\n<SiteSectionsMenuRuntime />'
);
replaceExact('src/components/home/HomePageChrome.astro', 'site.js?v=8009e039', 'site.js?v=c6b5ccf7');

replaceExact(
  'src/components/nagornaya/seriya/NagornayaSeriyaBody.astro',
  "*/\n---\n<a href=\"#main-content\" class=\"skip-link\">",
  "*/\nimport SiteSectionsMenu from '@/components/article-pilots/_shared/SiteSectionsMenu.astro';\n---\n<a href=\"#main-content\" class=\"skip-link\">"
);
replaceExact(
  'src/components/nagornaya/seriya/NagornayaSeriyaBody.astro',
  `<!-- Mobile nav backdrop -->\n<div id="hMobileBackdrop" class="h-mobile-backdrop" aria-hidden="true"></div>\n\n<div class="h-mobile-nav" id="hMobileNav" aria-hidden="true">\n  <a href="../../#publikacii" data-close-nav>Публикации</a>\n  <a href="../../#razbor" data-close-nav>Разбор заблуждений</a>\n  <a href="../../biografii/" data-close-nav>Биографии</a>\n  <a href="../../articles/" data-close-nav>Все статьи</a>\n  <a href="../../about/" data-close-nav>О проекте</a>\n</div>`,
  '<SiteSectionsMenu variant="plain" />'
);
replaceExact('src/components/nagornaya/seriya/NagornayaSeriyaBody.astro', 'site.js?v=8009e039', 'site.js?v=c6b5ccf7', 2);

const expected = {
  'js/site.js': 'cd6170af342aaafc1ef2a91cc7a13a25eefaff4a',
  'src/components/about/AboutPageChrome.astro': '7fc658e50296a50ea88a9db813b4e723082a06cc',
  'src/components/baptisty-rossii/BaptistyRossiiBody.astro': '5ce5182f39639cad01083380da9e6899f239a004',
  'src/components/baptisty-rossii/BaptistyRossiiBookLanding.astro': '00bbabacbbc00a731b02720235bb672ed2ab73ed',
  'src/components/home/HomePageChrome.astro': 'c5f0301291d8ab787830691e422fc4fcb08bea83',
  'src/components/nagornaya/seriya/NagornayaSeriyaBody.astro': '0160fed827284610060903364e5fec68e3967800',
};
for (const [path, expectedSha] of Object.entries(expected)) expectSha(path, expectedSha);
console.log('site-menu bootstrap patch: exact blobs verified');
