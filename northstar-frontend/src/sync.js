import { PILLARS } from "./constants";
import { callClaude, parseJSON } from "./api";
import { ANALYSIS_SYS, META_SYS } from "./prompts";
import { buildWorkoutContext, buildInstagramContext, buildInstagramSnapshotContext } from "./components/IntegrationsView";


// Gap between API calls in ms — stays well under rate limits
const CALL_GAP_MS = 3500;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Returns a human-readable age string for a stored dataset
function dataAge(isoDate) {
  if (!isoDate) return "unknown date";
  const ms   = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 14)  return `${days} days ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 8)  return `${weeks} weeks ago`;
  const months = Math.round(days / 30);
  return `${months} months ago`;
}

// Wraps a context string with a clear temporal header so the AI treats this as
// historical/reference data, not something that happened this week.
function stampedCtx(label, isoDate, ctx) {
  if (!ctx) return "";
  const age = dataAge(isoDate);
  return `[${label} — data uploaded ${age}; treat as historical baseline, not current-week activity]\n${ctx}`;
}

// Build profile context for pillar analyses — age, sex, height, weight
// used to calibrate lift targets, income benchmarks, and recovery advice.
function buildPillarProfileCtx(userProfile = {}) {
  const parts = [];
  if (userProfile.age)    parts.push(`Age: ${userProfile.age}`);
  if (userProfile.sex) parts.push(`Sex: ${userProfile.sex}`);
  if (userProfile.height) parts.push(`Height: ${userProfile.height}cm`);
  if (userProfile.weight) parts.push(`Weight: ${userProfile.weight}kg`);
  return parts.length ? `User context: ${parts.join(" | ")}` : "";
}

// Build profile context for the meta / psychological analysis.
// Deliberately empty — no name, age, job, city, goals, bio, or LinkedIn.
// The psychological profile only needs pillar summaries and check-in history.
// Identity-linking fields are stripped so no single API log can identify the user.
function buildMetaProfileCtx() {
  return "";
}

// Build recent check-in digest context
// Per-pillar history: pulls that pillar's specific digest from each recent log.
// Falls back to the general digest for old logs that predate pillarDigests.
function buildPillarHistoryCtx(pillarId, weeklyLogs = [], limit = 4) {
  const entries = [...weeklyLogs]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit)
    .map((l, i) => {
      const text = l.pillarDigests?.[pillarId] || l.digest;
      if (!text) return null;
      const date = new Date(l.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
      return `W-${i + 1} (${date}): ${text}`;
    })
    .filter(Boolean);
  return entries.length
    ? `CHECK-IN HISTORY (${pillarId}-specific, most recent first):\n${entries.join("\n")}`
    : "";
}

// Full cross-pillar history for meta: all pillar digests per week.
// Falls back to general digest for old logs.
function buildMetaHistoryCtx(weeklyLogs = [], limit = 4) {
  const entries = [...weeklyLogs]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit)
    .map((l, i) => {
      const date = new Date(l.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
      if (l.pillarDigests && Object.keys(l.pillarDigests).length > 0) {
        const parts = Object.entries(l.pillarDigests)
          .map(([pid, d]) => `  [${pid}] ${d}`)
          .join("\n");
        return `W-${i + 1} (${date}):\n${parts}`;
      }
      return l.digest ? `W-${i + 1} (${date}): ${l.digest}` : null;
    })
    .filter(Boolean);
  return entries.length ? `CHECK-IN HISTORY (all pillars):\n${entries.join("\n\n")}` : "";
}

/**
 * runSync — runs all refreshable analyses in sequence.
 *
 * @param {object}   state      Current app state snapshot
 * @param {function} onStep     Called with (stepLabel, stepIndex, totalSteps) for UI progress
 * @param {function} onUpdate   Called with a state updater function after each successful call
 * @returns {Promise<{completed: number, errors: string[]}>}
 */
// ── Algorithmic score computation ─────────────────────────────────────────────
// Computes a deterministic score delta from mission performance for a pillar.
// Returns null on the first sync (no history) — Claude scores freely that time.
export function computeAlgorithmicScore(pillarId, prevScore, missions, completedMissions, missionCompletedAt, recurringMissions) {
  if (prevScore == null) return null;

  const ONE_WEEK_AGO = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let delta = 0;

  // Recurring habits (progress resets weekly — progressCount reflects this week)
  for (const m of (recurringMissions || []).filter(m => m.pillar === pillarId)) {
    const pct = Math.min(1, (m.progressCount || 0) / Math.max(1, m.targetCount || 1));
    if      (pct >= 1.00) delta += 3;
    else if (pct >= 0.75) delta += 2;
    else if (pct >= 0.50) delta += 1;
    else if (pct >= 0.25) delta -= 1;
    else                  delta -= 2;
  }

  // One-off missions
  for (const m of (missions || []).filter(m => m.pillar === pillarId)) {
    const isCompleted     = (completedMissions || []).includes(m.id);
    const completedThisWk = isCompleted && missionCompletedAt?.[m.id] && new Date(missionCompletedAt[m.id]).getTime() > ONE_WEEK_AGO;
    const isOverdue       = !isCompleted && m.deadlineDate && new Date(m.deadlineDate).getTime() < now;

    if (m.missionType === "counted") {
      const pct = Math.min(1, (m.progressCount || 0) / Math.max(1, m.targetCount || 1));
      if      (isCompleted || completedThisWk) delta += 3;
      else if (pct >= 0.75)                    delta += 2;
      else if (pct >= 0.50)                    delta += 1;
      else if (isOverdue)                      delta -= 3;
      else                                     delta -= 1;
    } else if (m.missionType === "standard" && (m.subtasks?.length || 0) > 0) {
      const pct = m.subtasks.filter(s => s.done).length / m.subtasks.length;
      if      (isCompleted || completedThisWk) delta += 2;
      else if (pct >= 0.50)                    delta += 1;
      else if (isOverdue)                      delta -= 3;
    } else {
      if   (isCompleted || completedThisWk) delta += 2;
      else if (isOverdue)                   delta -= 3;
    }
  }

  // Cap total swing per sync cycle
  delta = Math.max(-10, Math.min(10, delta));
  return { baseScore: Math.max(1, Math.min(100, prevScore + delta)), delta, prevScore };
}

export async function runSync(state, onStep, onUpdate) {
  console.log("[SYNC] runSync entered");
  const {
    profiles, analyses, userProfile = {}, weeklyLogs = [], integrations = {},
    missions = [], completedMissions = [], pendingMissions = [],
    recurringMissions = [], missionCompletedAt = {},
    retentionWeeks = 4,
  } = state;
  console.log("[SYNC] profiles keys:", Object.keys(profiles || {}));
  console.log("[SYNC] integrations keys:", Object.keys(integrations || {}));

  // ── Dynamic mission cap ───────────────────────────────────────────────────────
  // Count how many missions are currently queued up (pending + active/not-completed).
  // Check-in missions (source="check-in") are excluded — they're generated in the same
  // session and should never count against the cap for the sync that immediately follows.
  const activeMissions  = (missions || []).filter(m => !(completedMissions || []).includes(m.id));
  const pendingNonCheckin = (pendingMissions || []).filter(m => m.source !== "check-in");
  const totalQueued     = pendingNonCheckin.length + activeMissions.length;
  // Scale: 0–2 queued → 3/pillar, 3–4 → 2/pillar, 5 → 1/pillar, 6+ → 0/pillar
  let missionsPerPillar;
  if      (totalQueued > 5) missionsPerPillar = 0;
  else if (totalQueued >= 5) missionsPerPillar = 1;
  else if (totalQueued >= 3) missionsPerPillar = 2;
  else                       missionsPerPillar = 3;
  console.log(`[SYNC] totalQueued=${totalQueued} (active:${activeMissions.length} pending-non-checkin:${pendingNonCheckin.length}) → missionsPerPillar=${missionsPerPillar}`);

  let pillarProfileCtx, metaProfileCtx, workoutCtx, igCtx, igSnapshotCtx;
  try {
    pillarProfileCtx = buildPillarProfileCtx(userProfile);
    console.log("[SYNC] pillarProfileCtx OK");
  } catch (e) { console.error("[SYNC] buildPillarProfileCtx threw:", e); throw e; }

  try {
    metaProfileCtx = buildMetaProfileCtx();
    console.log("[SYNC] meta ctx OK");
  } catch (e) { console.error("[SYNC] meta ctx threw:", e); throw e; }

  try {
    workoutCtx = buildWorkoutContext(integrations.workoutData);
    console.log("[SYNC] workoutCtx OK:", !!workoutCtx);
  } catch (e) { console.error("[SYNC] buildWorkoutContext threw:", e); throw e; }


  try {
    igCtx         = buildInstagramContext(integrations.instagramData);
    igSnapshotCtx = buildInstagramSnapshotContext(integrations.igSnapshot);
    console.log("[SYNC] igCtx OK:", !!igCtx, "igSnapshotCtx OK:", !!igSnapshotCtx);
  } catch (e) { console.error("[SYNC] buildInstagramContext/buildInstagramSnapshotContext threw:", e); throw e; }

  // Build step list: only pillars that have a saved profile
  const pillarSteps = PILLARS.filter(p => profiles[p.id]);
  const totalSteps  = pillarSteps.length + 1; // pillars + meta
  console.log("[SYNC] pillarSteps:", pillarSteps.map(p => p.id), "totalSteps:", totalSteps);
  let stepIdx = 0;
  let completed = 0;
  const errors = [];

  // Build completed missions context helper
  const buildCompletedCtx = (pillarId) => {
    const done = (missions || []).filter(m =>
      (completedMissions || []).includes(m.id) && m.pillar === pillarId
    );
    if (!done.length) return "";
    return `Completed missions for this pillar: ${done.map(m => m.title).join("; ")}`;
  };

  // Build existing (active + pending + recurring) missions context per pillar
  // so ANALYSIS_SYS can skip duplicates.
  const buildExistingMissionsCtx = (pillarId) => {
    const active    = (missions || []).filter(m => !(completedMissions || []).includes(m.id) && m.pillar === pillarId);
    const pending   = (pendingMissions || []).filter(m => m.pillar === pillarId);
    const recurring = (recurringMissions || []).filter(m => m.pillar === pillarId);
    const lines = [];
    if (recurring.length) lines.push(`Recurring habits: ${recurring.map(m => `${m.title} (${m.targetCount}x/wk)`).join("; ")}`);
    if (active.length)    lines.push(`Active missions: ${active.map(m => m.title).join("; ")}`);
    if (pending.length)   lines.push(`Pending missions: ${pending.map(m => m.title).join("; ")}`);
    return lines.join(" | ");
  };

  const allCompletedCtx = (() => {
    const done = (missions || []).filter(m => (completedMissions || []).includes(m.id));
    return done.length ? `All completed missions: ${done.map(m => m.title).join("; ")}` : "";
  })();

  // ── Step: Re-analyze each pillar ─────────────────────────────────────────────
  const freshAnalyses = { ...analyses };

  for (const pillar of pillarSteps) {
    stepIdx++;
    console.log(`[SYNC] Starting pillar step ${stepIdx}/${totalSteps}: ${pillar.id}`);
    onStep(`Analyzing ${pillar.label}`, stepIdx, totalSteps);

    const profile = profiles[pillar.id];

    // Split questions into core goals (stable) and current status (updated weekly)
    const coreQs   = pillar.questions.filter(q => q.core);
    const statusQs = pillar.questions.filter(q => !q.core);
    const coreQA   = coreQs.map(q => `Q: ${q.q}\nA: ${profile.answers[q.key] || "N/A"}`).join("\n\n");
    const statusQA = statusQs.map(q => `Q: ${q.q}\nA: ${profile.answers[q.key] || "N/A"}`).join("\n\n");
    const qa = [
      coreQA   ? `CORE GOALS (long-term priorities — anchor your assessment to these):\n${coreQA}`   : "",
      statusQA ? `CURRENT STATUS (updated weekly — reflects this week's situation):\n${statusQA}` : "",
    ].filter(Boolean).join("\n\n");

    const isPhysicality      = pillar.id === "physicality";
    const isSocial           = pillar.id === "social";
    const completedCtx       = buildCompletedCtx(pillar.id);
    const existingMissionsCtx = buildExistingMissionsCtx(pillar.id);

    // Compute algorithmic score baseline from mission performance
    const scoreInfo = computeAlgorithmicScore(
      pillar.id,
      analyses[pillar.id]?.priorityScore,
      missions, completedMissions, missionCompletedAt, recurringMissions
    );
    const scoringCtx = scoreInfo
      ? `SCORING BASELINE: Previous score ${scoreInfo.prevScore}/100. Mission-based delta this week: ${scoreInfo.delta > 0 ? "+" : ""}${scoreInfo.delta} pts (recurring habit completion, task completions, overdue tasks). Computed base score: ${scoreInfo.baseScore}/100. You MUST set priorityScore within [${Math.max(1, scoreInfo.baseScore - 6)}, ${Math.min(100, scoreInfo.baseScore + 6)}] — your only freedom is a ±6 qualitative adjustment on top of the computed base.`
      : "SCORING: No score history — set priorityScore freely based on your full assessment (1–100).";

    const pillarHistoryCtx = buildPillarHistoryCtx(pillar.id, weeklyLogs, retentionWeeks);

    const content = [
      `Re-analyze ${pillar.label} profile.`,
      qa,
      isPhysicality && workoutCtx ? stampedCtx("Workout data", integrations.workoutData?.uploadedAt, `Workout history:\n${workoutCtx}`) : "",
      isSocial && igSnapshotCtx ? stampedCtx("Instagram snapshot", integrations.igSnapshot?.updatedAt, igSnapshotCtx) : (isSocial && igCtx ? stampedCtx("Instagram connections", integrations.instagramData?.uploadedAt, igCtx) : ""),
      completedCtx,
      existingMissionsCtx ? `EXISTING MISSIONS (do not duplicate — skip any weeklyAction that overlaps with these): ${existingMissionsCtx}` : "",
      scoringCtx,
      pillarProfileCtx    ? `[SUPPLEMENTARY CONTEXT — background only, do not let it override the pillar-specific goals and status above]: ${pillarProfileCtx}` : "",
      pillarHistoryCtx    ? `[SUPPLEMENTARY CONTEXT — use this to identify week-over-week trends and recurring patterns for this pillar]: ${pillarHistoryCtx}` : "",
    ].filter(Boolean).join("\n\n");

    try {
      console.log(`[SYNC] Calling Claude for ${pillar.id}, content length: ${content.length} chars`);
      const text   = await callClaude([{ role: "user", content }], ANALYSIS_SYS, false);
      console.log(`[SYNC] Claude response for ${pillar.id}: ${text?.length} chars`);
      const parsed = parseJSON(text);
      console.log(`[SYNC] parseJSON for ${pillar.id}:`, parsed ? "OK" : "FAILED — raw text:", text?.slice(0, 200));
      if (parsed) {
        const prevHistory  = analyses[pillar.id]?.scoreHistory || [];
        const scoreHistory = [...prevHistory, { date: new Date().toISOString(), score: parsed.priorityScore }].slice(-12);
        const updated      = { ...parsed, pillar: pillar.id, scoreHistory };
        freshAnalyses[pillar.id] = updated;

        // Convert weeklyActions into rich pending missions.
        // Cap is dynamic — based on how many missions are already queued.
        const pillarMissions = missionsPerPillar > 0
          ? (parsed.weeklyActions || [])
            .slice(0, missionsPerPillar)
            .map((a, i) => {
              const missionType  = a.missionType  || "standard";
              const isCountable  = missionType === "counted" || missionType === "recurring";
              const targetCount  = isCountable ? (Number(a.targetCount) || 3) : null;
              // subtasks: normalise to [{id, label, done}] for standard missions
              const rawSubtasks  = (!isCountable && Array.isArray(a.subtasks)) ? a.subtasks : [];
              const subtasks     = rawSubtasks
                .filter(s => typeof s === "string" ? s.trim() : s?.label?.trim())
                .map((s, si) => ({
                  id:    `st_pm_${pillar.id}_${i}_${si}`,
                  label: typeof s === "string" ? s.trim() : s.label.trim(),
                  done:  false,
                }));
              return {
                id:            `pm_${pillar.id}_${Date.now()}_${i}`,
                title:         a.action,
                description:   a.description || a.action,
                why:           a.why,
                pillar:        pillar.id,
                category:      a.category     || "Admin",
                difficulty:    a.difficulty   || "Medium",
                estimatedTime: a.timeRequired || "1h",
                priority:      7,
                dueType:       missionType === "recurring" ? "this_week" : (a.dueType || "this_week"),
                missionType,
                targetCount,
                subtasks,
                source:        "pillar",
              };
            })
          : [];

        onUpdate(s => ({
          ...s,
          analyses: { ...s.analyses, [pillar.id]: updated },
          pendingMissions: [...(s.pendingMissions || []), ...pillarMissions],
        }));
        completed++;
      }
    } catch (e) {
      console.error(`[SYNC] ${pillar.label} failed:`, e);
      errors.push(`${pillar.label}: ${e.message}`);
    }

    if (stepIdx < totalSteps) await sleep(CALL_GAP_MS);
  }

  // ── Step: Generate meta ───────────────────────────────────────────────────────
  stepIdx++;
  console.log(`[SYNC] Starting meta step ${stepIdx}/${totalSteps}`);
  onStep("Generating meta-analysis", stepIdx, totalSteps);

  const metaSum = PILLARS.map(p => {
    const a = freshAnalyses[p.id];
    return a ? `${p.label}(${a.priorityScore}/100) 30d:${a.thirtyDayMilestone?.slice(0, 60)} 90d:${a.ninetyDayMilestone?.slice(0, 60)}` : "";
  }).filter(Boolean).join(" | ");

  const metaHistoryCtx = buildMetaHistoryCtx(weeklyLogs, retentionWeeks);

  const prevScore = state.metaAnalysis ? `Prev score:${state.metaAnalysis.overallScore}` : "";

  try {
    const content = [
      `Week of ${new Date().toLocaleDateString()}.`,
      prevScore,
      metaProfileCtx,
      metaHistoryCtx,
      `Pillars: ${metaSum}`,
      igSnapshotCtx ? stampedCtx("Instagram snapshot [Social pillar data only — personal social life, not professional networking]", integrations.igSnapshot?.updatedAt, igSnapshotCtx) : "",
    ].filter(Boolean).join("\n\n");

    console.log(`[SYNC] Calling Claude for meta, content length: ${content.length} chars`);
    const text   = await callClaude([{ role: "user", content }], META_SYS, false);
    console.log(`[SYNC] Claude meta response: ${text?.length} chars`);
    const parsed = parseJSON(text);
    console.log("[SYNC] parseJSON meta:", parsed ? "OK" : "FAILED — raw text:", text?.slice(0, 200));
    if (parsed) {
      onUpdate(s => ({ ...s, metaAnalysis: parsed, lastMetaDate: new Date().toISOString() }));
      completed++;
    }
  } catch (e) {
    console.error("[SYNC] meta failed:", e);
    errors.push(`Meta: ${e.message}`);
  }

  console.log(`[SYNC] runSync complete — completed: ${completed}, errors:`, errors);
  return { completed, errors };
}