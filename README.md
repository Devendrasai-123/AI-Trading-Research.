# AI Trading Research Assistant — Mini Prototype

A small web prototype that turns a natural-language trading question into a structured, testable research experiment — and is upfront about what it doesn't know yet.

**Example input:**
> "Does buying NIFTY after a 1% fall work better during high-volatility periods?"

**What it does with it:** extracts the instrument, timeframe, entry condition, and research question — flags what's missing (exit condition, holding period), asks the user to clarify, runs a mock backtest, and separates *what the data shows* from *what the system concludes*.

---

## Live Demo

- **App:** [add your Vercel link here]
- **Repo:** [add your GitHub link here]
- **Demo video:** [add your 2–3 min recording link here]

---

## Architecture

The app follows a 4-step flow, matching how a real research process works:

```
ASK → CLARIFY → TEST → LEARN
```

| Step | What happens |
|------|--------------|
| **ASK** | User types a question in plain English. |
| **CLARIFY** | The LLM extracts a structured experiment and flags missing/ambiguous fields (e.g. no exit condition, vague terms like "sharp fall"). The user answers targeted follow-up questions instead of the system silently assuming. |
| **TEST** | The finalized experiment is run against simulated trade data (mock backtest) to demonstrate the workflow — not a production backtesting engine. |
| **LEARN** | Results are shown with a clear split between the raw numbers ("what the data shows") and the system's interpretation ("what we conclude"), plus suggested next questions. |

**Why this structure:** the assignment brief explicitly separates understanding → structuring → testing → explaining. Building it as four distinct states (rather than one big chat blob) makes each step's output inspectable and keeps the "don't blindly assume" requirement visible in the UI, not just in a prompt.

### Data flow

```
User question
   ↓
/api/analyze  → LLM extracts structured experiment + missing fields → saved to Supabase
   ↓
/api/clarify  → user answers merged into experiment → row updated
   ↓
/api/test     → mock backtest run against the finalized experiment
   ↓
UI renders: experiment card, stats, data vs. conclusion
```

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts (for trade return visualization)
- **Backend:** Next.js API routes (no separate backend server — kept the stack minimal per the assignment's "don't overbuild" guidance)
- **Database:** Supabase (Postgres) — stores each question and its structured experiment for basic persistence ("remember what it learned")
- **LLM:** [your model, e.g. `z-ai/glm-5.3-flash`] via [provider] — used for question understanding, structured extraction, and result interpretation

---

## Key Decisions

- **No login/auth.** Out of scope for a research prototype focused on the extraction/clarification logic; adding it would have traded time away from the part actually being evaluated.
- **Mock backtest, not a real one.** The brief explicitly says a production-grade backtesting engine isn't required — the goal was to demonstrate the TEST step exists and connects cleanly to the experiment definition, not to build a trading engine.
- **Ambiguous terms are always flagged, never guessed.** Words like "sharp fall" or "better" never get a silently-assumed number — the system always surfaces them as a clarifying question. This was a deliberate choice to satisfy the "handling ambiguity" evaluation criterion directly rather than relying on the LLM to happen to ask.
- **Data vs. conclusion are visually separated**, not just written as one paragraph — because conflating "what happened" with "what it means" is one of the easiest ways this kind of tool misleads a user.
- **Next.js API routes instead of a separate FastAPI backend.** Fewer moving parts to deploy and debug within the time available, while still satisfying the "APIs + LLM APIs" technical expectation.

---

## AI Tools Used

- **Claude** (chat) — used for planning the architecture, breaking the assignment into a build sequence, and reviewing/debugging issues (env var mismatches, Supabase connectivity, UI contrast problems) as they came up.
- **opencode** (with Claude) — used to generate the actual code: Next.js scaffolding, API routes, LLM extraction logic, Supabase integration, and UI components, from detailed prompts specifying exact behavior and schema.

**What I personally designed:** the 4-state flow (ASK/CLARIFY/TEST/LEARN), the rule that ambiguous terms must always be flagged rather than assumed, the experiment schema (which fields matter and why), and the decision to visually separate data from interpretation.

**What I reviewed/modified:** tested the extraction logic against multiple real and deliberately vague questions and iterated on the prompt until missing-field detection was reliable; caught and fixed a case where the LLM invented a holding period the user never specified.

---

## Setup & Run Locally

```bash
git clone <your-repo-url>
cd trading-research-assistant
npm install
cp .env.local.example .env.local
# fill in the values below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase publishable (anon) key |
| `LLM_API_KEY` | API key for the LLM provider |
| `LLM_BASE_URL` | Base URL for the LLM API |

### Database Setup

Run `supabase/schema.sql` in the Supabase SQL Editor to create the `experiments` table before first use.

---

## What I'd Improve With More Time

- Replace the mock backtest with a real historical dataset (e.g. NSE daily data) for genuine, not simulated, results.
- Add confidence scoring shown to the user, not just used internally, so they know how much to trust an extraction.
- Persist and show a user's past questions/experiments (the Supabase table supports this; the UI doesn't surface it yet).
- Add basic rate limiting on the LLM endpoints before any real public traffic.
- Expand cost/slippage assumptions in the experiment schema itself, since the "what could go wrong" risks (look-ahead bias, transaction costs) aren't currently modeled, only mentioned conceptually.

---

## Important Note

This is a small functional slice of a much larger envisioned system per the assignment brief — it is not a full trading platform and the backtest is simulated, not a production-grade engine.
