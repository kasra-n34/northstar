import { useState, useEffect } from "react";
import { Mono, Tag } from "./ui";
import { apiFetch } from "../api";

// ─── Shared primitives ────────────────────────────────────────────────────────

function Section({ title, icon, color = "var(--text3)", children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
        {icon && <span style={{ fontSize: 15, color }}>{icon}</span>}
        <Mono s={{ fontSize: 10, color, letterSpacing: 2 }}>{title}</Mono>
      </div>
      {children}
    </div>
  );
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

function KeyRow({ label, hint, hintUrl, value, onChange, onSave, status, saving }) {
  const [show, setShow] = useState(false);
  const isSet = status === "set";

  return (
    <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", padding: "14px 16px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 3 }}>{label}</Mono>
          <div style={{ fontSize: 11, color: "var(--text3)" }}>
            {hint}{" "}
            {hintUrl && <a href={hintUrl} target="_blank" rel="noreferrer" style={{ color: "var(--c)" }}>{hintUrl}</a>}
          </div>
        </div>
        <Tag color={isSet ? "var(--g)" : "var(--r)"}>{isSet ? "SET" : "NOT SET"}</Tag>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            type={show ? "text" : "password"}
            placeholder={isSet ? "Enter new key to replace…" : "Paste your key here…"}
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "var(--bg2)", border: "1px solid var(--border)",
              color: "var(--text)", fontFamily: "'DM Mono',monospace", fontSize: 11,
              padding: "7px 36px 7px 10px", outline: "none",
            }}
          />
          <button
            onClick={() => setShow(s => !s)}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 12, padding: 0 }}
          >{show ? "○" : "●"}</button>
        </div>
        <button
          onClick={onSave}
          disabled={!value || saving}
          style={{ background: "none", border: "1px solid var(--c)", color: "var(--c)", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1, padding: "0 14px", cursor: value && !saving ? "pointer" : "not-allowed", opacity: value && !saving ? 1 : 0.4 }}
        >{saving ? "SAVING…" : "SAVE"}</button>
      </div>
    </div>
  );
}

function ApiKeysSettings() {
  const [status, setStatus]       = useState({ hasAnthropicKey: false });
  const [anthropicVal, setAnthropicVal] = useState("");
  const [saving, setSaving]       = useState(null);
  const [saved, setSaved]         = useState(null);

  useEffect(() => {
    apiFetch("/api/config")
      .then(r => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  async function saveKey(field, value) {
    setSaving(field);
    try {
      await apiFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      setStatus(s => ({ ...s, hasAnthropicKey: !!value }));
      setAnthropicVal("");
      setSaved(field);
      setTimeout(() => setSaved(null), 2500);
    } catch {
      alert("Failed to save key.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      {saved && (
        <div style={{ background: "var(--g)18", border: "1px solid var(--g)44", color: "var(--g)", fontFamily: "'DM Mono',monospace", fontSize: 10, padding: "8px 12px", marginBottom: 12, letterSpacing: 1 }}>
          ✓ KEY SAVED
        </div>
      )}
      <KeyRow
        label="ANTHROPIC API KEY"
        hint="Required for all AI features. Anthropic requires a minimum $5 credit top-up to activate API access — a weekly sync costs a few cents, so it lasts a long time. Get yours at"
        hintUrl="https://console.anthropic.com"
        value={anthropicVal}
        onChange={setAnthropicVal}
        onSave={() => saveKey("anthropicKey", anthropicVal)}
        status={status.hasAnthropicKey ? "set" : "unset"}
        saving={saving === "anthropicKey"}
      />
    </div>
  );
}

// ─── Retention settings ───────────────────────────────────────────────────────

const RETENTION_OPTIONS = [
  { weeks: 2, desc: "Minimal context, smallest footprint" },
  { weeks: 4, desc: "Recommended balance" },
  { weeks: 6, desc: "Richer pattern tracking" },
  { weeks: 8, desc: "Maximum historical context" },
];

function RetentionSettings({ state, onSetRetention }) {
  const current  = state.retentionWeeks || 4;
  const logCount = (state.weeklyLogs || []).length;
  const [val, setVal] = useState(
    RETENTION_OPTIONS.find(o => o.weeks === current) ? current : 4
  );

  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 4 }}>CHECK-IN LOG RETENTION</Mono>
        <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
          How many weeks of check-in history to keep and feed into AI analyses. Full answers compress to a digest after 1 week — only the digest ages out.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
        {RETENTION_OPTIONS.map(o => {
          const active = val === o.weeks;
          return (
            <button key={o.weeks} onClick={() => setVal(o.weeks)}
              style={{ background: active ? "var(--c)18" : "var(--bg3)", border: `2px solid ${active ? "var(--c)" : "var(--border)"}`, color: active ? "var(--c)" : "var(--text3)", padding: "14px 0", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1, cursor: "pointer", textAlign: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, lineHeight: 1, marginBottom: 2, color: active ? "var(--c)" : "var(--text2)" }}>{o.weeks}</div>
              WEEKS
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { label: "STORED LOGS",   value: logCount,              color: "var(--c)" },
          { label: "CONTEXT DEPTH", value: `${val} logs / AI call`, color: "var(--y)" },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--bg3)", padding: "8px 10px" }}>
            <Mono s={{ fontSize: 7, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 4 }}>{s.label}</Mono>
            <div style={{ fontSize: 12, color: s.color, fontWeight: 500 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={() => onSetRetention(val)} disabled={val === current}
          style={{ background: val !== current ? "var(--c)" : "var(--bg3)", color: val !== current ? "#000" : "var(--text3)", border: "none", padding: "9px 20px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1, fontWeight: 500, cursor: val !== current ? "pointer" : "not-allowed" }}>
          {val === current ? "ALREADY APPLIED" : "APPLY CHANGE →"}
        </button>
        {val !== current && (
          <Mono s={{ fontSize: 9, color: val < current ? "var(--o)" : "var(--g)" }}>
            {val < current ? `⚠ Logs older than ${val}w will be pruned on next load` : `✓ Retaining ${val - current} more weeks of history`}
          </Mono>
        )}
      </div>
    </div>

  );
}

// ─── History manager ──────────────────────────────────────────────────────────

function HistoryManager({ state, onDeleteLog, onClearScoreHistory, onDeleteMission }) {
  const { weeklyLogs = [], analyses = {}, missions = [], completedMissions = [] } = state;
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expanded,      setExpanded]      = useState(null);

  const sortedLogs = [...weeklyLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
  const pillarsWithHistory = Object.entries(analyses)
    .filter(([, a]) => a?.scoreHistory?.length > 0)
    .map(([id, a]) => ({ id, scoreHistory: a.scoreHistory }));

  const confirm = (key) => {
    if (confirmDelete === key) {
      if (key.startsWith("scores:"))  onClearScoreHistory(key.replace("scores:", ""));
      else if (key === "missions")    onDeleteMission("all");
      else if (key === "all-logs")    onDeleteLog("all-logs");
      else                            onDeleteLog(key);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(key);
    }
  };

  const row = { background: "var(--bg1)", border: "1px solid var(--border)", padding: "12px 14px", marginBottom: 6, display: "flex", gap: 12, alignItems: "flex-start" };
  const btn = (danger) => ({ background: "none", border: `1px solid ${danger ? "var(--r)44" : "var(--border)"}`, color: danger ? "var(--r)" : "var(--text3)", padding: "4px 10px", fontFamily: "'DM Mono',monospace", fontSize: 8, letterSpacing: 1, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Weekly logs */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2 }}>WEEKLY CHECK-IN LOGS · {sortedLogs.length} STORED</Mono>
          {sortedLogs.length > 0 && (
            <button onClick={() => confirm("all-logs")} style={btn(true)}>
              {confirmDelete === "all-logs" ? "CONFIRM DELETE ALL" : "DELETE ALL"}
            </button>
          )}
        </div>

        {sortedLogs.length === 0 && <div style={{ fontSize: 12, color: "var(--text3)", padding: "16px 0" }}>No check-in logs yet.</div>}

        {sortedLogs.map(log => (
          <div key={log.id} style={{ ...row, flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <Mono s={{ fontSize: 9, color: "var(--c)", letterSpacing: 1 }}>
                    {new Date(log.date).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                  </Mono>
                  {log.compressed && <Tag color="var(--text3)">COMPRESSED</Tag>}
                </div>
                <div style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.5 }}>{log.digest || "No digest."}</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                <button onClick={() => setExpanded(expanded === log.id ? null : log.id)} style={btn(false)}>
                  {expanded === log.id ? "HIDE" : "VIEW"}
                </button>
                <button onClick={() => confirm(log.id)} style={btn(true)}>
                  {confirmDelete === log.id ? "CONFIRM?" : "DELETE"}
                </button>
              </div>
            </div>
            {expanded === log.id && !log.compressed && log.answers && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 6, width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(log.answers).map(([k, v]) => v ? (
                  <div key={k}>
                    <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 2, textTransform: "uppercase" }}>{k}</Mono>
                    <div style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.5 }}>{v}</div>
                  </div>
                ) : null)}
              </div>
            )}
            {expanded === log.id && log.compressed && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 6, fontSize: 11, color: "var(--text3)", fontStyle: "italic" }}>
                Full answers compressed — digest only retained.
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pillar score histories */}
      <div>
        <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 10 }}>PILLAR SCORE HISTORIES</Mono>
        {pillarsWithHistory.length === 0 && <div style={{ fontSize: 12, color: "var(--text3)", padding: "16px 0" }}>No score history yet — run a sync to generate analyses.</div>}
        {pillarsWithHistory.map(({ id, scoreHistory }) => {
          const key = `scores:${id}`;
          return (
            <div key={id} style={row}>
              <div style={{ flex: 1 }}>
                <Mono s={{ fontSize: 9, color: "var(--text2)", letterSpacing: 1, display: "block", marginBottom: 6 }}>
                  {id.toUpperCase()} · {scoreHistory.length} DATA POINT{scoreHistory.length !== 1 ? "S" : ""}
                </Mono>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {scoreHistory.map((pt, i) => (
                    <div key={i} style={{ background: "var(--bg3)", padding: "3px 7px", border: "1px solid var(--border)" }}>
                      <Mono s={{ fontSize: 8, color: "var(--text3)" }}>
                        {new Date(pt.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}{" "}
                      </Mono>
                      <Mono s={{ fontSize: 9, color: "var(--c)" }}>{pt.score}</Mono>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => confirm(key)} style={btn(true)}>
                {confirmDelete === key ? "CONFIRM?" : "CLEAR"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Mission history */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Mono s={{ fontSize: 9, color: "var(--text3)", letterSpacing: 2 }}>
            MISSIONS · {missions.length} TOTAL · {completedMissions.length} COMPLETED
          </Mono>
          {missions.length > 0 && (
            <button onClick={() => confirm("missions")} style={btn(true)}>
              {confirmDelete === "missions" ? "CONFIRM DELETE ALL" : "DELETE ALL"}
            </button>
          )}
        </div>
        {missions.length === 0 && <div style={{ fontSize: 12, color: "var(--text3)", padding: "16px 0" }}>No missions yet.</div>}
        {missions.map(m => (
          <div key={m.id} style={{ ...row, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1, textTransform: "uppercase" }}>{m.pillar}</Mono>
                {completedMissions.includes(m.id) && <Tag color="var(--g)">✓ DONE</Tag>}
              </div>
              <div style={{ fontSize: 12, color: "var(--text2)" }}>{m.title}</div>
            </div>
            <button onClick={() => onDeleteMission(m.id)} style={btn(true)}>DELETE</button>
          </div>
        ))}
      </div>

    </div>
  );
}

// ─── Main SettingsView ────────────────────────────────────────────────────────

export default function SettingsView({ state, onSetRetention, onDeleteLog, onClearScoreHistory, onDeleteMission }) {
  return (
    <div style={{ maxWidth: 770 }}>
      <div style={{ marginBottom: 28, paddingBottom: 18, borderBottom: "1px solid var(--border)" }}>
        <div style={{ color: "var(--text3)", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 3, marginBottom: 5 }}>⚙ SETTINGS</div>
        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 34, letterSpacing: 1, color: "var(--text)" }}>Settings</h2>
        <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 6, lineHeight: 1.6 }}>Manage your stored history, control data retention, and clean up old records.</div>
      </div>

      <Section title="API KEYS" icon="⚿" color="var(--c)">
        <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.6, marginBottom: 14 }}>
          Keys are saved locally on your machine and never leave your device. Each person running Northstar needs their own keys.
        </div>
        <ApiKeysSettings />
      </Section>

      <Section title="MANAGE HISTORY" icon="▣" color="var(--r)">
        <HistoryManager
          state={state}
          onDeleteLog={onDeleteLog}
          onClearScoreHistory={onClearScoreHistory}
          onDeleteMission={onDeleteMission}
        />
      </Section>

      <Section title="DATA RETENTION" icon="◈" color="var(--c)">
        <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.6, marginBottom: 14 }}>
          Control how many weeks of check-in logs Northstar keeps. More weeks means richer long-term context for AI analyses; fewer means a smaller data footprint. Pillar score history is not affected by this setting.
        </div>
        <RetentionSettings state={state} onSetRetention={onSetRetention} />
      </Section>
    </div>
  );
}
