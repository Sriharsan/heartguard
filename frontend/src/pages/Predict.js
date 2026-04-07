import React, { useState } from 'react';

const FIELDS = [
  { key:'age',      label:'Age',                      type:'number', min:20, max:90,  step:1,   default:55,   unit:'years' },
  { key:'sex',      label:'Sex',                      type:'select', options:[['1','Male'],['0','Female']], default:'1' },
  { key:'cp',       label:'Chest Pain Type',          type:'select',
    options:[['0','Typical Angina'],['1','Atypical Angina'],['2','Non-anginal'],['3','Asymptomatic']], default:'0' },
  { key:'trestbps', label:'Resting Blood Pressure',   type:'number', min:80,  max:220, step:1,   default:130,  unit:'mmHg' },
  { key:'chol',     label:'Serum Cholesterol',        type:'number', min:100, max:600, step:1,   default:250,  unit:'mg/dl' },
  { key:'fbs',      label:'Fasting Blood Sugar >120', type:'select', options:[['0','No'],['1','Yes']], default:'0' },
  { key:'restecg',  label:'Resting ECG',              type:'select',
    options:[['0','Normal'],['1','ST-T Abnormality'],['2','Left Ventricular Hypertrophy']], default:'0' },
  { key:'thalach',  label:'Max Heart Rate Achieved',  type:'number', min:60,  max:210, step:1,   default:150,  unit:'bpm' },
  { key:'exang',    label:'Exercise-Induced Angina',  type:'select', options:[['0','No'],['1','Yes']], default:'0' },
  { key:'oldpeak',  label:'ST Depression (oldpeak)',  type:'number', min:0,   max:7,   step:0.1, default:1.0,  unit:'mm' },
  { key:'slope',    label:'ST Slope',                 type:'select',
    options:[['0','Upsloping'],['1','Flat'],['2','Downsloping']], default:'1' },
  { key:'ca',       label:'Major Vessels (Fluoro)',   type:'select', options:[['0','0'],['1','1'],['2','2'],['3','3'],['4','4']], default:'0' },
  { key:'thal',     label:'Thalassemia',              type:'select',
    options:[['3','Normal'],['6','Fixed Defect'],['7','Reversible Defect']], default:'3' },
];

const RISK_SAMPLES = [
  {
    label: 'High Risk Patient', color: '#ef4444',
    values: { age:67, sex:1, cp:0, trestbps:160, chol:286, fbs:0, restecg:2, thalach:108, exang:1, oldpeak:1.5, slope:1, ca:3, thal:7 }
  },
  {
    label: 'Low Risk Patient', color: '#22d37e',
    values: { age:38, sex:0, cp:2, trestbps:120, chol:190, fbs:0, restecg:0, thalach:180, exang:0, oldpeak:0, slope:0, ca:0, thal:3 }
  },
  {
    label: 'Moderate Risk', color: '#f5a623',
    values: { age:55, sex:1, cp:1, trestbps:140, chol:260, fbs:1, restecg:1, thalach:145, exang:0, oldpeak:1.5, slope:1, ca:1, thal:3 }
  },
];

export default function Predict() {
  const [form, setForm]     = useState(Object.fromEntries(FIELDS.map(f => [f.key, f.default])));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const loadSample = (sample) => {
    setForm(Object.fromEntries(
      Object.entries(sample.values).map(([k, v]) => [k, String(v)])
    ));
    setResult(null);
  };

  const predict = async () => {
    setLoading(true);
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k,v]) => [k, parseFloat(v)]));
      const res  = await fetch('/api/predict', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ error: 'API unreachable. Start: python api/main.py' });
    }
    setLoading(false);
  };

  const impactColor = { high:'#ef4444', medium:'#f5a623', low:'#4f8ef7' };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Live <span>Prediction</span></h1>
        <p className="page-sub">Enter patient clinical data · GBT-calibrated risk model · Real-time inference</p>
      </div>

      {/* Sample patients */}
      <div style={{ display:'flex', gap:10, marginBottom:28, flexWrap:'wrap' }}>
        <span style={{ fontSize:'0.8rem', color:'#5a5a72', alignSelf:'center', fontWeight:600 }}>LOAD SAMPLE:</span>
        {RISK_SAMPLES.map(s => (
          <button key={s.label} onClick={() => loadSample(s)}
            style={{
              padding:'7px 16px', borderRadius:8, border:`1px solid ${s.color}44`,
              background:`${s.color}11`, color:s.color,
              cursor:'pointer', fontSize:'0.83rem', fontWeight:600, fontFamily:'DM Sans, sans-serif'
            }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="chart-wrap">
        <div className="predict-grid">
          {FIELDS.map(f => (
            <div className="field" key={f.key}>
              <label>
                {f.label}
                {f.unit && <span style={{ color:'#5a5a72', marginLeft:6, fontWeight:400 }}>({f.unit})</span>}
              </label>
              {f.type === 'select' ? (
                <select value={form[f.key]} onChange={e => handleChange(f.key, e.target.value)}>
                  {f.options.map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
                </select>
              ) : (
                <input
                  type="number" min={f.min} max={f.max} step={f.step}
                  value={form[f.key]}
                  onChange={e => handleChange(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        <button className="btn-primary" onClick={predict} disabled={loading}>
          {loading ? '⟳ Computing...' : '◎ Analyze Risk'}
        </button>
      </div>

      {/* Result */}
      {result && !result.error && (
        <div className="risk-card">
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
            <div style={{ fontSize:'0.75rem', fontWeight:600, letterSpacing:'0.1em',
              color:'#5a5a72', textTransform:'uppercase', marginBottom:12 }}>
              Heart Disease Risk Score
            </div>
            <div className="risk-score" style={{ color: result.risk_color }}>
              {result.percentage}<span style={{ fontSize:'2rem' }}>%</span>
            </div>
            <div className="risk-label" style={{ color: result.risk_color }}>
              {result.risk_label}
            </div>

            {/* Meter */}
            <div className="risk-meter" style={{ width:340, marginTop:24 }}>
              <div className="risk-needle" style={{ left:`${result.percentage}%` }}></div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', width:340,
              fontSize:'0.72rem', color:'#5a5a72', marginTop:4 }}>
              <span>Low</span><span>Moderate</span><span>High</span>
            </div>

            {/* Probability bar */}
            <div style={{ width:340, marginTop:20 }}>
              <div className="meter-bar" style={{ height:10 }}>
                <div className="meter-fill" style={{
                  width:`${result.percentage}%`,
                  background: result.risk_color,
                  transition:'width 1s cubic-bezier(0.34,1.56,0.64,1)'
                }}></div>
              </div>
            </div>

            {/* Contributing factors */}
            {result.factors?.length > 0 && (
              <div style={{ marginTop:28, width:'100%', maxWidth:500 }}>
                <div style={{ fontSize:'0.72rem', fontWeight:600, letterSpacing:'0.1em',
                  color:'#5a5a72', textTransform:'uppercase', marginBottom:14, textAlign:'center' }}>
                  Key Risk Factors
                </div>
                <div className="risk-factors">
                  {result.factors.map((f, i) => (
                    <span key={i} className="badge"
                      style={{
                        background: `${impactColor[f.impact]}15`,
                        color:      impactColor[f.impact],
                        border:     `1px solid ${impactColor[f.impact]}30`
                      }}>
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Confidence indicator */}
            <div style={{ marginTop:24, padding:'14px 24px', borderRadius:10,
              background:'var(--bg3)', border:'1px solid var(--border)', maxWidth:400 }}>
              <p style={{ fontSize:'0.8rem', color:'#9090a8', lineHeight:1.6 }}>
                This prediction is based on a calibrated ensemble model trained on{' '}
                <strong style={{ color:'#f0f0f5' }}>1,025 patients</strong> using{' '}
                <strong style={{ color:'#f0f0f5' }}>Apache Spark GBTClassifier</strong>.
                Not a substitute for clinical diagnosis.
              </p>
            </div>
          </div>
        </div>
      )}

      {result?.error && (
        <div style={{ marginTop:20, padding:20, background:'rgba(239,68,68,0.1)',
          border:'1px solid rgba(239,68,68,0.3)', borderRadius:12, color:'#ef4444' }}>
          ⚠ {result.error}
        </div>
      )}
    </div>
  );
}
