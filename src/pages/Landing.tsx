import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/landing.css";

const STEPS = [
  { icon: "📄", title: "Upload Your Resume", desc: "Upload your DOCX template once. Your formatting, page count, and bullet structure are locked permanently." },
  { icon: "🔍", title: "Paste the Job Description", desc: "Copy any JD from LinkedIn, Greenhouse, Lever, or any job board and paste it in." },
  { icon: "📋", title: "Copy Prompt to Your AI", desc: "We generate the prompt. You paste it into ChatGPT, Claude, or any AI you already use. No API key or provider setup." },
  { icon: "📥", title: "Paste the Response Back", desc: "Copy the JSON response from your AI and paste it back. We parse it instantly — scores, gaps, everything." },
  { icon: "✅", title: "Review Swaps & Download", desc: "See every proposed swap before it happens. Edit inline. Approve, reject. Download your tailored DOCX." },
];

const APPROACH_POINTS = [
  { title: "Your DOCX stays local", text: "The Python server runs on localhost and handles DOCX parsing, replacement, and download on your machine." },
  { title: "The AI step is manual", text: "The app creates prompts. You paste them into ChatGPT, Claude, or any AI you already use, then paste the JSON response back." },
  { title: "No hidden model layer", text: "There is no provider switcher, no API key screen, and no app-managed model selection. The workflow is intentionally copy-paste." },
  { title: "You review every change", text: "The app proposes bullet swaps, but you approve, reject, or edit them before generating the final DOCX." },
];

const FAQS = [
  { q: "Does it change my resume template or formatting?", a: "Never. Your template is locked. Page count, section structure, bullet count per role — all preserved exactly. The only thing that changes is the text content of individual bullets." },
  { q: "What AI does it use?", a: "It works with any AI through a copy-paste workflow — ChatGPT, Claude, or any assistant that can return JSON. The app generates the prompt, you paste it into your AI, then paste the JSON response back." },
  { q: "Will it add skills I don't actually have?", a: "No. A confirmation dialog appears for every skill not already evidenced in your resume. You must approve each addition. The AI is explicitly instructed not to fabricate or infer experience." },
  { q: "Does it work with any job board?", a: "Yes, as long as you can copy the job description text. Paste the JD into the app, then the app includes that text in the prompt it generates for your AI." },
  { q: "How much does it cost?", a: "The local app does not require an API key or charge per run. It uses whichever AI account you already have — ChatGPT, Claude, or anything else." },
  { q: "Is my resume data private?", a: "Your DOCX file is processed by the local server and stored in your browser. When you use the prompt bridge, you manually paste extracted resume text and job-description text into your chosen AI, so that plain text is shared with that AI by you." },
  { q: "What file formats are supported?", a: "DOCX only — this is by design. DOCX gives us run-level formatting control that PDF and other formats don't provide, which is what makes formatting preservation possible." },
  { q: "Can I use it for multiple resume templates?", a: "Yes. You can upload different DOCX templates for different role types — one for AI engineering roles, one for data science, etc." },
];

export default function Landing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="landing">
      {/* NAV */}
      <nav className={`nav ${scrolled ? "nav-scrolled" : ""}`}>
        <div className="nav-inner">
          <div className="nav-logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">ResumeTailor</span>
          </div>
          <div className="nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#approach">Approach</a>
            <a href="#faq">FAQ</a>
          </div>
          <button className="btn-nav" onClick={() => navigate("/app")}>
            Run Locally →
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-badge">
          <span className="badge-dot" />
          No API key · Works with ChatGPT, Claude & more · Local DOCX processing
        </div>
        <h1 className="hero-title">
          Tailor your resume using<br />
          <span className="hero-gradient">ChatGPT, Claude, or any AI</span>
        </h1>
        <p className="hero-sub">
          Generate a prompt, paste it into ChatGPT, Claude, or any AI you already use, paste the JSON response back, review the swaps, and download your tailored DOCX.
        </p>
        <div className="hero-cta">
          <button className="btn-primary btn-xl" onClick={() => navigate("/app")}>
            Start — use any AI you already have
          </button>
          <a href="#how-it-works" className="btn-ghost-xl">See how it works ↓</a>
        </div>
        <div className="hero-proof">
          <span>✓ No API keys needed</span>
          <span>✓ DOCX processing runs locally</span>
          <span>✓ You control what goes into your AI</span>
        </div>

        {/* Floating UI preview */}
        <div className="hero-visual">
          <div className="ui-preview">
            <div className="preview-header">
              <div className="preview-dots">
                <span /><span /><span />
              </div>
              <span className="preview-title">Resume Tailor</span>
            </div>
            <div className="preview-body">
              <div className="preview-section">
                <div className="preview-label">JD ANALYSIS</div>
                <div className="preview-chips">
                  <span className="chip chip-red">Missing: Agentic RAG</span>
                  <span className="chip chip-red">Missing: pgvector</span>
                  <span className="chip chip-green">✓ Python</span>
                  <span className="chip chip-green">✓ AWS</span>
                </div>
              </div>
              <div className="preview-swap-card">
                <div className="preview-swap-label">SWAP CANDIDATE — Score 2/10</div>
                <div className="preview-old">Maintained legacy SQL databases and wrote stored procedures</div>
                <div className="preview-arrow">↓ replaced with</div>
                <div className="preview-new">Designed vector search pipeline using pgvector, indexing 50M+ embeddings for semantic retrieval across enterprise knowledge bases</div>
                <div className="preview-score">New score: 9/10</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="stats">
        <div className="stats-inner">
          {[
            { val: "2", label: "AI prompts" },
            { val: "0", label: "API keys needed" },
            { val: "DOCX", label: "format preserved locally" },
            { val: "You", label: "approve every swap" },
          ].map((s) => (
            <div key={s.label} className="stat-item">
              <div className="stat-val">{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="how">
        <div className="section-inner">
          <div className="section-tag">How it works</div>
          <h2 className="section-title">Five steps to a perfectly tailored resume</h2>
          <p className="section-sub">No rewriting from scratch. No destroyed formatting. Just precise, targeted swaps.</p>
          <div className="steps-grid">
            {STEPS.map((s, i) => (
              <div key={i} className="step-card">
                <div className="step-num">{String(i + 1).padStart(2, "0")}</div>
                <div className="step-icon">{s.icon}</div>
                <h3 className="step-title">{s.title}</h3>
                <p className="step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SWAP SYSTEM EXPLAINER */}
      <section className="swap-explainer">
        <div className="section-inner">
          <div className="section-tag">The Swap System</div>
          <h2 className="section-title">Not a rewriter. A precision swapper.</h2>
          <p className="section-sub">Every other tool rewrites your resume from scratch. We don't.</p>
          <div className="compare-grid">
            <div className="compare-card bad">
              <div className="compare-header">
                <span className="compare-icon">❌</span>
                <h3>Other Tools</h3>
              </div>
              <ul>
                <li>Rewrite your resume from scratch</li>
                <li>Destroy your formatting and template</li>
                <li>Change page count unpredictably</li>
                <li>Add skills you can't defend</li>
                <li>Look different every time</li>
                <li>Require manual cleanup after every run</li>
              </ul>
            </div>
            <div className="compare-card good">
              <div className="compare-header">
                <span className="compare-icon">⚡</span>
                <h3>ResumeTailor</h3>
              </div>
              <ul>
                <li>Swap individual bullets, nothing else</li>
                <li>Template, formatting, layout: unchanged</li>
                <li>Page count guaranteed identical</li>
                <li>Confirmation step for every new skill</li>
                <li>Same resume, better targeting every time</li>
                <li>Download and send immediately</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* PROMPT BRIDGE */}
      <section className="prompt-bridge">
        <div className="section-inner">
          <div className="section-tag">Prompt Bridge</div>
          <h2 className="section-title">No backend model. No API account.</h2>
          <p className="section-sub">ResumeTailor prepares the work. You choose the AI — ChatGPT, Claude, or anything else — and stay in control of that step.</p>
          <div className="testimonials-grid">
            {[
              "The app extracts plain text from your DOCX and combines it with the job description.",
              "You copy the generated prompt into ChatGPT, Claude, or any AI and ask it to return structured JSON.",
              "You paste that JSON back into ResumeTailor for scoring, swap review, and DOCX generation.",
              "The app never asks for provider credentials because it does not call model APIs.",
            ].map((text) => (
              <div key={text} className="testimonial-card">
                <p className="testimonial-text">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* APPROACH */}
      <section id="approach" className="testimonials">
        <div className="section-inner">
          <div className="section-tag">Why this approach works</div>
          <h2 className="section-title">Focused, local, and reviewable</h2>
          <div className="testimonials-grid">
            {APPROACH_POINTS.map((point) => (
              <div key={point.title} className="testimonial-card">
                <h3 className="approach-title">{point.title}</h3>
                <p className="testimonial-text">{point.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="faq">
        <div className="section-inner faq-inner">
          <div className="section-tag">FAQ</div>
          <h2 className="section-title">Common questions</h2>
          <div className="faq-list">
            {FAQS.map((f, i) => (
              <div key={i} className={`faq-item ${openFaq === i ? "open" : ""}`} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <div className="faq-q">
                  <span>{f.q}</span>
                  <span className="faq-chevron">{openFaq === i ? "−" : "+"}</span>
                </div>
                {openFaq === i && <div className="faq-a">{f.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="section-inner cta-inner">
          <h2 className="cta-title">Ready to tailor smarter?</h2>
          <p className="cta-sub">Run locally. No API key needed. Works with ChatGPT, Claude, or any AI you already use.</p>
          <button className="btn-primary btn-xl" onClick={() => navigate("/app")}>
            Start Tailoring Locally →
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">ResumeTailor</span>
          </div>
          <div className="footer-links">
            <a href="#faq">FAQ</a>
            <a href="#how-it-works">How it works</a>
          </div>
          <p className="footer-copy">© 2026 ResumeTailor. DOCX processing stays local; you choose which AI to use and what to paste into it.</p>
        </div>
      </footer>
    </div>
  );
}
