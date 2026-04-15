/**
 * 메인 열(사이드바 제외) 라이트 모드용 Tailwind 클래스 묶음.
 * 부모 요소에 `className="group/main"` 과 `data-theme="light" | "dark"` 가 있어야
 * `group-data-[theme=light]/main:` 변형이 적용됩니다.
 */
export const MT = {
  panelPadded:
    "bg-slate-800/40 rounded-2xl border border-slate-700/50 p-6 group-data-[theme=light]/main:bg-white group-data-[theme=light]/main:border-slate-200 group-data-[theme=light]/main:shadow-sm",

  h2Title:
    "text-xl font-bold text-white group-data-[theme=light]/main:text-slate-900",

  listRow:
    "bg-slate-900/50 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors group-data-[theme=light]/main:bg-slate-50 group-data-[theme=light]/main:border-slate-200 group-data-[theme=light]/main:hover:border-slate-300",

  titleSm:
    "text-sm font-semibold text-white group-data-[theme=light]/main:text-slate-900",

  codeInline:
    "text-xs font-mono text-slate-300 bg-slate-950 px-2 py-1 rounded group-data-[theme=light]/main:text-slate-800 group-data-[theme=light]/main:bg-slate-100",

  input:
    "w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 group-data-[theme=light]/main:bg-white group-data-[theme=light]/main:border-slate-300 group-data-[theme=light]/main:text-slate-900 group-data-[theme=light]/main:placeholder:text-slate-400",

  inputMono:
    "w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 font-mono group-data-[theme=light]/main:bg-white group-data-[theme=light]/main:border-slate-300 group-data-[theme=light]/main:text-slate-900",

  modalShell:
    "bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg md:max-w-2xl max-h-[90vh] flex flex-col group-data-[theme=light]/main:bg-white group-data-[theme=light]/main:border-slate-200",

  modalMd:
    "bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md group-data-[theme=light]/main:bg-white group-data-[theme=light]/main:border-slate-200",

  modalMdWide:
    "bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto group-data-[theme=light]/main:bg-white group-data-[theme=light]/main:border-slate-200",

  tableWrap:
    "bg-slate-800 rounded-xl border border-slate-700 overflow-hidden group-data-[theme=light]/main:bg-white group-data-[theme=light]/main:border-slate-200 group-data-[theme=light]/main:shadow-sm",

  thead:
    "bg-slate-900/50 border-b border-slate-700 group-data-[theme=light]/main:bg-slate-100 group-data-[theme=light]/main:border-slate-200",

  trHover:
    "hover:bg-slate-800/50 transition-colors group-data-[theme=light]/main:hover:bg-slate-50",

  toolbarInput:
    "w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50 group-data-[theme=light]/main:bg-white group-data-[theme=light]/main:border-slate-300 group-data-[theme=light]/main:text-slate-800",

  select:
    "bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50 group-data-[theme=light]/main:bg-white group-data-[theme=light]/main:border-slate-300 group-data-[theme=light]/main:text-slate-800",

  formInput:
    "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 group-data-[theme=light]/main:bg-white group-data-[theme=light]/main:border-slate-300 group-data-[theme=light]/main:text-slate-900",

  chartCard:
    "bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl group-data-[theme=light]/main:bg-white group-data-[theme=light]/main:border-slate-200 group-data-[theme=light]/main:shadow-sm",

  chartTitle:
    "text-lg font-bold mb-6 flex items-center gap-2 text-white group-data-[theme=light]/main:text-slate-900",

  statCard:
    "bg-slate-800 p-5 rounded-2xl border border-slate-700 flex items-center justify-between shadow-lg group-data-[theme=light]/main:bg-white group-data-[theme=light]/main:border-slate-200 group-data-[theme=light]/main:shadow-sm",

  statLabel:
    "text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold group-data-[theme=light]/main:text-slate-500",

  statValue:
    "text-2xl font-bold text-white group-data-[theme=light]/main:text-slate-900",

  serviceCard:
    "bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors group-data-[theme=light]/main:bg-white group-data-[theme=light]/main:border-slate-200 group-data-[theme=light]/main:hover:border-slate-300",

  serviceName:
    "font-semibold text-slate-100 text-sm group-data-[theme=light]/main:text-slate-900",

  metricBox:
    "bg-slate-900/50 p-2 rounded-lg border border-slate-700/30 group-data-[theme=light]/main:bg-slate-100 group-data-[theme=light]/main:border-slate-200",

  metricLabel:
    "text-[10px] text-slate-500 font-medium mb-0.5 group-data-[theme=light]/main:text-slate-500",

  metricValue:
    "text-xs font-mono text-slate-300 group-data-[theme=light]/main:text-slate-700",

  skeleton:
    "bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 text-slate-400 group-data-[theme=light]/main:bg-slate-100 group-data-[theme=light]/main:border-slate-200 group-data-[theme=light]/main:text-slate-500",

  subtitle: "text-sm text-slate-400 group-data-[theme=light]/main:text-slate-600",

  label:
    "block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]/main:text-slate-700",

  modalHeader:
    "p-4 md:p-6 border-b border-slate-700 flex-shrink-0 group-data-[theme=light]/main:border-slate-200",

  modalFooter:
    "p-4 md:p-6 border-t border-slate-700 flex-shrink-0 group-data-[theme=light]/main:border-slate-200",

  modalTitle:
    "text-lg font-bold text-white mb-2 group-data-[theme=light]/main:text-slate-900",

  dialogTitle: "text-lg font-bold text-white group-data-[theme=light]/main:text-slate-900",

  modalInput:
    "w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 group-data-[theme=light]/main:bg-white group-data-[theme=light]/main:border-slate-300 group-data-[theme=light]/main:text-slate-900 group-data-[theme=light]/main:placeholder:text-slate-400",

  modalSelect:
    "w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 group-data-[theme=light]/main:bg-white group-data-[theme=light]/main:border-slate-300 group-data-[theme=light]/main:text-slate-900",

  textButton:
    "px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-50 group-data-[theme=light]/main:text-slate-600 group-data-[theme=light]/main:hover:text-slate-900",

  btnSecondaryOutline:
    "flex items-center gap-2 px-4 py-2 bg-slate-900/60 hover:bg-slate-900 text-slate-100 border border-slate-700 rounded-lg transition-colors text-sm font-medium group-data-[theme=light]/main:bg-white group-data-[theme=light]/main:hover:bg-slate-50 group-data-[theme=light]/main:text-slate-800 group-data-[theme=light]/main:border-slate-300",

  forwardingPanel:
    "pt-3 md:pt-4 border-t border-slate-700 bg-indigo-950/20 rounded-lg p-4 md:p-5 border border-indigo-500/30 group-data-[theme=light]/main:border-slate-200 group-data-[theme=light]/main:bg-indigo-50 group-data-[theme=light]/main:border-indigo-200",

  modalSectionDivider:
    "pt-3 md:pt-4 border-t border-slate-700 group-data-[theme=light]/main:border-slate-200",

  subsectionHeading:
    "text-sm font-semibold text-slate-200 group-data-[theme=light]/main:text-slate-800",

  iconButton:
    "p-1 text-slate-400 hover:text-slate-200 transition-colors group-data-[theme=light]/main:text-slate-500 group-data-[theme=light]/main:hover:text-slate-800",

  iconButtonRow:
    "p-2 rounded-lg transition-colors text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 group-data-[theme=light]/main:text-slate-500 group-data-[theme=light]/main:hover:text-slate-800 group-data-[theme=light]/main:hover:bg-slate-100",

  modalClose:
    "text-slate-400 hover:text-white transition-colors flex-shrink-0 group-data-[theme=light]/main:text-slate-500 group-data-[theme=light]/main:hover:text-slate-800",

  btnCancel:
    "flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium group-data-[theme=light]/main:bg-slate-200 group-data-[theme=light]/main:hover:bg-slate-300 group-data-[theme=light]/main:text-slate-800",

  mutedLine:
    "text-center py-8 text-slate-400 text-sm group-data-[theme=light]/main:text-slate-500",

  loadingHint: "ml-2 text-sm text-slate-400 group-data-[theme=light]/main:text-slate-500",

  labelSm:
    "block text-sm font-medium text-slate-300 mb-1 group-data-[theme=light]/main:text-slate-700",

  modalFormHeader:
    "p-6 border-b border-slate-700 flex items-center justify-between group-data-[theme=light]/main:border-slate-200",

  modalFormSectionBorder:
    "pt-2 border-t border-slate-700 group-data-[theme=light]/main:border-slate-200",

  formFooterBar:
    "flex justify-end gap-3 pt-4 border-t border-slate-700 group-data-[theme=light]/main:border-slate-200",

  deleteModalHead:
    "p-6 border-b border-slate-700 group-data-[theme=light]/main:border-slate-200",

  deleteModalFoot:
    "flex justify-end gap-3 p-6 border-t border-slate-700 group-data-[theme=light]/main:border-slate-200",

  btnToolbarSecondary:
    "flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium group-data-[theme=light]/main:bg-slate-200 group-data-[theme=light]/main:hover:bg-slate-300 group-data-[theme=light]/main:text-slate-800",

  btnSecondarySm:
    "px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium group-data-[theme=light]/main:bg-slate-200 group-data-[theme=light]/main:hover:bg-slate-300 group-data-[theme=light]/main:text-slate-800",

  tableHeadCell:
    "px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider group-data-[theme=light]/main:text-slate-500",

  tableRowName:
    "text-sm font-medium text-white group-data-[theme=light]/main:text-slate-900",

  tableRowDesc:
    "text-xs text-slate-400 mt-1 max-w-md truncate group-data-[theme=light]/main:text-slate-600",

  tableMuted:
    "text-xs text-slate-300 group-data-[theme=light]/main:text-slate-600",

  tableMetricWrap: "text-slate-300 group-data-[theme=light]/main:text-slate-700",

  tableMetricVal: "text-slate-400 group-data-[theme=light]/main:text-slate-500",

  tbodyDivide: "divide-y divide-slate-700 group-data-[theme=light]/main:divide-slate-200",

  iconEdit:
    "p-1.5 text-slate-400 hover:text-blue-400 transition-colors group-data-[theme=light]/main:text-slate-500",

  iconDeleteRow:
    "p-1.5 text-slate-400 hover:text-rose-400 transition-colors group-data-[theme=light]/main:text-slate-500",
} as const;
