import React, { useState, useEffect } from "react";
import { Server, LogOut } from "lucide-react";

export default function Header({ username, connected, serverHealth = [], onLogout }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-10 bg-[#0d1424]/95 backdrop-blur border-b border-slate-700/40 px-3 py-2.5">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 shrink-0">
            <Server size={13} className="text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">SYS Monitor</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 md:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            {serverHealth.slice(0, 3).map((server) => {
              const mysqlDotClass =
                server.mysqlStatus === "ok"
                  ? "bg-green-400"
                  : server.mysqlStatus === "not_configured"
                    ? "bg-slate-500"
                    : "bg-red-400";

              return (
                <div key={server.id} className="flex items-center gap-1.5">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${server.glancesOk ? "bg-green-400" : "bg-red-400"}`}
                    title={`${server.name} Glances`}
                  />
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${mysqlDotClass}`}
                    title={`${server.name} MySQL`}
                  />
                </div>
              );
            })}
          </div>

          {/* Sat — samo na sm+ */}
          <span className="text-xs font-mono text-slate-400 tabular-nums hidden sm:inline">
            {now.toLocaleTimeString("en-GB", { hour12: false })}
          </span>

          {/* Logout — ikona na mobitelu, tekst na sm+ */}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white active:text-white transition-colors text-xs p-1"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
