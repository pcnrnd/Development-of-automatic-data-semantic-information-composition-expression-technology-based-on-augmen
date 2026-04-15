"use client";

import React, { useEffect, useState } from "react";
import { checkConnection, type ConnectionStatus } from "../lib/api";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";

/**
 * 백엔드 연결 상태 표시 컴포넌트
 * 
 * 주기적으로 헬스체크를 수행하여 FastAPI 서버 연결 상태를 표시합니다.
 */
export const ConnectionStatusComponent: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>("checking");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let cancelled = false;

    const performCheck = async () => {
      if (cancelled) return;
      
      setStatus("checking");
      const result = await checkConnection(5000);
      
      if (!cancelled) {
        setStatus(result);
        setLastChecked(new Date());
      }
    };

    // 초기 체크
    performCheck();

    // 주기적 체크 (10초마다)
    intervalId = setInterval(performCheck, 10000);

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          text: "Connected",
          className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
        };
      case "disconnected":
        return {
          icon: <XCircle className="w-4 h-4" />,
          text: "Disconnected",
          className: "text-rose-400 bg-rose-400/10 border-rose-400/20",
        };
      case "checking":
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          text: "Checking...",
          className: "text-blue-400 bg-blue-400/10 border-blue-400/20",
        };
      case "error":
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          text: "Error",
          className: "text-amber-400 bg-amber-400/10 border-amber-400/20",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${config.className}`}
      title={
        lastChecked
          ? `Last checked: ${lastChecked.toLocaleTimeString()}`
          : "Checking connection status..."
      }
    >
      {config.icon}
      <span className="hidden sm:inline">{config.text}</span>
    </div>
  );
};
