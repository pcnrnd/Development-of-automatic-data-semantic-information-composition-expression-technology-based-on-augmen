import React, { useEffect, useRef, useState } from 'react';
import { Cpu, Upload, PlayCircle, BarChart3, Database, Info, X, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NavId = 'data' | 'preprocess' | 'run' | 'result' | 'ontology';

interface AppSidebarProps {
  currentNav: NavId;
  onNavChange: (id: NavId) => void;
  onHelpOpen: () => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** 데스크톱(lg+) 사이드바 폭(px). collapsed면 이 값은 무시됩니다. */
  width: number;
  /** 데스크톱(lg+) 사이드바 폭 변경 콜백(px). */
  onWidthChange: (width: number) => void;
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS: { id: NavId; label: string; icon: React.ReactNode }[] = [
  { id: 'data', label: '데이터 준비', icon: <Upload className="w-5 h-5 shrink-0" /> },
  { id: 'preprocess', label: '전처리 & 증강', icon: <SlidersHorizontal className="w-5 h-5 shrink-0" /> },
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
  width,
  onWidthChange,
  open,
  onClose,
}) => {
  /** 모바일 드로어: 진입 애니메이션(슬라이드·배경 페이드)용. 마운트 직후 한 프레임 뒤 활성화 */
  const [drawerEntered, setDrawerEntered] = useState(false);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setDrawerEntered(false);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setDrawerEntered(true);
        mobileCloseRef.current?.focus();
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWRef = useRef(0);

  /** 데스크톱 사이드바 폭 리사이즈 드래그 시작 */
  const onResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (collapsed) return;
    // 포인터 캡처로 드래그 중 커서가 밖으로 나가도 이벤트를 안정적으로 받습니다.
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWRef.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  /** 데스크톱 사이드바 폭 리사이즈 드래그 중 */
  const onResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizingRef.current) return;
    const dx = e.clientX - startXRef.current;
    const next = Math.max(200, Math.min(360, Math.round(startWRef.current + dx)));
    onWidthChange(next);
  };

  /** 데스크톱 사이드바 폭 리사이즈 종료 */
  const onResizeEnd = () => {
    if (!resizingRef.current) return;
    resizingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  return (
    <>
      {/* 데스크톱: 접기/펼치기 가능한 고정 사이드바 (lg 이상) */}
      <aside
        className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 z-30 bg-slate-900 text-white border-r border-slate-800 shrink-0 transition-[width] duration-200 ease-out overflow-hidden"
        style={{ width: collapsed ? 64 : width }}
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

        {/* 데스크톱: 리사이즈 핸들 (우측 가장자리) */}
        {!collapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="사이드바 폭 조절"
            onPointerDown={onResizeStart}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeEnd}
            onPointerCancel={onResizeEnd}
            className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize select-none touch-none"
          >
            <div className="absolute right-0 top-0 bottom-0 w-px bg-slate-800" />
            <div className="absolute right-0 top-0 bottom-0 w-2 hover:bg-white/5 transition-colors" />
          </div>
        )}
      </aside>

      {/* 모바일·태블릿: 오버레이 (lg 미만, 데스크톱 기준으로 단순 유지) */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="메뉴">
          <div
            className={cn(
              'absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200 ease-out motion-reduce:transition-none',
              drawerEntered ? 'opacity-100' : 'opacity-0',
            )}
            onClick={onClose}
            aria-hidden="true"
          />
          <aside
            className={cn(
              'absolute inset-y-0 left-0 w-64 max-w-[85vw] sm:max-w-[min(85vw,18rem)]',
              'bg-slate-900 text-white border-r border-slate-800 flex flex-col min-h-0 shadow-xl',
              'transition-transform duration-200 ease-out motion-reduce:transition-none will-change-transform',
              drawerEntered ? 'translate-x-0' : '-translate-x-full motion-reduce:translate-x-0',
            )}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="bg-indigo-600 p-1.5 rounded-lg shrink-0">
                  <Cpu className="w-6 h-6" />
                </div>
                <span className="font-black text-sm tracking-tight truncate">MES<span className="text-indigo-400">OPTIMIZER</span></span>
              </div>
              <button
                ref={mobileCloseRef}
                type="button"
                onClick={onClose}
                className="p-2.5 rounded-lg hover:bg-slate-800 text-slate-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="메뉴 닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 min-h-0 p-3 space-y-0.5 overflow-y-auto overscroll-y-contain">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavChange(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors text-left min-h-[44px] ${
                    currentNav === item.id ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="p-3 border-t border-slate-800 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
              <button
                type="button"
                onClick={() => {
                  onHelpOpen();
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white min-h-[44px]"
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
