import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function ConfigCenterHelpPage() {
  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <Button asChild variant="outline">
            <Link href="/dashboard">← 返回控制台</Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>配置中心帮助文档</CardTitle>
            <CardDescription>说明如何在配置中心完成请求配置、动态变量与结束规则设置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Accordion type="multiple" defaultValue={["basic", "header", "dynamic", "extract", "done"]}>
              <AccordionItem value="basic">
                <AccordionTrigger>1. 基础配置流程</AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm leading-6">
                  <p>1) 先上传数据集（CSV/XLSX），确保字段名正确。</p>
                  <p>2) 在配置中心选择数据集，填写配置名称与上游 API 地址。</p>
                  <p>3) 设置请求体模板 <code>requestTemplate</code>，使用 <code>{"{{占位符}}"}</code> 绑定数据集字段。</p>
                  <p>4) 设置 `input_bindings`，将占位符映射到数据集列。</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="header">
                <AccordionTrigger>2. 自定义 Header 配置</AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm leading-6">
                  <p>Header 使用 JSON 格式，例如：</p>
                  <pre className="rounded border bg-muted p-3 text-xs">
                    {`{
  "Content-Type": "application/json",
  "Authorization": "Bearer {{token}}",
  "X-Trace-Id": "{{$string.uuid}}"
}`}
                  </pre>
                  <p>其中 <code>{"{{token}}"}</code> 可来自 <code>input_bindings</code>，动态值也可直接写在 Header 中。</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="dynamic">
                <AccordionTrigger>3. 动态值配置（每条请求重新生成）</AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm leading-6">
                  <p>支持在请求体模板和 Header 中使用：</p>
                  <p>- <code>{"{{$string.uuid}}"}</code>：生成 UUID</p>
                  <p>- <code>{"{{$date.now}}"}</code>：生成当前 ISO 时间</p>
                  <p>示例：</p>
                  <pre className="rounded border bg-muted p-3 text-xs">
                    {`{
  "requestId": "{{$string.uuid}}",
  "requestTime": "{{$date.now}}",
  "msg": "{{msg}}"
}`}
                  </pre>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="extract">
                <AccordionTrigger>4. 提取规则 extract_rules</AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm leading-6">
                  <p>通过 JSONPath 提取返回字段，例如：</p>
                  <pre className="rounded border bg-muted p-3 text-xs">
                    {`[
  { "key": "text", "path": "$.text" },
  { "key": "thinking", "path": "$.thinkcontent" }
]`}
                  </pre>
                  <p>`key` 会成为结果页面和导出文件中的动态列名。</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="done">
                <AccordionTrigger>5. 结束信号 done_rules 与 done_required</AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm leading-6">
                  <p>常用结束规则：</p>
                  <p>- `sentinel_text`：如 `[DONE]`</p>
                  <p>- `json_path_equals`：如 `$.type == 2`</p>
                  <p>- `max_idle_ms`：长时间无数据即结束</p>
                  <p>若开启 `done_required`，未命中显式规则时会标记 `END_SIGNAL_MISSING`。</p>
                  <p>建议先使用 Dry Run 验证 `endReason` 和 `ruleHit` 是否符合预期。</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
