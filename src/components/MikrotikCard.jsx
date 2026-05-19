import React, { useState } from "react";
import {
  Router,
  AlertCircle,
  Wifi,
  WifiOff,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";

function fmtBytes(b, d = 1) {
  b = parseInt(b) || 0;
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(d)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(d)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(d)} KB`;
  return `${b} B`;
}

function fmtSpeed(bps) {
  if (!bps) return "0 B/s";
  if (bps >= 1024 ** 2) return `${(bps / 1024 ** 2).toFixed(1)} MB/s`;
  if (bps >= 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${Math.round(bps)} B/s`;
}

function statusColor(pct) {
  if (pct >= 90) return "#ef4444";
  if (pct >= 70) return "#f59e0b";
  return "#f97316";
}

function RouterPanel({ router }) {
  const [showAll, setShowAll] = useState(false);

  if (router._error) {
    return (
      <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg p-3 mt-3">
        <AlertCircle size={13} className="shrink-0" />
        <span>
          Nedostupan — {router.details || "provjeri konekciju i credentials"}
        </span>
      </div>
    );
  }

  const {
    resource = {},
    interfaces = [],
    connectionCount = 0,
    l2tpClients = [],
    pppActive = [],
  } = router;

  const cpuLoad = parseInt(resource["cpu-load"] || 0);
  const totalMem = parseInt(resource["total-memory"] || 0);
  const freeMem = parseInt(resource["free-memory"] || 0);
  const usedMem = totalMem - freeMem;
  const memPct = totalMem > 0 ? (usedMem / totalMem) * 100 : 0;
  const totalHdd = parseInt(resource["total-hdd-space"] || 0);
  const freeHdd = parseInt(resource["free-hdd-space"] || 0);
  const hddPct = totalHdd > 0 ? ((totalHdd - freeHdd) / totalHdd) * 100 : 0;

  const visibleIfaces = showAll ? interfaces : interfaces.slice(0, 6);

  return (
    <div>
      {/* Info row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-3">
        <span className="font-mono">{router.host}</span>
        {resource["board-name"] && <span>{resource["board-name"]}</span>}
        {resource.version && <span>ROS {resource.version}</span>}
        {resource["cpu-count"] && (
          <span>
            {resource["cpu-count"]} CPU · {resource.architecture}
          </span>
        )}
        {resource.uptime && (
          <span>
            uptime{" "}
            <span className="text-slate-300 font-mono font-medium">
              {resource.uptime}
            </span>
          </span>
        )}
      </div>

      {/* CPU + Memory + Storage */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-slate-400">CPU</span>
            <span
              className="text-xl font-bold font-mono tabular-nums"
              style={{ color: statusColor(cpuLoad) }}
            >
              {cpuLoad}%
            </span>
          </div>
          <div className="h-2 bg-slate-700/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${cpuLoad}%`,
                backgroundColor: statusColor(cpuLoad),
              }}
            />
          </div>
          <div className="text-xs text-slate-600 mt-1.5">
            {resource["cpu-frequency"]} MHz
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-slate-400">Memory</span>
            <span
              className="text-xl font-bold font-mono tabular-nums"
              style={{ color: statusColor(memPct) }}
            >
              {memPct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-slate-700/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${memPct}%`,
                backgroundColor: statusColor(memPct),
              }}
            />
          </div>
          <div className="text-xs text-slate-600 mt-1.5">
            {fmtBytes(usedMem)} / {fmtBytes(totalMem)}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-slate-400">Storage</span>
            <span className="text-xl font-bold font-mono tabular-nums text-slate-400">
              {hddPct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-slate-700/60 rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full rounded-full bg-slate-500 transition-all duration-700"
              style={{ width: `${hddPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-600">
            <span>{fmtBytes(totalHdd - freeHdd)} used</span>
            <span className="text-cyan-500 font-medium">
              {connectionCount} conn.
            </span>
          </div>
        </div>
      </div>

      {/* VPN — L2TP tuneli */}
      {(l2tpClients.length > 0 || pppActive.length > 0) && (
        <div className="mb-4">
          <div className="text-xs text-slate-500 mb-2">VPN / L2TP</div>
          <div className="space-y-1.5">
            {/* Klijentski tuneli (ovaj ruter se spaja na drugi) */}
            {l2tpClients.map((tunnel) => {
              const isUp = tunnel.running === "true";
              return (
                <div
                  key={tunnel.name}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-xs border ${
                    isUp
                      ? "bg-emerald-900/20 border-emerald-700/40"
                      : "bg-red-900/15 border-red-700/30"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isUp ? (
                      <ShieldCheck
                        size={13}
                        className="text-emerald-400 shrink-0"
                      />
                    ) : (
                      <ShieldOff size={13} className="text-red-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-mono text-slate-200 font-medium">
                        {tunnel.name}
                      </div>
                      <div className="text-slate-500 truncate">
                        → {tunnel["connect-to"]} · user: {tunnel.user}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div
                      className={`font-semibold ${isUp ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {isUp ? "Connected" : "Down"}
                    </div>
                    {tunnel.uptime && (
                      <div className="text-slate-600 font-mono">
                        {tunnel.uptime}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Aktivne PPP sesije (ovaj ruter je server) */}
            {pppActive.map((session, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs bg-blue-900/20 border border-blue-700/40"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck size={13} className="text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-mono text-slate-200 font-medium">
                      {session.name}
                    </div>
                    <div className="text-slate-500 truncate">
                      {session["caller-id"]} → {session.address}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="text-blue-400 font-semibold">Active</div>
                  {session.uptime && (
                    <div className="text-slate-600 font-mono">
                      {session.uptime}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {l2tpClients.length === 0 && pppActive.length === 0 && (
              <div className="text-slate-600 text-xs py-2 text-center">
                Nema aktivnih VPN sesija
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interfaces */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500">
            Interfaces
            <span className="text-slate-600 ml-1">
              ({interfaces.filter((i) => i.running === "true").length} active /{" "}
              {interfaces.length})
            </span>
          </span>
          {interfaces.length > 6 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {showAll ? "Prikaži manje" : `+${interfaces.length - 6} više`}
            </button>
          )}
        </div>

        {visibleIfaces.map((iface) => {
          const isUp = iface.running === "true";
          return (
            <div
              key={iface.name}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-opacity ${isUp ? "bg-slate-800/50" : "bg-slate-800/20 opacity-40"}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isUp ? (
                  <Wifi size={11} className="text-green-400 shrink-0" />
                ) : (
                  <WifiOff size={11} className="text-slate-600 shrink-0" />
                )}
                <span className="font-mono text-slate-200 truncate">
                  {iface.name}
                </span>
                {iface.comment && (
                  <span className="text-slate-600 truncate hidden sm:inline">
                    {iface.comment}
                  </span>
                )}
              </div>
              <div className="flex gap-3 font-mono shrink-0 ml-2">
                {isUp && (iface.rxRate > 0 || iface.txRate > 0) ? (
                  <>
                    <span className="text-cyan-400">
                      ↓ {fmtSpeed(iface.rxRate)}
                    </span>
                    <span className="text-orange-400">
                      ↑ {fmtSpeed(iface.txRate)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-600">
                      ↓ {fmtBytes(iface["rx-byte"])}
                    </span>
                    <span className="text-slate-600">
                      ↑ {fmtBytes(iface["tx-byte"])}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MikrotikCard({ data, showAll = false }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const current = data[activeTab] || data[0];

  if (showAll) {
    return (
      <div className="bg-[#111827] rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-orange-600/20">
            <Router size={15} className="text-orange-400" />
          </div>
          <h2 className="text-sm font-semibold text-white">MikroTik</h2>
        </div>

        <div className="space-y-4">
          {data.map((router) => (
            <div
              key={`${router.id}-panel`}
              className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-3"
            >
              <div className="flex items-center gap-2 mb-3">
                {router._error ? (
                  <AlertCircle size={12} className="text-red-400" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                )}
                <div className="text-sm font-semibold text-white">
                  {router.name}
                </div>
              </div>
              <RouterPanel router={router} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111827] rounded-xl border border-slate-700/50 p-4">
      {/* Header s tabovima */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-600/20">
            <Router size={15} className="text-orange-400" />
          </div>
          <h2 className="text-sm font-semibold text-white">MikroTik</h2>
        </div>

        {/* Tab dugmad */}
        <div className="flex gap-1">
          {data.map((router, i) => (
            <button
              key={router.id}
              onClick={() => setActiveTab(i)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeTab === i
                  ? "bg-orange-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {router._error ? (
                <AlertCircle size={11} className="text-red-400" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              )}
              {router.name}
            </button>
          ))}
        </div>
      </div>

      <RouterPanel router={current} />
    </div>
  );
}
