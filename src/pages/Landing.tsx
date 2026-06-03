import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/landing.css";

const STEPS = [
  { icon: "📄", title: "Upload Your Resume", desc: "Upload your DOCX template once. Your formatting, page count, and bullet structure are locked permanently." },
  { icon: "🔍", title: "Paste the Job Description", desc: "Copy any JD from LinkedIn, Greenhouse, Lever, or any job board and paste it in." },
  { icon: "📋", title: "Copy Prompt to ChatGPT", desc: "We generate a perfect prompt. You paste it into ChatGPT (your $20/month account). No API keys, no extra cost." },
  { icon: "📥", title: "Paste the Response Back", desc: "Copy ChatGPT's JSON response and paste it back. We parse it instantly — scores, gaps, everything." },
  { icon: "✅", title: "Review Swaps & Download", desc: "See every proposed swap before it happens. Edit inline. Approve, reject. Download your tailored DOCX." },
];

const TESTIMONIALS = [
  { name: "Priya M.", role: "Data Engineer", text: "I was applying to 10+ jobs a week. This cut my tailoring time from 45 minutes to under 2 minutes per application. The formatting never breaks." },
  { name: "Alex K.", role: "ML Engineer", text: "Unlike every other tool I tried, this one doesn't blow up my template. The swap system is brilliant — same resume, better targeting." },
  { name: "Sam T.", role: "Product Manager", text: "The skill confirmation step is what sold me. It never adds anything I can't defend in an interview. Ethical and effective." },
  { name: "Riya S.", role: "AI Researcher", text: "Gemini 2.5 Flash as the backend means it's essentially free with my Google subscription. Best free tool for job applications, period." },
];

const FAQS = [
  { q: "Does it change my resume template or formatting?", a: "Never. Your template is locked. Page count, section structure, bullet count per role — all preserved exactly. The only thing that changes is the text content of individual bullets." },
  { q: "What AI models does it support?", a: "Google Gemini (2.5 Pro, 3.1 Pro, 3.5 Flash), Anthropic Claude (Opus 4.8, Sonnet 4.6, Haiku 4.5), and OpenAI GPT (4o, 4.5, 5.5). If you have a Google AI Pro subscription, Gemini is free." },
  { q: "Will it add skills I don't actually have?", a: "No. A confirmation dialog appears for every skill not already evidenced in your resume. You must approve each addition. The AI is explicitly instructed not to fabricate or infer experience." },
  { q: "Does it work with any job board?", a: "It extracts JD text from LinkedIn, Greenhouse, Lever, Workday, and most company career pages. For sites with unusual layouts, paste the JD text manually." },
  { q: "How much does it cost?", a: "The tool itself is free. You pay only for AI API calls — roughly $0.03–0.06 per resume tailored using Claude Sonnet. With a Google AI Pro subscription, Gemini is included at no extra cost." },
  { q: "Is my resume data private?", a: "Yes. Your resume is stored locally in your browser. The AI receives only plain text extracted from your DOCX — never the file itself. No data is stored on any server." },
  { q: "What file formats are supported?", a: "DOCX only — this is by design. DOCX gives us run-level formatting control that PDF and other formats don't provide, which is what makes formatting preservation possible." },
  { q: "Can I use it for multiple resume templates?", a: "Yes. You can upload different DOCX templates for different role types — one for AI engineering roles, one for data science, etc." },
];

export default function Landing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
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
            <a href="#testimonials">Reviews</a>
            <a href="#faq">FAQ</a>
          </div>
          <button className="btn-nav" onClick={() => navigate("/app")}>
            Get Started Free →
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-badge">
          <span className="badge-dot" />
          No API key · Uses your ChatGPT Plus · 100% free
        </div>
        <h1 className="hero-title">
          Tailor your resume using<br />
          <span className="hero-gradient">ChatGPT you already pay for</span>
        </h1>
        <p className="hero-sub">
          Already paying $20/month for ChatGPT Plus? Put it to work.<br />
          We generate the perfect prompt — you paste it in, paste the response back, download your DOCX.
        </p>
        <div className="hero-cta">
          <button className="btn-primary btn-xl" onClick={() => navigate("/app")}>
            Start Free — No API Key Needed
          </button>
          <a href="#how-it-works" className="btn-ghost-xl">See how it works ↓</a>
        </div>
        <div className="hero-proof">
          <span>✓ No API keys needed</span>
          <span>✓ Works with ChatGPT Plus ($20/mo)</span>
          <span>✓ Your data stays local</span>
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
            { val: "~60s", label: "per resume" },
            { val: "85–95%", label: "format preservation" },
            { val: "$0.04", label: "avg cost per run" },
            { val: "0", label: "data stored on servers" },
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

      {/* AI MODELS */}
      <section className="models-section">
        <div className="section-inner">
          <div className="section-tag">AI Models</div>
          <h2 className="section-title">Works with the models you already pay for</h2>
          <p className="section-sub">Bring your own API key — or use your existing Google AI Pro subscription for free.</p>
          <div className="models-grid">
            {[
              { provider: "Google", icon: "🔵", badge: "Free with AI Pro", models: ["Gemini 3.1 Pro", "Gemini 3.5 Flash", "Gemini 2.5 Pro"], highlight: true },
              { provider: "Anthropic", icon: "🟣", badge: "$5 free credits", models: ["Claude Opus 4.8", "Claude Sonnet 4.6", "Claude Haiku 4.5"], highlight: false },
              { provider: "OpenAI", icon: "⚫", badge: "Separate API billing", models: ["GPT-5.5 Pro", "GPT-5.5 Instant", "GPT-4o"], highlight: false },
            ].map((p) => (
              <div key={p.provider} className={`model-provider-card ${p.highlight ? "highlighted" : ""}`}>
                <div className="provider-top">
                  <span className="provider-icon">{p.icon}</span>
                  <div>
                    <div className="provider-name">{p.provider}</div>
                    <div className={`provider-badge ${p.highlight ? "badge-green" : "badge-gray"}`}>{p.badge}</div>
                  </div>
                </div>
                <ul className="model-list">
                  {p.models.map((m) => (
                    <li key={m}><span className="model-dot">·</span>{m}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="testimonials">
        <div className="section-inner">
          <div className="section-tag">Reviews</div>
          <h2 className="section-title">Loved by job seekers</h2>
          <div className="testimonials-grid">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="testimonial-card">
                <p className="testimonial-text">"{t.text}"</p>
                <div className="testimonial-author">
                  <div className="author-avatar">{t.name[0]}</div>
                  <div>
                    <div className="author-name">{t.name}</div>
                    <div className="author-role">{t.role}</div>
                  </div>
                </div>
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
          <p className="cta-sub">No account. No credit card. Start with your Google AI Pro key.</p>
          <button className="btn-primary btn-xl" onClick={() => navigate("/app")}>
            Start Tailoring Free →
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
          <p className="footer-copy">© 2026 ResumeTailor. Your data never leaves your machine.</p>
        </div>
      </footer>
    </div>
  );
}
