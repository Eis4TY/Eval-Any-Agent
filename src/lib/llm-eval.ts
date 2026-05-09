import OpenAI from "openai";
import { z } from "zod";

const evaluationResponseSchema = z.object({
  score: z.number(),
  reason: z.string(),
  passed: z.boolean(),
});

export type EvaluateByLlmInput = {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
};

export type EvaluateByLlmOutput = z.infer<typeof evaluationResponseSchema> & {
  rawResponse: string;
};

function extractJsonObject(text: string) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

export async function evaluateByLlm(input: EvaluateByLlmInput): Promise<EvaluateByLlmOutput> {
  const client = new OpenAI({
    apiKey: input.apiKey,
    baseURL: input.baseUrl,
    timeout: input.timeoutMs ?? 60000,
  });

  const completion = await client.chat.completions.create({
    model: input.model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt },
    ],
  });

  const rawResponse = completion.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(extractJsonObject(rawResponse));
  const result = evaluationResponseSchema.parse(parsed);

  return {
    ...result,
    rawResponse,
  };
}
