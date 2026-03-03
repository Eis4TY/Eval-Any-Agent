# SSL 证书放置说明

将你的 HTTPS 证书文件放在本目录，并保持以下文件名：

- `fullchain.pem`
- `privkey.pem`

## 快速自签证书（仅本地测试）

```bash
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout docker/nginx/ssl/privkey.pem \
  -out docker/nginx/ssl/fullchain.pem \
  -subj "/CN=localhost"
```

生产环境请替换为受信任 CA 签发的证书。
