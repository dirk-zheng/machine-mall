# Vendora 自动售卖机网站 Ubuntu 部署指南

本文档适用于将当前项目部署到 Ubuntu 22.04 / 24.04 服务器。

推荐生产架构：

```text
浏览器
  ↓ HTTPS / WSS
Nginx
  ↓ http://127.0.0.1:3001
Node.js / Express
  ├─ React 静态站点：client/dist
  ├─ REST API：/api
  ├─ WebSocket：/ws
  ├─ 产品、FAQ、文章：server/data/*.json
  └─ 用户、询价、客服数据：MySQL 8
```

示例使用以下占位值，部署时请统一替换：

- 域名：`example.com`
- 项目目录：`/var/www/vendora`
- Linux 服务账号：`vendora`
- systemd 服务名：`vendora`
- 数据库名：`vendora_b2b`

> 数据库名是项目保留的历史兼容标识。除非同时修改 SQL、服务端配置和已有数据，否则不要直接改名。

## 1. 服务器准备

建议配置：2 核 CPU、2 GB 内存、20 GB 磁盘。

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y nginx mysql-server git curl build-essential
```

安装 Node.js 20 LTS：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

Node.js 应为 20.x 或更高版本。

创建独立服务账号：

```bash
sudo adduser --system --group --home /var/www/vendora vendora
```

## 2. 上传项目

通过 Git 部署：

```bash
sudo git clone <你的仓库地址> /var/www/vendora
sudo chown -R vendora:vendora /var/www/vendora
```

如果使用 SFTP、SCP 或服务器面板上传，请确保最终目录结构如下：

```text
/var/www/vendora/
├── client/
├── server/
├── package.json
└── DEPLOY-UBUNTU.md
```

不要上传本地的 `node_modules`、`client/dist` 或包含生产密码的 `.env`。

## 3. 安装依赖并构建前端

安装服务端生产依赖：

```bash
cd /var/www/vendora/server
sudo -u vendora npm ci --omit=dev
```

安装前端依赖：

```bash
cd /var/www/vendora/client
sudo -u vendora npm ci
```

创建前端生产环境文件：

```bash
sudo -u vendora nano /var/www/vendora/client/.env.production.local
```

写入：

```dotenv
VITE_SITE_URL=https://example.com
VITE_LEGAL_BUSINESS_NAME=Vendora Systems
VITE_BUSINESS_POSTAL_ADDRESS="你的公司地址"
VITE_PRIVACY_EMAIL=privacy@example.com
VITE_INQUIRIES_EMAIL=sales@example.com
```

构建前端及 SEO 预渲染页面：

```bash
cd /var/www/vendora/client
sudo -u vendora npm run build
```

构建成功后应生成：

```text
/var/www/vendora/client/dist
```

所有 `VITE_` 开头的变量都会进入浏览器构建产物，不要在其中存放密码、Token 或数据库凭据。

## 4. 配置 MySQL 8

启动 MySQL：

```bash
sudo systemctl enable --now mysql
sudo systemctl status mysql
```

进入数据库控制台：

```bash
sudo mysql
```

创建数据库用户。请把示例密码替换为随机强密码：

```sql
CREATE DATABASE IF NOT EXISTS vendora_b2b
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER 'vendora_app'@'localhost'
  IDENTIFIED BY '替换成强随机数据库密码';

GRANT ALL PRIVILEGES ON vendora_b2b.*
  TO 'vendora_app'@'localhost';

FLUSH PRIVILEGES;
EXIT;
```

导入表结构：

```bash
sudo mysql < /var/www/vendora/server/sql/schema.sql
```

验证：

```bash
mysql -h 127.0.0.1 -u vendora_app -p vendora_b2b
```

进入 MySQL 后执行：

```sql
SHOW TABLES;
EXIT;
```

## 5. 配置服务端环境变量

创建生产环境文件：

```bash
sudo -u vendora nano /var/www/vendora/server/.env
```

推荐配置：

```dotenv
HOST=127.0.0.1
PORT=3001
NODE_ENV=production

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=vendora_b2b
DB_USER=vendora_app
DB_PASSWORD=替换成数据库密码
DB_POOL_SIZE=10
DB_AUTO_SCHEMA=false

JWT_SECRET=替换成至少32字符的随机字符串
CORS_ORIGINS=https://example.com,https://www.example.com
TRUST_PROXY=loopback

ADMIN_ACCOUNT=admin
ADMIN_PASSWORD=替换成独立的管理员强密码
ADMIN_NAME="Vendora Systems Admin"

LEGAL_BUSINESS_NAME="Vendora Systems"
BUSINESS_POSTAL_ADDRESS="你的公司地址"
PRIVACY_REQUEST_OWNER=privacy@example.com
INCIDENT_RESPONSE_EMAIL=security@example.com
PRODUCT_COMPLIANCE_OWNER=compliance@example.com

LARK_NOTIFICATIONS_ENABLED=false
LARK_WEBHOOK_URL=
LARK_WEBHOOK_SECRET=
LARK_REQUEST_TIMEOUT_MS=8000
```

生成 JWT 密钥：

```bash
openssl rand -hex 32
```

限制环境文件权限：

```bash
sudo chown vendora:vendora /var/www/vendora/server/.env
sudo chmod 600 /var/www/vendora/server/.env
```

生产环境注意事项：

- `HOST` 使用 `127.0.0.1`，避免 Node.js 的 3001 端口暴露公网。
- `CORS_ORIGINS` 必须填写真实 HTTPS 域名，不要使用 `*`。
- 多个域名使用英文逗号分隔。
- `JWT_SECRET` 必须至少 32 个字符。
- `ADMIN_PASSWORD` 必须使用独立强密码，不要沿用示例值。
- 不使用 Lark 通知时，应设置 `LARK_NOTIFICATIONS_ENABLED=false`。
- `npm run check:launch` 当前仍会要求 Lark Webhook；未启用 Lark 时以服务启动日志和 `/api/health` 为准。

## 6. JSON 数据目录权限

产品、FAQ 和文章目前保存在：

```text
server/data/products.json
server/data/faqs.json
server/data/articles.json
```

后台管理页面会直接修改这些文件，因此运行 Node.js 的 `vendora` 用户必须拥有写权限：

```bash
sudo chown -R vendora:vendora /var/www/vendora/server/data
sudo find /var/www/vendora/server/data -type d -exec chmod 750 {} \;
sudo find /var/www/vendora/server/data -type f -exec chmod 640 {} \;
```

如果生产环境会通过后台编辑产品或内容，更新代码前必须备份 `server/data`，避免 `git pull` 与线上修改发生冲突。

## 7. 首次启动测试

前台运行一次服务：

```bash
cd /var/www/vendora/server
sudo -u vendora npm start
```

在另一个 SSH 窗口检查：

```bash
curl http://127.0.0.1:3001/api/health
curl "http://127.0.0.1:3001/api/products?pageSize=100"
```

健康检查应包含：

```json
{
  "status": "ok",
  "database": {
    "connected": true,
    "engine": "mysql"
  }
}
```

测试结束后按 `Ctrl+C` 停止前台服务。

## 8. 使用 systemd 常驻运行

确认 Node.js 路径：

```bash
which node
```

创建服务文件：

```bash
sudo nano /etc/systemd/system/vendora.service
```

写入：

```ini
[Unit]
Description=Vendora Custom Vending Website
After=network.target mysql.service
Requires=mysql.service

[Service]
Type=simple
User=vendora
Group=vendora
WorkingDirectory=/var/www/vendora/server
EnvironmentFile=/var/www/vendora/server/.env
ExecStart=/usr/bin/node /var/www/vendora/server/index.js
Restart=always
RestartSec=5
TimeoutStopSec=20
KillSignal=SIGTERM

# 基础安全限制
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/var/www/vendora/server/data

[Install]
WantedBy=multi-user.target
```

如果 `which node` 返回的不是 `/usr/bin/node`，请修改 `ExecStart`。

启动并设置开机自启：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vendora
sudo systemctl status vendora
```

查看日志：

```bash
sudo journalctl -u vendora -f
```

查看最近 100 行：

```bash
sudo journalctl -u vendora -n 100 --no-pager
```

## 9. 配置 Nginx

创建站点配置：

```bash
sudo nano /etc/nginx/sites-available/vendora
```

写入：

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name example.com www.example.com;

    client_max_body_size 2m;

    # WebSocket 客服与实时消息
    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # React 页面、静态资源和 REST API 都由 Node.js 提供
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/vendora /etc/nginx/sites-enabled/vendora
sudo nginx -t
sudo systemctl reload nginx
```

如果默认站点产生冲突，可移除默认站点链接：

```bash
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 10. 配置域名与 HTTPS

先将域名的 A 记录指向服务器公网 IP。DNS 生效后安装 Certbot：

```bash
sudo apt install -y certbot python3-certbot-nginx
```

申请证书：

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

验证自动续期：

```bash
sudo certbot renew --dry-run
```

启用 HTTPS 后，前端会自动通过同域名的 `wss://example.com/ws` 连接 WebSocket。

## 11. 防火墙

只开放 SSH、HTTP 和 HTTPS：

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw enable
sudo ufw status
```

不要向公网开放：

- `3001`：Node.js 内部服务端口
- `3306`：MySQL 数据库端口

## 12. 部署验证清单

服务状态：

```bash
sudo systemctl status vendora
sudo systemctl status nginx
sudo nginx -t
```

接口验证：

```bash
curl https://example.com/api/health
curl "https://example.com/api/products?pageSize=100"
```

浏览器验证：

- 首页和真实售卖机图片正常显示。
- `/products` 显示全部基础机型。
- 产品详情页刷新后不会出现 Nginx 404。
- 定制询价表单能够提交。
- 登录和管理页面能够访问。
- 客服 WebSocket 返回 `101 Switching Protocols`。
- `/api/health` 中 `database.connected` 为 `true`。
- 页面源代码中的 canonical URL 是正式域名。

## 13. 日常更新流程

先备份在线 JSON 数据和数据库：

```bash
sudo -u vendora cp -a /var/www/vendora/server/data /var/www/vendora/server/data.backup
sudo mkdir -p /var/backups/vendora
mysqldump -u vendora_app -p vendora_b2b | gzip > /var/backups/vendora/database-$(date +%F-%H%M%S).sql.gz
```

更新项目：

```bash
cd /var/www/vendora
sudo -u vendora git pull --ff-only

cd /var/www/vendora/server
sudo -u vendora npm ci --omit=dev

cd /var/www/vendora/client
sudo -u vendora npm ci
sudo -u vendora npm run build

sudo systemctl restart vendora
curl https://example.com/api/health
```

如果 `git pull` 提示 `server/data/*.json` 冲突，不要直接覆盖。先保留线上数据副本，再人工合并新增产品、FAQ 或文章。

## 14. 备份与恢复

备份数据库：

```bash
sudo mkdir -p /var/backups/vendora
mysqldump -u vendora_app -p vendora_b2b | gzip > /var/backups/vendora/database-$(date +%F-%H%M%S).sql.gz
```

备份 JSON 内容和产品图片：

```bash
sudo tar -czf /var/backups/vendora/content-$(date +%F-%H%M%S).tar.gz \
  -C /var/www/vendora server/data client/public/vending
```

恢复数据库：

```bash
gunzip -c /var/backups/vendora/数据库备份文件.sql.gz | mysql -u vendora_app -p vendora_b2b
```

恢复前建议暂停服务：

```bash
sudo systemctl stop vendora
# 执行恢复
sudo systemctl start vendora
```

## 15. 常见故障排查

### 15.1 服务启动失败

```bash
sudo journalctl -u vendora -n 100 --no-pager
```

重点检查：

- `server/.env` 是否存在且服务账号可读。
- `JWT_SECRET` 是否不少于 32 个字符。
- `CORS_ORIGINS` 是否为正式 HTTPS 域名。
- 数据库账号、密码和数据库名是否正确。
- MySQL 是否运行且表结构已导入。
- `client/dist` 是否已经构建。

### 15.2 Nginx 返回 502

```bash
sudo systemctl status vendora
curl http://127.0.0.1:3001/api/health
sudo tail -n 100 /var/log/nginx/error.log
```

### 15.3 页面能打开但 API 失败

```bash
curl http://127.0.0.1:3001/api/products
curl https://example.com/api/products
```

检查 Nginx 是否将 `/` 正确代理到 3001，以及浏览器控制台是否出现 CORS 错误。

### 15.4 WebSocket 无法连接

检查：

- Nginx `/ws` 是否设置 `Upgrade` 和 `Connection` 请求头。
- HTTPS 页面是否使用 `wss://`。
- 域名是否包含在 `CORS_ORIGINS`。
- 修改 `.env` 后是否执行 `sudo systemctl restart vendora`。

### 15.5 后台无法保存产品或文章

检查数据目录权限：

```bash
sudo -u vendora test -w /var/www/vendora/server/data/products.json && echo writable
sudo ls -la /var/www/vendora/server/data
```

如果不可写：

```bash
sudo chown -R vendora:vendora /var/www/vendora/server/data
sudo chmod 750 /var/www/vendora/server/data
sudo chmod 640 /var/www/vendora/server/data/*.json
```

### 15.6 产品图片显示 404

确认源文件存在并重新构建：

```bash
ls -la /var/www/vendora/client/public/vending
cd /var/www/vendora/client
sudo -u vendora npm run build
sudo systemctl restart vendora
```

## 16. 上线前安全检查

- `server/.env` 未提交到 Git。
- 数据库密码和 JWT 密钥为生产环境独立随机值。
- 已通过 `ADMIN_ACCOUNT`、`ADMIN_PASSWORD` 和 `ADMIN_NAME` 配置管理员账号。
- 服务器只开放 22、80、443 端口。
- MySQL 只监听本机地址。
- 已配置数据库和 JSON 内容自动备份。
- 已验证 HTTPS 证书自动续期。
- 已使用非 root 用户运行 Node.js。

