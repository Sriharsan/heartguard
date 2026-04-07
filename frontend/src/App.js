import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import Models    from './pages/Models';
import EDA       from './pages/EDA';
import Predict   from './pages/Predict';
import './App.css';

export default function App() {
  const [page, setPage]     = useState('dashboard');
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/results')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const tabs = [
    { id: 'dashboard', label: 'Overview',   icon: '◈' },
    { id: 'models',    label: 'Models',     icon: '◉' },
    { id: 'eda',       label: 'Analytics',  icon: '◐' },
    { id: 'predict',   label: 'Risk Score', icon: '◎' },
  ];

  const renderPage = () => {
    if (loading) return <div className="center"><div className="spinner"/><p className="load-txt">Connecting to Spark pipeline...</p></div>;
    if (!data)   return <div className="center"><p style={{color:'#ef4444'}}>⚠ API offline — run: <code>bash run.sh api</code></p></div>;
    switch (page) {
      case 'dashboard': return <Dashboard data={data} />;
      case 'models':    return <Models    data={data} />;
      case 'eda':       return <EDA       data={data} />;
      case 'predict':   return <Predict />;
      default:          return <Dashboard data={data} />;
    }
  };

  return (
    <>
      <nav className="nav">
        <div className="nav-brand">
          <div className="brand-pulse">♥</div>
          <span className="brand-name">VitalFlow</span>
          <span className="brand-tag">CVD · SPARK</span>
        </div>
        <div className="nav-links">
          {tabs.map(t => (
            <button key={t.id} className={`nav-btn ${page===t.id?'active':''}`}
              onClick={() => setPage(t.id)}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        <div className="nav-status">
          <div className={`dot ${data?'ok':'err'}`}/>
          <span>{data ? 'Live' : 'Offline'}</span>
        </div>
      </nav>
      <main className="main">{renderPage()}</main>
    </>
  );
}
