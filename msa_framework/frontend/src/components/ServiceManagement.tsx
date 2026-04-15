"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  X,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { useToast } from "../hooks/useToast";
import {
  apiGet,
  createMicroservice,
  updateMicroservice,
  deleteMicroservice,
  CreateMicroserviceRequest,
  UpdateMicroserviceRequest,
  ApiException,
  ApiErrorType,
} from "../lib/api";
import { MT } from "../lib/mainTheme";
import type { Microservice } from "../types";
import { ServiceCategory } from "../types";

/**
 * Service Management 컴포넌트
 * 마이크로서비스 등록, 수정, 삭제 및 관리 기능
 */
export const ServiceManagement: React.FC = () => {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "healthy" | "degraded" | "down">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingService, setEditingService] = useState<Microservice | null>(null);
  const [deletingService, setDeletingService] = useState<Microservice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [services, setServices] = useState<Microservice[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * 서비스 목록 로드
   */
  const loadServices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiGet<Microservice[]>("/api/v1/microservices", {
        timeout: 10000,
        retry: {
          maxRetries: 2,
          initialDelay: 1000,
        },
      });
      setServices(data);
    } catch (err) {
      const errorMessage =
        err instanceof ApiException
          ? err
          : new Error("서비스 목록을 불러오는 중 오류가 발생했습니다.");
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  /**
   * 수동 새로고침
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadServices();
  };

  // 초기 로드
  useEffect(() => {
    loadServices();
  }, []);

  // 필터링된 서비스 목록
  const filteredServices = useMemo(() => {
    if (!services) return [];

    return services.filter((service) => {
      // 검색 필터
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !service.name.toLowerCase().includes(query) &&
          !service.description.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // 카테고리 필터
      if (categoryFilter !== "all" && service.category !== categoryFilter) {
        return false;
      }

      // 상태 필터
      if (statusFilter !== "all" && service.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [services, searchQuery, categoryFilter, statusFilter]);

  const handleCreate = () => {
    setEditingService(null);
    setShowCreateModal(true);
  };

  const handleEdit = (service: Microservice) => {
    setEditingService(service);
    setShowEditModal(true);
  };

  const handleDelete = (service: Microservice) => {
    setDeletingService(service);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingService) return;

    setIsSubmitting(true);
    try {
      await deleteMicroservice(deletingService.id);
      showToast("success", `서비스 '${deletingService.name}'이(가) 삭제되었습니다.`);
      setShowDeleteModal(false);
      setDeletingService(null);
      await loadServices();
    } catch (error) {
      const message =
        error instanceof ApiException
          ? error.message
          : "서비스 삭제 중 오류가 발생했습니다.";
      showToast("error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 text-rose-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold">서비스 목록을 불러올 수 없습니다</p>
            <p className="text-xs opacity-80 mt-1">
              {error instanceof ApiException ? error.message : String(error)}
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30"
            onClick={() => loadServices()}
            disabled={isLoading}
          >
            {isLoading ? "재시도 중..." : "다시 시도"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 및 액션 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={MT.h2Title}>서비스 목록</h3>
          <p className={`${MT.subtitle} mt-1`}>
            총 {filteredServices.length}개의 서비스
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className={MT.btnToolbarSecondary}
            title="새로고침"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            새로고침
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Service
          </button>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="서비스 이름 또는 설명으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={MT.toolbarInput}
          />
        </div>
        <div className="flex gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ServiceCategory | "all")}
            className={MT.select}
          >
            <option value="all">모든 카테고리</option>
            <option value={ServiceCategory.DATA_COLLECTION}>
              {ServiceCategory.DATA_COLLECTION}
            </option>
            <option value={ServiceCategory.ANALYSIS_MODELING}>
              {ServiceCategory.ANALYSIS_MODELING}
            </option>
            <option value={ServiceCategory.STRUCTURE_VISUALIZATION}>
              {ServiceCategory.STRUCTURE_VISUALIZATION}
            </option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "healthy" | "degraded" | "down")
            }
            className={MT.select}
          >
            <option value="all">모든 상태</option>
            <option value="healthy">Healthy</option>
            <option value="degraded">Degraded</option>
            <option value="down">Down</option>
          </select>
        </div>
      </div>

      {/* 서비스 목록 테이블 */}
      <div className={MT.tableWrap}>
        {isLoading && !services ? (
          <div className="p-8 text-center text-slate-400 group-data-[theme=light]/main:text-slate-500">
            로딩 중...
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="p-8 text-center text-slate-400 group-data-[theme=light]/main:text-slate-500">
            {searchQuery || categoryFilter !== "all" || statusFilter !== "all"
              ? "검색 결과가 없습니다."
              : "등록된 서비스가 없습니다."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={MT.thead}>
                <tr>
                  <th className={MT.tableHeadCell}>
                    이름
                  </th>
                  <th className={MT.tableHeadCell}>
                    카테고리
                  </th>
                  <th className={MT.tableHeadCell}>
                    상태
                  </th>
                  <th className={MT.tableHeadCell}>
                    메트릭
                  </th>
                  <th className={`${MT.tableHeadCell} text-right`}>
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className={MT.tbodyDivide}>
                {filteredServices.map((service) => (
                  <tr
                    key={service.id}
                    className={MT.trHover}
                  >
                    <td className="px-4 py-4">
                      <div>
                        <div className={MT.tableRowName}>{service.name}</div>
                        <div className={MT.tableRowDesc}>
                          {service.description}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={MT.tableMuted}>{service.category}</span>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={service.status} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-3 text-xs">
                        <span className={MT.tableMetricWrap}>
                          Lat:{" "}
                          <span className={MT.tableMetricVal}>{service.metrics.latency}ms</span>
                        </span>
                        <span className={MT.tableMetricWrap}>
                          T-Put:{" "}
                          <span className={MT.tableMetricVal}>{service.metrics.throughput}/s</span>
                        </span>
                        <span className={MT.tableMetricWrap}>
                          Err:{" "}
                          <span className={MT.tableMetricVal}>
                            {(service.metrics.errorRate * 100).toFixed(1)}%
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(service)}
                          className={MT.iconEdit}
                          title="수정"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(service)}
                          className={MT.iconDeleteRow}
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 등록 모달 */}
      {showCreateModal && (
        <ServiceFormModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadServices();
          }}
        />
      )}

      {/* 수정 모달 */}
      {showEditModal && editingService && (
        <ServiceFormModal
          service={editingService}
          onClose={() => {
            setShowEditModal(false);
            setEditingService(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setEditingService(null);
            loadServices();
          }}
        />
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal && deletingService && (
        <DeleteConfirmModal
          service={deletingService}
          onClose={() => {
            setShowDeleteModal(false);
            setDeletingService(null);
          }}
          onConfirm={handleDeleteConfirm}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
};

/**
 * 상태 배지 컴포넌트
 */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config = {
    healthy: {
      icon: <CheckCircle className="w-3 h-3" />,
      className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    degraded: {
      icon: <AlertCircle className="w-3 h-3" />,
      className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    },
    down: {
      icon: <XCircle className="w-3 h-3" />,
      className: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    },
  };

  const { icon, className } = config[status as keyof typeof config] || config.healthy;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase border ${className}`}
    >
      {icon}
      {status}
    </span>
  );
};

/**
 * 서비스 등록/수정 폼 모달
 */
const ServiceFormModal: React.FC<{
  service?: Microservice;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ service, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: service?.name || "",
    category: service?.category || ServiceCategory.DATA_COLLECTION,
    description: service?.description || "",
    status: service?.status || "healthy",
    latency: service?.metrics.latency.toString() || "50",
    throughput: service?.metrics.throughput.toString() || "100",
    errorRate: service?.metrics.errorRate.toString() || "0.02",
    host: service?.host || "",
    port: service?.port?.toString() || "8080",
    protocol: service?.protocol || "http",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const metrics = {
        latency: parseFloat(formData.latency),
        throughput: parseFloat(formData.throughput),
        errorRate: parseFloat(formData.errorRate),
      };

      // 네트워크 정보 검증
      if (!formData.host.trim()) {
        showToast("error", "호스트는 필수입니다");
        return;
      }
      const portNum = parseInt(formData.port);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        showToast("error", "포트는 1-65535 범위여야 합니다");
        return;
      }

      if (service) {
        // 수정
        const updateData: UpdateMicroserviceRequest = {
          name: formData.name,
          category: formData.category,
          description: formData.description,
          status: formData.status as "healthy" | "degraded" | "down",
          metrics,
          host: formData.host.trim(),
          port: portNum,
          protocol: formData.protocol,
        };
        await updateMicroservice(service.id, updateData);
        showToast("success", `서비스 '${formData.name}'이(가) 수정되었습니다.`);
      } else {
        // 등록
        const createData: CreateMicroserviceRequest = {
          name: formData.name,
          category: formData.category,
          description: formData.description,
          status: formData.status as "healthy" | "degraded" | "down",
          metrics,
          host: formData.host.trim(),
          port: portNum,
          protocol: formData.protocol,
        };
        await createMicroservice(createData);
        showToast("success", `서비스 '${formData.name}'이(가) 등록되었습니다.`);
      }
      onSuccess();
    } catch (error) {
      const message =
        error instanceof ApiException
          ? error.message
          : service
            ? "서비스 수정 중 오류가 발생했습니다."
            : "서비스 등록 중 오류가 발생했습니다.";
      showToast("error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={MT.modalMdWide}>
        <div className={MT.modalFormHeader}>
          <h3 className={MT.dialogTitle}>{service ? "서비스 수정" : "서비스 등록"}</h3>
          <button onClick={onClose} className={MT.modalClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={MT.labelSm}>이름 *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="예: 사용자 인증 서비스"
              className={MT.formInput}
            />
          </div>
          <div>
            <label className={MT.labelSm}>카테고리 *</label>
            <select
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as ServiceCategory })}
              className={MT.formInput}
            >
              <option value={ServiceCategory.DATA_COLLECTION}>
                {ServiceCategory.DATA_COLLECTION}
              </option>
              <option value={ServiceCategory.ANALYSIS_MODELING}>
                {ServiceCategory.ANALYSIS_MODELING}
              </option>
              <option value={ServiceCategory.STRUCTURE_VISUALIZATION}>
                {ServiceCategory.STRUCTURE_VISUALIZATION}
              </option>
            </select>
          </div>
          <div>
            <label className={MT.labelSm}>설명 *</label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="서비스에 대한 설명을 입력하세요"
              rows={3}
              className={MT.formInput}
            />
          </div>

          {/* 네트워크 정보 섹션 */}
          <div className={MT.modalFormSectionBorder}>
            <h4 className={`${MT.subsectionHeading} mb-3`}>네트워크 정보 *</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={MT.labelSm}>호스트/IP *</label>
                <input
                  type="text"
                  required
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  placeholder="예: 192.168.1.100 또는 service-name"
                  className={`${MT.formInput} font-mono`}
                />
              </div>
              <div>
                <label className={MT.labelSm}>포트 *</label>
                <input
                  type="number"
                  min="1"
                  max="65535"
                  required
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                  placeholder="예: 8080"
                  className={MT.formInput}
                />
              </div>
              <div>
                <label className={MT.labelSm}>프로토콜 *</label>
                <select
                  required
                  value={formData.protocol}
                  onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
                  className={MT.formInput}
                >
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className={MT.labelSm}>상태</label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as "healthy" | "degraded" | "down",
                })
              }
              className={MT.formInput}
            >
              <option value="healthy">Healthy</option>
              <option value="degraded">Degraded</option>
              <option value="down">Down</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={MT.labelSm}>Latency (ms)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={formData.latency}
                onChange={(e) => setFormData({ ...formData, latency: e.target.value })}
                placeholder="예: 50"
                className={MT.formInput}
              />
            </div>
            <div>
              <label className={MT.labelSm}>
                Throughput (req/s)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={formData.throughput}
                onChange={(e) => setFormData({ ...formData, throughput: e.target.value })}
                placeholder="예: 100"
                className={MT.formInput}
              />
            </div>
            <div>
              <label className={MT.labelSm}>Error Rate</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                required
                value={formData.errorRate}
                onChange={(e) => setFormData({ ...formData, errorRate: e.target.value })}
                placeholder="예: 0.02"
                className={MT.formInput}
              />
            </div>
          </div>
          <div className={MT.formFooterBar}>
            <button type="button" onClick={onClose} className={MT.btnSecondarySm}>
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
            >
              {isSubmitting ? "처리 중..." : service ? "수정" : "등록"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * 삭제 확인 모달
 */
const DeleteConfirmModal: React.FC<{
  service: Microservice;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}> = ({ service, onClose, onConfirm, isSubmitting }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={MT.modalMd}>
        <div className={MT.deleteModalHead}>
          <h3 className={MT.dialogTitle}>서비스 삭제</h3>
        </div>
        <div className="p-6">
          <p className="text-slate-300 mb-4 group-data-[theme=light]/main:text-slate-700">
            서비스{" "}
            <span className="font-semibold text-white group-data-[theme=light]/main:text-slate-900">
              {`'`}
              {service.name}
              {`'`}
            </span>
            을(를) 삭제하시겠습니까?
          </p>
          <p className={MT.subtitle}>이 작업은 되돌릴 수 없습니다.</p>
        </div>
        <div className={MT.deleteModalFoot}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={`${MT.btnSecondarySm} disabled:opacity-50`}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
          >
            {isSubmitting ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
};
