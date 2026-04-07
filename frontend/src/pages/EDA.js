import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ComposedChart, Line
} from 'recharts';

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#161622', border:'1px solid rgba(255,255,255,.09)', borderRadius:9, padding:'10px 14px' }}>
      <p style={{ color:'#8888a8', fontSize:'.78rem', marginBottom:4 }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ color:p.color||'#eeeef4', fontSize:'.86rem', fontWeight:500 }}>
          {p.name}: {typeof p.value==='number' ? p.value.toFixed(3) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function EDA({ data }) {
  const { eda, age_dist, correlation, data_stats, smoke_dist, bp_dist } = data;
  const [sortMode, setSortMode] = useState('abs');

  const corrData = Object.entries(correlation || {})
    .map(([k,v]) => ({ feature: eda[k]?.label || k, key:k, corr:v, abs:Math.abs(v) }))
    .sort((a,b) => sortMode==='abs' ? b.abs-a.abs : b.corr-a.corr);

  const edaRows = Object.entries(eda || {}).map(([k,v]) => ({ key:k, ...v }));

  const bpData = (bp_dist||[]).map(r => ({
    ...r,
    rate: r.total > 0 ? Math.round(r.chd/r.total*100) : 0
  }));

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Exploratory <span>Analysis</span></h1>
        <p className="page-sub">Framingham Heart Study · Spark DataFrame EDA · {data_stats.total} patients</p>
      </div>

      <div className="stat-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        <div className="stat-card">
          <div className="stat-label">Patients</div>
          <div className="stat-val">{data_stats.total.toLocaleString()}</div>
          <div className="stat-unit">Framingham cohort</div>
        </div>
        <div className="stat-card b">
          <div className="stat-label">Features</div>
          <div className="stat-val">15</div>
          <div className="stat-unit">clinical variables</div>
        </div>
        <div className="stat-card a">
          <div className="stat-label">CHD Rate</div>
          <div className="stat-val">{((data_stats.positive/data_stats.total)*100).toFixed(1)}%</div>
          <div className="stat-unit">10-year positive</div>
        </div>
        <div className="stat-card g">
          <div className="stat-label">Top Predictor</div>
          <div className="stat-val" style={{fontSize:'1.1rem'}}>{corrData[0]?.feature||'—'}</div>
          <div className="stat-unit">r = {corrData[0]?.corr.toFixed(3)}</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="chart-wrap">
          <div className="card-title">Age Distribution & CHD Rate</div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={age_dist||[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
              <XAxis dataKey="group" tick={{fill:'#8888a8',fontSize:12}} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" tick={{fill:'#8888a8',fontSize:11}} axisLine={false} tickLine={false} />
              <YAxis yAxisId="r" orientation="right" tick={{fill:'#8888a8',fontSize:11}} axisLine={false} tickLine={false} />
              <Tooltip content={<TT />} />
              <Bar yAxisId="l" dataKey="total" fill="rgba(91,141,246,.25)" radius={[4,4,0,0]} name="Total" />
              <Bar yAxisId="l" dataKey="chd"   fill="#f04f6e"              radius={[4,4,0,0]} name="CHD" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-wrap">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
            <div className="card-title" style={{marginBottom:0}}>Feature Correlation with 10-Year CHD</div>
            <div style={{display:'flex',gap:6}}>
              {['abs','val'].map(s => (
                <button key={s} onClick={()=>setSortMode(s)}
                  style={{
                    padding:'3px 10px', borderRadius:6, border:'1px solid',
                    borderColor: sortMode===s ? '#f04f6e':'rgba(255,255,255,.08)',
                    background:  sortMode===s ? 'rgba(240,79,110,.12)':'none',
                    color:       sortMode===s ? '#f04f6e':'#8888a8',
                    cursor:'pointer', fontSize:'.72rem', fontWeight:700
                  }}>{s==='abs'?'|r|':'r'}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={corrData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" horizontal={false} />
              <XAxis type="number" domain={[-1,1]} tick={{fill:'#8888a8',fontSize:11}} axisLine={false} />
              <YAxis type="category" dataKey="feature" width={120} tick={{fill:'#8888a8',fontSize:11}} axisLine={false} tickLine={false} />
              <Tooltip content={<TT />} />
              <Bar dataKey="corr" name="Correlation" radius={[0,4,4,0]}>
                {corrData.map((e,i) => <Cell key={i} fill={e.corr>=0?'#f04f6e':'#5b8df6'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid-2">
        <div className="chart-wrap">
          <div className="card-title">Blood Pressure Category vs CHD Risk</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bpData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
              <XAxis dataKey="category" tick={{fill:'#8888a8',fontSize:12}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:'#8888a8',fontSize:11}} axisLine={false} tickLine={false} />
              <Tooltip content={<TT />} />
              <Bar dataKey="total" fill="rgba(91,141,246,.2)" radius={[4,4,0,0]} name="Patients" />
              <Bar dataKey="chd"   fill="#f04f6e"             radius={[4,4,0,0]} name="CHD Events" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-wrap">
          <div className="card-title">Smoking Status vs CHD Events</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={(smoke_dist||[]).map(r=>({...r,label:r.smoker?'Smoker':'Non-Smoker'}))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
              <XAxis dataKey="label" tick={{fill:'#8888a8',fontSize:12}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:'#8888a8',fontSize:11}} axisLine={false} tickLine={false} />
              <Tooltip content={<TT />} />
              <Bar dataKey="total" fill="rgba(29,216,122,.2)" radius={[4,4,0,0]} name="Patients" />
              <Bar dataKey="chd"   fill="#f5a62a"             radius={[4,4,0,0]} name="CHD Events" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead><tr>
            <th>Feature</th><th>Mean</th><th>Std Dev</th><th>Min</th><th>Max</th>
            <th>Correlation</th><th>Impact</th>
          </tr></thead>
          <tbody>
            {edaRows.map(r => {
              const corr = correlation?.[r.key] || 0;
              const abs = Math.abs(corr);
              const impact = abs>0.25?'High':abs>0.12?'Medium':'Low';
              const bc = impact==='High'?'badge-r':impact==='Medium'?'badge-a':'badge-b';
              return (
                <tr key={r.key}>
                  <td style={{fontWeight:700,color:'#eeeef4'}}>{r.label}</td>
                  <td className="mono">{r.mean?.toFixed(2)}</td>
                  <td className="mono">{r.std?.toFixed(2)}</td>
                  <td className="mono">{r.min?.toFixed(2)}</td>
                  <td className="mono">{r.max?.toFixed(2)}</td>
                  <td className="mono" style={{color:corr>0?'#f04f6e':'#5b8df6'}}>{corr.toFixed(4)}</td>
                  <td><span className={`badge ${bc}`}>{impact}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
