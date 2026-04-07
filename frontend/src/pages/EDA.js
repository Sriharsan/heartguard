import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ScatterChart, Scatter, Cell
} from 'recharts';

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#18181f', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'10px 14px' }}>
      <p style={{ color:'#9090a8', fontSize:'0.8rem', marginBottom:4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#f0f0f5', fontSize:'0.88rem', fontWeight:500 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed ? p.value.toFixed(3) : p.value : p.value}
        </p>
      ))}
    </div>
  );
};

const FEATURE_LABELS = {
  age:'Age', sex:'Sex', cp:'Chest Pain', trestbps:'Resting BP', chol:'Cholesterol',
  fbs:'Fasting BS', restecg:'Rest ECG', thalach:'Max HR', exang:'Ex Angina',
  oldpeak:'ST Depression', slope:'ST Slope', ca:'Vessels', thal:'Thalassemia'
};

export default function EDA({ data }) {
  const { eda, age_dist, correlation, data_stats } = data;
  const [sortBy, setSortBy] = useState('abs');

  const corrData = Object.entries(correlation || {})
    .map(([k, v]) => ({ feature: FEATURE_LABELS[k] || k, key: k, corr: v, abs: Math.abs(v) }))
    .sort((a,b) => sortBy === 'abs' ? b.abs - a.abs : b.corr - a.corr);

  const edaRows = Object.entries(eda || {}).map(([k, v]) => ({ key:k, ...v }));

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Exploratory <span>Analysis</span></h1>
        <p className="page-sub">
          Descriptive statistics · Age distribution · Feature correlations — computed via Spark DataFrame API
        </p>
      </div>

      {/* Data overview */}
      <div className="stat-grid" style={{ gridTemplateColumns:'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">Dataset</div>
          <div className="stat-value">{data_stats.total}</div>
          <div className="stat-unit">patients</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Features</div>
          <div className="stat-value">13</div>
          <div className="stat-unit">clinical variables</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Prevalence</div>
          <div className="stat-value">{((data_stats.positive/data_stats.total)*100).toFixed(1)}%</div>
          <div className="stat-unit">heart disease</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Top Predictor</div>
          <div className="stat-value" style={{ fontSize:'1.1rem' }}>
            {corrData[0]?.feature || '—'}
          </div>
          <div className="stat-unit">r = {corrData[0]?.corr.toFixed(3)}</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Age distribution */}
        <div className="chart-wrap">
          <div className="card-title">Age Distribution & Disease Rate</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={age_dist || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="group" tick={{ fill:'#9090a8', fontSize:12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#9090a8', fontSize:12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TT />} />
              <Bar dataKey="total"   fill="rgba(79,142,247,0.3)"  radius={[4,4,0,0]} name="Total" />
              <Bar dataKey="disease" fill="#e84b6e"               radius={[4,4,0,0]} name="Disease" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Correlation bar */}
        <div className="chart-wrap">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div className="card-title" style={{ marginBottom:0 }}>Feature Correlation with Target</div>
            <div style={{ display:'flex', gap:6 }}>
              {['abs','val'].map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  style={{
                    padding:'4px 12px', borderRadius:6, border:'1px solid',
                    borderColor: sortBy===s ? '#e84b6e' : 'rgba(255,255,255,0.1)',
                    background:  sortBy===s ? 'rgba(232,75,110,0.15)' : 'none',
                    color:       sortBy===s ? '#e84b6e' : '#9090a8',
                    cursor:'pointer', fontSize:'0.75rem', fontWeight:600
                  }}>
                  {s === 'abs' ? '|r|' : 'r'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={corrData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" domain={[-1,1]} tick={{ fill:'#9090a8', fontSize:11 }} axisLine={false} />
              <YAxis type="category" dataKey="feature" width={100}
                tick={{ fill:'#9090a8', fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TT />} />
              <Bar dataKey="corr" name="Correlation" radius={[0,4,4,0]}>
                {corrData.map((entry, i) => (
                  <Cell key={i} fill={entry.corr >= 0 ? '#e84b6e' : '#4f8ef7'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Descriptive stats table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Feature</th><th>Mean</th><th>Std Dev</th><th>Min</th><th>Max</th>
              <th>Corr w/ Target</th><th>Impact</th>
            </tr>
          </thead>
          <tbody>
            {edaRows.map(r => {
              const corr = correlation?.[r.key] || 0;
              const absCorr = Math.abs(corr);
              const impact = absCorr > 0.3 ? 'High' : absCorr > 0.15 ? 'Medium' : 'Low';
              const badgeCls = impact === 'High' ? 'badge-red' : impact === 'Medium' ? 'badge-amber' : 'badge-blue';
              return (
                <tr key={r.key}>
                  <td style={{ fontWeight:600, color:'#f0f0f5' }}>{r.label}</td>
                  <td className="td-value">{r.mean.toFixed(2)}</td>
                  <td className="td-value">{r.std.toFixed(2)}</td>
                  <td className="td-value">{r.min.toFixed(2)}</td>
                  <td className="td-value">{r.max.toFixed(2)}</td>
                  <td className="td-value" style={{ color: corr > 0 ? '#e84b6e' : '#4f8ef7' }}>
                    {corr.toFixed(4)}
                  </td>
                  <td><span className={`badge ${badgeCls}`}>{impact}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
