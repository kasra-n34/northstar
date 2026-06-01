import { PILLARS, NAV, ONE_WEEK_MS } from "../constants";
import { Mono } from "./ui";
import { checkinDoneThisWeek, isSunday, isMonday } from "../prompts";
import logoIcon from "../../assets/Northstar-2-removebg-preview.png";

export default function Sidebar({ active, onNav, state }) {
  const pending        = (state.pendingMissions || []).length;
  const activeMissions = (state.missions || []).filter(m => !state.completedMissions?.includes(m.id)).length;
  const metaAge        = state.lastMetaDate ? Date.now() - new Date(state.lastMetaDate).getTime() : Infinity;
  const metaStale      = metaAge > ONE_WEEK_MS;
  const hasProfile     = state.userProfile && Object.keys(state.userProfile).length > 0;
  const checkinMissed = !checkinDoneThisWeek(state.lastInterviewDate) && Object.keys(state.analyses || {}).length > 0;
  const interviewDue = (isSunday() || isMonday()) && checkinMissed;

  return (
    <div style={{ width: 218, flexShrink: 0, background: "var(--bg1)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ borderBottom: "1px solid var(--border)" }}>
        <img src={logoIcon} alt="Northstar" style={{ width: "72%", display: "block", margin: "0 auto", objectFit: "contain" }} />
      </div>

      <nav style={{ flex: 1, padding: "10px 6px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {NAV.map(item => {
          const isActive = active === item.id;
          const pillar   = PILLARS.find(p => p.id === item.id);
          const hasData  = pillar ? !!state.analyses[item.id] : false;
          return (
            <button key={item.id} className="nav-btn" onClick={() => onNav(item.id)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", width: "100%", textAlign: "left", background: isActive ? "var(--bg3)" : "transparent", border: isActive ? "1px solid var(--border2)" : "1px solid transparent", color: isActive ? "var(--text)" : "var(--text2)", transition: "all 0.15s" }}>
              <span style={{ fontSize: 14, color: isActive ? (pillar?.color || "var(--y)") : "var(--text3)", width: 14, textAlign: "center" }}>{item.icon}</span>
              <Mono s={{ fontSize: 13, letterSpacing: 1, flex: 1 }}>{item.label}</Mono>
              {item.id === "missions" && pending > 0 && <span style={{ background: "var(--o)", color: "#000", fontFamily: "'DM Mono',monospace", fontSize: 14, padding: "1px 5px", borderRadius: 999, fontWeight: 600 }}>{pending}</span>}
              {item.id === "missions" && activeMissions > 0 && pending === 0 && <span style={{ background: "var(--c)", color: "#000", fontFamily: "'DM Mono',monospace", fontSize: 14, padding: "1px 5px", borderRadius: 999, fontWeight: 600 }}>{activeMissions}</span>}
              {item.id === "interview" && interviewDue && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--c)", flexShrink: 0, animation: "pulse 2s infinite" }} />}
              {item.id === "meta" && metaStale && state.metaAnalysis && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--o)", flexShrink: 0, animation: "pulse 2s infinite" }} />}
              {item.id === "profile" && hasProfile && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--y)", flexShrink: 0 }} />}
              {hasData && <span style={{ width: 5, height: 5, borderRadius: "50%", background: pillar?.color, flexShrink: 0 }} />}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)" }}>
        <Mono s={{ fontSize: 14, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 8 }}>PILLARS ACTIVE</Mono>
        <div style={{ display: "flex", gap: 5 }}>
          {PILLARS.map(p => <div key={p.id} title={p.label} style={{ width: 7, height: 7, borderRadius: "50%", background: state.analyses[p.id] ? p.color : "var(--border2)" }} />)}
        </div>
      </div>
    </div>
  );
}