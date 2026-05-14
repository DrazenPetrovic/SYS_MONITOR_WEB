import React, { useState, useEffect } from 'react';
import { Server, LogOut, Wifi, WifiOff } from 'lucide-react';

export default function Header({ username, connected, onLogout }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-10 bg-[#0d1424]/95 backdrop-blur border-b border-slate-700/40 px-4 py-3">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 shrink-0">
            <Server size={15} className="text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-white">SYS Monitor</div>
            <div className="text-xs text-slate-500 font-mono">94.130.111.127</div>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-green-400' : 'text-red-400'}`}>
            {connected
              ? <><div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /><span className="hidden sm:inline">Live</span></>
              : <><WifiOff size={13} /><span className="hidden sm:inline">Offline</span></>
            }
          </div>

          <span className="text-xs font-mono text-slate-400 tabular-nums hidden sm:inline">
            {now.toLocaleTimeString()}
          </span>

          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-xs hidden md:inline">{username}</span>
            <button
              onClick={onLogout}
              className="flex items-center gap-1 hover:text-white transition-colors text-xs"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
