import { requireSession } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { parseJson } from "@/lib/json";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") || 1);
    const pageSize = Number(url.searchParams.get("pageSize") || 20);
    const order = url.searchParams.get("order") === "desc" ? "desc" : "asc";

    const task = await prisma.evalTask.findFirst({ where: { id, userId: session.uid } });
    if (!task) return fail("任务不存在", 404);

    const [total, rows, ttftAgg] = await Promise.all([
      prisma.evalResult.count({ where: { taskId: id } }),
      prisma.evalResult.findMany({
        where: { taskId: id },
        orderBy: { rowIndex: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.evalResult.aggregate({
        where: { taskId: id, ttftMs: { not: null } },
        _avg: { ttftMs: true },
      }),
    ]);

    return ok({
      total,
      page,
      pageSize,
      avgTtftMs: ttftAgg._avg.ttftMs ?? null,
      rows: rows.map((row) => ({
        ...row,
        inputData: parseJson(row.inputData, {}),
        requestPayload: parseJson(row.requestPayload, {}),
        outputs: parseJson(row.outputs, {}),
        rawTrace: parseJson(row.rawTrace, []),
      })),
    });
  } catch {
    return fail("查询失败", 500);
  }
}
