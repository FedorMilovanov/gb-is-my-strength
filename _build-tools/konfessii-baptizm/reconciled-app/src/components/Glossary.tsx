import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, ChevronDown, Search, X } from 'lucide-react';
const terms = [
  { term: 'Баптист', definition: 'От греч. baptizein — «погружать». Член евангельской церкви, исповедующей крещение только сознательно уверовавших людей путём полного погружения в воду.' },
  { term: 'Штундист', definition: 'От нем. Stunde — «час». Участник немецких библейских часов на Украине XIX века. Со временем — пренебрежительное название русских баптистов в Российской Империи.' },
  { term: 'Евангельский христианин (ЕХ)', definition: 'Направление, восходящее к петербургскому пробуждению 1874 г. (лорд Редсток, В.А. Пашков). Объединились с баптистами в ВСЕХБ в 1944 году.' },
  { term: 'ВСЕХБ', definition: 'Всесоюзный совет евангельских христиан-баптистов. Создан 26–29 октября 1944 г. Официальная легальная организация ЕХБ в СССР. Реорганизован в 1992 г. при распаде СССР.' },
  { term: 'СЦ ЕХБ (МСЦ ЕХБ)', definition: 'Совет Церквей евангельских христиан-баптистов. Создан в сентябре 1965 г. реформационным движением. Принципиально отказался от государственной регистрации. Ныне — МСЦ ЕХБ (Международный союз церквей).' },
  { term: 'Пресвитер', definition: 'Духовный руководитель (старейшина) баптистской общины. У баптистов — избирается общиной, не является священником в иерархическом смысле.' },
  { term: 'Дьякон', definition: 'Служитель, помогающий пресвитеру. В баптистской традиции — забота о практических нуждах общины.' },
  { term: 'Sola Scriptura', definition: 'Лат. «только Писание». Реформаторский принцип: Библия — единственный непогрешимый авторитет в вопросах веры и жизни.' },
  { term: '«Братский вестник»', definition: 'Официальный журнал ВСЕХБ, выходил с 1945 г. (с перерывом 1949–1952). Важнейший источник по истории советского баптизма. С 3000 до 5000 экземпляров.' },
  { term: 'Инициативники', definition: 'Неофициальное название реформационного движения внутри ВСЕХБ (1961), организовавшего СЦ ЕХБ. Требовали отмены ограничительного «Инструктивного письма» 1960 г.' },
  { term: 'Молокане', definition: 'Русская духовная христианская секта, отвергавшая православные обряды. Из молокан вышло немало первых русских баптистов, в том числе Никита Воронин.' },
  { term: 'Онкен', definition: 'Иоганн Герхард Онкен (1800–1884) — основатель немецкого баптизма и крупнейший миссионер. Его организационная модель («гамбургская») повлияла на Тифлисскую общину.' },
  { term: 'Союз родственников узников', definition: 'Организация при СЦ ЕХБ, документировавшая случаи преследования верующих в СССР. Издавала «Бюллетень Совета родственников» — ценнейший источник по правам человека.' },
  { term: 'Редсток', definition: 'Гренвилл Волдегрейв, 3-й барон Редсток (1833–1913) — английский евангелист-аристократ, чьи проповеди в Петербурге в 1874 г. дали толчок пашковскому движению.' },
  { term: 'Закон о веротерпимости 1905', definition: 'Указ от 17 апреля 1905 г. (не следует путать с Манифестом 17 октября). Первая легализация баптизма в России. Позволил открыто проводить богослужения.' },
];
export default function Glossary() {
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return terms;
    return terms.filter((t) => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q));
  }, [query]);
  return (
    <section id="glossary" className="relative py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-10 text-center">
          <div className="section-badge mb-5 justify-center"><BookOpen size={12} />Глоссарий</div>
          <h2 className="section-title">Словарь терминов</h2>
          <p className="section-subtitle mx-auto max-w-2xl">Ключевые понятия для понимания истории русского баптизма.</p>
        </motion.div>

        {/* Поиск */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mb-8 flex max-w-md items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 transition-all focus-within:border-brand-gold/40 focus-within:bg-white/[0.06]"
        >
          <Search size={16} className="shrink-0 text-brand-gold/70" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти термин или понятие…"
            className="w-full bg-transparent text-[0.875rem] outline-none placeholder:text-white/30"
          />
          {query && (
            <button onClick={() => setQuery('')} className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/40 transition hover:bg-white/[0.08] hover:text-white/80" aria-label="Очистить">
              <X size={13} />
            </button>
          )}
          <span className="hidden font-mono text-[10px] text-white/40 sm:inline">{filtered.length}/{terms.length}</span>
        </motion.div>

        {filtered.length === 0 && (
          <p className="mb-6 text-center text-[13px] text-white/45">По запросу «{query}» ничего не найдено.</p>
        )}

        <div className="space-y-2">
          {filtered.map((item, index) => {
            const isOpen = openTerm === item.term;
            return (
              <motion.div key={item.term} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.025 }} className="overflow-hidden rounded-2xl border transition-all duration-300" style={{ borderColor: isOpen ? 'rgba(196,166,126,0.32)' : 'rgba(255,255,255,0.07)', background: isOpen ? 'rgba(196,166,126,0.06)' : 'rgba(255,255,255,0.025)', boxShadow: isOpen ? '0 8px 32px rgba(0,0,0,0.18)' : 'none' }}>
                <button onClick={() => setOpenTerm(isOpen ? null : item.term)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left" aria-expanded={isOpen}>
                  <span className="text-[0.9375rem] font-semibold">{item.term}</span>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-all duration-300" style={{ borderColor: isOpen ? 'rgba(196,166,126,0.5)' : 'rgba(255,255,255,0.1)', background: isOpen ? 'rgba(196,166,126,0.15)' : 'rgba(255,255,255,0.04)' }}>
                    <ChevronDown size={15} style={{ color: isOpen ? '#c4a67e' : 'rgba(240,238,235,0.5)' }} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (<motion.div key="content" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }} className="overflow-hidden"><p className="px-5 pb-5 pt-0 text-[0.8375rem] leading-[1.7] opacity-78">{item.definition}</p></motion.div>)}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
