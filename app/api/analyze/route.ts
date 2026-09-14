import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { buildFallbackExperiment, extractExperiment } from "@/lib/llm";
import type { Experiment } from "@/types/experiment";

export async function POST(request: NextRequest) {
  let question: string | undefined;

  try {
    const body = await request.json();
    question = body?.question;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!question || typeof question !== "string") {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  let experiment: Experiment;
  try {
    experiment = await Promise.race([
      extractExperiment(question),
      new Promise<Experiment>((_, reject) =>
        setTimeout(() => reject(new Error("LLM analysis timed out")), 5000),
      ),
    ]);
  } catch (err) {
    console.error("failed to extract experiment", err);
    experiment = buildFallbackExperiment(question);
  }

  try {
    const save = getSupabase().from("experiments").insert({ question, experiment });
    const { error } = await Promise.race([
      save,
      new Promise<{ error: Error }>((resolve) =>
        setTimeout(() => resolve({ error: new Error("Supabase save timed out") }), 5000),
      ),
    ]);
    if (error) throw error;
  } catch (err) {
    console.error("failed to save experiment", err);
  }

  return NextResponse.json({ experiment });
}