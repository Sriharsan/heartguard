import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

const COLORS = { accent: '#e84b6e', blue: '#4f8ef7', green: '#22d37e', amber: '#f5a623' };

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#18181f', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'10px 14px' }}>
      <p style={{ color:'#9090a8', fontSize:'0.8rem', marginBottom:4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#f0f0f5', fontSize:'0.9rem', fontWeight:500 }}>
          {p.name}: {typeof p.value === 'number' ? (p.value > 1 ? p.value : (p.value*100).toFixed(1)+'%') : p.value}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard({ data }) {
  const { models, data_stats, elapsed_sec } = data;
  const best = models.reduce((a, b) => a.auc > b.auc ? a : b);

  const radarData = [
    { metric: 'AUC',       ...Object.fromEntries(models.map(m => [m.model.split(' ')[0], m.auc])) },
    { metric: 'Accuracy',  ...Object.fromEntries(models.map(m => [m.model.split(' ')[0], m.accuracy])) },
    { metric: 'F1',        ...Object.fromEntries(models.map(m => [m.model.split(' ')[0], m.f1])) },
    { metric: 'Precision', ...Object.fromEntries(models.map(m => [m.model.split(' ')[0], m.precision])) },
    { metric: 'Recall',    ...Object.fromEntries(models.map(m => [m.model.split(' ')[0], m.recall])) },
  ];

  const barData = models.map(m => ({
    name:     m.model.includes('Logistic') ? 'LR' : m.model.includes('Random') ? 'RF' : 'GBT',
    AUC:      m.auc,
    Accuracy: m.accuracy,
    F1:       m.f1,
  }));

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">HeartGuard <span>Analytics</span></h1>
        <p className="page-sub">
          Apache Spark BDA · {data_stats.total.toLocaleString()} patients · Pipeline ran in {elapsed_sec}s
        </p>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Patients</div>
          <div className="stat-value">{data_stats.total.toLocaleString()}</div>
          <div className="stat-unit">UCI Heart Disease</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Disease Positive</div>
          <div className="stat-value">{data_stats.positive}</div>
          <div className="stat-unit">{((data_stats.positive/data_stats.total)*100).toFixed(1)}% prevalence</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Best AUC</div>
          <div className="stat-value">{(best.auc * 100).toFixed(1)}<span style={{fontSize:'1rem'}}>%</span></div>
          <div className="stat-unit">{best.model}</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Best Accuracy</div>
          <div className="stat-value">{(best.accuracy * 100).toFixed(1)}<span style={{fontSize:'1rem'}}>%</span></div>
          <div className="stat-unit">{best.model}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Models Trained</div>
          <div className="stat-value">{models.length}</div>
          <div className="stat-unit">LR · RF · GBT</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Pipeline Time</div>
          <div className="stat-value">{elapsed_sec}<span style={{fontSize:'1rem'}}>s</span></div>
          <div className="stat-unit">Spark local[*]</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Bar chart */}
        <div className="chart-wrap">
          <div className="card-title">Model Performance Comparison</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill:'#9090a8', fontSize:12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0.7, 1]} tick={{ fill:'#9090a8', fontSize:12 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TT />} />
              <Bar dataKey="AUC"      fill={COLORS.accent} radius={[4,4,0,0]} />
              <Bar dataKey="Accuracy" fill={COLORS.blue}   radius={[4,4,0,0]} />
              <Bar dataKey="F1"       fill={COLORS.green}  radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar */}
        <div className="chart-wrap">
          <div className="card-title">Multi-Metric Radar</div>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.07)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill:'#9090a8', fontSize:12 }} />
              <PolarRadiusAxis angle={30} domain={[0.7, 1]} tick={{ fill:'#5a5a72', fontSize:10 }} />
              <Radar name="LR"  dataKey="Logistic" stroke={COLORS.blue}   fill={COLORS.blue}   fillOpacity={0.15} />
              <Radar name="RF"  dataKey="Random"   stroke={COLORS.green}  fill={COLORS.green}  fillOpacity={0.15} />
              <Radar name="GBT" dataKey="Gradient" stroke={COLORS.accent} fill={COLORS.accent} fillOpacity={0.15} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick model table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Model</th><th>AUC-ROC</th><th>Accuracy</th>
              <th>F1 Score</th><th>Precision</th><th>Recall</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {models.map(m => (
              <tr key={m.model}>
                <td style={{fontWeight:600, color:'#f0f0f5'}}>{m.model}</td>
                <td className="td-value">{(m.auc*100).toFixed(2)}%</td>
                <td className="td-value">{(m.accuracy*100).toFixed(2)}%</td>
                <td className="td-value">{(m.f1*100).toFixed(2)}%</td>
                <td className="td-value">{(m.precision*100).toFixed(2)}%</td>
                <td className="td-value">{(m.recall*100).toFixed(2)}%</td>
                <td>
                  {m.model === best.model
                    ? <span className="badge badge-green">★ Best</span>
                    : <span className="badge badge-blue">Trained</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
