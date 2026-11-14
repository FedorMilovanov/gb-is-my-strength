import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { askGemini } from '../services/gemini';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

function localAnswer(question: string) {
  const text = question.toLowerCase();
  if (text.includes('павлов')) return 'В.Г. Павлов (1854–1924) — один из первых десяти членов Тифлисской общины. Крещён Н.И. Ворониным в апреле 1871. В 1875 в Гамбурге его обучал Пётр Вильрат по назначению Онкена; в 1876 Павлов перевёл «Гамбургское исповедание веры». В 1909 избран председателем Союза баптистов России.';
  if (text.includes('мазаев')) return 'Д.И. Мазаев (1855–1922) — председатель Союза баптистов России около 20 лет. Крещён 11.11.1884 в реке Кавалерке В.Р. Колодиным. Основатель и редактор журнала «Баптист» (1907–1909), участник Лондонского конгресса 1905.';
  if (text.includes('каргель')) return 'И.В. Каргель (1849–1937) — богослов и связующее звено Тифлиса, Украины/Одессы, Гамбурга, Петербурга и Болгарии. Исправление v6: по pravenc.ru Каргель крещён Н.И. Ворониным в 1869, не Кальвейтом.';
  if (text.includes('пашков') || text.includes('архив')) return 'Петербургский съезд открыт 1.04.1884 и прерван властями 6.04.1884. Архив В.А. Пашкова — 7–10 тыс. документов в Бирмингемском университете; микрофильмы есть в Нэшвилле, Виннипеге, Итонском колледже и Беркли.';
  if (text.includes('сц') || text.includes('мсц') || text.includes('1965')) return 'СЦ ЕХБ (ныне МСЦ ЕХБ) оформлен в сентябре 1965. Инициативная группа появилась в 1961 г. Лидеры: Г.К. Крючков, Г.П. Винс.';
  if (text.includes('воронин') || text.includes('1867')) return 'Никита Воронин крещён 20.08.1867 в р. Кура (Тифлис) Мартином Кальвейтом. Дата принята официально с письма Воронина 15.03.1889 (baptist.org.ru). Тифлисская община — онкенская модель.';
  if (text.includes('всехб') || text.includes('1944')) return 'ВСЕХБ создан 26–29.10.1944 в Москве. Первоначальное название — ВСЕХИ, с 01.01.1946 — «Братский вестник». Первый председатель — Я.И. Жидков, редактор БВ — А.В. Карев.';
  if (text.includes('исток')) return 'Три истока ЕХБ: Тифлис (1867), Южная Украина (1864/1869), Санкт-Петербург (1874). ЕХБ сформированы из трёх независимых источников.';
  if (text.includes('веротерпимость') || text.includes('1905')) return 'Указ о веротерпимости — 17 апреля 1905 г. (не Манифест 17 октября). Первая легализация баптизма в России.';
  if (text.includes('прицкау')) return 'Исправление v6: книга И.Е. Прицкау вышла в 1914 году, не «до 1924». Источник: предисловие ВСЕХБ 1989, с. 6.';
  if (text.includes('фризен')) return 'П.М. Фризен, «История братских меннонитов», издана в 1911 году (ВСЕХБ 1989).';
  return 'Спросите об истоках ЕХБ, Павлове, Каргеле, Мазаеве, Пашковском архиве, ВСЕХБ, СЦ ЕХБ или первоисточниках.';
}

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const initialMessages = useMemo<ChatMessage[]>(
    () => [{ role: 'assistant', text: 'Мир вам! Я помогу разобраться в карте русского баптизма. Например: «Когда создан ВСЕХБ?» или «Почему 1965 важен для МСЦ?»' }],
    [],
  );
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || pending) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setPending(true);
    const geminiAnswer = await askGemini(trimmed);
    setMessages((prev) => [...prev, { role: 'assistant', text: geminiAnswer || localAnswer(trimmed) }]);
    setPending(false);
  };

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-5 right-5 z-[95] grid h-14 w-14 place-items-center rounded-full text-black shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #c4a67e, #a87c4e)',
          boxShadow: '0 8px 28px rgba(196,166,126,0.42), inset 0 1px 0 rgba(255,255,255,0.3)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        aria-label="Открыть AI-ассистента"
      >
        <MessageCircle size={22} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed bottom-24 right-5 z-[96] flex h-[min(580px,calc(100dvh-8rem))] w-[calc(100vw-2.5rem)] max-w-[420px] flex-col overflow-hidden rounded-[1.75rem] border shadow-2xl"
            style={{
              background: 'rgba(5,5,12,0.96)',
              backdropFilter: 'blur(40px) saturate(220%)',
              WebkitBackdropFilter: 'blur(40px) saturate(220%)',
              borderColor: 'rgba(196,166,126,0.18)',
              boxShadow: '0 32px 88px rgba(0,0,0,0.72), 0 0 0 1px rgba(196,166,126,0.10), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-[0.875rem] bg-brand-gold/14 text-brand-gold ring-1 ring-brand-gold/22">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-[0.9375rem] font-black text-white">AI-ассистент</h3>
                  <p className="flex items-center gap-1.5 text-[10px] text-white/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    История русского баптизма
                  </p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="grid h-7 w-7 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white">
                <X size={15} />
              </button>
            </div>

            <div className="custom-scroll flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[86%] rounded-[1.1rem] px-4 py-3 text-[0.8125rem] leading-[1.64]"
                    style={
                      message.role === 'user'
                        ? { background: 'linear-gradient(135deg, #c4a67e, #a87c4e)', color: '#1a1109', fontWeight: 600 }
                        : { background: 'rgba(255,255,255,0.075)', color: 'rgba(240,238,235,0.9)', border: '1px solid rgba(255,255,255,0.07)' }
                    }
                  >
                    {message.text}
                  </div>
                </div>
              ))}
              {pending && (
                <div className="flex justify-start">
                  <div className="rounded-[1.1rem] border border-white/[0.07] bg-white/[0.07] px-4 py-3">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-brand-gold/70" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.22 }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-white/[0.07] px-4 py-4">
              <div className="flex items-center gap-2 rounded-[1.25rem] border border-white/[0.09] bg-white/[0.05] px-4 py-2.5">
                <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Задайте вопрос об истории..." className="flex-1 bg-transparent text-[0.8125rem] text-white outline-none placeholder:text-white/28" />
                <button onClick={send} disabled={pending || !input.trim()} className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #c4a67e, #a87c4e)', color: '#1a1109' }}>
                  <Send size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
