import React, { useState } from 'react';
import { List } from 'lucide-react';

function fmtMem(bytes) {
  if (!bytes) return '—';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}G`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)}M`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}K`;
  return `${bytes}B`;
}

const STATUS_COLORS = {
  R: 'text-green-400',
  S: 'text-slate-400',
  D: 'text-yellow-400',
  Z: 'text-red-400',
};

export default function ProcessCard({ processes }) {
  const [sortBy, setSortBy] = useState('cpu');

  const sorted = [...(processes || [])]
    .sort((a, b) => {
      const key = sortBy === 'cpu' ? 'cpu_percent' : 'memory_percent';
      return (b[key] || 0) - (a[key] || 0);
    })
    .slice(0, 20);

  return (
    <div className="bg-[#111827] rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-700/60">
            <List size={15} className="text-slate-400" />
          </div>
          <h2 className="text-sm font-semibold text-white">Processes</h2>
          <span className="text-xs text-slate-600">({(processes || []).length})</span>
        </div>
        <div className="flex gap-1">
          {['cpu', 'mem'].map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                sortBy === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs min-w-[480px]">
          <thead>
            <tr className="text-slate-500 border-b border-slate-700/50">
              <th className="text-left pb-2 pl-1 font-medium w-14">PID</th>
              <th className="text-left pb-2 font-medium">Name</th>
              <th className="text-left pb-2 font-medium hidden sm:table-cell">User</th>
              <th className="text-left pb-2 font-medium hidden md:table-cell w-8">St</th>
              <th className="text-right pb-2 font-medium w-16">CPU%</th>
              <th className="text-right pb-2 font-medium w-16">MEM%</th>
              <th className="text-right pb-2 pr-1 font-medium w-16 hidden md:table-cell">RSS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/25">
            {sorted.map((p, i) => (
              <tr key={`${p.pid}-${i}`} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-1.5 pl-1 font-mono text-slate-500">{p.pid}</td>
                <td className="py-1.5 font-mono text-slate-200 max-w-[140px] truncate pr-2">
                  {p.name}
                </td>
                <td className="py-1.5 text-slate-500 hidden sm:table-cell pr-2">{p.username}</td>
                <td className={`py-1.5 font-mono hidden md:table-cell ${STATUS_COLORS[p.status] || 'text-slate-500'}`}>
                  {p.status}
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  <span className={
                    (p.cpu_percent || 0) > 50 ? 'text-red-400' :
                    (p.cpu_percent || 0) > 20 ? 'text-yellow-400' : 'text-slate-300'
                  }>
                    {(p.cpu_percent || 0).toFixed(1)}
                  </span>
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">
                  <span className={(p.memory_percent || 0) > 10 ? 'text-orange-400' : 'text-slate-300'}>
                    {(p.memory_percent || 0).toFixed(1)}
                  </span>
                </td>
                <td className="py-1.5 pr-1 text-right font-mono text-slate-500 hidden md:table-cell">
                  {fmtMem(p.memory_info?.rss)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
