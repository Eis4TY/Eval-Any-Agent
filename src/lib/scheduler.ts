import { prisma } from "@/lib/prisma";
import { runEvalTask } from "@/lib/execution";
import { runEvaluationTask } from "@/lib/evaluation";

let started = false;
export function nextRun(s: { scheduleType: string; intervalMs?: number | null; cronExpr?: string | null }, from = new Date()) {
  if (s.scheduleType === "interval") return new Date(from.getTime() + (s.intervalMs ?? 0));
  const m = s.cronExpr?.trim().match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+([0-7]|\*)$/);
  if (!m || Number(m[1]) > 59 || Number(m[2]) > 23) throw new Error("Cron 格式仅支持：分 时 * * 星期");
  const d = new Date(from); d.setSeconds(0, 0); d.setHours(Number(m[2]), Number(m[1]), 0, 0);
  const weekday = m[3] === "*" ? null : Number(m[3]);
  do { if (d > from && (weekday === null || d.getDay() === weekday)) return d; d.setDate(d.getDate() + 1); } while (true);
}
export async function tick() {
  const now = new Date();
  for (const s of await prisma.scheduledTask.findMany({ where: { enabled: true, nextRunAt: { lte: now } } })) {
    const claimed = await prisma.scheduledTask.updateMany({ where: { id: s.id, enabled: true, nextRunAt: s.nextRunAt }, data: { lastRunAt: now, nextRunAt: nextRun(s, now) } });
    if (!claimed.count) continue;
    const task = await prisma.evalTask.create({ data: { userId: s.userId, datasetId: s.datasetId, profileId: s.profileId, status: "queued", concurrency: s.concurrency, timeoutMs: s.timeoutMs, retryCount: s.retryCount, conversationIdMode: s.conversationIdMode, conversationIdEvery: s.conversationIdEvery, totalRows: (await prisma.dataset.findUniqueOrThrow({ where: { id: s.datasetId }, select: { rowCount: true } })).rowCount } });
    runScheduledTask(task.id, s.userId).catch(console.error);
  }
}

async function runScheduledTask(taskId: string, userId: string) {
  await runEvalTask(taskId);
  const evaluator = await prisma.evaluator.findFirst({
    where: { userId, enabled: true },
    orderBy: { createdAt: "desc" },
  });
  if (!evaluator) {
    console.warn(`[scheduler] task ${taskId} completed without an enabled evaluator`);
    return;
  }
  const sourceTask = await prisma.evalTask.findUnique({ where: { id: taskId }, select: { totalRows: true } });
  if (!sourceTask) return;
  const evaluationTask = await prisma.evaluationTask.create({
    data: { userId, sourceTaskId: taskId, evaluatorId: evaluator.id, status: "queued", totalRows: sourceTask.totalRows },
  });
  await runEvaluationTask(evaluationTask.id);
}
export function startScheduler() { if (started || process.env.DISABLE_SCHEDULER === "true") return; started = true; setInterval(() => tick().catch(console.error), 30_000); tick().catch(console.error); }
