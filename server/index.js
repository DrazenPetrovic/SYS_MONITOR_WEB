const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const path = require("path");
const mysql = require("mysql2/promise");
const { RouterOSAPI } = require("node-routeros");

const app = express();
const PORT = process.env.PORT || 3001;
const GLANCES_HOST = process.env.GLANCES_HOST || "http://94.130.111.127:61208";
const JWT_SECRET = "sys-monitor-jwt-xK9p2024";

// Hard-coded credentials — replace in future with DB
const USERS = {
  admin: "monitor2024",
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

app.get("/api/metrics", authenticate, async (req, res) => {
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
        axios.get(`${GLANCES_HOST}/api/2/${ep}`, { timeout: 5000 }),
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

// MySQL connection pool — configure via env vars
const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST || "94.130.111.127",
  port: parseInt(process.env.MYSQL_PORT || "3306"),
  user: process.env.MYSQL_USER || "monitor",
  password: process.env.MYSQL_PASS || "TeletabisI!123",
  database: "information_schema",
  connectionLimit: 3,
  connectTimeout: 5000,
  waitForConnections: true,
});

app.get("/api/mysql", authenticate, async (req, res) => {
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
    host: process.env.MIKROTIK1_HOST || "karpas-proizvodnja.ddns.net",
    user: process.env.MIKROTIK1_USER || "monitor",
    password: process.env.MIKROTIK1_PASS || "TeletabisI!123",
    port: parseInt(process.env.MIKROTIK1_PORT || "8728"),
  },
  {
    id: "router2",
    name: process.env.MIKROTIK2_NAME || "Router 2",
    host: process.env.MIKROTIK2_HOST || "karpasambalaze.no-ip.biz",
    user: process.env.MIKROTIK2_USER || "monitor",
    password: process.env.MIKROTIK2_PASS || "TeletabisI!123",
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
    const [resources, interfaces, connections, l2tpClients, pppActive] = await Promise.all([
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
      l2tpClients,      // tuneli gdje je ovaj ruter CLIENT
      pppActive: pppActive.filter(s => s.service === 'l2tp' || !s.service), // aktivne L2TP sesije (server strana)
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
  res.json({ status: "ok", glances: GLANCES_HOST }),
);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"));
  });
}

app.listen(PORT, () => console.log(`SYS Monitor server on port ${PORT}`));
