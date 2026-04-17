import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import UnitPage from './pages/UnitPage';
import PeriodicTablePage from './pages/PeriodicTablePage';
import Nav from './components/Nav';
import Footer from './components/Footer';

export default function App() {
  return (
    <BrowserRouter>
      <a href="#main" className="skip-link">Skip to content</a>
      <ScrollToHash />
      <Nav />
      <main id="main">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/unit/:slug" element={<UnitPage />} />
          <Route path="/table" element={<PeriodicTablePage />} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  );
}

function ScrollToHash() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [pathname, hash]);
  return null;
}
