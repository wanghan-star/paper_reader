"use client";
import "./startup.css";

// The in-app continuation of the launch animation: same artwork as the boot page, faded out once the reader is ready.
export default function StartupSplash({leaving,status}:{leaving:boolean;status:string}){
  return <div className={`pl-splash ${leaving?"pl-leaving":""}`} role="status" aria-live="polite">
    <div className="pl-stage" aria-hidden="true">
      <div className="pl-book">
        <div className="pl-half pl-left"/><div className="pl-half pl-right"/>
        {[0,1,2].map(i=><div key={i} className="pl-page" style={{"--i":i} as React.CSSProperties}/>)}
        <div className="pl-spine"/>
        <svg className="pl-leaf" viewBox="0 0 34 52"><path d="M6 50 C4 34 8 16 30 2 C33 22 26 40 6 50 Z"/><path d="M6 50 C12 36 18 22 27 8"/></svg>
      </div>
    </div>
    <div className="pl-brand"><strong>知页</strong><span>Paperleaf</span></div>
    <p className="pl-tagline">让理解，多一页。</p>
    <div className="pl-progress" aria-hidden="true"><i/></div>
    <p className="pl-status">{status}</p>
  </div>;
}
