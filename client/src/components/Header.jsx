import React, { useState, useEffect } from 'react';
import { Server, LogOut, Wifi, WifiOff } from 'lucide-react';

export default function Header({ username, connected, onLogout }) {
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
            <div className="text-xs text-slate-500 font-mono hidden sm:block">94.130.111.127</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 md:gap-4">
          {/* Live indicator — uvijek vidljiv */}
          <div className={`flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-green-400' : 'text-red-400'}`}>
            {connected
              ? <><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /><span>Live</span></>
              : <><WifiOff size={13} /><span>Offline</span></>
            }
          </div>

          {/* Sat — samo na sm+ */}
          <span className="text-xs font-mono text-slate-400 tabular-nums hidden sm:inline">
            {now.toLocaleTimeString()}
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
