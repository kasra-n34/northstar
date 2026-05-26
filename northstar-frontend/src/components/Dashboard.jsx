import { useState, useEffect } from "react";
import { PILLARS, ONE_WEEK_MS, BACKEND } from "../constants";
import { Mono, Tag, PillarDot, DiffTag, ScoreBar, ScoreSparkline } from "./ui";
import { isSunday, checkinDoneThisWeek, getNextSunday } from "../prompts";

function TrendsSection({ state }) {
  const { analyses = {}, weeklyLogs = [], missions = [], completedMissions = [], missionCompletedAt = {} } = state;

  // ── Pillar score histories (need ≥2 points to draw a line) ────────────────
  const pillarHistories = PILLARS
    .map(p => ({ ...p, history: analyses[p.id]?.scoreHistory || [] }))
    .filter(p => p.history.length >= 2);

  // ── Pillar momentum: cumulative check-in deltas ────────────────────────────
  const pillarMomentum = {};
  PILLARS.forEach(p => { pillarMomentum[p.id] = 0; });
  weeklyLogs.forEach(log => {
    if (!log.pillarDeltas) return;
    Object.entries(log.pillarDeltas).forEach(([pid, val]) => {
      const delta = typeof val === "object" ? val.delta : val;
      if (delta) pillarMomentum[pid] = (pillarMomentum[pid] || 0) + delta;
    });
  });
  const hasMomentumData = weeklyLogs.some(l => l.pillarDeltas && Object.keys(l.pillarDeltas).length > 0);
  const momentumMax = Math.max(...PILLARS.map(p => Math.abs(pillarMomentum[p.id] || 0)), 1);

  // ── Mission completion (this week vs last week) ────────────────────────────
  const now = new Date();
  const todayMid = new Date(now); todayMid.setHours(0, 0, 0, 0);
  const thisWeekStart = new Date(todayMid);
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const completedThisWeek = Object.values(missionCompletedAt).filter(d => new Date(d) >= thisWeekStart).length;
  const completedLastWeek = Object.values(missionCompletedAt).filter(d => { const dd = new Date(d); return dd >= lastWeekStart && dd < thisWeekStart; }).length;
  const missionDelta = completedThisWeek - completedLastWeek;
  const totalCompleted = completedMissions.length;
  const totalAll = missions.length + completedMissions.length;
  const completionRate = totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : null;

  // ── Check-in streak (consecutive weeks) ───────────────────────────────────
  let streak = 0;
  if (weeklyLogs.length > 0) {
    const getWeekSunday = d => {
      const dd = new Date(d); dd.setHours(0, 0, 0, 0);
      dd.setDate(dd.getDate() - dd.getDay());
      return dd.toISOString().slice(0, 10);
    };
    const weeks = [...new Set(
      [...weeklyLogs].sort((a, b) => new Date(b.date) - new Date(a.date)).map(l => getWeekSunday(l.date))
    )];
    streak = weeks.length > 0 ? 1 : 0;
    for (let i = 1; i < weeks.length; i++) {
      const diff = (new Date(weeks[i - 1]) - new Date(weeks[i])) / (7 * 24 * 60 * 60 * 1000);
      if (Math.round(diff) === 1) streak++;
      else break;
    }
  }

  // ── Key wins from recent logs ──────────────────────────────────────────────
  const recentWins = [...weeklyLogs]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3)
    .filter(l => l.keyWin);

  const hasTrends = pillarHistories.length > 0 || hasMomentumData || totalCompleted > 0 || weeklyLogs.length > 0;
  if (!hasTrends) return null;

  return (
    <div className="fu4">
      <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 14 }}>TRENDS</Mono>

      {/* Pillar Score Trajectories */}
      {pillarHistories.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 8 }}>SCORE HISTORY</Mono>
          <div style={{ display: "grid", gridTemplateColumns: pillarHistories.length === 1 ? "1fr" : "1fr 1fr", gap: 8 }}>
            {pillarHistories.map(p => (
              <div key={p.id} style={{ background: "var(--bg1)", border: `1px solid ${p.color}22`, padding: "12px 14px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: p.color + "55" }} />
                <Mono s={{ fontSize: 8, color: p.color, letterSpacing: 1.5, display: "block", marginBottom: 10 }}>{p.icon} {p.label}</Mono>
                <ScoreSparkline history={p.history} color={p.color} height={32} width={110} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pillar Momentum */}
      {hasMomentumData && (
        <div style={{ marginBottom: 10 }}>
          <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 8 }}>PILLAR MOMENTUM · CUMULATIVE CHECK-IN DELTAS</Mono>
          <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {PILLARS.map(p => {
              const val = pillarMomentum[p.id] || 0;
              const isPos = val > 0;
              const isNeg = val < 0;
              const pct = (Math.abs(val) / momentumMax) * 100;
              const barColor = isPos ? "var(--g)" : isNeg ? "var(--r)" : "var(--border2)";
              return (
                <div key={p.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <Mono s={{ fontSize: 8, color: p.color, letterSpacing: 1 }}>{p.icon} {p.label}</Mono>
                    <Mono s={{ fontSize: 10, color: isPos ? "var(--g)" : isNeg ? "var(--r)" : "var(--text3)" }}>
                      {isPos ? "+" : ""}{val}
                    </Mono>
                  </div>
                  <div style={{ height: 2, background: "var(--border)" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: barColor, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats row: missions + streak */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: recentWins.length > 0 ? 10 : 0 }}>
        {totalCompleted > 0 && (
          <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", padding: "12px 14px" }}>
            <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 6 }}>COMPLETED</Mono>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 30, color: "var(--c)", lineHeight: 1 }}>{totalCompleted}</div>
            {completionRate !== null && (
              <Mono s={{ fontSize: 8, color: "var(--text3)", display: "block", marginTop: 3 }}>{completionRate}% RATE</Mono>
            )}
          </div>
        )}
        {totalCompleted > 0 && (
          <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", padding: "12px 14px" }}>
            <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 6 }}>THIS WEEK</Mono>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 30, color: missionDelta > 0 ? "var(--g)" : missionDelta < 0 ? "var(--r)" : "var(--text2)", lineHeight: 1 }}>
              {completedThisWeek}
            </div>
            <Mono s={{ fontSize: 8, color: missionDelta > 0 ? "var(--g)" : missionDelta < 0 ? "var(--r)" : "var(--text3)", display: "block", marginTop: 3 }}>
              {missionDelta > 0 ? `↑ +${missionDelta} VS LAST` : missionDelta < 0 ? `↓ ${missionDelta} VS LAST` : "→ SAME AS LAST"}
            </Mono>
          </div>
        )}
        {weeklyLogs.length > 0 && (
          <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", padding: "12px 14px" }}>
            <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 6 }}>STREAK</Mono>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 30, color: streak >= 4 ? "var(--g)" : streak >= 2 ? "var(--y)" : "var(--text2)", lineHeight: 1 }}>
              {streak}<span style={{ fontSize: 13, color: "var(--text3)" }}> WK</span>
            </div>
            <Mono s={{ fontSize: 8, color: "var(--text3)", display: "block", marginTop: 3 }}>{weeklyLogs.length} TOTAL LOGS</Mono>
          </div>
        )}
      </div>

      {/* Recent key wins */}
      {recentWins.length > 0 && (
        <div>
          <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 8 }}>RECENT WINS</Mono>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recentWins.map(log => (
              <div key={log.id} style={{ background: "var(--bg1)", border: "1px solid var(--g)22", padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Mono s={{ fontSize: 9, color: "var(--g)", flexShrink: 0, marginTop: 1 }}>✓</Mono>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>{log.keyWin}</div>
                  <Mono s={{ fontSize: 8, color: "var(--text3)", display: "block", marginTop: 3 }}>
                    {new Date(log.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                  </Mono>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ state, onNav, onShowHelp }) {
  const { analyses = {}, missions = [], completedMissions = [], pendingMissions = [], userProfile = {}, weeklyLogs = [], metaAnalysis } = state;

  const [apiKeySet, setApiKeySet] = useState(null);
  useEffect(() => {
    fetch(`${BACKEND}/api/health`)
      .then(r => r.json())
      .then(d => setApiKeySet(!!d.apiKeySet))
      .catch(() => setApiKeySet(false));
  }, []);
  // Compute overall northstar score: use meta overallScore if available, else average pillar scores
  const pillarScores = PILLARS.map(p => analyses[p.id]?.priorityScore).filter(Boolean);
  const overallScore = metaAnalysis?.overallScore
    ? metaAnalysis.overallScore
    : pillarScores.length > 0
      ? Math.round(pillarScores.reduce((a, b) => a + b, 0) / pillarScores.length)
      : null;
  const now          = new Date();
  const h            = now.getHours();
  const greeting     = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const name         = userProfile.name ? `, ${userProfile.name.split(" ")[0]}` : "";
  const activeMissions = missions.filter(m => !completedMissions.includes(m.id));

  // Sunday-aware check-in status
  const todayIsSunday  = isSunday();
  const doneThisWeek   = checkinDoneThisWeek(state.lastInterviewDate);
  const nextSunday     = getNextSunday();
  const daysUntilNext  = Math.ceil((nextSunday - now) / (1000 * 60 * 60 * 24));
  const interviewDue   = todayIsSunday && !doneThisWeek && Object.keys(analyses).length > 0;

  const recentLogs   = [...weeklyLogs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);

  // Setup progress — shown until all pillars have been synced at least once
  const isNewUser = Object.keys(analyses).length === 0;
  const pillarSetup = PILLARS.map(p => {
    const profile  = state.profiles?.[p.id];
    const coreKeys = p.questions.filter(q => q.core).map(q => q.key);
    const filled   = coreKeys.every(k => profile?.answers?.[k]?.trim());
    return { ...p, filled };
  });
  const filledCount    = pillarSetup.filter(p => p.filled).length;
  const profileDone    = !!(state.userProfile?.name?.trim() && state.userProfile?.age && state.userProfile?.height && state.userProfile?.sex);
  const setupTotal     = PILLARS.length + 2; // +1 API key, +1 profile
  const setupDone      = filledCount + (apiKeySet ? 1 : 0) + (profileDone ? 1 : 0);
  const allFilled      = filledCount === PILLARS.length && apiKeySet && profileDone;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div className="fu" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 5 }}>
            {now.toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </Mono>
          <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: 44, letterSpacing: 2, color: "var(--text)", lineHeight: 1 }}>{greeting}{name}.</h1>
        </div>
        {onShowHelp && (
          <button
            onClick={onShowHelp}
            title="How Northstar works"
            style={{ width: 28, height: 28, borderRadius: "50%", background: "none", border: "1px solid var(--border)", color: "var(--text3)", fontFamily: "'DM Mono',monospace", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 4, transition: "border-color 0.2s, color 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--c)"; e.currentTarget.style.color = "var(--c)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text3)"; }}
          >
            ?
          </button>
        )}
      </div>

      {/* Setup checklist — shown until all pillars have been synced */}
      {isNewUser && (
        <div style={{ background: "var(--bg2)", border: "1px solid var(--c)44", padding: 20, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,var(--c),transparent)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 10 }}>
            <div>
              <Mono s={{ fontSize: 9, color: "var(--c)", letterSpacing: 2, display: "block", marginBottom: 5 }}>GETTING STARTED</Mono>
              <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
                Fill in each pillar's core goals, then hit <strong style={{ color: "var(--c)" }}>⟳ SYNC NORTHSTAR</strong> to run your first analysis.
              </div>
            </div>
            <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", padding: "8px 14px", textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: allFilled ? "var(--g)" : "var(--c)", lineHeight: 1 }}>{setupDone}<span style={{ fontSize: 14, color: "var(--text3)" }}>/{setupTotal}</span></div>
              <Mono s={{ fontSize: 7, color: "var(--text3)", letterSpacing: 1, display: "block", marginTop: 2 }}>STEPS DONE</Mono>
            </div>
          </div>

          {/* API key step */}
          <button
            onClick={() => onNav("settings")}
            className="card"
            style={{ width: "100%", background: apiKeySet ? "var(--g)0D" : "var(--r)0D", border: `1px solid ${apiKeySet ? "var(--g)55" : "var(--r)55"}`, padding: "12px 14px", textAlign: "left", display: "flex", alignItems: "center", gap: 10, marginBottom: 8, transition: "all 0.2s" }}
          >
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: apiKeySet ? "var(--g)22" : "var(--r)18", border: `1px solid ${apiKeySet ? "var(--g)88" : "var(--r)66"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11 }}>
              {apiKeySet ? <span style={{ color: "var(--g)" }}>✓</span> : <span style={{ color: "var(--r)" }}>!</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Mono s={{ fontSize: 8, color: apiKeySet ? "var(--g)" : "var(--r)", letterSpacing: 1.5, display: "block" }}>⚙ ANTHROPIC API KEY</Mono>
              <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{apiKeySet ? "API key saved — AI features active" : "Required — open Settings to add your key"}</div>
            </div>
            {!apiKeySet && <Mono s={{ fontSize: 8, color: "var(--r)", letterSpacing: 1 }}>OPEN SETTINGS →</Mono>}
          </button>

          {/* Profile step */}
          <button
            onClick={() => onNav("profile")}
            className="card"
            style={{ width: "100%", background: profileDone ? "var(--g)0D" : "var(--bg1)", border: `1px solid ${profileDone ? "var(--g)55" : "var(--border)"}`, padding: "12px 14px", textAlign: "left", display: "flex", alignItems: "center", gap: 10, marginBottom: 8, transition: "all 0.2s" }}
          >
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: profileDone ? "var(--g)22" : "var(--bg2)", border: `1px solid ${profileDone ? "var(--g)88" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11 }}>
              {profileDone ? <span style={{ color: "var(--g)" }}>✓</span> : <span style={{ color: "var(--text3)" }}>→</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Mono s={{ fontSize: 8, color: profileDone ? "var(--g)" : "var(--text2)", letterSpacing: 1.5, display: "block" }}>◎ YOUR PROFILE</Mono>
              <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{profileDone ? "Name, age, height & sex saved" : "Add your stats — age, height, sex"}</div>
            </div>
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: allFilled ? 14 : 0 }}>
            {pillarSetup.map(p => (
              <button
                key={p.id}
                onClick={() => onNav(p.id)}
                className="card"
                style={{ background: p.filled ? p.color + "0D" : "var(--bg1)", border: `1px solid ${p.filled ? p.color + "55" : "var(--border)"}`, padding: "12px 14px", textAlign: "left", display: "flex", alignItems: "center", gap: 10, transition: "all 0.2s" }}
              >
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: p.filled ? p.color + "22" : "var(--bg2)", border: `1px solid ${p.filled ? p.color + "88" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11 }}>
                  {p.filled ? <span style={{ color: p.color }}>✓</span> : <span style={{ color: "var(--text3)" }}>→</span>}
                </div>
                <div style={{ minWidth: 0 }}>
                  <Mono s={{ fontSize: 8, color: p.filled ? p.color : "var(--text3)", letterSpacing: 1.5, display: "block" }}>{p.icon} {p.label}</Mono>
                  <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{p.filled ? "Core goals saved" : "Tap to fill in"}</div>
                </div>
              </button>
            ))}
          </div>
          {allFilled && (
            <div style={{ background: "var(--c)0D", border: "1px solid var(--c)33", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--c)", fontSize: 14 }}>⟳</span>
              <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>All pillars are set up. Hit <strong style={{ color: "var(--c)" }}>⟳ SYNC NORTHSTAR</strong> in the top bar to run your first analysis and generate missions.</div>
            </div>
          )}
        </div>
      )}

      {/* Check-in status */}
      {Object.keys(analyses).length > 0 && (
        <div className="fu1" style={{ background: interviewDue ? "var(--c)0D" : doneThisWeek ? "var(--g)0D" : "var(--bg2)", border: `1px solid ${interviewDue ? "var(--c)44" : doneThisWeek ? "var(--g)33" : "var(--border)"}`, padding: 20, position: "relative", overflow: "hidden" }}>
          {interviewDue && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,var(--c),transparent)" }} />}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <Mono s={{ fontSize: 9, color: interviewDue ? "var(--c)" : doneThisWeek ? "var(--g)" : "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 6 }}>
                {interviewDue ? "⟳ SUNDAY CHECK-IN READY" : doneThisWeek ? "✓ THIS WEEK COMPLETE" : "⟳ WEEKLY CHECK-IN"}
              </Mono>
              {interviewDue
                ? <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>Today is Sunday. Time for your weekly pulse — upload fresh data, answer 7 questions, and Northstar will update your pillars and generate new missions.</div>
                : doneThisWeek
                  ? <div style={{ fontSize: 13, color: "var(--text2)" }}>Done. Next check-in is <span style={{ color: "var(--c)" }}>Sunday {nextSunday.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span> — {daysUntilNext} day{daysUntilNext !== 1 ? "s" : ""} away.</div>
                  : weeklyLogs.length === 0
                    ? <div style={{ fontSize: 13, color: "var(--text2)" }}>Complete your first weekly check-in on a Sunday once your pillars are set up.</div>
                    : <div style={{ fontSize: 13, color: "var(--text2)" }}>Next check-in: <span style={{ color: "var(--c)" }}>Sunday {nextSunday.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span> · {daysUntilNext} day{daysUntilNext !== 1 ? "s" : ""} away. Last: {new Date(state.lastInterviewDate).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}.</div>
              }
            </div>
            {interviewDue && (
              <button onClick={() => onNav("interview")} style={{ background: "var(--c)", color: "#000", border: "none", padding: "10px 18px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1, flexShrink: 0, fontWeight: 500 }}>
                BEGIN →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="fu1" style={{ display: "grid", gridTemplateColumns: overallScore ? "1.4fr repeat(4,1fr)" : "repeat(4,1fr)", gap: 10 }}>
        {overallScore && (
          <div style={{ background: "var(--bg2)", border: "1px solid var(--y)44", padding: "14px 16px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5, background: "var(--y)88" }} />
            <Mono s={{ fontSize: 8, color: "var(--y)", letterSpacing: 1.5, display: "block", marginBottom: 8 }}>OVERALL RATING</Mono>
            <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 38, color: overallScore >= 80 ? "var(--g)" : overallScore >= 60 ? "var(--y)" : overallScore >= 40 ? "var(--o)" : "var(--r)", lineHeight: 1 }}>{overallScore}</div>
              <Mono s={{ fontSize: 11, color: "var(--text3)" }}>/100</Mono>
            </div>
            <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1, display: "block", marginTop: 4 }}>{metaAnalysis?.overallScore ? "META" : "AVG"}</Mono>
          </div>
        )}
        {[
          { label: "PILLARS",        value: PILLARS.filter(p => analyses[p.id]).length, total: PILLARS.length, color: "var(--c)" },
          { label: "ACTIVE MISSIONS",value: activeMissions.length,                  color: "var(--o)" },
          { label: "PENDING REVIEW", value: pendingMissions.length,                 color: "var(--y)" },
          { label: "CHECK-INS",      value: weeklyLogs.length,                      color: "var(--p)" },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--bg1)", border: "1px solid var(--border)", padding: "14px 16px" }}>
            <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 8 }}>{s.label}</Mono>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 30, color: s.color, lineHeight: 1 }}>
              {s.value}{s.total ? <span style={{ fontSize: 16, color: "var(--text3)" }}>/{s.total}</span> : ""}
            </div>
          </div>
        ))}
      </div>

      {/* Pending missions alert */}
      {pendingMissions.length > 0 && (
        <div className="fu2" style={{ background: "var(--y)0D", border: "1px solid var(--y)44", padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <Mono s={{ fontSize: 9, color: "var(--y)", letterSpacing: 2 }}>⚡ MISSIONS AWAITING REVIEW</Mono>
            <button onClick={() => onNav("missions")} style={{ background: "var(--y)", border: "none", color: "#000", padding: "5px 12px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1 }}>REVIEW →</button>
          </div>
          <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 6 }}>{pendingMissions.length} new mission{pendingMissions.length !== 1 ? "s" : ""} — accept or decline each one.</div>
        </div>
      )}

      {/* Pillar overview */}
      <div className="fu2">
        <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 12 }}>PILLAR OVERVIEW</Mono>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {PILLARS.map(p => {
            const a = analyses[p.id];
            return (
              <button key={p.id} onClick={() => onNav(p.id)} className="card" style={{ background: "var(--bg1)", border: `1px solid ${a ? p.color + "44" : "var(--border)"}`, padding: 18, textAlign: "left", transition: "all 0.2s", position: "relative", overflow: "hidden" }}>
                {a && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5, background: p.color + "88" }} />}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ color: p.color, fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 2, marginBottom: 3 }}>{p.icon} {p.label}</div>
                    <div style={{ color: "var(--text2)", fontSize: 11 }}>{p.sub}</div>
                  </div>
                  {a ? <Tag color={p.color}>ACTIVE</Tag> : <Tag color="var(--text3)">SETUP →</Tag>}
                </div>
                {a
                  ? <><div style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.5, marginBottom: 10 }}>{a.assessment?.slice(0, 90)}...</div><ScoreBar value={a.priorityScore} color={p.color} /></>
                  : <div style={{ fontSize: 11, color: "var(--text3)" }}>Click to configure this pillar</div>
                }
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent check-ins */}
      {recentLogs.length > 0 && (
        <div className="fu3">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2 }}>RECENT CHECK-INS</Mono>
            <button onClick={() => onNav("interview")} style={{ background: "none", border: "none", color: "var(--text3)", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1 }}>ALL HISTORY →</button>
          </div>
          {recentLogs.map(log => (
            <div key={log.id} style={{ background: "var(--bg1)", border: "1px solid var(--border)", padding: "12px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1, display: "block", marginBottom: 5 }}>{new Date(log.date).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}</Mono>
                <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>{log.digest || "No digest available."}</div>
              </div>
              {log.missionIds?.length > 0 && <Tag color="var(--c)">{log.missionIds.length} missions</Tag>}
            </div>
          ))}
        </div>
      )}

      {/* Active missions preview */}
      {activeMissions.length > 0 && (
        <div className="fu3">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2 }}>ACTIVE MISSIONS</Mono>
            <button onClick={() => onNav("missions")} style={{ background: "none", border: "none", color: "var(--text3)", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1 }}>ALL →</button>
          </div>
          {activeMissions.slice(0, 3).map(m => (
            <div key={m.id} style={{ background: "var(--bg1)", border: "1px solid var(--border)", padding: "12px 14px", display: "flex", gap: 12, alignItems: "center", marginBottom: 6 }}>
              <PillarDot id={m.pillar} size={6} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{m.title}</div>
                <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 2 }}>{m.estimatedTime} · {m.category}</div>
              </div>
              <DiffTag level={m.difficulty} />
            </div>
          ))}
        </div>
      )}

      <TrendsSection state={state} />
    </div>
  );
}