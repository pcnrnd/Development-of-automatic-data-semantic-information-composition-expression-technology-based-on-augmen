import React from 'react';
import { motion } from 'motion/react';
import {
  Download,
  Filter,
  BrainCircuit,
  Eye,
} from 'lucide-react';
import { Card, SectionHeader, Badge, LabeledProgressBar, Chip, Metric } from './ui';

const BOTTOM_STATS = [
  { label: 'CPU Load',     value: '42%',    status: 'Optimal',   color: 'text-accent' },
  { label: 'MEM Usage',   value: '6.8 GB',  status: '/ 16 GB',   color: 'text-text-dim' },
  { label: 'Latency',     value: '12ms',    status: 'Stable',    color: 'text-accent' },
  { label: 'Error Rate',  value: '0.02%',   status: 'Last 24h',  color: 'text-text-dim' },
  { label: 'Node Count',  value: '24',      status: '3 Pending', color: 'text-accent' },
  { label: 'Global Health', value: 'NOMINAL', status: '',        color: 'text-accent' },
] as const;

export const ArchitectureView = () => {
  return (
    <div className="space-y-8">
      <SectionHeader
        subtitle="Architecture Overview"
        title="데이터 라이프사이클"
        right={<Badge variant="accent" dot pulse>Live Streaming</Badge>}
        size="md"
      />

      <div className="grid grid-cols-12 gap-6">
        {/* Ingestion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-12 lg:col-span-2"
        >
          <Card dim className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-dim uppercase tracking-wide">01. Ingestion</span>
              <Download className="w-4 h-4 text-accent" />
            </div>
            <div className="space-y-3 mt-2">
              {[
                { label: 'Sensors', value: 'Edge Connect' },
                { label: 'Log Files', value: 'FluentD Mesh' },
              ].map(item => (
                <div key={item.label} className="p-3 bg-primary rounded-lg border border-white/5">
                  <p className="text-[11px] uppercase tracking-wide opacity-60 mb-1">{item.label}</p>
                  <p className="text-xs font-semibold text-text-bright">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-auto pt-4 border-t border-white/5">
              <Metric label="Throughput" value="14.2 GB/s" size="sm" statusColor="text-accent" />
            </div>
          </Card>
        </motion.div>

        {/* Refinement */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="col-span-12 lg:col-span-3"
        >
          <Card dim className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-semibold text-text-dim uppercase tracking-wide">02. Refinement</span>
              <Filter className="w-4 h-4 text-accent" />
            </div>
            <div className="space-y-5">
              <LabeledProgressBar label="Data Cleaning"   valueLabel="99.8% OK" value={99.8} />
              <LabeledProgressBar label="Deduplication"  valueLabel="Active"    value={85} />
            </div>
            <div className="mt-auto flex gap-2 pt-6">
              <Chip>SPARK-SQL</Chip>
              <Chip>DBT</Chip>
            </div>
          </Card>
        </motion.div>

        {/* Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="col-span-12 lg:col-span-4 bg-gradient-to-br from-surface-card to-primary rounded-xl p-6 border border-white/10 shadow-md"
        >
          <div className="flex items-start justify-between mb-8">
            <div>
              <span className="text-xs font-semibold text-accent uppercase tracking-wide">03-04. Analysis & Info</span>
              <h4 className="text-xl font-semibold text-text-bright mt-1 font-headline tracking-normal">분석 및 정보화 엔진</h4>
            </div>
            <BrainCircuit className="w-8 h-8 text-accent opacity-80" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { heading: 'Core Logic',     body: 'Predictive Maintenance v4', note: 'Accuracy: 94.2%' },
              { heading: 'Semantic Layer', body: 'Graph Knowledge Base',      note: 'Nodes: 1.2M' },
            ].map(item => (
              <div key={item.heading} className="bg-white/5 p-4 rounded-xl border border-white/5">
                <span className="text-[11px] text-text-dim/60 block mb-2 uppercase tracking-wide font-medium">{item.heading}</span>
                <p className="text-xs text-text-bright font-medium">{item.body}</p>
                <p className="text-[11px] text-accent mt-2">{item.note}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex items-center gap-3">
            <div className="flex-1 h-12 bg-white/5 rounded-lg flex items-center justify-center border border-white/10 italic text-xs text-text-dim/50">
              Processing Flow Visualization...
            </div>
            <button type="button" className="px-5 py-2.5 bg-accent text-primary rounded-lg font-semibold text-xs tracking-wide hover:brightness-110 transition-all">
              Re-Sync
            </button>
          </div>
        </motion.div>

        {/* Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="col-span-12 lg:col-span-3"
        >
          <Card dim className="h-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-text-dim uppercase tracking-wide">05. Visualization</span>
              <Eye className="w-4 h-4 text-accent" />
            </div>
            <div className="flex h-32 w-full items-center justify-center rounded-lg border border-white/5 bg-primary">
              <span className="text-xs text-surface-muted">대시보드 미리보기</span>
            </div>
            <div className="mt-6 space-y-3">
              {[
                { label: 'Active Dashboards',   value: '12 Active', color: 'text-text-bright' },
                { label: 'API Endpoint Health', value: '99.9%',     color: 'text-accent' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center text-xs">
                  <span className="text-surface-muted">{item.label}</span>
                  <span className={`font-semibold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Stats */}
      <Card dim className="!p-6 !rounded-2xl">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
          {BOTTOM_STATS.map(stat => (
            <Metric
              key={stat.label}
              label={stat.label}
              value={stat.value}
              status={stat.status || undefined}
              statusColor={stat.color}
              size="sm"
            />
          ))}
        </div>
      </Card>
    </div>
  );
};
