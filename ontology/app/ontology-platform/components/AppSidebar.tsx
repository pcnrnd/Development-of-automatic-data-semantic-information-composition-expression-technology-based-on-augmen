import React from 'react';
import { Cpu, Upload, PlayCircle, BarChart3, Database, Info, X, ChevronLeft, ChevronRight } from 'lucide-react';

export type NavId = 'data' | 'run' | 'result' | 'ontology';

interface AppSidebarProps {
  currentNav: NavId;
  onNavChange: (id: NavId) => void;
  onHelpOpen: () => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS: { id: NavId; label: string; icon: React.ReactNode }[] = [
  { id: 'data', label: '데이터 준비', icon: <Upload className="w-5 h-5 shrink-0" /> },
  { id: 'run', label: '분석 실행', icon: <PlayCircle className="w-5 h-5 shrink-0" /> },
  { id: 'result', label: '결과', icon: <BarChart3 className="w-5 h-5 shrink-0" /> },
  { id: 'ontology', label: 'Standard MES Ontology', icon: <Database className="w-5 h-5 shrink-0" /> },
];

const AppSidebar: React.FC<AppSidebarProps> = ({
  currentNav,
  onNavChange,
  onHelpOpen,
  collapsed,
  onCollapsedChange,
  open,
  onClose,
}) => {
  return (
    <>
      {/* 데스크톱: 접기/펼치기 가능한 고정 사이드바 (lg 이상) */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 z-30 bg-slate-900 text-white border-r border-slate-800 shrink-0 transition-[width] duration-200 ease-out overflow-hidden ${
          collapsed ? 'lg:w-16' : 'lg:w-56 xl:w-60'
        }`}
        aria-label="메인 메뉴"
      >
        <div className={`flex items-center border-b border-slate-800 shrink-0 ${collapsed ? 'justify-center p-3' : 'gap-2 p-4'}`}>
          <div className="bg-indigo-600 p-1.5 rounded-lg shrink-0">
            <Cpu className="w-6 h-6" />
          </div>
          {!collapsed && (
            <span className="font-black text-sm tracking-tight truncate">MES<span className="text-indigo-400">OPTIMIZER</span></span>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto min-h-0">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavChange(item.id)}
              data-nav={item.id}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                collapsed ? 'justify-center px-0' : 'gap-3 px-3 text-left'
              } ${
                currentNav === item.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item.icon}
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800 shrink-0 space-y-0.5">
          <button
            type="button"
            onClick={onHelpOpen}
            title={collapsed ? '사용 방법' : undefined}
            className={`w-full flex items-center rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors min-h-[44px] ${
              collapsed ? 'justify-center px-0' : 'gap-3 px-3'
            }`}
            aria-label="사용 방법"
          >
            <Info className="w-5 h-5 shrink-0" />
            {!collapsed && <span>사용 방법</span>}
          </button>
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            className={`w-full flex items-center rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors min-h-[44px] ${
              collapsed ? 'justify-center px-0' : 'gap-3 px-3'
            }`}
            aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
            title={collapsed ? '펼치기' : '접기'}
          >
            {collapsed ? <ChevronRight className="w-5 h-5 shrink-0" /> : <ChevronLeft className="w-5 h-5 shrink-0" />}
            {!collapsed && <span>접기</span>}
          </button>
        </div>
      </aside>

      {/* 모바일·태블릿: 오버레이 (lg 미만, 데스크톱 기준으로 단순 유지) */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="메뉴">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
          <aside className="absolute inset-y-0 left-0 w-64 max-w-[85vw] bg-slate-900 text-white border-r border-slate-800 flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <div className="bg-indigo-600 p-1.5 rounded-lg shrink-0">
                  <Cpu className="w-6 h-6" />
                </div>
                <span className="font-black text-sm tracking-tight truncate">MES<span className="text-indigo-400">OPTIMIZER</span></span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2.5 rounded-lg hover:bg-slate-800 text-slate-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="메뉴 닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { onNavChange(item.id); onClose(); }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors text-left ${
                    currentNav === item.id ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="p-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => { onHelpOpen(); onClose(); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <Info className="w-5 h-5 shrink-0" />
                사용 방법
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};

export default AppSidebar;
