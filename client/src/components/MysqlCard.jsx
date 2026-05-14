import React from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { Database, AlertCircle } from 'lucide-react';

function n(val, fallback = 0) {
  const v = parseInt(val);
  return isNaN(v) ? fallback : v;
}

function fmtBytes(b) {
  b = parseInt(b) || 0;
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(0)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${b} B`;
}

function statusColor(pct) {
  if (pct >= 90) return '#ef4444';
  if (pct >= 70) return '#f59e0b';
  return '#22c55e';
}

function StatBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const c = color || statusColor(pct);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-mono font-semibold" style={{ color: c }}>
          {value} / {max} <span className="text-slate-500">({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: c }} />
      </div>
    </div>
  );
}

export default function MysqlCard({ data }) {
  if (!data) return null;

  if (data._error && !data.status) {
    return (
      <div className="bg-[#111827] rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-slate-700/60">
            <Database size={15} className="text-slate-500" />
          </div>
          <h2 className="text-sm font-semibold text-slate-400">MySQL</h2>
        </div>
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg p-3">
          <AlertCircle size={13} className="shrink-0" />
          <span>MySQL nije dostupan. Provjeri MYSQL_HOST, MYSQL_USER i MYSQL_PASS u server konfiguraciji.</span>
        </div>
      </div>
    );
  }

  const { status = {}, variables = {}, processlist = [], qps = 0, qpsHistory = [] } = data;

  const threadsConnected = n(status.Threads_connected);
  const threadsRunning   = n(status.Threads_running);
  const maxConnections   = n(variables.max_connections, 100);
  const slowQueries      = n(status.Slow_queries);
  const aborted          = n(status.Aborted_connects);
  const tableLocks       = n(status.Table_locks_waited);
  const uptime           = n(status.Uptime);

  const bpReadReq  = n(status.Innodb_buffer_pool_read_requests);
  const bpReads    = n(status.Innodb_buffer_pool_reads);
  const bpHitRate  = bpReadReq > 0 ? ((1 - bpReads / bpReadReq) * 100) : 100;
  const bpTotal    = n(status.Innodb_buffer_pool_pages_total);
  const bpFree     = n(status.Innodb_buffer_pool_pages_free);
  const bpUsedPct  = bpTotal > 0 ? ((bpTotal - bpFree) / bpTotal * 100) : 0;

  const comSelect = n(status.Com_select);
  const comInsert = n(status.Com_insert);
  const comUpdate = n(status.Com_update);
  const comDelete = n(status.Com_delete);

  const uptimeStr = (() => {
    const d = Math.floor(uptime / 86400);
    const h = Math.floor((uptime % 86400) / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
  })();

  return (
    <div className="bg-[#111827] rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-600/20">
            <Database size={15} className="text-emerald-400" />
          </div>
          <h2 className="text-sm font-semibold text-white">MySQL</h2>
          <span className="text-xs text-slate-500">{variables.version}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>uptime <span className="text-slate-200 font-mono">{uptimeStr}</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Left: connections + bars */}
        <div className="space-y-3">
          <StatBar label="Connections" value={threadsConnected} max={maxConnections} />
          <StatBar label="InnoDB Buffer Pool Used" value={bpUsedPct.toFixed(1) * 1} max={100} color="#3b82f6" />
          <StatBar
            label="Buffer Pool Hit Rate"
            value={bpHitRate.toFixed(2) * 1}
            max={100}
            color={bpHitRate >= 99 ? '#22c55e' : bpHitRate >= 95 ? '#f59e0b' : '#ef4444'}
          />
        </div>

        {/* Right: stat boxes */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Threads Running', value: threadsRunning, alert: threadsRunning > 10 },
            { label: 'QPS', value: qps.toFixed(1), mono: true },
            { label: 'Slow Queries', value: slowQueries, alert: slowQueries > 0 },
            { label: 'Lock Waits', value: tableLocks, alert: tableLocks > 0 },
            { label: 'Aborted Conn.', value: aborted, alert: aborted > 0 },
            { label: 'Buffer Pool', value: fmtBytes(variables.innodb_buffer_pool_size), mono: true },
          ].map(({ label, value, alert, mono }) => (
            <div key={label} className="bg-slate-800/60 rounded-lg p-2.5 text-center">
              <div className="text-xs text-slate-500 mb-0.5">{label}</div>
              <div className={`text-sm font-semibold ${mono ? 'font-mono' : ''} ${alert ? 'text-yellow-400' : 'text-slate-200'}`}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QPS history chart */}
      {qpsHistory.length > 2 && (
        <div className="mb-4">
          <div className="text-xs text-slate-500 mb-1">Queries / sec</div>
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={qpsHistory} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gQps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '11px', padding: '4px 8px' }}
                  formatter={v => [`${v} q/s`, 'QPS']}
                  labelStyle={{ color: '#94a3b8' }}
                  itemStyle={{ color: '#4ade80' }}
                />
                <Area type="monotone" dataKey="v" stroke="#22c55e" strokeWidth={1.5} fill="url(#gQps)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Query type breakdown */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: 'SELECT', value: comSelect, color: 'text-blue-400' },
          { label: 'INSERT', value: comInsert, color: 'text-green-400' },
          { label: 'UPDATE', value: comUpdate, color: 'text-yellow-400' },
          { label: 'DELETE', value: comDelete, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-800/60 rounded-lg py-2 text-center">
            <div className={`text-xs font-semibold ${color} mb-0.5`}>{label}</div>
            <div className="text-xs font-mono text-slate-300">{value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Active processlist */}
      {processlist.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 mb-2">Active Queries ({processlist.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[480px]">
              <thead>
                <tr className="text-slate-500 border-b border-slate-700/50">
                  <th className="text-left pb-1.5 font-medium">User</th>
                  <th className="text-left pb-1.5 font-medium">DB</th>
                  <th className="text-left pb-1.5 font-medium">Command</th>
                  <th className="text-right pb-1.5 font-medium w-12">Time</th>
                  <th className="text-left pb-1.5 font-medium pl-3">Query</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/25">
                {processlist.map(p => (
                  <tr key={p.ID} className="hover:bg-slate-800/30">
                    <td className="py-1.5 text-slate-300 font-mono">{p.USER}</td>
                    <td className="py-1.5 text-slate-400">{p.DB || '—'}</td>
                    <td className="py-1.5 text-slate-400">{p.COMMAND}</td>
                    <td className={`py-1.5 text-right font-mono tabular-nums ${p.TIME > 5 ? 'text-yellow-400' : 'text-slate-400'}`}>
                      {p.TIME}s
                    </td>
                    <td className="py-1.5 pl-3 text-slate-500 font-mono truncate max-w-[200px]">
                      {p.INFO || p.STATE || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
