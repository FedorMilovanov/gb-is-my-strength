import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Castle, ChevronDown, Mountain, Wheat } from 'lucide-react';
import { useTheme } from './ThemeContext';
const origins = [
  { id: 'caucasus', title: 'Закавказье', subtitle: 'Тифлис, 1867', icon: Mountain, color: '#10b981', figure: 'Никита Воронин', years: '1840–1905', event: '20 августа 1867 г.', desc: 'Мартин Кальвейт крестил Никиту Воронина в реке Кура ночью, тайно. Первый русский баптист. Тифлисская (онкенская) модель: немецкое влияние, строгая организация.', details: [{ label: 'Крещение', value: '20.08.1867, р. Кура' },{ label: 'Крестивший', value: 'Мартин Кальвейт (нем. баптист)' },{ label: 'Павлов', value: 'крещён Ворониным в апреле 1871; первые 10 членов' },{ label: 'Каргель', value: 'по pravenc.ru крещён Ворониным в 1869' },{ label: 'Среда', value: 'Молоканская, купеческая' },{ label: 'Модель', value: 'Онкенская (гамбургская)' },{ label: 'Влилось в', value: 'Союз баптистов 1884' }], source: 'baptist.org.ru; «Баптист» №5/1925' },
  { id: 'ukraine', title: 'Южная Украина', subtitle: 'Ново-Васильевка, 1864–1869', icon: Wheat, color: '#f59e0b', figure: 'Ефим Цымбал / Иогаил Вилер', years: 'ок. 1830–1890-е', event: '10.05.1864 / 1869', desc: 'Штундизм — немецкие «часы Библии» среди украинских крестьян. Первая церковь из немецких колонистов 10.05.1864. Ефим Цымбал — первый крещёный штундист-украинец.', details: [{ label: 'Первая церковь', value: '10.05.1864, немецкие колонисты' },{ label: 'Ключевой пионер', value: 'Иогаил Вилер (нем. баптист)' },{ label: 'Каргель', value: '1872–1873 жил у Вилера, посещал меннонитские конференции' },{ label: 'Мазаев', value: 'Ново-Васильевка; крещение в Кавалерке 11.11.1884' },{ label: 'Среда', value: 'Крестьянская, немецкие колонии' },{ label: 'Модель', value: 'Штундистская (братская)' },{ label: 'Влилось в', value: 'Союз баптистов 1884' }], source: 'rusbaptist.stunda.org (А. Синичкин)' },
  { id: 'petersburg', title: 'Петербург', subtitle: 'Санкт-Петербург, 1874', icon: Castle, color: '#ec4899', figure: 'Василий Пашков', years: '1834–1902', event: '1874 г.', desc: 'Лорд Редсток проповедует в петербургских аристократических кругах. Полковник В.А. Пашков организует евангелизацию.', details: [{ label: 'Начало', value: 'Проповеди Редстока, 1874' },{ label: 'Организатор', value: 'В.А. Пашков (полковник гвардии)' },{ label: 'Съезд 1884', value: 'открыт 1 апреля, прерван властями 6 апреля' },{ label: 'Архив', value: '7–10 тыс. документов Пашкова в Бирмингеме' },{ label: 'Среда', value: 'Аристократическая, интеллигентская' },{ label: 'Модель', value: 'Евангельская (пашковская)' },{ label: 'Влилось в', value: 'ВСЕХ 1909 → ВСЕХБ 1944' }], source: 'А.В. Синичкин; pravenc.ru' },
];
const comparison = [{ aspect: 'Год', caucasus: '1867', ukraine: '1864/1869', spb: '1874' },{ aspect: 'Регион', caucasus: 'Тифлис (Закавказье)', ukraine: 'Юг Украины', spb: 'Петербург' },{ aspect: 'Среда', caucasus: 'Молокане, купцы', ukraine: 'Немецкие колонии', spb: 'Аристократия' },{ aspect: 'Модель', caucasus: 'Онкенская', ukraine: 'Штундистская', spb: 'Евангельская' },{ aspect: 'Фигура', caucasus: 'Воронин / Кальвейт', ukraine: 'Вилер / Цымбал', spb: 'Редсток / Пашков' },{ aspect: 'Вероучение', caucasus: 'Баптизм (нем.)', ukraine: 'Баптизм (нем.)', spb: 'Евангелизм (англ.)' },{ aspect: 'Влилось в', caucasus: 'ВСБ 1884', ukraine: 'ВСБ 1884', spb: 'ВСЕХ 1909' }];
export default function ThreeOrigins() {
  const [active, setActive] = useState<string | null>(null); const { theme } = useTheme(); const isLight = theme === 'light';
  return (
    <section id="origins" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-16 text-center"><div className="section-badge mb-5 justify-center">Три истока</div><h2 className="section-title">Три независимых источника</h2><p className="section-subtitle mx-auto max-w-3xl">ЕХБ сформированы из трёх независимых движений: Тифлис (1867), Украина (1864/1869), Санкт-Петербург (1874). Они соединились только в 1944 г.</p></motion.div>
        <div className="mb-12 grid min-w-0 grid-cols-1 gap-6 md:grid-cols-3">
          {origins.map((o, i) => { const Icon = o.icon; const isActive = active === o.id; return (
            <motion.div key={o.id} initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }} className="min-w-0">
              <button onClick={() => setActive(isActive ? null : o.id)} className={`bento-card w-full min-w-0 p-4 text-left transition-all sm:p-6 ${isActive ? 'scale-[1.02]' : ''}`} style={isActive ? { borderColor: `${o.color}40`, boxShadow: `0 20px 60px ${o.color}20` } : undefined}>
                <div className="mb-5 flex min-w-0 items-center gap-3 sm:gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl sm:h-14 sm:w-14" style={{ background: `${o.color}18`, color: o.color }}><Icon size={26} /></div><div className="min-w-0 flex-1"><h3 className="break-words text-lg font-black sm:text-xl">{o.title}</h3><p className="mt-0.5 break-words text-sm opacity-60">{o.subtitle}</p></div><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-all duration-300" style={{ borderColor: `${o.color}45`, background: isActive ? `${o.color}22` : `${o.color}10`, boxShadow: isActive ? `0 0 24px ${o.color}30` : undefined }}><ChevronDown className={`transition-transform duration-300 ${isActive ? 'rotate-180' : ''}`} size={19} style={{ color: o.color }} /></span></div>
                <p className="text-sm leading-6 opacity-75">{o.desc}</p>
                <AnimatePresence>{isActive && (<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}><div className="mt-5 space-y-2 border-t border-white/10 pt-5">{o.details.map((d: any) => (<div key={d.label} className="flex justify-between gap-4 text-sm"><span className="opacity-50">{d.label}</span><span className="min-w-0 break-words text-right font-medium">{d.value}</span></div>))}<p className="mt-3 text-xs opacity-40">Источник: {o.source}</p></div></motion.div>)}</AnimatePresence>
                <div className="mt-4 flex items-center gap-2"><div className="h-2 w-2 rounded-full" style={{ background: o.color }} /><span className="font-mono text-xs" style={{ color: o.color }}>{o.event}</span></div>
              </button>
            </motion.div>); })}
        </div>
        {/* Десктоп — полная таблица */}
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="hidden rounded-2xl border border-white/10 md:block">
          <div className={`grid grid-cols-4 ${isLight ? 'bg-black/5' : 'bg-white/5'}`}><div className="p-4 text-xs font-semibold uppercase tracking-wide opacity-50">Аспект</div>{origins.map((o) => (<div key={o.id} className="p-4 text-xs font-bold" style={{ color: o.color }}>{o.title}</div>))}</div>
          {comparison.map((row, i) => (<div key={row.aspect} className={`grid grid-cols-4 border-t border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}><div className="p-4 text-xs font-semibold opacity-50">{row.aspect}</div><div className="p-4 text-xs leading-5">{row.caucasus}</div><div className="p-4 text-xs leading-5">{row.ukraine}</div><div className="p-4 text-xs leading-5">{row.spb}</div></div>))}
        </motion.div>

        {/* Мобайл — компактные карточки по каждому истоку */}
        <div className="space-y-4 md:hidden">
          {origins.map((o, i) => {
            const Icon = o.icon;
            const rows = [
              { label: 'Год', value: comparison[0] ? [comparison[0].caucasus, comparison[0].ukraine, comparison[0].spb][i] : '' },
              { label: 'Среда', value: comparison[2] ? [comparison[2].caucasus, comparison[2].ukraine, comparison[2].spb][i] : '' },
              { label: 'Модель', value: comparison[3] ? [comparison[3].caucasus, comparison[3].ukraine, comparison[3].spb][i] : '' },
              { label: 'Фигура', value: comparison[4] ? [comparison[4].caucasus, comparison[4].ukraine, comparison[4].spb][i] : '' },
            ];
            return (
              <motion.div key={o.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }} className="rounded-2xl border border-white/10 p-4" style={{ borderColor: `${o.color}25`, background: `${o.color}06` }}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${o.color}18`, color: o.color }}><Icon size={18} /></div>
                  <div>
                    <p className="font-black" style={{ color: o.color }}>{o.title}</p>
                    <p className="font-mono text-[11px] text-white/50">{o.subtitle}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {rows.map((r) => r.value ? (
                    <div key={r.label} className="flex items-start justify-between gap-3 text-[12px]">
                      <span className="shrink-0 font-semibold text-white/45">{r.label}</span>
                      <span className="text-right text-white/75">{r.value}</span>
                    </div>
                  ) : null)}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
