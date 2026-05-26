## 项目名称：Eval-Any-Agent

## 1. 全局技术架构与底层澄清

* **框架选型**：Next.js (建议使用 App Router 以更好支持服务端并发与 API 路由)，前端组件库 shadcn/ui(https://ui.shadcn.com/llms.txt)。
* **部署架构**：Docker 容器化。建议采用 `Next.js App + 轻量级关系型数据库 (如 SQLite)` 的单体容器多进程部署方案，降低运维成本。
* **并发模型**：Node.js 环境下的异步非阻塞 I/O 非常适合此场景。技术上建议引入类似 `p-limit` 的并发控制库，而不是简单的 `Promise.all`，以防止瞬间大规模并发压垮 Node.js 内存或触发目标大模型 API 的 Rate Limit (限流)。

---

## 2. 核心模块技术拆解 (按系统架构划分)

### 模块一：数据集与动态配置中心 (Data & Config Service)

主要负责处理外部文件的解析、存储以及动态映射关系的生成。

| 功能模块 | 业务需求描述 | 研发技术实现与选型建议 |
| --- | --- | --- |
| **文件上传与解析** | 支持 Excel/CSV 上传，解析为多列数据池。持久化保存。 | 使用 `multer` 处理上传，`xlsx` 或 `papaparse` 库解析文件。持久化需落库 (存文件路径或直接存 JSON 格式入库)。 |
| **请求体模板化** | 通过 JSON/YAML 自定义请求体，支持 `{{input}}` 等占位符动态绑定。 | 引入模板引擎（如 Handlebars、Mustache 或轻量级字符串替换）。需增加 JSON 格式校验 (Schema Validation)。 |
| **动态字段绑定** | 输入表列名与请求占位符绑定；流式输出字段与结果列绑定；未绑定列透传保留。 | 抽象出一套“映射配置文件 (Mapping Profile)”。前端提供可视化拖拽或下拉框关联。 |
| **期望模型定义** | 定义 API 返回的 JSON 结构，指定提取“文本”和“工具调用”的路径。 | 使用 JSONPath 语法 (如 `$.choices[0].delta.content`) 让用户定义提取路径，后端基于 JSONPath 动态寻址取值。 |
| **单点试跑 (Dry Run)** | 绑定完 API 和字段后，提供“发送测试”按钮，模拟跑单条数据。 | **前端**：抽取数据集的第一行（或允许用户手动输入临时变量），连同当前配置一并提交给后端。
| **动态输出映射配置表** | 用户可无限添加自定义输出字段（如 `thinking`, `tool_name` 等），并为每个字段配置独立的提取规则。 | **数据结构**：摒弃硬编码的 `output` 字段，改为对象数组结构：`extract_rules: [{ key: "thinking", path: "$.choices[0].delta.reasoning_content" }, { key: "tooluse", path: "..." }]`。 |
| **多路流式提取器** | 同一个 SSE 响应流中，根据用户的多条提取规则，同时并行提取不同字段。 | **后端引擎**：在内存状态机中，循环遍历 `extract_rules`。针对包含复杂结构（如 JSON 字符串格式的工具参数）的提取，需增加一层尝试 `JSON.parse` 的容错处理，便于后续统计。 |
| **动态表头导出** | 导出的报告中，动态将提取到的自定义字段作为独立列展示。 | **后端**：`exceljs` 生成报表时，动态将 `extract_rules` 中的 `key` 注入为表头（如增加一列“thinking 耗时”或“thinking 内容”）。 |

### 模块二：并发调度与 API 通信引擎 (Execution & Request Engine)

这是整个系统的心脏，对性能和稳定性要求最高。

| 功能模块 | 业务需求描述 | 研发技术实现与选型建议 |
| --- | --- | --- |
| **并发任务分发** | 基于设定的并发数分发数据，避免阻塞。 | 采用任务队列机制 (如轻量级的 `fastq` 或原生 `AsyncIO` 限制池)，支持动态暂停、继续、终止测试。 |
| **动态请求构建** | 注入变量生成 POST 请求，支持自定义 Header。 | 基于配置中心的模板和当前行数据，动态编译生成完整 Payload，支持 Header 透传注入。 |
| **异常捕获与重试** | 捕获超时、网络错误、结构化化错误。 | 设置全局 Timeout。需区分“系统级错误”和“API业务错误”，后者应作为测试结果的一部分记录下来。 |

### 模块三：SSE 流式解析与统计分析 (Stream Parsing & Analytics)

处理大模型特有的 Server-Sent Events 流式响应，并进行数据聚合。

| 功能模块 | 业务需求描述 | 研发技术实现与选型建议 |
| --- | --- | --- |
| **流数据解析** | 实时读取 Stream 流，提取原始 JSON。 | 后端使用 `eventsource-parser` 解析标准 SSE 数据块，剥离 `data: ` 前缀，反序列化为 JSON 对象。 |
| **分块聚合与提取** | 将碎片化的流文本聚合成完整句子；提取工具调用参数。 | 内存中维护每个请求的“状态机”，根据 JSONPath 不断拼接增量 Delta 文本，直到收到 `[DONE]` 标识。 |
| **性能指标计算** | 记录首包时间 (TTFT) 和完整响应时间。 | 请求发出前打时间戳，收到第一个非空 chunk 打首包时间戳，流关闭时打结束时间戳。计算差值。 |
| **报告持久化与导出** | 生成聚合结果，持久化，支持 Excel/CSV 导出。 | 将测试结果序列化存入数据库。使用 `exceljs` 库在服务端生成带有表头透传的最终报告供下载。 |
| **细粒度错误分类** | 当请求失败时，不仅标记状态为 Failed，还要记录具体的报错原因。 | **后端**：在 Axios 或 Fetch 的 catch 块中进行拦截分类：

### 模块四：系统管理与安全防护 (Admin & Security)

保障系统在公网或内网环境下的基础安全。

| 功能模块 | 业务需求描述 | 研发技术实现与选型建议 |
| --- | --- | --- |
| **简易鉴权拦截** | 单点账户隔离，默认 admin/admin，拦截非法访问。 | Next.js Middleware 配合简单的 JWT 或 Session 机制。前端所有非 Login 页面路由守卫拦截。 |
| **资产隔离** | 保护测试及数据集不被乱动。 | 数据库设计需关联用户 ID（即使目前是单用户，也为未来多账户扩展留出字段 `user_id`）。 |



#### 5. API 联调与测试绑定校验 (API Binding Validation)

**归属模块**：数据集与动态配置中心 (前端交互 + 后端轻量级引擎)
**业务价值**：在正式发起数千条并发测试前，用单条数据“试跑”一次，验证请求体拼装是否合法、返回字段 JSONPath 提取是否准确。


### 测试用API

请求体
```json
curl --location --request POST 'https://api.example.com/chat' \
--header 'Content-Type: application/json' \
--data-raw '{
  "msg": "你好",
  "sessionId": "412312",
  "stream": "true",
  "channel": "Rokid"
}'
```
---
返回体
```json
data: {"thinkcontent":"","messagetype":"","sessionId":"412312","text":"","type":0}

data: {"thinkcontent":"","messagetype":"text","sessionId":"412312","text":"","type":1}

data: {"thinkcontent":"","messagetype":"text","sessionId":"412312","text":"你好","type":1}

data: {"thinkcontent":"","messagetype":"text","sessionId":"412312","text":"，","type":1}

data: {"thinkcontent":"","messagetype":"text","sessionId":"412312","text":"我是","type":1}

data: {"thinkcontent":"","messagetype":"text","sessionId":"412312","text":"管家AI助手","type":1}

data: {"thinkcontent":"","messagetype":"text","sessionId":"412312","text":"","type":1}

data: {"thinkcontent":"","messagetype":"","sessionId":"412312","text":"","type":2}

[DONE]
```
