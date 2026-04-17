import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap,
  Menu,
  X,
  Sun,
  Moon,
} from 'lucide-react';
import { NAV_ITEMS, FOOTER_NAV, ViewType } from './constants';
import { getStoredTheme, THEME_STORAGE_KEY, type Theme } from './theme';
import { OrchestrationView } from './components/OrchestrationView';
import { ArchivingView } from './components/ArchivingView';
import { GovernanceView } from './components/GovernanceView';
import { NodeManagementView } from './components/NodeManagementView';
import { MonitoringView } from './components/MonitoringView';
import { WorkflowDAGView } from './components/WorkflowDAGView';

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('archiving');
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
  const [isHelpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    if (!isHelpOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHelpOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isHelpOpen]);

  const renderView = () => {
    switch (activeView) {
      case 'orchestration': return <OrchestrationView />;
      case 'archiving': return <ArchivingView />;
      case 'governance': return <GovernanceView />;
      case 'nodes': return <NodeManagementView />;
      case 'monitoring': return <MonitoringView />;
      case 'workflow': return <WorkflowDAGView />;
      default: return <ArchivingView />;
    }
  };

  return (
    <div className="min-h-screen bg-primary flex overflow-hidden">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-primary-container border-r border-white/5 transition-transform duration-300 ease-in-out transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:relative lg:translate-x-0 flex flex-col py-8`}
      >
        <div className="px-8 mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 kinetic-gradient rounded-xl flex items-center justify-center border border-white/10 shadow-md">
              <Zap className="w-5 h-5 text-accent fill-current" />
            </div>
            <h1 className="text-lg font-bold text-text-bright font-headline tracking-tight">DataOps</h1>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 hover:bg-white/5 rounded-lg text-text-dim"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveView(item.id);
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-colors group ${
                activeView === item.id 
                  ? 'bg-primary/90 text-accent border border-white/10' 
                  : 'text-text-dim hover:bg-white/5'
              }`}
            >
              <item.icon className={`w-5 h-5 transition-colors ${
                activeView === item.id ? 'text-accent' : 'text-surface-muted'
              }`} />
              <span className="text-sm font-semibold tracking-normal">{item.label}</span>
              {activeView === item.id && (
                <motion.div 
                  layoutId="active-pill"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-accent"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="px-4 mt-auto pt-8 border-t border-white/5 space-y-1">
          {FOOTER_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'help') {
                  setHelpOpen(true);
                }
              }}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-text-dim hover:bg-white/5 transition-all group"
            >
              <item.icon className="w-5 h-5 text-surface-muted group-hover:text-text-bright transition-colors" />
              <span className="text-sm font-semibold tracking-normal">{item.label}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content — 라이트 테마는 이 래퍼에만 (.theme-light), 사이드바는 :root 다크 토큰 유지 */}
      <div
        id="app-theme-root"
        className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden ${theme === 'light' ? 'theme-light' : ''}`}
      >
        {/* Header */}
        <header className="h-16 bg-primary/90 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 md:px-8 shrink-0 z-40">
          <div className="flex items-center gap-4 md:gap-6">
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 hover:bg-white/5 rounded-lg text-text-dim"
            >
              {isSidebarOpen ? <X /> : <Menu />}
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg md:text-xl font-bold text-text-bright font-headline tracking-tight truncate">DataOps</span>
              <div className="h-5 w-px bg-white/10 shrink-0 hidden sm:block" />
              <h2 className="text-xs font-medium text-text-dim tracking-normal hidden sm:block">산업 데이터 운영 콘솔</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
              className="p-2 rounded-lg border border-white/10 bg-white/[0.04] text-text-dim hover:bg-white/10 hover:text-text-bright transition-colors shrink-0"
              title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
              aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* View Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 bg-primary relative">
          <div className="max-w-7xl mx-auto relative z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                {renderView()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {isHelpOpen && (
          <motion.div
            key="help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-modal-title"
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              aria-label="도움말 창 닫기"
              onClick={() => setHelpOpen(false)}
            />
            <motion.div
              className="relative z-10 w-full max-w-lg rounded-xl border border-white/10 bg-surface-card shadow-xl"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            >
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
                <h2 id="help-modal-title" className="text-sm font-semibold text-text-bright tracking-normal">Help</h2>
                <button
                  type="button"
                  className="p-2 rounded-lg text-surface-muted hover:text-text-bright hover:bg-white/5 transition-colors"
                  aria-label="닫기"
                  onClick={() => setHelpOpen(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3 text-sm text-text-dim">
                <p>이 콘솔은 Pipeline 설정, 저장소 상태 모니터링, 오케스트레이션 운영을 한 화면에서 관리합니다.</p>
                <ul className="space-y-2 text-[13px]">
                  <li>• <span className="text-text-bright">Pipeline</span>: 데이터 소스/목적지 추가 및 파이프라인 생성</li>
                  <li>• <span className="text-text-bright">Orchestration</span>: 생성된 파이프라인 인스턴스 확인 및 실행 제어</li>
                  <li>• <span className="text-text-bright">Node Management</span>: 저장소 엔드포인트 상태 모니터링</li>
                </ul>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
