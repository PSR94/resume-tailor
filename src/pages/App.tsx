import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { buildScoringPrompt, buildSwapPrompt } from "../lib/prompts";
import { saveSession, loadSession, clearSession, saveProfile, loadProfile } from "../lib/storage";
import "../styles/app.css";

interface SwapItem { id: string; action: string; section: string; roleIndex: number; bulletIndex: number; originalBullet: string; originalScore: number; newBullet: string; newScore: number; jdSkillsAddressed: string[]; approved: boolean; userEdited?: string; }
interface SkillConfirm { skill: string; context: string; confirmed: boolean | null; }
interface Manifest { jobTitle: string; company: string; jdSummary: string; keySkillsFound: string[]; keySkillsMissing: string[]; atsKeywordGaps: string[]; swaps: SwapItem[]; skillsToConfirm: SkillConfirm[]; }
interface Profile { resumeText: string; resumeBase64: string; resumeFileName: string; }
type Step = "upload" | "jd" | "scoring-prompt" | "scoring-paste" | "swap-prompt" | "swap-paste" | "confirm-skills" | "swaps" | "done";

function parseJSON(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse((fenced ? fenced[1] : raw).trim());
}

export default function App() {
  const navigate = useNavigate();
  const sessionRef = useRef<Record<string, unknown>>({});
  const [step, setStepRaw] = useState<Step>("upload");
  const [profile, setProfile] = useState<Partial<Profile>>({});
  const [jdText, setJdTextRaw] = useState("");
  const [scoring, setScoringRaw] = useState<unknown>(null);
  const [manifest, setManifestRaw] = useState<Manifest | null>(null);
  const [pasteValue, setPasteValue] = useState("");
  const [parseError, setParseError] = useState("");
  const [copied, setCopied] = useState(false);
  const [serverOk, setServerOk] = useState<boolean | null>(null);

  function persist(patch: Record<string, unknown>) { sessionRef.current = { ...sessionRef.current, ...patch }; saveSession(sessionRef.current); }
  const setStep = (s: Step) => { setStepRaw(s); persist({ step: s }); setPasteValue(""); setParseError(""); setCopied(false); };
  const setJdText = (t: string) => { setJdTextRaw(t); persist({ jdText: t }); };
  const setScoring = (d: unknown) => { setScoringRaw(d); persist({ scoring: d }); };
  const setManifest = useCallback((fn: Manifest | null | ((m: Manifest | null) => Manifest | null)) => {
    setManifestRaw((prev) => { const next = typeof fn === "function" ? fn(prev) : fn; persist({ manifest: next }); return next; });
  }, []);

  useEffect(() => {
    const session = loadSession();
    const prof = loadProfile() as Partial<Profile>;
    setProfile(prof);
    if (session.jdText) { setJdTextRaw(session.jdText as string); sessionRef.current.jdText = session.jdText; }
    if (session.scoring) { setScoringRaw(session.scoring); sessionRef.current.scoring = session.scoring; }
    if (session.manifest) { setManifestRaw(session.manifest as Manifest); sessionRef.current.manifest = session.manifest; }
    const s = session.step as Step | undefined;
    if (s && prof.resumeText) { setStepRaw(s); sessionRef.current.step = s; } else if (prof.resumeText) setStepRaw("jd");
    checkServer();
  }, []);

  async function checkServer() { try { const r = await fetch("http://localhost:7842/health"); setServerOk(r.ok); } catch { setServerOk(false); } }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      try {
        const res = await fetch("http://localhost:7842/extract-text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume_base64: base64 }) });
        const data = await res.json();
        const update = { resumeFileName: file.name, resumeBase64: base64, resumeText: data.text };
        setProfile((p) => { const n = { ...p, ...update }; saveProfile(n); return n; });
        setStep("jd");
      } catch { alert("Local server not running. Run: python server/main.py"); }
    };
    reader.readAsDataURL(file);
  }

  function copyPrompt(text: string) { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); }

  function handlePasteScoring() {
    setParseError("");
    try {
      const data = parseJSON(pasteValue) as Record<string, unknown>;
      if (!data.bullets) throw new Error("Missing 'bullets' field. Make sure you copied the full JSON response from ChatGPT.");
      setScoring(data); setStep("swap-prompt");
    } catch (e: unknown) { setParseError((e as Error).message); }
  }

  function handlePasteSwaps() {
    setParseError("");
    try {
      const data = parseJSON(pasteValue) as { swaps: SwapItem[]; skillsToConfirm: SkillConfirm[] };
      if (!data.swaps) throw new Error("Missing 'swaps' field. Make sure you copied the full JSON response from ChatGPT.");
      const s = scoring as Record<string, unknown>;
      const m: Manifest = { jobTitle: s.jobTitle as string ?? "", company: s.company as string ?? "", jdSummary: s.jdSummary as string ?? "", keySkillsFound: s.keySkillsFound as string[] ?? [], keySkillsMissing: s.keySkillsMissing as string[] ?? [], atsKeywordGaps: s.atsKeywordGaps as string[] ?? [], swaps: data.swaps.map((sw) => ({ ...sw, approved: true })), skillsToConfirm: data.skillsToConfirm ?? [] };
      setManifest(m); setStep(m.skillsToConfirm.length > 0 ? "confirm-skills" : "swaps");
    } catch (e: unknown) { setParseError((e as Error).message); }
  }

  async function handleApplySwaps() {
    if (!manifest) return;
    try {
      const approved = { ...manifest, swaps: manifest.swaps.filter((s) => s.approved).map((s) => ({ ...s, newBullet: s.userEdited ?? s.newBullet })) };
      const res = await fetch("http://localhost:7842/apply-swaps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume_base64: profile.resumeBase64, manifest: approved }) });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const link = document.createElement("a");
      link.href = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${data.docx_base64}`;
      link.download = data.filename; link.click();
      clearSession(); setStep("done");
    } catch (e: unknown) { alert(`Error: ${(e as Error).message}`); }
  }

  const scoringPrompt = profile.resumeText && jdText ? buildScoringPrompt(profile.resumeText, jdText) : "";
  const swapPrompt = profile.resumeText && jdText && scoring ? buildSwapPrompt(profile.resumeText, jdText, scoring) : "";

  return (
    <div className="app-layout">
      <AppNav onHome={() => navigate("/")} step={step} serverOk={serverOk} />
      <main className="app-main">
        {step === "upload" && <UploadStep serverOk={serverOk} onUpload={handleResumeUpload} onCheckServer={checkServer} />}
        {step === "jd" && <JDStep profile={profile} jdText={jdText} onJdChange={setJdText} onNext={() => setStep("scoring-prompt")} onBack={() => setStep("upload")} />}
        {step === "scoring-prompt" && <PromptStep stepNumber={1} title="Copy this prompt into ChatGPT" description="Asks ChatGPT to score every bullet against the JD. Open ChatGPT, paste it, wait for the response, then come back." prompt={scoringPrompt} copied={copied} onCopy={() => copyPrompt(scoringPrompt)} onNext={() => setStep("scoring-paste")} onBack={() => setStep("jd")} />}
        {step === "scoring-paste" && <PasteStep stepNumber={2} title="Paste ChatGPT's response" description='Copy the entire JSON response from ChatGPT and paste it below. It should start with { "jobTitle": ...' placeholder={'{\n  "jobTitle": "...",\n  "bullets": [...]\n}'} value={pasteValue} onChange={setPasteValue} error={parseError} onSubmit={handlePasteScoring} onBack={() => setStep("scoring-prompt")} submitLabel="Parse Scores →" />}
        {step === "swap-prompt" && scoring && <ScoringPreviewStep scoring={scoring} swapPrompt={swapPrompt} copied={copied} onCopy={() => copyPrompt(swapPrompt)} onNext={() => setStep("swap-paste")} onBack={() => setStep("scoring-paste")} />}
        {step === "swap-paste" && <PasteStep stepNumber={4} title="Paste ChatGPT's improvement response" description='Paste the JSON response. It should start with { "swaps": ...' placeholder={'{\n  "swaps": [...],\n  "skillsToConfirm": [...]\n}'} value={pasteValue} onChange={setPasteValue} error={parseError} onSubmit={handlePasteSwaps} onBack={() => setStep("swap-prompt")} submitLabel="Parse Swaps →" />}
        {step === "confirm-skills" && manifest && <ConfirmSkillsStep manifest={manifest} onConfirm={(i, v) => setManifest((m) => { if (!m) return m; const sc = [...m.skillsToConfirm]; sc[i] = { ...sc[i], confirmed: v }; return { ...m, skillsToConfirm: sc }; })} onDone={() => { setManifest((m) => { if (!m) return m; const denied = m.skillsToConfirm.filter((s) => s.confirmed === false).map((s) => s.skill.toLowerCase()); return { ...m, swaps: m.swaps.filter((s) => !s.jdSkillsAddressed.some((sk) => denied.includes(sk.toLowerCase()))) }; }); setStep("swaps"); }} onBack={() => setStep("swap-paste")} />}
        {step === "swaps" && manifest && <SwapsStep manifest={manifest} onToggle={(id) => setManifest((m) => m ? { ...m, swaps: m.swaps.map((s) => s.id === id ? { ...s, approved: !s.approved } : s) } : m)} onEdit={(id, t) => setManifest((m) => m ? { ...m, swaps: m.swaps.map((s) => s.id === id ? { ...s, userEdited: t } : s) } : m)} onApply={handleApplySwaps} onBack={() => setStep("swap-paste")} />}
        {step === "done" && <DoneStep onReset={() => { clearSession(); setJdTextRaw(""); setScoringRaw(null); setManifestRaw(null); setStepRaw("jd"); }} />}
      </main>
    </div>
  );
}

const NAV_STEPS = ["Upload", "Job", "Score", "Improve", "Review", "Done"];
const STEP_LABEL: Record<string, string> = { upload: "Upload", jd: "Job", "scoring-prompt": "Score", "scoring-paste": "Score", "swap-prompt": "Improve", "swap-paste": "Improve", "confirm-skills": "Improve", swaps: "Review", done: "Done" };

function AppNav({ onHome, step, serverOk }: { onHome: () => void; step: Step; serverOk: boolean | null }) {
  const current = NAV_STEPS.indexOf(STEP_LABEL[step] ?? "Upload");
  return (
    <header className="app-nav">
      <button className="app-nav-logo" onClick={onHome}><span>⚡</span> ResumeTailor</button>
      <div className="progress-steps">
        {NAV_STEPS.map((l, i) => (
          <div key={l} className={`progress-step ${i < current ? "done" : i === current ? "active" : "pending"}`}>
            <div className="progress-dot">{i < current ? "✓" : i + 1}</div><span>{l}</span>
          </div>
        ))}
      </div>
      <div className={`server-indicator ${serverOk === true ? "ok" : "down"}`}><span className="server-dot" />{serverOk === true ? "Server OK" : "Server offline"}</div>
    </header>
  );
}

function UploadStep({ serverOk, onUpload, onCheckServer }: { serverOk: boolean | null; onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; onCheckServer: () => void }) {
  return (
    <div className="panel center-panel">
      <div className="panel-icon">📄</div>
      <h1 className="panel-title">Upload Your Resume</h1>
      <p className="panel-sub">Upload your DOCX once. Your formatting, page count, and structure are locked — they never change.</p>
      {serverOk === false && <div className="warn-box">⚠ Local server not running.<code>cd server && python main.py</code><button className="btn-ghost-sm" style={{ marginTop: 8 }} onClick={onCheckServer}>Check again</button></div>}
      <label className="upload-zone"><input type="file" accept=".docx" onChange={onUpload} /><span className="upload-zone-icon">⬆</span><span className="upload-zone-label">Click to upload your DOCX resume</span><span className="upload-zone-hint">DOCX only · stays on your device</span></label>
      <div className="how-it-works-mini">
        {["Upload resume", "Paste JD", "Copy → ChatGPT", "Paste back", "Download DOCX"].map((s, i, arr) => (
          <React.Fragment key={s}><div className="how-step"><span>{i + 1}</span>{s}</div>{i < arr.length - 1 && <div className="how-sep">→</div>}</React.Fragment>
        ))}
      </div>
    </div>
  );
}

function JDStep({ profile, jdText, onJdChange, onNext, onBack }: { profile: Partial<Profile>; jdText: string; onJdChange: (t: string) => void; onNext: () => void; onBack: () => void }) {
  return (
    <div className="panel">
      <div className="panel-header"><div><h1 className="panel-title">Paste the Job Description</h1><p className="panel-sub">Copy the full JD — summary, requirements, responsibilities.</p></div><button className="btn-ghost-sm" onClick={onBack}>← Back</button></div>
      <div className="resume-loaded-bar"><span>📄</span><span>{profile.resumeFileName}</span><span className="resume-loaded-ok">✓ Loaded</span></div>
      <div className="jd-area"><div className="jd-toolbar"><span className="card-title">Job Description</span><span className="char-count">{jdText.length} chars</span></div><textarea className="jd-textarea" value={jdText} onChange={(e) => onJdChange(e.target.value)} placeholder="Paste the full job description here..." /></div>
      <button className="btn-accent btn-lg full-w" onClick={onNext} disabled={!jdText.trim()}>Generate ChatGPT Prompt →</button>
    </div>
  );
}

function PromptStep({ stepNumber, title, description, prompt, copied, onCopy, onNext, onBack }: { stepNumber: number; title: string; description: string; prompt: string; copied: boolean; onCopy: () => void; onNext: () => void; onBack: () => void }) {
  return (
    <div className="panel">
      <div className="panel-header"><div><div className="step-badge">Step {stepNumber} of 4</div><h1 className="panel-title">{title}</h1><p className="panel-sub">{description}</p></div><button className="btn-ghost-sm" onClick={onBack}>← Back</button></div>
      <div className="chatgpt-guide">
        {[{ n: "1", t: "Copy the prompt below", d: <p>Click "Copy Prompt" to copy everything to your clipboard.</p> }, { n: "2", t: "Open ChatGPT", d: <a href="https://chat.openai.com" target="_blank" rel="noreferrer" className="open-chatgpt-btn">Open ChatGPT in new tab →</a> }, { n: "3", t: "Paste and send", d: <p>Paste (Cmd+V / Ctrl+V) and hit Enter. Wait for the full JSON response.</p> }, { n: "4", t: "Come back here", d: <p>Click "I have the response" below and paste ChatGPT's reply on the next screen.</p> }].map((g) => (<div key={g.n} className="guide-step"><div className="guide-num">{g.n}</div><div><b>{g.t}</b>{g.d}</div></div>))}
      </div>
      <div className="prompt-box"><div className="prompt-box-header"><span className="card-title">Prompt for ChatGPT</span><button className={`copy-btn ${copied ? "copied" : ""}`} onClick={onCopy}>{copied ? "✓ Copied!" : "Copy Prompt"}</button></div><pre className="prompt-text">{prompt.slice(0, 500)}…</pre><p className="prompt-length">{prompt.length.toLocaleString()} characters total</p></div>
      <button className="btn-accent btn-lg full-w" onClick={onNext}>I have the response →</button>
    </div>
  );
}

function PasteStep({ stepNumber, title, description, placeholder, value, onChange, error, onSubmit, onBack, submitLabel }: { stepNumber: number; title: string; description: string; placeholder: string; value: string; onChange: (t: string) => void; error: string; onSubmit: () => void; onBack: () => void; submitLabel: string }) {
  return (
    <div className="panel">
      <div className="panel-header"><div><div className="step-badge">Step {stepNumber} of 4</div><h1 className="panel-title">{title}</h1><p className="panel-sub">{description}</p></div><button className="btn-ghost-sm" onClick={onBack}>← Back</button></div>
      <div className="paste-area"><div className="paste-header"><span className="card-title">ChatGPT Response</span>{value && <button className="btn-ghost-sm" onClick={() => onChange("")}>Clear</button>}</div><textarea className={`paste-textarea ${error ? "has-error" : ""}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} spellCheck={false} />{error && <div className="parse-error">⚠ {error}</div>}</div>
      <button className="btn-accent btn-lg full-w" onClick={onSubmit} disabled={!value.trim()}>{submitLabel}</button>
    </div>
  );
}

function ScoringPreviewStep({ scoring, swapPrompt, copied, onCopy, onNext, onBack }: { scoring: unknown; swapPrompt: string; copied: boolean; onCopy: () => void; onNext: () => void; onBack: () => void }) {
  const s = scoring as Record<string, unknown>;
  const bullets = (s.bullets as Array<Record<string, unknown>>) ?? [];
  const sorted = [...bullets].sort((a, b) => (a.score as number) - (b.score as number));
  const swapCount = sorted.filter((b) => (b.score as number) < 5).length;
  return (
    <div className="panel">
      <div className="panel-header"><div><div className="step-badge">Step 3 of 4</div><h1 className="panel-title">Scores parsed ✓</h1><p className="panel-sub">{s.jobTitle as string}{s.company ? ` @ ${s.company}` : ""} · {swapCount} bullets need improvement</p></div><button className="btn-ghost-sm" onClick={onBack}>← Back</button></div>
      <div className="scores-quick">{sorted.slice(0, 6).map((b, i) => { const score = b.score as number; return (<div key={i} className={`score-quick-row ${score < 5 ? "low" : score < 7 ? "mid" : "high"}`}><div className="score-circle">{score}</div><p className="score-quick-text">{(b.bullet as string).slice(0, 90)}{(b.bullet as string).length > 90 ? "…" : ""}</p></div>); })}{sorted.length > 6 && <p className="scores-more">+{sorted.length - 6} more bullets scored</p>}</div>
      <div className="skills-row">{(s.keySkillsMissing as string[] ?? []).slice(0, 5).map((sk) => <span key={sk} className="tag tag-red">{sk}</span>)}{(s.keySkillsFound as string[] ?? []).slice(0, 4).map((sk) => <span key={sk} className="tag tag-green">{sk}</span>)}</div>
      <div className="divider-label">Now send a second prompt to generate improvements →</div>
      <div className="prompt-box"><div className="prompt-box-header"><span className="card-title">Improvement Prompt for ChatGPT</span><button className={`copy-btn ${copied ? "copied" : ""}`} onClick={onCopy}>{copied ? "✓ Copied!" : "Copy Prompt"}</button></div><pre className="prompt-text">{swapPrompt.slice(0, 400)}…</pre><p className="prompt-length">{swapPrompt.length.toLocaleString()} characters</p></div>
      <div className="chatgpt-quick-guide"><span>1. Copy prompt above</span><span>→</span><a href="https://chat.openai.com" target="_blank" rel="noreferrer">2. Paste into ChatGPT →</a><span>→</span><span>3. Click below when done</span></div>
      <button className="btn-accent btn-lg full-w" onClick={onNext}>I have the response →</button>
    </div>
  );
}

function ConfirmSkillsStep({ manifest, onConfirm, onDone, onBack }: { manifest: Manifest; onConfirm: (i: number, v: boolean) => void; onDone: () => void; onBack: () => void }) {
  const allAnswered = manifest.skillsToConfirm.every((s) => s.confirmed !== null);
  return (
    <div className="panel">
      <div className="panel-header"><div><h1 className="panel-title">Confirm Skills</h1><p className="panel-sub">Only approve what you can genuinely defend in an interview.</p></div><button className="btn-ghost-sm" onClick={onBack}>← Back</button></div>
      <div className="confirm-list">{manifest.skillsToConfirm.map((s, i) => (<div key={i} className="confirm-card"><div className="confirm-skill-name">{s.skill}</div><p className="confirm-context">{s.context}</p><div className="confirm-btns"><button className={`confirm-btn yes ${s.confirmed === true ? "active" : ""}`} onClick={() => onConfirm(i, true)}>✓ Yes, I have this</button><button className={`confirm-btn no ${s.confirmed === false ? "active" : ""}`} onClick={() => onConfirm(i, false)}>✗ Skip it</button></div></div>))}</div>
      <button className="btn-accent btn-lg full-w" onClick={onDone} disabled={!allAnswered}>Review Swaps →</button>
    </div>
  );
}

function SwapsStep({ manifest, onToggle, onEdit, onApply, onBack }: { manifest: Manifest; onToggle: (id: string) => void; onEdit: (id: string, t: string) => void; onApply: () => void; onBack: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const approved = manifest.swaps.filter((s) => s.approved).length;
  return (
    <div className="panel">
      <div className="panel-header"><div><h1 className="panel-title">Review Swaps</h1><p className="panel-sub">{approved} of {manifest.swaps.length} approved. Toggle off any to skip. Click green bullet to edit.</p></div><button className="btn-ghost-sm" onClick={onBack}>← Back</button></div>
      <div className="swaps-layout">
        <div className="swaps-list">{manifest.swaps.map((swap) => (<div key={swap.id} className={`swap-card ${swap.approved ? "approved" : "rejected"}`}><div className="swap-card-header"><div className="swap-meta"><span className="swap-section-tag">{swap.section}</span><span className="swap-skills-tag">{swap.jdSkillsAddressed.join(", ")}</span></div><label className="toggle-switch"><input type="checkbox" checked={swap.approved} onChange={() => onToggle(swap.id)} /><span className="toggle-track"><span className="toggle-thumb" /></span></label></div><div className="swap-diff-grid"><div className="diff-block old"><div className="diff-label">Remove · {swap.originalScore}/10</div><p>{swap.originalBullet}</p></div><div className="diff-arrow">→</div><div className="diff-block new" onClick={() => setEditingId(swap.id)} title="Click to edit"><div className="diff-label">Add · {swap.newScore}/10 ✏</div>{editingId === swap.id ? <textarea className="inline-edit" defaultValue={swap.userEdited ?? swap.newBullet} autoFocus onBlur={(e) => { onEdit(swap.id, e.target.value); setEditingId(null); }} /> : <p>{swap.userEdited ?? swap.newBullet}</p>}</div></div></div>))}</div>
        <div className="swaps-sidebar"><div className="card summary-card"><div className="card-title">Summary</div><div className="summary-rows"><div className="summary-row"><span>Approved</span><span className="summary-val green">{approved}</span></div><div className="summary-row"><span>Skipped</span><span className="summary-val muted">{manifest.swaps.length - approved}</span></div></div>{manifest.atsKeywordGaps.length > 0 && (<><div className="card-title" style={{ marginTop: 16 }}>ATS Gaps</div><div className="tag-cloud">{manifest.atsKeywordGaps.map((k) => <span key={k} className="tag tag-yellow">{k}</span>)}</div></>)}<button className="btn-accent full-w" style={{ marginTop: 20 }} onClick={onApply} disabled={approved === 0}>Apply {approved} Swap{approved !== 1 ? "s" : ""} & Download →</button></div></div>
      </div>
    </div>
  );
}

function DoneStep({ onReset }: { onReset: () => void }) {
  return (
    <div className="panel center-panel">
      <div className="done-icon">✓</div>
      <h1 className="done-title">Resume Downloaded!</h1>
      <p className="done-sub">Your tailored DOCX is in your Downloads folder. Review it before sending.</p>
      <div className="done-checklist"><p>✓ Bullet count preserved</p><p>✓ Formatting unchanged</p><p>✓ No API keys needed</p><p>✓ No data stored on servers</p></div>
      <button className="btn-accent" onClick={onReset}>Tailor Another Job →</button>
    </div>
  );
}
