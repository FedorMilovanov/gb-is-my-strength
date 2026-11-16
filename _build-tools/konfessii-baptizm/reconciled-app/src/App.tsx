import ScrollProgress from './components/ScrollProgress';
import ScrollToTop from './components/ScrollToTop';
import Archives from './components/Archives';
import Comparison from './components/Comparison';
import Congresses from './components/Congresses';
import Footer from './components/Footer';
import Glossary from './components/Glossary';
import Hero from './components/Hero';
import KeyFigures from './components/KeyFigures';
import LegalContext from './components/LegalContext';
import MindMapLauncher from './components/MindMapLauncher';
import Navigation from './components/Navigation';
import Organizations from './components/Organizations';
import ParallelTimelines from './components/ParallelTimelines';
import PersecutionHeatmap from './components/PersecutionHeatmap';
import QuizHub from './components/QuizHub';
import RegionalMapNotes from './components/RegionalMapNotes';
import ResearchFindings from './components/ResearchFindings';
import { useTheme } from './components/ThemeContext';
import ThreeOrigins from './components/ThreeOrigins';
import Timeline from './components/Timeline';
import UnresolvedQuestions from './components/UnresolvedQuestions';

export default function App() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <div className={`relative min-h-screen transition-colors duration-700 ${isLight ? 'theme-light' : 'theme-dark'}`}>
      <ScrollProgress />
      <Navigation />
      <main className="pb-32">
        <Hero />
        <ThreeOrigins />
        <MindMapLauncher />
        <RegionalMapNotes />
        <Timeline />
        <Congresses />
        <LegalContext />
        <ParallelTimelines />
        <PersecutionHeatmap />
        <Organizations />
        <KeyFigures />
        <ResearchFindings />
        <Archives />
        <UnresolvedQuestions />
        <Comparison />
        <Glossary />
        <QuizHub />
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  );
}
