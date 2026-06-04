import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { buildScoringPrompt, buildSwapPrompt } from "../lib/prompts";
import { saveSession, loadSession, clearSession, saveProfile, loadProfile } from "../lib/storage";
import { parseAIJSON, validateScoringResponse, validateSwapResponse, type ScoringResponse, type SkillConfirm, type SwapItem, type DeEmphasisItem } from "../lib/validation";
import "../styles/app.css";

interface Manifest { jobTitle: string; company: string; jdSummary: string; keySkillsFound: string[]; keySkillsMissing: string[]; atsKeywordGaps: string[]; swaps: SwapItem[]; deEmphasis: DeEmphasisItem[]; skillsToConfirm: SkillConfirm[]; }
interface Profile { resumeText: string; resumeBase64: string; resumeFileName: string; }
type Step = "upload" | "jd" | "scoring-prompt" | "scoring-paste" | "swap-prompt" | "swap-paste" | "confirm-skills" | "swaps" | "done";

async function readApiError(response: Response): Promise<string> {
  const fallback = `Request failed with status ${response.status}.`;
  try {
    const text = await response.text();
    if (!text.trim()) return fallback;
    const data = JSON.parse(text);
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
    if (Array.isArray(data.detail)) return data.detail.map((item) => item.msg ?? JSON.stringify(item)).join("; ");
    return fallback;
  } catch {
    return fallback;
  }
}

type AiProvider = "chatgpt" | "claude" | "other";
const AI_CONFIG: Record<AiProvider, { name: string; url: string | null }> = {
  chatgpt: { name: "ChatGPT", url: "https://chatgpt.com" },
  claude:  { name: "Claude",  url: "https://claude.ai" },
  other:   { name: "AI assistant", url: null },
};

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
  const [uploadError, setUploadError] = useState("");
  const [applyError, setApplyError] = useState("");
  const [copied, setCopied] = useState(false);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [needsReupload, setNeedsReupload] = useState(false);
  const [aiProvider, setAiProviderRaw] = useState<AiProvider>("chatgpt");

  function persist(patch: Record<string, unknown>) { sessionRef.current = { ...sessionRef.current, ...patch }; saveSession(sessionRef.current); }
  const setStep = (s: Step) => { setStepRaw(s); persist({ step: s }); setPasteValue(""); setParseError(""); setUploadError(""); setApplyError(""); setCopied(false); };
  const setAiProvider = (p: AiProvider) => { setAiProviderRaw(p); persist({ aiProvider: p }); };
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
    if (session.aiProvider && ["chatgpt", "claude", "other"].includes(session.aiProvider as string)) { setAiProviderRaw(session.aiProvider as AiProvider); sessionRef.current.aiProvider = session.aiProvider; }
    const s = session.step as Step | undefined;
    if (s && prof.resumeText) {
      setStepRaw(s);
      sessionRef.current.step = s;
      // resumeBase64 is not persisted — flag if session was mid-flow so user knows to re-upload
      if (s !== "upload" && s !== "jd" && !prof.resumeBase64) setNeedsReupload(true);
    } else if (prof.resumeText) setStepRaw("jd");
    checkServer();
  }, []);

  async function checkServer() { try { const r = await fetch("http://localhost:7842/health"); setServerOk(r.ok); } catch { setServerOk(false); } }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadError("");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      try {
        const res = await fetch("http://localhost:7842/extract-text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume_base64: base64 }) });
        if (!res.ok) { setUploadError(await readApiError(res)); return; }
        const data = await res.json();
        const update = { resumeFileName: file.name, resumeBase64: base64, resumeText: data.text };
        setProfile((p) => { const n = { ...p, ...update }; saveProfile(n); return n; });
        setNeedsReupload(false);
        setStep("jd");
      } catch {
        setServerOk(false);
        setUploadError("Local server not running. Run: cd server && python main.py");
      }
    };
    reader.readAsDataURL(file);
  }

  function copyPrompt(text: string) { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); }

  function handlePasteScoring() {
    setParseError("");
    try {
      const data = validateScoringResponse(parseAIJSON(pasteValue));
      setScoring(data); setStep("swap-prompt");
    } catch (e: unknown) { setParseError((e as Error).message); }
  }

  function handlePasteSwaps() {
    setParseError("");
    try {
      const data = validateSwapResponse(parseAIJSON(pasteValue));
      const s = scoring as ScoringResponse;
      const m: Manifest = { jobTitle: s.jobTitle, company: s.company, jdSummary: s.jdSummary, keySkillsFound: s.keySkillsFound, keySkillsMissing: s.keySkillsMissing, atsKeywordGaps: s.atsKeywordGaps, swaps: data.swaps, deEmphasis: data.deEmphasis, skillsToConfirm: data.skillsToConfirm };
      setManifest(m); setStep(m.skillsToConfirm.length > 0 ? "confirm-skills" : "swaps");
    } catch (e: unknown) { setParseError((e as Error).message); }
  }

  async function handleApplySwaps() {
    if (!manifest) return;
    setApplyError("");
    if (!profile.resumeBase64) {
      setApplyError("Resume file not loaded. Please re-upload your DOCX — it is not stored between page refreshes.");
      return;
    }
    try {
      const approvedSwaps = manifest.swaps.filter((s) => s.approved).map((s) => ({ ...s, newBullet: s.userEdited ?? s.newBullet }));
      const approvedDeEmphasis = manifest.deEmphasis.filter((d) => d.approved).map((d) => ({ ...d, action: "shorten" as const }));
      const approved = { ...manifest, swaps: [...approvedSwaps, ...approvedDeEmphasis] };
      const res = await fetch("http://localhost:7842/apply-swaps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume_base64: profile.resumeBase64, manifest: approved }) });
      if (!res.ok) { setApplyError(await readApiError(res)); return; }
      const data = await res.json();
      const link = document.createElement("a");
      link.href = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${data.docx_base64}`;
      link.download = data.filename; link.click();
      clearSession(); setStep("done");
    } catch {
      setServerOk(false);
      setApplyError("Local server not running. Run: cd server && python main.py");
    }
  }

  const scoringPrompt = profile.resumeText && jdText ? buildScoringPrompt(profile.resumeText, jdText) : "";
  const swapPrompt = profile.resumeText && jdText && scoring ? buildSwapPrompt(profile.resumeText, jdText, scoring) : "";

  return (
    <div className="app-layout">
      <AppNav onHome={() => navigate("/")} step={step} serverOk={serverOk} />
      <main className="app-main">
        {step === "upload" && <UploadStep serverOk={serverOk} error={uploadError} onDismissError={() => setUploadError("")} onUpload={handleResumeUpload} onCheckServer={checkServer} />}
        {step === "jd" && <JDStep profile={profile} jdText={jdText} onJdChange={setJdText} aiProvider={aiProvider} onAiProviderChange={setAiProvider} onNext={() => setStep("scoring-prompt")} onBack={() => setStep("upload")} />}
        {step === "scoring-prompt" && <PromptStep stepNumber={1} title={`Copy this prompt into ${AI_CONFIG[aiProvider].name}`} description={`Asks ${AI_CONFIG[aiProvider].name} to score every bullet against the JD. Open ${AI_CONFIG[aiProvider].name}, paste it, wait for the response, then come back.`} aiProvider={aiProvider} prompt={scoringPrompt} copied={copied} onCopy={() => copyPrompt(scoringPrompt)} onNext={() => setStep("scoring-paste")} onBack={() => setStep("jd")} />}
        {step === "scoring-paste" && <PasteStep stepNumber={2} title={`Paste ${AI_CONFIG[aiProvider].name}'s response`} description={`Copy the entire JSON response from ${AI_CONFIG[aiProvider].name} and paste it below. It should start with { "jobTitle": ...`} placeholder={'{\n  "jobTitle": "...",\n  "bullets": [...]\n}'} value={pasteValue} onChange={setPasteValue} error={parseError} onSubmit={handlePasteScoring} onBack={() => setStep("scoring-prompt")} submitLabel="Parse Scores →" aiName={AI_CONFIG[aiProvider].name} />}
        {step === "swap-prompt" && scoring && <ScoringPreviewStep scoring={scoring} swapPrompt={swapPrompt} aiProvider={aiProvider} copied={copied} onCopy={() => copyPrompt(swapPrompt)} onNext={() => setStep("swap-paste")} onBack={() => setStep("scoring-paste")} />}
        {step === "swap-paste" && <PasteStep stepNumber={4} title={`Paste ${AI_CONFIG[aiProvider].name}'s improvement response`} description='Paste the JSON response. It should start with { "swaps": ...' placeholder={'{\n  "swaps": [...],\n  "skillsToConfirm": [...]\n}'} value={pasteValue} onChange={setPasteValue} error={parseError} onSubmit={handlePasteSwaps} onBack={() => setStep("swap-prompt")} submitLabel="Parse Swaps →" aiName={AI_CONFIG[aiProvider].name} />
        {step === "confirm-skills" && manifest && <ConfirmSkillsStep manifest={manifest} onConfirm={(i, v) => setManifest((m) => { if (!m) return m; const sc = [...m.skillsToConfirm]; sc[i] = { ...sc[i], confirmed: v }; return { ...m, skillsToConfirm: sc }; })} onDone={() => { setManifest((m) => { if (!m) return m; const denied = m.skillsToConfirm.filter((s) => s.confirmed === false).map((s) => s.skill.toLowerCase()); return { ...m, swaps: m.swaps.filter((s) => !s.jdSkillsAddressed.some((sk) => denied.includes(sk.toLowerCase()))) }; }); setStep("swaps"); }} onBack={() => setStep("swap-paste")} />}
        {needsReupload && step !== "upload" && step !== "jd" && step !== "done" && (
          <div className="app-error" role="alert" style={{ margin: "0 0 12px" }}>
            <span>Session restored — please re-upload your DOCX to apply swaps (the file is not stored between sessions).</span>
            <button type="button" aria-label="Dismiss" onClick={() => setNeedsReupload(false)}>×</button>
          </div>
        )}
        {step === "swaps" && manifest && <SwapsStep manifest={manifest} error={applyError} onDismissError={() => setApplyError("")} onToggle={(id) => setManifest((m) => m ? { ...m, swaps: m.swaps.map((s) => s.id === id ? { ...s, approved: !s.approved } : s) } : m)} onEdit={(id, t) => setManifest((m) => m ? { ...m, swaps: m.swaps.map((s) => s.id === id ? { ...s, userEdited: t } : s) } : m)} onToggleDeEmphasis={(id) => setManifest((m) => m ? { ...m, deEmphasis: m.deEmphasis.map((d) => d.id === id ? { ...d, approved: !d.approved } : d) } : m)} onApply={handleApplySwaps} onBack={() => setStep("swap-paste")} />
        {step === "done" && <DoneStep onReset={() => { clearSession(); setJdTextRaw(""); setScoringRaw(null); setManifestRaw(null); setStepRaw("jd"); }} />}
      </main>
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="app-error" role="alert">
      <span>{message}</span>
      <button type="button" aria-label="Dismiss error" onClick={onDismiss}>×</button>
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

function UploadStep({ serverOk, error, onDismissError, onUpload, onCheckServer }: { serverOk: boolean | null; error: string; onDismissError: () => void; onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; onCheckServer: () => void }) {
  return (
    <div className="panel center-panel">
      <div className="panel-icon">📄</div>
      <h1 className="panel-title">Upload Your Resume</h1>
      <p className="panel-sub">Upload your DOCX once. Your formatting, page count, and structure are locked — they never change.</p>
      {serverOk === false && <div className="warn-box">⚠ Local server not running.<code>cd server && python main.py</code><button className="btn-ghost-sm" style={{ marginTop: 8 }} onClick={onCheckServer}>Check again</button></div>}
      {error && <ErrorBanner message={error} onDismiss={onDismissError} />}
      <label className="upload-zone"><input type="file" accept=".docx" onChange={onUpload} /><span className="upload-zone-icon">⬆</span><span className="upload-zone-label">Click to upload your DOCX resume</span><span className="upload-zone-hint">DOCX only · stays on your device</span></label>
      <div className="how-it-works-mini">
        {["Upload resume", "Paste JD", "Copy → AI", "Paste back", "Download DOCX"].map((s, i, arr) => (
          <React.Fragment key={s}><div className="how-step"><span>{i + 1}</span>{s}</div>{i < arr.length - 1 && <div className="how-sep">→</div>}</React.Fragment>
        ))}
      </div>
    </div>
  );
}

function JDStep({ profile, jdText, onJdChange, aiProvider, onAiProviderChange, onNext, onBack }: { profile: Partial<Profile>; jdText: string; onJdChange: (t: string) => void; aiProvider: AiProvider; onAiProviderChange: (p: AiProvider) => void; onNext: () => void; onBack: () => void }) {
  return (
    <div className="panel">
      <div className="panel-header"><div><h1 className="panel-title">Paste the Job Description</h1><p className="panel-sub">Copy the full JD — summary, requirements, responsibilities.</p></div><button className="btn-ghost-sm" onClick={onBack}>← Back</button></div>
      <div className="resume-loaded-bar"><span>📄</span><span>{profile.resumeFileName}</span><span className="resume-loaded-ok">✓ Loaded</span></div>
      <div className="ai-picker"><span className="ai-picker-label">Which AI will you use?</span><div className="ai-picker-options">{(["chatgpt", "claude", "other"] as AiProvider[]).map((p) => (<button key={p} className={`ai-pill ${aiProvider === p ? "active" : ""}`} onClick={() => onAiProviderChange(p)}>{AI_CONFIG[p].name}</button>))}</div></div>
      <div className="jd-area"><div className="jd-toolbar"><span className="card-title">Job Description</span><span className="char-count">{jdText.length} chars</span></div><textarea className="jd-textarea" value={jdText} onChange={(e) => onJdChange(e.target.value)} placeholder="Paste the full job description here..." /></div>
      <button className="btn-accent btn-lg full-w" onClick={onNext} disabled={!jdText.trim()}>Generate {AI_CONFIG[aiProvider].name} Prompt →</button>
    </div>
  );
}

function PromptStep({ stepNumber, title, description, aiProvider, prompt, copied, onCopy, onNext, onBack }: { stepNumber: number; title: string; description: string; aiProvider: AiProvider; prompt: string; copied: boolean; onCopy: () => void; onNext: () => void; onBack: () => void }) {
  const ai = AI_CONFIG[aiProvider];
  const openStep = ai.url
    ? { n: "2", t: `Open ${ai.name}`, d: <a href={ai.url} target="_blank" rel="noreferrer" className="open-chatgpt-btn">Open {ai.name} in new tab →</a> }
    : { n: "2", t: "Open your AI assistant", d: <p>Open your preferred AI assistant in another tab.</p> };
  return (
    <div className="panel">
      <div className="panel-header"><div><div className="step-badge">Step {stepNumber} of 4</div><h1 className="panel-title">{title}</h1><p className="panel-sub">{description}</p></div><button className="btn-ghost-sm" onClick={onBack}>← Back</button></div>
      <div className="chatgpt-guide">
        {[{ n: "1", t: "Copy the prompt below", d: <p>Click "Copy Prompt" to copy everything to your clipboard.</p> }, openStep, { n: "3", t: "Paste and send", d: <p>Paste (Cmd+V / Ctrl+V) and hit Enter. Wait for the full JSON response.</p> }, { n: "4", t: "Come back here", d: <p>Click "I have the response" below and paste the reply on the next screen.</p> }].map((g) => (<div key={g.n} className="guide-step"><div className="guide-num">{g.n}</div><div><b>{g.t}</b>{g.d}</div></div>))}
      </div>
      <div className="prompt-box"><div className="prompt-box-header"><span className="card-title">Prompt for {ai.name}</span><button className={`copy-btn ${copied ? "copied" : ""}`} onClick={onCopy}>{copied ? "✓ Copied!" : "Copy Prompt"}</button></div><pre className="prompt-text">{prompt.slice(0, 500)}…</pre><p className="prompt-length">{prompt.length.toLocaleString()} characters total</p></div>
      <button className="btn-accent btn-lg full-w" onClick={onNext}>I have the response →</button>
    </div>
  );
}

function PasteStep({ stepNumber, title, description, placeholder, value, onChange, error, onSubmit, onBack, submitLabel, aiName }: { stepNumber: number; title: string; description: string; placeholder: string; value: string; onChange: (t: string) => void; error: string; onSubmit: () => void; onBack: () => void; submitLabel: string; aiName: string }) {
  return (
    <div className="panel">
      <div className="panel-header"><div><div className="step-badge">Step {stepNumber} of 4</div><h1 className="panel-title">{title}</h1><p className="panel-sub">{description}</p></div><button className="btn-ghost-sm" onClick={onBack}>← Back</button></div>
      <div className="paste-area"><div className="paste-header"><span className="card-title">{aiName} Response</span>{value && <button className="btn-ghost-sm" onClick={() => onChange("")}>Clear</button>}</div><textarea className={`paste-textarea ${error ? "has-error" : ""}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} spellCheck={false} />{error && <div className="parse-error">⚠ {error}</div>}</div>
      <button className="btn-accent btn-lg full-w" onClick={onSubmit} disabled={!value.trim()}>{submitLabel}</button>
    </div>
  );
}

function ScoringPreviewStep({ scoring, swapPrompt, aiProvider, copied, onCopy, onNext, onBack }: { scoring: unknown; swapPrompt: string; aiProvider: AiProvider; copied: boolean; onCopy: () => void; onNext: () => void; onBack: () => void }) {
  const s = scoring as Record<string, unknown>;
  const ai = AI_CONFIG[aiProvider];
  const bullets = (s.bullets as Array<Record<string, unknown>>) ?? [];
  const sorted = [...bullets].sort((a, b) => (a.score as number) - (b.score as number));
  const swapCount = sorted.filter((b) => (b.score as number) < 5).length;
  return (
    <div className="panel">
      <div className="panel-header"><div><div className="step-badge">Step 3 of 4</div><h1 className="panel-title">Scores parsed ✓</h1><p className="panel-sub">{s.jobTitle as string}{s.company ? ` @ ${s.company}` : ""} · {swapCount} bullets need improvement</p></div><button className="btn-ghost-sm" onClick={onBack}>← Back</button></div>
      <div className="scores-quick">{sorted.slice(0, 6).map((b, i) => { const score = b.score as number; return (<div key={i} className={`score-quick-row ${score < 5 ? "low" : score < 7 ? "mid" : "high"}`}><div className="score-circle">{score}</div><p className="score-quick-text">{(b.bullet as string).slice(0, 90)}{(b.bullet as string).length > 90 ? "…" : ""}</p></div>); })}{sorted.length > 6 && <p className="scores-more">+{sorted.length - 6} more bullets scored</p>}</div>
      <div className="skills-row">{(s.keySkillsMissing as string[] ?? []).slice(0, 5).map((sk) => <span key={sk} className="tag tag-red">{sk}</span>)}{(s.keySkillsFound as string[] ?? []).slice(0, 4).map((sk) => <span key={sk} className="tag tag-green">{sk}</span>)}</div>
      <div className="divider-label">Now send a second prompt to generate improvements →</div>
      <div className="prompt-box"><div className="prompt-box-header"><span className="card-title">Improvement Prompt for {ai.name}</span><button className={`copy-btn ${copied ? "copied" : ""}`} onClick={onCopy}>{copied ? "✓ Copied!" : "Copy Prompt"}</button></div><pre className="prompt-text">{swapPrompt.slice(0, 400)}…</pre><p className="prompt-length">{swapPrompt.length.toLocaleString()} characters</p></div>
      <div className="chatgpt-quick-guide"><span>1. Copy prompt above</span><span>→</span>{ai.url ? <a href={ai.url} target="_blank" rel="noreferrer">2. Paste into {ai.name} →</a> : <span>2. Paste into your AI assistant</span>}<span>→</span><span>3. Click below when done</span></div>
      <button className="btn-accent btn-lg full-w" onClick={onNext}>I have the response →</button>
    </div>
  );
}

function ConfirmSkillsStep({ manifest, onConfirm, onDone, onBack }: { manifest: Manifest; onConfirm: (i: number, v: boolean) => void; onDone: () => void; onBack: () => void }) {
  const allAnswered = manifest.skillsToConfirm.every((s) => s.confirmed !== null);
  const deniedSkills = manifest.skillsToConfirm.filter((s) => s.confirmed === false).map((s) => s.skill.toLowerCase());
  const swapsRemaining = manifest.swaps.filter((s) => !s.jdSkillsAddressed.some((sk) => deniedSkills.includes(sk.toLowerCase()))).length;
  const willBeEmpty = allAnswered && swapsRemaining === 0;
  return (
    <div className="panel">
      <div className="panel-header"><div><h1 className="panel-title">Confirm Skills</h1><p className="panel-sub">Only approve what you can genuinely defend in an interview.</p></div><button className="btn-ghost-sm" onClick={onBack}>← Back</button></div>
      <div className="confirm-list">{manifest.skillsToConfirm.map((s, i) => (<div key={i} className="confirm-card"><div className="confirm-skill-name">{s.skill}</div><p className="confirm-context">{s.context}</p><div className="confirm-btns"><button className={`confirm-btn yes ${s.confirmed === true ? "active" : ""}`} onClick={() => onConfirm(i, true)}>✓ Yes, I have this</button><button className={`confirm-btn no ${s.confirmed === false ? "active" : ""}`} onClick={() => onConfirm(i, false)}>✗ Skip it</button></div></div>))}</div>
      {willBeEmpty && <div className="warn-box" style={{ marginTop: 12 }}>⚠ All proposed swaps require skills you've skipped — there will be nothing to review. Go back to paste a new response, or accept at least one skill.</div>}
      <button className="btn-accent btn-lg full-w" onClick={onDone} disabled={!allAnswered}>Review Swaps →</button>
    </div>
  );
}

function SwapsStep({ manifest, error, onDismissError, onToggle, onEdit, onToggleDeEmphasis, onApply, onBack }: { manifest: Manifest; error: string; onDismissError: () => void; onToggle: (id: string) => void; onEdit: (id: string, t: string) => void; onToggleDeEmphasis: (id: string) => void; onApply: () => void; onBack: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const approved = manifest.swaps.filter((s) => s.approved).length;
  const approvedDe = manifest.deEmphasis.filter((d) => d.approved).length;
  const totalApproved = approved + approvedDe;
  const noSwaps = manifest.swaps.length === 0 && manifest.deEmphasis.length === 0;
  return (
    <div className="panel">
      <div className="panel-header"><div><h1 className="panel-title">Review Swaps</h1><p className="panel-sub">{noSwaps ? "No changes to apply." : `${totalApproved} change${totalApproved !== 1 ? "s" : ""} approved. Toggle off any to skip.`}</p></div><button className="btn-ghost-sm" onClick={onBack}>← Back</button></div>
      {noSwaps && <div className="warn-box">⚠ No swaps remain — all were removed because you skipped the skills they required. Go back and paste a new response, or accept at least one skill on the previous step.</div>}
      <div className="swaps-layout">
        <div className="swaps-list">
          {manifest.swaps.map((swap) => (<div key={swap.id} className={`swap-card ${swap.approved ? "approved" : "rejected"}`}><div className="swap-card-header"><div className="swap-meta"><span className="swap-section-tag">{swap.section}</span><span className="swap-skills-tag">{swap.jdSkillsAddressed.join(", ")}</span></div><label className="toggle-switch"><input type="checkbox" checked={swap.approved} onChange={() => onToggle(swap.id)} /><span className="toggle-track"><span className="toggle-thumb" /></span></label></div><div className="swap-diff-grid"><div className="diff-block old"><div className="diff-label">Remove · {swap.originalScore}/10</div><p>{swap.originalBullet}</p></div><div className="diff-arrow">→</div><div className="diff-block new" onClick={() => setEditingId(swap.id)} title="Click to edit"><div className="diff-label">Add · {swap.newScore}/10 ✏</div>{editingId === swap.id ? <textarea className="inline-edit" value={swap.userEdited ?? swap.newBullet} autoFocus onChange={(e) => onEdit(swap.id, e.target.value)} onBlur={() => setEditingId(null)} /> : <p>{swap.userEdited ?? swap.newBullet}</p>}</div></div></div>))}
          {manifest.deEmphasis.length > 0 && (
            <>
              <div className="section-divider">Reduce Emphasis — less relevant to this JD</div>
              {manifest.deEmphasis.map((d) => (
                <div key={d.id} className={`swap-card ${d.approved ? "approved" : "rejected"}`}>
                  <div className="swap-card-header">
                    <div className="swap-meta"><span className="swap-section-tag">{d.section}</span><span className="swap-skills-tag" title={d.reason}>shorten</span></div>
                    <label className="toggle-switch"><input type="checkbox" checked={d.approved} onChange={() => onToggleDeEmphasis(d.id)} /><span className="toggle-track"><span className="toggle-thumb" /></span></label>
                  </div>
                  <div className="swap-diff-grid">
                    <div className="diff-block old"><div className="diff-label">Original</div><p>{d.originalBullet}</p></div>
                    <div className="diff-arrow">→</div>
                    <div className="diff-block new"><div className="diff-label">Shortened ✏</div><p>{d.shortenedBullet}</p></div>
                  </div>
                  {d.reason && <p className="de-emphasis-reason">{d.reason}</p>}
                </div>
              ))}
            </>
          )}
        </div>
        <div className="swaps-sidebar"><div className="card summary-card">{error && <ErrorBanner message={error} onDismiss={onDismissError} />}<div className="card-title">Summary</div><div className="summary-rows"><div className="summary-row"><span>Swaps</span><span className="summary-val green">{approved}</span></div><div className="summary-row"><span>Shortened</span><span className="summary-val green">{approvedDe}</span></div><div className="summary-row"><span>Skipped</span><span className="summary-val muted">{(manifest.swaps.length - approved) + (manifest.deEmphasis.length - approvedDe)}</span></div></div>{manifest.atsKeywordGaps.length > 0 && (<><div className="card-title" style={{ marginTop: 16 }}>ATS Gaps</div><div className="tag-cloud">{manifest.atsKeywordGaps.map((k) => <span key={k} className="tag tag-yellow">{k}</span>)}</div></>)}<button className="btn-accent full-w" style={{ marginTop: 20 }} onClick={onApply} disabled={totalApproved === 0}>Apply {totalApproved} Change{totalApproved !== 1 ? "s" : ""} & Download →</button></div></div>
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
