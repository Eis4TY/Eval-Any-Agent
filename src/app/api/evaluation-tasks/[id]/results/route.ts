import { requireSession } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { parseJson } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const PAGE_SIZES = [10, 20, 50, 100, 150];

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const requestedPageSize = Number(url.searchParams.get("pageSize") || 50);
    const pageSize = PAGE_SIZES.includes(requestedPageSize) ? requestedPageSize : 50;
    const q = (url.searchParams.get("q") || "").trim();
    const status = (url.searchParams.get("status") || "").trim();
    const passed = (url.searchParams.get("passed") || "").trim();

    const task = await prisma.evaluationTask.findFirst({
      where: { id, userId: session.uid },
    });
    if (!task) return fail("评估任务不存在", 404);

    const where: Prisma.EvaluationResultWhereInput = { evaluationTaskId: id };
    if (status && status !== "all") {
      where.status = status;
    }
    if (passed === "true") {
      where.passed = true;
    } else if (passed === "false") {
      where.passed = false;
    } else if (passed === "null") {
      where.passed = null;
    }
    if (q) {
      const rowIndex = Number(q);
      where.AND = [
        {
          OR: [
            Number.isFinite(rowIndex) ? { rowIndex } : undefined,
            { status: { contains: q } },
            { reason: { contains: q } },
            { errorType: { contains: q } },
            { errorMessage: { contains: q } },
            { rawResponse: { contains: q } },
            { promptSnapshot: { contains: q } },
            { sourceResult: { inputData: { contains: q } } },
            { sourceResult: { outputs: { contains: q } } },
          ].filter(Boolean) as Prisma.EvaluationResultWhereInput[],
        },
      ];
    }

    const [total, rows, scoreAgg, passedCount] = await Promise.all([
      prisma.evaluationResult.count({ where }),
      prisma.evaluationResult.findMany({
        where,
        orderBy: { rowIndex: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          sourceResult: true,
        },
      }),
      prisma.evaluationResult.aggregate({
        where: { ...where, status: "success", score: { not: null } },
        _avg: { score: true },
      }),
      prisma.evaluationResult.count({
        where: { ...where, status: "success", passed: true },
      }),
    ]);

    const successCount = await prisma.evaluationResult.count({
      where: { ...where, status: "success" },
    });

    return ok({
      total,
      page,
      pageSize,
      avgScore: scoreAgg._avg.score ?? null,
      passRate: successCount > 0 ? passedCount / successCount : 0,
      successCount,
      rows: rows.map((row) => ({
        ...row,
        promptSnapshot: parseJson(row.promptSnapshot, row.promptSnapshot),
        sourceOutputs: parseJson(row.sourceResult.outputs, {}),
        sourceInput: parseJson(row.sourceResult.inputData, {}),
      })),
    });
  } catch {
    return fail("查询评估结果失败", 500);
  }
}
