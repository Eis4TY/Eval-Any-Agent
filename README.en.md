# Eval-Any-Agent Private Deployment and User Guide

[中文](./README.md) | [English](./README.en.md)

![Eval-Any-Agent screenshot](./CleanShot.png)

Eval-Any-Agent is a self-hosted LLM and Agent batch evaluation platform. It helps teams upload CSV/XLSX datasets, configure request templates for any upstream Agent or OpenAI-compatible API, run high-volume evaluation jobs, inspect streaming responses, measure latency, export results, and optionally score outputs with LLM-as-a-Judge evaluators.

This guide is written for deployment operators and product users. It focuses on private deployment, day-to-day usage, result export, and operational commands.

## Use Cases

- Self-host an LLM evaluation platform on a company server, intranet machine, or Docker host.
- Batch test Agents, chatbots, OpenAI-compatible APIs, and custom streaming endpoints.
- Build requests from spreadsheet rows, including prompts, session IDs, user context, or reference answers.
- Track time to first token, total latency, success/failure states, end-signal quality, and extracted output fields.
- Use LLM-as-a-Judge to score generated answers and calculate pass rates.

## Features

- Admin login and session authentication.
- CSV, XLSX, and XLS dataset upload with preview.
- Configuration center for upstream URL, headers, request body templates, input bindings, extraction rules, and stream end rules.
- Streaming parser support for SSE, NDJSON, plain text, and automatic protocol detection.
- End-signal rules for `[DONE]`, JSONPath equality, event name, connection close, and idle timeout.
- Dry Run mode for validating one request before launching a full batch job.
- Batch execution with concurrency, timeout, retry, pause, resume, and stop controls.
- Paginated result inspection with dynamic fields and CSV/XLSX export.
- OpenAI-compatible model provider configuration and reusable LLM evaluators.
- Evaluation task export with scores, pass/fail status, reasons, and raw model responses.

## Recommended Deployment

For production or staging, use the Docker deployment package from the GitHub Releases page:

```text
eval-any-agent-docker-nightly.tar.gz
```

Extract it:

```bash
tar -xzf eval-any-agent-docker-nightly.tar.gz
cd Eval-Any-Agent-Docker
```

The Docker deployment package contains only Compose and Nginx configuration. It pulls the prebuilt image from GHCR and does not include source code, real environment files, certificates, `node_modules`, or build artifacts.

If you need the source package instead, download:

```text
eval-any-agent-nightly.tar.gz
```

## Server Requirements

- Linux x86_64 server.
- Docker 24+.
- Docker Compose v2.
- At least 2 CPU cores and 4 GB RAM.
- Network access to the upstream Agent/API and optional judge model provider.
- A domain name or server IP.
- Trusted HTTPS certificates for production.

Default ports:

- HTTP: `18080`, redirected to HTTPS by Nginx.
- HTTPS: `18443`.
- Internal app port: `3000`.

## Quick Start

### 1. Configure Environment Variables

```bash
cp env/.env.docker.example env/.env.docker
```

Edit `env/.env.docker`:

```dotenv
NODE_ENV=production
APP_IMAGE=ghcr.io/eis4ty/eval-any-agent:latest
AUTH_SECRET=please-change-this-to-a-long-random-string
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=change-this-password
DATABASE_URL=file:/app/data/dev.db
APP_PORT=3000
NGINX_HTTP_PORT=18080
NGINX_HTTPS_PORT=18443
```

Required changes:

- `AUTH_SECRET`: use a long random string for session signing.
- `DEFAULT_ADMIN_PASSWORD`: the password used when the SQLite database is initialized for the first time.

Optional changes:

- `DEFAULT_ADMIN_USERNAME`: default admin username.
- `APP_IMAGE`: defaults to `ghcr.io/eis4ty/eval-any-agent:latest`.
- `NGINX_HTTP_PORT`: host HTTP port.
- `NGINX_HTTPS_PORT`: host HTTPS port.

The default admin user is created only when the database is initialized for the first time. Changing `DEFAULT_ADMIN_PASSWORD` later will not update an existing user.

### 2. Prepare HTTPS Certificates

Put certificates under `docker/nginx/ssl/` with these exact names:

```text
fullchain.pem
privkey.pem
```

For local testing only, you can generate a self-signed certificate:

```bash
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout docker/nginx/ssl/privkey.pem \
  -out docker/nginx/ssl/fullchain.pem \
  -subj "/CN=localhost"
```

Use trusted CA certificates in production.

### 3. Start the Service

```bash
docker compose \
  --env-file env/.env.docker \
  -f docker-compose.yml \
  -f docker-compose.deploy.yml \
  up -d
```

If you prefer not to store `APP_IMAGE` in `env/.env.docker`, pass it inline:

```bash
APP_IMAGE=ghcr.io/eis4ty/eval-any-agent:latest docker compose \
  --env-file env/.env.docker \
  -f docker-compose.yml \
  -f docker-compose.deploy.yml \
  up -d
```

### 4. Check Status

```bash
docker compose --env-file env/.env.docker -f docker-compose.yml -f docker-compose.deploy.yml ps
docker compose --env-file env/.env.docker -f docker-compose.yml -f docker-compose.deploy.yml logs -f app
```

Logging defaults:

- Docker container logs use `json-file` rotation and keep up to `5MB x 2` per container.
- Nginx access logs are disabled by default; `warn` and higher error logs are still retained.
- This only limits newly generated container logs. Already oversized Docker log files require container recreation or manual Docker log cleanup to reclaim disk space.

Open:

```text
https://<server-ip-or-domain>:18443/login
```

Login credentials are defined in `env/.env.docker`:

- Username: `DEFAULT_ADMIN_USERNAME`
- Password: `DEFAULT_ADMIN_PASSWORD`

## Evaluation Workflow

1. Log in to the dashboard.
2. Upload a CSV/XLSX/XLS dataset.
3. Create a request profile in the configuration center.
4. Use Dry Run to validate one sample request.
5. Create a batch task with concurrency, timeout, and retry settings.
6. Monitor progress and inspect result rows.
7. Export raw evaluation results as CSV or XLSX.
8. Optional: configure an OpenAI-compatible judge model and evaluator.
9. Optional: create LLM evaluation tasks and export scoring results.

### Dataset Example

```csv
msg,sessionId,reference_output
Introduce yourself,s001,The answer should explain identity and core capabilities
Write a leave request email,s002,The answer should include the reason and polite wording
```

Common columns:

- `msg`: user prompt or test input.
- `sessionId`: optional session identifier.
- `reference_output`: optional reference answer used by evaluators.

### Request Profile Example

Input bindings:

```json
[
  { "placeholder": "msg", "column": "msg" },
  { "placeholder": "sessionId", "column": "sessionId" }
]
```

Request body template:

```json
{
  "msg": "{{msg}}",
  "sessionId": "{{sessionId}}",
  "stream": true
}
```

Extraction rules:

```json
[
  { "key": "text", "path": "$.text" },
  { "key": "thinking", "path": "$.thinkcontent" }
]
```

End-signal rules:

```json
[
  { "type": "sentinel_text", "value": "[DONE]" },
  { "type": "json_path_equals", "path": "$.type", "equals": 2 }
]
```

## LLM-as-a-Judge

Evaluator model providers support OpenAI-compatible APIs. Configure:

- Provider name.
- Base URL, for example `https://api.openai.com/v1` or an internal compatible endpoint.
- API key.
- Default model name.

Evaluator prompts can use these variables:

- `{{input.xxx}}`: original input fields, such as `{{input.msg}}`.
- `{{outputs.xxx}}`: extracted output fields, such as `{{outputs.text}}`.
- `{{result.status}}`: source task row status.
- `{{result.latencyMs}}`: source task row latency.
- `{{reference_output}}`: defaults to `input.reference_output`.

The judge model must return a JSON object:

```json
{
  "score": 85,
  "reason": "The answer covers the core points but lacks concrete steps.",
  "passed": true
}
```

## Operations

Upgrade to the latest image:

```bash
docker compose --env-file env/.env.docker -f docker-compose.yml -f docker-compose.deploy.yml pull
docker compose --env-file env/.env.docker -f docker-compose.yml -f docker-compose.deploy.yml up -d
```

Restart:

```bash
docker compose --env-file env/.env.docker -f docker-compose.yml -f docker-compose.deploy.yml restart
```

Stop:

```bash
docker compose --env-file env/.env.docker -f docker-compose.yml -f docker-compose.deploy.yml down
```

Back up SQLite:

```bash
docker compose --env-file env/.env.docker -f docker-compose.yml -f docker-compose.deploy.yml exec app sh -c 'sqlite3 /app/data/dev.db ".backup /app/data/backup.db"'
docker cp "$(docker compose --env-file env/.env.docker -f docker-compose.yml -f docker-compose.deploy.yml ps -q app)":/app/data/backup.db ./backup.db
```

SQLite data is stored in the Docker volume `app_data`. Stopping or recreating containers does not remove it.

## Local Development

Use the Tsinghua npm mirror first:

```bash
npm config set registry https://mirrors.tuna.tsinghua.edu.cn/npm/
npm install
```

Prepare environment variables:

```bash
cp .env.example .env
```

Generate Prisma Client and initialize the database:

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

Start development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000/login
```

Default local credentials:

- Username: `admin`
- Password: `DEFAULT_ADMIN_PASSWORD` in `.env`

## Keywords

LLM evaluation, Agent evaluation, AI evaluation platform, LLM benchmark, LLM-as-a-Judge, OpenAI-compatible API testing, streaming API testing, private deployment, self-hosted evaluation, Docker Compose deployment, batch evaluation, model QA, chatbot evaluation.
