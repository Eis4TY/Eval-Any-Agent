import pLimit from "p-limit";
import { prisma } from "@/lib/prisma";
import { buildEvaluationContext, renderEvaluationPrompt } from "@/lib/eval-template";
import { evaluateByLlm } from "@/lib/llm-eval";
import { stringifyJson } from "@/lib/json";

function classifyError(error: unknown): { type: string; message: string } {
  if (error instanceof Error) {
    if (error.message.includes("timeout")) return { type: "TIMEOUT", message: error.message };
    if (error.message.includes("401")) return { type: "AUTH_ERROR", message: error.message };
    if (error.message.includes("429")) return { type: "RATE_LIMIT", message: error.message };
    if (error.message.includes("JSON")) return { type: "PARSE_ERROR", message: error.message };
    return { type: "UNKNOWN", message: error.message };
  }
  return { type: "UNKNOWN", message: String(error) };
}

async function refreshEvaluationTaskMetrics(taskId: string) {
  const results = await prisma.evaluationResult.findMany({
    where: { evaluationTaskId: taskId, status: "success", score: { not: null } },
    select: { score: true },
  });
  const avgScore = results.length
    ? results.reduce((sum, item) => sum + (item.score ?? 0), 0) / results.length
    : null;

  await prisma.evaluationTask.update({
    where: { id: taskId },
    data: {
      avgScore,
      endedAt: new Date(),
    },
  });
}

export async function runEvaluationTask(taskId: string) {
  const task = await prisma.evaluationTask.findUnique({
    where: { id: taskId },
    include: {
      evaluator: { include: { providerConfig: true } },
      sourceTask: {
        include: {
          results: {
            orderBy: { rowIndex: "asc" },
          },
        },
      },
    },
  });
  if (!task) return;

  await prisma.evaluationTask.update({
    where: { id: taskId },
    data: { status: "running", startedAt: new Date() },
  });

  const sourceResults = task.sourceTask.results;
  const runnableResults = sourceResults.filter((item) => item.status === "success" || item.status === "warning");
  const skippedResults = sourceResults.filter((item) => item.status !== "success" && item.status !== "warning");

  if (skippedResults.length > 0) {
    await prisma.evaluationResult.createMany({
      data: skippedResults.map((item) => ({
        evaluationTaskId: task.id,
        sourceResultId: item.id,
        rowIndex: item.rowIndex,
        status: "skipped",
        reason: "来源结果非 success/warning，已跳过",
        promptSnapshot: "",
      })),
    });

    await prisma.evaluationTask.update({
      where: { id: task.id },
      data: { skippedRows: { increment: skippedResults.length } },
    });
  }

  const limit = pLimit(5);

  await Promise.all(
    runnableResults.map((item) =>
      limit(async () => {
        let latest = await prisma.evaluationTask.findUnique({ where: { id: task.id }, select: { status: true } });
        if (!latest || latest.status === "stopped") return;

        while (latest.status === "paused") {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          latest = await prisma.evaluationTask.findUnique({ where: { id: task.id }, select: { status: true } });
          if (!latest || latest.status === "stopped") return;
        }

        const variables = buildEvaluationContext(item);
        const userPrompt = renderEvaluationPrompt(task.evaluator.userPromptTemplate, variables);
        const promptSnapshot = serializePromptSnapshot({
          systemPrompt: task.evaluator.systemPrompt,
          userPrompt,
        });

        try {
          const response = await evaluateByLlm({
            baseUrl: task.evaluator.providerConfig.baseUrl,
            apiKey: task.evaluator.providerConfig.apiKeyEncrypted,
            model: task.evaluator.model,
            systemPrompt: task.evaluator.systemPrompt,
            userPrompt,
            thinkingEnabled: task.evaluator.thinkingEnabled,
          });

          const scoreValid = response.score >= task.evaluator.scoreMin && response.score <= task.evaluator.scoreMax;
          if (!scoreValid) {
            throw new Error(`SCORE_OUT_OF_RANGE: ${response.score}`);
          }

          await prisma.evaluationResult.create({
            data: {
              evaluationTaskId: task.id,
              sourceResultId: item.id,
              rowIndex: item.rowIndex,
              score: response.score,
              passed: response.passed,
              reason: response.reason,
              status: "success",
              promptSnapshot,
              rawResponse: response.rawResponse,
            },
          });

          await prisma.evaluationTask.update({
            where: { id: task.id },
            data: { successRows: { increment: 1 } },
          });
        } catch (error) {
          const classified = classifyError(error);
          await prisma.evaluationResult.create({
            data: {
              evaluationTaskId: task.id,
              sourceResultId: item.id,
              rowIndex: item.rowIndex,
              status: "failed",
              errorType: classified.type,
              errorMessage: classified.message,
              promptSnapshot,
            },
          });

          await prisma.evaluationTask.update({
            where: { id: task.id },
            data: { failedRows: { increment: 1 } },
          });
        }
      }),
    ),
  );

  const finishedTask = await prisma.evaluationTask.findUnique({ where: { id: task.id }, select: { status: true } });
  await prisma.evaluationTask.update({
    where: { id: task.id },
    data: {
      status: finishedTask?.status === "stopped" ? "stopped" : "completed",
    },
  });
  await refreshEvaluationTaskMetrics(task.id);
}

export function getMaskedApiKey(apiKey: string) {
  if (!apiKey) return "";
  const visiblePrefix = apiKey.slice(0, Math.min(6, apiKey.length));
  return `${visiblePrefix}********`;
}

export function serializePromptSnapshot(payload: { systemPrompt: string; userPrompt: string }) {
  return stringifyJson(payload);
}
