"use client";

import { useState } from "react";
import type { BacktestResult, Experiment } from "@/types/experiment";

type Stage = "ask" | "clarify" | "test" | "learn";

function display(value: string | null | undefined): string {
  return value && value.trim() ? value : "Not specified";
}

function formatWinRate(winRate: number): string {
  return `${(winRate * 100).toFixed(1)}%`;
}

function formatReturn(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-neutral-200 p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <span className="text-xl font-semibold text-neutral-900">{value}</span>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}

function ExperimentSummary({ experiment }: { experiment: Experiment }) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <SummaryRow label="Instrument" value={display(experiment.instrument)} />
      <SummaryRow label="Timeframe" value={display(experiment.timeframe)} />
      <SummaryRow label="Entry" value={display(experiment.entryCondition)} />
      <SummaryRow label="Exit" value={display(experiment.exitCondition)} />
      <SummaryRow
        label="Holding period"
        value={display(experiment.holdingPeriod)}
      />
      <SummaryRow
        label="Filters"
        value={
          experiment.filters.length > 0
            ? experiment.filters.join(", ")
            : "None specified"
        }
      />
    </dl>
  );
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("ask");
  const [question, setQuestion] = useState("");
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setExperiment(data.experiment);
      setAnswers({});
      setStage(data.experiment.missingFields.length > 0 ? "clarify" : "test");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleClarify() {
    if (!experiment) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalQuestion: question,
          experiment,
          answers,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setExperiment(data.experiment);
      setStage("test");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRunTest() {
    if (!experiment) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experiment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setTestResult(data);
      setStage("learn");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function startOver() {
    setStage("ask");
    setQuestion("");
    setExperiment(null);
    setAnswers({});
    setTestResult(null);
    setError(null);
  }

  return (
    <main className="flex min-h-screen flex-col items-center px-6 py-16 font-[family-name:var(--font-geist-sans)]">
      <div className="w-full max-w-2xl">
        <h1 className="mb-8 text-2xl font-semibold text-neutral-900">
          Trading Research Assistant
        </h1>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {stage === "ask" && (
          <div className="flex flex-col gap-6">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={loading}
              placeholder="e.g. Does buying NIFTY after a 1% fall work better during high-volatility periods?"
              rows={6}
              className="w-full rounded-md border border-neutral-300 px-4 py-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
            />
            <div>
              <button
                onClick={handleAnalyze}
                disabled={loading || !question.trim()}
                className="flex items-center gap-2 rounded-md bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <Spinner />
                    Analyzing...
                  </>
                ) : (
                  "Analyze"
                )}
              </button>
            </div>
          </div>
        )}

        {stage === "clarify" && experiment && (
          <div className="flex flex-col gap-8">
            <section>
              <h2 className="mb-3 text-lg font-semibold text-neutral-800">
                Draft experiment
              </h2>
              <ExperimentSummary experiment={experiment} />
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-neutral-800">
                A few clarifications
              </h2>
              {experiment.clarifyingQuestions.map((q, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <label className="text-sm text-neutral-700">{q}</label>
                  <input
                    value={answers[q] ?? ""}
                    onChange={(e) =>
                      setAnswers({ ...answers, [q]: e.target.value })
                    }
                    disabled={loading}
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
              ))}
              <div>
                <button
                  onClick={handleClarify}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-md bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  {loading ? (
                    <>
                      <Spinner />
                      Submitting...
                    </>
                  ) : (
                    "Submit answers"
                  )}
                </button>
              </div>
            </section>
          </div>
        )}

        {stage === "test" && experiment && (
          <div className="flex flex-col gap-8">
            <section>
              <h2 className="mb-3 text-lg font-semibold text-neutral-800">
                Experiment ready
              </h2>
              <ExperimentSummary experiment={experiment} />
            </section>
            <div>
              <button
                onClick={handleRunTest}
                disabled={loading}
                className="flex items-center gap-2 rounded-md bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <Spinner />
                    Running test...
                  </>
                ) : (
                  "Run test"
                )}
              </button>
            </div>
          </div>
        )}

        {stage === "learn" && experiment && testResult && (
          <div className="flex flex-col gap-10">
            <section>
              <p className="text-sm text-neutral-500">Research question</p>
              <h2 className="mt-1 text-xl font-semibold text-neutral-900">
                {experiment.researchQuestion}
              </h2>
              <div className="mt-4">
                <ExperimentSummary experiment={experiment} />
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-neutral-800">
                Backtest results
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <StatCard
                  label="Win rate"
                  value={formatWinRate(testResult.stats.winRate)}
                />
                <StatCard
                  label="Avg return"
                  value={formatReturn(testResult.stats.averageReturn)}
                />
                <StatCard
                  label="Trades"
                  value={String(testResult.stats.tradeCount)}
                />
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                What the data shows
              </p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-800">
                {testResult.whatDataShows}
              </p>
            </section>

            <section className="rounded-md border border-neutral-200 border-l-4 border-l-amber-500 bg-amber-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                What we can reasonably conclude
              </p>
              <p className="mt-1 text-xs text-amber-600">
                System interpretation — based on the simulated numbers, not a
                factual result.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-800">
                {testResult.whatWeConclude}
              </p>
            </section>

            <div>
              <button
                onClick={startOver}
                className="rounded-md border border-neutral-300 px-6 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-100"
              >
                Start over
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}