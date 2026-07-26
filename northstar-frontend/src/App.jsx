import { useState, useEffect, useCallback, useRef } from "react";

import { PILLARS, EMPTY_STATE, BACKEND } from "./constants";
import { getLastSunday, isMonday, checkinDoneThisWeek } from "./prompts";
import { loadState, scheduleSave, pruneAndCompressLogs } from "./storage";
import { runSync } from "./sync";

import { CSS, LoadingBlock, Mono, Spinner } from "./components/ui";
import OnboardingModal, { shouldShowOnboarding } from "./components/OnboardingModal";
import Sidebar          from "./components/Sidebar";
import Dashboard        from "./components/Dashboard";
import ProfileView      from "./components/ProfileView";
import PillarView       from "./components/PillarView";
import NetworkView      from "./components/NetworkView";
import MissionsView     from "./components/MissionsView";
import InterviewView    from "./components/InterviewView";
import JobHuntView      from "./components/JobHuntView";
import MetaView         from "./components/MetaView";
import IntegrationsView from "./components/IntegrationsView";
import HowItWorksView   from "./components/HowItWorksView";
import SettingsView     from "./components/SettingsView";
import TermsView  from "./components/TermsView";

// ─── Backend status indicator ─────────────────────────────────────────────────

function BackendStatus() {
  const [status, setStatus] = useState("checking");
  useEffect(() => {
    const check = () =>
      fetch(`${BACKEND}/api/health`)
        .then(r => r.json())
        .then(d => setStatus(d.apiKeySet ? "ok" : "no_key"))
        .catch(() => setStatus("error"));
    check();
    const id = setInterval(check, 3000);
    return () => clearInterval(id);
  }, []);
  if (status === "ok") return null;
  const msg = {
    no_key: { text: "API key missing — add ANTHROPIC_API_KEY to backend/.env", color: "var(--o)" },
    error:  { text: "Backend offline — run: cd northstar-backend && npm run dev", color: "var(--r)" },
  }[status];
  if (!msg) return null;
  return (
    <div style={{ position: "fixed", bottom: 16, right: 16, background: "var(--bg2)", border: `1px solid ${msg.color}55`, padding: "10px 16px", zIndex: 999, display: "flex", alignItems: "center", gap: 10, maxWidth: 420 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: msg.color, flexShrink: 0, animation: "pulse 2s infinite" }} />
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, color: msg.color, lineHeight: 1.5 }}>{msg.text}</span>
    </div>
  );
}

// ─── Sync status bar (top nav right side) ─────────────────────────────────────

function SyncBar({ syncing, lastSyncDate, onSync, canSync }) {
  const lastStr = lastSyncDate
    ? new Date(lastSyncDate).toLocaleDateString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  if (syncing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Spinner color="var(--c)" size={12} />
        <Mono s={{ fontSize: 13, color: "var(--c)", letterSpacing: 1 }}>SYNCING...</Mono>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {lastStr && <Mono s={{ fontSize: 13, color: "var(--text3)" }}>last sync {lastStr}</Mono>}
      <button
        onClick={onSync}
        disabled={!canSync}
        style={{
          background: canSync ? "var(--c)" : "var(--bg3)",
          color: canSync ? "#000" : "var(--text3)",
          border: "none",
          padding: "5px 14px",
          fontFamily: "'DM Mono',monospace",
          fontSize: 13,
          letterSpacing: 1.5,
          fontWeight: 600,
          cursor: canSync ? "pointer" : "not-allowed",
        }}
      >
        ⟳ SYNC NORTHSTAR
      </button>
    </div>
  );
}

// ─── Sync progress overlay ────────────────────────────────────────────────────

function SyncOverlay({ steps, syncing, elapsed, onDismiss }) {
  if (!steps.length) return null;
  const hasErrors = steps.some(s => s.status === "error");
  const allDone   = !syncing;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg1)", border: `1px solid ${hasErrors && allDone ? "var(--r)55" : "var(--c)44"}`, width: "100%", maxWidth: 480, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ height: 2, background: hasErrors && allDone ? "var(--r)" : "linear-gradient(90deg,var(--c),var(--p),transparent)" }} />
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {syncing ? <Spinner color="var(--c)" size={13} /> : (
              hasErrors
                ? <span style={{ color: "var(--r)", fontSize: 15 }}>✕</span>
                : <span style={{ color: "var(--g)", fontSize: 15 }}>✓</span>
            )}
            <Mono s={{ fontSize: 14, color: syncing ? "var(--c)" : hasErrors ? "var(--r)" : "var(--g)", letterSpacing: 2 }}>
              {syncing ? "SYNCING NORTHSTAR" : hasErrors ? "SYNC COMPLETED WITH ERRORS" : "SYNC COMPLETE"}
            </Mono>
          </div>
          <Mono s={{ fontSize: 13, color: "var(--text3)" }}>{elapsed}s</Mono>
        </div>

        {/* Step list */}
        <div style={{ padding: "14px 22px" }}>
          {steps.map((step, i) => {
            const isRunning = step.status === "running";
            const isDone    = step.status === "done";
            const isError   = step.status === "error";
            const isPending = step.status === "pending";
            const iconColor = isRunning ? "var(--c)" : isDone ? "var(--g)" : isError ? "var(--r)" : "var(--border2)";
            return (
              <div key={step.id} style={{ marginBottom: i < steps.length - 1 ? 12 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: iconColor + "18", border: `1px solid ${iconColor}66`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isRunning && <Spinner color="var(--c)" size={10} />}
                    {isDone    && <span style={{ color: "var(--g)", fontSize: 12, lineHeight: 1 }}>✓</span>}
                    {isError   && <span style={{ color: "var(--r)", fontSize: 12, lineHeight: 1 }}>✕</span>}
                    {isPending && <span style={{ color: "var(--border2)", fontSize: 10 }}>·</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <Mono s={{ fontSize: 13, color: isPending ? "var(--text3)" : isError ? "var(--r)" : isRunning ? "var(--c)" : "var(--text)", letterSpacing: 1 }}>
                      {step.icon} {step.label}
                    </Mono>
                    {isRunning && (
                      <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>Calling Claude API...</div>
                    )}
                  </div>
                  <Mono s={{ fontSize: 12, color: isPending ? "var(--border2)" : isRunning ? "var(--c)" : isDone ? "var(--g)" : "var(--r)" }}>
                    {isPending ? "WAITING" : isRunning ? "IN PROGRESS" : isDone ? "DONE" : "FAILED"}
                  </Mono>
                </div>
                {isError && step.error && (
                  <div style={{ marginLeft: 34, marginTop: 6, background: "var(--r)0D", border: "1px solid var(--r)33", padding: "8px 12px" }}>
                    <Mono s={{ fontSize: 12, color: "var(--r)", letterSpacing: 0.5 }}>ERROR</Mono>
                    <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 3, lineHeight: 1.5, wordBreak: "break-word" }}>{step.error}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {allDone && (
          <div style={{ padding: "12px 22px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={onDismiss}
              style={{ background: hasErrors ? "none" : "var(--c)", color: hasErrors ? "var(--text2)" : "#000", border: hasErrors ? "1px solid var(--border)" : "none", padding: "7px 18px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1.5, fontWeight: 600, cursor: "pointer" }}
            >
              {hasErrors ? "DISMISS" : "DONE →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [state,       setState]       = useState(EMPTY_STATE);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [tab,         setTab]         = useState("dashboard");

  // Sync state
  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding);

  const [syncing,       setSyncing]       = useState(false);
  const [syncSteps,     setSyncSteps]     = useState([]); // { id, label, icon, status, error }
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [syncElapsed,   setSyncElapsed]   = useState(0);
  const [lastSyncDate,  setLastSyncDate]  = useState(null);
  const [syncErrors,    setSyncErrors]    = useState([]);
  const [syncConfirm,   setSyncConfirm]   = useState(false);
  const syncElapsedRef  = useRef(null);
  const stateRef = useRef(state); // keep a ref so runSync sees current state
  const syncingRef = useRef(false); // stable guard — avoids stale closure in runSyncFlow

  useEffect(() => { stateRef.current = state; }, [state]);

  // ── Load & save ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadState().then(s => {
      // Reset recurring mission progress if we've passed Sunday midnight since last reset.
      // Exception: on Monday, if the check-in wasn't done yet, preserve last week's progress
      // so the Monday catch-up check-in still sees accurate data. The reset fires after the
      // check-in is saved (see saveLog), or on Tuesday regardless.
      const lastSunday = getLastSunday();
      const mondayMissed = isMonday() && !checkinDoneThisWeek(s.lastInterviewDate);
      const recurring = (s.recurringMissions || []).map(m => {
        if (mondayMissed) return m;
        const lastReset = m.lastResetWeek ? new Date(m.lastResetWeek) : null;
        if (!lastReset || lastReset < lastSunday) {
          return { ...m, progressCount: 0, lastResetWeek: lastSunday.toISOString() };
        }
        return m;
      });
      setState({ ...s, weeklyLogs: pruneAndCompressLogs(s.weeklyLogs || [], s.retentionWeeks || 4), recurringMissions: recurring });
      setLastSyncDate(s.lastSyncDate || null);
      setStateLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (stateLoaded) scheduleSave({ ...state, lastSyncDate });
  }, [state, stateLoaded, lastSyncDate]);

  const upd = useCallback(fn => setState(prev => fn(prev)), []);

  // ── Centralized sync (internal — used by weekly pipeline and manual override) ──
  const runSyncFlow = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    // Build the step list from whichever pillars have profiles
    const pillarSteps = PILLARS.filter(p => stateRef.current.profiles?.[p.id]);
    const initialSteps = [
      ...pillarSteps.map(p => ({ id: p.id, label: p.label, icon: p.icon, status: "pending", error: null })),
      { id: "meta", label: "META-ANALYSIS", icon: "⬡", status: "pending", error: null },
    ];
    setSyncSteps(initialSteps);
    setSyncElapsed(0);
    setShowSyncPanel(true);
    setSyncing(true);
    setSyncErrors([]);

    // Elapsed time ticker
    const startTime = Date.now();
    syncElapsedRef.current = setInterval(() => {
      setSyncElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const { completed, errors, scoreBreakdowns, metaPrev, metaFinal } = await runSync(
      stateRef.current,
      (label, current, total) => {
        // Mark previous step done, current step running
        setSyncSteps(prev => prev.map((s, i) => {
          if (i === current - 1) return { ...s, status: "running" };
          if (i < current - 1 && s.status === "pending") return { ...s, status: "done" };
          return s;
        }));
      },
      (updaterFn) => {
        setState(prev => updaterFn(prev));
      },
      (stepId, errorMsg) => {
        setSyncSteps(prev => prev.map(s =>
          s.id === stepId ? { ...s, status: "error", error: errorMsg } : s
        ));
      }
    );

    // Clear elapsed ticker, mark all non-error steps done
    clearInterval(syncElapsedRef.current);
    setSyncSteps(prev => prev.map(s =>
      (s.status === "running" || s.status === "pending") ? { ...s, status: "done" } : s
    ));
    syncingRef.current = false;
    setSyncing(false);
    setSyncErrors(errors);
    if (completed > 0) setLastSyncDate(new Date().toISOString());
    return { scoreBreakdowns, metaPrev, metaFinal };
  }, []); // stable — uses refs for guards, stateRef for current state

  // Manual override — requires confirm dialog
  const handleSyncManual = useCallback(() => {
    setSyncConfirm(true);
  }, []);

  // ── Profile ──────────────────────────────────────────────────────────────────
  const saveProfile = useCallback(profile => upd(s => ({ ...s, userProfile: profile })), [upd]);

  // ── Pillar save (stores answers only — sync generates the analysis) ───────────
  const savePillar = useCallback((id, profile) => {
    upd(s => ({
      ...s,
      profiles: { ...s.profiles, [id]: profile },
    }));
  }, [upd]);

  // ── Mission accept / decline / complete ───────────────────────────────────────
  const acceptMission  = useCallback((id, edited = null) => upd(s => {
    const mission = (s.pendingMissions || []).find(m => m.id === id);
    if (!mission) return s;
    const base = edited ? { ...mission, ...edited } : mission;
    const now = new Date();
    const dueType = base.dueType || "this_week";
    let deadlineDate;
    if (dueType === "today") {
      const d = new Date(now); d.setHours(23, 59, 59, 999); deadlineDate = d.toISOString();
    } else if (dueType === "this_week") {
      const d = new Date(now); const daysUntilSun = (7 - d.getDay()) % 7 || 7; d.setDate(d.getDate() + daysUntilSun); d.setHours(23, 59, 59, 999); deadlineDate = d.toISOString();
    } else if (dueType === "two_weeks") {
      const d = new Date(now); d.setDate(d.getDate() + 14); d.setHours(23, 59, 59, 999); deadlineDate = d.toISOString();
    } else if (dueType === "this_month") {
      const d = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); deadlineDate = d.toISOString();
    } else {
      const d = new Date(now); const daysUntilSun = (7 - d.getDay()) % 7 || 7; d.setDate(d.getDate() + daysUntilSun); d.setHours(23, 59, 59, 999); deadlineDate = d.toISOString();
    }
    // Initialise progress tracking fields
    const subtasks = (base.subtasks || []).map((st, i) =>
      typeof st === "string" ? { id: `st_${id}_${i}`, label: st, done: false } : { id: st.id || `st_${id}_${i}`, label: st.label, done: false }
    );
    const toAdd = { ...base, acceptedAt: now.toISOString(), deadlineDate, progressCount: 0, subtasks };
    return { ...s, pendingMissions: s.pendingMissions.filter(m => m.id !== id), missions: [...(s.missions || []), toAdd] };
  }), [upd]);

  const declineMission = useCallback(id => upd(s => ({
    ...s, pendingMissions: (s.pendingMissions || []).filter(m => m.id !== id),
  })), [upd]);

  const complete = useCallback(id => upd(s => {
    const completedAt = { ...(s.missionCompletedAt || {}), [id]: new Date().toISOString() };
    // Keep only the 25 most recently completed missions
    const allCompleted = [...new Set([...(s.completedMissions || []), id])];
    const trimmed = allCompleted
      .sort((a, b) => new Date(completedAt[b] || 0) - new Date(completedAt[a] || 0))
      .slice(0, 25);
    const trimmedSet = new Set(trimmed);
    // Drop mission records and timestamps for anything pruned
    const prunedAt = Object.fromEntries(Object.entries(completedAt).filter(([k]) => trimmedSet.has(k)));
    const missions = (s.missions || []).filter(m => !allCompleted.includes(m.id) || trimmedSet.has(m.id));
    return { ...s, missions, completedMissions: trimmed, missionCompletedAt: prunedAt };
  }), [upd]);
  const uncomplete = useCallback(id => upd(s => ({ ...s, completedMissions: (s.completedMissions || []).filter(x => x !== id) })), [upd]);
  const deleteMission = useCallback(id => upd(s => {
    const wasCompleted = (s.completedMissions || []).includes(id);
    const mission      = (s.missions || []).find(m => m.id === id);
    const missionCompletedAt = { ...(s.missionCompletedAt || {}) };
    delete missionCompletedAt[id];
    // Only log deletions of active (non-completed) missions — completed ones don't get penalized
    const deletedMissionLog = (!wasCompleted && mission)
      ? [...(s.deletedMissionLog || []), { pillarId: mission.pillar, deletedAt: new Date().toISOString() }]
      : (s.deletedMissionLog || []);
    return {
      ...s,
      missions: (s.missions || []).filter(m => m.id !== id),
      completedMissions: (s.completedMissions || []).filter(x => x !== id),
      missionCompletedAt,
      deletedMissionLog,
    };
  }), [upd]);

  // Increment progress on a counted/recurring mission; auto-complete if standard mission hits target
  const incrementProgress = useCallback((id, delta = 1) => upd(s => {
    // Check active missions first
    const mIdx = (s.missions || []).findIndex(m => m.id === id);
    if (mIdx !== -1) {
      const m = s.missions[mIdx];
      const newCount = Math.max(0, (m.progressCount || 0) + delta);
      const updated  = { ...m, progressCount: newCount };
      const newMissions = [...s.missions];
      newMissions[mIdx] = updated;
      // Auto-complete counted missions when target is reached
      const shouldComplete = m.missionType === "counted" && m.targetCount && newCount >= m.targetCount
        && !(s.completedMissions || []).includes(id);
      return {
        ...s,
        missions: newMissions,
        completedMissions: shouldComplete ? [...(s.completedMissions || []), id] : s.completedMissions,
        missionCompletedAt: shouldComplete ? { ...(s.missionCompletedAt || {}), [id]: new Date().toISOString() } : s.missionCompletedAt,
      };
    }
    // Check recurring missions
    const rIdx = (s.recurringMissions || []).findIndex(m => m.id === id);
    if (rIdx !== -1) {
      const m = s.recurringMissions[rIdx];
      const newCount = Math.max(0, Math.min((m.progressCount || 0) + delta, m.targetCount || 99));
      const newRecurring = [...s.recurringMissions];
      newRecurring[rIdx] = { ...m, progressCount: newCount };
      return { ...s, recurringMissions: newRecurring };
    }
    return s;
  }), [upd]);

  // Toggle a subtask checkbox; auto-complete mission if all subtasks done
  const toggleSubtask = useCallback((missionId, subtaskId) => upd(s => {
    const mIdx = (s.missions || []).findIndex(m => m.id === missionId);
    if (mIdx === -1) return s;
    const m = s.missions[mIdx];
    const newSubtasks = (m.subtasks || []).map(st =>
      st.id === subtaskId ? { ...st, done: !st.done } : st
    );
    const updated = { ...m, subtasks: newSubtasks };
    const newMissions = [...s.missions];
    newMissions[mIdx] = updated;
    const allDone = newSubtasks.length > 0 && newSubtasks.every(st => st.done);
    const alreadyComplete = (s.completedMissions || []).includes(missionId);
    return {
      ...s,
      missions: newMissions,
      completedMissions: allDone && !alreadyComplete ? [...(s.completedMissions || []), missionId] : s.completedMissions,
      missionCompletedAt: allDone && !alreadyComplete ? { ...(s.missionCompletedAt || {}), [missionId]: new Date().toISOString() } : s.missionCompletedAt,
    };
  }), [upd]);

  // Accept a recurring mission — goes to recurringMissions, not missions
  const acceptRecurring = useCallback((id, edited = null) => upd(s => {
    const mission = (s.pendingMissions || []).find(m => m.id === id);
    if (!mission) return s;
    const base = edited ? { ...mission, ...edited } : mission;
    const lastSunday = getLastSunday();
    const toAdd = { ...base, acceptedAt: new Date().toISOString(), progressCount: 0, lastResetWeek: lastSunday.toISOString() };
    return { ...s, pendingMissions: s.pendingMissions.filter(m => m.id !== id), recurringMissions: [...(s.recurringMissions || []), toAdd] };
  }), [upd]);

  const deleteRecurring = useCallback(id => upd(s => {
    const mission = (s.recurringMissions || []).find(m => m.id === id);
    const deletedMissionLog = mission
      ? [...(s.deletedMissionLog || []), { pillarId: mission.pillar, deletedAt: new Date().toISOString() }]
      : (s.deletedMissionLog || []);
    return {
      ...s,
      recurringMissions: (s.recurringMissions || []).filter(m => m.id !== id),
      deletedMissionLog,
    };
  }), [upd]);

  const updateMission = useCallback((id, changes) => upd(s => ({
    ...s,
    missions: (s.missions || []).map(m => m.id === id ? { ...m, ...changes } : m),
  })), [upd]);

  const editRecurring = useCallback((id, changes) => upd(s => ({
    ...s,
    recurringMissions: (s.recurringMissions || []).map(m =>
      m.id === id ? { ...m, ...changes } : m
    ),
  })), [upd]);

  const addRecurring = useCallback(mission => upd(s => {
    const lastSunday = getLastSunday();
    const toAdd = { ...mission, acceptedAt: new Date().toISOString(), progressCount: 0, lastResetWeek: lastSunday.toISOString() };
    return { ...s, recurringMissions: [...(s.recurringMissions || []), toAdd] };
  }), [upd]);

  // ── Network / integrations ────────────────────────────────────────────────────
  const saveContacts     = useCallback(c => upd(s => ({ ...s, networkContacts: c })), [upd]);
  const saveSuggestions  = useCallback(sg => upd(s => ({ ...s, networkSuggestions: sg })), [upd]);
  const saveIntegrations = useCallback(ig => upd(s => ({ ...s, integrations: ig })), [upd]);
  const saveDraft        = useCallback((id, d) => upd(s => ({ ...s, drafts: { ...(s.drafts || {}), [id]: d } })), [upd]);
  const saveJobHunt       = useCallback(jh => upd(s => ({ ...s, jobHunt: jh })), [upd]);

  // ── Weekly interview ──────────────────────────────────────────────────────────
  const saveLog = useCallback(log => {
    upd(s => {
      const pruned = pruneAndCompressLogs([...(s.weeklyLogs || []), log], s.retentionWeeks || 4);
      const lastSunday = getLastSunday();
      const recurringMissions = isMonday()
        ? (s.recurringMissions || []).map(m => {
            const lastReset = m.lastResetWeek ? new Date(m.lastResetWeek) : null;
            if (!lastReset || lastReset < lastSunday) {
              return { ...m, progressCount: 0, lastResetWeek: lastSunday.toISOString() };
            }
            return m;
          })
        : s.recurringMissions;
      const next = { ...s, weeklyLogs: pruned, lastInterviewDate: log.date, recurringMissions };
      // Update stateRef immediately so sync sees the new log in meta history context
      stateRef.current = next;
      return next;
    });
  }, [upd]);

  // Update a single pillar's stored answers (called after pillar review in weekly pipeline)
  const updatePillarAnswers = useCallback((pillarId, { answers, extra }) => {
    const pillar   = PILLARS.find(p => p.id === pillarId);
    const coreKeys = new Set((pillar?.questions || []).filter(q => q.core).map(q => q.key));
    const filteredAnswers = Object.fromEntries(
      Object.entries(answers || {}).filter(([k]) => !coreKeys.has(k))
    );
    const updatedProfile = {
      ...(stateRef.current.profiles[pillarId] || {}),
      answers: {
        ...(stateRef.current.profiles[pillarId]?.answers || {}),
        ...filteredAnswers,
      },
      extra: extra ?? stateRef.current.profiles[pillarId]?.extra ?? "",
    };
    // Update stateRef immediately so runSync sees the new answers even before React re-renders
    stateRef.current = {
      ...stateRef.current,
      profiles: { ...stateRef.current.profiles, [pillarId]: updatedProfile },
    };
    upd(s => ({
      ...s,
      profiles: { ...s.profiles, [pillarId]: updatedProfile },
    }));
  }, [upd]);

  const setRetentionWeeks = useCallback(weeks => {
    upd(s => ({
      ...s,
      retentionWeeks: weeks,
      weeklyLogs: pruneAndCompressLogs(s.weeklyLogs || [], weeks),
    }));
  }, [upd]);

  const deleteLog = useCallback(idOrAll => {
    upd(s => ({
      ...s,
      weeklyLogs: idOrAll === "all-logs" ? [] : (s.weeklyLogs || []).filter(l => l.id !== idOrAll),
      lastInterviewDate: idOrAll === "all-logs" ? null : s.lastInterviewDate,
    }));
  }, [upd]);

  const clearScoreHistory = useCallback(pillarId => {
    upd(s => ({
      ...s,
      analyses: {
        ...s.analyses,
        [pillarId]: s.analyses[pillarId] ? { ...s.analyses[pillarId], scoreHistory: [] } : s.analyses[pillarId],
      },
    }));
  }, [upd]);

  const deleteMissionById = useCallback(idOrAll => {
    upd(s => {
      if (idOrAll === "all") {
        return { ...s, missions: [], completedMissions: [], missionCompletedAt: {} };
      }
      const missionCompletedAt = { ...(s.missionCompletedAt || {}) };
      delete missionCompletedAt[idOrAll];
      return {
        ...s,
        missions: (s.missions || []).filter(m => m.id !== idOrAll),
        completedMissions: (s.completedMissions || []).filter(x => x !== idOrAll),
        missionCompletedAt,
      };
    });
  }, [upd]);

  const addPendingMissions = useCallback(ms => upd(s => ({
    ...s, pendingMissions: [...(s.pendingMissions || []), ...ms],
  })), [upd]);

  const updatePillarScores = useCallback(pillarDeltas => {
    upd(s => {
      const newAnalyses = { ...s.analyses };
      Object.entries(pillarDeltas).forEach(([pid, { delta }]) => {
        if (newAnalyses[pid] && delta) {
          const current      = newAnalyses[pid].priorityScore || 5;
          const newScore     = Math.max(1, Math.min(100, current + delta));
          const prevHistory  = newAnalyses[pid].scoreHistory || [];
          const scoreHistory = [...prevHistory, { date: new Date().toISOString(), score: newScore, source: "check-in" }].slice(-12);
          newAnalyses[pid]   = { ...newAnalyses[pid], priorityScore: newScore, scoreHistory };
        }
      });
      return { ...s, analyses: newAnalyses };
    });
  }, [upd]);

  // ── Render ───────────────────────────────────────────────────────────────────
  const canSync = Object.keys(state.profiles || {}).length > 0 && !syncing;

  const renderTab = () => {
    const pillar = PILLARS.find(p => p.id === tab);
    if (tab === "dashboard")    return <Dashboard        state={state} onNav={setTab} onShowHelp={() => setShowOnboarding(true)} />;
    if (tab === "profile")      return <ProfileView      state={state} onSave={saveProfile} />;
    if (pillar)                 return <PillarView       pillar={pillar} state={state} onSave={savePillar} onDraftChange={saveDraft} />;
    if (tab === "network")      return <NetworkView      state={state} onSaveContacts={saveContacts} onSaveSuggestions={saveSuggestions} analyses={state.analyses} />;
    if (tab === "missions")     return <MissionsView     state={state} onAccept={acceptMission} onAcceptRecurring={acceptRecurring} onDecline={declineMission} onComplete={complete} onUncomplete={uncomplete} onDelete={deleteMission} onDeleteRecurring={deleteRecurring} onEditRecurring={editRecurring} onAddRecurring={addRecurring} onIncrementProgress={incrementProgress} onToggleSubtask={toggleSubtask} />;
    if (tab === "interview")    return <InterviewView    state={state} onSaveLog={saveLog} onAddPendingMissions={addPendingMissions} onUpdatePillarScores={updatePillarScores} onUpdatePillarAnswers={updatePillarAnswers} onRunSync={runSyncFlow} onSaveIntegrations={saveIntegrations} onDeleteMission={deleteMission} onDeleteRecurring={deleteRecurring} onUpdateMission={updateMission} onUpdateRecurring={editRecurring} />;
    if (tab === "jobhunt")      return <JobHuntView      state={state} onSave={saveJobHunt} />;
    if (tab === "meta")         return <MetaView         state={state} />;
    if (tab === "integrations") return <IntegrationsView state={state} onSave={saveIntegrations} />;
    if (tab === "guide")        return <HowItWorksView   state={state} />;
    if (tab === "settings")     return <SettingsView     state={state} onSetRetention={setRetentionWeeks} onDeleteLog={deleteLog} onClearScoreHistory={clearScoreHistory} onDeleteMission={deleteMissionById} />;
    if (tab === "terms") return <TermsView />;
    return null;
  };

  return (
    <>
      <style>{CSS}</style>
      {showOnboarding && <OnboardingModal onDone={() => setShowOnboarding(false)} />}
      <BackendStatus />
      <div style={{ display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>
        <Sidebar active={tab} onNav={setTab} state={state} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Top nav bar */}
          <div style={{ height: 46, background: "var(--bg1)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 26px", flexShrink: 0 }}>
            <Mono s={{ fontSize: 13, color: "var(--text3)", letterSpacing: 2 }}>
              {new Date().toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })} · TORONTO, ON
            </Mono>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* TEST BUTTON — remove before release */}
              <button onClick={runSyncFlow} disabled={syncing} style={{ background: "var(--r)", color: "#fff", border: "none", padding: "4px 12px", fontFamily: "'DM Mono',monospace", fontSize: 12, letterSpacing: 1, cursor: syncing ? "not-allowed" : "pointer", opacity: syncing ? 0.5 : 1 }}>
                TEST SYNC
              </button>
              <Mono s={{ fontSize: 13, color: "var(--text3)" }}>
                {stateLoaded ? "SYNCED · LOCAL" : "LOADING..."}
              </Mono>
              <SyncBar
                syncing={syncing}
                lastSyncDate={lastSyncDate}
                onSync={handleSyncManual}
                canSync={canSync}
              />
            </div>
          </div>

          {/* Manual sync confirm dialog */}
          {syncConfirm && !syncing && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", padding: "28px 32px", maxWidth: 400, width: "90%" }}>
                <Mono s={{ fontSize: 13, color: "var(--o)", letterSpacing: 2, display: "block", marginBottom: 10 }}>⚠ MANUAL SYNC OVERRIDE</Mono>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 26, color: "var(--text)", marginBottom: 12, letterSpacing: 1 }}>Run NORTHSTAR Sync?</div>
                <div style={{ fontSize: 14, color: "var(--text3)", lineHeight: 1.7, marginBottom: 22 }}>This manually re-analyzes all pillars and regenerates missions. It's normally triggered automatically after your Sunday check-in. Continue?</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setSyncConfirm(false); runSyncFlow(); }} style={{ background: "var(--c)", color: "#000", border: "none", padding: "9px 22px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1.5, fontWeight: 600 }}>YES, RUN SYNC</button>
                  <button onClick={() => setSyncConfirm(false)} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "9px 18px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1 }}>CANCEL</button>
                </div>
              </div>
            </div>
          )}

          {/* Sync progress overlay */}
          {showSyncPanel && (
            <SyncOverlay
              steps={syncSteps}
              syncing={syncing}
              elapsed={syncElapsed}
              onDismiss={() => setShowSyncPanel(false)}
            />
          )}

          <div style={{ flex: 1, overflowY: "auto", padding: "34px 38px 80px" }}>
            <div style={{ maxWidth: 1040, margin: "0 auto" }}>
              {stateLoaded ? renderTab() : <LoadingBlock label="LOADING YOUR DATA" />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}