import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchMetrics,
  fetchMysql,
  fetchMikrotik,
  fetchServers,
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
  const [servers, setServers] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [mysqlData, setMysqlData] = useState(null);
  const [mikrotikData, setMikrotikData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const history = useRef({ cpu: [], netRx: [], netTx: [] });
  const mysqlPrev = useRef({ questions: null, time: null, qpsHistory: [] });

  useEffect(() => {
    fetchServers()
      .then((list) => {
        setServers(list);
      })
      .catch(() => {});
  }, []);

  const serverButtons = Array.from({ length: 3 }, (_unused, idx) => {
    const configured = servers[idx];
    if (configured) return { ...configured, configured: true };
    return {
      id: `server${idx + 1}`,
      name: `Server ${idx + 1}`,
      configured: false,
    };
  });

  useEffect(() => {
    history.current = { cpu: [], netRx: [], netTx: [] };
    setMetrics(null);
  }, [activeServer]);

  const fetchData = useCallback(async () => {
    if (!activeServer || view !== "server") return;
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
      setErrorMsg(err.message || "Connection failed");
    }
  }, [activeServer, view]);

  const fetchMysqlData = useCallback(async () => {
    if (!activeServer || view !== "server") return;
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
    } catch {
      // MySQL not configured or down — show error state silently
      setMysqlData((prev) =>
        prev ? { ...prev, _error: true } : { _error: true },
      );
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

  const openServer = (server) => {
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
      <Header username={username} connected={connected} onLogout={logout} />

      <main className="p-3 md:p-4 lg:p-5 max-w-[1600px] mx-auto">
        {view === "home" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 md:p-5">
              <h1 className="text-xl md:text-2xl font-semibold text-white">
                Glavna strana
              </h1>
              <p className="text-slate-300 text-sm mt-1">
                MikroTik pregled i brzi ulaz na servere.
              </p>
            </div>

            <MikrotikCard data={mikrotikData} showAll />

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 md:p-5">
              <h2 className="text-white font-medium mb-3">Odaberi server</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {serverButtons.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => openServer(s)}
                    className="w-full rounded-lg px-4 py-4 bg-blue-600 text-white text-base font-semibold hover:bg-blue-500 active:scale-[0.99] transition-all text-left"
                  >
                    <div>{s.name}</div>
                    <div className="text-xs text-blue-100 mt-1">
                      {s.configured
                        ? "Otvori detalje"
                        : "Nije jos konfigurisan"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === "server" && !metrics && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <button
              onClick={() => setView("home")}
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
                onClick={() => setView("home")}
                className="px-4 py-2 rounded bg-slate-700 text-white hover:bg-slate-600"
              >
                Nazad na glavnu
              </button>
              <div className="flex gap-2 overflow-x-auto">
                {serverButtons.map((s) => (
                  <button
                    key={`${s.id}-switch`}
                    onClick={() => openServer(s)}
                    className={`px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap ${
                      activeServer === s.id && s.configured
                        ? "bg-blue-600 text-white"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
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
