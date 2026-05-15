require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const path = require("path");
const mysql = require("mysql2/promise");
const { RouterOSAPI } = require("node-routeros");

const app = express();
const PORT = process.env.PORT || 3010;
const JWT_SECRET = process.env.JWT_SECRET;

// Glances serveri — konfigurišu se u .env kao GLANCES1_*, GLANCES2_*, itd.
const GLANCES_SERVERS = [];
for (let i = 1; ; i++) {
  const host = process.env[`GLANCES${i}_HOST`];
  if (!host) break;
  GLANCES_SERVERS.push({
    id: `server${i}`,
    name: process.env[`GLANCES${i}_NAME`] || `Server ${i}`,
    host,
    apiVersion: process.env[`GLANCES${i}_API_VERSION`] || "3",
    mysqlId: process.env[`GLANCES${i}_MYSQL`] || null,
  });
}

const USERS = {
  admin: process.env.ADMIN_PASSWORD,
};

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? false
        : ["http://localhost:5173", "http://localhost:4173"],
  }),
);
app.use(express.json());

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer "))
    return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username && USERS[username] === password) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "24h" });
    return res.json({ token, username });
  }
  res.status(401).json({ error: "Invalid credentials" });
});

app.get("/api/servers", authenticate, (_req, res) => {
  res.json(GLANCES_SERVERS.map(({ id, name }) => ({ id, name })));
});

app.get("/api/metrics", authenticate, async (req, res) => {
  const serverId = req.query.server || GLANCES_SERVERS[0]?.id;
  const server = GLANCES_SERVERS.find((s) => s.id === serverId);
  if (!server) return res.status(404).json({ error: "Server not found" });

  const endpoints = [
    "cpu",
    "mem",
    "memswap",
    "fs",
    "network",
    "system",
    "uptime",
    "load",
    "processlist",
    "sensors",
  ];
  try {
    const results = await Promise.allSettled(
      endpoints.map((ep) =>
        axios.get(`${server.host}/api/${server.apiVersion}/${ep}`, {
          timeout: 5000,
        }),
      ),
    );
    const data = {};
    endpoints.forEach((ep, i) => {
      data[ep] =
        results[i].status === "fulfilled" ? results[i].value.data : null;
    });
    data.timestamp = Date.now();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

// MySQL serveri — MYSQL1_*, MYSQL2_*, itd. (ili legacy MYSQL_*)
const MYSQL_TARGETS = [];
for (let i = 1; ; i++) {
  const host = process.env[`MYSQL${i}_HOST`];
  if (!host) break;
  MYSQL_TARGETS.push({
    id: `mysql${i}`,
    name: process.env[`MYSQL${i}_NAME`] || `MySQL ${i}`,
    host,
    port: parseInt(process.env[`MYSQL${i}_PORT`] || "3306"),
    user: process.env[`MYSQL${i}_USER`],
    password: process.env[`MYSQL${i}_PASS`],
    database: process.env[`MYSQL${i}_DB`] || "information_schema",
  });
}

if (MYSQL_TARGETS.length === 0 && process.env.MYSQL_HOST) {
  MYSQL_TARGETS.push({
    id: "mysql1",
    name: "MySQL 1",
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || "3306"),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB || "information_schema",
  });
}

const mysqlPools = new Map();

function getMysqlPool(target) {
  if (!mysqlPools.has(target.id)) {
    mysqlPools.set(
      target.id,
      mysql.createPool({
        host: target.host,
        port: target.port,
        user: target.user,
        password: target.password,
        database: target.database,
        connectionLimit: 3,
        connectTimeout: 5000,
        waitForConnections: true,
      }),
    );
  }
  return mysqlPools.get(target.id);
}

function resolveMysqlTarget(requestedServerId) {
  if (!requestedServerId) return MYSQL_TARGETS[0] || null;

  const direct = MYSQL_TARGETS.find((t) => t.id === requestedServerId);
  if (direct) return direct;

  const glancesServer = GLANCES_SERVERS.find((s) => s.id === requestedServerId);
  if (!glancesServer) return null;

  if (glancesServer.mysqlId) {
    return MYSQL_TARGETS.find((t) => t.id === glancesServer.mysqlId) || null;
  }

  return null;
}

app.get("/api/mysql", authenticate, async (req, res) => {
  const requestedServerId = req.query.server;
  const target = resolveMysqlTarget(requestedServerId);
  if (!target) {
    return res.status(503).json({ error: "No MySQL target configured" });
  }

  const mysqlPool = getMysqlPool(target);
  const statusVars = [
    "Threads_connected",
    "Threads_running",
    "Questions",
    "Slow_queries",
    "Uptime",
    "Innodb_buffer_pool_reads",
    "Innodb_buffer_pool_read_requests",
    "Innodb_buffer_pool_pages_total",
    "Innodb_buffer_pool_pages_free",
    "Com_select",
    "Com_insert",
    "Com_update",
    "Com_delete",
    "Bytes_received",
    "Bytes_sent",
    "Max_used_connections",
    "Aborted_connects",
    "Table_locks_waited",
  ].join("','");

  try {
    const [[status], [variables], [processlist]] = await Promise.all([
      mysqlPool.query(
        `SHOW GLOBAL STATUS WHERE Variable_name IN ('${statusVars}')`,
      ),
      mysqlPool.query(
        "SHOW GLOBAL VARIABLES WHERE Variable_name IN ('max_connections','innodb_buffer_pool_size','version','query_cache_size')",
      ),
      mysqlPool.query(
        "SELECT ID, USER, HOST, DB, COMMAND, TIME, STATE, LEFT(INFO, 120) AS INFO " +
          "FROM information_schema.PROCESSLIST WHERE COMMAND != 'Sleep' ORDER BY TIME DESC LIMIT 15",
      ),
    ]);

    const toMap = (rows) =>
      Object.fromEntries(rows.map((r) => [r.Variable_name, r.Value]));
    res.json({
      target: {
        id: target.id,
        name: target.name,
        host: target.host,
      },
      status: toMap(status),
      variables: toMap(variables),
      processlist,
      timestamp: Date.now(),
    });
  } catch (err) {
    res.status(503).json({ error: "MySQL unavailable", details: err.message });
  }
});

// MikroTik ruteri — dodaj koliko god treba
const MIKROTIK_ROUTERS = [
  {
    id: "router1",
    name: process.env.MIKROTIK1_NAME || "Router 1",
    host: process.env.MIKROTIK1_HOST,
    user: process.env.MIKROTIK1_USER,
    password: process.env.MIKROTIK1_PASS,
    port: parseInt(process.env.MIKROTIK1_PORT || "8728"),
  },
  {
    id: "router2",
    name: process.env.MIKROTIK2_NAME || "Router 2",
    host: process.env.MIKROTIK2_HOST,
    user: process.env.MIKROTIK2_USER,
    password: process.env.MIKROTIK2_PASS,
    port: parseInt(process.env.MIKROTIK2_PORT || "8728"),
  },
];

// Per-router prev data za računanje brzina
const _mtPrev = {};

async function queryMikrotik(router) {
  const api = new RouterOSAPI({
    host: router.host,
    user: router.user,
    password: router.password,
    port: router.port,
    timeout: 6000,
  });

  await api.connect();
  try {
    const [resources, interfaces, connections, l2tpClients, pppActive] =
      await Promise.all([
        api.write("/system/resource/print"),
        api.write("/interface/print"),
        api.write("/ip/firewall/connection/print", ["=count-only="]),
        api.write("/interface/l2tp-client/print").catch(() => []),
        api.write("/ppp/active/print").catch(() => []),
      ]);

    const now = Date.now();
    const prev = _mtPrev[router.id];
    const rates = {};

    if (prev) {
      const dt = (now - prev.time) / 1000;
      interfaces.forEach((iface) => {
        const p = prev.ifaces[iface.name];
        if (p && dt > 0) {
          rates[iface.name] = {
            rxRate: Math.max(
              0,
              (parseInt(iface["rx-byte"] || 0) - parseInt(p["rx-byte"] || 0)) /
                dt,
            ),
            txRate: Math.max(
              0,
              (parseInt(iface["tx-byte"] || 0) - parseInt(p["tx-byte"] || 0)) /
                dt,
            ),
          };
        }
      });
    }

    _mtPrev[router.id] = {
      ifaces: Object.fromEntries(interfaces.map((i) => [i.name, i])),
      time: now,
    };

    return {
      id: router.id,
      name: router.name,
      host: router.host,
      resource: resources[0] || {},
      interfaces: interfaces.map((i) => ({ ...i, ...rates[i.name] })),
      connectionCount: parseInt(connections[0]?.ret || connections.length || 0),
      l2tpClients, // tuneli gdje je ovaj ruter CLIENT
      pppActive: pppActive.filter((s) => s.service === "l2tp" || !s.service), // aktivne L2TP sesije (server strana)
      timestamp: now,
    };
  } finally {
    api.close();
  }
}

app.get("/api/mikrotik", authenticate, async (req, res) => {
  const results = await Promise.allSettled(
    MIKROTIK_ROUTERS.map((r) => queryMikrotik(r)),
  );
  const data = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          id: MIKROTIK_ROUTERS[i].id,
          name: MIKROTIK_ROUTERS[i].name,
          _error: true,
          details: r.reason.message,
        },
  );
  res.json(data);
});

app.get("/api/health", (_req, res) =>
  res.json({
    status: "ok",
    servers: GLANCES_SERVERS.map(({ id, name, host }) => ({ id, name, host })),
  }),
);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"));
  });
}

app.listen(PORT, () => console.log(`SYS Monitor server on port ${PORT}`));
