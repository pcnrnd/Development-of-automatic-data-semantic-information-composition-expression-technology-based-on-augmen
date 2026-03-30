import React from 'react';
import { Info, X, Menu } from 'lucide-react';

const HELP_STEPS = [
  '산업을 선택하고, 필요 시 공정 데이터를 업로드합니다.',
  '「분석 실행」을 누르면 AutoML·온톨로지 매칭이 자동으로 진행됩니다.',
  '우선순위 추천과 시각화 결과를 확인한 뒤, 필요 기능을 검토합니다.',
];

interface DashboardHeaderProps {
  onMenuClick: () => void;
  helpOpen: boolean;
  onHelpOpen: (open: boolean) => void;
  /** 데스크톱 사이드바 접힘 여부 (패딩 정렬용) */
  sidebarCollapsed?: boolean;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ onMenuClick, helpOpen, onHelpOpen, sidebarCollapsed = false }) => {
  return (
    <>
      <header
        className={`bg-slate-900 text-white py-4 px-4 sm:px-6 sticky top-0 z-20 flex items-center justify-between border-b border-slate-800 shadow-sm transition-[padding] duration-200 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-[calc(14rem+1rem)] xl:pl-[calc(15rem+1rem)]'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-800 text-slate-400"
            aria-label="메뉴 열기"
          >
            <Menu className="w-6 h-6" />
          </button>
          <p className="text-xs sm:text-sm lg:text-base text-slate-300 font-medium tracking-tight">
            Smart MES Selection Platform
          </p>
        </div>
        <button
          type="button"
          onClick={() => onHelpOpen(true)}
          className="flex items-center justify-center bg-slate-800 hover:bg-slate-700 w-9 h-9 rounded-full transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          aria-label="사용 방법"
        >
          <Info className="w-5 h-5 text-slate-400" />
        </button>
      </header>

      {helpOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
          onClick={() => onHelpOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-title"
        >
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h2 id="help-title" className="text-lg font-bold">사용 방법</h2>
              <button
                type="button"
                onClick={() => onHelpOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full"
                aria-label="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="p-6 space-y-4 list-none">
              {HELP_STEPS.map((text, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold">
                    {i + 1}
                  </span>
                  <p className="text-slate-700 text-sm leading-relaxed pt-1">{text}</p>
                </li>
              ))}
            </ol>
            <div className="px-6 pb-6">
              <button
                type="button"
                onClick={() => onHelpOpen(false)}
                className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardHeader;
