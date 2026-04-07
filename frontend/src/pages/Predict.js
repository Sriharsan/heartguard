import React, { useState } from 'react';

const FIELDS = [
  { key:'age',             label:'Age',                type:'number', min:32, max:70,  step:1,   default:52,  unit:'years' },
  { key:'male',            label:'Sex',                type:'select', options:[['1','Male'],['0','Female']], default:'1' },
  { key:'education',       label:'Education Level',    type:'select', options:[['1','Some HS'],['2','HS/GED'],['3','Some College'],['4','College+']], default:'2' },
  { key:'currentSmoker',   label:'Current Smoker',     type:'select', options:[['0','No'],['1','Yes']], default:'0' },
  { key:'cigsPerDay',      label:'Cigarettes / Day',   type:'number', min:0, max:60,   step:1,   default:0,   unit:'cigs' },
  { key:'BPMeds',          label:'BP Medication',      type:'select', options:[['0','No'],['1','Yes']], default:'0' },
  { key:'prevalentStroke', label:'Prior Stroke',       type:'select', options:[['0','No'],['1','Yes']], default:'0' },
  { key:'prevalentHyp',    label:'Hypertension',       type:'select', options:[['0','No'],['1','Yes']], default:'0' },
  { key:'diabetes',        label:'Diabetes',           type:'select', options:[['0','No'],['1','Yes']], default:'0' },
  { key:'totChol',         label:'Total Cholesterol',  type:'number', min:110, max:400, step:1,  default:230, unit:'mg/dL' },
  { key:'sysBP',           label:'Systolic BP',        type:'number', min:90,  max:220, step:1,  default:128, unit:'mmHg' },
  { key:'diaBP',           label:'Diastolic BP',       type:'number', min:55,  max:140, step:1,  default:82,  unit:'mmHg' },
  { key:'BMI',             label:'BMI',                type:'number', min:16,  max:55,  step:0.1,default:27,  unit:'kg/m²' },
  { key:'heartRate',       label:'Resting Heart Rate', type:'number', min:44,  max:140, step:1,  default:74,  unit:'bpm' },
  { key:'glucose',         label:'Fasting Glucose',    type:'number', min:50,  max:400, step:1,  default:85,  unit:'mg/dL' },
];

const SAMPLES = [
  {
    label:'High Risk', color:'#ef4444',
    values:{ age:64, male:1, education:1, currentSmoker:1, cigsPerDay:20, BPMeds:1,
             prevalentStroke:0, prevalentHyp:1, diabetes:1, totChol:280, sysBP:158,
             diaBP:96, BMI:32, heartRate:88, glucose:145 }
  },
  {
    label:'Low Risk', color:'#1dd87a',
    values:{ age:38, male:0, education:4, currentSmoker:0, cigsPerDay:0, BPMeds:0,
             prevalentStroke:0, prevalentHyp:0, diabetes:0, totChol:185, sysBP:112,
             diaBP:72, BMI:22, heartRate:64, glucose:76 }
  },
  {
    label:'Moderate Risk', color:'#f5a62a',
    values:{ age:54, male:1, education:2, currentSmoker:1, cigsPerDay:10, BPMeds:0,
             prevalentStroke:0, prevalentHyp:1, diabetes:0, totChol:245, sysBP:138,
             diaBP:88, BMI:28, heartRate:78, glucose:98 }
  },
];

const IMP = { high:'#ef4444', medium:'#f5a62a', low:'#5b8df6' };

export default function Predict() {
  const [form,    setForm]    = useState(Object.fromEntries(FIELDS.map(f => [f.key, String(f.default)])));
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);

  const loadSample = s => {
    setForm(Object.fromEntries(Object.entries(s.values).map(([k,v]) => [k, String(v)])));
    setResult(null);
  };

  const analyze = async () => {
    setLoading(true);
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k,v]) => [k, parseFloat(v)]));
      const res  = await fetch('/api/predict', { method:'POST',
        headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      setResult(await res.json());
    } catch {
      setResult({ error: 'API unreachable. Start backend: bash run.sh api' });
    }
    setLoading(false);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">10-Year CHD <span>Risk Score</span></h1>
        <p className="page-sub">Framingham-calibrated GBT ensemble · Enter patient vitals for real-time cardiovascular risk assessment</p>
      </div>

      <div style={{display:'flex',gap:10,marginBottom:26,flexWrap:'wrap',alignItems:'center'}}>
        <span style={{fontSize:'.75rem',color:'#50506a',fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase'}}>Load Sample:</span>
        {SAMPLES.map(s => (
          <button key={s.label} onClick={() => loadSample(s)} style={{
            padding:'7px 15px', borderRadius:8, border:`1px solid ${s.color}44`,
            background:`${s.color}11`, color:s.color,
            cursor:'pointer', fontSize:'.82rem', fontWeight:700, fontFamily:'Inter,sans-serif'
          }}>{s.label}</button>
        ))}
      </div>

      <div className="chart-wrap">
        <div className="predict-grid">
          {FIELDS.map(f => (
            <div className="field" key={f.key}>
              <label>
                {f.label}
                {f.unit && <span style={{color:'#50506a',marginLeft:5,fontWeight:400,textTransform:'none'}}>({f.unit})</span>}
              </label>
              {f.type==='select' ? (
                <select value={form[f.key]} onChange={e => setForm(p => ({...p,[f.key]:e.target.value}))}>
                  {f.options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ) : (
                <input type="number" min={f.min} max={f.max} step={f.step}
                  value={form[f.key]}
                  onChange={e => setForm(p => ({...p,[f.key]:e.target.value}))} />
              )}
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={analyze} disabled={loading}>
          {loading ? '⟳ Computing...' : '◎ Compute Risk'}
        </button>
      </div>

      {result && !result.error && (
        <div className="risk-card">
          <div style={{fontSize:'.69rem',fontWeight:700,letterSpacing:'.1em',color:'#50506a',textTransform:'uppercase',marginBottom:12}}>
            10-Year Coronary Heart Disease Risk
          </div>
          <div className="risk-pct" style={{color:result.risk_color}}>
            {result.percentage}<span style={{fontSize:'2.2rem'}}>%</span>
          </div>
          <div className="risk-lbl" style={{color:result.risk_color}}>{result.risk_label}</div>

          <div className="risk-track" style={{width:320,marginTop:24}}>
            <div className="risk-needle" style={{left:`${result.percentage}%`}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',width:320,margin:'6px auto 0',
            fontSize:'.7rem',color:'#50506a'}}>
            <span>Low</span><span>Moderate</span><span>High</span>
          </div>

          <div style={{width:320,margin:'18px auto 0'}}>
            <div className="meter" style={{height:10}}>
              <div className="meter-fill" style={{
                width:`${result.percentage}%`, background:result.risk_color,
                transition:'width 1s cubic-bezier(.34,1.56,.64,1)'
              }}/>
            </div>
          </div>

          {result.factors?.length > 0 && (
            <div style={{marginTop:26, width:'100%', maxWidth:520}}>
              <div style={{fontSize:'.69rem',fontWeight:700,letterSpacing:'.1em',
                color:'#50506a',textTransform:'uppercase',marginBottom:12,textAlign:'center'}}>
                Contributing Risk Factors
              </div>
              <div className="factors-row">
                {result.factors.map((f,i) => (
                  <span key={i} className="badge" style={{
                    background:`${IMP[f.impact]}15`,
                    color:IMP[f.impact],
                    border:`1px solid ${IMP[f.impact]}30`
                  }}>{f.name}</span>
                ))}
              </div>
            </div>
          )}

          <div style={{marginTop:24,padding:'14px 24px',borderRadius:10,maxWidth:440,
            background:'var(--bg3)',border:'1px solid var(--border)'}}>
            <p style={{fontSize:'.79rem',color:'#8888a8',lineHeight:1.65}}>
              Calibrated on <strong style={{color:'#eeeef4'}}>Framingham Heart Study</strong> cohort
              using <strong style={{color:'#eeeef4'}}>Apache Spark GBTClassifier</strong> (AUC ≥ 0.85).
              Not a substitute for clinical evaluation.
            </p>
          </div>
        </div>
      )}

      {result?.error && (
        <div style={{marginTop:20,padding:20,background:'rgba(239,68,68,.1)',
          border:'1px solid rgba(239,68,68,.3)',borderRadius:12,color:'#ef4444'}}>
          ⚠ {result.error}
        </div>
      )}
    </div>
  );
}
