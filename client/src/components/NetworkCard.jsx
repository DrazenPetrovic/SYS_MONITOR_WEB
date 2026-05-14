import React from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { Globe } from 'lucide-react';

function fmtSpeed(kbps) {
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} MB/s`;
  return `${kbps.toFixed(1)} KB/s`;
}

function mergeHistory(rx, tx) {
  const len = Math.max(rx.length, tx.length);
  return Array.from({ length: len }, (_, i) => ({
    t: rx[i]?.t || tx[i]?.t || '',
    rx: rx[i]?.v ?? 0,
    tx: tx[i]?.v ?? 0,
  }));
}

export default function NetworkCard({ network, histRx, histTx }) {
  const chartData = mergeHistory(histRx, histTx);
  const curRx = histRx[histRx.length - 1]?.v ?? 0;
  const curTx = histTx[histTx.length - 1]?.v ?? 0;

  const ifaces = (network || []).filter(i => !i.interface_name.startsWith('lo'));

  return (
    <div className="bg-[#111827] rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-600/20">
            <Globe size={15} className="text-cyan-400" />
          </div>
          <h2 className="text-sm font-semibold text-white">Network</h2>
        </div>
        <div className="flex gap-4 text-xs font-mono font-semibold">
          <span className="text-cyan-400">↓ {fmtSpeed(curRx)}</span>
          <span className="text-orange-400">↑ {fmtSpeed(curTx)}</span>
        </div>
      </div>

      {chartData.length > 2 && (
        <div className="h-24 mb-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gRx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gTx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '11px', padding: '4px 8px' }}
                formatter={(v, name) => [fmtSpeed(v), name === 'rx' ? '↓ Download' : '↑ Upload']}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="rx" stroke="#06b6d4" strokeWidth={1.5} fill="url(#gRx)" dot={false} isAnimationActive={false} />
              <Area type="monotone" dataKey="tx" stroke="#f97316" strokeWidth={1.5} fill="url(#gTx)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="space-y-1.5 max-h-36 overflow-y-auto">
        {ifaces.map(iface => {
          const rx = (iface.rx ?? iface.bytes_recv_rate_per_sec ?? 0) / 1024;
          const tx = (iface.tx ?? iface.bytes_sent_rate_per_sec ?? 0) / 1024;
          return (
            <div key={iface.interface_name} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-1.5 text-xs">
              <span className="font-mono text-slate-300">{iface.interface_name}</span>
              <div className="flex gap-4 font-mono font-medium">
                <span className="text-cyan-400">↓ {fmtSpeed(rx)}</span>
                <span className="text-orange-400">↑ {fmtSpeed(tx)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
