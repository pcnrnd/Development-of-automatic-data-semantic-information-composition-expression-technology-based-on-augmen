"use client";

import React, { useEffect, useState } from "react";
import {
  Braces,
  Key,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Loader2,
  SlidersHorizontal,
  X,
  Network,
} from "lucide-react";
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  ApiException,
  ApiErrorType,
  clearStoredAccessToken,
  fetchAuthMe,
  getStoredAccessToken,
  issueAccessToken,
  setStoredAccessToken,
  type AuthTokenRequest,
} from "../lib/api";
import { useToast } from "../hooks/useToast";
import { MT } from "../lib/mainTheme";
import type { Microservice } from "../types";

/**
 * 인증Key 타입 정의
 */
interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed?: string;
  status: "active" | "revoked";
  permissions: string[];
}

/**
 * 외부 API 서비스 타입 정의
 */
interface ExternalApiService {
  id: string;
  name: string;
  endpoint: string;
  status: "allowed" | "blocked" | "limited";
  rateLimit?: number;
  rateLimitWindowSeconds?: number;
  description: string;
  // 포트포워딩 설정
  targetHost?: string | null;
  targetPort?: number | null;
  targetPath?: string | null;
  protocol?: string;
  targetServiceId?: string | null;
}

/**
 * Security & Access 컴포넌트
 * 외부 게이트웨이 관리: 인증Key 발급 및 외부 API 서비스 허용/차단/제한 기능
 */
export const SecurityAccess: React.FC = () => {
  const { showToast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiServices, setApiServices] = useState<ExternalApiService[]>([]);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newKeyName, setNewKeyName] = useState("");
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [isUpdatingService, setIsUpdatingService] = useState<Record<string, boolean>>({});
  const [isDeletingService, setIsDeletingService] = useState<Record<string, boolean>>({});
  const [showRateLimitModal, setShowRateLimitModal] = useState(false);
  const [editingService, setEditingService] = useState<ExternalApiService | null>(null);
  const [rateLimitValue, setRateLimitValue] = useState<string>("");
  const [rateLimitWindow, setRateLimitWindow] = useState<"60" | "3600">("3600");
  const [showCreateServiceModal, setShowCreateServiceModal] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceEndpoint, setNewServiceEndpoint] = useState("");
  const [newServiceDescription, setNewServiceDescription] = useState("");
  const [newServiceStatus, setNewServiceStatus] = useState<"allowed" | "blocked" | "limited">("allowed");
  const [newServiceRateLimit, setNewServiceRateLimit] = useState<string>("");
  const [newServiceWindow, setNewServiceWindow] = useState<"60" | "3600">("3600");
  const [isCreatingService, setIsCreatingService] = useState(false);
  // 포트포워딩 설정
  const [microservices, setMicroservices] = useState<Microservice[]>([]);
  const [isLoadingMicroservices, setIsLoadingMicroservices] = useState(false);
  const [newServiceTargetHost, setNewServiceTargetHost] = useState<string>("");
  const [newServiceTargetPort, setNewServiceTargetPort] = useState<string>("");
  const [newServiceTargetPath, setNewServiceTargetPath] = useState<string>("");
  const [newServiceProtocol, setNewServiceProtocol] = useState<"http" | "https">("http");
  const [newServiceTargetServiceId, setNewServiceTargetServiceId] = useState<string>("");

  /** JWT 발급 UI */
  const [jwtGrant, setJwtGrant] = useState<"api_key" | "password">("api_key");
  const [jwtApiKeyInput, setJwtApiKeyInput] = useState("");
  const [jwtUsername, setJwtUsername] = useState("");
  const [jwtPassword, setJwtPassword] = useState("");
  const [jwtBusy, setJwtBusy] = useState(false);
  const [jwtExpiresIn, setJwtExpiresIn] = useState<number | null>(null);
  const [jwtMeSub, setJwtMeSub] = useState<string | null>(null);
  const [jwtMeTyp, setJwtMeTyp] = useState<string | null>(null);
  const [jwtShowToken, setJwtShowToken] = useState(false);

  /**
   * 저장된 JWT로 /auth/me 검증(표시용)
   */
  const refreshJwtMe = async () => {
    const t = getStoredAccessToken();
    if (!t) {
      setJwtMeSub(null);
      setJwtMeTyp(null);
      return;
    }
    try {
      const me = await fetchAuthMe();
      setJwtMeSub(me.sub);
      setJwtMeTyp(me.typ);
    } catch {
      setJwtMeSub(null);
      setJwtMeTyp(null);
      clearStoredAccessToken();
    }
  };

  useEffect(() => {
    void refreshJwtMe();
    // 마운트 시 저장 토큰만 확인
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshJwtMe는 표시용 1회 호출
  }, []);

  /**
   * JWT 발급 후 sessionStorage 저장 및 요약 갱신
   */
  const handleIssueJwt = async () => {
    if (jwtGrant === "api_key" && !jwtApiKeyInput.trim()) {
      showToast("error", "API Key 전체 문자열을 입력한 뒤 발급하세요.");
      return;
    }
    if (jwtGrant === "password" && (!jwtUsername.trim() || jwtPassword === "")) {
      showToast("error", "사용자명과 비밀번호를 입력하세요.");
      return;
    }
    setJwtBusy(true);
    try {
      const body: AuthTokenRequest =
        jwtGrant === "api_key"
          ? { grant_type: "api_key", api_key: jwtApiKeyInput.trim() }
          : {
              grant_type: "password",
              username: jwtUsername.trim(),
              password: jwtPassword,
            };
      const data = await issueAccessToken(body);
      setStoredAccessToken(data.access_token);
      setJwtExpiresIn(data.expires_in);
      setJwtApiKeyInput("");
      setJwtPassword("");
      showToast("success", "액세스 토큰이 발급되어 브라우저에 저장되었습니다.");
      await refreshJwtMe();
    } catch (err) {
      const msg =
        err instanceof ApiException
          ? err.message
          : "토큰 발급 중 오류가 발생했습니다.";
      showToast("error", msg);
    } finally {
      setJwtBusy(false);
    }
  };

  /**
   * 인증Key 목록 로드
   */
  const loadApiKeys = async () => {
    try {
      setIsLoadingKeys(true);
      setError(null);
      const data = await apiGet<ApiKey[]>("/api/v1/security/api-keys", {
        timeout: 10000,
        retry: {
          maxRetries: 2,
          initialDelay: 1000,
        },
      });
      setApiKeys(data);
    } catch (err) {
      const errorMessage =
        err instanceof ApiException
          ? err.message
          : "인증Key 목록을 불러오는 중 오류가 발생했습니다.";
      setError(errorMessage);
      showToast("error", errorMessage);
      console.error("Failed to load API keys:", err);
    } finally {
      setIsLoadingKeys(false);
    }
  };

  /**
   * 외부 API 서비스 목록 로드
   */
  const loadApiServices = async () => {
    try {
      setIsLoadingServices(true);
      setError(null);
      const data = await apiGet<ExternalApiService[]>("/api/v1/security/external-services", {
        timeout: 10000,
        retry: {
          maxRetries: 2,
          initialDelay: 1000,
        },
      });
      setApiServices(data);
    } catch (err) {
      const errorMessage =
        err instanceof ApiException
          ? err.message
          : "외부 API 서비스 목록을 불러오는 중 오류가 발생했습니다.";
      setError(errorMessage);
      showToast("error", errorMessage);
      console.error("Failed to load external services:", err);
    } finally {
      setIsLoadingServices(false);
    }
  };

  /**
   * 마이크로서비스 목록 로드
   */
  const loadMicroservices = async () => {
    try {
      setIsLoadingMicroservices(true);
      const data = await apiGet<Microservice[]>("/api/v1/microservices", {
        timeout: 10000,
        retry: {
          maxRetries: 2,
          initialDelay: 1000,
        },
      });
      setMicroservices(data);
    } catch (err) {
      console.error("Failed to load microservices:", err);
    } finally {
      setIsLoadingMicroservices(false);
    }
  };

  /**
   * 초기 데이터 로드
   */
  useEffect(() => {
    loadApiKeys();
    loadApiServices();
    loadMicroservices();
  }, []);

  /**
   * 인증Key 표시/숨김 토글
   */
  const toggleKeyVisibility = (keyId: string) => {
    setShowKeys((prev) => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  /**
   * 인증Key 복사
   */
  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      showToast("success", "인증Key가 클립보드에 복사되었습니다", 3000);
    } catch (err) {
      console.error("Failed to copy key:", err);
      showToast("error", "인증Key 복사에 실패했습니다");
    }
  };

  /**
   * 새 인증Key 발급
   */
  const generateNewKey = async () => {
    if (!newKeyName.trim()) return;

    try {
      setIsCreatingKey(true);
      setError(null);
      const newKey = await apiPost<ApiKey>(
        "/api/v1/security/api-keys",
        {
          name: newKeyName.trim(),
          permissions: ["read", "write"],
        },
        {
          timeout: 10000,
        }
      );
      setApiKeys([...apiKeys, newKey]);
      setNewKeyName("");
      setShowNewKeyModal(false);
      showToast("success", `인증Key "${newKey.name}"가 성공적으로 발급되었습니다`);
    } catch (err) {
      const errorMessage =
        err instanceof ApiException
          ? err.message
          : "인증Key 생성 중 오류가 발생했습니다.";
      setError(errorMessage);
      showToast("error", errorMessage);
      console.error("Failed to create API key:", err);
    } finally {
      setIsCreatingKey(false);
    }
  };

  /**
   * 인증Key 삭제 (Hard delete)
   */
  const deleteKey = async (keyId: string) => {
    const key = apiKeys.find((k) => k.id === keyId);
    if (!confirm(`정말로 "${key?.name || "이 인증Key"}"를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setError(null);
      await apiDelete<{ deleted: boolean; id: string }>(`/api/v1/security/api-keys/${keyId}`, {
        timeout: 10000,
      });
      setApiKeys(apiKeys.filter((k) => k.id !== keyId));
      showToast("success", `인증Key "${key?.name || ""}"가 삭제되었습니다`);
    } catch (err) {
      const errorMessage =
        err instanceof ApiException
          ? err.message
          : "인증Key 삭제 중 오류가 발생했습니다.";
      setError(errorMessage);
      showToast("error", errorMessage);
      console.error("Failed to delete API key:", err);
    }
  };

  /**
   * API 서비스 상태 변경
   */
  const updateServiceStatus = async (
    serviceId: string,
    status: "allowed" | "blocked" | "limited"
  ) => {
    const service = apiServices.find((s) => s.id === serviceId);
    const statusText = status === "allowed" ? "허용" : status === "blocked" ? "차단" : "제한";

    try {
      setIsUpdatingService((prev) => ({ ...prev, [serviceId]: true }));
      setError(null);
      const updated = await apiPut<ExternalApiService>(
        `/api/v1/security/external-services/${serviceId}/status`,
        { status },
        {
          timeout: 10000,
        }
      );
      setApiServices(apiServices.map((s) => (s.id === serviceId ? updated : s)));
      showToast("success", `"${service?.name || ""}" 서비스가 ${statusText} 상태로 변경되었습니다`);
    } catch (err) {
      const errorMessage =
        err instanceof ApiException
          ? err.message
          : "서비스 상태 변경 중 오류가 발생했습니다.";
      setError(errorMessage);
      showToast("error", errorMessage);
      console.error("Failed to update service status:", err);
    } finally {
      setIsUpdatingService((prev) => ({ ...prev, [serviceId]: false }));
    }
  };

  /**
   * 외부 API 서비스 삭제 (Hard delete)
   */
  const deleteExternalService = async (serviceId: string) => {
    const service = apiServices.find((s) => s.id === serviceId);
    if (!confirm(`정말로 "${service?.name || "이 서비스"}"를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setIsDeletingService((prev) => ({ ...prev, [serviceId]: true }));
      setError(null);
      await apiDelete<{ deleted: boolean; id: string }>(
        `/api/v1/security/external-services/${serviceId}`,
        { timeout: 10000 }
      );
      setApiServices(apiServices.filter((s) => s.id !== serviceId));
      showToast("success", `"${service?.name || ""}" 서비스가 삭제되었습니다`);
    } catch (err) {
      const errorMessage =
        err instanceof ApiException
          ? err.message
          : "외부 API 서비스 삭제 중 오류가 발생했습니다.";
      setError(errorMessage);
      showToast("error", errorMessage);
      console.error("Failed to delete external service:", err);
    } finally {
      setIsDeletingService((prev) => ({ ...prev, [serviceId]: false }));
    }
  };

  /**
   * 제한 기준 설정 모달 열기
   */
  const openRateLimitModal = (service: ExternalApiService) => {
    setEditingService(service);
    setRateLimitValue(service.rateLimit ? String(service.rateLimit) : "");
    setRateLimitWindow(
      String(service.rateLimitWindowSeconds ?? 3600) === "60" ? "60" : "3600"
    );
    setShowRateLimitModal(true);
  };

  /**
   * 제한 기준 저장
   */
  const saveRateLimit = async () => {
    if (!editingService) return;

    const limitNum = rateLimitValue.trim() ? Number(rateLimitValue) : null;
    if (limitNum !== null && (!Number.isFinite(limitNum) || limitNum <= 0)) {
      showToast("error", "제한 값은 1 이상의 숫자여야 합니다");
      return;
    }

    try {
      setError(null);
      const updated = await apiPut<ExternalApiService>(
        `/api/v1/security/external-services/${editingService.id}/rate-limit`,
        {
          rateLimit: limitNum,
          rateLimitWindowSeconds: limitNum === null ? null : Number(rateLimitWindow),
        },
        { timeout: 10000 }
      );
      setApiServices(apiServices.map((s) => (s.id === updated.id ? updated : s)));
      showToast("success", `"${editingService.name}" 제한 기준이 저장되었습니다`);
      setShowRateLimitModal(false);
      setEditingService(null);
    } catch (err) {
      const errorMessage =
        err instanceof ApiException
          ? err.message
          : "제한 기준 저장 중 오류가 발생했습니다.";
      setError(errorMessage);
      showToast("error", errorMessage);
      console.error("Failed to save rate limit:", err);
    }
  };

  /**
   * 외부 API 서비스 등록
   */
  const createExternalService = async () => {
    if (!newServiceName.trim() || !newServiceEndpoint.trim() || !newServiceDescription.trim()) {
      showToast("error", "이름/엔드포인트/설명은 필수입니다");
      return;
    }
    if (!newServiceEndpoint.trim().startsWith("/")) {
      showToast("error", "엔드포인트는 '/'로 시작해야 합니다");
      return;
    }

    const limitNum = newServiceRateLimit.trim() ? Number(newServiceRateLimit) : null;
    if (newServiceStatus === "limited") {
      if (limitNum === null || !Number.isFinite(limitNum) || limitNum <= 0) {
        showToast("error", "제한 상태에서는 제한 값(1 이상)이 필수입니다");
        return;
      }
    }

    // 포트포워딩 검증: targetHost와 targetPort는 함께 설정되어야 함
    const hasTargetHost = newServiceTargetHost.trim() !== "";
    const hasTargetPort = newServiceTargetPort.trim() !== "";
    if (hasTargetHost !== hasTargetPort) {
      showToast("error", "호스트와 포트는 함께 설정되어야 합니다");
      return;
    }

    const targetPortNum = hasTargetPort ? Number(newServiceTargetPort) : null;
    if (targetPortNum !== null && (!Number.isFinite(targetPortNum) || targetPortNum < 1 || targetPortNum > 65535)) {
      showToast("error", "포트는 1-65535 범위여야 합니다");
      return;
    }

    try {
      setIsCreatingService(true);
      setError(null);
      const created = await apiPost<ExternalApiService>(
        "/api/v1/security/external-services",
        {
          name: newServiceName.trim(),
          endpoint: newServiceEndpoint.trim(),
          description: newServiceDescription.trim(),
          status: newServiceStatus,
          rateLimit: newServiceStatus === "limited" ? limitNum : null,
          rateLimitWindowSeconds: newServiceStatus === "limited" ? Number(newServiceWindow) : null,
          targetHost: hasTargetHost ? newServiceTargetHost.trim() : null,
          targetPort: targetPortNum,
          targetPath: newServiceTargetPath.trim() || null,
          protocol: newServiceProtocol,
          targetServiceId: newServiceTargetServiceId || null,
        },
        { timeout: 10000 }
      );
      setApiServices([created, ...apiServices]);
      showToast("success", `"${created.name}" 서비스가 등록되었습니다`);
      setShowCreateServiceModal(false);
      setNewServiceName("");
      setNewServiceEndpoint("");
      setNewServiceDescription("");
      setNewServiceStatus("allowed");
      setNewServiceRateLimit("");
      setNewServiceWindow("3600");
      setNewServiceTargetHost("");
      setNewServiceTargetPort("");
      setNewServiceTargetPath("");
      setNewServiceProtocol("http");
      setNewServiceTargetServiceId("");
    } catch (err) {
      const errorMessage =
        err instanceof ApiException ? err.message : "외부 API 서비스 등록 중 오류가 발생했습니다.";
      setError(errorMessage);
      showToast("error", errorMessage);
      console.error("Failed to create external service:", err);
    } finally {
      setIsCreatingService(false);
    }
  };

  /**
   * API Key 마스킹 처리
   */
  const maskKey = (key: string) => {
    if (key.length <= 8) return key;
    return `${key.substring(0, 8)}${"*".repeat(key.length - 12)}${key.substring(key.length - 4)}`;
  };

  return (
    <div className="space-y-6">
      {/* 에러 메시지 */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-200 rounded-xl p-4">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* 인증Key 관리 섹션 */}
      <div className={MT.panelPadded}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <Key className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className={MT.h2Title}>인증Key 관리</h3>
              <p className={MT.subtitle}>API 접근을 위한 인증Key를 발급하고 관리합니다</p>
            </div>
          </div>
          <button
            onClick={() => setShowNewKeyModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            새 Key 발급
          </button>
        </div>

        {/* 액세스 토큰 (JWT): 백엔드 /v1/auth/token 연동 */}
        <div className="mb-4 rounded-xl border border-slate-600/25 bg-slate-900/15 px-4 py-3 group-data-[theme=light]/main:border-slate-200 group-data-[theme=light]/main:bg-slate-50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
            <div className="mt-0.5 shrink-0 rounded-lg bg-slate-700/40 p-1.5 group-data-[theme=light]/main:bg-slate-200">
              <Braces className="h-4 w-4 text-slate-400 group-data-[theme=light]/main:text-slate-600" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-300 group-data-[theme=light]/main:text-slate-800">
                  액세스 토큰 (JWT)
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 group-data-[theme=light]/main:text-slate-600">
                  발급된 토큰은 브라우저 sessionStorage에 저장되며, 이후 API 요청에{" "}
                  <code className="rounded bg-slate-950/60 px-1 py-0.5 font-mono text-[10px] text-slate-300 group-data-[theme=light]/main:bg-slate-200 group-data-[theme=light]/main:text-slate-800">
                    Authorization: Bearer
                  </code>{" "}
                  로 자동 전달됩니다. 서버에 <span className="font-mono">JWT_SECRET</span>이 필요합니다.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-slate-500 group-data-[theme=light]/main:text-slate-600">
                  발급 방식
                </label>
                <select
                  value={jwtGrant}
                  onChange={(e) => setJwtGrant(e.target.value as "api_key" | "password")}
                  className={MT.select}
                >
                  <option value="api_key">API Key로 교환</option>
                  <option value="password">사용자/비밀번호 (데모)</option>
                </select>
              </div>
              {jwtGrant === "api_key" ? (
                <div>
                  <label className={MT.label}>활성 API Key 전체 문자열</label>
                  <input
                    value={jwtApiKeyInput}
                    onChange={(e) => setJwtApiKeyInput(e.target.value)}
                    placeholder="sk_..."
                    className={MT.input}
                    autoComplete="off"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className={MT.label}>사용자명</label>
                    <input
                      value={jwtUsername}
                      onChange={(e) => setJwtUsername(e.target.value)}
                      className={MT.input}
                      autoComplete="username"
                    />
                  </div>
                  <div>
                    <label className={MT.label}>비밀번호</label>
                    <input
                      type="password"
                      value={jwtPassword}
                      onChange={(e) => setJwtPassword(e.target.value)}
                      className={MT.input}
                      autoComplete="current-password"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 sm:col-span-2 group-data-[theme=light]/main:text-slate-500">
                    password grant는 서버 환경 변수 JWT_AUTH_USERNAME / JWT_AUTH_PASSWORD 설정 시에만 동작합니다.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={
                    jwtBusy ||
                    (jwtGrant === "api_key" && !jwtApiKeyInput.trim()) ||
                    (jwtGrant === "password" &&
                      (!jwtUsername.trim() || jwtPassword === ""))
                  }
                  onClick={() => void handleIssueJwt()}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {jwtBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  토큰 발급
                </button>
                <button
                  type="button"
                  onClick={() => void refreshJwtMe()}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 group-data-[theme=light]/main:border-slate-300 group-data-[theme=light]/main:text-slate-700 group-data-[theme=light]/main:hover:bg-slate-100"
                >
                  토큰 검증
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearStoredAccessToken();
                    setJwtExpiresIn(null);
                    setJwtMeSub(null);
                    setJwtMeTyp(null);
                    setJwtShowToken(false);
                    showToast("info", "저장된 토큰을 삭제했습니다.");
                  }}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 group-data-[theme=light]/main:border-slate-300 group-data-[theme=light]/main:text-slate-600 group-data-[theme=light]/main:hover:bg-slate-100"
                >
                  토큰 삭제
                </button>
              </div>
              {getStoredAccessToken() ? (
                <div className="rounded-lg border border-slate-700/50 bg-slate-950/30 p-3 text-xs group-data-[theme=light]/main:border-slate-200 group-data-[theme=light]/main:bg-slate-100">
                  <div className="flex flex-wrap items-center gap-2 text-slate-400 group-data-[theme=light]/main:text-slate-600">
                    <span>저장됨</span>
                    {jwtExpiresIn != null ? <span>· 만료 전 {jwtExpiresIn}s</span> : null}
                    {jwtMeSub ? (
                      <span>
                        · sub: <span className="font-mono text-slate-300 group-data-[theme=light]/main:text-slate-800">{jwtMeSub}</span>
                        {jwtMeTyp ? (
                          <span className="text-slate-500">
                            {" "}
                            ({jwtMeTyp})
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span>· 검증 버튼으로 /auth/me 확인</span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="max-w-full flex-1 truncate rounded bg-slate-900/80 px-2 py-1 font-mono text-[10px] text-slate-400 group-data-[theme=light]/main:bg-white group-data-[theme=light]/main:text-slate-700">
                      {jwtShowToken
                        ? getStoredAccessToken()
                        : `${(getStoredAccessToken() ?? "").slice(0, 14)}…`}
                    </code>
                    <button
                      type="button"
                      onClick={() => setJwtShowToken(!jwtShowToken)}
                      className={MT.iconButton}
                      title={jwtShowToken ? "숨기기" : "보기"}
                    >
                      {jwtShowToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const t = getStoredAccessToken();
                        if (t) void navigator.clipboard.writeText(t);
                        showToast("success", "토큰을 복사했습니다.");
                      }}
                      className={MT.iconButton}
                      title="복사"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 group-data-[theme=light]/main:text-slate-500">저장된 토큰 없음</p>
              )}
            </div>
          </div>
        </div>

        {/* 인증Key 목록 */}
        {isLoadingKeys ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            <span className={MT.loadingHint}>로딩 중...</span>
          </div>
        ) : apiKeys.length === 0 ? (
          <div className={MT.mutedLine}>인증Key가 없습니다</div>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className={MT.listRow}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className={MT.titleSm}>{apiKey.name}</h4>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          apiKey.status === "active"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {apiKey.status === "active" ? "활성" : "비활성"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <code className={MT.codeInline}>
                        {showKeys[apiKey.id] ? apiKey.key : maskKey(apiKey.key)}
                      </code>
                      <button
                        onClick={() => toggleKeyVisibility(apiKey.id)}
                        className={MT.iconButton}
                        title={showKeys[apiKey.id] ? "숨기기" : "보기"}
                      >
                        {showKeys[apiKey.id] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => copyKey(apiKey.key)}
                        className={MT.iconButton}
                        title="복사"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>생성일: {apiKey.createdAt}</span>
                      {apiKey.lastUsed && <span>마지막 사용: {apiKey.lastUsed}</span>}
                      <span className="flex items-center gap-1">
                        권한: {apiKey.permissions.join(", ")}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteKey(apiKey.id)}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 외부 API 서비스 관리 섹션 */}
      <div className={MT.panelPadded}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/20 rounded-lg">
              <Shield className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className={MT.h2Title}>외부 API 서비스 관리</h3>
              <p className={MT.subtitle}>외부 API 서비스에 대한 허용, 차단, 제한 설정을 관리합니다</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateServiceModal(true)}
            className={MT.btnSecondaryOutline}
          >
            <Plus className="w-4 h-4" />
            서비스 등록
          </button>
        </div>

        {/* 서비스 등록 모달 */}
        {showCreateServiceModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className={MT.modalShell}>
              {/* 헤더: 고정 */}
              <div className={MT.modalHeader}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className={MT.modalTitle}>외부 API 서비스 등록</h3>
                    <p className={MT.subtitle}>
                      엔드포인트를 기준으로 외부 API 서비스 정책(허용/차단/제한)을 관리합니다.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowCreateServiceModal(false);
                      setNewServiceName("");
                      setNewServiceEndpoint("");
                      setNewServiceDescription("");
                      setNewServiceStatus("allowed");
                      setNewServiceRateLimit("");
                      setNewServiceWindow("3600");
                      setNewServiceTargetHost("");
                      setNewServiceTargetPort("");
                      setNewServiceTargetPath("");
                      setNewServiceProtocol("http");
                      setNewServiceTargetServiceId("");
                    }}
                    className={MT.modalClose}
                    title="닫기"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 본문: 스크롤 가능 */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="space-y-3 md:space-y-4">
                <div>
                  <label className={MT.label}>서비스 이름</label>
                  <input
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    className={MT.input}
                    placeholder="예: 외부 파트너 API"
                  />
                </div>
                <div>
                  <label className={MT.label}>엔드포인트</label>
                  <input
                    value={newServiceEndpoint}
                    onChange={(e) => setNewServiceEndpoint(e.target.value)}
                    className={MT.inputMono}
                    placeholder="예: /api/v1/partner"
                  />
                  <p className="mt-1 text-xs text-slate-500">‘/’로 시작해야 합니다.</p>
                </div>
                <div>
                  <label className={MT.label}>설명</label>
                  <input
                    value={newServiceDescription}
                    onChange={(e) => setNewServiceDescription(e.target.value)}
                    className={MT.input}
                    placeholder="예: 외부 협력사 주문 조회 API"
                  />
                </div>

                {/* 포트포워딩 설정 섹션 - 기본 섹션으로 상향 */}
                <div className={MT.forwardingPanel}>
                  <div className="flex items-center gap-2 mb-3 md:mb-4">
                    <Network className="w-4 h-4 text-indigo-400" />
                    <h4 className={MT.subsectionHeading}>포트포워딩 설정</h4>
                  </div>

                  <div className="space-y-3 md:space-y-4">
                    <div>
                      <label className={MT.label}>내부 서비스 선택</label>
                      <select
                        value={newServiceTargetServiceId}
                        onChange={(e) => {
                          setNewServiceTargetServiceId(e.target.value);
                          // 서비스 선택 시 자동으로 호스트/포트 채우기 (선택적)
                          if (e.target.value) {
                            const selectedService = microservices.find((ms) => ms.id === e.target.value);
                            if (selectedService && !newServiceTargetHost) {
                              // 서비스 이름을 기반으로 호스트 추정 (실제로는 서비스별 설정 필요)
                              setNewServiceTargetHost(selectedService.name.toLowerCase().replace(/\s+/g, "-"));
                            }
                          }
                        }}
                        className={MT.input}
                      >
                        <option value="">서비스를 선택하세요</option>
                        {microservices.map((ms) => (
                          <option key={ms.id} value={ms.id}>
                            {ms.name} ({ms.id})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                      <div>
                        <label className={MT.label}>호스트</label>
                        <input
                          value={newServiceTargetHost}
                          onChange={(e) => setNewServiceTargetHost(e.target.value)}
                          className={MT.input}
                          placeholder="예: internal-service 또는 192.168.1.100"
                        />
                      </div>

                      <div>
                        <label className={MT.label}>포트</label>
                        <input
                          type="number"
                          min="1"
                          max="65535"
                          value={newServiceTargetPort}
                          onChange={(e) => setNewServiceTargetPort(e.target.value)}
                          className={MT.input}
                          placeholder="예: 8080"
                          inputMode="numeric"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                      <div>
                        <label className={MT.label}>경로</label>
                        <input
                          value={newServiceTargetPath}
                          onChange={(e) => setNewServiceTargetPath(e.target.value)}
                          className={MT.inputMono}
                          placeholder="예: /api/data (기본값: 엔드포인트 그대로)"
                        />
                      </div>

                      <div>
                        <label className={MT.label}>프로토콜</label>
                        <select
                          value={newServiceProtocol}
                          onChange={(e) => setNewServiceProtocol(e.target.value as "http" | "https")}
                          className={MT.input}
                        >
                          <option value="http">HTTP</option>
                          <option value="https">HTTPS</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 보안 설정 섹션 */}
                <div className={MT.modalSectionDivider}>
                  <h4 className={`${MT.subsectionHeading} mb-2 md:mb-3`}>보안 설정</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <label className={MT.label}>초기 상태</label>
                      <select
                        value={newServiceStatus}
                        onChange={(e) =>
                          setNewServiceStatus(e.target.value as "allowed" | "blocked" | "limited")
                        }
                        className={MT.input}
                      >
                        <option value="allowed">허용</option>
                        <option value="blocked">차단</option>
                        <option value="limited">제한</option>
                      </select>
                    </div>

                    <div>
                      <label className={MT.label}>제한 기간</label>
                      <select
                        value={newServiceWindow}
                        onChange={(e) => setNewServiceWindow(e.target.value as "60" | "3600")}
                        disabled={newServiceStatus !== "limited"}
                        className={`${MT.input} disabled:opacity-50`}
                      >
                        <option value="60">분당 (60s)</option>
                        <option value="3600">시간당 (3600s)</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 md:mt-4">
                    <label className={MT.label}>제한 값</label>
                    <input
                      value={newServiceRateLimit}
                      onChange={(e) => setNewServiceRateLimit(e.target.value)}
                      disabled={newServiceStatus !== "limited"}
                      className={`${MT.input} disabled:opacity-50`}
                      placeholder="예: 100"
                      inputMode="numeric"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      제한 상태(LIMITED)에서만 사용됩니다.
                    </p>
                  </div>
                </div>
                </div>
              </div>

              {/* 푸터: 고정 */}
              <div className={MT.modalFooter}>
                <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateServiceModal(false);
                    setNewServiceName("");
                    setNewServiceEndpoint("");
                    setNewServiceDescription("");
                    setNewServiceStatus("allowed");
                    setNewServiceRateLimit("");
                    setNewServiceWindow("3600");
                    setNewServiceTargetHost("");
                    setNewServiceTargetPort("");
                    setNewServiceTargetPath("");
                    setNewServiceProtocol("http");
                    setNewServiceTargetServiceId("");
                  }}
                  disabled={isCreatingService}
                  className={MT.textButton}
                >
                  취소
                </button>
                <button
                  onClick={createExternalService}
                  disabled={isCreatingService}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {isCreatingService ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      등록 중...
                    </>
                  ) : (
                    "등록"
                  )}
                </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API 서비스 목록 */}
        {isLoadingServices ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            <span className={MT.loadingHint}>로딩 중...</span>
          </div>
        ) : apiServices.length === 0 ? (
          <div className={MT.mutedLine}>외부 API 서비스가 없습니다</div>
        ) : (
          <div className="space-y-3">
            {apiServices.map((service) => (
              <div
                key={service.id}
                className={MT.listRow}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className={MT.titleSm}>{service.name}</h4>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${
                          service.status === "allowed"
                            ? "bg-green-500/20 text-green-400"
                            : service.status === "blocked"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {service.status === "allowed" ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            허용
                          </>
                        ) : service.status === "blocked" ? (
                          <>
                            <XCircle className="w-3 h-3" />
                            차단
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3" />
                            제한
                          </>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-2 group-data-[theme=light]/main:text-slate-600">
                      {service.description}
                    </p>
                    <div className="flex flex-col gap-2 text-xs text-slate-500">
                      <div className="flex items-center gap-4">
                        <code className="text-slate-300 group-data-[theme=light]/main:text-slate-700">
                          {service.endpoint}
                        </code>
                        {service.status === "limited" && (
                          <span>
                            Rate Limit:{" "}
                            {service.rateLimit
                              ? service.rateLimit.toLocaleString()
                              : "미설정"}
                            /
                            {service.rateLimitWindowSeconds === 60
                              ? "min"
                              : "hour"}
                          </span>
                        )}
                      </div>
                      {service.targetHost && service.targetPort && (
                        <div className="flex items-center gap-2 text-slate-400">
                          <span className="text-slate-500">포트포워딩:</span>
                          <code className="text-slate-300 group-data-[theme=light]/main:text-slate-700">
                            {service.protocol || "http"}://{service.targetHost}:{service.targetPort}
                            {service.targetPath || service.endpoint}
                          </code>
                          {service.targetServiceId && (
                            <span className="text-slate-500">
                              (서비스: {microservices.find((ms) => ms.id === service.targetServiceId)?.name || service.targetServiceId})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                  <button
                    onClick={() => openRateLimitModal(service)}
                    className={MT.iconButtonRow}
                    title="제한 기준 설정"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>
                    <button
                      onClick={() => updateServiceStatus(service.id, "allowed")}
                      disabled={isUpdatingService[service.id]}
                      className={`p-2 rounded-lg transition-colors ${
                        service.status === "allowed"
                          ? "bg-green-500/20 text-green-400"
                          : "text-slate-400 hover:text-green-400 hover:bg-green-500/10"
                      } ${isUpdatingService[service.id] ? "opacity-50 cursor-not-allowed" : ""}`}
                      title="허용"
                    >
                      {isUpdatingService[service.id] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Unlock className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => updateServiceStatus(service.id, "limited")}
                      disabled={isUpdatingService[service.id]}
                      className={`p-2 rounded-lg transition-colors ${
                        service.status === "limited"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10"
                      } ${isUpdatingService[service.id] ? "opacity-50 cursor-not-allowed" : ""}`}
                      title="제한"
                    >
                      {isUpdatingService[service.id] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => updateServiceStatus(service.id, "blocked")}
                      disabled={isUpdatingService[service.id]}
                      className={`p-2 rounded-lg transition-colors ${
                        service.status === "blocked"
                          ? "bg-red-500/20 text-red-400"
                          : "text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                      } ${isUpdatingService[service.id] ? "opacity-50 cursor-not-allowed" : ""}`}
                      title="차단"
                    >
                      {isUpdatingService[service.id] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                    </button>
                  <button
                    onClick={() => deleteExternalService(service.id)}
                    disabled={isDeletingService[service.id] || isUpdatingService[service.id]}
                    className={`p-2 rounded-lg transition-colors text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 ${
                      isDeletingService[service.id] ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    title="삭제"
                  >
                    {isDeletingService[service.id] ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 제한 기준 설정 모달 */}
      {showRateLimitModal && editingService && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={MT.modalMd}>
            <h3 className={`${MT.h2Title} mb-4`}>제한 기준 설정</h3>
            <p className={`${MT.subtitle} mb-4`}>
              {editingService.name} ({editingService.endpoint})
            </p>

            <div className="space-y-4">
              <div>
                <label className={MT.label}>
                  제한 횟수
                </label>
                <input
                  type="number"
                  min={1}
                  value={rateLimitValue}
                  onChange={(e) => setRateLimitValue(e.target.value)}
                  placeholder="예: 500"
                  className={MT.modalInput}
                />
                <p className="text-xs text-slate-500 mt-1">
                  비우면 제한이 해제됩니다.
                </p>
              </div>

              <div>
                <label className={MT.label}>
                  기간
                </label>
                <select
                  value={rateLimitWindow}
                  onChange={(e) =>
                    setRateLimitWindow(e.target.value === "60" ? "60" : "3600")
                  }
                  className={MT.modalSelect}
                  disabled={!rateLimitValue.trim()}
                >
                  <option value="60">분당 (60s)</option>
                  <option value="3600">시간당 (3600s)</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={saveRateLimit}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                >
                  저장
                </button>
                <button
                  onClick={() => {
                    setShowRateLimitModal(false);
                    setEditingService(null);
                  }}
                  className={MT.btnCancel}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 새 Key 발급 모달 */}
      {showNewKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={MT.modalMd}>
            <h3 className={`${MT.h2Title} mb-4`}>새 인증Key 발급</h3>
            <div className="space-y-4">
              <div>
                <label className={MT.label}>Key 이름</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="예: Production API Key"
                  className={MT.modalInput}
                  autoFocus
                  disabled={isCreatingKey}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isCreatingKey && newKeyName.trim()) {
                      generateNewKey();
                    }
                  }}
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={generateNewKey}
                  disabled={isCreatingKey || !newKeyName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreatingKey ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      발급 중...
                    </>
                  ) : (
                    "발급"
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowNewKeyModal(false);
                    setNewKeyName("");
                  }}
                  disabled={isCreatingKey}
                  className={`${MT.btnCancel} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
