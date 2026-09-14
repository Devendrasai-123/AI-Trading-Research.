import "server-only";
import OpenAI from "openai";
import type { Experiment } from "@/types/experiment";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!process.env.LLM_API_KEY && !process.env.LLM_BASE_URL) {
      throw new Error(
        "LLM_API_KEY and/or LLM_BASE_URL environment variables are required",
      );
    }
    client = new OpenAI({
      apiKey: process.env.LLM_API_KEY ?? "not-set",
      baseURL: process.env.LLM_BASE_URL,
    });
  }
  return client;
}

export async function callLLM(prompt: string): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: process.env.LLM_MODEL ?? "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 4096,
  }, { timeout: 8000 });

  return response.choices[0]?.message.content ?? "";
}

export function buildFallbackExperiment(question: string): Experiment {
  const lowerQuestion = question.toLowerCase();
  const instrumentMatch = question.match(
    /\b(nifty|sensex|bitcoin|btc|ethereum|eth|gold|silver|spy|qqq)\b/i,
  );
  const timeframeMatch = question.match(
    /\b(daily|day|weekly|week|monthly|month|intraday|hourly|hour)\b/i,
  );
  const hasEntry = /\b(buy|buying|enter|entry|long)\b/i.test(question);

  return {
    instrument: instrumentMatch?.[1]?.toUpperCase() ?? null,
    timeframe: timeframeMatch?.[1] ?? null,
    entryCondition: hasEntry ? question.trim() : null,
    exitCondition: null,
    holdingPeriod: null,
    filters: /volatility|volatile/i.test(question)
      ? ["high-volatility periods"]
      : [],
    researchQuestion: question.trim(),
    missingFields: ["exitCondition", "holdingPeriod"],
    clarifyingQuestions: [
      "What exit condition should be used?",
      "How long should each position be held?",
    ],
    confidence: lowerQuestion.length > 20 ? 0.35 : 0.2,
  };
}

const EXTRACT_SYSTEM_PROMPT = `You are a quantitative research assistant. A user will ask a natural-language question about a trading strategy. Your job is to extract a structured experiment from it.

Extract: instrument, timeframe, entry condition, exit condition, holding period, filters/variables, and the core research question being asked.

Rules:
- Only fill in a field if the user's wording supports it. Do not invent specifics like exact percentages or exact holding periods unless stated.
- If a field is missing or ambiguous (e.g. no exit condition, no holding period, vague terms like 'sharp fall' or 'better'), add it to missingFields and generate one short, specific clarifying question for it in clarifyingQuestions.
- 'Sharp fall' or similar vague terms should ALWAYS be flagged as missing/ambiguous — do not silently assume a percentage.
- Output valid JSON only, matching this exact schema: { instrument, timeframe, entryCondition, exitCondition, holdingPeriod, filters, researchQuestion, missingFields, clarifyingQuestions, confidence }
- confidence is 0-1, reflecting how complete/unambiguous the question was.

Return ONLY the JSON object, no markdown fences, no explanation.`;

export async function extractExperiment(question: string): Promise<Experiment> {
  let raw = await callLLM(`${EXTRACT_SYSTEM_PROMPT}\n\nQuestion: ${question}`);

  try {
    return JSON.parse(raw) as Experiment;
  } catch {
    raw = await callLLM(
      `${EXTRACT_SYSTEM_PROMPT}\n\nQuestion: ${question}\n\nStrictly output only the raw JSON object. No markdown fences, no explanation.`,
    );
    return JSON.parse(raw) as Experiment;
  }
}