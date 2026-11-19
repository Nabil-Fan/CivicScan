import React, { useEffect, useState, useCallback } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { HeroCentered } from './components/hero/HeroCentered';
import { VariablesSection } from './components/narrative/VariablesSection';
import { ThreeLevelsSection } from './components/narrative/ThreeLevelsSection';
import { MapStudio } from './components/studio/MapStudio';
import { MethodologySection } from './components/narrative/MethodologySection';
import { ResultsPage } from './components/results/ResultsPage';
import { CaraKerjaPage } from './components/cara-kerja/CaraKerjaPage';
import { fetchStatus, fetchSpatialPoints } from './services/api';
import { SpatialPoint } from './types/spatial';
import { StatusResponse } from './types/summary';

function getInitialPage(): 'studio' | 'results' | 'cara-kerja' {
  if (typeof window === 'undefined') return 'studio';
  const path = window.location.pathname;
  if (path === '/results') return 'results';
  if (path === '/cara-kerja') return 'cara-kerja';
  return 'studio';
}

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'studio' | 'results' | 'cara-kerja'>(getInitialPage);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [points, setPoints] = useState<SpatialPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<SpatialPoint | null>(null);

  const navigateTo = useCallback((page: 'studio' | 'results' | 'cara-kerja') => {
    setCurrentPage(page);
    const targetPath = page === 'studio' ? '/' : `/${page}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ page }, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(getInitialPage());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    fetchStatus()
      .then((st) => setStatus(st))
      .catch((err) => console.error('Gagal mengambil status:', err));

    fetchSpatialPoints()
      .then((pts) => {
        setPoints(pts);
        if (pts.length > 0) {
          const defaultPt = pts.find((p) => p.name.includes('Fulton')) || pts[0];
          setSelectedPoint(defaultPt);
        }
      })
      .catch((err) => console.error('Gagal mengambil titik spasial:', err));
  }, []);

  const scrollToStudio = () => {
    if (currentPage !== 'studio') {
      navigateTo('studio');
    }
    setTimeout(() => {
      const el = document.getElementById('studio');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const scrollToVariables = () => {
    if (currentPage !== 'studio') {
      navigateTo('studio');
    }
    setTimeout(() => {
      const el = document.getElementById('konteks-masalah');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  return (
    <div className="app-shell">
      <Navbar currentPage={currentPage} setCurrentPage={navigateTo} />

      {currentPage === 'studio' && (
        <main>
          <HeroCentered
            nObs={status?.n_samples ?? 159}
            target={status?.target ?? 'PctBach'}
            deltaAicc={status?.delta_aicc ?? -9.97}
            onExploreMap={scrollToStudio}
            onLearnVariables={scrollToVariables}
            onViewResults={() => navigateTo('results')}
          />

          <VariablesSection />

          <ThreeLevelsSection />

          <MapStudio
            points={points}
            selectedPoint={selectedPoint}
            onSelectPoint={setSelectedPoint}
          />

          <MethodologySection />
        </main>
      )}

      {currentPage === 'results' && <ResultsPage />}

      {currentPage === 'cara-kerja' && <CaraKerjaPage />}

      <Footer />
    </div>
  );
};

export default App;
