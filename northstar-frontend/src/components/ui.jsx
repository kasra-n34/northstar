import { PILLARS } from "../constants";

export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#07090B;--bg1:#0C1014;--bg2:#101620;--bg3:#162030;
  --border:#1A2535;--border2:#243040;--text:#C4CED8;--text2:#567088;--text3:#2A3D52;
  --y:#60C8F5;--c:#3BB8FF;--o:#FF6B35;--p:#B03BFF;--r:#FF3B5C;--g:#3BFF8A;
}
body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;overflow:hidden;font-size:15px;}
::-webkit-scrollbar{width:3px;height:3px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px;}
textarea,input{font-family:'DM Mono',monospace!important;background:var(--bg2)!important;color:var(--text)!important;border:1px solid var(--border)!important;outline:none!important;}
textarea::placeholder,input::placeholder{color:var(--text3)!important;}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}
.fu{animation:fadeUp 0.35s ease both;}
.fu1{animation:fadeUp 0.35s 0.06s ease both;}
.fu2{animation:fadeUp 0.35s 0.12s ease both;}
.fu3{animation:fadeUp 0.35s 0.18s ease both;}
.fu4{animation:fadeUp 0.35s 0.24s ease both;}
button{cursor:pointer;}
.nav-btn:hover{background:var(--bg2)!important;color:var(--text)!important;}
.hov-border:hover{border-color:var(--border2)!important;}
.card:hover{background:var(--bg2)!important;border-color:var(--border2)!important;}
`;

export const Mono = ({ children, s = {} }) => (
  <span style={{ fontFamily: "'DM Mono',monospace", ...s }}>{children}</span>
);

export const Tag = ({ children, color = "var(--text3)" }) => (
  <span style={{
    fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1.5,
    padding: "3px 7px", border: `1px solid ${color}44`,
    color, background: color + "11", whiteSpace: "nowrap",
  }}>{children}</span>
);

export const Spinner = ({ color = "var(--c)", size = 18 }) => (
  <div style={{
    width: size, height: size,
    border: `1.5px solid ${color}33`, borderTop: `1.5px solid ${color}`,
    borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0,
  }} />
);

export const PillarDot = ({ id, size = 7 }) => {
  const p = PILLARS.find(x => x.id === id);
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      borderRadius: "50%", background: p?.color || "#444", flexShrink: 0,
    }} />
  );
};

export const DiffTag = ({ level }) => {
  const c = { Easy: "var(--c)", Medium: "var(--y)", Hard: "var(--o)" };
  return <Tag color={c[level] || "var(--text3)"}>{(level || "").toUpperCase()}</Tag>;
};

export const ScoreBar = ({ value, max = 100, color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{ flex: 1, height: 2, background: "var(--border)" }}>
      <div style={{ height: "100%", width: `${(value / max) * 100}%`, background: color, transition: "width 0.6s ease" }} />
    </div>
    <Mono s={{ fontSize: 14, color: "var(--text2)" }}>{value}<span style={{fontSize:10,color:"var(--text3)"}}>/{max}</span></Mono>
  </div>
);

export const ScoreSparkline = ({ history = [], color = "var(--c)", height = 36, width = 120 }) => {
  if (history.length < 2) return null;
  const scores = history.map(h => h.score);
  const min    = Math.max(0, Math.min(...scores) - 1);
  const max    = Math.min(100, Math.max(...scores) + 1);
  const range  = max - min || 1;
  const pts    = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * width;
    const y = height - ((s - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  const latest     = scores[scores.length - 1];
  const prev       = scores[scores.length - 2];
  const trend      = latest > prev ? "↑" : latest < prev ? "↓" : "→";
  const trendColor = latest > prev ? "var(--g)" : latest < prev ? "var(--r)" : "var(--text3)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width={width} height={height} style={{ overflow: "visible" }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.7" />
        {scores.map((s, i) => {
          const x = (i / (scores.length - 1)) * width;
          const y = height - ((s - min) / range) * height;
          return <circle key={i} cx={x} cy={y} r={i === scores.length - 1 ? 3 : 1.5} fill={color} fillOpacity={i === scores.length - 1 ? 1 : 0.4} />;
        })}
      </svg>
      <div>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color, lineHeight: 1 }}>
          {latest}<span style={{ fontSize: 14, color: "var(--text3)" }}>/100</span>
        </div>
        <Mono s={{ fontSize: 13, color: trendColor }}>{trend} {history.length} pts</Mono>
      </div>
    </div>
  );
};

export const LoadingBlock = ({ color = "var(--c)", label = "NORTHSTAR IS WORKING" }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 20 }}>
    <div style={{ width: 40, height: 40, border: `2px solid ${color}22`, borderTop: `2px solid ${color}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <Mono s={{ fontSize: 13, color, letterSpacing: 3 }}>{label}...</Mono>
  </div>
);