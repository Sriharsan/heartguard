import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, ReferenceLine
} from 'recharts';

const COLORS = { accent:'#e84b6e', blue:'#4f8ef7', green:'#22d37e', amber:'#f5a623' };
const MODEL_COLORS = {
  'Logistic Regression': COLORS.blue,
  'Random Forest':        COLORS.green,
  'Gradient Boosted Trees': COLORS.accent,
};

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#18181f', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'10px 14px' }}>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#f0f0f5', fontSize:'0.85rem' }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(4) : p.value}
        </p>
      ))}
    </div>
  );
};

function ConfusionMatrix({ m }) {
  const { tp, tn, fp, fn } = m.confusion;
  const total = tp + tn + fp + fn;
  const cells = [
    { label:'TN', val:tn, color:COLORS.green,  sub:'True Negative' },
    { label:'FP', val:fp, color:COLORS.amber,  sub:'False Positive' },
    { label:'FN', val:fn, color:COLORS.amber,  sub:'False Negative' },
    { label:'TP', val:tp, color:COLORS.accent, sub:'True Positive' },
  ];
  return (
    <div>
      <div className="card-title">Confusion Matrix</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        {cells.map(c => (
          <div key={c.label} style={{
            background:'var(--bg3)', borderRadius:10, padding:'16px',
            border:`1px solid ${c.color}33`, textAlign:'center'
          }}>
            <div style={{ fontSize:'1.8rem', fontWeight:700, color:c.color }}>{c.val}</div>
            <div style={{ fontSize:'0.7rem', color:'#9090a8', marginTop:4 }}>{c.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:12, fontSize:'0.8rem', color:'#9090a8', textAlign:'center' }}>
        Total: {total} samples
      </div>
    </div>
  );
}

export default function Models({ data }) {
  const { models, roc_curves, feature_importance } = data;
  const [activeModel, setActiveModel] = useState(models[2]); // GBT

  const fiData = (feature_importance['Gradient Boosted Trees'] || [])
    .sort((a,b) => b.importance - a.importance)
    .slice(0, 10);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Model <span>Evaluation</span></h1>
        <p className="page-sub">ROC curves · Confusion matrices · Feature importance from Spark MLlib</p>
      </div>

      {/* Model selector cards */}
      <div className="model-cards">
        {models.map((m, i) => (
          <div
            key={m.model}
            className={`model-card ${activeModel.model === m.model ? 'best' : ''}`}
            onClick={() => setActiveModel(m)}
            style={{ cursor:'pointer' }}
          >
            <div className="model-name" style={{ color: Object.values(MODEL_COLORS)[i] }}>
              {m.model}
            </div>
            {['auc','accuracy','f1','precision','recall'].map(k => (
              <div className="metric-row" key={k}>
                <span className="metric-key">{k.toUpperCase()}</span>
                <span className="metric-val">{(m[k]*100).toFixed(2)}%</span>
              </div>
            ))}
            {activeModel.model === m.model &&
              <div style={{ marginTop:12 }}>
                <span className="badge badge-green">● Selected</span>
              </div>}
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* ROC Curves */}
        <div className="chart-wrap">
          <div className="card-title">ROC Curves — All Models</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="fpr" type="number" domain={[0,1]}
                tick={{ fill:'#9090a8', fontSize:11 }} label={{ value:'FPR', position:'insideBottom', fill:'#9090a8', fontSize:11 }} />
              <YAxis type="number" domain={[0,1]}
                tick={{ fill:'#9090a8', fontSize:11 }} label={{ value:'TPR', angle:-90, position:'insideLeft', fill:'#9090a8', fontSize:11 }} />
              <Tooltip content={<TT />} />
              <ReferenceLine segment={[{x:0,y:0},{x:1,y:1}]} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
              {Object.entries(roc_curves || {}).map(([name, pts]) => (
                <Line
                  key={name} data={pts} dataKey="tpr" type="monotone"
                  stroke={MODEL_COLORS[name] || COLORS.blue}
                  dot={false} strokeWidth={2} name={name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', gap:16, marginTop:8, flexWrap:'wrap' }}>
            {models.map(m => (
              <div key={m.model} style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.78rem', color:'#9090a8' }}>
                <div style={{ width:20, height:2, background: MODEL_COLORS[m.model], borderRadius:1 }}></div>
                {m.model.split(' ')[0]} (AUC={m.auc.toFixed(4)})
              </div>
            ))}
          </div>
        </div>

        {/* Confusion matrix */}
        <div className="chart-wrap">
          <ConfusionMatrix m={activeModel} />
          <div style={{ marginTop:20 }}>
            <div className="card-title">Derived Metrics</div>
            {[
              { label:'Sensitivity (TPR)', val: activeModel.confusion.tp / (activeModel.confusion.tp + activeModel.confusion.fn || 1) },
              { label:'Specificity (TNR)', val: activeModel.confusion.tn / (activeModel.confusion.tn + activeModel.confusion.fp || 1) },
              { label:'PPV (Precision)',   val: activeModel.confusion.tp / (activeModel.confusion.tp + activeModel.confusion.fp || 1) },
              { label:'NPV',               val: activeModel.confusion.tn / (activeModel.confusion.tn + activeModel.confusion.fn || 1) },
            ].map(({ label, val }) => (
              <div key={label} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', marginBottom:4 }}>
                  <span style={{ color:'#9090a8' }}>{label}</span>
                  <span style={{ color:'#f0f0f5', fontFamily:'DM Mono, monospace', fontWeight:500 }}>
                    {(val*100).toFixed(2)}%
                  </span>
                </div>
                <div className="meter-bar">
                  <div className="meter-fill" style={{ width:`${val*100}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature importance */}
      <div className="chart-wrap">
        <div className="card-title">Feature Importance — Gradient Boosted Trees (Spark GBTClassifier)</div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={fiData} layout="vertical" margin={{ left:20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" tick={{ fill:'#9090a8', fontSize:11 }} axisLine={false} />
            <YAxis type="category" dataKey="feature" width={130}
              tick={{ fill:'#9090a8', fontSize:12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<TT />} />
            <Bar dataKey="importance" fill={COLORS.accent} radius={[0,4,4,0]} name="Importance" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
