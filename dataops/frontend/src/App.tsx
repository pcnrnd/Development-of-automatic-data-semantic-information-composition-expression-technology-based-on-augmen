import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
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

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('archiving');
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const renderView = () => {
    switch (activeView) {
      case 'orchestration': return <OrchestrationView />;
      case 'archiving': return <ArchivingView />;
      case 'governance': return <GovernanceView />;
      case 'nodes': return <NodeManagementView />;
      case 'monitoring': return <MonitoringView />;
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
            <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-white/[0.04] rounded-lg border border-white/5">
              <Search className="w-4 h-4 text-surface-muted shrink-0" />
              <input
                type="text"
                placeholder="텔레메트리 검색…"
                className="bg-transparent border-none text-sm text-text-bright focus:ring-0 w-44 lg:w-56 placeholder:text-surface-muted font-normal"
              />
            </div>
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
    </div>
  );
}
