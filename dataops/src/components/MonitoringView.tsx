import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Zap,
  Shield,
  BarChart3,
  PieChart
} from 'lucide-react';

/** 네트워크 처리량 차트용 결정론적 데모 시계열(리렌더·Strict Mode에서도 동일) */
function buildThroughputDemoPoints(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    const ingress = Math.round(
      38 + 32 * Math.sin(t * Math.PI * 2.2 + 0.4) + 12 * Math.sin(t * Math.PI * 6),
    );
    const egress = Math.round(
      28 + 22 * Math.cos(t * Math.PI * 1.8 + 1) + 10 * Math.sin(t * Math.PI * 5),
    );
    return {
      ingress: Math.min(95, Math.max(22, ingress)),
      egress: Math.min(88, Math.max(18, egress)),
    };
  });
}

export const MonitoringView = () => {
  const throughputBars = useMemo(() => buildThroughputDemoPoints(40), []);

  const alerts = [
    { id: 'AL-992', severity: 'critical', msg: 'Node Cluster B-04 High Memory Usage', time: '2m ago' },
    { id: 'AL-991', severity: 'warning', msg: 'Latency spike in API Gateway (EU-West)', time: '15m ago' },
    { id: 'AL-990', severity: 'info', msg: 'Scheduled maintenance complete: DB-Cluster-01', time: '1h ago' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-text-bright mb-2 font-headline">실시간 모니터링 및 관제</h1>
          <p className="text-sm text-text-dim tracking-normal">전체 시스템 텔레메트리 데이터 및 지능형 장애 감지 현황</p>
        </div>
        <div className="flex gap-2 bg-surface-card/50 p-1 rounded-xl border border-white/5">
          {['1H', '6H', '24H', '7D'].map((t) => (
            <button type="button" key={t} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${t === '1H' ? 'bg-accent text-primary' : 'text-text-dim hover:bg-white/5'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Health Score */}
        <div className="col-span-12 lg:col-span-4 bg-surface-card p-8 rounded-xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4">
            <Shield className="w-6 h-6 text-accent opacity-20" />
          </div>
          <h3 className="text-xs font-semibold text-text-dim uppercase tracking-wide mb-6">System Health Index</h3>
          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle cx="96" cy="96" r="88" fill="none" stroke="currentColor" strokeWidth="12" className="text-primary" />
                <motion.circle 
                  cx="96" cy="96" r="88" fill="none" stroke="currentColor" strokeWidth="12" 
                  strokeDasharray="552.92"
                  initial={{ strokeDashoffset: 552.92 }}
                  animate={{ strokeDashoffset: 552.92 * (1 - 0.98) }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="text-accent" 
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-bold text-text-bright font-headline">98</span>
                <span className="text-xs font-medium text-accent uppercase tracking-wide">Optimal</span>
              </div>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/5 pt-6">
            <div className="text-center">
              <p className="text-[11px] text-surface-muted font-medium uppercase tracking-wide mb-1">Uptime</p>
              <p className="text-sm font-bold text-text-bright">99.99%</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-surface-muted font-medium uppercase tracking-wide mb-1">MTTR</p>
              <p className="text-sm font-bold text-text-bright">14m</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-surface-muted font-medium uppercase tracking-wide mb-1">Incidents</p>
              <p className="text-sm font-bold text-text-bright">0</p>
            </div>
          </div>
        </div>

        {/* Throughput Chart */}
        <div className="col-span-12 lg:col-span-8 bg-surface-card p-8 rounded-xl border border-white/5">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h3 className="text-base font-semibold text-text-bright font-headline">Network Throughput</h3>
              <p className="text-xs text-text-dim mt-1 tracking-normal">글로벌 게이트웨이 인입·인출 처리량</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-[11px] font-medium text-text-dim uppercase tracking-wide">Ingress</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white/20" />
                <span className="text-[11px] font-medium text-text-dim uppercase tracking-wide">Egress</span>
              </div>
            </div>
          </div>
          <div className="relative flex h-56 gap-1">
            <div className="pointer-events-none absolute inset-0 z-0 blueprint-grid opacity-[0.35]" />
            {throughputBars.map((bar, i) => (
              <div
                key={i}
                className="relative z-10 flex h-full min-h-0 min-w-0 flex-1 flex-col justify-end gap-0.5 group"
              >
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${bar.ingress}%` }}
                  transition={{ duration: 0.45, ease: 'easeOut', delay: i * 0.012 }}
                  className="w-full min-h-[2px] rounded-t-[2px] bg-accent/75 group-hover:bg-accent transition-colors"
                />
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${bar.egress}%` }}
                  transition={{ duration: 0.45, ease: 'easeOut', delay: i * 0.012 }}
                  className="w-full min-h-[2px] rounded-b-[2px] bg-white/20 group-hover:bg-white/35 transition-colors"
                />
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-between text-[11px] font-medium text-surface-muted uppercase tracking-wide">
            <span>14:00</span>
            <span>14:15</span>
            <span>14:30</span>
            <span>14:45</span>
            <span>15:00</span>
          </div>
        </div>

        {/* Alerts Panel */}
        <div className="col-span-12 lg:col-span-5 bg-surface-card rounded-xl border border-white/5 overflow-hidden flex flex-col">
          <div className="px-6 py-4 bg-primary/50 border-b border-white/5 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold uppercase tracking-wide text-text-bright">Active Alerts</span>
            </div>
            <span className="bg-red-500 text-white text-[11px] px-2 py-0.5 rounded-full font-semibold">3 NEW</span>
          </div>
          <div className="divide-y divide-white/5">
            {alerts.map((alert) => (
              <div key={alert.id} className="p-6 hover:bg-white/5 transition-colors group">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      alert.severity === 'critical' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 
                      alert.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <span className="text-xs font-mono font-semibold text-surface-muted">{alert.id}</span>
                  </div>
                  <span className="text-xs text-surface-muted font-medium">{alert.time}</span>
                </div>
                <p className="text-xs font-medium text-text-bright group-hover:text-accent transition-colors">{alert.msg}</p>
              </div>
            ))}
          </div>
          <button type="button" className="mt-auto p-4 text-xs font-medium text-text-dim tracking-wide hover:bg-white/5 transition-colors border-t border-white/5">
            View Alert Archive
          </button>
        </div>

        {/* Resource Usage */}
        <div className="col-span-12 lg:col-span-7 grid grid-cols-2 gap-6">
          {[
            { label: 'CPU Cluster Load', value: '42%', icon: Zap, color: 'text-accent', data: [40, 35, 45, 42, 38, 42] },
            { label: 'Memory Allocation', value: '68%', icon: BarChart3, color: 'text-accent', data: [60, 62, 65, 68, 67, 68] },
            { label: 'Storage I/O', value: '1.2 GB/s', icon: Activity, color: 'text-accent', data: [0.8, 1.0, 1.4, 1.2, 1.1, 1.2] },
            { label: 'Active Sessions', value: '12.4k', icon: PieChart, color: 'text-accent', data: [10, 11, 13, 12, 12, 12.4] },
          ].map((item, i) => (
            <div key={i} className="bg-surface-card p-6 rounded-xl border border-white/5">
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center border border-white/5">
                  <item.icon className="w-5 h-5 text-accent" />
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-medium text-surface-muted uppercase tracking-wide mb-1">{item.label}</p>
                  <p className="text-xl font-bold text-text-bright">{item.value}</p>
                </div>
              </div>
              <div className="h-12 flex items-end gap-1">
                {item.data.map((v, j) => (
                  <div 
                    key={j} 
                    className="flex-1 bg-accent/20 rounded-t-sm" 
                    style={{ height: `${(v / Math.max(...item.data)) * 100}%` }} 
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
