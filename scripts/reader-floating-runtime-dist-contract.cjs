/* Reader Floating Runtime: postbuild singleton and coverage contract.
 * Checks actual HTML, not mere component imports; regression targets include
 * native Lawson, Apostasy and nested Baptist reference. */
const fs=require('node:fs'),path=require('node:path');
const dist=path.resolve(__dirname,'../dist');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):e.isFile()&&e.name.endsWith('.html')?[path.join(dir,e.name)]:[])}
if(!fs.existsSync(path.join(dist,'index.html')))throw Error('Missing production-like dist');
const routes=files(dist).map(file=>{
 const html=fs.readFileSync(file,'utf8');
 return {route:'/'+path.relative(dist,file).replace(/\\/g,'/').replace(/index\.html$/,''),controller:(html.match(/src=["'][^"']*floating-cluster-controller\.js(?:\?[^"']*)?["']/g)||[]).length,theme:/data-fc-action=["']theme|gb-theme-toggle/.test(html)};
});
const missing=routes.filter(r=>r.theme&&r.controller===0);
const duplicates=routes.filter(r=>r.controller>1);
const required=['/articles/steven-lawson-samoobman-i-publichnyy-golos/','/hard-texts/otstuplenie-ot-very-iuda-evreyam-6/','/baptisty-rossii/spravochnik/'];
const critical=required.filter(route=>routes.find(r=>r.route===route)?.controller!==1);
const report={total:routes.length,themePages:routes.filter(r=>r.theme).length,controllerPages:routes.filter(r=>r.controller===1).length,missing,duplicates,critical};
console.log(JSON.stringify(report,null,2));
if(missing.length||duplicates.length||critical.length)process.exitCode=1;
