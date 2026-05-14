import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchMetrics, fetchMysql } from '../api/glances';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import SystemInfo from '../components/SystemInfo';
import CpuCard from '../components/CpuCard';
import MemoryCard from '../components/MemoryCard';
import NetworkCard from '../components/NetworkCard';
import DiskCard from '../components/DiskCard';
import ProcessCard from '../components/ProcessCard';
import MysqlCard from '../components/MysqlCard';

const MAX_HISTORY = 60;
const MAX_QPS_HISTORY = 60;

function timeLabel() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

export default function Dashboard() {
  const { username, logout } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [mysqlData, setMysqlData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const history = useRef({ cpu: [], netRx: [], netTx: [] });
  const mysqlPrev = useRef({ questions: null, time: null, qpsHistory: [] });

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchMetrics();
      const h = history.current;
      const t = timeLabel();

      h.cpu = [...h.cpu.slice(-(MAX_HISTORY - 1)), { t, v: data.cpu?.total ?? 0 }];

      const net = (data.network || []).reduce(
        (acc, iface) => ({
          rx: acc.rx + (iface.rx ?? iface.bytes_recv_rate_per_sec ?? 0),
          tx: acc.tx + (iface.tx ?? iface.bytes_sent_rate_per_sec ?? 0),
        }),
        { rx: 0, tx: 0 }
      );
      h.netRx = [...h.netRx.slice(-(MAX_HISTORY - 1)), { t, v: Math.round(net.rx / 1024) }];
      h.netTx = [...h.netTx.slice(-(MAX_HISTORY - 1)), { t, v: Math.round(net.tx / 1024) }];

      setMetrics({ ...data, _hist: { cpu: [...h.cpu], netRx: [...h.netRx], netTx: [...h.netTx] } });
      setConnected(true);
      setErrorMsg('');
    } catch (err) {
      setConnected(false);
      setErrorMsg(err.message || 'Connection failed');
    }
  }, []);

  const fetchMysqlData = useCallback(async () => {
    try {
      const data = await fetchMysql();
      const questions = parseInt(data.status?.Questions || 0);
      const now = Date.now();
      const p = mysqlPrev.current;

      let qps = 0;
      if (p.questions !== null && p.time !== null) {
        const dq = questions - p.questions;
        const dt = (now - p.time) / 1000;
        qps = dt > 0 ? Math.max(0, dq / dt) : 0;
      }
      p.questions = questions;
      p.time = now;
      p.qpsHistory = [...p.qpsHistory.slice(-(MAX_QPS_HISTORY - 1)), { t: timeLabel(), v: Math.round(qps) }];

      setMysqlData({ ...data, qps, qpsHistory: [...p.qpsHistory] });
    } catch {
      // MySQL not configured or down — show error state silently
      setMysqlData(prev => prev ? { ...prev, _error: true } : { _error: true });
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 2000);
    return () => clearInterval(id);
  }, [fetchData]);

  useEffect(() => {
    fetchMysqlData();
    const id = setInterval(fetchMysqlData, 5000);
    return () => clearInterval(id);
  }, [fetchMysqlData]);

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      <Header username={username} connected={connected} onLogout={logout} />

      <main className="p-3 md:p-4 lg:p-5 max-w-[1600px] mx-auto">
        {!metrics && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-white font-medium">Connecting to server...</p>
            {errorMsg && <p className="text-sm mt-1 text-red-400">{errorMsg}</p>}
          </div>
        )}

        {metrics && (
          <div className="space-y-3 md:space-y-4">
            <SystemInfo system={metrics.system} uptime={metrics.uptime} load={metrics.load} />

            <MysqlCard data={mysqlData} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
              <CpuCard cpu={metrics.cpu} history={metrics._hist.cpu} />
              <MemoryCard mem={metrics.mem} swap={metrics.memswap} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
              <NetworkCard
                network={metrics.network}
                histRx={metrics._hist.netRx}
                histTx={metrics._hist.netTx}
              />
              <DiskCard filesystems={metrics.fs} />
            </div>

            <ProcessCard processes={metrics.processlist} />
          </div>
        )}
      </main>
    </div>
  );
}
