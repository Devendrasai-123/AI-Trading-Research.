import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { extractExperiment } from "@/lib/llm";
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
    experiment = await extractExperiment(question);
  } catch (err) {
    console.error("failed to extract experiment", err);
    return NextResponse.json(
      { error: "failed to analyze question" },
      { status: 502 },
    );
  }

  try {
    const { error } = await getSupabase()
      .from("experiments")
      .insert({ question, experiment });
    if (error) throw error;
  } catch (err) {
    console.error("failed to save experiment", err);
    return NextResponse.json(
      { error: "failed to save experiment" },
      { status: 500 },
    );
  }

  return NextResponse.json({ experiment });
}