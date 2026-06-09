import { useState } from "react";
import { PILLARS } from "../constants";
import { Mono, Tag, PillarDot, DiffTag } from "./ui";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDeadline(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, overdue: true, urgent: false };
  if (diffDays === 0) return { label: "Due today",    overdue: false, urgent: true };
  if (diffDays === 1) return { label: "Due tomorrow", overdue: false, urgent: true };
  if (diffDays <= 7)  return { label: `${diffDays}d left`, overdue: false, urgent: diffDays <= 2 };
  return { label: d.toLocaleDateString("en-CA", { month: "short", day: "numeric" }), overdue: false, urgent: false };
}

const DUE_TYPE_LABELS = {
  today:      { label: "Due today",    color: "var(--r)"     },
  this_week:  { label: "This week",    color: "var(--o)"     },
  two_weeks:  { label: "Within 2 wks", color: "var(--y)"     },
  this_month: { label: "This month",   color: "var(--text3)" },
};

// ── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, max, color = "var(--c)" }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width 0.2s ease", borderRadius: 2 }} />
    </div>
  );
}

// ── Subtask list ──────────────────────────────────────────────────────────────

// preview=true → read-only locked checkboxes (used in PendingMissionCard)
function SubtaskList({ subtasks, missionId, onToggle, preview = false, pillarColor = "var(--c)" }) {
  if (!subtasks || subtasks.length === 0) return null;
  const doneCount = subtasks.filter(st => st.done).length;
  const total     = subtasks.length;
  const allDone   = doneCount === total;
  const barColor  = preview ? "var(--border2)" : (allDone ? "var(--g)" : pillarColor);

  return (
    <div style={{ marginTop: 10 }}>
      {/* Progress summary row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <Mono s={{ fontSize: 14, color: preview ? "var(--text3)" : (allDone ? "var(--g)" : pillarColor), letterSpacing: 1.5 }}>
          {preview ? "SUBTASKS PREVIEW" : "SUBTASKS"}
        </Mono>
        <Mono s={{ fontSize: 14, color: preview ? "var(--text3)" : (allDone ? "var(--g)" : "var(--text2)") }}>
          {preview ? `${total} STEP${total !== 1 ? "S" : ""}` : `${doneCount}/${total}`}
        </Mono>
      </div>
      {/* Progress bar (active only) */}
      {!preview && <div style={{ marginBottom: 8 }}><ProgressBar value={doneCount} max={total} color={barColor} /></div>}
      {/* Checklist rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {subtasks.map((st, i) => {
          const isDone = preview ? false : st.done;
          const box = (
            <div style={{
              width: 13, height: 13,
              border: `1.5px solid ${isDone ? pillarColor : preview ? "var(--border2)" : "var(--border2)"}`,
              background: isDone ? pillarColor + "22" : "transparent",
              flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {isDone && <span style={{ color: pillarColor, fontSize: 14, lineHeight: 1 }}>✓</span>}
            </div>
          );
          if (preview) {
            return (
              <div key={st.id || i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", opacity: 0.6 }}>
                {box}
                <span style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.4 }}>{st.label || st}</span>
              </div>
            );
          }
          return (
            <button
              key={st.id}
              onClick={() => onToggle(missionId, st.id)}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", textAlign: "left", padding: "3px 0", cursor: "pointer" }}
            >
              {box}
              <span style={{ fontSize: 14, color: isDone ? "var(--text3)" : "var(--text2)", textDecoration: isDone ? "line-through" : "none", lineHeight: 1.4 }}>{st.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Counter control ──────────────────────────────────────────────────────────

function CounterControl({ value, max, missionId, onIncrement, color = "var(--c)" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
      <button
        onClick={() => onIncrement(missionId, -1)}
        disabled={value <= 0}
        style={{ width: 26, height: 26, border: "1px solid var(--border2)", background: "none", color: value > 0 ? "var(--text2)" : "var(--border2)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: value > 0 ? "pointer" : "not-allowed", lineHeight: 1, flexShrink: 0 }}
      >−</button>
      <Mono s={{ fontSize: 14, color, minWidth: 48, textAlign: "center" }}>{value}/{max}</Mono>
      <button
        onClick={() => onIncrement(missionId, 1)}
        disabled={value >= max}
        style={{ width: 26, height: 26, border: `1px solid ${value < max ? color + "55" : "var(--border2)"}`, background: value < max ? color + "22" : "none", color: value < max ? color : "var(--border2)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: value < max ? "pointer" : "not-allowed", lineHeight: 1, flexShrink: 0 }}
      >+</button>
    </div>
  );
}

// ── Pending card ─────────────────────────────────────────────────────────────

function PendingMissionCard({ m, onAccept, onAcceptRecurring, onDecline }) {
  const initFields = {
    title:         m.title,
    description:   m.description || "",
    why:           m.why || "",
    estimatedTime: m.estimatedTime || "1h",
    difficulty:    m.difficulty || "Medium",
    dueType:       m.dueType || "this_week",
    missionType:   m.missionType || "standard",
    targetCount:   m.targetCount || 3,
    subtasks:      (m.subtasks || []).map(s => typeof s === "string" ? s : (s.label || "")),
  };
  const [exp,     setExp]     = useState(false);
  const [editing, setEditing] = useState(false);
  // `saved` = committed preview state; `draft` = in-progress edits
  const [saved,   setSaved]   = useState(initFields);
  const [draft,   setDraft]   = useState(initFields);

  const p = PILLARS.find(x => x.id === m.pillar);
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  // Preview uses saved (not raw m), so edits are reflected after Save
  const effectiveType = saved.missionType;
  const isRecurring   = effectiveType === "recurring";
  const isCounted     = effectiveType === "counted";
  const hasCount      = isRecurring || isCounted;

  // isDirty compares draft vs saved (unsaved in-progress changes)
  const draftType   = draft.missionType;
  const draftHasCount = draftType === "recurring" || draftType === "counted";
  const isDirty = draft.title !== saved.title
    || draft.description !== saved.description
    || draft.why !== saved.why
    || draft.estimatedTime !== saved.estimatedTime
    || draft.difficulty !== saved.difficulty
    || draft.dueType !== saved.dueType
    || draft.missionType !== saved.missionType
    || Number(draft.targetCount) !== Number(saved.targetCount)
    || JSON.stringify(draft.subtasks.filter(s => s.trim())) !== JSON.stringify(saved.subtasks.filter(s => s.trim()));

  // isSavedEdited: saved differs from original m (shown as EDITED tag)
  const origSubtasks = (m.subtasks || []).map(s => typeof s === "string" ? s : s.label);
  const isSavedEdited = saved.title !== m.title
    || saved.description !== (m.description || "")
    || saved.why !== (m.why || "")
    || saved.estimatedTime !== (m.estimatedTime || "1h")
    || saved.difficulty !== (m.difficulty || "Medium")
    || saved.dueType !== (m.dueType || "this_week")
    || saved.missionType !== (m.missionType || "standard")
    || Number(saved.targetCount) !== (m.targetCount || 3)
    || JSON.stringify(saved.subtasks.filter(s => s.trim())) !== JSON.stringify(origSubtasks);

  const handleSaveEdits = () => {
    setSaved({ ...draft, subtasks: draft.subtasks });
    setEditing(false);
  };

  const handleDiscardEdits = () => {
    setDraft({ ...saved });
    setEditing(false);
  };

  const handleAccept = () => {
    const tc = saved.missionType === "recurring" || saved.missionType === "counted";
    const payload = isSavedEdited ? {
      ...m, ...saved,
      subtasks: saved.subtasks.filter(s => s.trim()),
      targetCount: tc ? Number(saved.targetCount) : null,
    } : null;
    if (saved.missionType === "recurring") {
      onAcceptRecurring(m.id, payload);
    } else {
      onAccept(m.id, payload);
    }
  };

  const handleCancel = () => {
    setSaved(initFields);
    setDraft(initFields);
    setEditing(false);
  };

  const inputStyle = { width: "100%", padding: "7px 9px", fontSize: 14, background: "var(--bg3)", border: "1px solid var(--border2)", color: "var(--text)", fontFamily: "inherit", lineHeight: 1.5 };
  const labelStyle = { display: "block", fontFamily: "'DM Mono',monospace", fontSize: 14, color: "var(--text3)", letterSpacing: 1.5, marginBottom: 5 };

  return (
    <div style={{ background: "var(--bg2)", border: `1px solid ${editing ? (p?.color || "var(--border)") + "66" : "var(--border)"}`, padding: 16, position: "relative", overflow: "hidden", transition: "border-color 0.15s" }}>
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2, background: p?.color || "var(--border)" }} />
      <div style={{ paddingLeft: 10 }}>

        {/* Header */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 5, flexWrap: "wrap" }}>
              <PillarDot id={m.pillar} size={6} />
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{saved.title}</div>
              {isSavedEdited && !editing && <Tag color="var(--y)">EDITED</Tag>}
              {m.source === "check-in" && <Tag color="var(--c)">CHECK-IN</Tag>}
              {m.source === "pillar"   && <Tag color={p?.color || "var(--text3)"}>PILLAR ANALYSIS</Tag>}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <DiffTag level={saved.difficulty} />
              <Tag color="var(--text3)">{saved.estimatedTime}</Tag>
              <Tag color={p?.color || "var(--text3)"}>{p?.label || m.pillar}</Tag>
              {effectiveType === "recurring" && <Tag color="var(--p)">⟳ RECURRING</Tag>}
              {effectiveType === "counted"   && <Tag color="var(--c)">◎ ×{saved.targetCount || "?"}</Tag>}
              {effectiveType !== "recurring" && (() => {
                const due = DUE_TYPE_LABELS[saved.dueType];
                return due ? <Tag color={due.color}>⏱ {due.label}</Tag> : null;
              })()}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {!editing && <button onClick={() => { setEditing(true); setExp(false); }} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "2px 9px", fontFamily: "'DM Mono',monospace", fontSize: 14, letterSpacing: 1 }}>EDIT</button>}
            {!editing && <button onClick={() => setExp(e => !e)} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 13, padding: "0 3px" }}>{exp ? "▲" : "▼"}</button>}
          </div>
        </div>

        {/* Inline subtask/counter preview — always shown for pending cards */}
        {!editing && (() => {
          const savedSubtasks = saved.subtasks.filter(s => s.trim()).map((s, i) => ({ id: `prev_${i}`, label: s, done: false }));
          const tc = Number(saved.targetCount) || 3;
          if (effectiveType === "counted" || effectiveType === "recurring") {
            return (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <Mono s={{ fontSize: 14, color: "var(--text3)", letterSpacing: 1.5 }}>
                    {effectiveType === "recurring" ? "WEEKLY TARGET" : "PROGRESS TARGET"}
                  </Mono>
                  <Mono s={{ fontSize: 14, color: "var(--text3)" }}>0/{tc}</Mono>
                </div>
                <ProgressBar value={0} max={tc} color={(p?.color || "var(--c)") + "33"} />
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  {Array.from({ length: Math.min(tc, 12) }).map((_, i) => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: (p?.color || "var(--c)") + "33", border: `1px solid ${(p?.color || "var(--c)") + "55"}`, flexShrink: 0 }} />
                  ))}
                  {tc > 12 && <Mono s={{ fontSize: 13, color: "var(--text3)" }}>+{tc - 12} more</Mono>}
                </div>
              </div>
            );
          }
          if (savedSubtasks.length > 0) {
            return <SubtaskList subtasks={savedSubtasks} preview={true} pillarColor={p?.color || "var(--c)"} />;
          }
          return null;
        })()}

        {/* Read-only expand (description + why) */}
        {exp && !editing && (
          <div style={{ marginTop: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6, marginBottom: 6 }}>{saved.description}</div>
            <div style={{ fontSize: 13, color: "var(--text3)", fontStyle: "italic" }}>Why: {saved.why}</div>
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 11 }}>
            <div>
              <label style={labelStyle}>TITLE</label>
              <input value={draft.title} onChange={e => set("title", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>DESCRIPTION</label>
              <textarea rows={2} value={draft.description} onChange={e => set("description", e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div>
              <label style={labelStyle}>WHY (RATIONALE)</label>
              <input value={draft.why} onChange={e => set("why", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle}>TIME</label>
                <input value={draft.estimatedTime} onChange={e => set("estimatedTime", e.target.value)} placeholder="1h" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>DIFFICULTY</label>
                <select value={draft.difficulty} onChange={e => set("difficulty", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  {["Easy","Medium","Hard"].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>TYPE</label>
                <select value={draft.missionType} onChange={e => set("missionType", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="standard">One-off</option>
                  <option value="counted">Counted (×N)</option>
                  <option value="recurring">Recurring (weekly)</option>
                </select>
              </div>
            </div>

            {hasCount && (
              <div style={{ display: "grid", gridTemplateColumns: draft.missionType !== "recurring" ? "80px 1fr" : "80px", gap: 10 }}>
                <div>
                  <label style={labelStyle}>TARGET (/week)</label>
                  <input type="number" min={1} max={99} value={draft.targetCount} onChange={e => set("targetCount", parseInt(e.target.value) || 1)} style={{ ...inputStyle, width: "100%" }} />
                </div>
                {draft.missionType !== "recurring" && (
                  <div>
                    <label style={labelStyle}>DUE</label>
                    <select value={draft.dueType} onChange={e => set("dueType", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                      <option value="today">Today</option>
                      <option value="this_week">This week</option>
                      <option value="two_weeks">2 weeks</option>
                      <option value="this_month">This month</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {!hasCount && (
              <div>
                <label style={labelStyle}>DUE</label>
                <select value={draft.dueType} onChange={e => set("dueType", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="today">Today</option>
                  <option value="this_week">This week</option>
                  <option value="two_weeks">2 weeks</option>
                  <option value="this_month">This month</option>
                </select>
              </div>
            )}

            {draft.missionType === "standard" && (
              <div>
                <label style={labelStyle}>SUBTASKS (optional — one per line)</label>
                <textarea
                  rows={Math.max(2, draft.subtasks.length + 1)}
                  value={draft.subtasks.join("\n")}
                  onChange={e => set("subtasks", e.target.value.split("\n"))}
                  placeholder={"Step 1\nStep 2\nStep 3"}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
            )}

            {/* Edit mode action row: Save / Discard */}
            <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
              <button onClick={handleSaveEdits} style={{ flex: 1, background: (p?.color || "var(--c)") + "22", border: `1px solid ${(p?.color || "var(--c)")}55`, color: p?.color || "var(--c)", padding: "7px 0", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1 }}>
                ✓ SAVE CHANGES
              </button>
              <button onClick={handleDiscardEdits} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "7px 14px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1 }}>
                ✕ DISCARD
              </button>
            </div>
          </div>
        )}

        {/* Actions — shown only when not editing */}
        {!editing && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <button onClick={handleAccept} style={{ flex: 1, background: "var(--c)22", border: "1px solid var(--c)55", color: "var(--c)", padding: "8px 0", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1 }}>
              {isSavedEdited ? "✓ ACCEPT EDITED" : effectiveType === "recurring" ? "✓ ADD TO RECURRING" : "✓ ACCEPT"}
            </button>
            <button onClick={() => onDecline(m.id)} style={{ flex: 1, background: "var(--r)11", border: "1px solid var(--r)33", color: "var(--r)", padding: "8px 0", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1 }}>✕ DECLINE</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Active mission card ───────────────────────────────────────────────────────

function MissionCard({ m, done, onComplete, onUncomplete, onDelete, onIncrementProgress, onToggleSubtask }) {
  const [exp, setExp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const p         = PILLARS.find(x => x.id === m.pillar);
  const dl        = !done && m.deadlineDate ? formatDeadline(m.deadlineDate) : null;
  const isOverdue = dl?.overdue;
  const isCounted = m.missionType === "counted" && m.targetCount;
  const hasSubs   = m.subtasks?.length > 0;
  const progress  = m.progressCount || 0;

  return (
    <div className="card" style={{ background: done ? "var(--bg1)" : isOverdue ? "var(--r)08" : "var(--bg2)", border: `1px solid ${isOverdue ? "var(--r)44" : "var(--border)"}`, padding: "12px 14px", marginBottom: 7, opacity: done ? 0.5 : 1, transition: "all 0.15s", position: "relative", overflow: "hidden" }}>
      {isOverdue && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5, background: "var(--r)66" }} />}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <button onClick={() => done ? onUncomplete(m.id) : onComplete(m.id)} style={{ width: 20, height: 20, border: `1.5px solid ${done ? p?.color : isOverdue ? "var(--r)" : "var(--border2)"}`, background: done ? (p?.color || "var(--c)") + "33" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: p?.color, fontSize: 13, marginTop: 2 }}>{done && "✓"}</button>
        <PillarDot id={m.pillar} size={6} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 500, textDecoration: done ? "line-through" : "none", color: done ? "var(--text3)" : isOverdue ? "var(--r)" : "var(--text)" }}>{m.title}</div>
            <div style={{ display: "flex", gap: 5, flexShrink: 0, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              {m.source === "check-in" && !done && <Tag color="var(--c)">CHECK-IN</Tag>}
              <DiffTag level={m.difficulty} />
              <Tag color="var(--text3)">{m.estimatedTime}</Tag>
              {isCounted && <Tag color={progress >= m.targetCount ? "var(--g)" : "var(--c)"}>{progress}/{m.targetCount}</Tag>}
              {dl && <Tag color={isOverdue ? "var(--r)" : dl.urgent ? "var(--o)" : "var(--text3)"}>{dl.label}</Tag>}
            </div>
          </div>

          {isCounted && !done && (
            <CounterControl value={progress} max={m.targetCount} missionId={m.id} onIncrement={onIncrementProgress} color={p?.color || "var(--c)"} />
          )}

          {hasSubs && !done && (
            <SubtaskList subtasks={m.subtasks} missionId={m.id} onToggle={onToggleSubtask} pillarColor={p?.color || "var(--c)"} />
          )}

          {exp && (
            <div style={{ marginTop: 8 }}>
              {m.description && <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6, marginBottom: 5 }}>{m.description}</div>}
              {m.why && <div style={{ fontSize: 13, color: "var(--text3)", fontStyle: "italic" }}>Why: {m.why}</div>}
              {m.acceptedAt && <div style={{ fontSize: 14, color: "var(--text3)", marginTop: 4 }}>Accepted: {new Date(m.acceptedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })} · Deadline: {m.deadlineDate ? new Date(m.deadlineDate).toLocaleDateString("en-CA", { month: "short", day: "numeric" }) : "—"}</div>}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
          {!done && (confirmDelete
            ? <>
                <button onClick={() => onDelete(m.id)} style={{ background: "var(--r)22", border: "1px solid var(--r)55", color: "var(--r)", padding: "3px 8px", fontFamily: "'DM Mono',monospace", fontSize: 14, letterSpacing: 1 }}>CONFIRM</button>
                <button onClick={() => setConfirmDelete(false)} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "3px 8px", fontFamily: "'DM Mono',monospace", fontSize: 14, letterSpacing: 1 }}>CANCEL</button>
              </>
            : <button onClick={() => setConfirmDelete(true)} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 13, padding: "0 2px", lineHeight: 1 }}>×</button>
          )}
          <button onClick={() => setExp(e => !e)} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 13, padding: "0 3px" }}>{exp ? "▲" : "▼"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Recurring mission card ────────────────────────────────────────────────────

function RecurringCard({ m, onIncrementProgress, onDelete, onEdit }) {
  const [exp, setExp] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const p        = PILLARS.find(x => x.id === m.pillar);
  const progress = m.progressCount || 0;
  const target   = m.targetCount || 1;
  const done     = progress >= target;
  const color    = done ? "var(--g)" : p?.color || "var(--p)";

  const [draft, setDraft] = useState({ title: m.title, targetCount: m.targetCount || 1, difficulty: m.difficulty || "Medium", pillar: m.pillar });
  const setD = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  const handleSave = () => {
    onEdit(m.id, { title: draft.title, targetCount: Number(draft.targetCount) || 1, difficulty: draft.difficulty, pillar: draft.pillar });
    setEditing(false);
  };

  const inputStyle = { width: "100%", padding: "6px 8px", fontSize: 14, background: "var(--bg3)", border: "1px solid var(--border2)", color: "var(--text)", fontFamily: "inherit" };
  const labelStyle = { display: "block", fontFamily: "'DM Mono',monospace", fontSize: 14, color: "var(--text3)", letterSpacing: 1.5, marginBottom: 4 };

  return (
    <div style={{ background: done ? "var(--g)08" : "var(--bg2)", border: `1px solid ${editing ? (p?.color || "var(--border)") + "66" : done ? "var(--g)44" : "var(--border)"}`, padding: "12px 14px", marginBottom: 7, position: "relative", overflow: "hidden", transition: "all 0.15s" }}>
      {done && !editing && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5, background: "var(--g)88" }} />}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 20, height: 20, border: `1.5px solid ${color}`, background: done ? color + "33" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
          {done && <span style={{ color, fontSize: 13 }}>✓</span>}
        </div>
        <PillarDot id={editing ? draft.pillar : m.pillar} size={6} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={labelStyle}>HABIT NAME</label>
                <input value={draft.title} onChange={e => setD("title", e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>TARGET/WEEK</label>
                  <input type="number" min={1} max={99} value={draft.targetCount} onChange={e => setD("targetCount", parseInt(e.target.value) || 1)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>DIFFICULTY</label>
                  <select value={draft.difficulty} onChange={e => setD("difficulty", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                    {["Easy","Medium","Hard"].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>PILLAR</label>
                  <select value={draft.pillar} onChange={e => setD("pillar", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                    {PILLARS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 7, paddingTop: 2 }}>
                <button onClick={handleSave} style={{ flex: 1, background: (p?.color || "var(--p)") + "22", border: `1px solid ${(p?.color || "var(--p)")}55`, color: p?.color || "var(--p)", padding: "7px 0", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1 }}>✓ SAVE</button>
                <button onClick={() => { setDraft({ title: m.title, targetCount: m.targetCount || 1, difficulty: m.difficulty || "Medium", pillar: m.pillar }); setEditing(false); }} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "7px 14px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1 }}>✕ CANCEL</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: done ? "var(--text2)" : "var(--text)" }}>{m.title}</div>
                <div style={{ display: "flex", gap: 5, flexShrink: 0, alignItems: "center" }}>
                  <DiffTag level={m.difficulty} />
                </div>
              </div>
              {/* Progress bar + counter in one clean block */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={() => onIncrementProgress(m.id, -1)}
                  disabled={progress <= 0}
                  style={{ width: 26, height: 26, border: "1px solid var(--border2)", background: "none", color: progress > 0 ? "var(--text2)" : "var(--border2)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: progress > 0 ? "pointer" : "not-allowed", lineHeight: 1, flexShrink: 0 }}
                >−</button>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <Mono s={{ fontSize: 14, color: done ? "var(--g)" : "var(--text3)", letterSpacing: 1.5 }}>THIS WEEK</Mono>
                    <Mono s={{ fontSize: 14, color }}>{progress}/{target}</Mono>
                  </div>
                  <ProgressBar value={progress} max={target} color={color} />
                </div>
                <button
                  onClick={() => onIncrementProgress(m.id, 1)}
                  disabled={progress >= target}
                  style={{ width: 26, height: 26, border: `1px solid ${progress < target ? color + "55" : "var(--border2)"}`, background: progress < target ? color + "22" : "none", color: progress < target ? color : "var(--border2)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: progress < target ? "pointer" : "not-allowed", lineHeight: 1, flexShrink: 0 }}
                >+</button>
              </div>
              {exp && (
                <div style={{ marginTop: 10 }}>
                  {m.description && <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6, marginBottom: 5 }}>{m.description}</div>}
                  {m.why && <div style={{ fontSize: 13, color: "var(--text3)", fontStyle: "italic" }}>Why: {m.why}</div>}
                  <Mono s={{ fontSize: 14, color: "var(--text3)", display: "block", marginTop: 6 }}>Resets every Sunday · Added {new Date(m.acceptedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</Mono>
                </div>
              )}
            </>
          )}
        </div>
        {!editing && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
            <button onClick={() => setEditing(true)} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "2px 8px", fontFamily: "'DM Mono',monospace", fontSize: 14, letterSpacing: 1 }}>EDIT</button>
            {confirmDelete
              ? <>
                  <button onClick={() => onDelete(m.id)} style={{ background: "var(--r)22", border: "1px solid var(--r)55", color: "var(--r)", padding: "3px 8px", fontFamily: "'DM Mono',monospace", fontSize: 14, letterSpacing: 1 }}>CONFIRM</button>
                  <button onClick={() => setConfirmDelete(false)} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "3px 8px", fontFamily: "'DM Mono',monospace", fontSize: 14, letterSpacing: 1 }}>CANCEL</button>
                </>
              : <button onClick={() => setConfirmDelete(true)} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 13, padding: "0 2px", lineHeight: 1 }}>×</button>
            }
            <button onClick={() => setExp(e => !e)} style={{ background: "none", border: "none", color: "var(--text3)", fontSize: 13, padding: "0 3px" }}>{exp ? "▲" : "▼"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add recurring form ────────────────────────────────────────────────────────

function AddRecurringForm({ onAdd, onCancel }) {
  const [draft, setDraft] = useState({ title: "", targetCount: 3, difficulty: "Medium", pillar: PILLARS[0]?.id || "", description: "", why: "" });
  const setD = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const p = PILLARS.find(x => x.id === draft.pillar);
  const canSubmit = draft.title.trim().length > 0;

  const handleAdd = () => {
    if (!canSubmit) return;
    onAdd({
      id: `manual_${Date.now()}`,
      title: draft.title.trim(),
      targetCount: Number(draft.targetCount) || 1,
      difficulty: draft.difficulty,
      pillar: draft.pillar,
      description: draft.description,
      why: draft.why,
      missionType: "recurring",
      source: "manual",
      estimatedTime: "",
      priority: 5,
    });
  };

  const inputStyle = { width: "100%", padding: "7px 9px", fontSize: 14, background: "var(--bg3)", border: "1px solid var(--border2)", color: "var(--text)", fontFamily: "inherit", lineHeight: 1.5 };
  const labelStyle = { display: "block", fontFamily: "'DM Mono',monospace", fontSize: 14, color: "var(--text3)", letterSpacing: 1.5, marginBottom: 4 };

  return (
    <div style={{ background: "var(--bg2)", border: `1px solid ${p?.color || "var(--border)"}66`, padding: 16, marginBottom: 14, position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 2, background: p?.color || "var(--border)" }} />
      <div style={{ paddingLeft: 10 }}>
        <Mono s={{ fontSize: 13, color: p?.color || "var(--p)", letterSpacing: 2, display: "block", marginBottom: 12 }}>+ NEW RECURRING HABIT</Mono>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={labelStyle}>HABIT NAME</label>
            <input
              value={draft.title}
              onChange={e => setD("title", e.target.value)}
              placeholder="e.g. Go to the gym"
              style={inputStyle}
              autoFocus
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr", gap: 8 }}>
            <div>
              <label style={labelStyle}>TARGET/WEEK</label>
              <input type="number" min={1} max={99} value={draft.targetCount} onChange={e => setD("targetCount", parseInt(e.target.value) || 1)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>DIFFICULTY</label>
              <select value={draft.difficulty} onChange={e => setD("difficulty", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                {["Easy","Medium","Hard"].map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>PILLAR</label>
              <select value={draft.pillar} onChange={e => setD("pillar", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                {PILLARS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>WHY (optional)</label>
            <input value={draft.why} onChange={e => setD("why", e.target.value)} placeholder="Your motivation..." style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 8, paddingTop: 2 }}>
            <button
              onClick={handleAdd}
              disabled={!canSubmit}
              style={{ flex: 1, background: canSubmit ? (p?.color || "var(--p)") + "22" : "var(--bg3)", border: `1px solid ${canSubmit ? (p?.color || "var(--p)") + "55" : "var(--border)"}`, color: canSubmit ? p?.color || "var(--p)" : "var(--text3)", padding: "8px 0", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1, cursor: canSubmit ? "pointer" : "not-allowed" }}
            >+ ADD HABIT</button>
            <button onClick={onCancel} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "8px 14px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1 }}>CANCEL</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function MissionsView({ state, onAccept, onAcceptRecurring, onDecline, onComplete, onUncomplete, onDelete, onDeleteRecurring, onEditRecurring, onAddRecurring, onIncrementProgress, onToggleSubtask }) {
  const [activeTab,    setActiveTab]    = useState("pending");
  const [pillarFilter, setPillarFilter] = useState("all");
  const [showAddForm,  setShowAddForm]  = useState(false);

  const { missions = [], recurringMissions = [], pendingMissions = [], completedMissions = [], analyses = {} } = state;

  const activeMissions = missions.filter(m => !completedMissions.includes(m.id));
  const doneMissions   = missions.filter(m =>  completedMissions.includes(m.id));
  const applyFilter    = arr => pillarFilter === "all" ? arr : arr.filter(m => m.pillar === pillarFilter);

  const nowTs = Date.now();
  const grouped = { overdue: [], today: [], this_week: [], two_weeks: [], this_month: [] };
  applyFilter(activeMissions).forEach(m => {
    if (m.deadlineDate && new Date(m.deadlineDate).getTime() < nowTs) grouped.overdue.push(m);
    else { const g = m.dueType || "this_week"; (grouped[g] || grouped.this_week).push(m); }
  });

  const overdueCount      = activeMissions.filter(m => m.deadlineDate && new Date(m.deadlineDate).getTime() < nowTs).length;
  const recurringDoneCount = recurringMissions.filter(m => (m.progressCount || 0) >= (m.targetCount || 1)).length;

  const tabs = [
    { id: "pending",   label: `PENDING (${pendingMissions.length})` },
    { id: "active",    label: `ACTIVE (${activeMissions.length})${overdueCount > 0 ? ` ⚠${overdueCount}` : ""}` },
    { id: "recurring", label: `RECURRING (${recurringMissions.length})${recurringDoneCount > 0 ? ` ✓${recurringDoneCount}` : ""}` },
    { id: "done",      label: `COMPLETED (${doneMissions.length})` },
  ];

  return (
    <div>
      <div style={{ marginBottom: 22, paddingBottom: 18, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ color: "var(--o)", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 3, marginBottom: 5 }}>◉ MISSIONS</div>
          <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 34, letterSpacing: 1, color: "var(--text)" }}>Mission Control</h2>
        </div>
        <Mono s={{ fontSize: 13, color: "var(--text3)" }}>New missions generated via ⟳ SYNC NORTHSTAR</Mono>
      </div>

      {missions.length === 0 && pendingMissions.length === 0 && recurringMissions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "70px 0" }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 44, color: "var(--border2)", marginBottom: 14 }}>NO MISSIONS YET</div>
          <div style={{ color: "var(--text3)", fontSize: 13 }}>{Object.keys(analyses).length === 0 ? "Complete a pillar first." : "Run ⟳ SYNC NORTHSTAR to generate missions."}</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ background: activeTab === t.id ? "var(--bg3)" : "none", border: `1px solid ${activeTab === t.id ? "var(--border2)" : "var(--border)"}`, color: activeTab === t.id ? "var(--text)" : "var(--text3)", padding: "6px 14px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1 }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 3, marginLeft: 8 }}>
              <button onClick={() => setPillarFilter("all")} style={{ background: pillarFilter === "all" ? "var(--bg3)" : "none", border: `1px solid ${pillarFilter === "all" ? "var(--border2)" : "var(--border)"}`, color: pillarFilter === "all" ? "var(--text)" : "var(--text3)", padding: "5px 11px", fontFamily: "'DM Mono',monospace", fontSize: 13 }}>ALL</button>
              {PILLARS.map(p => <button key={p.id} onClick={() => setPillarFilter(p.id)} style={{ background: pillarFilter === p.id ? p.color + "22" : "none", border: `1px solid ${pillarFilter === p.id ? p.color + "66" : "var(--border)"}`, color: pillarFilter === p.id ? p.color : "var(--text3)", padding: "5px 11px", fontFamily: "'DM Mono',monospace", fontSize: 13 }}>{p.icon}</button>)}
            </div>
          </div>

          {/* PENDING */}
          {activeTab === "pending" && (
            applyFilter(pendingMissions).length === 0
              ? <div style={{ textAlign: "center", padding: "50px 0" }}><div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: "var(--border2)", marginBottom: 10 }}>ALL CLEAR</div><div style={{ color: "var(--text3)", fontSize: 14 }}>No pending missions.</div></div>
              : <div>
                  <div style={{ background: "var(--o)0D", border: "1px solid var(--o)33", padding: "10px 14px", marginBottom: 16, fontSize: 14, color: "var(--text2)" }}>
                    Review each mission — <span style={{ color: "var(--c)" }}>Accept</span> ones you'll commit to, <span style={{ color: "var(--text)" }}>Edit</span> to adjust type/count/subtasks, or <span style={{ color: "var(--r)" }}>Decline</span> ones that don't fit. Recurring missions reset every Sunday.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {applyFilter(pendingMissions).map(m => <PendingMissionCard key={m.id} m={m} onAccept={onAccept} onAcceptRecurring={onAcceptRecurring} onDecline={onDecline} />)}
                  </div>
                </div>
          )}

          {/* ACTIVE */}
          {activeTab === "active" && (
            applyFilter(activeMissions).length === 0
              ? <div style={{ textAlign: "center", padding: "50px 0" }}><div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: "var(--border2)", marginBottom: 10 }}>NO ACTIVE MISSIONS</div><div style={{ color: "var(--text3)", fontSize: 14 }}>Accept missions from Pending to get started.</div></div>
              : <>
                  {grouped.overdue.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <Mono s={{ fontSize: 13, color: "var(--r)", letterSpacing: 2 }}>⚠ OVERDUE</Mono>
                        <div style={{ flex: 1, height: 1, background: "var(--r)33" }} />
                        <Mono s={{ fontSize: 14, color: "var(--r)", letterSpacing: 1 }}>{grouped.overdue.length} MISSION{grouped.overdue.length !== 1 ? "S" : ""}</Mono>
                      </div>
                      {grouped.overdue.sort((a,b) => new Date(a.deadlineDate)-new Date(b.deadlineDate)).map(m => <MissionCard key={m.id} m={m} done={false} onComplete={onComplete} onUncomplete={onUncomplete} onDelete={onDelete} onIncrementProgress={onIncrementProgress} onToggleSubtask={onToggleSubtask} />)}
                    </div>
                  )}
                  {[["today","TODAY"],["this_week","THIS WEEK"],["two_weeks","NEXT 2 WEEKS"],["this_month","THIS MONTH"]].map(([key,label]) => {
                    const g = grouped[key];
                    if (!g?.length) return null;
                    return (
                      <div key={key} style={{ marginBottom: 24 }}>
                        <Mono s={{ fontSize: 13, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 10 }}>{label}</Mono>
                        {g.sort((a,b) => b.priority-a.priority).map(m => <MissionCard key={m.id} m={m} done={false} onComplete={onComplete} onUncomplete={onUncomplete} onDelete={onDelete} onIncrementProgress={onIncrementProgress} onToggleSubtask={onToggleSubtask} />)}
                      </div>
                    );
                  })}
                </>
          )}

          {/* RECURRING */}
          {activeTab === "recurring" && (
            applyFilter(recurringMissions).length === 0 && !showAddForm
              ? <div style={{ textAlign: "center", padding: "50px 0" }}>
                  <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: "var(--border2)", marginBottom: 10 }}>NO RECURRING HABITS</div>
                  <div style={{ color: "var(--text3)", fontSize: 14, marginBottom: 20 }}>When Northstar generates a recurring mission, accept it here. Counts reset every Sunday.</div>
                  <button onClick={() => setShowAddForm(true)} style={{ background: "var(--p)22", border: "1px solid var(--p)55", color: "var(--p)", padding: "9px 20px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1.5 }}>+ ADD HABIT MANUALLY</button>
                </div>
              : <div>
                  <div style={{ background: "var(--p)0D", border: "1px solid var(--p)33", padding: "10px 14px", marginBottom: 16 }}>
                    <div style={{ fontSize: 14, color: "var(--text2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Weekly habits — track progress this week. <span style={{ color: "var(--p)" }}>{recurringDoneCount}/{recurringMissions.length} goals hit</span> so far. All counts reset every Sunday at midnight.</span>
                      {!showAddForm && <button onClick={() => setShowAddForm(true)} style={{ background: "var(--p)22", border: "1px solid var(--p)55", color: "var(--p)", padding: "5px 12px", fontFamily: "'DM Mono',monospace", fontSize: 14, letterSpacing: 1, flexShrink: 0, marginLeft: 12 }}>+ ADD HABIT</button>}
                    </div>
                    <div style={{ marginTop: 8, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${recurringMissions.length > 0 ? Math.round((recurringDoneCount/recurringMissions.length)*100) : 0}%`, background: "var(--p)", borderRadius: 2, transition: "width 0.3s ease" }} />
                    </div>
                  </div>
                  {showAddForm && (
                    <AddRecurringForm
                      onAdd={m => { onAddRecurring(m); setShowAddForm(false); }}
                      onCancel={() => setShowAddForm(false)}
                    />
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {applyFilter(recurringMissions)
                      .map(m => <RecurringCard key={m.id} m={m} onIncrementProgress={onIncrementProgress} onDelete={onDeleteRecurring} onEdit={onEditRecurring} />)}
                  </div>
                </div>
          )}

          {/* DONE */}
          {activeTab === "done" && (
            applyFilter(doneMissions).length === 0
              ? <div style={{ textAlign: "center", padding: "50px 0" }}><div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: "var(--border2)", marginBottom: 10 }}>NOTHING COMPLETED YET</div></div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "right", paddingBottom: 4 }}>
                    {doneMissions.length}/25 — oldest entries are dropped when the limit is reached
                  </div>
                  {applyFilter(doneMissions).map(m => <MissionCard key={m.id} m={m} done={true} onComplete={onComplete} onUncomplete={onUncomplete} onDelete={onDelete} onIncrementProgress={onIncrementProgress} onToggleSubtask={onToggleSubtask} />)}
                </div>
          )}
        </>
      )}
    </div>
  );
}