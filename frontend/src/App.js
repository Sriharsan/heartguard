import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import Predict from './pages/Predict';
import Models from './pages/Models';
import EDA from './pages/EDA';
import './App.css';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/results')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const pages = [
    { id: 'dashboard', label: 'Overview',   icon: '◈' },
    { id: 'models',    label: 'Models',     icon: '◉' },
    { id: 'eda',       label: 'Analytics',  icon: '◐' },
    { id: 'predict',   label: 'Predict',    icon: '◎' },
  ];

  const renderPage = () => {
    if (loading) return <Loader />;
    if (!data)   return <Error />;
    switch (page) {
      case 'dashboard': return <Dashboard data={data} />;
      case 'models':    return <Models    data={data} />;
      case 'eda':       return <EDA       data={data} />;
      case 'predict':   return <Predict />;
      default:          return <Dashboard data={data} />;
    }
  };

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-brand">
          <span className="brand-icon">♥</span>
          <span className="brand-name">HeartGuard</span>
          <span className="brand-sub">BDA · Spark</span>
        </div>
        <div className="nav-links">
          {pages.map(p => (
            <button
              key={p.id}
              className={`nav-btn ${page === p.id ? 'active' : ''}`}
              onClick={() => setPage(p.id)}
            >
              <span className="nav-icon">{p.icon}</span>
              {p.label}
            </button>
          ))}
        </div>
        <div className="nav-status">
          <span className={`status-dot ${data ? 'ok' : 'err'}`}></span>
          <span className="status-text">{data ? 'Pipeline Ready' : 'Offline'}</span>
        </div>
      </nav>
      <main className="main">
        {renderPage()}
      </main>
    </div>
  );
}

function Loader() {
  return (
    <div className="center-screen">
      <div className="pulse-ring"></div>
      <p className="loading-text">Initializing Spark Pipeline...</p>
    </div>
  );
}

function Error() {
  return (
    <div className="center-screen">
      <p style={{color:'#ef4444', fontSize:'1.1rem'}}>
        ⚠ API offline. Run: <code>python api/main.py</code>
      </p>
    </div>
  );
}
