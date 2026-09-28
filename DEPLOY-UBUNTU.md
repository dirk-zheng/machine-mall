# Ubuntu 服务器部署指南

本文档适用于本项目的生产环境部署。推荐架构如下：

```text
域名 -> Nginx（HTTPS / WebSocket）-> Node.js:3001 -> MySQL 8
```

Node.js 服务只监听服务器本机地址，由 Nginx 对外提供 HTTP/HTTPS 服务。前后端使用同一个域名部署最简单，因为前端默认连接当前域名下的 `/api` 和 `/ws`。

## 1. 上线前安全检查

### 1.1 不要将 `.env` 提交到 Git

`server/.env` 中可能包含数据库密码、JWT 密钥和 Lark Webhook。生产部署前，应确认它没有被 Git 跟踪，并将以下规则加入项目根目录的 `.gitignore`：

```gitignore
.env
.env.*
!.env.example
```

如果 `server/.env` 已被 Git 跟踪，可在本地仓库执行：

```bash
git rm --cached server/.env
git commit -m "stop tracking production environment file"
```

如果包含密钥的 `.env` 曾经上传到远程仓库，应更换其中的数据库密码、JWT 密钥和 Webhook 密钥。仅删除文件不能清除 Git 历史中的旧密钥。

### 1.2 修改固定管理员密码

当前管理员配置位于：

```text
server/config/admin.js
```

服务启动时会根据这里的配置创建或同步管理员账号。公开上线前必须修改默认密码，推荐进一步改成从环境变量读取管理员账号和密码。

### 1.3 不使用示例数据库密码

不要在生产环境直接使用 `server/sql/create.sql` 中的示例用户和密码。应按照本文后续步骤手动创建独立数据库用户。

## 2. 服务器要求

推荐环境：

- Ubuntu 22.04 或 Ubuntu 24.04
- Node.js 20 LTS 或更高版本
- MySQL 8
- Nginx
- 至少 1 GB 内存；建议 2 GB 或以上

更新系统并安装基础软件：

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y nginx mysql-server git curl
```

确认 Node.js 与 npm 版本：

```bash
node --version
npm --version
```

如果 Node.js 低于 20，请先通过 NodeSource、nvm 或服务器管理面板安装 Node.js 20 LTS。

## 3. 上传项目

以下示例将项目部署到 `/var/www/aurelia`：

```bash
sudo mkdir -p /var/www/aurelia
sudo chown -R "$USER":"$USER" /var/www/aurelia
git clone <你的仓库地址> /var/www/aurelia
cd /var/www/aurelia
```

也可以在本地构建后通过 `rsync`、SFTP 或服务器管理面板上传。

## 4. 安装项目依赖

安装服务端生产依赖：

```bash
cd /var/www/aurelia/server
npm ci --omit=dev
```

如果要让 Node.js 同时提供前端页面，还需要安装前端依赖并构建：

```bash
cd /var/www/aurelia/client
npm ci
npm run build
```

生产模式下，服务端会自动读取并托管：

```text
client/dist
```

如果该目录不存在，服务端仍可提供 API 和 WebSocket，但不会提供完整前端页面。

### 4.1 前端生产环境变量

构建前可以创建 `/var/www/aurelia/client/.env.production.local`：

```dotenv
VITE_SITE_URL=https://example.com
VITE_LEGAL_BUSINESS_NAME=你的公司名称
VITE_BUSINESS_POSTAL_ADDRESS=你的公司地址
VITE_PRIVACY_EMAIL=privacy@example.com
VITE_INQUIRIES_EMAIL=sales@example.com
```

然后重新构建：

```bash
cd /var/www/aurelia/client
npm run build
```

所有 `VITE_` 开头的变量都会写入浏览器端构建产物，不能在其中保存密码、Token 或其他秘密。

## 5. 配置 MySQL

启动并设置 MySQL 开机自启：

```bash
sudo systemctl enable --now mysql
sudo systemctl status mysql
```

进入 MySQL：

```bash
sudo mysql
```

创建数据库和专用用户。请将示例密码替换为足够长的随机密码：

```sql
CREATE DATABASE curva_denim_b2b
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER 'aurelia_app'@'localhost'
  IDENTIFIED BY '替换成很长的随机数据库密码';

GRANT ALL PRIVILEGES ON curva_denim_b2b.* TO 'aurelia_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

导入项目表结构：

```bash
sudo mysql < /var/www/aurelia/server/sql/schema.sql
```

项目表结构使用 `utf8mb4_0900_ai_ci`，因此推荐使用 MySQL 8。旧版 MySQL 或部分 MariaDB 版本可能不支持该排序规则。

## 6. 配置服务端环境变量

创建 `/var/www/aurelia/server/.env`：

```dotenv
HOST=127.0.0.1
PORT=3001
NODE_ENV=production

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=curva_denim_b2b
DB_USER=aurelia_app
DB_PASSWORD=替换成数据库密码
DB_POOL_SIZE=10
DB_AUTO_SCHEMA=false

JWT_SECRET=替换成至少32字符的随机字符串
CORS_ORIGINS=https://example.com,https://www.example.com
TRUST_PROXY=loopback

LEGAL_BUSINESS_NAME="你的公司法定名称"
BUSINESS_POSTAL_ADDRESS="你的业务邮寄地址"
PRIVACY_REQUEST_OWNER=privacy@example.com
INCIDENT_RESPONSE_EMAIL=security@example.com
PRODUCT_COMPLIANCE_OWNER=compliance@example.com

LARK_NOTIFICATIONS_ENABLED=false
LARK_WEBHOOK_URL=
LARK_WEBHOOK_SECRET=
LARK_REQUEST_TIMEOUT_MS=8000
```

生成随机 JWT 密钥：

```bash
openssl rand -hex 32
```

限制环境文件权限：

```bash
chmod 600 /var/www/aurelia/server/.env
```

注意事项：

- `HOST` 推荐设为 `127.0.0.1`，避免 3001 端口直接暴露公网。
- `CORS_ORIGINS` 必须填写实际 HTTPS 域名，多个域名用英文逗号分隔，不能填写 `*`。
- 如果域名只有 `example.com`，可以只填写一个来源。
- 如果启用 Lark 通知，需要填写国际版 Lark 机器人 Webhook 和签名密钥。
- 当前 `npm run check:launch` 检查脚本会要求提供 Lark 配置，即使通知已关闭。不使用 Lark 时，可通过健康检查和服务日志验证实际启动状态。

## 7. 首次启动测试

先直接启动服务，确认数据库和环境变量配置正确：

```bash
cd /var/www/aurelia/server
npm start
```

在另一个终端检查：

```bash
curl http://127.0.0.1:3001/api/health
```

正常响应类似：

```json
{
  "status": "ok",
  "database": {
    "connected": true,
    "engine": "mysql",
    "scope": "user-data-only",
    "error": null
  }
}
```

测试完成后按 `Ctrl+C` 停止服务，再配置 systemd。

## 8. 使用 systemd 常驻运行

确认 Node.js 的绝对路径：

```bash
which node
```

一般会返回 `/usr/bin/node`。如果返回其他路径，需要同步修改下面的 `ExecStart`。

创建 systemd 服务：

```bash
sudo nano /etc/systemd/system/aurelia.service
```

写入以下内容，将 `User` 改成实际部署用户：

```ini
[Unit]
Description=Aurelia Ingredients Node Server
After=network.target mysql.service
Requires=mysql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/aurelia/server
EnvironmentFile=/var/www/aurelia/server/.env
ExecStart=/usr/bin/node /var/www/aurelia/server/index.js
Restart=always
RestartSec=5
TimeoutStopSec=20
KillSignal=SIGTERM

[Install]
WantedBy=multi-user.target
```

启动服务并设置开机自启：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now aurelia
sudo systemctl status aurelia
```

实时查看日志：

```bash
sudo journalctl -u aurelia -f
```

查看最近 100 行日志：

```bash
sudo journalctl -u aurelia -n 100 --no-pager
```

修改 `.env` 或更新代码后，需要重启服务：

```bash
sudo systemctl restart aurelia
```

## 9. 配置 Nginx

创建站点配置：

```bash
sudo nano /etc/nginx/sites-available/aurelia
```

写入以下内容，并将域名替换为实际域名：

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name example.com www.example.com;

    client_max_body_size 2m;

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

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/aurelia /etc/nginx/sites-enabled/aurelia
sudo nginx -t
sudo systemctl reload nginx
```

如果默认站点与新站点冲突，可以移除默认站点链接：

```bash
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 10. 配置 HTTPS

先在域名服务商处将域名的 A 记录指向服务器公网 IP。确认 DNS 生效后安装 Certbot：

```bash
sudo apt install -y certbot python3-certbot-nginx
```

申请并自动配置证书：

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

检查证书自动续期：

```bash
sudo certbot renew --dry-run
```

启用 HTTPS 后，前端会自动通过 `wss://example.com/ws` 连接 WebSocket。

## 11. 配置防火墙

只开放 SSH、HTTP 和 HTTPS：

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw enable
sudo ufw status
```

不要向公网开放以下端口：

- `3001`：Node.js 内部服务端口
- `3306`：MySQL 数据库端口

## 12. 部署验证

检查 systemd：

```bash
sudo systemctl status aurelia
```

检查 Nginx：

```bash
sudo nginx -t
sudo systemctl status nginx
```

检查 HTTPS API：

```bash
curl https://example.com/api/health
```

还应在浏览器中验证：

- 首页能够正常打开。
- `/products` 等前端路由刷新后不会返回 Nginx 404。
- 登录、询价和客服功能正常。
- 浏览器开发者工具中 `/ws` WebSocket 状态为 `101 Switching Protocols`。
- `/api/health` 中 `database.connected` 为 `true`。

## 13. 后续更新

拉取代码并重新安装依赖：

```bash
cd /var/www/aurelia
git pull

cd server
npm ci --omit=dev

cd ../client
npm ci
npm run build

sudo systemctl restart aurelia
curl https://example.com/api/health
```

如果本次更新包含数据库结构变化，应先备份数据库，并根据对应迁移说明执行数据库更新。

## 14. 数据库备份

手动备份：

```bash
mkdir -p /var/backups/aurelia
mysqldump -u aurelia_app -p curva_denim_b2b | gzip > /var/backups/aurelia/curva_denim_b2b-$(date +%F-%H%M%S).sql.gz
```

恢复前应先停止写入，并确认备份文件有效。恢复示例：

```bash
gunzip -c /var/backups/aurelia/备份文件.sql.gz | mysql -u aurelia_app -p curva_denim_b2b
```

生产环境建议通过 cron、云数据库备份或服务器快照建立自动备份，并定期进行恢复演练。

## 15. 常见故障排查

### 服务启动后立即退出

查看日志：

```bash
sudo journalctl -u aurelia -n 100 --no-pager
```

重点检查：

- `NODE_ENV=production` 时是否配置了 `CORS_ORIGINS`。
- `JWT_SECRET` 是否至少 32 个字符。
- `DB_USER` 和 `DB_PASSWORD` 是否正确。
- MySQL 是否已经启动，表结构是否已经导入。
- systemd 中的 `User`、`WorkingDirectory` 和 Node.js 路径是否正确。

### 返回 502 Bad Gateway

通常表示 Nginx 无法连接 Node.js：

```bash
sudo systemctl status aurelia
curl http://127.0.0.1:3001/api/health
sudo tail -n 100 /var/log/nginx/error.log
```

### WebSocket 无法连接

检查：

- Nginx `/ws` 是否设置了 `Upgrade` 和 `Connection` 请求头。
- HTTPS 页面是否使用了 `wss://`。
- 实际域名是否包含在 `CORS_ORIGINS` 中。
- 修改 `.env` 后是否重启了服务。

### 数据库显示未连接

检查 MySQL 登录：

```bash
mysql -h 127.0.0.1 -u aurelia_app -p curva_denim_b2b
```

进入数据库后可检查表：

```sql
SHOW TABLES;
```

