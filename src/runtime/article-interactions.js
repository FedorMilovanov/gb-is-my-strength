import './article-tooltips.css';
import './article-capabilities.css';
import { installArticleTooltips } from './article-tooltips.js';
import { installArticleQuiz } from './article-quiz.js';
import { installArticleImageViewer } from './article-image-viewer.js';
import { installArticleStrategicMap } from './article-strategic-map.js';
import { installArticleFaqAccordions } from './article-faq-accordion.js';
import { installArticleHeadingAnchors } from './article-heading-anchors.js';
import { installArticleReversibleCards } from './article-reversible-cards.js';

const VERSION = 3;

function install() {
  if (window.GBArticleInteractions?.version === VERSION) return;
  const tooltips = installArticleTooltips();
  const quiz = installArticleQuiz();
  const imageViewer = installArticleImageViewer();
  const strategicMap = installArticleStrategicMap();
  const faq = installArticleFaqAccordions();
  const headingAnchors = installArticleHeadingAnchors();
  const reversibleCards = installArticleReversibleCards();
  window.GBArticleInteractions = Object.freeze({
    version: VERSION,
    tooltips,
    quiz,
    imageViewer,
    strategicMap,
    faq,
    headingAnchors,
    reversibleCards,
  });
  document.documentElement.dataset.gbArticleInteractionsReady = '1';
  window.dispatchEvent(new CustomEvent('gb:article-interactions-ready', { detail: { version: VERSION } }));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
