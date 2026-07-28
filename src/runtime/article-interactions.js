import { installArticleTooltips } from './article-tooltips.js';
import { installArticleQuiz } from './article-quiz.js';
import { installArticleImageViewer } from './article-image-viewer.js';

const VERSION = 2;

function install() {
  if (window.GBArticleInteractions?.version === VERSION) return;
  const tooltips = installArticleTooltips();
  const quiz = installArticleQuiz();
  const imageViewer = installArticleImageViewer();
  window.GBArticleInteractions = Object.freeze({ version: VERSION, tooltips, quiz, imageViewer });
  document.documentElement.dataset.gbArticleInteractionsReady = '1';
  window.dispatchEvent(new CustomEvent('gb:article-interactions-ready', { detail: { version: VERSION } }));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
