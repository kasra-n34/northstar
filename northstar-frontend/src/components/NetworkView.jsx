import { useState } from "react";
import { PILLARS } from "../constants";
import { callClaude, parseJSON } from "../api";
import { NETWORK_RESEARCH_SYS, NETWORK_SUGGEST_SYS } from "../prompts";
import { Mono, Tag, Spinner, ScoreBar } from "./ui";

function ContactDetail({ contact, onBack, onResearch, loading, clarifyAnswers, setClarifyAnswers, onDelete }) {
  const [notes, setNotes] = useState(contact.notes || "");
  return (
    <div style={{ maxWidth: 748 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text3)", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1 }}>← BACK TO CONTACTS</button>
        <button onClick={onDelete} style={{ background: "none", border: "1px solid var(--r)33", color: "var(--r)", padding: "5px 10px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1 }}>DELETE</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--bg3)", border: "1px solid var(--p)44", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue'", fontSize: 24, color: "var(--p)" }}>{(contact.name || "?")[0]}</div>
        <div>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 26, color: "var(--text)", lineHeight: 1 }}>{contact.name}</div>
          <div style={{ fontSize: 14, color: "var(--text2)", marginTop: 2 }}>{contact.inferredRole} · {contact.inferredIndustry}</div>
        </div>
        {contact.networkValue && (
          <div style={{ marginLeft: "auto", textAlign: "center" }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: "var(--p)", lineHeight: 1 }}>{contact.networkValue}</div>
            <Mono s={{ fontSize: 14, color: "var(--text3)" }}>NETWORK VALUE</Mono>
          </div>
        )}
      </div>

      {contact.potentialOpportunities?.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <Mono s={{ fontSize: 13, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 10 }}>OPPORTUNITIES</Mono>
          {contact.potentialOpportunities.map((o, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 7 }}>
              <span style={{ color: "var(--p)", fontSize: 13, flexShrink: 0 }}>◈</span>
              <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5 }}>{o}</div>
            </div>
          ))}
        </div>
      )}

      {contact.howToApproach && (
        <div style={{ background: "var(--p)0D", border: "1px solid var(--p)33", padding: "14px 16px", marginBottom: 18 }}>
          <Mono s={{ fontSize: 14, color: "var(--p)", letterSpacing: 2, display: "block", marginBottom: 7 }}>HOW TO APPROACH</Mono>
          <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{contact.howToApproach}</div>
        </div>
      )}

      {contact.keyStrengths?.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <Mono s={{ fontSize: 13, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 8 }}>KEY STRENGTHS</Mono>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{contact.keyStrengths.map((s, i) => <Tag key={i} color="var(--c)">{s}</Tag>)}</div>
        </div>
      )}

      {contact.followUpCadence && (
        <div style={{ marginBottom: 18 }}>
          <Mono s={{ fontSize: 14, color: "var(--text3)", letterSpacing: 1.5, display: "block", marginBottom: 5 }}>FOLLOW-UP CADENCE</Mono>
          <div style={{ fontSize: 14, color: "var(--text2)" }}>{contact.followUpCadence}</div>
        </div>
      )}

      {contact.clarifyingQuestions?.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <Mono s={{ fontSize: 13, color: "var(--o)", letterSpacing: 2, display: "block", marginBottom: 10 }}>NORTHSTAR WANTS TO KNOW MORE</Mono>
          {contact.clarifyingQuestions.map((q, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--text2)", marginBottom: 5 }}>{q}</label>
              <input value={clarifyAnswers[q] || ""} onChange={e => setClarifyAnswers(a => ({ ...a, [q]: e.target.value }))} placeholder="Your answer..." style={{ width: "100%", padding: "8px 10px", fontSize: 13 }} />
            </div>
          ))}
          <button onClick={onResearch} disabled={loading} style={{ background: "var(--o)", color: "#000", border: "none", padding: "9px 20px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1, display: "flex", alignItems: "center", gap: 7, marginTop: 8 }}>
            {loading ? <><Spinner color="#000" size={13} />RESEARCHING</> : "UPDATE ANALYSIS →"}
          </button>
        </div>
      )}

      {contact.needsResearch && (
        <div style={{ background: "var(--o)11", border: "1px solid var(--o)33", padding: "12px 16px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, color: "var(--o)" }}>This contact hasn't been analyzed yet.</div>
          <button onClick={onResearch} disabled={loading} style={{ background: "var(--o)", color: "#000", border: "none", padding: "7px 16px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1, display: "flex", alignItems: "center", gap: 6 }}>
            {loading ? <><Spinner color="#000" size={13} />RESEARCHING</> : "RESEARCH NOW →"}
          </button>
        </div>
      )}

      <div>
        <Mono s={{ fontSize: 13, color: "var(--text3)", letterSpacing: 2, display: "block", marginBottom: 8 }}>NOTES</Mono>
        <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Personal notes about this contact..." style={{ width: "100%", padding: "10px 12px", fontSize: 14, resize: "vertical", lineHeight: 1.6 }} />
      </div>
    </div>
  );
}

export default function NetworkView({ state, onSaveContacts, onSaveSuggestions, analyses }) {
  const [activeTab,      setActiveTab]      = useState("contacts");
  const [addMode,        setAddMode]        = useState("url");
  const [urlInput,       setUrlInput]       = useState("");
  const [pasteInput,     setPasteInput]     = useState("");
  const [csvInput,       setCsvInput]       = useState("");
  const [loading,        setLoading]        = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [selectedContact,setSelectedContact]= useState(null);
  const [clarifyAnswers, setClarifyAnswers] = useState({});

  const contacts    = state.networkContacts   || [];
  const suggestions = state.networkSuggestions|| [];

  const researchFromUrl = async () => {
    if (!urlInput.trim()) return;
    setLoading(true);
    try {
      const text   = await callClaude([{ role: "user", content: `Research this profile and analyze network value. URL: ${urlInput}` }], NETWORK_RESEARCH_SYS, true);
      const parsed = parseJSON(text);
      if (parsed) { onSaveContacts([...contacts, { ...parsed, id: `c_${Date.now()}`, source: "url", sourceUrl: urlInput, addedAt: new Date().toISOString(), notes: "" }]); setUrlInput(""); setActiveTab("contacts"); }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const researchFromPaste = async () => {
    if (!pasteInput.trim()) return;
    setLoading(true);
    try {
      const text   = await callClaude([{ role: "user", content: `Analyze this person and their network value:\n${pasteInput.slice(0, 600)}` }], NETWORK_RESEARCH_SYS, false);
      const parsed = parseJSON(text);
      if (parsed) { onSaveContacts([...contacts, { ...parsed, id: `c_${Date.now()}`, source: "paste", addedAt: new Date().toISOString(), notes: "" }]); setPasteInput(""); setActiveTab("contacts"); }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const importCSV = () => {
    const newContacts = csvInput.trim().split("\n").filter(l => l.trim()).map((line, i) => {
      const [name, role, company, notes] = (line + ",,,").split(",");
      return { id: `c_csv_${Date.now()}_${i}`, name: name?.trim() || "Unknown", inferredRole: role?.trim() || "", inferredIndustry: company?.trim() || "", notes: notes?.trim() || "", source: "csv", addedAt: new Date().toISOString(), networkValue: 5, potentialOpportunities: [], keyStrengths: [], howToApproach: "", tags: [], needsResearch: true };
    });
    onSaveContacts([...contacts, ...newContacts]); setCsvInput(""); setActiveTab("contacts");
  };

  const generateSuggestions = async () => {
    setSuggestLoading(true);
    const summary = Object.entries(analyses).map(([id, a]) => `${id}:${a.priorityScore}/10`).join(", ");
    try {
      const text   = await callClaude([{ role: "user", content: `Toronto user. Pillars: ${summary}. Suggest 6 people to connect with.` }], NETWORK_SUGGEST_SYS, false);
      const parsed = parseJSON(text);
      const arr    = parsed?.suggestions || parsed;
      if (Array.isArray(arr)) { onSaveSuggestions(arr.map((s, i) => ({ ...s, id: s.id || `sug_${Date.now()}_${i}`, saved: false }))); setActiveTab("suggestions"); }
    } catch (e) { console.error(e); }
    setSuggestLoading(false);
  };

  const researchContact = async (contact) => {
    setLoading(true);
    try {
      const ctx    = Object.entries(clarifyAnswers).map(([k, v]) => `${k}: ${v}`).join("; ");
      const text   = await callClaude([{ role: "user", content: `Research contact: ${contact.name}, ${contact.inferredRole}. Context: ${ctx}` }], NETWORK_RESEARCH_SYS, true);
      const parsed = parseJSON(text);
      if (parsed) { onSaveContacts(contacts.map(c => c.id === contact.id ? { ...c, ...parsed, needsResearch: false } : c)); setSelectedContact({ ...contact, ...parsed, needsResearch: false }); }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const saveToContacts = (sug) => {
    onSaveContacts([...contacts, { ...sug, id: `c_${Date.now()}`, source: "suggestion", addedAt: new Date().toISOString(), notes: "" }]);
    onSaveSuggestions(suggestions.map(s => s.id === sug.id ? { ...s, saved: true } : s));
  };

  const tabs = [
    { id: "contacts",    label: `CONTACTS (${contacts.length})` },
    { id: "add",         label: "+ ADD" },
    { id: "suggestions", label: `SUGGESTED (${suggestions.filter(s => !s.saved).length})` },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24, paddingBottom: 18, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ color: "var(--p)", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 3, marginBottom: 5 }}>○ NETWORK</div>
          <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 34, letterSpacing: 1, color: "var(--text)" }}>Network Intelligence</h2>
        </div>
        <button onClick={generateSuggestions} disabled={suggestLoading || Object.keys(analyses).length === 0} style={{ background: "var(--p)", color: "#000", border: "none", padding: "8px 16px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1, display: "flex", alignItems: "center", gap: 6 }}>
          {suggestLoading ? <><Spinner color="#000" size={13} />RESEARCHING</> : "⚡ FIND CONNECTIONS"}
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 22 }}>
        {tabs.map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ background: activeTab === t.id ? "var(--bg3)" : "none", border: `1px solid ${activeTab === t.id ? "var(--border2)" : "var(--border)"}`, color: activeTab === t.id ? "var(--text)" : "var(--text2)", padding: "6px 14px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1 }}>{t.label}</button>)}
      </div>

      {/* CONTACTS */}
      {activeTab === "contacts" && (
        selectedContact ? (
          <ContactDetail contact={selectedContact} onBack={() => setSelectedContact(null)} onResearch={() => researchContact(selectedContact)} loading={loading} clarifyAnswers={clarifyAnswers} setClarifyAnswers={setClarifyAnswers} onDelete={() => { onSaveContacts(contacts.filter(c => c.id !== selectedContact.id)); setSelectedContact(null); }} />
        ) : contacts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 40, color: "var(--border2)", marginBottom: 12 }}>NO CONTACTS YET</div>
            <div style={{ color: "var(--text3)", fontSize: 13, marginBottom: 20 }}>Add contacts via a profile URL, paste a bio, or import a CSV.</div>
            <button onClick={() => setActiveTab("add")} style={{ background: "var(--p)", color: "#000", border: "none", padding: "11px 24px", fontFamily: "'DM Mono',monospace", fontSize: 14, letterSpacing: 1.5 }}>ADD FIRST CONTACT →</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {contacts.map(c => (
              <button key={c.id} onClick={() => setSelectedContact(c)} className="card" style={{ background: "var(--bg1)", border: "1px solid var(--border)", padding: 16, textAlign: "left", transition: "all 0.2s", position: "relative" }}>
                {c.needsResearch && <div style={{ position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: "50%", background: "var(--o)", animation: "pulse 2s infinite" }} />}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--bg3)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue'", fontSize: 16, color: "var(--p)", flexShrink: 0 }}>{(c.name || "?")[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || "Unknown"}</div>
                    <div style={{ fontSize: 13, color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.inferredRole || c.source}</div>
                  </div>
                </div>
                {c.networkValue && <div style={{ marginBottom: 8 }}><ScoreBar value={c.networkValue} color="var(--p)" /></div>}
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {(c.tags || []).slice(0, 3).map((t, i) => <Tag key={i} color="var(--p)">{t}</Tag>)}
                  {c.needsResearch && <Tag color="var(--o)">NEEDS RESEARCH</Tag>}
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {/* ADD */}
      {activeTab === "add" && (
        <div style={{ maxWidth: 704 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
            {[{ id: "url", label: "LINKEDIN / IG URL" }, { id: "paste", label: "PASTE BIO" }, { id: "csv", label: "IMPORT CSV" }].map(m => (
              <button key={m.id} onClick={() => setAddMode(m.id)} style={{ background: addMode === m.id ? "var(--p)22" : "none", border: `1px solid ${addMode === m.id ? "var(--p)66" : "var(--border)"}`, color: addMode === m.id ? "var(--p)" : "var(--text3)", padding: "6px 14px", fontFamily: "'DM Mono',monospace", fontSize: 13 }}>{m.label}</button>
            ))}
          </div>
          {addMode === "url" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>Paste a public profile URL. Northstar will web-search publicly available info and analyse their network value.</div>
              <input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://instagram.com/username" style={{ width: "100%", padding: "11px 13px", fontSize: 14 }} />
              <button onClick={researchFromUrl} disabled={!urlInput.trim() || loading} style={{ alignSelf: "flex-start", background: urlInput.trim() ? "var(--p)" : "var(--bg2)", color: urlInput.trim() ? "#000" : "var(--text3)", border: "none", padding: "11px 22px", fontFamily: "'DM Mono',monospace", fontSize: 14, letterSpacing: 1.5, display: "flex", alignItems: "center", gap: 8 }}>
                {loading ? <><Spinner color="#000" size={14} />RESEARCHING</> : "RESEARCH & ADD →"}
              </button>
            </div>
          )}
          {addMode === "paste" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>Paste someone's bio, About section, or any description.</div>
              <textarea rows={8} value={pasteInput} onChange={e => setPasteInput(e.target.value)} placeholder="Paste their bio or About section..." style={{ width: "100%", padding: "11px 13px", fontSize: 14, resize: "vertical", lineHeight: 1.6 }} />
              <button onClick={researchFromPaste} disabled={!pasteInput.trim() || loading} style={{ alignSelf: "flex-start", background: pasteInput.trim() ? "var(--p)" : "var(--bg2)", color: pasteInput.trim() ? "#000" : "var(--text3)", border: "none", padding: "11px 22px", fontFamily: "'DM Mono',monospace", fontSize: 14, letterSpacing: 1.5, display: "flex", alignItems: "center", gap: 8 }}>
                {loading ? <><Spinner color="#000" size={14} />ANALYZING</> : "ANALYZE & ADD →"}
              </button>
            </div>
          )}
          {addMode === "csv" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>Paste CSV rows: <Mono s={{ fontSize: 13, color: "var(--text3)" }}>Name, Role, Company, Notes</Mono></div>
              <textarea rows={6} value={csvInput} onChange={e => setCsvInput(e.target.value)} placeholder="John Smith, Founder, Fintech, Met at startup event" style={{ width: "100%", padding: "11px 13px", fontSize: 14, resize: "vertical", lineHeight: 1.6 }} />
              <button onClick={importCSV} disabled={!csvInput.trim()} style={{ alignSelf: "flex-start", background: csvInput.trim() ? "var(--p)" : "var(--bg2)", color: csvInput.trim() ? "#000" : "var(--text3)", border: "none", padding: "11px 22px", fontFamily: "'DM Mono',monospace", fontSize: 14, letterSpacing: 1.5 }}>IMPORT CONTACTS →</button>
            </div>
          )}
        </div>
      )}

      {/* SUGGESTIONS */}
      {activeTab === "suggestions" && (
        suggestions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: "var(--border2)", marginBottom: 12 }}>NO SUGGESTIONS YET</div>
            <div style={{ color: "var(--text3)", fontSize: 13 }}>Complete at least one pillar, then click "Find Connections".</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {suggestions.map(s => (
              <div key={s.id} style={{ background: "var(--bg1)", border: `1px solid ${s.saved ? "var(--border)" : "var(--p)22"}`, padding: 18, opacity: s.saved ? 0.5 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.name}</div>
                      {s.type === "specific_person" && <Tag color="var(--y)">REAL PERSON</Tag>}
                      {s.type === "archetype"       && <Tag color="var(--c)">ARCHETYPE</Tag>}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 6 }}>{s.description}</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {(s.pillarsServed || []).map(pid => { const p = PILLARS.find(x => x.id === pid); return p ? <Tag key={pid} color={p.color}>{p.icon} {p.label}</Tag> : null; })}
                      <Tag color="var(--text3)">{s.platform}</Tag>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Bebas Neue'", fontSize: 24, color: "var(--p)", lineHeight: 1 }}>{s.priority}<span style={{ fontSize: 14, color: "var(--text3)" }}>/10</span></div>
                    {!s.saved && <button onClick={() => saveToContacts(s)} style={{ background: "var(--p)", color: "#000", border: "none", padding: "6px 12px", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 1 }}>SAVE →</button>}
                    {s.saved  && <Tag color="var(--g)">SAVED</Tag>}
                  </div>
                </div>
                <div style={{ background: "var(--bg2)", padding: "10px 14px", marginBottom: 8 }}>
                  <Mono s={{ fontSize: 14, color: "var(--p)", letterSpacing: 1.5, display: "block", marginBottom: 5 }}>OPPORTUNITY</Mono>
                  <div style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5 }}>{s.opportunity}</div>
                </div>
                <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.5 }}><span style={{ color: "var(--text2)" }}>Find them:</span> {s.findWhere}</div>
                {s.approach && <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 5 }}><span style={{ color: "var(--text2)" }}>Approach:</span> {s.approach}</div>}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
