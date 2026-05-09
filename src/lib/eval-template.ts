import Mustache from "mustache";
import { parseJson } from "@/lib/json";

export type EvaluationTemplateContext = {
  input: Record<string, unknown>;
  outputs: Record<string, unknown>;
  result: {
    status: string;
    ttftMs: number | null;
    latencyMs: number | null;
    errorType: string | null;
    errorMessage: string | null;
    endReason: string | null;
    ruleHit: string | null;
  };
  reference_output: string;
};

export function buildEvaluationContext(sourceResult: {
  inputData: string;
  outputs: string;
  status: string;
  ttftMs: number | null;
  latencyMs: number | null;
  errorType: string | null;
  errorMessage: string | null;
  endReason: string | null;
  ruleHit: string | null;
}) {
  const input = parseJson<Record<string, unknown>>(sourceResult.inputData, {});
  const outputs = parseJson<Record<string, unknown>>(sourceResult.outputs, {});
  const referenceOutput = input.reference_output;

  const context: EvaluationTemplateContext = {
    input,
    outputs,
    result: {
      status: sourceResult.status,
      ttftMs: sourceResult.ttftMs,
      latencyMs: sourceResult.latencyMs,
      errorType: sourceResult.errorType,
      errorMessage: sourceResult.errorMessage,
      endReason: sourceResult.endReason,
      ruleHit: sourceResult.ruleHit,
    },
    reference_output: typeof referenceOutput === "string" ? referenceOutput : "",
  };

  return {
    ...input,
    ...context,
  };
}

export function renderEvaluationPrompt(template: string, variables: Record<string, unknown>) {
  return Mustache.render(template, variables);
}
