import { useState, useEffect, useMemo } from "react";
import { Mono, ScoreSparkline } from "./ui";
import { computeTrends, buildWorkoutContext } from "./IntegrationsView";
import { callClaude, parseJSON } from "../api";
import { WORKOUT_OPTIMIZER_SYS } from "../prompts";

const PREVIEW_COUNT = 3;

function PhysicalityTrends({ workoutData }) {
  const [tab,      setTab]      = useState("bestset");
  const [expanded, setExpanded] = useState(false);

  const exerciseHistory = workoutData?.exerciseHistory
    ? Object.fromEntries(
        Object.entries(workoutData.exerciseHistory).map(([ex, hist]) => [
          ex, hist.map(h => ({ ...h, date: new Date(h.date) })),
        ])
      )
    : null;

  if (!exerciseHistory) return null;

  const lastSessionDate = workoutData.dateRange?.to ? new Date(workoutData.dateRange.to) : null;
  const daysAgo = lastSessionDate ? Math.floor((Date.now() - lastSessionDate) / (1000 * 60 * 60 * 24)) : null;
  const isStale = daysAgo != null && daysAgo > 7;

  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const fourWkTrends = [];
  Object.entries(exerciseHistory).forEach(([ex, hist]) => {
    const recent = hist.filter(h => h.date >= fourWeeksAgo).sort((a, b) => a.date - b.date);
    if (recent.length < 2) return;
    const earliest = recent[0], latest = recent[recent.length - 1];
    const oldBVS = earliest.bestVolSet ?? earliest.bestSet ?? null;
    const newBVS = latest.bestVolSet   ?? latest.bestSet   ?? null;
    if (!oldBVS || !newBVS) return;
    const bsDelta = (newBVS.weight * newBVS.reps) - (oldBVS.weight * oldBVS.reps);
    const svDelta = latest.sessionVolume != null && earliest.sessionVolume != null
      ? latest.sessionVolume - earliest.sessionVolume : null;
    const svPct = svDelta != null && earliest.sessionVolume > 0
      ? (svDelta / earliest.sessionVolume) * 100 : null;
    fourWkTrends.push({ ex, oldBVS, newBVS, bsDelta, svDelta, svPct, newSV: latest.sessionVolume ?? null, latestSets: latest.sets ?? null });
  });

  const isBestSet = tab === "bestset";
  const upList   = isBestSet
    ? fourWkTrends.filter(t => t.bsDelta > 0).sort((a, b) => b.bsDelta - a.bsDelta)
    : fourWkTrends.filter(t => t.svDelta != null && t.svDelta > 0).sort((a, b) => b.svPct - a.svPct);
  const downList = isBestSet
    ? fourWkTrends.filter(t => t.bsDelta < 0).sort((a, b) => a.bsDelta - b.bsDelta)
    : fourWkTrends.filter(t => t.svDelta != null && t.svDelta < 0).sort((a, b) => a.svPct - b.svPct);
  const flatList = isBestSet
    ? fourWkTrends.filter(t => t.bsDelta === 0)
    : fourWkTrends.filter(t => t.svDelta === 0);

  if (fourWkTrends.length === 0) return null;

  const maxLen    = Math.max(upList.length, downList.length, flatList.length);
  const needsMore = maxLen > PREVIEW_COUNT;
  const visibleUp   = expanded ? upList   : upList.slice(0, PREVIEW_COUNT);
  const visibleDown = expanded ? downList : downList.slice(0, PREVIEW_COUNT);
  const visibleFlat = expanded ? flatList : flatList.slice(0, PREVIEW_COUNT);

  const ExItem = ({ t, dir }) => {
    const color = dir === "up" ? "var(--g)" : dir === "down" ? "var(--r)" : "var(--text3)";
    const delta = dir === "flat"
      ? (isBestSet ? "→" : "→")
      : isBestSet
        ? `${t.bsDelta > 0 ? "+" : ""}${Math.round(t.bsDelta)}lbs`
        : `${t.svPct > 0 ? "+" : ""}${Math.round(t.svPct)}%`;
    const sub = isBestSet
      ? `${t.newBVS.reps}×${Math.round(t.newBVS.weight)}lbs${dir !== "flat" ? ` (was ${t.oldBVS.reps}×${Math.round(t.oldBVS.weight)})` : ""}`
      : t.latestSets?.length
        ? t.latestSets.map(s => `${s.weight}×${s.reps}`).join(", ")
        : t.newSV != null ? `${Math.round(t.newSV).toLocaleString()} lbs` : "—";

    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.ex}</div>
          <Mono s={{ fontSize: 14, color: "var(--text3)", marginTop: 2, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</Mono>
        </div>
        <Mono s={{ fontSize: 14, color, flexShrink: 0, fontWeight: 600 }}>{delta}</Mono>
      </div>
    );
  };

  const Col = ({ list, label, color, dir }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <Mono s={{ fontSize: 7, color, letterSpacing: 2, display: "block", marginBottom: 4 }}>{label}</Mono>
      {list.length === 0
        ? <Mono s={{ fontSize: 13, color: "var(--text3)", display: "block", paddingTop: 6 }}>—</Mono>
        : list.map((t, i) => <ExItem key={i} t={t} dir={dir} />)
      }
    </div>
  );

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Mono s={{ fontSize: 14, color: "#E8FF3B", letterSpacing: 2 }}>WORKOUT TRENDS</Mono>
        <div style={{ display: "flex", gap: 0 }}>
          {[["bestset", "BEST SET"], ["sessVol", "SESSION VOL"]].map(([v, l]) => (
            <button key={v} onClick={() => { setTab(v); setExpanded(false); }} style={{ padding: "3px 10px", background: tab === v ? "#E8FF3B18" : "none", border: `1px solid ${tab === v ? "#E8FF3B44" : "var(--border)"}`, fontFamily: "'DM Mono',monospace", fontSize: 7, letterSpacing: 1, color: tab === v ? "#E8FF3B" : "var(--text3)", cursor: "pointer" }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto" }}>
          {isStale
            ? <Mono s={{ fontSize: 7, color: "var(--o)", letterSpacing: 1 }}>⚠ {daysAgo}D OLD</Mono>
            : lastSessionDate && <Mono s={{ fontSize: 7, color: "var(--text3)" }}>{lastSessionDate.toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</Mono>
          }
        </div>
      </div>

      {/* Three-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <Col list={visibleUp}   label="▲ IMPROVING" color="var(--g)"    dir="up"   />
        <Col list={visibleDown} label="▼ DECLINING"  color="var(--r)"    dir="down" />
        <Col list={visibleFlat} label="→ STAGNANT"   color="var(--text3)" dir="flat" />
      </div>

      {needsMore && (
        <button onClick={() => setExpanded(e => !e)} style={{ marginTop: 8, background: "none", border: "none", padding: 0, fontFamily: "'DM Mono',monospace", fontSize: 14, color: "var(--text3)", cursor: "pointer", letterSpacing: 1 }}>
          {expanded ? "▲ SHOW LESS" : `▼ ${maxLen - PREVIEW_COUNT} MORE`}
        </button>
      )}
    </div>
  );
}

// ─── Workout Optimizer helpers ───────────────────────────────────────────────

function computeTypicalSets(exerciseHistory) {
  const result = {};
  if (!exerciseHistory) return result;
  Object.entries(exerciseHistory).forEach(([ex, hist]) => {
    const setCountFreq = {};
    const weightFreq   = {};
    const repsFreq     = {};
    hist.forEach(session => {
      const ws = (session.sets || []).filter(s => s.weight != null && s.reps != null);
      if (!ws.length) return;
      setCountFreq[ws.length] = (setCountFreq[ws.length] || 0) + 1;
      ws.forEach(s => {
        const w = Math.round(s.weight * 2) / 2;
        weightFreq[w] = (weightFreq[w] || 0) + 1;
        repsFreq[s.reps] = (repsFreq[s.reps] || 0) + 1;
      });
    });
    const mode = freq => {
      const entries = Object.entries(freq);
      if (!entries.length) return null;
      return parseFloat(entries.sort((a, b) => b[1] - a[1])[0][0]);
    };
    const sets   = mode(setCountFreq);
    const weight = mode(weightFreq);
    const reps   = mode(repsFreq);
    if (sets != null) result[ex] = { sets, weight: weight ?? 0, reps: reps ?? 0 };
  });
  return result;
}

// ─── Workout Optimizer ────────────────────────────────────────────────────────

const MUSCLE_KW = {
  "Chest":      ["bench", "chest", "fly", "pec", "incline", "decline", "push-up", "pushup", "cable cross"],
  "Shoulders":  ["overhead press", "ohp", "shoulder press", "lateral raise", "front raise", "military press", "arnold", "upright row"],
  "Triceps":    ["tricep", "pushdown", "skull", "extension", "close-grip", "close grip"],
  "Dips":       ["dip"],
  "Back":       ["row", "pulldown", "pull-up", "pullup", "chin-up", "chinup", "rack pull", "shrug", "t-bar", "lat pull"],
  "Biceps":     ["curl", "bicep", "hammer", "preacher", "concentration"],
  "Rear Delts": ["face pull", "rear delt", "reverse fly", "reverse pec", "band pull"],
  "Deadlift":   ["deadlift", "rdl", "romanian"],
  "Quads":      ["squat", "leg press", "lunge", "hack squat", "leg extension", "step-up"],
  "Hamstrings": ["hamstring", "leg curl", "nordic", "stiff-leg"],
  "Glutes":     ["glute", "hip thrust", "hip extension", "kickback", "bulgarian"],
  "Calves":     ["calf", "calf raise"],
  "Core":       ["crunch", "plank", "ab ", " ab", "cable crunch", "sit-up", "leg raise", "russian"],
};

function inferMuscles(exercises) {
  const found = new Set();
  exercises.forEach(ex => {
    const lower = ex.toLowerCase();
    Object.entries(MUSCLE_KW).forEach(([muscle, kws]) => {
      if (kws.some(kw => lower.includes(kw))) found.add(muscle);
    });
  });
  return [...found];
}

function detectSplit(workoutData) {
  if (!workoutData) return [];
  const { sessions = [], workoutTypes = [] } = workoutData;
  return workoutTypes.map(type => {
    const typeSessions = sessions.filter(s => s.workout === type);
    const freq = {};
    typeSessions.forEach(s =>
      Object.keys(s.exercises || {}).forEach(ex => { freq[ex] = (freq[ex] || 0) + 1; })
    );
    const topExercises = Object.entries(freq)
      .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([ex]) => ex);
    return { name: type, exercises: topExercises, muscles: inferMuscles(topExercises), sessionCount: typeSessions.length };
  });
}

const PRIORITY_COLOR = { high: "var(--r)", medium: "var(--y)", low: "var(--text3)" };
const PRIORITY_BG    = { high: "var(--r)15", medium: "var(--y)15", low: "var(--bg2)" };
const CATEGORY_ICON  = { volume: "▲", intensity: "⚡", exercise: "＋", frequency: "⟳", gap: "⚠" };

function WorkoutOptimizer({ workoutData, profile, pillar, userProfile }) {
  const cacheKey = `northstar_wopt_${workoutData?.uploadedAt || ""}`;

  const [result,       setResult]       = useState(() => {
    try { return JSON.parse(localStorage.getItem(cacheKey) || "null"); } catch { return null; }
  });
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [extraContext, setExtraContext] = useState("");
  const [editDay,      setEditDay]      = useState(null);
  const [overrides,    setOverrides]    = useState({});
  const [tableEdits,   setTableEdits]   = useState({});    // exerciseName → { sets, reps, weight }

  useEffect(() => {
    try { const c = localStorage.getItem(cacheKey); if (c) setResult(JSON.parse(c)); }
    catch { /* ignore */ }
  }, [cacheKey]);

  const split = useMemo(() => detectSplit(workoutData), [workoutData]);

  const typicalSets = useMemo(() => {
    if (!workoutData?.exerciseHistory) return {};
    const hist = Object.fromEntries(
      Object.entries(workoutData.exerciseHistory).map(([ex, h]) => [ex, h.map(s => ({ ...s, date: new Date(s.date) }))])
    );
    return computeTypicalSets(hist);
  }, [workoutData]);

  const getTableRow = (ex) => {
    const edit = tableEdits[ex];
    const typ  = typicalSets[ex] || { sets: 3, reps: 8, weight: 0 };
    return {
      sets:   edit?.sets   ?? typ.sets,
      reps:   edit?.reps   ?? typ.reps,
      weight: edit?.weight ?? typ.weight,
    };
  };

  const setTableField = (ex, field, val) =>
    setTableEdits(prev => ({ ...prev, [ex]: { ...getTableRow(ex), ...prev[ex], [field]: val === "" ? "" : Number(val) } }));

  const buildPrompt = () => {
    const goals = pillar.questions
      .filter(q => q.core)
      .map(q => `Q: ${q.q}\nA: ${profile?.answers?.[q.key] || "N/A"}`)
      .join("\n\n");

    const splitText = split.map(day => {
      const ov = overrides[day.name];
      const muscles   = ov?.muscles?.trim()   || day.muscles.join(", ")   || "unknown";
      const exercises = ov?.exercises?.trim() || day.exercises.join(", ") || "unknown";
      return `${day.name} (${day.sessionCount} sessions) — muscles: ${muscles}\n  Key exercises: ${exercises}`;
    }).join("\n\n");

    // Build exercise volume table lines
    const volumeLines = split.flatMap(day => {
      const ov = overrides[day.name];
      const exercises = (ov?.exercises?.trim() ? ov.exercises.split(",").map(e => e.trim()) : day.exercises).filter(Boolean);
      return exercises.map(ex => {
        const row = getTableRow(ex);
        const vol = row.sets && row.reps && row.weight ? Math.round(row.sets * row.reps * row.weight) : null;
        return `  [${day.name}] ${ex}: ${row.sets} sets × ${row.reps} reps @ ${row.weight}lbs${vol ? ` = ${vol.toLocaleString()} lbs total volume` : ""}`;
      });
    });

    // Body stats block
    let bodyStats = "";
    if (userProfile?.age || userProfile?.sex || userProfile?.height || userProfile?.weight) {
      const bmi = userProfile.height && userProfile.weight
        ? (userProfile.weight / ((userProfile.height / 100) ** 2)).toFixed(1)
        : null;
      bodyStats = [
        "BODY STATS (for population comparison):",
        userProfile.sex    ? `  Sex: ${userProfile.sex}`                : null,
        userProfile.age    ? `  Age: ${userProfile.age}`                : null,
        userProfile.height ? `  Height: ${userProfile.height}cm`        : null,
        userProfile.weight ? `  Weight: ${userProfile.weight}kg`        : null,
        bmi                ? `  BMI: ${bmi}`                            : null,
      ].filter(Boolean).join("\n");
    }

    const workoutCtx = buildWorkoutContext(workoutData);
    return [
      "PHYSIQUE GOALS:\n" + goals,
      bodyStats,
      extraContext.trim() ? "ADDITIONAL CONTEXT:\n" + extraContext.trim() : "",
      "WORKOUT SPLIT:\n" + splitText,
      volumeLines.length ? "EXERCISE VOLUME (most common sets × reps @ weight):\n" + volumeLines.join("\n") : "",
      "PERFORMANCE DATA:\n" + workoutCtx,
    ].filter(Boolean).join("\n\n");
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const text   = await callClaude([{ role: "user", content: buildPrompt() }], WORKOUT_OPTIMIZER_SYS, false);
      const parsed = parseJSON(text);
      if (parsed) {
        const r = { ...parsed, generatedAt: new Date().toISOString() };
        setResult(r);
        localStorage.setItem(cacheKey, JSON.stringify(r));
      } else {
        setError("Couldn't parse the response — try again.");
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const genAge = result?.generatedAt
    ? Math.round((Date.now() - new Date(result.generatedAt)) / (1000 * 60 * 60))
    : null;

  return (
    <div style={{ maxWidth: 740 }}>

      {/* ── Split preview ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <Mono s={{ fontSize: 13, color: "var(--text3)", letterSpacing: 2 }}>DETECTED SPLIT</Mono>
          <Mono s={{ fontSize: 11, color: "var(--text3)" }}>from Hevy · click day to override</Mono>
        </div>

        {split.length === 0 ? (
          <div style={{ color: "var(--text3)", fontSize: 13, padding: "20px 0" }}>No workout data — upload Hevy CSV in Integrations.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {split.map((day, i) => {
              const ov = overrides[day.name] || {};
              const isEditing = editDay === i;
              return (
                <div key={day.name} style={{ background: "var(--bg1)", border: `1px solid ${isEditing ? "var(--c)88" : "var(--border)"}`, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isEditing ? 10 : 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <Mono s={{ fontSize: 13, color: "var(--c)", letterSpacing: 1 }}>{day.name}</Mono>
                      <span style={{ fontSize: 12, color: "var(--text3)" }}>{day.sessionCount}×</span>
                    </div>
                    <button
                      onClick={() => setEditDay(isEditing ? null : i)}
                      style={{ background: "none", border: "none", color: isEditing ? "var(--c)" : "var(--text3)", fontFamily: "'DM Mono',monospace", fontSize: 12, letterSpacing: 1, cursor: "pointer", padding: 0 }}
                    >{isEditing ? "DONE" : "EDIT"}</button>
                  </div>

                  {!isEditing && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 3 }}>
                        <span style={{ color: "var(--text2)" }}>{ov.muscles || day.muscles.join(", ") || "—"}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5 }}>
                        {(ov.exercises || day.exercises.join(", ") || "—")}
                      </div>
                    </div>
                  )}

                  {isEditing && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div>
                        <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--text3)", letterSpacing: 1, display: "block", marginBottom: 4 }}>MUSCLE GROUPS</label>
                        <input
                          value={ov.muscles ?? day.muscles.join(", ")}
                          onChange={e => setOverrides(o => ({ ...o, [day.name]: { ...o[day.name], muscles: e.target.value } }))}
                          style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "'DM Mono',monospace", fontSize: 13, padding: "6px 10px", boxSizing: "border-box" }}
                          placeholder="e.g. Chest, Shoulders, Triceps"
                        />
                      </div>
                      <div>
                        <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--text3)", letterSpacing: 1, display: "block", marginBottom: 4 }}>EXERCISES</label>
                        <input
                          value={ov.exercises ?? day.exercises.join(", ")}
                          onChange={e => setOverrides(o => ({ ...o, [day.name]: { ...o[day.name], exercises: e.target.value } }))}
                          style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "'DM Mono',monospace", fontSize: 13, padding: "6px 10px", boxSizing: "border-box" }}
                          placeholder="e.g. Bench Press, OHP, Lateral Raise..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Exercise volume table ── */}
      {split.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Mono s={{ fontSize: 13, color: "var(--text3)", letterSpacing: 2 }}>EXERCISE VOLUME</Mono>
            <Mono s={{ fontSize: 11, color: "var(--text3)" }}>most common sets × reps · editable</Mono>
          </div>
          <div style={{ border: "1px solid var(--border)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg2)" }}>
                  {["EXERCISE", "DAY", "SETS", "REPS", "WEIGHT (lbs)", "VOLUME"].map((h, i) => (
                    <th key={i} style={{ padding: "6px 10px", textAlign: i >= 2 ? "center" : "left", fontFamily: "'DM Mono',monospace", fontSize: 7, letterSpacing: 1, color: "var(--text3)", fontWeight: 400, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {split.flatMap(day => {
                  const ov = overrides[day.name];
                  const exercises = (ov?.exercises?.trim() ? ov.exercises.split(",").map(e => e.trim()) : day.exercises).filter(Boolean);
                  return exercises.map((ex, ei) => {
                    const row = getTableRow(ex);
                    const vol = row.sets && row.reps && row.weight ? Math.round(row.sets * row.reps * row.weight) : null;
                    const isEdited = !!(tableEdits[ex]);
                    return (
                      <tr key={`${day.name}-${ex}`} style={{ borderBottom: "1px solid var(--border)", background: ei % 2 === 0 ? "var(--bg1)" : "var(--bg2)" }}>
                        <td style={{ padding: "6px 10px", color: "var(--text)", fontSize: 13, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ex}
                          {isEdited && <span style={{ marginLeft: 5, color: "var(--c)", fontSize: 9 }}>edited</span>}
                        </td>
                        <td style={{ padding: "6px 10px" }}>
                          <Mono s={{ fontSize: 11, color: "var(--text3)" }}>{day.name}</Mono>
                        </td>
                        {["sets", "reps", "weight"].map(field => (
                          <td key={field} style={{ padding: "4px 6px", textAlign: "center" }}>
                            <input
                              type="number"
                              value={row[field]}
                              onChange={e => setTableField(ex, field, e.target.value)}
                              style={{ width: 58, padding: "4px 6px", background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "'DM Mono',monospace", fontSize: 13, textAlign: "center", boxSizing: "border-box" }}
                              min={0}
                            />
                          </td>
                        ))}
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          <Mono s={{ fontSize: 13, color: vol ? "var(--p)" : "var(--text3)" }}>
                            {vol ? vol.toLocaleString() : "—"}
                          </Mono>
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Optional extra context ── */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--text3)", letterSpacing: 1, display: "block", marginBottom: 6 }}>EXTRA CONTEXT (optional)</label>
        <textarea
          value={extraContext}
          onChange={e => setExtraContext(e.target.value)}
          rows={2}
          placeholder="e.g. prioritizing hypertrophy over strength, recovering from shoulder strain, contest prep in 12 weeks..."
          style={{ width: "100%", background: "var(--bg1)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "'DM Mono',monospace", fontSize: 13, padding: "10px 12px", resize: "vertical", boxSizing: "border-box" }}
        />
      </div>

      {/* ── Run button ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
        <button
          onClick={run}
          disabled={loading || split.length === 0}
          style={{ background: loading ? "var(--bg2)" : "var(--c)", color: loading ? "var(--text3)" : "#000", border: "none", padding: "11px 24px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 2, fontWeight: 600, cursor: loading ? "default" : "pointer" }}
        >
          {loading ? "ANALYZING..." : result ? "RE-ANALYZE" : "ANALYZE WORKOUTS →"}
        </button>
        {result && genAge !== null && (
          <Mono s={{ fontSize: 12, color: "var(--text3)" }}>
            last run {genAge < 1 ? "just now" : genAge === 1 ? "1h ago" : `${genAge}h ago`}
          </Mono>
        )}
      </div>

      {error && <div style={{ color: "var(--r)", fontSize: 13, fontFamily: "'DM Mono',monospace", marginBottom: 20 }}>{error}</div>}

      {/* ── Results ── */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Top priority */}
          <div style={{ background: "var(--c)15", border: "1px solid var(--c)44", padding: "14px 16px", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--c)" }} />
            <Mono s={{ fontSize: 11, color: "var(--c)", letterSpacing: 2, display: "block", marginBottom: 6 }}>TOP PRIORITY THIS WEEK</Mono>
            <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6 }}>{result.topPriority}</div>
          </div>

          {/* Assessment */}
          <div>
            <Mono s={{ fontSize: 12, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 8 }}>SPLIT ASSESSMENT</Mono>
            <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.7, paddingLeft: 12, borderLeft: "2px solid var(--border)" }}>{result.splitAssessment}</div>
          </div>

          {/* Physical comparison */}
          {result.physicalComparison && (
            <div>
              <Mono s={{ fontSize: 12, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 10 }}>POPULATION COMPARISON</Mono>
              <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.7, paddingLeft: 12, borderLeft: "2px solid var(--border)", marginBottom: 12 }}>
                {result.physicalComparison.summary}
              </div>
              {result.physicalComparison.categories?.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {result.physicalComparison.categories.map((cat, i) => {
                    const ratingColor = {
                      elite: "var(--g)", advanced: "var(--c)", intermediate: "var(--y)",
                      novice: "var(--o)", beginner: "var(--r)",
                    }[cat.rating] || "var(--text3)";
                    return (
                      <div key={i} style={{ background: "var(--bg2)", border: `1px solid ${ratingColor}33`, padding: "12px 14px" }}>
                        <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 5 }}>{cat.name?.toUpperCase()}</Mono>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
                          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: ratingColor, lineHeight: 1, textTransform: "uppercase" }}>{cat.rating}</div>
                          {cat.percentileApprox != null && (
                            <Mono s={{ fontSize: 11, color: "var(--text3)" }}>top {100 - cat.percentileApprox}%</Mono>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.55 }}>{cat.note}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Muscle gaps */}
          {result.muscleGaps?.length > 0 && (
            <div>
              <Mono s={{ fontSize: 12, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 8 }}>GAPS ⚠</Mono>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.muscleGaps.map((g, i) => (
                  <span key={i} style={{ background: "var(--r)15", border: "1px solid var(--r)44", color: "var(--r)", fontFamily: "'DM Mono',monospace", fontSize: 12, padding: "3px 10px", letterSpacing: 0.5 }}>{g}</span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div>
            <Mono s={{ fontSize: 12, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 10 }}>RECOMMENDATIONS</Mono>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(result.recommendations || []).map((r, i) => (
                <div key={i} style={{ background: PRIORITY_BG[r.priority] || "var(--bg2)", border: `1px solid ${PRIORITY_COLOR[r.priority] || "var(--border)"}44`, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: PRIORITY_COLOR[r.priority] || "var(--text3)" }}>
                      {CATEGORY_ICON[r.category] || "◈"}
                    </span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "var(--text)", fontWeight: 600 }}>
                      {r.exercise ? r.exercise.toUpperCase() : r.category?.toUpperCase()}
                    </span>
                    {r.day && (
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--text3)", background: "var(--bg2)", padding: "2px 7px" }}>{r.day}</span>
                    )}
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: PRIORITY_COLOR[r.priority] || "var(--text3)", marginLeft: "auto" }}>
                      {r.priority?.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600, marginBottom: 4 }}>{r.action}</div>
                  <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.6 }}>{r.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main view ─────────────────────────────────────────────────────────────────

export default function PillarView({ pillar, state, onSave, onDraftChange }) {
  const analysis   = state.analyses[pillar.id];
  const profile    = state.profiles[pillar.id];
  const draft      = state.drafts?.[pillar.id] || {};
  const [mode, setMode]               = useState(analysis ? "analysis" : "input");
  const [saved, setSaved]             = useState(false);
  const [statusLocked, setStatusLocked]         = useState(true);
  const [showStatusWarning, setShowStatusWarning] = useState(false);

  const answers = draft.answers !== undefined ? draft.answers : (profile?.answers || {});
  const extra   = draft.extra   !== undefined ? draft.extra   : (profile?.extra   || "");

  const setAnswers = (fn) => onDraftChange(pillar.id, { answers: typeof fn === "function" ? fn(answers) : fn, extra });
  const setExtra   = (val) => onDraftChange(pillar.id, { answers, extra: val });

  // Just save answers locally — sync handles the API call
  const saveAnswers = () => {
    onSave(pillar.id, { answers, extra });
    onDraftChange(pillar.id, {});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    // Switch to analysis view if there's already an analysis, otherwise stay on input
    if (analysis) setMode("analysis");
  };

  const allAnswered = pillar.questions.filter(q => q.core).every(q => answers[q.key]?.trim());
  const hasChanges  = JSON.stringify(answers) !== JSON.stringify(profile?.answers || {}) || extra !== (profile?.extra || "");

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, paddingBottom: 18, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ color: pillar.color, fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 3, marginBottom: 5 }}>{pillar.icon} {pillar.label}</div>
          <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 34, letterSpacing: 1, color: "var(--text)" }}>{pillar.sub}</h2>
        </div>
        {analysis && pillar.id === "physicality" && state.integrations?.workoutData ? (
          <div style={{ display: "flex", gap: 0 }}>
            {[["analysis", "ANALYSIS"], ["optimizer", "OPTIMIZER"], ["input", "EDIT GOALS"]].map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{ background: mode === m ? "var(--c)" : "none", color: mode === m ? "#000" : "var(--text3)", border: "1px solid var(--border)", borderRight: m === "input" ? "1px solid var(--border)" : "none", padding: "7px 14px", fontFamily: "'DM Mono',monospace", fontSize: 12, letterSpacing: 1, cursor: "pointer" }}
              >{label}</button>
            ))}
          </div>
        ) : analysis ? (
          <button onClick={() => setMode(m => m === "analysis" ? "input" : "analysis")} className="hov-border" style={{ background: "none", border: "1px solid var(--border)", color: "var(--text2)", padding: "7px 14px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1 }}>
            {mode === "analysis" ? "EDIT CORE GOALS" : "VIEW ANALYSIS"}
          </button>
        ) : null}
      </div>

      {mode === "input" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 726 }}>
          {/* Sync callout — only on first setup (no analysis yet) */}
          {!analysis && (
            <div style={{ background: pillar.color + "0D", border: `1px solid ${pillar.color}33`, padding: "12px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ color: pillar.color, fontSize: 14, flexShrink: 0 }}>ℹ</span>
              <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
                Fill in your answers and save. Then hit <strong style={{ color: "var(--c)" }}>⟳ SYNC NORTHSTAR</strong> in the top bar to run the analysis — this keeps all API calls together and avoids rate limits.
              </div>
            </div>
          )}

          {/* Core goals section */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${pillar.color}33` }}>
              <Mono s={{ fontSize: 13, color: pillar.color, letterSpacing: 2 }}>CORE GOALS</Mono>
              <Mono s={{ fontSize: 13, color: "var(--text3)" }}>— set once, kept across weeks</Mono>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {pillar.questions.filter(q => q.core).map((q, i) => (
                <div key={q.key}>
                  <label style={{ display: "block", fontFamily: "'DM Mono',monospace", fontSize: 13, color: "var(--text3)", letterSpacing: 1.5, marginBottom: 7, textTransform: "uppercase" }}>
                    <span style={{ color: pillar.color }}>{String(i + 1).padStart(2, "0")}</span>{"  "}{q.q}
                  </label>
                  <textarea
                    rows={2}
                    value={answers[q.key] || ""}
                    onChange={e => setAnswers(a => ({ ...a, [q.key]: e.target.value }))}
                    placeholder="Be specific — this stays as your long-term anchor..."
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, resize: "vertical", lineHeight: 1.6, border: `1px solid ${answers[q.key]?.trim() ? pillar.color + "55" : "var(--border)"}` }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Current status section */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
              <Mono s={{ fontSize: 13, color: "var(--text3)", letterSpacing: 2 }}>CURRENT STATUS</Mono>
              <Mono s={{ fontSize: 13, color: "var(--text3)" }}>— updated each week from your check-in</Mono>
              <button
                onClick={() => statusLocked ? setShowStatusWarning(true) : setStatusLocked(true)}
                style={{ marginLeft: "auto", background: "none", border: "1px solid var(--border)", color: statusLocked ? "var(--text3)" : "var(--o)", padding: "3px 10px", fontFamily: "'DM Mono',monospace", fontSize: 14, letterSpacing: 1, cursor: "pointer" }}
              >
                {statusLocked ? "EDIT" : "LOCK"}
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, opacity: statusLocked ? 0.5 : 1, transition: "opacity 0.2s" }}>
              {pillar.questions.filter(q => !q.core).map((q, i) => (
                <div key={q.key}>
                  <label style={{ display: "block", fontFamily: "'DM Mono',monospace", fontSize: 13, color: "var(--text3)", letterSpacing: 1.5, marginBottom: 7, textTransform: "uppercase" }}>
                    <span style={{ color: "var(--text3)" }}>{String(i + 1).padStart(2, "0")}</span>{"  "}{q.q}
                  </label>
                  <textarea
                    rows={2}
                    value={answers[q.key] || ""}
                    onChange={e => !statusLocked && setAnswers(a => ({ ...a, [q.key]: e.target.value }))}
                    readOnly={statusLocked}
                    placeholder={statusLocked ? "" : "Be specific — detail = better output..."}
                    style={{ width: "100%", padding: "10px 12px", fontSize: 14, resize: statusLocked ? "none" : "vertical", lineHeight: 1.6, border: `1px solid ${!statusLocked && answers[q.key]?.trim() ? pillar.color + "55" : "var(--border)"}`, cursor: statusLocked ? "default" : "text", background: statusLocked ? "var(--bg2)" : undefined }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Status warning modal */}
          {showStatusWarning && (
            <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowStatusWarning(false)}>
              <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg1)", border: "1px solid var(--border)", padding: "28px 30px", maxWidth: 420, width: "90%", position: "relative" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--o)" }} />
                <Mono s={{ fontSize: 13, color: "var(--o)", letterSpacing: 2, display: "block", marginBottom: 12 }}>⚠ HEADS UP</Mono>
                <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7, marginBottom: 20 }}>
                  These fields are automatically updated during your <strong>weekly check-in</strong>. Editing them manually may be overwritten next Sunday.
                </div>
                <div style={{ fontSize: 14, color: "var(--text3)", lineHeight: 1.6, marginBottom: 24 }}>
                  We recommend answering them through the check-in flow so northstar has full context. Edit manually only if you need to correct something right now.
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => { setShowStatusWarning(false); setStatusLocked(false); }}
                    style={{ background: "var(--o)", color: "#000", border: "none", padding: "10px 20px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1, cursor: "pointer", fontWeight: 600 }}
                  >
                    EDIT ANYWAY
                  </button>
                  <button
                    onClick={() => setShowStatusWarning(false)}
                    style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "10px 20px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1, cursor: "pointer" }}
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ opacity: statusLocked ? 0.5 : 1, transition: "opacity 0.2s" }}>
            <label style={{ display: "block", fontFamily: "'DM Mono',monospace", fontSize: 13, color: "var(--text3)", letterSpacing: 1.5, marginBottom: 7 }}>ADDITIONAL CONTEXT (optional)</label>
            <textarea rows={3} value={extra} onChange={e => !statusLocked && setExtra(e.target.value)} readOnly={statusLocked} placeholder={statusLocked ? "" : "Anything else Northstar should know..."} style={{ width: "100%", padding: "10px 12px", fontSize: 14, resize: statusLocked ? "none" : "vertical", lineHeight: 1.6, cursor: statusLocked ? "default" : "text", background: statusLocked ? "var(--bg2)" : undefined }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              disabled={!allAnswered}
              onClick={saveAnswers}
              style={{
                background: saved ? "var(--g)" : allAnswered ? pillar.color : "var(--bg2)",
                color: allAnswered ? "#000" : "var(--text3)",
                border: "none", padding: "12px 26px",
                fontFamily: "'DM Mono',monospace", fontSize: 14, letterSpacing: 2,
                cursor: allAnswered ? "pointer" : "not-allowed", fontWeight: 500,
                transition: "background 0.2s",
              }}
            >
              {saved ? "✓ SAVED" : analysis ? "SAVE CHANGES" : "SAVE ANSWERS"}
            </button>
            {allAnswered && !saved && (
              <Mono s={{ fontSize: 13, color: "var(--text3)" }}>
                {analysis ? "then run ⟳ SYNC NORTHSTAR to re-analyze" : "then run ⟳ SYNC NORTHSTAR to analyze"}
              </Mono>
            )}
          </div>
        </div>

      ) : mode === "optimizer" && pillar.id === "physicality" ? (
        <WorkoutOptimizer
          workoutData={state.integrations?.workoutData}
          profile={profile}
          pillar={pillar}
          userProfile={state.userProfile}
        />
      ) : (
        /* Analysis display */
        <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 770 }}>
          <div className="fu" style={{ borderLeft: `2px solid ${pillar.color}`, paddingLeft: 16 }}>
            <Mono s={{ fontSize: 13, color: pillar.color, letterSpacing: 2, display: "block", marginBottom: 7 }}>ASSESSMENT</Mono>
            <p style={{ color: "var(--text)", fontSize: 14, lineHeight: 1.7 }}>{analysis?.assessment}</p>
          </div>

          <div className="fu1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", padding: 14 }}>
              <Mono s={{ fontSize: 14, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 8 }}>{pillar.label} SCORE</Mono>
              {analysis?.scoreHistory?.length >= 2
                ? <ScoreSparkline history={analysis.scoreHistory} color={pillar.color} />
                : <div style={{ fontFamily: "'Bebas Neue'", fontSize: 34, color: analysis?.priorityScore >= 80 ? "var(--o)" : analysis?.priorityScore >= 50 ? "var(--y)" : "var(--c)", lineHeight: 1 }}>{analysis?.priorityScore}<span style={{ fontSize: 14, color: "var(--text3)" }}>/100</span></div>
              }
            </div>
            {[{ l: "30-DAY TARGET", v: analysis?.thirtyDayMilestone }, { l: "90-DAY TARGET", v: analysis?.ninetyDayMilestone }].map(m => (
              <div key={m.l} style={{ background: "var(--bg2)", border: "1px solid var(--border)", padding: 14 }}>
                <Mono s={{ fontSize: 14, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 7 }}>{m.l}</Mono>
                <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.5 }}>{m.v}</div>
              </div>
            ))}
          </div>

          {pillar.id === "physicality" && state.integrations?.workoutData && (
            <PhysicalityTrends workoutData={state.integrations.workoutData} />
          )}

          {(analysis?.wins?.length > 0 || analysis?.losses?.length > 0) && (
            <div className="fu-wl" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "var(--g)0D", border: "1px solid var(--g)33", padding: "14px 16px" }}>
                <Mono s={{ fontSize: 14, color: "var(--g)", letterSpacing: 2, display: "block", marginBottom: 10 }}>WINS</Mono>
                {(analysis.wins || []).map((w, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, alignItems: "flex-start" }}>
                    <span style={{ color: "var(--g)", fontSize: 14, flexShrink: 0, marginTop: 3 }}>▲</span>
                    <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>{w}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: "var(--r)0D", border: "1px solid var(--r)33", padding: "14px 16px" }}>
                <Mono s={{ fontSize: 14, color: "var(--r)", letterSpacing: 2, display: "block", marginBottom: 10 }}>LOSSES</Mono>
                {(analysis.losses || []).map((l, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, alignItems: "flex-start" }}>
                    <span style={{ color: "var(--r)", fontSize: 14, flexShrink: 0, marginTop: 3 }}>▼</span>
                    <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="fu2" style={{ background: pillar.color + "0D", border: `1px solid ${pillar.color}33`, padding: "16px 18px" }}>
            <Mono s={{ fontSize: 14, color: pillar.color, letterSpacing: 2, display: "block", marginBottom: 7 }}>KEY INSIGHT</Mono>
            <p style={{ color: "var(--text)", fontSize: 13, fontStyle: "italic", lineHeight: 1.7 }}>"{analysis?.keyInsight}"</p>
          </div>

          <div className="fu3">
            <Mono s={{ fontSize: 13, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 10 }}>THIS WEEK — MISSIONS</Mono>
            <div style={{ background: pillar.color + "0D", border: `1px solid ${pillar.color}33`, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ color: pillar.color, fontSize: 16, flexShrink: 0, lineHeight: 1 }}>◉</span>
              <div>
                <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500, marginBottom: 4 }}>
                  {(analysis?.weeklyActions?.length || 0)} mission{(analysis?.weeklyActions?.length || 0) !== 1 ? "s" : ""} sent to Mission Control
                </div>
                <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>
                  Pillar missions have been added to your pending queue. Head to <span style={{ color: pillar.color, fontFamily: "'DM Mono',monospace" }}>MISSIONS</span> to accept or decline them.
                </div>
              </div>
            </div>
          </div>

          {analysis?.resources?.length > 0 && (
            <div className="fu4">
              <Mono s={{ fontSize: 13, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 10 }}>RESOURCES</Mono>
              {analysis.resources.map((r, i) => (
                <div key={i} style={{ fontSize: 14, color: "var(--text2)", paddingLeft: 12, borderLeft: `1px solid ${pillar.color}44`, lineHeight: 1.5, marginBottom: 6 }}>{r}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}