import React, { useEffect, useId, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { ONTOLOGY_GRAPH_RELATIONSHIPS_HELP_KO } from '../constants';

/**
 * 온톨로지 그래프 근처에 두는 도움말: 클릭 시 관계 형성 방식을 짧게 설명하는 패널을 엽니다.
 */
export function OntologyGraphHelpTip({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className={`relative inline-flex shrink-0 ${className}`} ref={wrapRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center justify-center rounded-full p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400"
        title="온톨로지 그래프 관계 안내"
      >
        <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
        <span className="sr-only">온톨로지 그래프 관계 안내 열기</span>
      </button>
      {open && (
        <div
          id={panelId}
          role="tooltip"
          className="absolute z-[100] left-0 top-full mt-1.5 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-lg text-slate-600 text-xs leading-relaxed"
        >
          <p className="whitespace-pre-line">{ONTOLOGY_GRAPH_RELATIONSHIPS_HELP_KO}</p>
        </div>
      )}
    </div>
  );
}
