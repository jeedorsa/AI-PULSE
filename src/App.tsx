/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import LandingPage from './pages/LandingPage';
import GatePage from './pages/GatePage';
import AssessmentPage from './pages/AssessmentPage';
import CheckpointPage from './pages/CheckpointPage';
import ProcessingPage from './pages/ProcessingPage';
import ResultPage from './pages/ResultPage';

const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ 
        duration: 0.3, 
        ease: 'easeOut',
        exit: { duration: 0.2 } 
      }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
};

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><LandingPage /></PageWrapper>} />
        <Route path="/gate" element={<PageWrapper><GatePage /></PageWrapper>} />
        <Route path="/assessment" element={<PageWrapper><AssessmentPage /></PageWrapper>} />
        <Route path="/checkpoint/:id" element={<PageWrapper><CheckpointPage /></PageWrapper>} />
        <Route path="/processing" element={<PageWrapper><ProcessingPage /></PageWrapper>} />
        <Route path="/result" element={<PageWrapper><ResultPage /></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
};

export default function App() {
  return (
    <Router>
      <AnimatedRoutes />
    </Router>
  );
}
