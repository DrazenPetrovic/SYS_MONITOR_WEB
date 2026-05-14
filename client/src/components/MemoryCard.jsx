import React from 'react';
import { Layers } from 'lucide-react';

function fmtBytes(b, d = 1) {
  if (!b || b === 0) return '0 B';
  const k = 1024;
  const s = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / k ** i).toFixed(d)} ${s[i]}`;
}

function statusColor(pct) {
  if (pct >= 90) return '#ef4444';
  if (pct >= 75) return '#f59e0b';
  return '#a855f7';
}

function MemBar({ label, used, total, pct }) {
  const color = statusColor(pct);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-400 font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono hidden sm:inline">{fmtBytes(used)} / {fmtBytes(total)}</span>
          <span className="text-sm font-bold font-mono tabular-nums w-14 text-right" style={{ color }}>
            {pct.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="h-2 bg-slate-700/60 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function MemoryCard({ mem, swap }) {
  return (
    <div className="bg-[#111827] rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-purple-600/20">
          <Layers size={15} className="text-purple-400" />
        </div>
        <h2 className="text-sm font-semibold text-white">Memory</h2>
      </div>

      <div className="space-y-4">
        <MemBar label="RAM" used={mem?.used} total={mem?.total} pct={mem?.percent ?? 0} />
        <MemBar label="Swap" used={swap?.used} total={swap?.total} pct={swap?.percent ?? 0} />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {[
          { label: 'Used', value: fmtBytes(mem?.used) },
          { label: 'Free', value: fmtBytes(mem?.free) },
          { label: 'Cached', value: fmtBytes(mem?.cached ?? mem?.buffers) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-slate-800/60 rounded-lg py-2 text-center">
            <div className="text-xs text-slate-500 mb-0.5">{label}</div>
            <div className="text-sm font-mono font-semibold text-slate-200">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
