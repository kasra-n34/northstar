import { PILLARS, ONE_WEEK_MS } from "../constants";
import { Mono, ScoreBar } from "./ui";

export default function MetaView({ state }) {
  const { metaAnalysis: meta, lastMetaDate, analyses } = state;
  const canGen   = Object.keys(analyses).length > 0;
  const metaAge  = lastMetaDate ? Date.now() - new Date(lastMetaDate).getTime() : Infinity;
  const isStale  = metaAge > ONE_WEEK_MS;
  const daysOld  = lastMetaDate ? Math.floor(metaAge / (1000 * 60 * 60 * 24)) : null;

  return (
    <div>
      <div style={{ marginBottom: 22, paddingBottom: 18, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ color: "var(--y)", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 3, marginBottom: 5 }}>⬡ SYNTHESIS</div>
          <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 34, letterSpacing: 1, color: "var(--text)" }}>Weekly Meta-Analysis</h2>
          {lastMetaDate && <div style={{ fontSize: 13, color: isStale ? "var(--o)" : "var(--text3)", marginTop: 5 }}>{isStale ? `⚠ ${daysOld} days old — run ⟳ SYNC NORTHSTAR to refresh` : `Last updated ${daysOld === 0 ? "today" : `${daysOld}d ago`}`}</div>}
        </div>
        <Mono s={{ fontSize: 13, color: "var(--text3)" }}>Updated via ⟳ SYNC NORTHSTAR</Mono>
      </div>

      {!meta && (
        <div style={{ textAlign: "center", padding: "70px 0" }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 44, color: "var(--border2)", marginBottom: 14 }}>META LOCKED</div>
          <div style={{ color: "var(--text3)", fontSize: 13 }}>{canGen ? "Run ⟳ SYNC NORTHSTAR in the top bar to generate your meta-analysis." : "Complete at least one pillar to unlock."}</div>
        </div>
      )}

      {meta && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 858 }}>
          {/* Score + pillar breakdown */}
          <div className="fu" style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 16 }}>
            <div style={{ background: "var(--bg2)", border: "1px solid var(--y)33", padding: "20px 16px", textAlign: "center", position: "relative" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5, background: "var(--y)88" }} />
              <Mono s={{ fontSize: 14, color: "var(--y)", letterSpacing: 2, display: "block", marginBottom: 8 }}>OVERALL</Mono>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 56, color: "var(--y)", lineHeight: 1 }}>{meta.overallScore}</div>
              <Mono s={{ fontSize: 14, color: "var(--text3)" }}>/100</Mono>
            </div>
            <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", padding: 20 }}>
              <Mono s={{ fontSize: 14, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 14 }}>PILLAR SCORES</Mono>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {PILLARS.map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Mono s={{ fontSize: 13, color: p.color, width: 120, letterSpacing: 1, flexShrink: 0 }}>{p.icon} {p.label}</Mono>
                    <div style={{ flex: 1 }}><ScoreBar value={analyses[p.id]?.priorityScore || 0} color={p.color} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Meta assessment */}
          {meta.metaAssessment && (
            <div className="fu-ma" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "var(--bg2)", border: "1px solid var(--y)33", padding: "18px 20px", borderTop: "2px solid var(--y)88" }}>
                <Mono s={{ fontSize: 14, color: "var(--y)", letterSpacing: 2, display: "block", marginBottom: 10 }}>THIS WEEK</Mono>
                <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.8, margin: 0 }}>{meta.metaAssessment.currentWeek}</p>
              </div>
              <div style={{ background: "var(--bg2)", border: "1px solid var(--c)33", padding: "18px 20px", borderTop: "2px solid var(--c)88" }}>
                <Mono s={{ fontSize: 14, color: "var(--c)", letterSpacing: 2, display: "block", marginBottom: 10 }}>LONG-TERM TRENDS</Mono>
                <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.8, margin: 0 }}>{meta.metaAssessment.longTermTrends}</p>
              </div>
            </div>
          )}

          {/* Strength / Weakness / Synergy */}
          <div className="fu1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[{ l: "DOMINANT STRENGTH", v: meta.dominantStrength, c: "var(--c)" }, { l: "CRITICAL WEAKNESS", v: meta.criticalWeakness, c: "var(--o)" }, { l: "SYNERGY OPPORTUNITY", v: meta.synergyOpportunity, c: "var(--p)" }].map(x => (
              <div key={x.l} style={{ background: "var(--bg1)", border: `1px solid ${x.c}22`, padding: 16 }}>
                <Mono s={{ fontSize: 14, color: x.c, letterSpacing: 1.5, display: "block", marginBottom: 7 }}>{x.l}</Mono>
                <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.5 }}>{x.v}</div>
              </div>
            ))}
          </div>

          {/* Top leverage */}
          <div className="fu2" style={{ background: "var(--y)0D", border: "1px solid var(--y)44", padding: "18px 20px" }}>
            <Mono s={{ fontSize: 14, color: "var(--y)", letterSpacing: 2, display: "block", marginBottom: 10 }}>⚡ HIGHEST-LEVERAGE ACTION THIS WEEK</Mono>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", lineHeight: 1.5 }}>{meta.topLeverageAction}</div>
          </div>

          {/* Mindset */}
          {meta.mindsetShift && (
            <div className="fu3" style={{ background: "var(--o)0D", border: "1px solid var(--o)33", padding: "16px 20px" }}>
              <Mono s={{ fontSize: 14, color: "var(--o)", letterSpacing: 1.5, display: "block", marginBottom: 8 }}>MINDSET SHIFT</Mono>
              <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7, fontStyle: "italic" }}>"{meta.mindsetShift}"</div>
            </div>
          )}

          {/* Sequence */}
          {meta.sequencePlan?.length > 0 && (
            <div className="fu4">
              <Mono s={{ fontSize: 13, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 14 }}>ATTACK SEQUENCE</Mono>
              {meta.sequencePlan.map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 14, marginBottom: 12, alignItems: "flex-start" }}>
                  <div style={{ background: "var(--y)", color: "#000", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue'", fontSize: 13, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6, paddingTop: 2 }}>{step}</div>
                </div>
              ))}
            </div>
          )}

          {/* Bottlenecks + quick wins */}
          {(meta.bottlenecks?.length > 0 || meta.quickWins?.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {meta.bottlenecks?.length > 0 && <div style={{ background: "var(--bg1)", border: "1px solid var(--r)22", padding: 16 }}><Mono s={{ fontSize: 14, color: "var(--r)", letterSpacing: 1.5, display: "block", marginBottom: 10 }}>BOTTLENECKS</Mono>{meta.bottlenecks.map((b, i) => <div key={i} style={{ fontSize: 14, color: "var(--text2)", marginBottom: 6, paddingLeft: 10, borderLeft: "1px solid var(--r)44", lineHeight: 1.5 }}>{b}</div>)}</div>}
              {meta.quickWins?.length  > 0 && <div style={{ background: "var(--bg1)", border: "1px solid var(--g)22", padding: 16 }}><Mono s={{ fontSize: 14, color: "var(--g)", letterSpacing: 1.5, display: "block", marginBottom: 10 }}>QUICK WINS TODAY</Mono>{meta.quickWins.map((w, i)  => <div key={i} style={{ fontSize: 14, color: "var(--text2)", marginBottom: 6, paddingLeft: 10, borderLeft: "1px solid var(--g)44", lineHeight: 1.5 }}>{w}</div>)}</div>}
            </div>
          )}

          {meta.thirtyDayVision && (
            <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", padding: "16px 20px", borderLeft: "3px solid var(--c)" }}>
              <Mono s={{ fontSize: 14, color: "var(--c)", letterSpacing: 2, display: "block", marginBottom: 8 }}>30-DAY VISION</Mono>
              <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7 }}>{meta.thirtyDayVision}</div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Mono s={{ fontSize: 13, color: "var(--text3)" }}>Generated: {new Date(lastMetaDate).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</Mono>
          </div>
        </div>
      )}
    </div>
  );
}