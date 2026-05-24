import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchMetrics,
  fetchMysql,
  fetchMikrotik,
  fetchServers,
  fetchServerStatus,
} from "../api/glances";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Header";
import SystemInfo from "../components/SystemInfo";
import CpuCard from "../components/CpuCard";
import MemoryCard from "../components/MemoryCard";
import NetworkCard from "../components/NetworkCard";
import DiskCard from "../components/DiskCard";
import ProcessCard from "../components/ProcessCard";
import MysqlCard from "../components/MysqlCard";
import MikrotikCard from "../components/MikrotikCard";

const MAX_HISTORY = 60;
const MAX_QPS_HISTORY = 60;

function timeLabel() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

export default function Dashboard() {
  const { username, logout } = useAuth();
  const [view, setView] = useState("home");
  const [originView, setOriginView] = useState("home");
  const [servers, setServers] = useState([]);
  const [serverStatus, setServerStatus] = useState({});
  const [activeServer, setActiveServer] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [mysqlData, setMysqlData] = useState(null);
  const [mikrotikData, setMikrotikData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const history = useRef({ cpu: [], netRx: [], netTx: [] });
  const mysqlPrev = useRef({ questions: null, time: null, qpsHistory: [] });
  const metricsInFlight = useRef(false);
  const mysqlInFlight = useRef(false);

  useEffect(() => {
    fetchServers()
      .then((list) => {
        setServers(list);
      })
      .catch(() => {});

    fetchServerStatus()
      .then((statuses) => {
        const statusMap = {};
        statuses.forEach((s) => {
          statusMap[s.id] = {
            glancesOk: s.glancesOk,
            mysqlStatus: s.mysqlStatus,
          };
        });
        setServerStatus(statusMap);
      })
      .catch(() => {});

    const id = setInterval(() => {
      fetchServerStatus()
        .then((statuses) => {
          const statusMap = {};
          statuses.forEach((s) => {
            statusMap[s.id] = {
              glancesOk: s.glancesOk,
              mysqlStatus: s.mysqlStatus,
            };
          });
          setServerStatus(statusMap);
        })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(id);
  }, []);

  const serverList = servers.filter((s) => s.type !== "computer");
  const computerList = servers
    .filter((s) => s.type === "computer")
    .map((s) => ({ ...s, configured: true }));

  const serverButtons = Array.from({ length: 3 }, (_unused, idx) => {
    const configured = serverList[idx];
    if (configured) return { ...configured, configured: true };
    return {
      id: `server${idx + 1}`,
      name: `Server ${idx + 1}`,
      configured: false,
    };
  });

  const serverHealth = serverButtons.map((server) => ({
    id: server.id,
    name: server.name,
    configured: server.configured,
    glancesOk: serverStatus[server.id]?.glancesOk ?? null,
    mysqlStatus: serverStatus[server.id]?.mysqlStatus ?? null,
  }));

  const getServerIpLabel = (server) => {
    if (!server?.host) return "";
    try {
      return new URL(server.host).hostname;
    } catch {
      return server.host.replace(/^https?:\/\//, "").replace(/:\d+$/, "");
    }
  };

  useEffect(() => {
    history.current = { cpu: [], netRx: [], netTx: [] };
    mysqlPrev.current = { questions: null, time: null, qpsHistory: [] };
    setMetrics(null);
    setMysqlData(null);
  }, [activeServer]);

  const fetchData = useCallback(async () => {
    if (!activeServer || view !== "server") return;
    if (metricsInFlight.current) return;
    metricsInFlight.current = true;
    try {
      const data = await fetchMetrics(activeServer);
      const h = history.current;
      const t = timeLabel();

      h.cpu = [
        ...h.cpu.slice(-(MAX_HISTORY - 1)),
        { t, v: data.cpu?.total ?? 0 },
      ];

      const net = (data.network || []).reduce(
        (acc, iface) => ({
          rx: acc.rx + (iface.rx ?? iface.bytes_recv_rate_per_sec ?? 0),
          tx: acc.tx + (iface.tx ?? iface.bytes_sent_rate_per_sec ?? 0),
        }),
        { rx: 0, tx: 0 },
      );
      h.netRx = [
        ...h.netRx.slice(-(MAX_HISTORY - 1)),
        { t, v: Math.round(net.rx / 1024) },
      ];
      h.netTx = [
        ...h.netTx.slice(-(MAX_HISTORY - 1)),
        { t, v: Math.round(net.tx / 1024) },
      ];

      setMetrics({
        ...data,
        _hist: { cpu: [...h.cpu], netRx: [...h.netRx], netTx: [...h.netTx] },
      });
      setConnected(true);
      setErrorMsg("");
    } catch (err) {
      setConnected(false);
      const msg =
        err.response?.data?.error || err.message || "Connection failed";
      setErrorMsg(msg);
    } finally {
      metricsInFlight.current = false;
    }
  }, [activeServer, view]);

  const fetchMysqlData = useCallback(async () => {
    if (!activeServer || view !== "server") return;
    if (mysqlInFlight.current) return;
    mysqlInFlight.current = true;
    try {
      const data = await fetchMysql(activeServer);
      const questions = parseInt(data.status?.Questions || 0);
      const now = Date.now();
      const p = mysqlPrev.current;

      let qps = 0;
      if (p.questions !== null && p.time !== null) {
        const dq = questions - p.questions;
        const dt = (now - p.time) / 1000;
        qps = dt > 0 ? Math.max(0, dq / dt) : 0;
      }
      p.questions = questions;
      p.time = now;
      p.qpsHistory = [
        ...p.qpsHistory.slice(-(MAX_QPS_HISTORY - 1)),
        { t: timeLabel(), v: Math.round(qps) },
      ];

      setMysqlData({ ...data, qps, qpsHistory: [...p.qpsHistory] });
    } catch (err) {
      // MySQL not configured or down — show error state silently
      setMysqlData({
        _error: true,
        details: err.response?.data?.details || err.response?.data?.error,
      });
    } finally {
      mysqlInFlight.current = false;
    }
  }, [activeServer, view]);

  useEffect(() => {
    if (!activeServer || view !== "server") return;
    fetchData();
    const id = setInterval(fetchData, 2000);
    return () => clearInterval(id);
  }, [fetchData, view, activeServer]);

  useEffect(() => {
    if (view !== "server") return;
    fetchMysqlData();
    const id = setInterval(fetchMysqlData, 5000);
    return () => clearInterval(id);
  }, [fetchMysqlData, view, activeServer]);

  const openServer = (server, from = view) => {
    setOriginView(from);
    setView("server");
    if (!server.configured) {
      setActiveServer(null);
      setConnected(false);
      setMetrics(null);
      setErrorMsg("Ovaj server jos nije konfigurisan.");
      return;
    }
    setActiveServer(server.id);
    setErrorMsg("");
  };

  const fetchMikrotikData = useCallback(async () => {
    try {
      const data = await fetchMikrotik(); // sada vraća array
      setMikrotikData(data);
    } catch {
      setMikrotikData(null);
    }
  }, []);

  useEffect(() => {
    fetchMikrotikData();
    const id = setInterval(fetchMikrotikData, 3000);
    return () => clearInterval(id);
  }, [fetchMikrotikData]);

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      <Header
        username={username}
        connected={connected}
        serverHealth={serverHealth}
        onLogout={logout}
      />

      <main className="p-3 md:p-4 lg:p-5 max-w-[1600px] mx-auto">
        {view === "home" && (
          <div className="space-y-4">
            <MikrotikCard data={mikrotikData} showAll />

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 md:p-5">
              <h2 className="text-white font-medium mb-3">Odaberi</h2>
              <div className="grid grid-cols-4 gap-2">
                {serverButtons.map((s) => {
                  const status = serverStatus[s.id];
                  const mysqlBadgeClass =
                    status?.mysqlStatus === "ok"
                      ? "bg-green-400"
                      : status?.mysqlStatus === "not_configured"
                        ? "bg-slate-400"
                        : "bg-red-400";
                  return (
                    <button
                      key={s.id}
                      onClick={() => openServer(s)}
                      className="w-full rounded-lg px-3 py-3 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 active:scale-[0.99] transition-all text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate">{s.name}</div>
                          {s.configured && s.host && (
                            <div className="text-[11px] text-blue-100/80 mt-0.5 truncate font-normal">
                              {getServerIpLabel(s)}
                            </div>
                          )}
                        </div>
                        {s.configured && status && (
                          <div className="flex gap-1 shrink-0">
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${
                                status.glancesOk ? "bg-green-400" : "bg-red-400"
                              }`}
                              title={
                                status.glancesOk ? "Glances OK" : "Glances Down"
                              }
                            />
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${mysqlBadgeClass}`}
                              title={
                                status.mysqlStatus === "ok"
                                  ? "MySQL OK"
                                  : status.mysqlStatus === "not_configured"
                                    ? "MySQL not configured"
                                    : "MySQL failed"
                              }
                            />
                          </div>
                        )}
                      </div>
                      <div className="text-[11px] text-blue-100 mt-1">
                        {s.configured ? "Otvori detalje" : "Nije konfigurisano"}
                      </div>
                    </button>
                  );
                })}

                {/* 4. dugme — Računari */}
                <button
                  onClick={() => setView("computers")}
                  className="w-full rounded-lg px-3 py-3 bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-600 active:scale-[0.99] transition-all text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate">Računari</div>
                    {computerList.length > 0 && (
                      <div
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          computerList.some(
                            (c) => serverStatus[c.id]?.glancesOk,
                          )
                            ? "bg-green-300"
                            : "bg-red-400"
                        }`}
                      />
                    )}
                  </div>
                  <div className="text-[11px] text-emerald-100 mt-1">
                    {computerList.length} računar
                    {computerList.length !== 1 ? "a" : ""}
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {view === "computers" && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-medium">Računari</h2>
              <button
                onClick={() => setView("home")}
                className="px-3 py-1.5 rounded bg-slate-700 text-white text-sm hover:bg-slate-600"
              >
                ← Nazad
              </button>
            </div>
            {computerList.length === 0 ? (
              <div className="text-slate-500 text-sm py-6 text-center">
                Nema konfiguriranih računara.
                <br />
                Dodaj{" "}
                <span className="font-mono text-slate-400">
                  GLANCES4_TYPE=computer
                </span>{" "}
                u .env
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {computerList.map((c) => {
                  const status = serverStatus[c.id];
                  return (
                    <button
                      key={c.id}
                      onClick={() => openServer(c, "computers")}
                      className="w-full rounded-lg px-3 py-3 bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-600 active:scale-[0.99] transition-all text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate">{c.name}</div>
                          {c.location && (
                            <div className="text-[11px] text-emerald-200/70 mt-0.5 truncate font-normal">
                              {c.location}
                            </div>
                          )}
                        </div>
                        {status && (
                          <div
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              status.glancesOk ? "bg-green-300" : "bg-red-400"
                            }`}
                          />
                        )}
                      </div>
                      <div className="text-[11px] text-emerald-100 mt-1">
                        Otvori detalje
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {view === "server" && !metrics && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <button
              onClick={() => setView(originView)}
              className="mb-6 px-4 py-2 rounded bg-slate-700 text-white hover:bg-slate-600"
            >
              Nazad na glavnu
            </button>
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-white font-medium">Connecting to server...</p>
            {errorMsg && (
              <p className="text-sm mt-1 text-red-400">{errorMsg}</p>
            )}
          </div>
        )}

        {view === "server" && metrics && (
          <div className="space-y-3 md:space-y-4">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setView(originView)}
                className="px-4 py-2 rounded bg-slate-700 text-white hover:bg-slate-600"
              >
                Nazad na glavnu
              </button>
              <div className="flex gap-2 overflow-x-auto">
                {(originView === "computers" ? computerList : serverButtons).map(
                  (s) => (
                    <button
                      key={`${s.id}-switch`}
                      onClick={() => openServer(s, originView)}
                      className={`px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap text-left leading-tight ${
                        activeServer === s.id
                          ? originView === "computers"
                            ? "bg-emerald-600 text-white"
                            : "bg-blue-600 text-white"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      <div>{s.name}</div>
                      {s.host && (
                        <div className="text-[11px] font-normal opacity-80 mt-0.5">
                          {getServerIpLabel(s)}
                        </div>
                      )}
                    </button>
                  ),
                )}
              </div>
            </div>

            <SystemInfo
              system={metrics.system}
              uptime={metrics.uptime}
              load={metrics.load}
            />

            <MysqlCard data={mysqlData} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
              <CpuCard cpu={metrics.cpu} history={metrics._hist.cpu} />
              <MemoryCard mem={metrics.mem} swap={metrics.memswap} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
              <NetworkCard
                network={metrics.network}
                histRx={metrics._hist.netRx}
                histTx={metrics._hist.netTx}
              />
              <DiskCard filesystems={metrics.fs} />
            </div>

            <ProcessCard processes={metrics.processlist} />
          </div>
        )}
      </main>
    </div>
  );
}
