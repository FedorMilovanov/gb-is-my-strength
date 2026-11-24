/** @param {{total:number,conferences:number,advertising:number}} input */
export function financeModel({total,conferences,advertising}) {
  if (![total,conferences,advertising].every(Number.isSafeInteger) || total<=0 || conferences<0 || advertising<0) throw new Error('G3 waterfall requires safe integer USD amounts and positive net increase');
  const subtotal=conferences+advertising;
  if(!Number.isSafeInteger(subtotal)) throw new Error('Unsafe subtotal');
  const residual=total-subtotal;
  if(!Number.isSafeInteger(residual)) throw new Error('Unsafe residual');
  const max=Math.max(total,subtotal), step=Math.max(1,Math.ceil(max/4/100000)*100000), ceiling=step*4;
  const fmt=new Intl.NumberFormat('ru-RU');
  const sign=n=>`${n<0?'−':n>0?'+':''}${fmt.format(Math.abs(n))}`;
  const pct=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2,minimumFractionDigits:2}).format(n/total*100)+'%';
  /** @type {Array<[string,string,number,number,number,string]>} */
  const raw=[['Конференции и встречи','Конференции',0,conferences,conferences,'positive'],['Реклама','Реклама',conferences,subtotal,advertising,'positive'],['Прочие категории*','Прочие',subtotal,total,residual,residual<0?'negative':'positive'],['Общее изменение','Итого',0,total,total,'total']];
  const y=n=>266-230*n/ceiling;
  const rows=raw.map(([label,short,start,end,value,kind],i)=>({label,short,start,end,value,kind,display:sign(value),percent:pct(value),x:102+i*150,y:y(Math.max(start,end)),height:Math.abs(y(start)-y(end)),endY:y(end),left:Math.min(start,end)/ceiling*100,width:Math.abs(end-start)/ceiling*100}));
  return {rows,ticks:Array.from({length:5},(_,i)=>({y:y(i*step),label:fmt.format(i*step/1000)})),residual,subtotal,displayTotal:sign(total)};
}
