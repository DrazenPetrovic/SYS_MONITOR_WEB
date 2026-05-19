import React from 'react';
import { Server, Clock, Activity } from 'lucide-react';

export default function SystemInfo({ system, uptime, load }) {
  const items = [
    {
      icon: <Server size={14} className="text-blue-400" />,
      label: 'Hostname',
      value: system?.hostname || '—',
    },
    {
      label: 'OS',
      value: system?.linux_distro || system?.os_name || '—',
    },
    {
      icon: <Clock size={14} className="text-slate-400" />,
      label: 'Uptime',
      value: typeof uptime === 'string' ? uptime.replace(' 0:', ' ') : '—',
    },
    {
      icon: <Activity size={14} className="text-slate-400" />,
      label: 'Load avg',
      value: load
        ? `${load.min1?.toFixed(2)} · ${load.min5?.toFixed(2)} · ${load.min15?.toFixed(2)}`
        : '—',
      mono: true,
    },
  ];

  return (
    <div className="bg-[#111827] rounded-xl border border-slate-700/50 px-4 py-3 grid grid-cols-2 sm:flex sm:flex-wrap gap-x-6 gap-y-2">
      {items.map(({ icon, label, value, mono }) => (
        <div key={label} className="flex items-center gap-1.5 min-w-0">
          {icon}
          <span className="text-xs text-slate-500 shrink-0">{label}:</span>
          <span className={`text-xs font-medium text-slate-200 truncate ${mono ? 'font-mono' : ''}`}>
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}
