import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, ReferenceLine
} from 'recharts';

const MC = { 'Logistic Regression':'#5b8df6', 'Random Forest':'#1dd87a', 'Gradient Boosted Trees':'#f04f6e' };
const TT = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#161622', border:'1px solid rgba(255,255,255,.09)', borderRadius:9, padding:'10px 14px' }}>
      {payload.map((p,i) => (
        <p key={i} style={{ color:p.color||'#eeeef4', fontSize:'.84rem' }}>
          {p.name}: {typeof p.value==='number' ? p.value.toFixed(4) : p.value}
        </p>
      ))}
    </div>
  );
};

function CM({ m }) {
  const {tp,tn,fp,fn} = m.confusion;
  const cells = [
    {label:'TN',val:tn,c:'#1dd87a',sub:'True Negative'},
    {label:'FP',val:fp,c:'#f5a62a',sub:'False Positive'},
    {label:'FN',val:fn,c:'#f5a62a',sub:'False Negative'},
    {label:'TP',val:tp,c:'#f04f6e',sub:'True Positive'},
  ];
  return (
    <div>
      <div className="card-title">Confusion Matrix</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        {cells.map(c => (
          <div key={c.label} style={{
            background:'var(--bg3)',borderRadius:10,padding:'16px',
            border:`1px solid ${c.c}33`,textAlign:'center'
          }}>
            <div style={{fontSize:'1.9rem',fontWeight:800,color:c.c}}>{c.val}</div>
            <div style={{fontSize:'.7rem',color:'#8888a8',marginTop:4}}>{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Models({ data }) {
  const { models, roc_curves, feature_importance } = data;
  const [sel, setSel] = useState(models[2]);

  const fi = (feature_importance['Gradient Boosted Trees']||[])
    .sort((a,b) => b.importance-a.importance).slice(0,10);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Model <span>Evaluation</span></h1>
        <p className="page-sub">ROC curves · Confusion matrices · Feature importance from Spark MLlib GBTClassifier</p>
      </div>

      <div className="model-grid">
        {models.map((m,i) => (
          <div key={m.model} className={`model-card ${sel.model===m.model?'sel':''}`}
            onClick={()=>setSel(m)}>
            <div className="model-name" style={{color:Object.values(MC)[i]}}>{m.model}</div>
            {['auc','accuracy','f1','precision','recall'].map(k => (
              <div className="m-row" key={k}>
                <span className="m-key">{k.toUpperCase()}</span>
                <span className="m-val">{(m[k]*100).toFixed(2)}%</span>
              </div>
            ))}
            {sel.model===m.model && <div style={{marginTop:12}}><span className="badge badge-g">● Active</span></div>}
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="chart-wrap">
          <div className="card-title">ROC Curves — All Models</div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
              <XAxis dataKey="fpr" type="number" domain={[0,1]} tick={{fill:'#8888a8',fontSize:11}}
                label={{value:'FPR',position:'insideBottom',fill:'#8888a8',fontSize:11}} />
              <YAxis type="number" domain={[0,1]} tick={{fill:'#8888a8',fontSize:11}}
                label={{value:'TPR',angle:-90,position:'insideLeft',fill:'#8888a8',fontSize:11}} />
              <Tooltip content={<TT />} />
              <ReferenceLine segment={[{x:0,y:0},{x:1,y:1}]} stroke="rgba(255,255,255,.12)" strokeDasharray="4 4" />
              {Object.entries(roc_curves||{}).map(([name,pts]) => (
                <Line key={name} data={pts} dataKey="tpr" type="monotone"
                  stroke={MC[name]||'#5b8df6'} dot={false} strokeWidth={2} name={name} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div style={{display:'flex',gap:16,marginTop:8,flexWrap:'wrap'}}>
            {models.map(m => (
              <div key={m.model} style={{display:'flex',alignItems:'center',gap:6,fontSize:'.75rem',color:'#8888a8'}}>
                <div style={{width:18,height:2,background:MC[m.model],borderRadius:1}}/>
                {m.model.split(' ')[0]} (AUC={m.auc.toFixed(4)})
              </div>
            ))}
          </div>
        </div>

        <div className="chart-wrap">
          <CM m={sel} />
          <div style={{marginTop:20}}>
            <div className="card-title">Derived Clinical Metrics</div>
            {[
              {label:'Sensitivity (TPR)', val: sel.confusion.tp/(sel.confusion.tp+sel.confusion.fn||1)},
              {label:'Specificity (TNR)', val: sel.confusion.tn/(sel.confusion.tn+sel.confusion.fp||1)},
              {label:'PPV (Precision)',   val: sel.confusion.tp/(sel.confusion.tp+sel.confusion.fp||1)},
              {label:'NPV',              val: sel.confusion.tn/(sel.confusion.tn+sel.confusion.fn||1)},
            ].map(({label,val}) => (
              <div key={label} style={{marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'.8rem',marginBottom:4}}>
                  <span style={{color:'#8888a8'}}>{label}</span>
                  <span style={{color:'#eeeef4',fontFamily:'JetBrains Mono,monospace',fontWeight:500}}>
                    {(val*100).toFixed(2)}%
                  </span>
                </div>
                <div className="meter"><div className="meter-fill" style={{width:`${val*100}%`}}/></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="chart-wrap">
        <div className="card-title">Feature Importance — GBT (Spark GBTClassifier.featureImportances)</div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={fi} layout="vertical" margin={{left:20}}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" horizontal={false} />
            <XAxis type="number" tick={{fill:'#8888a8',fontSize:11}} axisLine={false} />
            <YAxis type="category" dataKey="feature" width={140}
              tick={{fill:'#8888a8',fontSize:12}} axisLine={false} tickLine={false} />
            <Tooltip content={<TT />} />
            <Bar dataKey="importance" fill="#f04f6e" radius={[0,4,4,0]} name="Importance" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
