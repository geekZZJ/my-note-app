# 随手记录

单人网页：想到写一句，可选标成身体 / 学习与工作 / 决定。数据进远程 MySQL，可一键导出 Markdown，给以后的 AI 读。

本机调试和服务器正式环境共用同一套远程数据库。

## 环境变量

复制 `.env.example` 为 `.env.local`（本机）或 `.env`（服务器）：

```bash
DATABASE_URL=mysql://user:password@host.docker.internal:3306/my_note
APP_PASSWORD=change-me
SESSION_SECRET=change-me-to-a-long-random-string
```

容器里的 `127.0.0.1` 是容器自己。MySQL 在宿主机上时，主机名用 `host.docker.internal`。

## 建表

在远程 MySQL 执行一次：

```bash
mysql -h your-server-host -u user -p < scripts/schema.sql
```

或用 Drizzle（同样需要 `DATABASE_URL`）：

```bash
npm run db:push
```

## 本机调试

```bash
npm ci
cp .env.example .env.local   # 填入远程库与密码
npm run dev
```

浏览器打开 `http://localhost:3000`。写入的数据就是正式库里的数据。

## 服务器部署

服务器上安装 Docker，并把代码放在例如 `/opt/my-note-app`。在该目录创建 `.env`（不要提交），内容与上面的环境变量相同。

第一次以及以后每次更新：

```bash
git pull
docker-compose up -d --build
```

这会在镜像里安装依赖并执行 `npm run build`，然后用新容器换掉旧容器。记录仍在原来的 MySQL 里。服务器本机端口是 `3002`，前面用现有的 Nginx / Caddy 反代到 `127.0.0.1:3002`。

只改了 `.env`、代码没变时：

```bash
docker-compose up -d
```

## 导出格式

登录后点「导出 Markdown」，下载 zip：

- `README.md`：标签含义与时区说明
- `daily/YYYY-MM-DD.md`：按日拆开的记录，每条带时间和 id

## 技术栈

Next.js（App Router）+ Drizzle + MySQL。时区固定 `Asia/Shanghai`。
