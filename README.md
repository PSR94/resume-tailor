# ⚡ ResumeTailor — ChatGPT Edition

Tailor your resume to any job description using **ChatGPT Plus you already pay for** — no API keys, no extra cost.

![ResumeTailor](https://img.shields.io/badge/No%20API%20Key-Required-22c55e?style=flat-square) ![ChatGPT Plus](https://img.shields.io/badge/Works%20With-ChatGPT%20Plus-10a37f?style=flat-square) ![Local](https://img.shields.io/badge/Data-Stays%20Local-7c3aed?style=flat-square)

---

## What it does

Most resume tools rewrite your resume from scratch — destroying your template, changing your formatting, and bloating or shrinking the page count.

**ResumeTailor does something different.** It treats your resume as a fixed grid and only swaps out the weakest bullets for targeted replacements. Everything else stays exactly the same.

```
Your Resume (DOCX)  +  Job Description
          ↓
    AI scores every bullet 0–10
          ↓
    Weakest bullets identified
          ↓
    Targeted replacements generated
          ↓
Same template · Same page count · Better targeting
```

**You use ChatGPT for the AI step** — the tool generates the perfect prompt, you paste it into chat.openai.com, paste the response back, and the tool handles the rest.

---

## How the prompt bridge works

No API billing needed. The tool acts as a bridge between your resume data and ChatGPT:

```
1. Upload your DOCX resume
2. Paste the job description
3. Tool generates a scoring prompt → you copy it
4. Paste into ChatGPT → copy the JSON response back
5. Tool generates an improvement prompt → repeat
6. Review every proposed swap — approve, reject, or edit inline
7. Download your tailored DOCX
```

Two prompts to ChatGPT. Total time: ~3–5 minutes.

---

## What stays the same

- ✅ Your template and formatting
- ✅ Page count (validated before download)
- ✅ Bullet count per section
- ✅ Job titles, dates, company names, degrees
- ✅ Bold formatting on skill names

## What changes

- The text of your weakest bullets — replaced with targeted content grounded in your actual experience

---

## Prerequisites

| Requirement | Why |
|---|---|
| **ChatGPT Plus** ($20/mo) | For the AI scoring and generation steps |
| **Python 3.10+** | Runs the local DOCX processing server |
| **Node.js 18+** | Runs the web frontend |

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/PSR94/resume-tailor.git
cd resume-tailor
```

### 2. Install Python dependencies

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Install frontend dependencies

```bash
cd ..
npm install
```

---

## Running

You need two terminals — one for the server, one for the web app.

**Terminal 1 — Start the DOCX server:**
```bash
cd server
source .venv/bin/activate
python main.py
```
Server starts on `http://localhost:7842`

**Terminal 2 — Start the web app:**
```bash
npm run dev
```
App opens at `http://localhost:3001`

Or use the one-command script from the root:
```bash
./start.sh
```

---

## Local development checklist

Use this flow when changing the project locally:

1. Start the app for manual testing:
   ```bash
   ./start.sh
   ```
2. Open `http://localhost:3001` and test the resume tailoring workflow.
3. Before sharing changes, run the full verification suite:
   ```bash
   npm run verify
   ```

`./start.sh` is for running the local server and frontend together. `npm run verify` is for tests, build, and backend compile checks.

---

## Usage walkthrough

### Step 1 — Upload your resume
Upload your `.docx` resume template. Your file is processed locally — it never leaves your machine.

### Step 2 — Paste the job description
Copy the full job description from LinkedIn, Greenhouse, Lever, or any job board. The more detail you include, the better the targeting.

### Step 3 — Score your bullets
The tool generates a prompt. Copy it → open [chat.openai.com](https://chat.openai.com) → paste → send. ChatGPT returns a JSON object scoring every bullet in your resume 0–10 for relevance to this role.

### Step 4 — Generate improvements
Paste ChatGPT's response back. The tool identifies your weakest bullets and generates a second prompt. Repeat the copy-paste with ChatGPT.

### Step 5 — Confirm new skills
For any skill the AI wants to add that isn't already in your resume, you get a confirmation dialog. Only approve what you can genuinely defend in an interview.

### Step 6 — Review and download
See exactly what changes before anything is applied. Toggle off swaps you don't want. Edit any generated bullet inline. When you're happy, click **Apply & Download** — your tailored DOCX downloads instantly.

---

## Project structure

```
resume-tailor/
├── server/                    # Python FastAPI — DOCX processing
│   ├── main.py                # API server (localhost:7842)
│   ├── docx_engine.py         # DOCX parsing, swap engine, bold preservation
│   └── requirements.txt
│
├── src/                       # React web app — ChatGPT bridge
│   ├── pages/
│   │   ├── Landing.tsx        # Landing page
│   │   └── App.tsx            # Full tailoring tool (all steps)
│   ├── lib/
│   │   ├── prompts.ts         # ChatGPT prompt templates
│   │   └── storage.ts         # Session persistence (localStorage)
│   └── styles/
│       ├── global.css         # CSS variables, resets
│       ├── landing.css        # Landing page styles
│       └── app.css            # App tool styles
│
├── index.html
├── package.json               # Frontend scripts (dev/build/preview)
├── vite.config.ts             # Vite config (localhost:3001)
│
└── start.sh                   # One-command startup script
```

---

## Server API

The local Python server handles all DOCX operations. It runs entirely on your machine.

| Endpoint | Method | What it does |
|---|---|---|
| `/health` | GET | Health check |
| `/extract-text` | POST | Extract plain text from DOCX (base64 input) |
| `/apply-swaps` | POST | Apply swap manifest, return modified DOCX |

The AI (ChatGPT) never receives your DOCX binary — only the extracted plain text.

---

## How bold formatting is preserved

When a new bullet is inserted, the engine:

1. Scans every bold run in your existing resume to build a **bold vocabulary** (e.g. `Python`, `AWS`, `Docker`)
2. Splits the new bullet text into segments
3. Bolds any segment matching the vocabulary
4. Falls back to bolding CamelCase and ALL-CAPS tech terms not already in the vocabulary

Result: if your resume had `**Python**` and `**AWS**` bolded, new bullets mentioning those terms will automatically bold them.

---

## Privacy

- Your resume is stored in your **browser's localStorage** — never sent to any server except `localhost`
- The DOCX binary is processed locally by the Python server — never uploaded to any cloud
- ChatGPT receives only **plain text** (resume text + job description) — no file upload
- No analytics, no tracking, no accounts

---

## Troubleshooting

**Run all checks**
```bash
npm run verify
```

**Server not running (red indicator in the app)**
```bash
cd server && source .venv/bin/activate && python main.py
```

**Run backend tests**
```bash
cd server
pytest
```

**ChatGPT returns text instead of JSON**
Add this to the end of the prompt before sending:
> "Return only the JSON object with no explanation, no markdown, no code fences."

**Formatting changed after download**
The server validates bullet count before and after every swap. If the count changes, the swap is rejected. If you see formatting issues, check if your DOCX uses tables for the experience section — these need special handling.

**Page goes back to start after closing popup**  
Session state is saved to localStorage. Reopening the tab restores exactly where you were.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Routing | React Router v6 |
| Local server | FastAPI (Python) |
| DOCX engine | python-docx |
| AI | ChatGPT Plus (via copy-paste bridge) |
| Storage | localStorage (session), no database |

---

## Contributing

This is a personal tool built for solo use. If you fork it and make improvements — especially to the DOCX engine's formatting preservation — PRs are welcome.

---

## License

MIT — use it, fork it, improve it.
