import { useState } from "react";
import { Mono } from "./ui";

const SEX_OPTIONS = ["Male", "Female", "Prefer not to say"];

export default function ProfileView({ state, onSave }) {
  const [profile, setProfile] = useState(state.userProfile || {});
  const [saved,   setSaved]   = useState(false);

  const set = (k, v) => setProfile(p => ({ ...p, [k]: v }));

  const handleSave = () => { onSave(profile); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const requiredDone = profile.name?.trim() && profile.age && profile.height && profile.sex;

  return (
    <div>
      <div style={{ marginBottom: 24, paddingBottom: 18, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ color: "var(--y)", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 3, marginBottom: 5 }}>◎ IDENTITY</div>
          <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 34, letterSpacing: 1, color: "var(--text)" }}>Your Profile</h2>
          <div style={{ fontSize: 14, color: "var(--text2)", marginTop: 5 }}>Used to calibrate every analysis — lift targets, income benchmarks, and advice are all adjusted to your stats.</div>
        </div>
        <button
          onClick={handleSave}
          style={{ background: saved ? "var(--g)" : "var(--y)", color: "#000", border: "none", padding: "9px 20px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1, transition: "background 0.2s" }}
        >
          {saved ? "✓ SAVED" : "SAVE PROFILE"}
        </button>
      </div>

      <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Name */}
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'DM Mono',monospace", fontSize: 14, color: "var(--text3)", letterSpacing: 1.5, marginBottom: 6, textTransform: "uppercase" }}>
            FULL NAME <span style={{ color: "var(--r)", fontSize: 14 }}>*</span>
          </label>
          <input
            type="text"
            value={profile.name || ""}
            onChange={e => set("name", e.target.value)}
            placeholder="Alex Chen"
            style={{ width: "100%", padding: "9px 11px", fontSize: 14, boxSizing: "border-box" }}
          />
        </div>

        {/* Age + Sex row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'DM Mono',monospace", fontSize: 14, color: "var(--text3)", letterSpacing: 1.5, marginBottom: 6 }}>
              AGE <span style={{ color: "var(--r)", fontSize: 14 }}>*</span>
            </label>
            <input
              type="number"
              value={profile.age || ""}
              onChange={e => set("age", e.target.value)}
              placeholder="28"
              style={{ width: "100%", padding: "9px 11px", fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'DM Mono',monospace", fontSize: 14, color: "var(--text3)", letterSpacing: 1.5, marginBottom: 6 }}>
              SEX <span style={{ color: "var(--r)", fontSize: 14 }}>*</span>
            </label>
            <select
              value={profile.sex || ""}
              onChange={e => set("sex", e.target.value)}
              style={{ width: "100%", padding: "9px 11px", fontSize: 14, background: "var(--bg)", color: profile.sex ? "var(--text)" : "var(--text3)", border: "1px solid var(--border)", boxSizing: "border-box", appearance: "none", WebkitAppearance: "none", borderRadius: 0 }}
            >
              <option value="" disabled>Select...</option>
              {SEX_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        {/* Height + Weight row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'DM Mono',monospace", fontSize: 14, color: "var(--text3)", letterSpacing: 1.5, marginBottom: 6 }}>
              HEIGHT (cm) <span style={{ color: "var(--r)", fontSize: 14 }}>*</span>
            </label>
            <input
              type="number"
              value={profile.height || ""}
              onChange={e => set("height", e.target.value)}
              placeholder="178"
              style={{ width: "100%", padding: "9px 11px", fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontFamily: "'DM Mono',monospace", fontSize: 14, color: "var(--text3)", letterSpacing: 1.5, marginBottom: 6 }}>
              WEIGHT (kg) <span style={{ color: "var(--text3)", fontSize: 13 }}>— optional</span>
            </label>
            <input
              type="number"
              value={profile.weight || ""}
              onChange={e => set("weight", e.target.value)}
              placeholder="80"
              style={{ width: "100%", padding: "9px 11px", fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
        </div>

        <div style={{ background: "var(--y)0D", border: "1px solid var(--y)22", padding: "12px 14px" }}>
          <Mono s={{ fontSize: 14, color: "var(--y)", letterSpacing: 1.5, display: "block", marginBottom: 5 }}>WHY THIS MATTERS</Mono>
          <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
            Age calibrates income benchmarks and career pace. Height and weight let northstar set realistic strength targets and gauge training load. Sex adjusts physiological baselines for lift standards and recovery.
          </div>
        </div>

        {!requiredDone && (
          <Mono s={{ fontSize: 13, color: "var(--text3)" }}>* Required fields — fill these in before your first sync.</Mono>
        )}
      </div>
    </div>
  );
}
