import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
const periods = [
  { decade: '1860-е', intensity: 2, label: 'Слабое', events: 'Первые преследования за штундизм' },{ decade: '1870-е', intensity: 3, label: 'Умеренное', events: 'Административные ограничения' },{ decade: '1880-е', intensity: 4, label: 'Сильное', events: 'Запреты собраний, высылки' },{ decade: '1890-е', intensity: 5, label: 'Жёсткое', events: '«Вредная секта» — уголовное преследование' },{ decade: '1900-е', intensity: 2, label: 'Ослабло', events: 'Закон о веротерпимости 1905' },{ decade: '1920-е', intensity: 2, label: 'Рост', events: 'НЭП — временная свобода, потом давление' },{ decade: '1930-е', intensity: 10, label: 'Уничтожение', events: 'Большой террор: массовые аресты и разрушение церковных общин' },{ decade: '1940-е', intensity: 5, label: 'Тактический мир', events: 'ВСЕХБ — ограниченная легализация в обмен на контроль' },{ decade: '1960-е', intensity: 7, label: 'Максимум', events: 'Закрытие общин, арест лидеров СЦ ЕХБ' },{ decade: '1970-е', intensity: 6, label: 'Брежневское', events: '158 узников, Совет родственников узников' },{ decade: '1990-е', intensity: 1, label: 'Свобода', events: 'Закон о свободе совести 1990' },{ decade: '2010-е', intensity: 2, label: 'Новые угрозы', events: 'Закон Яровой 2016, ограничения миссии' },
];
function IntensityBar({ value, color }: { value: number; color: string }) {
  return (<div className="flex h-9 items-end gap-[3px]">{Array.from({ length: 10 }).map((_, i) => (<div key={i} className="flex-1 rounded-sm transition-all" style={{ height: `${((i + 1) / 10) * 100}%`, background: i < value ? color : 'rgba(255,255,255,0.07)', opacity: i < value ? 0.38 + (i / 10) * 0.62 : 1 }} />))}</div>);
}
function getBadgeColor(intensity: number) {
  if (intensity >= 8) return { bg: 'rgba(239,68,68,0.18)', text: 'rgba(252,165,165,0.95)', color: '#ef4444' };
  if (intensity >= 5) return { bg: 'rgba(245,158,11,0.16)', text: 'rgba(253,211,77,0.95)', color: '#f59e0b' };
  if (intensity >= 3) return { bg: 'rgba(234,179,8,0.14)', text: 'rgba(250,204,21,0.9)', color: '#eab308' };
  return { bg: 'rgba(16,185,129,0.14)', text: 'rgba(110,231,183,0.9)', color: '#10b981' };
}
export default function PersecutionHeatmap() {
  return (
    <section id="persecution" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14 text-center">
          <div className="mb-5 inline-flex items-center justify-center gap-1.5 rounded-full border border-red-500/24 bg-red-500/10 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-red-400"><Shield size={12} /> Гонения</div>
          <h2 className="section-title">Хроника гонений</h2><p className="section-subtitle mx-auto max-w-3xl">Иллюстративная хронологическая шкала характера ограничений и репрессий; не численный индекс по архивной статистике.</p>
        </motion.div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {periods.map((period, index) => { const { bg, text, color } = getBadgeColor(period.intensity); return (
            <motion.div key={period.decade} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.038 }} className="group rounded-[1.1rem] border border-white/[0.07] bg-white/[0.025] p-4 transition-all hover:border-white/[0.14] hover:bg-white/[0.04]">
              <div className="mb-3 flex items-start justify-between gap-2"><span className="font-mono text-[13px] font-black">{period.decade}</span><span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: bg, color: text }}>{period.label}</span></div>
              <IntensityBar value={period.intensity} color={color} /><p className="mt-3 text-[11.5px] leading-4 opacity-58">{period.events}</p>
            </motion.div>); })}
        </div>

        {/* Легенда шкалы интенсивности */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-6 flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-3"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Редакционная шкала (не количественная статистика)</span>
          {[
            { label: 'Свобода', color: '#10b981', range: '0–2' },
            { label: 'Умеренное', color: '#eab308', range: '3–4' },
            { label: 'Жёсткое', color: '#f59e0b', range: '5–7' },
            { label: 'Уничтожение', color: '#ef4444', range: '8–10' },
          ].map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5 text-[11px] text-white/65">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color, boxShadow: `0 0 6px ${item.color}50` }} />
              <span>{item.label}</span>
              <span className="font-mono text-[9px] text-white/35">{item.range}</span>
            </span>
          ))}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-8 overflow-hidden rounded-[1.375rem] border border-red-500/22" style={{ background: 'color-mix(in srgb, #ef4444 6%, rgba(5,5,12,0.96))' }}>
          <div className="p-6"><div className="mb-3 flex items-center gap-2.5"><div className="grid h-8 w-8 place-items-center rounded-full bg-red-500/18 text-red-400"><Shield size={15} /></div><h3 className="font-black text-red-400">Главный факт: 1937–1938</h3></div><p className="text-[0.8375rem] leading-[1.68] opacity-82">В годы Большого террора тысячи верующих подверглись преследованиям, многие служители были арестованы или расстреляны, а общины потеряли возможность открытого служения. Сопоставимой документальной базы для точной общесоюзной доли пресвитеров в процентах пока нет.</p><p className="mt-3 text-[11px] opacity-45">Источник: Research, глава 15 (досье 128, §23); региональные дела и церковные свидетельства</p></div>
        </motion.div>
      </div>
    </section>
  );
}
