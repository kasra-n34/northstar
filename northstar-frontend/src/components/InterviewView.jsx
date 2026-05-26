import { useState, useEffect, useRef, useCallback } from "react";
import { PILLARS, LOG_RETENTION_WEEKS } from "../constants";
import { callClaude, parseJSON } from "../api";
import { INTERVIEW_SYS, buildInterviewQuestions, isSunday, checkinDoneThisWeek, getNextSunday } from "../prompts";
import { Mono, Tag, PillarDot, DiffTag } from "./ui";
import { parseInstagramConnectionsZip, parseHevyCSV } from "./IntegrationsView";

// ─── Web Push notification helpers ────────────────────────────────────────────

async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  const result = await Notification.requestPermission();
  return result;
}

function scheduleLocalReminder() {
  // We can't schedule a future push notification without a service worker + push server.
  // Best we can do in a plain web app: store the preference and fire when the tab is open.
  localStorage.setItem("northstar_notify_sunday", "true");
}

function cancelLocalReminder() {
  localStorage.removeItem("northstar_notify_sunday");
}

function getNotifyEnabled() {
  return localStorage.getItem("northstar_notify_sunday") === "true";
}

// Fire an in-browser notification if it's Sunday and check-in is due
function maybeSendSundayNotification(lastInterviewDate) {
  if (!getNotifyEnabled()) return;
  if (Notification.permission !== "granted") return;
  if (!isSunday()) return;
  if (checkinDoneThisWeek(lastInterviewDate)) return;

  const alreadyFired = sessionStorage.getItem("northstar_notified_today");
  if (alreadyFired) return;
  sessionStorage.setItem("northstar_notified_today", "true");

  new Notification("northstar Weekly Check-In", {
    body: "Your Sunday review is ready. Take 3 minutes to reflect on your week.",
    icon: "/favicon.ico",
    tag: "northstar-checkin",
  });
}

// ─── Log card ─────────────────────────────────────────────────────────────────

function LogCard({ log, idx }) {
  const [exp, setExp] = useState(false);
  return (
    <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", marginBottom: 10, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2, background: "var(--c)44" }} />
      <div style={{ padding: "14px 16px 14px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
              <Mono s={{ fontSize: 9, color: "var(--c)", letterSpacing: 1 }}>{new Date(log.date).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}</Mono>
              {log.compressed && <Tag color="var(--text3)">COMPRESSED</Tag>}
              {idx === 0 && <Tag color="var(--c)">LATEST</Tag>}
            </div>
            <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>{log.digest}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {log.missionIds?.length > 0 && <Tag color="var(--o)">{log.missionIds.length} missions</Tag>}
            <button onClick={() => setExp(e => !e)} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 11 }}>{exp ? "▲" : "▼"}</button>
          </div>
        </div>
        {exp && !log.compressed && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 4 }}>
            {log.progressSummary && (
              <div style={{ marginBottom: 12 }}>
                <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 5 }}>ASSESSMENT</Mono>
                <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.6 }}>{log.progressSummary}</div>
              </div>
            )}
            {(log.keyWin || log.keyBlocker) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                {log.keyWin     && <div style={{ background: "var(--bg2)", padding: "10px 12px" }}><Mono s={{ fontSize: 8, color: "var(--g)", letterSpacing: 1.5, display: "block", marginBottom: 4 }}>WIN</Mono><div style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.4 }}>{log.keyWin}</div></div>}
                {log.keyBlocker && <div style={{ background: "var(--bg2)", padding: "10px 12px" }}><Mono s={{ fontSize: 8, color: "var(--o)", letterSpacing: 1.5, display: "block", marginBottom: 4 }}>BLOCKER</Mono><div style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.4 }}>{log.keyBlocker}</div></div>}
              </div>
            )}
            {log.feedback?.length > 0 && (
              <div>
                <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 6 }}>FEEDBACK</Mono>
                {log.feedback.map((f, i) => <div key={i} style={{ fontSize: 11, color: "var(--text3)", paddingLeft: 10, borderLeft: "1px solid var(--border2)", lineHeight: 1.5, marginBottom: 4 }}>{f}</div>)}
              </div>
            )}
          </div>
        )}
        {exp && log.compressed && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 4 }}>
            <div style={{ fontSize: 11, color: "var(--text3)", fontStyle: "italic" }}>Full answers were compressed — logs older than 1 week are kept as digest only.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Notification panel ───────────────────────────────────────────────────────

function NotificationPanel({ lastInterviewDate }) {
  const [permission,  setPermission]  = useState(Notification?.permission || "unsupported");
  const [enabled,     setEnabled]     = useState(getNotifyEnabled());
  const nextSunday = getNextSunday();
  const supported  = "Notification" in window;

  const handleEnable = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === "granted") { scheduleLocalReminder(); setEnabled(true); }
  };

  const handleDisable = () => { cancelLocalReminder(); setEnabled(false); };

  // Fire notification check on mount
  useEffect(() => {
    maybeSendSundayNotification(lastInterviewDate);
  }, [lastInterviewDate]);

  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", padding: "16px 18px" }}>
      <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 12 }}>🔔 SUNDAY REMINDERS</Mono>

      {!supported && (
        <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.6 }}>
          Browser notifications aren't supported in this environment.
        </div>
      )}

      {supported && (
        <>
          <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6, marginBottom: 14 }}>
            {enabled
              ? <>Reminders are <span style={{ color: "var(--g)" }}>on</span>. When you have northstar open on a Sunday, you'll get a browser notification if your check-in isn't done yet.</>
              : <>Get a browser notification every Sunday reminding you to do your check-in. <span style={{ color: "var(--text3)" }}>Requires the app to be open in a tab.</span></>
            }
          </div>

          {/* Next Sunday */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "10px 12px", background: "var(--bg3)", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 16 }}>📅</span>
            <div>
              <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 2 }}>NEXT CHECK-IN</Mono>
              <div style={{ fontSize: 12, color: "var(--text)" }}>
                {nextSunday.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })} at 8:00 PM
              </div>
            </div>
          </div>

          {permission === "denied" && (
            <div style={{ fontSize: 11, color: "var(--o)", lineHeight: 1.6, marginBottom: 12 }}>
              Notifications are blocked in your browser settings. Go to <strong>Settings → Site Settings → Notifications</strong> and allow this site.
            </div>
          )}

          {!enabled && permission !== "denied" && (
            <button onClick={handleEnable} style={{ background: "var(--c)", color: "#000", border: "none", padding: "9px 18px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1 }}>
              ENABLE SUNDAY REMINDERS →
            </button>
          )}

          {enabled && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Tag color="var(--g)">✓ REMINDERS ON</Tag>
              <button onClick={handleDisable} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "5px 12px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1 }}>TURN OFF</button>
            </div>
          )}

          <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--bg3)", border: "1px solid var(--border2)" }}>
            <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 6 }}>FOR PHONE NOTIFICATIONS</Mono>
            <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.7 }}>
              On iPhone: open northstar in Safari → Share → <em>Add to Home Screen</em>. Then open the homescreen app on Sundays — browser notifications will fire.<br />
              On Android: Chrome supports background push natively once you allow notifications.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function InterviewView({ state, onSaveLog, onAddPendingMissions, onUpdatePillarScores, onUpdatePillarAnswers, onRunSync, onSaveIntegrations, onDeleteMission, onDeleteRecurring, onUpdateMission, onUpdateRecurring }) {
  const { analyses = {}, weeklyLogs = [], lastInterviewDate } = state;
  const [phase,            setPhase]            = useState("intro");
  const [answers,          setAnswers]          = useState({});
  const [currentQ,         setCurrentQ]         = useState(0);
  const [result,           setResult]           = useState(null);
  const [removalDecisions, setRemovalDecisions] = useState({}); // {missionId: 'accepted'|'declined'}
  const [updateDecisions,  setUpdateDecisions]  = useState({}); // {missionId: 'accepted'|'declined'}

  // Data refresh phase
  const [hevyStatus, setHevyStatus] = useState("idle"); // idle | uploading | done | error
  const [igStatus,   setIgStatus]   = useState("idle");
  const [hevyError,  setHevyError]  = useState(null);
  const [igError,    setIgError]    = useState(null);
  const hevyRef = useRef();
  const igRef   = useRef();

  const questions   = buildInterviewQuestions(analyses, weeklyLogs);
  const sortedLogs  = [...weeklyLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
  const doneThisWeek= checkinDoneThisWeek(lastInterviewDate);
  const todayIsSunday = isSunday();
  const nextSunday  = getNextSunday();
  const daysUntil   = Math.ceil((nextSunday - new Date()) / (1000 * 60 * 60 * 24));
  const canInterview= Object.keys(analyses).length > 0;
  const q           = questions[currentQ];
  const progress    = ((currentQ + 1) / questions.length) * 100;

  // Fire notification check whenever the view mounts
  useEffect(() => {
    maybeSendSundayNotification(lastInterviewDate);
  }, [lastInterviewDate]);

  const setAnswer = (key, val) => setAnswers(a => ({ ...a, [key]: val }));
  const goPrev    = () => setCurrentQ(q => Math.max(0, q - 1));
  const reset = () => { setPhase("intro"); setAnswers({}); setCurrentQ(0); setResult(null); setRemovalDecisions({}); setUpdateDecisions({}); };

  // ── Data refresh upload handlers ──────────────────────────────────────────────
  const handleHevyUpload = useCallback((file) => {
    if (!file || !file.name.endsWith(".csv")) { setHevyError("Please upload a .csv file."); return; }
    setHevyStatus("uploading"); setHevyError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseHevyCSV(e.target.result);
        if (!parsed) { setHevyError("Couldn't parse this CSV. Make sure it's a Hevy workout export."); setHevyStatus("error"); return; }
        const workoutData = { ...parsed, uploadedAt: new Date().toISOString() };
        workoutData.sessions = parsed.sessions.map(s => ({ ...s, date: s.date.toISOString() }));
        Object.keys(workoutData.exerciseHistory).forEach(ex => {
          workoutData.exerciseHistory[ex] = parsed.exerciseHistory[ex].map(h => ({ ...h, date: h.date.toISOString() }));
        });
        workoutData.dateRange = parsed.dateRange ? { from: parsed.dateRange.from.toISOString(), to: parsed.dateRange.to.toISOString() } : null;
        onSaveIntegrations({ ...state.integrations, workoutData });
        setHevyStatus("done");
      } catch (err) { setHevyError(err.message); setHevyStatus("error"); }
    };
    reader.readAsText(file);
  }, [state.integrations, onSaveIntegrations]);

  const handleIgUpload = useCallback(async (file) => {
    if (!file || !file.name.endsWith(".zip")) { setIgError("Please upload a .zip file."); return; }
    setIgStatus("uploading"); setIgError(null);
    try {
      const parsed = await parseInstagramConnectionsZip(file);
      if (!parsed) { setIgError("No connection data found. Make sure it's from your Instagram data export."); setIgStatus("error"); return; }
      onSaveIntegrations({ ...state.integrations, instagramData: parsed });
      setIgStatus("done");
    } catch (err) { setIgError(err.message); setIgStatus("error"); }
  }, [state.integrations, onSaveIntegrations]);

  const goNext = () => {
    if (currentQ < questions.length - 1) setCurrentQ(q => q + 1);
    else submitInterview();
  };

  const submitInterview = async () => {
    setPhase("processing");

    const recentDigests = sortedLogs.slice(0, 4).map((l, i) => {
      const date = new Date(l.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
      if (l.pillarDigests && Object.keys(l.pillarDigests).length > 0) {
        const parts = Object.entries(l.pillarDigests).map(([pid, d]) => `  [${pid}] ${d}`).join("\n");
        return `Week -${i + 1} (${date}):\n${parts}`;
      }
      return `Week -${i + 1} (${date}): ${l.digest || "No digest."}`;
    }).join("\n\n");

    const pillarState = PILLARS.map(p => {
      const a = analyses[p.id];
      return a ? `${p.label}(score:${a.priorityScore}): ${a.keyInsight?.slice(0, 80) || ""}` : "";
    }).filter(Boolean).join(" | ");

    const ONE_WEEK_AGO = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const completedThisWeek = (state.missions || [])
      .filter(m => {
        if (!(state.completedMissions || []).includes(m.id)) return false;
        const ts = (state.missionCompletedAt || {})[m.id];
        return ts ? new Date(ts).getTime() > ONE_WEEK_AGO : false;
      })
      .map(m => `[${m.pillar}] ${m.title}`)
      .join(", ");
    const nowTs = Date.now();
    const overdueMissions = (state.missions || [])
      .filter(m =>
        !(state.completedMissions || []).includes(m.id) &&
        m.deadlineDate && new Date(m.deadlineDate).getTime() < nowTs
      )
      .map(m => {
        const daysOverdue = Math.ceil((nowTs - new Date(m.deadlineDate).getTime()) / (1000 * 60 * 60 * 24));
        return `[${m.pillar}] ${m.title} (${daysOverdue}d overdue)`;
      })
      .join(", ");

    // Recurring habit progress this week
    const recurringProgress = (state.recurringMissions || [])
      .map(m => {
        const p = m.progressCount || 0;
        const t = m.targetCount || 1;
        const hit = p >= t;
        return `[${m.pillar}] ${m.title}: ${p}/${t} ${hit ? "(✓ goal met)" : "(not yet met)"}`;
      })
      .join(", ");

    // Active counted/subtask mission progress
    const activeMissionProgress = (state.missions || [])
      .filter(m => !(state.completedMissions || []).includes(m.id))
      .filter(m => (m.missionType === "counted" && m.targetCount) || m.subtasks?.length > 0)
      .map(m => {
        if (m.missionType === "counted") {
          return `[${m.pillar}] ${m.title}: ${m.progressCount || 0}/${m.targetCount} done`;
        }
        const done = (m.subtasks || []).filter(s => s.done).length;
        const total = m.subtasks.length;
        return `[${m.pillar}] ${m.title}: ${done}/${total} subtasks complete`;
      })
      .join(", ");

    const qaText = questions.map(q => `Q: ${q.q}\nA: ${answers[q.key] || "(no answer)"}`).join("\n\n");

    // Build a full list of existing missions with IDs so Claude can reference them in removals/updates
    const existingMissionsCtx = [
      ...(state.missions || [])
        .filter(m => !(state.completedMissions || []).includes(m.id))
        .map(m => `id:${m.id} | [${m.pillar}] "${m.title}" | type:${m.missionType}${m.targetCount ? ` target:${m.targetCount}` : ''}`),
      ...(state.recurringMissions || [])
        .map(m => `id:${m.id} | [${m.pillar}] "${m.title}" | recurring target:${m.targetCount || 1}x/week progress:${m.progressCount || 0}/${m.targetCount || 1}`),
    ].join('\n');

    const contextMsg = [
      recentDigests ? `RECENT LOG HISTORY:\n${recentDigests}` : "No prior logs.",
      `CURRENT PILLAR STATE: ${pillarState}`,
      existingMissionsCtx ? `EXISTING MISSIONS (use exact ids for missionRemovals/missionUpdates):\n${existingMissionsCtx}` : "",
      completedThisWeek ? `MISSIONS COMPLETED THIS WEEK: ${completedThisWeek}` : "",
      activeMissionProgress ? `IN-PROGRESS MISSION COUNTS: ${activeMissionProgress}` : "",
      recurringProgress ? `RECURRING HABIT PROGRESS THIS WEEK: ${recurringProgress}` : "",
      overdueMissions ? `OVERDUE MISSIONS (past deadline, not completed): ${overdueMissions}` : "",
      `THIS WEEK'S CHECK-IN:\n${qaText}`,
    ].filter(Boolean).join("\n\n");

    try {
      const text   = await callClaude([{ role: "user", content: contextMsg }], INTERVIEW_SYS, false);
      const parsed = parseJSON(text);
      if (parsed) {
        const logId              = `log_${Date.now()}`;
        const newMissionsWithIds = (parsed.newMissions || []).slice(0, 2).map((m, i) => ({ ...m, id: `nw_${logId}_${i}`, source: "check-in" }));

        // Validate removal suggestions: mission must actually exist
        const missionRemovals = (parsed.missionRemovals || []).slice(0, 1).map(r => {
          const inActive    = (state.missions || []).find(m => m.id === r.missionId && !(state.completedMissions || []).includes(m.id));
          const inRecurring = (state.recurringMissions || []).find(m => m.id === r.missionId);
          if (inActive)    return { ...r, missionKind: "active",    pillar: inActive.pillar };
          if (inRecurring) return { ...r, missionKind: "recurring", pillar: inRecurring.pillar };
          return null;
        }).filter(Boolean);

        // Validate update suggestions: mission must actually exist
        const missionUpdates = (parsed.missionUpdates || []).slice(0, 2).map(u => {
          const inActive    = (state.missions || []).find(m => m.id === u.missionId && !(state.completedMissions || []).includes(m.id));
          const inRecurring = (state.recurringMissions || []).find(m => m.id === u.missionId);
          if (inActive)    return { ...u, missionKind: "active",    pillar: inActive.pillar };
          if (inRecurring) return { ...u, missionKind: "recurring", pillar: inRecurring.pillar };
          return null;
        }).filter(Boolean);

        const log = {
          id: logId, date: new Date().toISOString(), answers,
          digest: parsed.digest, pillarDigests: parsed.pillarDigests || {},
          feedback: parsed.feedback,
          progressSummary: parsed.progressSummary, keyWin: parsed.keyWin,
          keyBlocker: parsed.keyBlocker, encouragement: parsed.encouragement,
          missionIds: newMissionsWithIds.map(m => m.id), compressed: false,
        };
        onSaveLog(log);
        if (newMissionsWithIds.length > 0) onAddPendingMissions(newMissionsWithIds);
        if (parsed.pillarDeltas) onUpdatePillarScores(parsed.pillarDeltas);
        setResult({ ...parsed, newMissions: newMissionsWithIds, missionRemovals, missionUpdates, checkInAnswers: answers });
        setPhase("results");
      }
    } catch (e) { console.error(e); setPhase("interview"); }
  };

  // Directly apply check-in answers to pillar status fields, then run sync
  const applyAndSync = () => {
    const activePillars = PILLARS.filter(p => analyses[p.id] && state.profiles[p.id]);
    for (const pillar of activePillars) {
      const profile     = state.profiles[pillar.id];
      const coreAnswers = {};
      for (const q of pillar.questions.filter(pq => pq.core)) {
        const v = profile?.answers?.[q.key];
        if (v !== undefined) coreAnswers[q.key] = v;
      }
      const statusAnswers = {};
      for (const q of pillar.questions.filter(pq => !pq.core)) {
        if (answers[q.key] !== undefined) statusAnswers[q.key] = answers[q.key];
      }
      onUpdatePillarAnswers(pillar.id, { answers: { ...coreAnswers, ...statusAnswers }, extra: profile?.extra || "" });
    }
    setPhase("syncing");
    onRunSync().then(() => setPhase("done"));
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, paddingBottom: 18, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ color: "var(--c)", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 3, marginBottom: 5 }}>⟳ WEEKLY CHECK-IN</div>
          <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 34, letterSpacing: 1, color: "var(--text)" }}>Sunday Review</h2>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
            {doneThisWeek
              ? <span style={{ color: "var(--g)" }}>✓ Done this week · Next Sunday {nextSunday.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>
              : todayIsSunday
                ? <span style={{ color: "var(--c)" }}>Today is Sunday — your check-in is ready</span>
                : <span>Next check-in: <strong>Sunday {nextSunday.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</strong> · {daysUntil} day{daysUntil !== 1 ? "s" : ""} away</span>
            }
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {phase !== "history" && sortedLogs.length > 0 && (
            <button onClick={() => setPhase("history")} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "7px 14px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1 }}>HISTORY</button>
          )}
          {phase === "history" && (
            <button onClick={() => setPhase("intro")} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "7px 14px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1 }}>← BACK</button>
          )}
        </div>
      </div>

      {!canInterview && (
        <div style={{ textAlign: "center", padding: "70px 0" }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 38, color: "var(--border2)", marginBottom: 14 }}>SET UP PILLARS FIRST</div>
          <div style={{ color: "var(--text3)", fontSize: 13 }}>Complete at least one pillar analysis before doing a weekly check-in.</div>
        </div>
      )}

      {/* INTRO */}
      {canInterview && phase === "intro" && (
        <div style={{ maxWidth: 704, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Status card */}
          <div style={{ background: doneThisWeek ? "var(--g)0D" : todayIsSunday ? "var(--c)0D" : "var(--bg2)", border: `1px solid ${doneThisWeek ? "var(--g)44" : todayIsSunday ? "var(--c)44" : "var(--border)"}`, padding: 20, position: "relative", overflow: "hidden" }}>
            {todayIsSunday && !doneThisWeek && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,var(--c),transparent)" }} />}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <Mono s={{ fontSize: 9, color: doneThisWeek ? "var(--g)" : todayIsSunday ? "var(--c)" : "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 6 }}>
                  {doneThisWeek ? "✓ THIS WEEK COMPLETE" : todayIsSunday ? "TODAY IS CHECK-IN DAY" : "SCHEDULED FOR SUNDAY"}
                </Mono>
                <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>
                  {doneThisWeek
                    ? `You completed this week's review. Next one is Sunday ${nextSunday.toLocaleDateString("en-CA", { month: "long", day: "numeric" })}.`
                    : todayIsSunday
                      ? `${questions.length} questions, ~3 minutes. northstar compares against your previous ${Math.min(sortedLogs.length, 4)} weeks and generates updated missions.`
                      : `Check-ins happen every Sunday. Come back in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}, or do it early below.`
                  }
                </div>
              </div>
              {(todayIsSunday && !doneThisWeek) && (
                <button onClick={() => { setPhase("data-refresh"); }} style={{ background: "var(--c)", color: "#000", border: "none", padding: "12px 22px", fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2, fontWeight: 500, flexShrink: 0 }}>
                  BEGIN →
                </button>
              )}
            </div>
          </div>

          {/* Early / redo option when not Sunday */}
          {(!todayIsSunday || doneThisWeek) && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => { setPhase("interview"); setCurrentQ(0); setAnswers({}); }} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text2)", padding: "8px 16px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1 }}>
                {doneThisWeek ? "↺ REDO THIS WEEK'S CHECK-IN" : "DO IT EARLY →"}
              </button>
              <Mono s={{ fontSize: 10, color: "var(--text3)" }}>{questions.length} questions · ~3 min</Mono>
            </div>
          )}

          {/* Prior context */}
          {sortedLogs.length > 0 && (
            <div>
              <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 10 }}>CONTEXT northstar WILL USE</Mono>
              {sortedLogs.slice(0, 3).map((l, i) => (
                <div key={l.id} style={{ background: "var(--bg1)", border: "1px solid var(--border)", padding: "10px 14px", marginBottom: 6, display: "flex", gap: 12 }}>
                  <Mono s={{ fontSize: 9, color: "var(--text3)", flexShrink: 0 }}>W-{i + 1}</Mono>
                  <div>
                    <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1, display: "block", marginBottom: 3 }}>{new Date(l.date).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}{l.compressed ? " · COMPRESSED" : ""}</Mono>
                    <div style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.5 }}>{l.digest}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notification panel */}
          <NotificationPanel lastInterviewDate={lastInterviewDate} />
        </div>
      )}

      {/* DATA REFRESH */}
      {canInterview && phase === "data-refresh" && (() => {
        const integrations = state.integrations || {};
        const hasHevy = !!integrations.workoutData;
        const hasIg   = !!integrations.instagramData;

        const UploadCard = ({ icon, title, subtitle, hasData, uploadedAt, status, error, fileRef, accept, onFile, accentColor }) => {
          const color = accentColor || "var(--c)";
          const isDone  = status === "done";
          const isUploading = status === "uploading";
          const displayDone = isDone || (hasData && status === "idle");
          return (
            <div style={{ background: "var(--bg1)", border: `1px solid ${isDone ? color + "55" : "var(--border)"}`, padding: "16px 18px", position: "relative" }}>
              {isDone && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{icon}</span>
                    <Mono s={{ fontSize: 11, color: isDone ? color : "var(--text)", letterSpacing: 1 }}>{title}</Mono>
                    {displayDone && !isDone && hasData && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 8, color: "var(--text3)", background: "var(--bg3)", padding: "2px 6px" }}>HAS DATA</span>}
                    {isDone && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 8, color, background: color + "15", padding: "2px 6px" }}>✓ UPDATED</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.5 }}>{subtitle}</div>
                  {hasData && uploadedAt && status === "idle" && (
                    <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4 }}>Last upload: {new Date(uploadedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</div>
                  )}
                  {error && <div style={{ fontSize: 11, color: "var(--r)", marginTop: 6 }}>⚠ {error}</div>}
                </div>
                <div style={{ flexShrink: 0 }}>
                  {isUploading
                    ? <div style={{ width: 28, height: 28, border: `2px solid ${color}33`, borderTop: `2px solid ${color}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    : isDone
                      ? <span style={{ fontSize: 20 }}>✓</span>
                      : (
                        <button
                          onClick={() => fileRef.current?.click()}
                          style={{ background: hasData ? "var(--bg3)" : color, color: hasData ? "var(--text2)" : "#000", border: hasData ? "1px solid var(--border)" : "none", padding: "7px 14px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1, cursor: "pointer" }}
                        >
                          {hasData ? "UPDATE" : "UPLOAD"}
                        </button>
                      )
                  }
                  <input ref={fileRef} type="file" accept={accept} style={{ display: "none" }} onChange={e => onFile(e.target.files[0])} />
                </div>
              </div>
            </div>
          );
        };

        return (
          <div style={{ maxWidth: 704, display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <Mono s={{ fontSize: 9, color: "var(--c)", letterSpacing: 2, display: "block", marginBottom: 6 }}>STEP 1 OF 4 · DATA REFRESH</Mono>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 30, color: "var(--text)", letterSpacing: 1, marginBottom: 8 }}>Update Your Data</div>
              <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.6 }}>Before your check-in, upload fresh data from your connected sources. All fields are optional — skip anything you haven't updated this week.</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <UploadCard
                icon="🏋️"
                title="HEVY WORKOUT DATA"
                subtitle="Export your latest workout CSV from Hevy → Profile → Export Data."
                hasData={hasHevy}
                uploadedAt={integrations.workoutData?.uploadedAt}
                status={hevyStatus}
                error={hevyError}
                fileRef={hevyRef}
                accept=".csv"
                onFile={handleHevyUpload}
                accentColor="var(--y)"
              />
              <UploadCard
                icon="📸"
                title="INSTAGRAM CONNECTIONS"
                subtitle={<>
                  Go to <a href="https://accountscenter.instagram.com/info_and_permissions/dyi/" target="_blank" rel="noreferrer" style={{ color: "var(--p, #E1306C)" }}>Instagram Privacy Centre → Download your information</a>, select <strong style={{ color: "var(--text)" }}>JSON format</strong> and set the date range to <strong style={{ color: "var(--text)" }}>All time</strong>. Request and download the export, then upload the <strong style={{ color: "var(--text)" }}>followers_and_following.zip</strong> here. northstar extracts your follower count, following count, and follow-back rate to inform your Social &amp; Network analysis.
                </>}
                hasData={hasIg}
                uploadedAt={integrations.instagramData?.uploadedAt}
                status={igStatus}
                error={igError}
                fileRef={igRef}
                accept=".zip"
                onFile={handleIgUpload}
                accentColor="var(--p, #E1306C)"
              />
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
              <button
                onClick={() => { setPhase("interview"); setCurrentQ(0); setAnswers({}); }}
                style={{ background: "var(--c)", color: "#000", border: "none", padding: "11px 26px", fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2, fontWeight: 600 }}
              >
                CONTINUE TO CHECK-IN →
              </button>
              <Mono s={{ fontSize: 9, color: "var(--text3)" }}>or skip — data from last upload will be used</Mono>
            </div>
          </div>
        );
      })()}

      {/* INTERVIEW */}
      {canInterview && phase === "interview" && (
        <div style={{ maxWidth: 704 }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <Mono s={{ fontSize: 9, color: "var(--c)", letterSpacing: 1 }}>QUESTION {currentQ + 1} OF {questions.length}</Mono>
              <Mono s={{ fontSize: 9, color: "var(--text3)" }}>{Math.round(progress)}%</Mono>
            </div>
            <div style={{ height: 2, background: "var(--border)" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "var(--c)", transition: "width 0.3s ease" }} />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            {q.pillar && (() => {
              const p = PILLARS.find(p => p.id === q.pillar);
              return p ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 10, padding: "3px 8px", border: `1px solid ${p.color}44`, background: `${p.color}11` }}>
                  <span style={{ fontSize: 10 }}>{p.icon}</span>
                  <Mono s={{ fontSize: 8, color: p.color, letterSpacing: 1.5 }}>{p.label}</Mono>
                </div>
              ) : null;
            })()}
            <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text)", lineHeight: 1.6, marginBottom: 16 }}>{q.q}</div>
            {q.type === "yesno" ? (
              <div style={{ display: "flex", gap: 12 }}>
                {["yes", "no"].map(opt => {
                  const selected = answers[q.key] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setAnswer(q.key, opt)}
                      style={{
                        background: selected ? "var(--c)" : "var(--bg2)",
                        color: selected ? "#000" : "var(--text2)",
                        border: `1px solid ${selected ? "var(--c)" : "var(--border)"}`,
                        padding: "14px 36px",
                        fontFamily: "'DM Mono',monospace",
                        fontSize: 12,
                        letterSpacing: 2,
                        fontWeight: selected ? 600 : 400,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {opt.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            ) : (
              <textarea
                key={q.key}
                rows={4}
                value={answers[q.key] || ""}
                onChange={e => setAnswer(q.key, e.target.value)}
                placeholder="Be honest and specific..."
                autoFocus
                style={{ width: "100%", padding: "12px 14px", fontSize: 13, resize: "vertical", lineHeight: 1.7 }}
              />
            )}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {currentQ > 0 && (
              <button onClick={goPrev} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "10px 18px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1 }}>← BACK</button>
            )}
            <button onClick={goNext} style={{ background: answers[q.key]?.trim() ? "var(--c)" : "var(--bg3)", color: answers[q.key]?.trim() ? "#000" : "var(--text3)", border: "none", padding: "10px 24px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1.5, fontWeight: 500 }}>
              {currentQ === questions.length - 1 ? "SUBMIT & ANALYZE →" : "NEXT →"}
            </button>
            {!answers[q.key]?.trim() && (
              <button onClick={goNext} style={{ background: "none", border: "none", color: "var(--text3)", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1 }}>SKIP</button>
            )}
          </div>

          {/* Question list */}
          <div style={{ marginTop: 32, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
            <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 10 }}>ALL QUESTIONS</Mono>
            {questions.map((qq, i) => (
              <button key={qq.key} onClick={() => setCurrentQ(i)} style={{ display: "flex", gap: 10, alignItems: "center", width: "100%", textAlign: "left", background: "none", border: "none", padding: "5px 0", marginBottom: 2 }}>
                <div style={{ width: 16, height: 16, border: `1px solid ${answers[qq.key]?.trim() ? "var(--c)" : "var(--border)"}`, background: answers[qq.key]?.trim() ? "var(--c)22" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {answers[qq.key]?.trim() && <span style={{ color: "var(--c)", fontSize: 9 }}>✓</span>}
                  {i === currentQ && !answers[qq.key]?.trim() && <span style={{ width: 4, height: 4, background: "var(--text3)", borderRadius: "50%", display: "block" }} />}
                </div>
                <div style={{ fontSize: 11, color: i === currentQ ? "var(--text)" : answers[qq.key]?.trim() ? "var(--text2)" : "var(--text3)", lineHeight: 1.4 }}>{qq.q}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PROCESSING */}
      {canInterview && phase === "processing" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 20 }}>
          <div style={{ width: 48, height: 48, border: "2px solid var(--c)22", borderTop: "2px solid var(--c)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <Mono s={{ fontSize: 9, color: "var(--c)", letterSpacing: 3 }}>northstar IS ANALYZING YOUR WEEK...</Mono>
          <div style={{ fontSize: 11, color: "var(--text3)", textAlign: "center", maxWidth: 360, lineHeight: 1.7 }}>Comparing against previous logs, assessing progress, generating personalised missions...</div>
        </div>
      )}

      {/* RESULTS */}
      {canInterview && phase === "results" && result && (
        <div style={{ maxWidth: 770, display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="fu" style={{ background: "var(--c)0D", border: "1px solid var(--c)44", padding: 22, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,var(--c),transparent)" }} />
            <Mono s={{ fontSize: 9, color: "var(--c)", letterSpacing: 2, display: "block", marginBottom: 10 }}>THIS WEEK'S ASSESSMENT</Mono>
            <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.7, marginBottom: 14 }}>{result.progressSummary}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "var(--bg3)", padding: "12px 14px" }}><Mono s={{ fontSize: 8, color: "var(--g)", letterSpacing: 1.5, display: "block", marginBottom: 5 }}>KEY WIN</Mono><div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>{result.keyWin}</div></div>
              <div style={{ background: "var(--bg3)", padding: "12px 14px" }}><Mono s={{ fontSize: 8, color: "var(--o)", letterSpacing: 1.5, display: "block", marginBottom: 5 }}>KEY BLOCKER</Mono><div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>{result.keyBlocker}</div></div>
            </div>
          </div>

          {result.pillarDeltas && (
            <div className="fu1">
              <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 12 }}>PILLAR SCORE ADJUSTMENTS</Mono>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {PILLARS.map(p => {
                  const delta = result.pillarDeltas?.[p.id];
                  if (!delta) return null;
                  const current  = analyses[p.id]?.priorityScore || 0;
                  const newScore = Math.max(1, Math.min(100, current + (delta.delta || 0)));
                  return (
                    <div key={p.id} style={{ background: "var(--bg1)", border: "1px solid var(--border)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}><Mono s={{ fontSize: 9, color: p.color, letterSpacing: 1, display: "block", marginBottom: 2 }}>{p.label}</Mono><div style={{ fontSize: 10, color: "var(--text3)", lineHeight: 1.4 }}>{delta.note}</div></div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: delta.delta > 0 ? "var(--g)" : delta.delta < 0 ? "var(--r)" : "var(--text3)", lineHeight: 1 }}>{delta.delta > 0 ? "+" : ""}{delta.delta !== 0 ? delta.delta : "—"}</div>
                        <Mono s={{ fontSize: 8, color: "var(--text3)" }}>{current}→{newScore}</Mono>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {result.feedback?.length > 0 && (
            <div className="fu2">
              <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 12 }}>northstar FEEDBACK</Mono>
              {result.feedback.map((f, i) => <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10 }}><span style={{ color: "var(--c)", fontSize: 11, flexShrink: 0 }}>◈</span><div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>{f}</div></div>)}
            </div>
          )}

          {/* Mission removal suggestions */}
          {result.missionRemovals?.length > 0 && (
            <div className="fu3a" style={{ border: "1px solid var(--r)44", padding: 18 }}>
              <Mono s={{ fontSize: 9, color: "var(--r)", letterSpacing: 2, display: "block", marginBottom: 12 }}>⚠ SUGGESTED MISSION REMOVAL</Mono>
              {result.missionRemovals.map(r => {
                const decision = removalDecisions[r.missionId];
                return (
                  <div key={r.missionId} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                      <PillarDot id={r.pillar} size={5} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 3 }}>"{r.title}"</div>
                        <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.5 }}>{r.reason}</div>
                      </div>
                      <Mono s={{ fontSize: 8, color: "var(--text3)", background: "var(--bg3)", padding: "2px 6px", flexShrink: 0 }}>{r.missionKind}</Mono>
                    </div>
                    {!decision && (
                      <div style={{ display: "flex", gap: 8, paddingLeft: 15 }}>
                        <button
                          onClick={() => {
                            if (r.missionKind === "recurring") onDeleteRecurring(r.missionId);
                            else onDeleteMission(r.missionId);
                            setRemovalDecisions(d => ({ ...d, [r.missionId]: "accepted" }));
                          }}
                          style={{ background: "var(--r)", color: "#fff", border: "none", padding: "6px 14px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1, cursor: "pointer" }}
                        >
                          REMOVE
                        </button>
                        <button
                          onClick={() => setRemovalDecisions(d => ({ ...d, [r.missionId]: "declined" }))}
                          style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "6px 14px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1, cursor: "pointer" }}
                        >
                          KEEP
                        </button>
                      </div>
                    )}
                    {decision === "accepted" && <Mono s={{ fontSize: 9, color: "var(--r)", paddingLeft: 15 }}>✓ Removed</Mono>}
                    {decision === "declined" && <Mono s={{ fontSize: 9, color: "var(--text3)", paddingLeft: 15 }}>Kept</Mono>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Mission update suggestions */}
          {result.missionUpdates?.length > 0 && (
            <div className="fu3b" style={{ border: "1px solid var(--c)44", padding: 18 }}>
              <Mono s={{ fontSize: 9, color: "var(--c)", letterSpacing: 2, display: "block", marginBottom: 12 }}>✏ SUGGESTED MISSION UPDATES</Mono>
              {result.missionUpdates.map(u => {
                const decision = updateDecisions[u.missionId];
                const changes  = u.proposedChanges || {};
                const changeLines = [
                  changes.title       ? `Title: "${u.existingTitle}" → "${changes.title}"` : null,
                  changes.targetCount != null ? `Target: → ${changes.targetCount}` : null,
                  changes.description ? `Description updated` : null,
                  changes.why         ? `Why updated` : null,
                ].filter(Boolean);
                return (
                  <div key={u.missionId} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                      <PillarDot id={u.pillar} size={5} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 3 }}>"{u.existingTitle}"</div>
                        {changeLines.length > 0 && (
                          <div style={{ marginBottom: 4 }}>
                            {changeLines.map((cl, i) => (
                              <Mono key={i} s={{ fontSize: 9, color: "var(--c)", display: "block", lineHeight: 1.7 }}>{cl}</Mono>
                            ))}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.5 }}>{u.reason}</div>
                      </div>
                      <Mono s={{ fontSize: 8, color: "var(--text3)", background: "var(--bg3)", padding: "2px 6px", flexShrink: 0 }}>{u.missionKind}</Mono>
                    </div>
                    {!decision && (
                      <div style={{ display: "flex", gap: 8, paddingLeft: 15 }}>
                        <button
                          onClick={() => {
                            const fn = u.missionKind === "recurring" ? onUpdateRecurring : onUpdateMission;
                            fn(u.missionId, u.proposedChanges || {});
                            setUpdateDecisions(d => ({ ...d, [u.missionId]: "accepted" }));
                          }}
                          style={{ background: "var(--c)", color: "#000", border: "none", padding: "6px 14px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1, cursor: "pointer" }}
                        >
                          APPLY UPDATE
                        </button>
                        <button
                          onClick={() => setUpdateDecisions(d => ({ ...d, [u.missionId]: "declined" }))}
                          style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "6px 14px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1, cursor: "pointer" }}
                        >
                          SKIP
                        </button>
                      </div>
                    )}
                    {decision === "accepted" && <Mono s={{ fontSize: 9, color: "var(--g)", paddingLeft: 15 }}>✓ Updated</Mono>}
                    {decision === "declined" && <Mono s={{ fontSize: 9, color: "var(--text3)", paddingLeft: 15 }}>Skipped</Mono>}
                  </div>
                );
              })}
            </div>
          )}

          {result.newMissions?.length > 0 && (
            <div className="fu3" style={{ background: "var(--o)0D", border: "1px solid var(--o)33", padding: 18 }}>
              <Mono s={{ fontSize: 9, color: "var(--o)", letterSpacing: 2, display: "block", marginBottom: 12 }}>⚡ {result.newMissions.length} NEW MISSIONS ADDED TO PENDING</Mono>
              {result.newMissions.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 7 }}>
                  <PillarDot id={m.pillar} size={5} />
                  <div style={{ flex: 1, fontSize: 12, color: "var(--text)" }}>{m.title}</div>
                  <DiffTag level={m.difficulty} />
                  <Mono s={{ fontSize: 9, color: "var(--text3)" }}>{m.estimatedTime}</Mono>
                </div>
              ))}
            </div>
          )}

          <div className="fu4" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <div style={{ fontSize: 13, color: "var(--text3)", fontStyle: "italic", lineHeight: 1.7 }}>"{result.encouragement}"</div>
          </div>

          <div style={{ background: "var(--c)0D", border: "1px solid var(--c)44", padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <div>
              <Mono s={{ fontSize: 9, color: "var(--c)", letterSpacing: 1.5, display: "block", marginBottom: 4 }}>NEXT STEP</Mono>
              <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>Your check-in answers will be saved to your pillar profiles and a full sync will generate new weekly missions.</div>
            </div>
            <button onClick={applyAndSync} style={{ background: "var(--c)", color: "#000", border: "none", padding: "12px 22px", fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2, fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}>
              SAVE & SYNC →
            </button>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={reset} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "9px 20px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1 }}>← BACK</button>
            <button onClick={() => setPhase("history")} style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text2)", padding: "9px 20px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1 }}>VIEW HISTORY</button>
          </div>
        </div>
      )}

      {/* SYNCING */}
      {canInterview && phase === "syncing" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 20 }}>
          <div style={{ width: 48, height: 48, border: "2px solid var(--c)22", borderTop: "2px solid var(--c)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <Mono s={{ fontSize: 9, color: "var(--c)", letterSpacing: 3 }}>RUNNING FULL SYNC...</Mono>
          <div style={{ fontSize: 11, color: "var(--text3)", textAlign: "center", maxWidth: 400, lineHeight: 1.7 }}>northstar is re-analyzing all pillars with this week's data and generating new missions. This takes about 30–60 seconds.</div>
        </div>
      )}

      {/* DONE */}
      {canInterview && phase === "done" && (
        <div style={{ maxWidth: 660, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "var(--g)0D", border: "1px solid var(--g)44", padding: 28, textAlign: "center" }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 48, color: "var(--g)", letterSpacing: 2, marginBottom: 8 }}>WEEK LOCKED IN</div>
            <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7, marginBottom: 20 }}>Check-in complete. Pillars updated. New missions generated. Your week is loaded and ready.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={reset} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text2)", padding: "9px 20px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1 }}>← BACK TO CHECK-IN</button>
              <button onClick={() => setPhase("history")} style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text2)", padding: "9px 20px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1 }}>VIEW HISTORY</button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY */}
      {phase === "history" && (
        <div style={{ maxWidth: 770 }}>
          <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 16 }}>{sortedLogs.length} LOG{sortedLogs.length !== 1 ? "S" : ""} · LAST {state.retentionWeeks || LOG_RETENTION_WEEKS} WEEKS</Mono>
          {sortedLogs.length === 0
            ? <div style={{ textAlign: "center", padding: "60px 0" }}><div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: "var(--border2)", marginBottom: 12 }}>NO HISTORY YET</div></div>
            : sortedLogs.map((log, idx) => <LogCard key={log.id} log={log} idx={idx} />)
          }
        </div>
      )}
    </div>
  );
}