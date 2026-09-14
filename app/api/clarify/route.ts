import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { extractExperiment } from "@/lib/llm";
import type { Experiment } from "@/types/experiment";

export async function POST(request: NextRequest) {
  let body: { [key: string]: unknown } | null = null;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const originalQuestion = body?.originalQuestion;
  const experimentBody = body?.experiment;
  const answers = body?.answers;

  if (
    typeof originalQuestion !== "string" ||
    !experimentBody ||
    typeof experimentBody !== "object" ||
    typeof answers !== "object" ||
    answers === null
  ) {
    return NextResponse.json(
      { error: "originalQuestion, experiment, and answers are required" },
      { status: 400 },
    );
  }

  const experiment = experimentBody as Experiment;
  const answerMap = answers as Record<string, string>;

  const answerLines = Object.entries(answerMap)
    .map(([q, a]) => `- ${q}: ${a}`)
    .join("\n");

  let updated: Experiment;
  try {
    updated = await extractExperiment(
      `${originalQuestion}\n\nExisting experiment:\n${JSON.stringify(experiment, null, 2)}\n\nUser answers to clarifying questions:\n${answerLines}\n\nMerge these answers into the experiment, updating missingFields and clarifyingQuestions accordingly, and return the updated experiment JSON per the schema.`,
    );
  } catch (err) {
    console.error("failed to update experiment via LLM", err);
    return NextResponse.json(
      { error: "failed to update experiment" },
      { status: 502 },
    );
  }

  let rowId: string | undefined;
  try {
    const { data: rows } = await getSupabase()
      .from("experiments")
      .select("id")
      .eq("question", originalQuestion)
      .order("created_at", { ascending: false })
      .limit(1);
    if (rows) rowId = rows[0]?.id;
  } catch (err) {
    console.error("failed to look up experiment", err);
    return NextResponse.json(
      { error: "failed to look up experiment" },
      { status: 500 },
    );
  }

  if (!rowId) {
    return NextResponse.json(
      { error: "no matching experiment found" },
      { status: 404 },
    );
  }

  try {
    const { error } = await getSupabase()
      .from("experiments")
      .update({ experiment: updated })
      .eq("id", rowId);
    if (error) throw error;
  } catch (err) {
    console.error("failed to update experiment row", err);
    return NextResponse.json(
      { error: "failed to update experiment" },
      { status: 500 },
    );
  }

  return NextResponse.json({ experiment: updated });
}