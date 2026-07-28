const VERSION = 1;

function resultFor(config, score, total) {
  const entries = Array.isArray(config?.scores) ? config.scores : [];
  return entries.find((entry) => score >= Number(entry.min) && score <= Number(entry.max)) || {
    title: `${score} из ${total}`,
    desc: score === total ? 'Все ответы верны.' : 'Вернитесь к отмеченным разделам и попробуйте ещё раз.',
  };
}

function buildQuiz(placeholder, config) {
  if (placeholder.dataset.gbQuizReady === '1') return;
  const questions = Array.isArray(config?.questions)
    ? config.questions.filter((item) => item && Array.isArray(item.options) && item.options.length >= 2)
    : [];
  if (!questions.length) return;

  placeholder.dataset.gbQuizReady = '1';
  placeholder.classList.add('gb-quiz-host');
  const launch = document.createElement('button');
  launch.type = 'button';
  launch.id = 'quizLaunch';
  launch.className = 'quiz-launch';
  launch.textContent = 'Начать проверку';
  const panel = document.createElement('section');
  panel.className = 'quiz-wrapper';
  panel.hidden = true;
  panel.setAttribute('aria-live', 'polite');
  placeholder.replaceChildren(launch, panel);

  let index = 0;
  let score = 0;

  function emitRendered() {
    document.dispatchEvent(new CustomEvent('gb:quiz-rendered', { detail: { root: panel } }));
  }

  function renderResult() {
    const result = resultFor(config, score, questions.length);
    panel.replaceChildren();
    const progress = document.createElement('p');
    progress.className = 'quiz-progress';
    progress.textContent = `Результат: ${score} из ${questions.length}`;
    const title = document.createElement('h3');
    title.id = 'quizQuestion';
    title.textContent = result.title || `${score} из ${questions.length}`;
    const description = document.createElement('p');
    description.className = 'quiz-result-copy';
    description.textContent = result.desc || '';
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'quiz-next';
    again.textContent = 'Пройти ещё раз';
    again.addEventListener('click', () => {
      index = 0;
      score = 0;
      renderQuestion();
    });
    panel.append(progress, title, description, again);
    emitRendered();
  }

  function renderQuestion() {
    if (index >= questions.length) return renderResult();
    const question = questions[index];
    panel.replaceChildren();
    const progress = document.createElement('p');
    progress.className = 'quiz-progress';
    progress.textContent = `Вопрос ${index + 1} из ${questions.length}`;
    const title = document.createElement('h3');
    title.id = 'quizQuestion';
    title.textContent = String(question.question || 'Вопрос');
    const options = document.createElement('div');
    options.className = 'quiz-options';
    options.setAttribute('role', 'group');
    options.setAttribute('aria-labelledby', 'quizQuestion');
    panel.append(progress, title, options);

    question.options.forEach((option, optionIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz-option';
      button.textContent = String(option);
      button.addEventListener('click', () => {
        const correctIndex = Number(question.correct);
        const correct = optionIndex === correctIndex;
        if (correct) score += 1;
        options.querySelectorAll('.quiz-option').forEach((candidate, candidateIndex) => {
          candidate.disabled = true;
          candidate.classList.toggle('is-correct', candidateIndex === correctIndex);
          candidate.classList.toggle('is-incorrect', candidateIndex === optionIndex && !correct);
        });
        const feedback = document.createElement('div');
        feedback.className = `quiz-feedback ${correct ? 'is-correct' : 'is-incorrect'}`;
        const feedbackTitle = document.createElement('strong');
        feedbackTitle.textContent = correct ? 'Верно' : 'Неверно';
        const explanation = document.createElement('p');
        const explanationData = question.explanation;
        explanation.textContent = typeof explanationData === 'string'
          ? explanationData
          : String(explanationData?.short || explanationData?.full || '');
        feedback.append(feedbackTitle, explanation);
        if (question.sourceRef?.href) {
          const source = document.createElement('a');
          source.href = String(question.sourceRef.href);
          source.textContent = String(question.sourceRef.label || 'Вернуться к разделу');
          feedback.appendChild(source);
        }
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'quiz-next';
        next.textContent = index + 1 < questions.length ? 'Следующий вопрос' : 'Показать результат';
        next.addEventListener('click', () => {
          index += 1;
          renderQuestion();
        });
        panel.append(feedback, next);
        next.focus({ preventScroll: true });
        emitRendered();
      }, { once: true });
      options.appendChild(button);
    });
    emitRendered();
  }

  launch.addEventListener('click', () => {
    launch.hidden = true;
    panel.hidden = false;
    renderQuestion();
    panel.scrollIntoView({
      block: 'nearest',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  });
}

export function initQuizzes(scope = document) {
  const root = scope?.querySelectorAll ? scope : document;
  const config = window.SITE_CONFIG?.quiz;
  if (!Array.isArray(config?.questions) || !config.questions.length) return;
  root.querySelectorAll('#quizPlaceholder').forEach((placeholder) => buildQuiz(placeholder, config));
}

export function installArticleQuiz() {
  if (window.GBArticleQuiz?.version === VERSION) return window.GBArticleQuiz;
  initQuizzes(document);
  window.GBArticleQuiz = Object.freeze({ version: VERSION, init: initQuizzes });
  return window.GBArticleQuiz;
}
