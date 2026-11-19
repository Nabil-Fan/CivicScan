import React from 'react';

interface NavbarProps {
  currentPage: 'studio' | 'results' | 'cara-kerja';
  setCurrentPage: (page: 'studio' | 'results' | 'cara-kerja') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, setCurrentPage }) => {
  return (
    <header className="nav">
      <div className="container nav-in">
        <a
          href="#studio"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setCurrentPage('studio');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          CivicScan
        </a>

        <nav className="nav-links">
          <button
            type="button"
            className={`btn-link ${currentPage === 'studio' ? 'font-bold text-indigo' : ''}`}
            onClick={() => {
              setCurrentPage('studio');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
          >
            Studio Peta
          </button>
          <button
            type="button"
            className={`btn-link ${currentPage === 'results' ? 'font-bold text-indigo' : ''}`}
            onClick={() => {
              setCurrentPage('results');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
          >
            Hasil & Paper
          </button>
          <button
            type="button"
            className={`btn-link ${currentPage === 'cara-kerja' ? 'font-bold text-indigo' : ''}`}
            onClick={() => {
              setCurrentPage('cara-kerja');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
          >
            Cara Kerja
          </button>
        </nav>
      </div>
    </header>
  );
};
