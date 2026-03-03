# Eval-Any-Agent

基于 Next.js App Router + shadcn/ui + Prisma(SQLite) 的 LLM 批量评测平台。

## 技术栈

- Next.js 16 (App Router)
- shadcn/ui 官方组件（通过 `shadcn` CLI 安装）
- Prisma + SQLite
- React Hook Form + Zod
- SSE/流式解析 + JSONPath 提取

## 功能

- 管理员登录与会话鉴权（默认 `admin/admin`）
- 数据集上传（CSV/XLSX）与预览
- 配置中心（请求模板、输入绑定、提取规则、结束信号规则）
- Dry Run 单点试跑（返回提取结果与结束判定）
- 并发任务执行（并发/超时/重试）
- 任务控制（暂停/继续/终止）
- 结果查询与导出（CSV/XLSX，动态字段列）

## 结束信号策略

支持以下规则并行配置：

- `sentinel_text`（如 `[DONE]`）
- `json_path_equals`（如 `$.type == 2`）
- `event_name`
- `connection_close`
- `max_idle_ms`

并支持：

- `done_strategy`: `auto | manual`
- `done_required`: 未命中显式规则时标记 `END_SIGNAL_MISSING`

## 本地启动

> 依赖安装优先使用国内镜像（已按镜像方式安装）。

1. 安装依赖

```bash
npm install
```

2. 生成 Prisma Client

```bash
npm run db:generate
```

3. 初始化数据库（当前环境下 `prisma db push` 可能失败时，使用 SQL 初始化）

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/init.sql
sqlite3 prisma/dev.db < prisma/init.sql
npm run db:seed
```

4. 启动开发环境

```bash
npm run dev
```

5. 登录

- 用户名：`admin`
- 密码：`admin`

## 主要目录

- `src/app/dashboard/page.tsx`：主控制台 UI
- `src/app/api/**`：后端 API
- `src/lib/stream.ts`：流式解析与结束信号判定
- `src/lib/execution.ts`：并发任务执行器
- `prisma/schema.prisma`：数据模型

## 验证

```bash
npm run lint
npm run build
```

## Docker 部署（单机 Compose，优先 linux/amd64）

### 1. 准备环境变量

```bash
cp env/.env.docker.example env/.env.docker
```

至少修改：

- `AUTH_SECRET`（必须修改为强随机值）
- `DEFAULT_ADMIN_PASSWORD`（建议首次部署前修改）

### 2. 准备 HTTPS 证书

将证书文件放入 `docker/nginx/ssl/` 目录，文件名固定为：

- `fullchain.pem`
- `privkey.pem`

仅本地测试可用自签证书（生产环境请使用受信任 CA 证书）：

```bash
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout docker/nginx/ssl/privkey.pem \
  -out docker/nginx/ssl/fullchain.pem \
  -subj "/CN=localhost"
```

### 3. 构建 amd64 镜像（推荐）

```bash
docker buildx build --platform linux/amd64 -t eval-any-agent:amd64 . --load
```

### 4. 启动服务

```bash
docker compose --env-file env/.env.docker up -d --build
```

### 5. 访问与登录

- HTTPS：`https://<your-domain-or-ip>/login`
- 首次启动会自动初始化 SQLite 并种子默认管理员账号

### 6. 停止与重启

```bash
docker compose --env-file env/.env.docker down
docker compose --env-file env/.env.docker up -d
```

SQLite 数据保存在命名卷 `app_data`，重建容器不会丢失数据。

### 7. Apple Silicon 说明

本方案以 `linux/amd64` 为优先目标。Apple Silicon 机器请通过 `buildx` 跨平台构建，并按上述 compose 命令运行。
