import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, AreaChart, Area
} from 'recharts';

const C = { red:'#f04f6e', blue:'#5b8df6', green:'#1dd87a', amber:'#f5a62a', purple:'#a78bfa' };
const MODEL_COLOR = { 'Logistic Regression': C.blue, 'Random Forest': C.green, 'Gradient Boosted Trees': C.red };

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#161622', border:'1px solid rgba(255,255,255,.09)', borderRadius:9, padding:'10px 14px' }}>
      <p style={{ color:'#8888a8', fontSize:'.78rem', marginBottom:4 }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ color:p.color||'#eeeef4', fontSize:'.86rem', fontWeight:500 }}>
          {p.name}: {typeof p.value==='number' ? (p.value<=1 ? (p.value*100).toFixed(1)+'%' : p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard({ data }) {
  const { models, data_stats, elapsed_sec, dataset } = data;
  const best = models.reduce((a,b) => a.auc > b.auc ? a : b);

  const barData = models.map(m => ({
    name:     m.model.includes('Logistic') ? 'LR' : m.model.includes('Random') ? 'RF' : 'GBT',
    AUC:      parseFloat((m.auc*100).toFixed(2)),
    Accuracy: parseFloat((m.accuracy*100).toFixed(2)),
    F1:       parseFloat((m.f1*100).toFixed(2)),
  }));

  const radarData = ['auc','accuracy','f1','precision','recall'].map(k => ({
    metric: k.toUpperCase(),
    LR:  models[0][k],
    RF:  models[1][k],
    GBT: models[2][k],
  }));

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">VitalFlow <span>Analytics</span></h1>
        <p className="page-sub">{dataset} · {data_stats.total.toLocaleString()} patients · Pipeline in {elapsed_sec}s · Apache Spark {best.model} → AUC {(best.auc*100).toFixed(1)}%</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Cohort Size</div>
          <div className="stat-val">{data_stats.total.toLocaleString()}</div>
          <div className="stat-unit">Framingham patients</div>
        </div>
        <div className="stat-card b">
          <div className="stat-label">10-Year CHD</div>
          <div className="stat-val">{data_stats.positive.toLocaleString()}</div>
          <div className="stat-unit">{((data_stats.positive/data_stats.total)*100).toFixed(1)}% prevalence</div>
        </div>
        <div className="stat-card g">
          <div className="stat-label">Best AUC-ROC</div>
          <div className="stat-val">{(best.auc*100).toFixed(1)}<span style={{fontSize:'1rem'}}>%</span></div>
          <div className="stat-unit">{best.model}</div>
        </div>
        <div className="stat-card a">
          <div className="stat-label">Best Accuracy</div>
          <div className="stat-val">{(best.accuracy*100).toFixed(1)}<span style={{fontSize:'1rem'}}>%</span></div>
          <div className="stat-unit">{best.model}</div>
        </div>
        <div className="stat-card p">
          <div className="stat-label">Models Trained</div>
          <div className="stat-val">3</div>
          <div className="stat-unit">LR · RF · GBT</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pipeline Time</div>
          <div className="stat-val">{elapsed_sec}<span style={{fontSize:'1rem'}}>s</span></div>
          <div className="stat-unit">Spark local[*]</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="chart-wrap">
          <div className="card-title">Model Performance Comparison</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
              <XAxis dataKey="name" tick={{fill:'#8888a8',fontSize:12}} axisLine={false} tickLine={false} />
              <YAxis domain={[70,100]} tick={{fill:'#8888a8',fontSize:11}} axisLine={false} tickLine={false} />
              <Tooltip content={<TT />} />
              <Bar dataKey="AUC"      fill={C.red}   radius={[4,4,0,0]} />
              <Bar dataKey="Accuracy" fill={C.blue}  radius={[4,4,0,0]} />
              <Bar dataKey="F1"       fill={C.green} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-wrap">
          <div className="card-title">Multi-Metric Radar</div>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,.06)" />
              <PolarAngleAxis dataKey="metric" tick={{fill:'#8888a8',fontSize:11}} />
              <PolarRadiusAxis angle={30} domain={[0.7,1]} tick={{fill:'#50506a',fontSize:10}} />
              <Radar name="LR"  dataKey="LR"  stroke={C.blue}  fill={C.blue}  fillOpacity={0.12} />
              <Radar name="RF"  dataKey="RF"  stroke={C.green} fill={C.green} fillOpacity={0.12} />
              <Radar name="GBT" dataKey="GBT" stroke={C.red}   fill={C.red}   fillOpacity={0.12} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead><tr>
            <th>Model</th><th>AUC-ROC</th><th>Accuracy</th>
            <th>F1 Score</th><th>Precision</th><th>Recall</th><th>Status</th>
          </tr></thead>
          <tbody>
            {models.map(m => (
              <tr key={m.model}>
                <td style={{fontWeight:700,color:'#eeeef4'}}>{m.model}</td>
                <td className="mono">{(m.auc*100).toFixed(2)}%</td>
                <td className="mono">{(m.accuracy*100).toFixed(2)}%</td>
                <td className="mono">{(m.f1*100).toFixed(2)}%</td>
                <td className="mono">{(m.precision*100).toFixed(2)}%</td>
                <td className="mono">{(m.recall*100).toFixed(2)}%</td>
                <td>{m.model===best.model
                  ? <span className="badge badge-g">★ Best</span>
                  : <span className="badge badge-b">Trained</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
