// Pure arithmetic model of the >=1024px Gill desktop layout (no browser needed).
const clamp=(lo,v,hi)=>Math.min(hi,Math.max(lo,v));
const reserve=vw=>clamp(16,0.024*vw,40)+clamp(272,0.24*vw,304)+clamp(24,0.03*vw,48);
const railL=vw=>clamp(16,0.024*vw,40), railW=vw=>clamp(272,0.24*vw,304);
// measure choice -> rem -> px (16px root)
const MEAS={narrow:36,normal:43,wide:46};
function gbMeasure(vw,rem){
  if(vw>=1600) return Math.min(760, vw-48);            // L2728 (>=64em)
  if(vw>=1024) return Math.min(rem*16, vw-reserve(vw)-204); // L4992 (64em..99.99em)
  return null;
}
const rows=[];
for(const vw of [1024,1100,1200,1280,1366,1440,1600,1920,2560]){
  for(const key of ['narrow','normal','wide']){
    const rem=MEAS[key];
    const M=gbMeasure(vw,rem); if(M===null) continue;
    const res=reserve(vw);
    const pwLeft=Math.max((vw-M)/2,res), pwW=M;
    const pwPad=clamp(48,0.07*vw,100)===0?0:24; // page-wrap horizontal padding = 24px
    const contentW=pwW-2*24;
    const mainW=Math.min(820,0.92*vw);
    const mainPadX=24, mainPadT=clamp(24,0.035*vw,44);
    const mainLeft=pwLeft+24+(contentW-mainW)/2;   // margin:0 auto inside content box
    const mainRight=mainLeft+mainW;
    const textLeft=mainLeft+mainPadX, textRight=mainRight-mainPadX;
    const railRight=railL(vw)+railW(vw);
    const overlapRail=Math.max(0,railRight-mainLeft);
    const overlapRailText=Math.max(0,railRight-textLeft);
    const centreDrift=(mainLeft+mainRight)/2-vw/2;
    const spillLeft=pwLeft-mainLeft;               // how far main escapes page-wrap
    rows.push({vw,key,measureRem:rem,pageWrap:+M.toFixed(1),mainW:+mainW.toFixed(1),
      overflowMain_vs_pageWrap:+(mainW-M).toFixed(1),
      textW:+(textRight-textLeft).toFixed(1),
      railRightEdge:+railRight.toFixed(1),mainLeft:+mainLeft.toFixed(1),
      mainUnderRailPx:+overlapRail.toFixed(1), textUnderRailPx:+overlapRailText.toFixed(1),
      offCentrePx:+centreDrift.toFixed(1),
      topGap:+(clamp(48,0.07*vw,100)+mainPadT).toFixed(1)});
  }
}
const f=(o)=>[o.vw,o.key,o.pageWrap,o.mainW,o.overflowMain_vs_pageWrap,o.textW,o.mainLeft,o.railRightEdge,o.mainUnderRailPx,o.textUnderRailPx,o.offCentrePx,o.topGap].join('\t');
console.log('vw\tmeasure\tpageWrapW\tmainW\tmain−wrap\ttextW\tmainLeft\trailRight\tmain∩rail\ttext∩rail\toffCentre\ttopGap');
for(const o of rows.filter(r=>r.key==='normal')) console.log(f(o));
console.log('\n-- effect of the width control at 1280/1920 (normal vs narrow vs wide) --');
for(const o of rows.filter(r=>r.vw===1280||r.vw===1920)) console.log(f(o));
