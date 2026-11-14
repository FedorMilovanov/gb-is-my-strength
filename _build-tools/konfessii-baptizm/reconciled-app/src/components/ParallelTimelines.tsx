import { motion } from 'framer-motion';
import { GitBranch } from 'lucide-react';
const VSEHB_EVENTS = [{ year: '1944', text: 'Создание ВСЕХБ (26–29 окт.)' },{ year: '1945', text: 'Первый «Братский вестник»; 24 августа — соглашение о вхождении части пятидесятников' },{ year: '1963/1965', text: 'Вхождение братских меннонитов: в источниках разночтение дат' },{ year: '1966', text: 'Жидков передаёт пост Иванову' },{ year: '1974', text: 'Клименко — председатель' },{ year: '1982', text: 'Документирование арестов и судьбы узников церковными бюллетенями' },{ year: '1985', text: 'Логвиненко — председатель' },{ year: '1990', text: 'Новый Устав ВСЕХБ' },{ year: '1992', text: 'Самостоятельные национальные союзы и добровольная Евро-Азиатская федерация' }];
const SC_EVENTS = [{ year: '1961', text: 'Инициативная группа Крючкова–Хомякова' },{ year: '1962', text: 'Оргкомитет, первые аресты' },{ year: '1965', text: 'Создание СЦ ЕХБ (сент.)' },{ year: '1970', text: 'Совет родственников узников' },{ year: '1971', text: 'Издательство «Христианин» (подполье)' },{ year: '1974', text: 'Арест Крючкова, 8 лет лагерей' },{ year: '1979', text: 'Винс обменян, уехал в США' },{ year: '1987', text: 'Частичное освобождение узников' },{ year: '1991', text: 'Легализация, регистрация' },{ year: '1998', text: 'МСЦ ЕХБ — международный статус' }];
const VIOLET = '#8b5cf6'; const RED = '#ef4444';
function EventList({ events, color }: { events: typeof VSEHB_EVENTS; color: string }) {
  return (
    <div className="relative space-y-2 pl-6">
      <div className="absolute left-0 top-0 h-full w-px" style={{ background: `linear-gradient(to bottom, ${color}70, ${color}20, transparent)` }} />
      {events.map((event, i) => (
        <motion.div
          key={event.year}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.04 }}
          className="group relative min-w-0"
        >
          <div className="absolute -left-6 top-[11px] h-2 w-2 -translate-x-1/2 rounded-full transition-transform duration-200 group-hover:scale-125"
            style={{ background: color, boxShadow: `0 0 10px ${color}70` }}
          />
          <div className="rounded-[0.875rem] border border-white/[0.06] bg-white/[0.025] px-3.5 py-2.5 transition-all group-hover:border-white/[0.10] group-hover:bg-white/[0.04]">
            <span className="mr-2 font-mono text-[11px] font-bold tabular-nums" style={{ color }}>{event.year}</span>
            <span className="text-[12.5px] leading-5 opacity-78">{event.text}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
export default function ParallelTimelines() {
  return (
    <section id="parallel-timelines" className="relative py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14 text-center">
          <div className="section-badge mb-5 justify-center"><GitBranch size={12} /> Два пути</div><h2 className="section-title">Два пути после 1960</h2><p className="section-subtitle mx-auto max-w-3xl">«Инструктивное письмо» 1960 г. раскололо ЕХБ СССР на официальный ВСЕХБ и подпольный СЦ ЕХБ.</p>
        </motion.div>
        <div className="grid min-w-0 gap-8 md:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="mb-5 overflow-hidden rounded-[1.25rem] border p-5" style={{ borderColor: `${VIOLET}35`, background: `color-mix(in srgb, ${VIOLET} 8%, rgba(7,7,14,0.95))` }}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black">ВСЕХБ</h3>
                  <p className="mt-0.5 text-[12px] font-semibold" style={{ color: VIOLET }}>Официальный путь · 1944–1992</p>
                </div>
                <span className="rounded-xl border px-3 py-1.5 font-mono text-[13px] font-black" style={{ borderColor: `${VIOLET}35`, color: VIOLET, background: `${VIOLET}12` }}>Проверка численности</span>
              </div>
              <p className="text-[12.5px] leading-[1.65] opacity-65">Зарегистрированный союз в рамках советских законов. Сохранил легальность, но ценой ограничений — «Инструктивное письмо» 1960 г. стало причиной раскола.</p>
            </div>
            <EventList events={VSEHB_EVENTS} color={VIOLET} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="mb-5 overflow-hidden rounded-[1.25rem] border p-5" style={{ borderColor: `${RED}35`, background: `color-mix(in srgb, ${RED} 8%, rgba(7,7,14,0.95))` }}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black">СЦ ЕХБ</h3>
                  <p className="mt-0.5 text-[12px] font-semibold" style={{ color: RED }}>Путь сопротивления · 1965–наши дни</p>
                </div>
                <span className="rounded-xl border px-3 py-1.5 font-mono text-[13px] font-black" style={{ borderColor: `${RED}35`, color: RED, background: `${RED}12` }}>МСЦ</span>
              </div>
              <p className="text-[12.5px] leading-[1.65] opacity-65">Незарегистрированный союз — подпольные типографии, аресты, лагеря. Принципиальный отказ от государственной регистрации. Ныне МСЦ ЕХБ.</p>
            </div>
            <EventList events={SC_EVENTS} color={RED} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
