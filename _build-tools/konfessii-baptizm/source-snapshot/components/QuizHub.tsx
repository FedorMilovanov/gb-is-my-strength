import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, HelpCircle, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { ALL_QUIZ_QUESTIONS } from '../data/quizData';
const TOPICS = [{ id: 'all', label: 'Все темы' },{ id: 'origins', label: 'Истоки' },{ id: 'figures', label: 'Фигуры' },{ id: 'unions', label: 'Союзы' },{ id: 'persecution', label: 'Гонения' },{ id: 'doctrines', label: 'Вероучение' },{ id: 'modern', label: 'Современность' }];
export default function QuizHub() {
  const [topic, setTopic] = useState('all'); const [currentIndex, setCurrentIndex] = useState(0); const [selected, setSelected] = useState<number | null>(null); const [score, setScore] = useState(0); const [total, setTotal] = useState(0); const [finished, setFinished] = useState(false);
  const questions = topic === 'all' ? ALL_QUIZ_QUESTIONS : ALL_QUIZ_QUESTIONS.filter((q) => q.topic === topic);
  const question = questions[currentIndex];
  const handleSelect = (index: number) => { if (selected !== null || !question) return; setSelected(index); setTotal((v) => v + 1); if (index === question.correctIndex) setScore((v) => v + 1); };
  const handleNext = () => { if (currentIndex + 1 >= questions.length) setFinished(true); else { setCurrentIndex((v) => v + 1); setSelected(null); } };
  const handleReset = () => { setCurrentIndex(0); setSelected(null); setScore(0); setTotal(0); setFinished(false); };
  const handleTopicChange = (t: string) => { setTopic(t); handleReset(); };
  if (!question) return null;
  return (
    <section id="quiz" className="relative py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-10 text-center">
          <div className="section-badge mb-4 justify-center"><HelpCircle size={12} /> Викторина</div>
          <h2 className="section-title">Проверьте знания</h2>
          <p className="section-subtitle mx-auto max-w-2xl">
            Вопросы по истории русского баптизма — от истоков до современности.
          </p>
        </motion.div>
        <div className="mb-8 flex flex-wrap justify-center gap-2">{TOPICS.map((item) => (<button key={item.id} onClick={() => handleTopicChange(item.id)} className={`filter-pill ${topic === item.id ? 'filter-pill-active' : ''}`}>{item.label}</button>))}</div>
        <AnimatePresence mode="wait">
          {finished ? (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} className="overflow-hidden rounded-[1.375rem] border border-white/[0.08] bg-white/[0.025] p-10 text-center">
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.1 }} className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-brand-gold/14 text-brand-gold ring-2 ring-brand-gold/25"><Trophy size={36} /></motion.div>
              <p className="mb-1 text-[12px] font-bold uppercase tracking-[0.16em] text-brand-gold/70">Результат</p>
              <h3 className="mb-1 text-5xl font-black tracking-tighter">{score}<span className="text-3xl font-bold opacity-40"> / {total}</span></h3>
              <p className="mb-3 font-mono text-2xl font-bold text-brand-gold">{Math.round((score / Math.max(total, 1)) * 100)}%</p>
              <p className="mx-auto mb-8 max-w-xs text-[13px] opacity-60">{score === total ? 'Отлично! Вы знаете историю баптизма.' : score >= total * 0.7 ? 'Хороший результат — продолжайте изучение.' : 'Есть что изучить. Попробуйте ещё раз!'}</p>
              <button onClick={handleReset} className="inline-flex items-center gap-2 rounded-full font-semibold text-black transition hover:scale-105" style={{ background: 'linear-gradient(135deg, #c4a67e, #a87c4e)', padding: '0.75rem 2rem', boxShadow: '0 6px 20px rgba(196,166,126,0.28)' }}><RotateCcw size={16} /> Пройти снова</button>
            </motion.div>
          ) : (
            <motion.div key={`q-${topic}-${currentIndex}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.24 }} className="overflow-hidden rounded-[1.375rem] border border-white/[0.08] bg-white/[0.025] p-6 sm:p-8">
              <div className="mb-5 flex items-center justify-between gap-4"><div className="flex items-center gap-2"><span className="font-mono text-[11px] opacity-40">{currentIndex + 1} / {questions.length}</span><span className="chip chip-accent">{score} правильно</span></div>{question.difficulty && (<span className="chip" style={{ borderColor: question.difficulty === 'hard' ? 'rgba(239,68,68,0.4)' : question.difficulty === 'medium' ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)', color: question.difficulty === 'hard' ? '#fca5a5' : question.difficulty === 'medium' ? '#fcd34d' : '#6ee7b7', background: 'transparent' }}>{question.difficulty === 'hard' ? 'сложно' : question.difficulty === 'medium' ? 'средне' : 'просто'}</span>)}</div>
              <div className="mb-6 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]"><motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #c4a67e, #a87c4e)' }} initial={{ width: 0 }} animate={{ width: `${((currentIndex + 1) / Math.max(questions.length, 1)) * 100}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} /></div>
              <h3 className="mb-5 text-[1.1rem] font-black leading-7">{question.question}</h3>
              <div className="space-y-2.5">{question.options.map((option: string, i: number) => { const isCorrect = i === question.correctIndex; const isSelected = i === selected; const idle = selected === null; return (<button key={option} onClick={() => handleSelect(i)} disabled={!idle} className="w-full rounded-[0.875rem] border px-4 py-3.5 text-left text-[13.5px] font-medium transition-all" style={{ borderColor: idle ? 'rgba(255,255,255,0.09)' : isCorrect ? 'rgba(16,185,129,0.6)' : isSelected ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.05)', background: idle ? 'rgba(255,255,255,0.03)' : isCorrect ? 'rgba(16,185,129,0.09)' : isSelected ? 'rgba(239,68,68,0.09)' : 'rgba(255,255,255,0.012)', opacity: !idle && !isCorrect && !isSelected ? 0.45 : 1, color: isCorrect ? '#6ee7b7' : isSelected ? '#fca5a5' : undefined, cursor: idle ? 'pointer' : 'default' }}><span className="flex items-center gap-3">{!idle && isCorrect && <CheckCircle size={15} className="shrink-0 text-green-400" />}{!idle && isSelected && !isCorrect && <XCircle size={15} className="shrink-0 text-red-400" />}{idle && <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white/14 bg-white/[0.06] text-[10px] font-bold text-white/50">{String.fromCharCode(65 + i)}</span>}{option}</span></button>); })}</div>
              {selected !== null && (<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mt-5 rounded-[0.875rem] border border-white/[0.07] bg-white/[0.04] px-5 py-4 text-[12.5px] leading-[1.7] opacity-[0.84]"><span className="font-bold opacity-60">Объяснение: </span>{question.explanation}{question.source && <p className="mt-2 text-[11px] text-brand-gold/65">Источник: {question.source}</p>}</motion.div>)}
              {selected !== null && (<motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onClick={handleNext} className="mt-4 w-full rounded-full py-3.5 font-bold text-black transition hover:scale-[1.025]" style={{ background: 'linear-gradient(135deg, #c4a67e, #a87c4e)', boxShadow: '0 4px 16px rgba(196,166,126,0.22)' }}>{currentIndex + 1 >= questions.length ? 'Посмотреть результат' : 'Следующий вопрос →'}</motion.button>)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
