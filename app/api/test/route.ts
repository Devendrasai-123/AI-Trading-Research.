import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import type {
  BacktestResult,
  BacktestStats,
  BacktestTrade,
  Experiment,
} from "@/types/experiment";

const TRADE_COUNT = 20;

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function instrumentProfile(instrument: string | null): {
  drift: number;
  sigma: number;
} {
  const name = (instrument ?? "").toLowerCase();
  const is = (re: RegExp) => re.test(name);
  if (is(/nifty|sensex|spy|qqq|dax|cac|nikkei|s&p|\bindex\b/))
    return { drift: 0.5, sigma: 1.1 };
  if (is(/btc|bitcoin|eth|crypto/)) return { drift: 2.5, sigma: 4.5 };
  if (is(/gold|silver|xau|xag/)) return { drift: 0.3, sigma: 0.8 };
  return { drift: 1.0, sigma: 2.2 };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function generateTrades(experiment: Experiment): BacktestTrade[] {
  const rand = mulberry32(
    hashSeed(experiment.instrument ?? experiment.researchQuestion),
  );
  const { drift, sigma } = instrumentProfile(experiment.instrument);
  const symbol = experiment.instrument ?? "Unknown";
  const trades: BacktestTrade[] = [];

  for (let i = 0; i < TRADE_COUNT; i++) {
    let sum = 0;
    for (let j = 0; j < 6; j++) sum += rand();
    const returnPct = round2(drift + sigma * (sum - 3));
    const entryDaysAgo = 10 + Math.floor(rand() * 690);
    const holdDays = 1 + Math.floor(rand() * Math.min(15, entryDaysAgo));
    trades.push({
      id: i + 1,
      symbol,
      entryDate: isoDaysAgo(entryDaysAgo),
      exitDate: isoDaysAgo(entryDaysAgo - holdDays),
      returnPct,
    });
  }

  return trades;
}

function aggregate(trades: BacktestTrade[]): BacktestStats {
  const wins = trades.filter((t) => t.returnPct > 0).length;
  const total = trades.reduce((sum, t) => sum + t.returnPct, 0);
  return {
    winRate: round2(wins / trades.length),
    averageReturn: round2(total / trades.length),
    tradeCount: trades.length,
  };
}

async function summarize(
  experiment: Experiment,
  stats: BacktestStats,
): Promise<{ whatDataShows: string; whatWeConclude: string }> {
  const prompt = `A mock backtest of a trading strategy produced these numbers:
- instrument: ${experiment.instrument ?? "unspecified"}
- timeframe: ${experiment.timeframe ?? "unspecified"}
- research question: ${experiment.researchQuestion}
- trade count: ${stats.tradeCount}
- win rate: ${(stats.winRate * 100).toFixed(1)}%
- average return per trade: ${stats.averageReturn}%

Write two distinct short paragraphs. Respond ONLY as JSON:
{"whatDataShows": "...", "whatWeConclude": "..."}

- whatDataShows: strictly factual description of these numbers only. No interpretation, no causal claims.
- whatWeConclude: the system's interpretation of what the numbers might suggest for the strategy. Clearly hedged, and note that the sample is small and simulated, so it is not evidence of future performance.`;

  const raw = await callLLM(prompt);
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = (fenced ? fenced[1] : raw).trim();

  try {
    const parsed = JSON.parse(src);
    return {
      whatDataShows: String(parsed.whatDataShows ?? ""),
      whatWeConclude: String(parsed.whatWeConclude ?? ""),
    };
  } catch {
    return {
      whatDataShows: `Across ${stats.tradeCount} simulated trades, ${(stats.winRate * 100).toFixed(1)}% closed positive and the average return per trade was ${stats.averageReturn}%.`,
      whatWeConclude:
        "These simulated numbers are illustrative only and come from a small sample, so they cannot be taken as evidence of real future performance.",
    };
  }
}

export async function POST(request: NextRequest) {
  let experimentBody: unknown;

  try {
    const body = await request.json();
    experimentBody = body?.experiment;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!experimentBody || typeof experimentBody !== "object") {
    return NextResponse.json(
      { error: "experiment is required" },
      { status: 400 },
    );
  }

  const experiment = experimentBody as Experiment;
  const trades = generateTrades(experiment);
  const stats = aggregate(trades);

  let interpretation: { whatDataShows: string; whatWeConclude: string };
  try {
    interpretation = await summarize(experiment, stats);
  } catch (err) {
    console.error("failed to interpret backtest results", err);
    return NextResponse.json(
      { error: "failed to interpret results" },
      { status: 502 },
    );
  }

  const result: BacktestResult = {
    trades,
    stats,
    whatDataShows: interpretation.whatDataShows,
    whatWeConclude: interpretation.whatWeConclude,
  };

  return NextResponse.json(result);
}