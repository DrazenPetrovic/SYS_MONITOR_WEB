import React from 'react';
import { HardDrive } from 'lucide-react';

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
  return '#f97316';
}

export default function DiskCard({ filesystems }) {
  const fsList = (filesystems || []).filter(fs => fs.size > 0);

  return (
    <div className="bg-[#111827] rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-orange-600/20">
          <HardDrive size={15} className="text-orange-400" />
        </div>
        <h2 className="text-sm font-semibold text-white">Disk</h2>
      </div>

      {fsList.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-6">No filesystem data</p>
      )}

      <div className="space-y-4">
        {fsList.map(fs => {
          const pct = fs.percent ?? 0;
          const color = statusColor(pct);
          return (
            <div key={fs.mnt_point}>
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <span className="text-sm font-mono font-medium text-slate-200">{fs.mnt_point}</span>
                  <span className="text-xs text-slate-500 ml-2">{fs.device_name}</span>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className="text-sm font-bold font-mono tabular-nums" style={{ color }}>
                    {pct.toFixed(1)}%
                  </span>
                  <div className="text-xs text-slate-500 font-mono">
                    {fmtBytes(fs.used)} / {fmtBytes(fs.size)}
                  </div>
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
        })}
      </div>
    </div>
  );
}
