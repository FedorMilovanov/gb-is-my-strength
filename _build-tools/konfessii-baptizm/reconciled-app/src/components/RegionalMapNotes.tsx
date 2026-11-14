import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Globe2, MapPin, Search } from 'lucide-react';
import { getGraphNodeLabel } from '../data/history/graphLabels';
import { mapPlaces } from '../data/history/mapPlaces';
const kindLabels = { all: 'Все', country: 'Страны', city: 'Города' } as const;
type FilterKind = keyof typeof kindLabels;
export default function RegionalMapNotes() {
  const [filter, setFilter] = useState<FilterKind>('all'); const [query, setQuery] = useState('');
  const filteredPlaces = useMemo(() => { const n = query.trim().toLowerCase(); return mapPlaces.filter((p: any) => { const mk = filter === 'all' || p.kind === filter; const h = [p.label, p.summary, p.historicalNotes.join(' '), p.source].join(' ').toLowerCase(); return mk && (!n || h.includes(n)); }); }, [filter, query]);
  return (
    <section id="regional-notes" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14 text-center"><div className="section-badge mb-5 justify-center"><Globe2 size={12} /> География истории</div><h2 className="section-title">Страны и города на исторической карте</h2><p className="section-subtitle mx-auto max-w-3xl">Точки, подсвечиваемые в 3D-карте, собраны здесь как читаемые исторические карточки.</p></motion.div>
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-2">{(Object.keys(kindLabels) as FilterKind[]).map((k) => (<button key={k} onClick={() => setFilter(k)} className={`filter-pill ${filter === k ? 'filter-pill-active' : ''}`}>{kindLabels[k]}</button>))}</div><label className="flex min-w-0 items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 sm:w-96"><Search size={16} className="shrink-0 text-brand-gold" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по региону, событию, источнику..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:opacity-45" /></label></div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredPlaces.map((place: any, index: number) => (<motion.article key={place.id} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: Math.min(index * 0.035, 0.22) }} className="bento-card p-6">
            <div className="mb-4 flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-gold/15 text-brand-gold">{place.kind === 'city' ? <MapPin size={22} /> : <Globe2 size={22} />}</div><div><p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-gold/80">{place.kind === 'city' ? 'Город' : 'Страна'}</p><h3 className="text-xl font-black leading-tight">{place.label}</h3></div></div>
            <p className="text-sm leading-6 opacity-75">{place.summary}</p>
            <div className="mt-5 space-y-2">{place.historicalNotes.map((note: string) => <p key={note} className="flex gap-2 text-xs leading-5 opacity-70"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold" />{note}</p>)}</div>
            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wide opacity-45">Связанные узлы 3D</p><div className="flex flex-wrap gap-1.5">{place.relatedNodes.map((node: string) => <span key={node} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] opacity-70">{getGraphNodeLabel(node)}</span>)}</div></div>
            <p className="mt-4 text-xs leading-5 text-brand-gold/70">Источник: {place.source}</p>
          </motion.article>))}
        </div>
      </div>
    </section>
  );
}
