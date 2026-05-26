import { useState, useCallback } from "react";
import { Mono, Tag } from "./ui";
import {
  parseInstagramConnectionsZip,
  buildIgSnapshot,
} from "./instagramHelpers";

// ─── Shared DropZone ─────────────────────────────────────────────────────────

function DropZone({ accept, onFile, loading, loadingLabel, emptyLabel, hasData, accentColor }) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = { current: null };
  const color = accentColor || "#E1306C";
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files[0]); }}
      onClick={() => fileRef.current?.click()}
      style={{ border: `2px dashed ${dragOver ? color : hasData ? "var(--border2)" : "var(--border)"}`, padding: "20px", textAlign: "center", cursor: "pointer", background: dragOver ? color + "0D" : "var(--bg2)", transition: "all 0.15s" }}
    >
      <input ref={el => fileRef.current = el} type="file" accept={accept} onChange={e => onFile(e.target.files[0])} style={{ display: "none" }} />
      {loading
        ? <><div style={{ width: 22, height: 22, border: `2px solid ${color}33`, borderTop: `2px solid ${color}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 8px" }} /><Mono s={{ fontSize: 10, color }}>{loadingLabel}</Mono></>
        : <><div style={{ fontSize: 20, marginBottom: 6 }}>📂</div><Mono s={{ fontSize: 10, color: hasData ? "var(--text3)" : "var(--text2)", letterSpacing: 1 }}>{hasData ? `DROP NEW ${emptyLabel} TO UPDATE` : `DROP ${emptyLabel} HERE`}</Mono><div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>or click to browse</div></>
      }
    </div>
  );
}

// ─── Section header helper ────────────────────────────────────────────────────

function SectionHeader({ icon, name, tag, tagColor }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <Mono s={{ fontSize: 12, color: "var(--text)", letterSpacing: 1 }}>{name}</Mono>
      {tag && <Tag color={tagColor || "var(--text3)"}>{tag}</Tag>}
    </div>
  );
}

// ─── InstagramSection ─────────────────────────────────────────────────────────

export default function InstagramSection({ integrations, onSave }) {
  const instagramData = integrations.instagramData || null;

  const [igImporting, setIgImporting] = useState(false);
  const [igError,     setIgError]     = useState(null);

  const save = (next) => onSave(next);

  const handleIgFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.endsWith(".zip")) { setIgError("Please upload a .zip file from your Instagram data export."); return; }
    setIgImporting(true); setIgError(null);
    try {
      const parsed = await parseInstagramConnectionsZip(file);
      if (!parsed) {
        setIgError("Couldn't find follower/following data. Upload either connections.zip or followers_and_following.zip from your Instagram export.");
        setIgImporting(false); return;
      }
      const next = { ...integrations, instagramData: parsed };
      next.igSnapshot = buildIgSnapshot(parsed, integrations.igFollowBackHistory);
      save(next);
      setIgImporting(false);
    } catch (err) { setIgError("Parse error: " + err.message); setIgImporting(false); }
  }, [integrations]);

  return (
    <div style={{ background: "var(--bg1)", border: `1px solid ${instagramData ? "#E1306C44" : "var(--border)"}`, padding: 20, position: "relative" }}>
      {instagramData && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5, background: "#E1306C" }} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <SectionHeader icon="📸" name="Instagram Connections" tag={instagramData ? "IMPORTED" : "ZIP IMPORT"} tagColor={instagramData ? "#E1306C" : "var(--text3)"} />
          <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
            Go to <Mono s={{ fontSize: 11, color: "var(--text3)" }}>Instagram → Privacy Centre → Download your information → Format: JSON</Mono> and request your data. Once downloaded, drop either <Mono s={{ fontSize: 11, color: "var(--text3)" }}>connections.zip</Mono> or <Mono s={{ fontSize: 11, color: "var(--text3)" }}>followers_and_following.zip</Mono> here. northstar reads follower counts, follow-back rates, and outreach patterns to inform your Network pillar.
          </div>
        </div>
        {instagramData && <button onClick={() => save({ ...integrations, instagramData: undefined })} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text3)", padding: "6px 12px", fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1, flexShrink: 0 }}>CLEAR</button>}
      </div>

      {instagramData && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
            {[
              { label: "FOLLOWERS",          value: instagramData.followers,            color: "#E1306C" },
              { label: "FOLLOWING",           value: instagramData.following,            color: "var(--text2)" },
              { label: "FOLLOW-BACK %",       value: instagramData.followBackRate + "%", color: instagramData.followBackRate >= 50 ? "var(--g)" : instagramData.followBackRate >= 20 ? "var(--y)" : "var(--r)" },
              { label: "PENDING SENT",        value: instagramData.pendingSent,          color: "var(--o)" },
              { label: "NOT FOLLOWING BACK",  value: instagramData.notFollowingBack,     color: "var(--text3)" },
              { label: "RECENTLY UNFOLLOWED", value: instagramData.recentlyUnfollowed,   color: "var(--text3)" },
            ].map(s => (
              <div key={s.label} style={{ background: "var(--bg2)", padding: "10px 12px" }}>
                <Mono s={{ fontSize: 7, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 4 }}>{s.label}</Mono>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: s.color, lineHeight: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {instagramData.pendingStats && (
            <div style={{ marginBottom: 12, background: "var(--bg2)", border: "1px solid var(--o)33", padding: "14px 16px" }}>
              <Mono s={{ fontSize: 8, color: "var(--o)", letterSpacing: 1.5, display: "block", marginBottom: 12 }}>PENDING REQUEST ANALYSIS</Mono>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
                {[
                  { label: "SENT / DAY",   value: instagramData.pendingStats.requestsPerDay, color: "var(--o)",    tip: "avg rate across entire pending window" },
                  { label: "SENT LAST 7D", value: instagramData.pendingStats.sentLast7d,      color: instagramData.pendingStats.sentLast7d > 0 ? "var(--c)" : "var(--text3)", tip: null },
                  { label: "MEDIAN AGE",   value: instagramData.pendingStats.medianAgeDays < 7 ? instagramData.pendingStats.medianAgeDays + "d" : instagramData.pendingStats.medianAgeDays < 30 ? Math.round(instagramData.pendingStats.medianAgeDays / 7) + "w" : Math.round(instagramData.pendingStats.medianAgeDays / 30) + "mo", color: instagramData.pendingStats.medianAgeDays > 30 ? "var(--r)" : instagramData.pendingStats.medianAgeDays > 7 ? "var(--y)" : "var(--g)", tip: "half your pending requests are older than this" },
                  { label: "GHOST RATE",   value: instagramData.pendingStats.ghostRate + "%",  color: instagramData.pendingStats.ghostRate > 60 ? "var(--r)" : instagramData.pendingStats.ghostRate > 30 ? "var(--y)" : "var(--g)", tip: "% of pending requests 30+ days old" },
                ].map(s => (
                  <div key={s.label} style={{ background: "var(--bg1)", padding: "10px 12px" }} title={s.tip || ""}>
                    <Mono s={{ fontSize: 7, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 4 }}>{s.label}</Mono>
                    <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    {s.tip && <Mono s={{ fontSize: 7, color: "var(--text3)", display: "block", marginTop: 4, lineHeight: 1.4 }}>{s.tip}</Mono>}
                  </div>
                ))}
              </div>
              <div>
                <Mono s={{ fontSize: 7, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 6 }}>AGE BREAKDOWN — {instagramData.pendingStats.total} PENDING</Mono>
                <div style={{ display: "flex", height: 8, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                  {[
                    { key: "under1w", color: "var(--g)" },
                    { key: "w1to4",   color: "var(--y)" },
                    { key: "m1to3",   color: "var(--o)" },
                    { key: "over3m",  color: "var(--r)" },
                  ].map(b => {
                    const count = instagramData.pendingStats.ageBuckets[b.key];
                    const pct   = instagramData.pendingStats.total > 0 ? (count / instagramData.pendingStats.total) * 100 : 0;
                    return pct > 0 ? <div key={b.key} style={{ width: pct + "%", background: b.color, minWidth: count > 0 ? 2 : 0 }} /> : null;
                  })}
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {[
                    { key: "under1w", color: "var(--g)", label: "<1 week" },
                    { key: "w1to4",   color: "var(--y)", label: "1–4 weeks" },
                    { key: "m1to3",   color: "var(--o)", label: "1–3 months" },
                    { key: "over3m",  color: "var(--r)", label: "3+ months" },
                  ].map(b => (
                    <div key={b.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 1, background: b.color, flexShrink: 0 }} />
                      <Mono s={{ fontSize: 7, color: "var(--text3)" }}>{b.label}: <span style={{ color: b.color }}>{instagramData.pendingStats.ageBuckets[b.key]}</span></Mono>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                <Mono s={{ fontSize: 8, color: "var(--text3)" }}>Oldest pending: <span style={{ color: instagramData.pendingStats.oldestAgeDays > 90 ? "var(--r)" : "var(--text2)" }}>{instagramData.pendingStats.oldestAgeDays}d ago</span></Mono>
                <Mono s={{ fontSize: 8, color: "var(--text3)" }}>Most recent: <span style={{ color: "var(--text2)" }}>{instagramData.pendingStats.newestAgeDays === 0 ? "today" : instagramData.pendingStats.newestAgeDays + "d ago"}</span></Mono>
              </div>
            </div>
          )}

          {instagramData.followingGrowth && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
              {[
                { label: "NEW FOLLOWS / DAY", value: instagramData.followingGrowth.avgPerDay,  color: "var(--text2)" },
                { label: "NEW FOLLOWS 7D",    value: instagramData.followingGrowth.newLast7d,   color: "var(--c)" },
                { label: "NEW FOLLOWS 30D",   value: instagramData.followingGrowth.newLast30d,  color: "var(--p)" },
              ].map(s => (
                <div key={s.label} style={{ background: "var(--bg2)", padding: "10px 12px" }}>
                  <Mono s={{ fontSize: 7, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 4 }}>{s.label}</Mono>
                  <div style={{ fontFamily: "'Bebas Neue'", fontSize: 20, color: s.color, lineHeight: 1 }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
            <Mono s={{ fontSize: 8, color: "var(--text3)", marginRight: 4 }}>FILES FOUND:</Mono>
            {(instagramData.filesFound || []).map(f => <Tag key={f} color="#E1306C">{f}</Tag>)}
          </div>

          {instagramData.notFollowingBackList?.length > 0 && (
            <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <Mono s={{ fontSize: 8, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 8 }}>NOT FOLLOWING BACK ({instagramData.notFollowingBackList.length})</Mono>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 160, overflowY: "auto" }}>
                {instagramData.notFollowingBackList.map((u, i) => (
                  <a key={i} href={"https://instagram.com/" + u} target="_blank" rel="noopener noreferrer"
                    style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--text3)", padding: "2px 7px", border: "1px solid var(--border)", background: "var(--bg2)", textDecoration: "none", opacity: 0.7 }}
                    onMouseEnter={e => { e.target.style.color = "#E1306C"; e.target.style.opacity = 1; e.target.style.borderColor = "#E1306C55"; }}
                    onMouseLeave={e => { e.target.style.color = "var(--text3)"; e.target.style.opacity = 0.7; e.target.style.borderColor = "var(--border)"; }}
                  >{u}</a>
                ))}
              </div>
            </div>
          )}

          <Mono s={{ fontSize: 8, color: "var(--text3)", display: "block", marginTop: 10 }}>
            imported {new Date(instagramData.uploadedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
          </Mono>
        </div>
      )}

      <DropZone accept=".zip" onFile={handleIgFile} loading={igImporting} loadingLabel="PARSING ZIP..." emptyLabel="CONNECTIONS ZIP" hasData={!!instagramData} accentColor="#E1306C" />
      {igError && <div style={{ fontSize: 11, color: "var(--r)", marginTop: 8, fontFamily: "'DM Mono',monospace", lineHeight: 1.5 }}>{igError}</div>}
    </div>
  );
}
