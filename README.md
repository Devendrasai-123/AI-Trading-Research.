# Trading Research Assistant

A single-page app that turns a natural-language trading idea into a structured, testable experiment — then runs a mock backtest and shows you both the raw numbers and what can reasonably be concluded from them.

## Architecture

The app is a four-state client flow backed by three serverless API routes. All state lives in React (`useState`); there is no routing or page navigation.

```
ASK ──(/api/analyze)──▶ CLARIFY ──(/api/clarify)──▶ TEST ──(/api/test)──▶ LEARN
                         │                                                    │
          (if missingFields > 0)                                  (data vs. conclusion)
                         ▼
                      RESULT ────────────────▶ (missingFields empty → TEST directly)
```

- **ASK** — user types a research question in plain language.
- **CLARIFY** — if the LLM flagged ambiguous/missing fields, the partially-filled experiment is shown read-only alongside one input per clarifying question.
- **TEST** — the finalized experiment is shown and the user can run a mock backtest.
- **LEARN** — final screen: research question, experiment summary, backtest stats, a strictly factual "What the data shows" section, and a clearly-labeled "What we can reasonably conclude" section (system inference).

### Key files

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Four-state UI (client component) |
| `app/api/analyze/route.ts` | Question → Experiment JSON, persisted to Supabase |
| `app/api/clarify/route.ts` | Merges answers into the experiment, updates the Supabase row |
| `app/api/test/route.ts` | Seeded mock backtest + LLM-generated data/conclusion paragraphs |
| `lib/llm.ts` | `callLLM` (OpenAI SDK) and `extractExperiment` (structured extraction with retry) |
| `lib/supabase.ts` | Supabase client factory (lazy init) |
| `types/experiment.ts` | `Experiment`, `ExperimentResult`, `BacktestResult` types |
| `supabase/schema.sql` | DDL for the `experiments` table |

## Tech stack

- **Next.js 14** (App Router, React 18, TypeScript)
- **Tailwind CSS** for styling (no component library)
- **Supabase** (`@supabase/supabase-js`) for persistence — single `experiments` table with a `jsonb` column
- **OpenAI SDK** (`openai`) configured with a custom `baseURL`, so it can point at any OpenAI-compatible LLM provider (OpenRouter, Ollama, etc.)

## AI tools used

- One LLM call per route, all provider-agnostic via `lib/llm.ts`:
  - **`extractExperiment(question)`** — structured extraction of `instrument`, `timeframe`, `entryCondition`, `exitCondition`, `holdingPeriod`, `filters`, `researchQuestion`, plus `missingFields` / `clarifyingQuestions` and a 0–1 `confidence`. The prompt forbids inventing specifics (e.g. it must flag vague terms like "sharp fall" as missing rather than assuming a percentage). On JSON parse failure it retries once with a stricter instruction.
  - **`/api/clarify`** — re-invokes `extractExperiment` with the original experiment and Q/A pairs appended, asking it to merge answers and update `missingFields` / `clarifyingQuestions`.
  - **`/api/test`** — one call that takes the mock stats + experiment and writes the factual "what the data shows" paragraph and the hedged "what we can reasonably conclude" paragraph as separate JSON fields.

## How to run locally

Prerequisites: Node.js 18.17+ and npm.

```bash
npm install
cp .env.local.example .env.local   # then fill in real values
```

Create the database table in the Supabase SQL editor (or via `supabase db push` with the schema in `supabase/schema.sql`):

```sql
create extension if not exists "pgcrypto";

create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  experiment jsonb not null,
  created_at timestamptz not null default now()
);
```

Then start the dev server:

```bash
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable | Description |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `LLM_API_KEY` | API key for your LLM provider |
| `LLM_BASE_URL` | OpenAI-compatible base URL, e.g. `https://api.openai.com/v1` or a local Ollama endpoint |
| `LLM_MODEL` | Model name (optional; defaults to `gpt-4o-mini`) |

### Deploying to Vercel

1. Push the repo to GitHub and import it in Vercel (Next.js is auto-detected).
2. Add the five environment variables in the Vercel project settings.
3. Ensure the Supabase table exists and the provided anon key has insert/select/update grants on `public.experiments`.

## Key design decisions

- **LLM as a structured extractor, not a chatbot.** The app's job is turning free text into a fixed schema, so prompts demand raw JSON and the responses are parsed and typed. Vague wording is deliberately surfaced as `missingFields` + `clarifyingQuestions` instead of being silently fixed.
- **Explicit data vs. conclusion separation.** The LEARN screen renders "What the data shows" and "What we can reasonably conclude" as visually distinct sections (neutral vs. amber, with the conclusion labeled as system interpretation). This keeps factual output separate from AI inference — intentional because that distinction matters for how the results are graded and trusted.
- **Server-only code stays server-side.** `lib/llm.ts` and `lib/supabase.ts` are guarded with `import "server-only"`, so the OpenAI SDK and Supabase client can never leak into a client bundle. The client only imports the type definitions.
- **Seeded, deterministic mock data.** Trades are generated from a seeded PRNG hashed from the instrument name, so results are reproducible per instrument and scaled to look plausible (indexes drift less than crypto). The endpoint never touches real market data.
- **Env vars only through `process.env`.** No hardcoded secrets; every variable is read via `process.env` and documented in `.env.local.example`.
- **Resilient JSON handling.** LLM responses are fenced-JSON tolerant and re-requested once if parsing fails; `/api/test` falls back to a factual template if the interpretation call is unparsable.
- **Flat schema + `jsonb`.** The experiment evolves fast, so it's stored as a validated-at-the-edge JSON blob rather than a rigid relational layout. The `id` returned by Postgres is the canonical row key; existing rows are matched by `question` when updating.

## What I'd improve with more time

- **Real data and a real backtest engine.** Replace the seeded mock trades with actual price data (e.g. Supabase's ticker/OHLCV integrations or a vendor feed) and a proper event-driven backtester with slippage, fees, and drawdown tracking.
- **Schema validation.** Validate LLM output with Zod and re-prompt on schema violations instead of only catching `JSON.parse` errors.
- **Streaming responses.** Stream the extraction and interpretation tokens to the UI (OpenAI SDK + Vercel AI SDK) instead of blocking on a full round trip.
- **Store backtest runs in their own table** (`experiment_id` FK → `experiments`), so a question can have many test runs and a history view.
- **Edge runtime.** Move route handlers to `runtime = "edge"` once the provider SDK's runtime story is confirmed, for lower cold-start latency.
- **Observability.** Add structured logging / OpenTelemetry for LLM calls (cost, latency, parse failures) so prompt regressions are visible.
- **Tests.** Unit tests for the seeding and aggregation math, and integration tests for the API routes with a mocked LLM.
- **Auth & multi-tenancy.** The project intentionally has no auth; adding Supabase Auth would let users keep private experiment histories.
- **Better UX.** Edit-or-confirm step for extracted fields, a trade detail table in LEARN, and a comparison view across multiple experiments.