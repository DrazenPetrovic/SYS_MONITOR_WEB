# SYS_MONITOR_WEB PM2 deploy

## 1) Install dependencies (single command)

```bash
npm run install:all
```

This uses npm workspaces and installs root, server, and client dependencies together.

## 2) Configure environment

Create `.env` in project root or in `server/.env` with values used by `server/index.js`, for example:

```env
PORT=3001
NODE_ENV=production
JWT_SECRET=change_this_secret
ADMIN_PASSWORD=change_this_password
GLANCES_HOST=http://127.0.0.1:61208

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASS=secret

MIKROTIK1_NAME=Router 1
MIKROTIK1_HOST=192.168.88.1
MIKROTIK1_USER=admin
MIKROTIK1_PASS=secret
MIKROTIK1_PORT=8728
```

## 3) Start with PM2

```bash
npm run pm2:start
```

This builds the React client and starts one PM2 process (`sys-monitor-web`) that serves both API and frontend.

## 4) Common PM2 commands

```bash
npm run pm2:restart
npm run pm2:logs
npm run pm2:stop
```

## 5) Enable startup on reboot

```bash
pm2 startup
pm2 save
```
