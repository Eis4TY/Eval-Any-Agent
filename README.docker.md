# Eval-Any-Agent Docker 部署包

这是 Eval-Any-Agent 的 Nightly Docker 部署包。它不包含源码或离线镜像，只包含 Docker Compose 部署所需的配置文件，并默认从 GHCR 拉取预构建镜像。

## 文件内容

```text
Eval-Any-Agent-Docker/
├── docker-compose.yml
├── docker-compose.deploy.yml
├── env/.env.docker.example
├── docker/nginx/default.conf
├── docker/nginx/ssl/README.md
└── README.docker.md
```

## 1. 准备环境变量

```bash
cp env/.env.docker.example env/.env.docker
```

编辑 `env/.env.docker`，至少修改：

- `AUTH_SECRET`：登录会话签名密钥，请改为足够长的随机字符串
- `DEFAULT_ADMIN_PASSWORD`：首次初始化数据库时创建的管理员密码
- `NGINX_HTTP_PORT`、`NGINX_HTTPS_PORT`：宿主机访问端口
- `APP_IMAGE`：默认 `ghcr.io/eis4ty/eval-any-agent:latest`

注意：默认管理员只会在 SQLite 数据库首次初始化时创建。数据库已存在后再修改 `DEFAULT_ADMIN_PASSWORD`，不会自动更新旧账号密码。

## 2. 准备 HTTPS 证书

将证书放到 `docker/nginx/ssl/`，文件名必须为：

```text
fullchain.pem
privkey.pem
```

仅本地测试可生成自签证书：

```bash
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout docker/nginx/ssl/privkey.pem \
  -out docker/nginx/ssl/fullchain.pem \
  -subj "/CN=localhost"
```

生产环境请使用受信任 CA 证书。

## 3. 启动服务

```bash
docker compose \
  --env-file env/.env.docker \
  -f docker-compose.yml \
  -f docker-compose.deploy.yml \
  up -d
```

如果不想把 `APP_IMAGE` 写入 `env/.env.docker`，也可以临时传入：

```bash
APP_IMAGE=ghcr.io/eis4ty/eval-any-agent:latest docker compose \
  --env-file env/.env.docker \
  -f docker-compose.yml \
  -f docker-compose.deploy.yml \
  up -d
```

## 4. 访问系统

默认 HTTPS 访问地址：

```text
https://<服务器IP或域名>:18443/login
```

默认账号来自 `env/.env.docker`：

- 用户名：`DEFAULT_ADMIN_USERNAME`
- 密码：`DEFAULT_ADMIN_PASSWORD`

## 常用命令

查看状态：

```bash
docker compose --env-file env/.env.docker -f docker-compose.yml -f docker-compose.deploy.yml ps
```

查看日志：

```bash
docker compose --env-file env/.env.docker -f docker-compose.yml -f docker-compose.deploy.yml logs -f app
docker compose --env-file env/.env.docker -f docker-compose.yml -f docker-compose.deploy.yml logs -f nginx
```

日志说明：

- Docker 容器日志默认使用 `json-file` 轮转，每个容器最多保留 `5MB x 2`。
- Nginx 普通访问日志默认关闭，仅保留 `warn` 及以上错误日志。
- 该配置只限制新产生的容器日志；已经膨胀的旧日志需要重建容器或手动清理 Docker 日志文件后才会释放空间。

停止服务：

```bash
docker compose --env-file env/.env.docker -f docker-compose.yml -f docker-compose.deploy.yml down
```

升级到最新镜像：

```bash
docker compose --env-file env/.env.docker -f docker-compose.yml -f docker-compose.deploy.yml pull
docker compose --env-file env/.env.docker -f docker-compose.yml -f docker-compose.deploy.yml up -d
```

SQLite 数据保存在 Docker 命名卷 `app_data` 中，停止或重建容器不会删除数据。
