"use client";

import React, { useMemo } from "react";
import { apiGet, ApiException, ApiErrorType } from "../lib/api";
import { usePolling } from "../hooks/usePolling";
import { ServiceCategory } from "../types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, AlertCircle, CheckCircle, Gauge } from "lucide-react";
import { useContentTheme } from "../context/ContentThemeContext";
import { MT } from "../lib/mainTheme";
import type { Microservice } from "../types";

const CATEGORY_COLORS = {
  [ServiceCategory.DATA_COLLECTION]: "#60a5fa",
  [ServiceCategory.ANALYSIS_MODELING]: "#818cf8",
  [ServiceCategory.STRUCTURE_VISUALIZATION]: "#2dd4bf",
};

export const Dashboard: React.FC = () => {
  const { isLight } = useContentTheme();
  const { data: services, isLoading, error: pollingError, refetch } = usePolling(
    async () => {
      return await apiGet<Microservice[]>("/api/v1/microservices", {
        timeout: 10000,
        retry: {
          maxRetries: 2,
          initialDelay: 1000,
        },
      });
    },
    {
      interval: 10000, // 10초마다 업데이트 (기본 간격)
      enabled: true,
      retryOnError: true,
      maxRetries: 3,
      pauseOnHidden: true, // 탭이 비활성화되면 폴링 일시정지
      adaptiveInterval: true, // 적응형 폴링 활성화
      minInterval: 10000, // 최소 간격: 10초
      maxInterval: 30000, // 최대 간격: 30초
      // 데이터 변경 감지 (서비스 ID 기준)
      compareFn: (prev, next) => {
        if (!prev || prev.length !== next.length) return false;
        const prevIds = new Set(prev.map((s) => s.id));
        const nextIds = new Set(next.map((s) => s.id));
        if (prevIds.size !== nextIds.size) return false;
        for (const id of prevIds) {
          if (!nextIds.has(id)) return false;
        }
        // 모든 서비스의 상태와 메트릭 비교
        for (const prevService of prev) {
          const nextService = next.find((s) => s.id === prevService.id);
          if (!nextService) return false;
          if (
            prevService.status !== nextService.status ||
            prevService.metrics.latency !== nextService.metrics.latency ||
            prevService.metrics.throughput !== nextService.metrics.throughput ||
            prevService.metrics.errorRate !== nextService.metrics.errorRate
          ) {
            return false;
          }
        }
        return true;
      },
    }
  );

  // 에러 처리
  const error = pollingError
    ? (() => {
        if (pollingError instanceof ApiException) {
          let errorMessage = pollingError.message;
          switch (pollingError.type) {
            case ApiErrorType.NETWORK_ERROR:
            case ApiErrorType.CORS_ERROR:
              errorMessage = "서버에 연결할 수 없습니다. 네트워크 연결을 확인하세요.";
              break;
            case ApiErrorType.TIMEOUT:
              errorMessage = "요청 시간이 초과되었습니다. 잠시 후 다시 시도하세요.";
              break;
            case ApiErrorType.SERVER_ERROR:
              errorMessage = "서버 오류가 발생했습니다. 잠시 후 다시 시도하세요.";
              break;
            case ApiErrorType.CLIENT_ERROR:
              errorMessage = "요청 처리 중 오류가 발생했습니다.";
              break;
          }
          return errorMessage;
        }
        return pollingError.message;
      })()
    : null;

  const errorType = pollingError instanceof ApiException ? pollingError.type : null;

  const chartData = useMemo(() => {
    return (services ?? []).map((ms) => ({
      name: ms.name.split(" ").slice(0, 2).join(" "),
      latency: ms.metrics.latency,
      throughput: ms.metrics.throughput,
      color: CATEGORY_COLORS[ms.category],
    }));
  }, [services]);

  const systemHealth = useMemo(() => {
    if (!services || services.length === 0) return 0;
    return (services.filter((ms) => ms.status === "healthy").length / services.length) * 100;
  }, [services]);

  const totalThroughput = useMemo(() => {
    if (!services || services.length === 0) return 0;
    return services.reduce((sum, ms) => sum + ms.metrics.throughput, 0);
  }, [services]);

  if (error) {
    const isRetryable =
      errorType === ApiErrorType.NETWORK_ERROR ||
      errorType === ApiErrorType.TIMEOUT ||
      errorType === ApiErrorType.SERVER_ERROR ||
      errorType === null;

    return (
      <div className="bg-rose-500/10 border border-rose-500/20 text-rose-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold">Dashboard 데이터를 불러올 수 없습니다</p>
            <p className="text-xs opacity-80 mt-1">{error}</p>
            {errorType && (
              <p className="text-xs opacity-60 mt-1">에러 코드: {errorType}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          {isRetryable && (
            <button
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              {isLoading ? "재시도 중..." : "다시 시도"}
            </button>
          )}
          <button
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-500/20 hover:bg-slate-500/30 border border-slate-500/30"
            onClick={() => window.location.reload()}
          >
            페이지 새로고침
          </button>
        </div>
      </div>
    );
  }

  if (isLoading && !services) {
    return (
      <div className="space-y-4">
        <div className={MT.skeleton}>Loading dashboard data…</div>
      </div>
    );
  }

  if (!services) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="System Health"
          value={`${systemHealth.toFixed(1)}%`}
          icon={<Activity className="w-5 h-5" />}
          color="emerald"
        />
        <StatCard
          title="Active Services"
          value={services.length.toString()}
          icon={<CheckCircle className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Degraded Services"
          value={services.filter((ms) => ms.status === "degraded").length.toString()}
          icon={<AlertCircle className="w-5 h-5" />}
          color="amber"
        />
        <StatCard
          title="Total Traffic"
          value={
            totalThroughput >= 1000
              ? `${(totalThroughput / 1000).toFixed(1)}k req/s`
              : `${totalThroughput.toFixed(0)} req/s`
          }
          icon={<Gauge className="w-5 h-5" />}
          color="cyan"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency Distribution */}
        <div className={MT.chartCard}>
          <h3 className={MT.chartTitle}>
            <Activity className="w-5 h-5 text-blue-400" />
            Service Latency (ms)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isLight ? "#e2e8f0" : "#334155"}
                />
                <XAxis
                  dataKey="name"
                  stroke={isLight ? "#64748b" : "#94a3b8"}
                  fontSize={10}
                  tick={{ fill: isLight ? "#64748b" : "#94a3b8" }}
                />
                <YAxis
                  stroke={isLight ? "#64748b" : "#94a3b8"}
                  fontSize={10}
                  tick={{ fill: isLight ? "#64748b" : "#94a3b8" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isLight ? "#ffffff" : "#1e293b",
                    border: isLight ? "1px solid #e2e8f0" : "1px solid #334155",
                    borderRadius: "8px",
                  }}
                  itemStyle={{ color: isLight ? "#0f172a" : "#fff" }}
                />
                <Bar dataKey="latency">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Throughput Distribution */}
        <div className={MT.chartCard}>
          <h3 className={MT.chartTitle}>
            <Gauge className="w-5 h-5 text-cyan-400" />
            Aggregated Throughput (req/s)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isLight ? "#e2e8f0" : "#334155"}
                />
                <XAxis
                  dataKey="name"
                  stroke={isLight ? "#64748b" : "#94a3b8"}
                  fontSize={10}
                  tick={{ fill: isLight ? "#64748b" : "#94a3b8" }}
                />
                <YAxis
                  stroke={isLight ? "#64748b" : "#94a3b8"}
                  fontSize={10}
                  tick={{ fill: isLight ? "#64748b" : "#94a3b8" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isLight ? "#ffffff" : "#1e293b",
                    border: isLight ? "1px solid #e2e8f0" : "1px solid #334155",
                    borderRadius: "8px",
                  }}
                  itemStyle={{ color: isLight ? "#0f172a" : "#fff" }}
                />
                <Bar dataKey="throughput">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {services.map((ms) => (
          <div key={ms.id} className={MT.serviceCard}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className={MT.serviceName}>{ms.name}</h4>
                <p className="text-xs text-slate-400 truncate w-48 group-data-[theme=light]/main:text-slate-500">
                  {ms.description}
                </p>
              </div>
              <StatusBadge status={ms.status} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MetricItem label="Lat" value={`${ms.metrics.latency}ms`} />
              <MetricItem label="T-Put" value={`${ms.metrics.throughput}/s`} />
              <MetricItem label="Err" value={`${(ms.metrics.errorRate * 100).toFixed(1)}%`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}> = ({ title, value, icon, color }) => {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-400/10",
    blue: "text-blue-400 bg-blue-400/10",
    amber: "text-amber-400 bg-amber-400/10",
    cyan: "text-cyan-400 bg-cyan-400/10",
  };
  return (
    <div className={MT.statCard}>
      <div>
        <p className={MT.statLabel}>{title}</p>
        <p className={MT.statValue}>{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${colorMap[color] ?? ""}`}>{icon}</div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
      status === "healthy"
        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
        : status === "degraded"
          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
    }`}
  >
    {status}
  </span>
);

const MetricItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className={MT.metricBox}>
    <p className={MT.metricLabel}>{label}</p>
    <p className={MT.metricValue}>{value}</p>
  </div>
);

