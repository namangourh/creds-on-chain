import OpenAI from "openai";
import { SkillReport } from "../types";

let client: OpenAI;
function getClient(): OpenAI {
  // Lazily initialize once so retries reuse the same configured SDK client.
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

const RESUME_PROMPT = `You are a technical recruiter. Extract the candidate's key skills and a brief experience summary from this resume text.
Output ONLY valid JSON with no markdown: { "skills": ["skill1", "skill2"], "summary": "...", "score": <0-100> }`;

const GITHUB_PROMPT = `Given this GitHub profile information (repos, languages, bio), list the person's top programming skills and a one-sentence summary of their expertise.
Output ONLY valid JSON with no markdown: { "skills": ["skill1", "skill2"], "summary": "...", "score": <0-100> }`;

const RETRY_SUFFIX =
  "\n\nImportant: your entire response must be a single valid JSON object with no surrounding text, no markdown, no code fences.";

function parseSkillReport(raw: string): SkillReport | null {
  try {
    const parsed = JSON.parse(raw.trim());
    if (
      Array.isArray(parsed.skills) &&
      typeof parsed.summary === "string" &&
      typeof parsed.score === "number" &&
      parsed.score >= 0 &&
      parsed.score <= 100
    ) {
      return {
        // Force string coercion so downstream UI code does not break on mixed primitive arrays.
        skills: parsed.skills.map(String),
        summary: parsed.summary,
        score: Math.round(parsed.score),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function analyzeText(
  text: string,
  type: "resume" | "github"
): Promise<SkillReport> {
  const userPrompt = type === "resume" ? RESUME_PROMPT : GITHUB_PROMPT;

  const callApi = async (prompt: string): Promise<string> => {
    try {
      const response = await getClient().chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You output only valid JSON. No markdown, no explanation, no code fences.",
          },
          {
            role: "user",
            content: `${prompt}\n\n${text}`,
          },
        ],
      });
      return response.choices[0]?.message?.content ?? "";
    } catch (e: any) {
      console.error("[aiAnalyzer] OpenAI error:", e?.status, e?.message, e?.error);
      const err = new Error(`AI analysis service unavailable: ${e?.message}`) as Error & { statusCode: number };
      err.statusCode = 502;
      throw err;
    }
  };

  // First attempt
  const raw = await callApi(userPrompt);
  let report = parseSkillReport(raw);

  if (!report) {
    // Retry once with explicit format reminder
    // One retry keeps UX resilient while avoiding runaway token costs.
    const raw2 = await callApi(userPrompt + RETRY_SUFFIX);
    report = parseSkillReport(raw2);
  }

  if (!report) {
    const err = new Error("AI returned an invalid response format.") as Error & { statusCode: number };
    err.statusCode = 502;
    throw err;
  }

  return report;
}
