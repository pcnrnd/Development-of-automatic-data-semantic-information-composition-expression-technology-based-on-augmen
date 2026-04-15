"use client";

import dynamic from "next/dynamic";
import React, { useState } from "react";
import {
  Bell,
  Database,
  LayoutGrid,
  Menu,
  Moon,
  Search,
  Server,
  Settings,
  Sun,
} from "lucide-react";
import { useContentTheme } from "../context/ContentThemeContext";
import { MT } from "../lib/mainTheme";
import { ConnectionStatusComponent } from "./ConnectionStatus";

const Dashboard = dynamic(() => import("./Dashboard").then((m) => m.Dashboard), {
  ssr: false,
  loading: () => (
    <div className={`${MT.skeleton} p-6 rounded-2xl`}>Loading dashboard…</div>
  ),
});

const SecurityAccess = dynamic(
  () => import("./SecurityAccess").then((m) => m.SecurityAccess),
  {
    ssr: false,
    loading: () => (
      <div className={`${MT.skeleton} p-6 rounded-2xl`}>Loading security settings…</div>
    ),
  }
);

const ServiceManagement = dynamic(
  () => import("./ServiceManagement").then((m) => m.ServiceManagement),
  {
    ssr: false,
    loading: () => (
      <div className={`${MT.skeleton} p-6 rounded-2xl`}>
        Loading service management…
      </div>
    ),
  }
);

type Tab = "dashboard" | "security" | "services";

export const AppShell: React.FC = () => {
  const { isLight, toggleMode } = useContentTheme();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div
      className={`min-h-screen flex flex-col lg:flex-row font-sans selection:bg-blue-500/30 ${
        isLight ? "bg-slate-100 selection:bg-blue-500/20" : "bg-slate-950 selection:bg-blue-500/30"
      }`}
    >
      {/* 사이드바: 콘텐츠 테마(다크/화이트)와 무관하게 항상 다크 UI 유지 */}
      <aside
        className={`
        shrink-0 fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <div className="h-full flex flex-col">
          {/* Logo Section */}
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div className="leading-tight">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                  Industrial Data Gateway
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <NavItem
              active={activeTab === "dashboard"}
              onClick={() => setActiveTab("dashboard")}
              icon={<LayoutGrid size={20} />}
              label="System Dashboard"
            />

            <div className="pt-6 pb-2 px-4">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                Management
              </span>
            </div>
            <NavItem
              active={activeTab === "security"}
              onClick={() => setActiveTab("security")}
              icon={<Settings size={20} />}
              label="API Gateway"
            />
            <NavItem
              active={activeTab === "services"}
              onClick={() => setActiveTab("services")}
              icon={<Server size={20} />}
              label="Service Management"
            />
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main
        className={`group/main flex-1 flex flex-col h-screen overflow-hidden ${
          isLight ? "bg-slate-50" : ""
        }`}
        data-theme={isLight ? "light" : "dark"}
      >
        {/* Header */}
        <header
          className={`h-16 border-b flex items-center justify-between px-6 z-40 sticky top-0 backdrop-blur-md ${
            isLight
              ? "border-slate-200 bg-white/90"
              : "border-slate-800 bg-slate-900/50"
          }`}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`p-2 lg:hidden ${isLight ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-white"}`}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-medium ${isLight ? "text-slate-500" : "text-slate-500"}`}
              >
                Root
              </span>
              <span className={isLight ? "text-slate-300" : "text-slate-700"}>/</span>
              <span className="text-xs font-semibold text-blue-500 uppercase tracking-wide">
                {activeTab === "dashboard"
                  ? "General Overview"
                  : activeTab === "security"
                    ? "API Gateway"
                    : "Service Management"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ConnectionStatusComponent />
            <button
              type="button"
              onClick={toggleMode}
              className={`p-2 rounded-lg transition-colors ${
                isLight
                  ? "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
              title={isLight ? "다크 모드로 전환" : "화이트 모드로 전환"}
              aria-label={isLight ? "다크 모드로 전환" : "화이트 모드로 전환"}
            >
              {isLight ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <div className="relative hidden md:block">
              <Search
                className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? "text-slate-400" : "text-slate-500"}`}
              />
              <input
                type="text"
                placeholder="Search resources..."
                className={`rounded-lg py-1.5 pl-9 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50 w-64 ${
                  isLight
                    ? "bg-white border border-slate-300 text-slate-800 placeholder:text-slate-400"
                    : "bg-slate-800 border border-slate-700 text-slate-300"
                }`}
              />
            </div>
            <button
              className={`relative p-2 transition-colors ${
                isLight ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-white"
              }`}
            >
              <Bell className="w-5 h-5" />
              <span
                className={`absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full border ${
                  isLight ? "border-white" : "border-slate-900"
                }`}
              />
            </button>
          </div>
        </header>

        {/* Content Render */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto h-full">
            {activeTab === "dashboard" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <header className="mb-8">
                  <h2
                    className={`text-3xl font-bold mb-2 ${isLight ? "text-slate-900" : "text-white"}`}
                  >
                    Platform Overview
                  </h2>
                  <p className={isLight ? "text-slate-600" : "text-slate-400"}>
                    산업데이터 MSA 및 인프라 모니터링
                  </p>
                </header>
                <Dashboard />
              </div>
            )}
            {activeTab === "security" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <header className="mb-8">
                  <h2
                    className={`text-3xl font-bold mb-2 ${isLight ? "text-slate-900" : "text-white"}`}
                  >
                    API Gateway
                  </h2>
                  <p className={isLight ? "text-slate-600" : "text-slate-400"}>
                    외부 게이트웨이 관리: 산업데이터 분석 프레임워크를 사용하는 사용자의 인증Key 발급 및
                    외부 API 서비스를 위한 허용, 차단, 제한 기능을 수행합니다.
                  </p>
                </header>
                <SecurityAccess />
              </div>
            )}
            {activeTab === "services" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <header className="mb-8">
                  <h2
                    className={`text-3xl font-bold mb-2 ${isLight ? "text-slate-900" : "text-white"}`}
                  >
                    Service Management
                  </h2>
                  <p className={isLight ? "text-slate-600" : "text-slate-400"}>
                    마이크로서비스 관리: 서비스 등록, 수정, 삭제 및 상태 모니터링을 수행합니다.
                  </p>
                </header>
                <ServiceManagement />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const NavItem: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}> = ({ active, icon, label, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
      active
        ? "bg-blue-600/10 text-blue-400 border border-blue-600/20"
        : "text-slate-400 hover:bg-slate-800 hover:text-slate-100 border border-transparent"
    }`}
  >
    <div
      className={`${
        active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"
      } transition-colors`}
    >
      {icon}
    </div>
    <span className="text-sm font-medium">{label}</span>
    {active && (
      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
    )}
  </button>
);

