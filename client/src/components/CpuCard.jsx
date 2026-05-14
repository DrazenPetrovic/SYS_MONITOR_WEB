import React from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { Cpu } from 'lucide-react';

function statusColor(pct) {
  if (pct >= 90) return '#ef4444';
  if (pct >= 70) return '#f59e0b';
  return '#3b82f6';
}

export default function CpuCard({ cpu, history }) {
  const pct = cpu?.total ?? 0;
  const color = statusColor(pct);

  return (
    <div className="bg-[#111827] rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-600/20">
            <Cpu size={15} className="text-blue-400" />
          </div>
          <h2 className="text-sm font-semibold text-white">CPU</h2>
        </div>
        <span className="text-3xl font-bold font-mono tabular-nums" style={{ color }}>
          {pct.toFixed(1)}<span className="text-lg">%</span>
        </span>
      </div>

      <div className="h-2 bg-slate-700/60 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: 'User', value: cpu?.user },
          { label: 'System', value: cpu?.system },
          { label: 'IOWait', value: cpu?.iowait },
          { label: 'Idle', value: cpu?.idle },
        ].map(({ label, value }) => (
          <div key={label} className="bg-slate-800/60 rounded-lg py-2 text-center">
            <div className="text-xs text-slate-500 mb-0.5">{label}</div>
            <div className="text-sm font-mono font-semibold text-slate-200">
              {(value ?? 0).toFixed(1)}%
            </div>
          </div>
        ))}
      </div>

      {history.length > 2 && (
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gCpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={[0, 100]} hide />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '11px', padding: '4px 8px' }}
                labelFormatter={l => `Time: ${l}`}
                formatter={v => [`${Number(v).toFixed(1)}%`, 'CPU']}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#60a5fa' }}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke="#3b82f6"
                strokeWidth={1.5}
                fill="url(#gCpu)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
