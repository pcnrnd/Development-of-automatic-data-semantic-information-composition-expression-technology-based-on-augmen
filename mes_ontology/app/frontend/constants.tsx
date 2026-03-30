import React from 'react';
import { MESFunction, ResultTemplate } from './types';

/**
 * Standard MES Ontology: ISA-95, ISO 9001, GS1을 참고해 설계한 MES 기능 목록.
 * 표준 조항 검증·인증 로직은 포함하지 않으며, 기능별 출처 표시용입니다.
 */
export const MES_ONTOLOGY: MESFunction[] = [
  {
    id: 'F001',
    category: 'Tracking',
    name: 'Real-time Work-in-Progress (WIP) Tracking',
    description: 'Monitors the flow of materials and products through the production line in real-time.',
    descriptionKo: '생산 라인에서 자재·제품의 흐름을 실시간으로 모니터링합니다.',
    standard: 'ISA-95'
  },
  {
    id: 'F002',
    category: 'Quality',
    name: 'Statistical Process Control (SPC)',
    description: 'Uses statistical methods to monitor and control a process to ensure it operates at its full potential.',
    descriptionKo: '통계적 방법으로 공정을 모니터링·관리하여 품질을 유지합니다.',
    standard: 'ISO 9001'
  },
  {
    id: 'F003',
    category: 'Maintenance',
    name: 'Predictive Maintenance (PdM)',
    description: 'Predicts when equipment failure might occur so maintenance can be performed just-in-time.',
    descriptionKo: '설비 고장 시점을 예측하여 적시에 보전할 수 있도록 합니다.',
    standard: 'ISA-95'
  },
  {
    id: 'F004',
    category: 'Production',
    name: 'Dynamic Scheduling',
    description: 'Automatically adjusts production schedules based on current machine availability and order priorities.',
    descriptionKo: '설비 가동률·수주 우선순위에 따라 생산 일정을 자동 조정합니다.',
    standard: 'ISA-95'
  },
  {
    id: 'F005',
    category: 'Inventory',
    name: 'Automated Traceability',
    description: 'Ensures end-to-end traceability of components from supplier to finished goods.',
    descriptionKo: '부품부터 완제품까지 전 구간 이력 추적을 보장합니다.',
    standard: 'GS1'
  },
  {
    id: 'F006',
    category: 'Quality',
    name: 'Non-Conformance Management',
    description: 'Systematically handles defects and deviations in the manufacturing process.',
    descriptionKo: '불량·편차를 체계적으로 관리하고 이력화합니다.',
    standard: 'ISO 9001'
  },
  {
    id: 'F007',
    category: 'Production',
    name: 'Production Order Management',
    description: 'Manages production order release, progress, and completion, linking work orders with actuals.',
    descriptionKo: '생산 오더 배분·진행·완료를 관리하고, 작업 지시와 실적을 연동합니다.',
    standard: 'ISA-95'
  },
  {
    id: 'F008',
    category: 'Maintenance',
    name: 'Maintenance Scheduling',
    description: 'Allocates maintenance schedules, labor, and materials; plans equipment availability and periodic inspections.',
    descriptionKo: '보전 일정·인력·자재를 할당하고, 설비 가동률과 정기 점검을 계획합니다.',
    standard: 'ISA-95'
  },
  {
    id: 'F009',
    category: 'Tracking',
    name: 'Material Consumption Tracking',
    description: 'Tracks material and energy consumption in real time and manages lot/batch-level history.',
    descriptionKo: '자재·에너지 소비량을 실시간 추적하고, Lot/배치 단위 이력을 관리합니다.',
    standard: 'ISA-95'
  }
];

export const PIPELINE_STEPS = [
  'Data Profiling',
  'AutoML Modeling',
  'Ontology Matching',
  'Strategy Recommendation'
];

/** 파이프라인 단계별 한글 맥락 설명 (기술개발 흐름 반영) */
export const PIPELINE_STEPS_KO = [
  '산업데이터 프로파일링 및 필요 기능 추출',
  'AutoML로 적합 모델 도출',
  '필요기능 모델과 표준 온톨로지 매칭',
  '매칭 결과 기반 MES 기능 우선순위 제안'
];

/** Configuration 섹션 한 줄 설명 */
export const CONFIG_SECTION_DESCRIPTION_KO =
  '산업데이터 입력 후 AutoML로 모델 도출·필요 기능 추출 → 표준 MES 온톨로지와 매칭하여 우선순위를 제안합니다.';

/** Priority Recommendation 섹션 한 줄 설명 */
export const PRIORITY_RECOMMENDATION_DESCRIPTION_KO =
  '매칭 결과를 바탕으로 제조기업에 필요한 MES 기능 제안 (Rule based 우선순위)';

/** Insights(증강분석) 섹션 한 줄 설명 */
export const INSIGHTS_SECTION_DESCRIPTION_KO =
  '산업데이터 증강분석 플랫폼 활용 제안: 필요기능·표준기능 매칭 품질 향상을 위한 보완 방향';

/** Standard MES Ontology 섹션 한 줄 설명 */
export const ONTOLOGY_SECTION_DESCRIPTION_KO =
  '다양한 산업데이터 모델링 결과를 반영한 국제 표준 MES 기능 모델 온톨로지';

/**
 * 참조용 더미 템플릿. 온톨로지 그래프에 항상 함께 노출되어 사용자에게 참고할 분석 유형을 제시합니다.
 * 각 Function(L2)당 1~2개 템플릿을 두어 L3 계층을 구성합니다.
 * dataUsageSummary는 실제 활용을 가정한 더미 현황이며, 추후 API/DB 연동 시 교체 가능하도록 상수로 분리했습니다.
 */
export const REFERENCE_TEMPLATES: ResultTemplate[] = [
  // --- F001: Real-time WIP Tracking (1~2개) ---
  {
    id: 'ref-wip',
    name: '참조: WIP 추적 분석',
    recommendedFunctionIds: ['F001'],
    summary: '실시간 재공 재고 추적 데이터 기반 흐름 분석 템플릿입니다.',
    modelName: 'RandomForest',
    modelPerformance: { accuracy: 0.912, f1Score: 0.898, precision: 0.905, recall: 0.891, trainingTime: '1m 45s' },
    preprocessingMethods: ['StandardScaler', '결측치 보간', '이상치 제거'],
    visualizationMethods: ['시계열 흐름 차트', '산점도', '실제 vs 예측'],
    dataUsageSummary: '생산 이력 12,450건 (2024.01~2024.06), 8개 공정 변수(라인ID·작업장·Lot·수량·시작/종료 시각 등). 샘플링률 100%, 학습/검증 8:2 분할 적용.',
  },
  {
    id: 'ref-wip-2',
    name: '참조: 재공품 이동 시간 분석',
    recommendedFunctionIds: ['F001'],
    summary: '공정 간 재공품 체공·이동 시간을 추적하여 병목 구간을 식별하는 템플릿입니다.',
    modelName: 'XGBoost',
    modelPerformance: { rmse: 12.4, trainingTime: '2m 10s' },
    preprocessingMethods: ['시간 차분', '이동 평균', '결측치 제거'],
    visualizationMethods: ['공정별 체공시간 박스플롯', '흐름도', '시계열 대시보드'],
    dataUsageSummary: '이동 이력 9,800건, 6개 변수(작업장·Lot·입고시각·출고시각·대기시간·이동시간). 12개 공정, 8:2 분할 적용.',
  },
  // --- F002: SPC (1~2개) ---
  {
    id: 'ref-spc',
    name: '참조: SPC 품질 분석',
    recommendedFunctionIds: ['F002'],
    summary: '통계적 공정 관리(SPC)를 위한 품질 지표 분석 템플릿입니다.',
    modelName: 'LogisticRegression',
    modelPerformance: { accuracy: 0.887, f1Score: 0.872, precision: 0.881, recall: 0.863, trainingTime: '0m 52s' },
    preprocessingMethods: ['StandardScaler', '클래스 균형', '차원 축소'],
    visualizationMethods: ['혼동 행렬', '클래스 분포', '히트맵'],
    dataUsageSummary: '품질 검사 데이터 8,200건, 5개 품질 지표(치수·경도·불량 유형 등). 배치 단위 420개, 불량/정상 이진 분류. 시계열 순서 유지하여 검증셋 구성.',
  },
  {
    id: 'ref-spc-2',
    name: '참조: Cpk/Ppk 지능형 분석',
    recommendedFunctionIds: ['F002'],
    summary: '공정 능력 지수(Cpk/Ppk) 산출 및 규격 대비 공정 안정성 평가 템플릿입니다.',
    modelName: 'RandomForest',
    modelPerformance: { rmse: 0.08, trainingTime: '3m 20s' },
    preprocessingMethods: ['이상치 제거', '정규성 검정', '구간 집계'],
    visualizationMethods: ['관리도', '히스토그램', 'Cpk/Ppk 트렌드'],
    dataUsageSummary: '치수 측정 데이터 15,600건, 4개 특성(직경·두께·경도·무게). 규격상한/하한 연동, 샘플 20개 단위 Cpk 계산.',
  },
  // --- F003: Predictive Maintenance (1~2개) ---
  {
    id: 'ref-pdm',
    name: '참조: 예지 보전 분석',
    recommendedFunctionIds: ['F003'],
    summary: '설비 센서 데이터 기반 고장 예측 및 예지 보전 템플릿입니다.',
    modelName: 'GradientBoosting',
    modelPerformance: { accuracy: 0.934, f1Score: 0.921, precision: 0.928, recall: 0.914, trainingTime: '4m 15s' },
    preprocessingMethods: ['StandardScaler', '결측치 보간', '이상치 제거', '시계열 윈도우'],
    visualizationMethods: ['특성 추세', '잔차 플롯', '실제 vs 예측'],
    dataUsageSummary: '설비 센서 데이터 45,000건 (15개 채널, 1분 간격, 약 2일치). 진동·온도·전류 등 12개 특징 사용. 고장 라벨 320건 포함, 24시간 전 예측 타깃으로 활용.',
  },
  {
    id: 'ref-pdm-2',
    name: '참조: 잔존 수명(RUL) 예측',
    recommendedFunctionIds: ['F003'],
    summary: '설비 상태 추세 기반 잔존 가동 시간(Remaining Useful Life) 예측 템플릿입니다.',
    modelName: 'XGBoost',
    modelPerformance: { rmse: 18.2, trainingTime: '5m 40s' },
    preprocessingMethods: ['시계열 윈도우', '특성 추출', 'StandardScaler', '결측치 보간'],
    visualizationMethods: ['RUL 추세선', '위험도 점수', '실제 vs 예측'],
    dataUsageSummary: '베어링/모터 센서 62,000건, 14개 채널. 고장 시점까지 거리(RUL) 라벨 180건, 회귀 타깃으로 활용.',
  },
  // --- F004: Dynamic Scheduling (1~2개) ---
  {
    id: 'ref-sched-1',
    name: '참조: 설비 가동률 기반 일정 최적화',
    recommendedFunctionIds: ['F004'],
    summary: '설비 가동률·고장 이력에 따른 생산 일정 재배치 및 최적화 템플릿입니다.',
    modelName: 'LightGBM',
    modelPerformance: { accuracy: 0.869, f1Score: 0.854, precision: 0.862, recall: 0.846, trainingTime: '2m 35s' },
    preprocessingMethods: ['가동률 집계', '날짜 인코딩', 'StandardScaler', '결측치 보간'],
    visualizationMethods: ['간트 차트', '가동률 히트맵', '일정 대비 실적'],
    dataUsageSummary: '일정·실적 데이터 4,200건 (3개월), 8개 변수(설비·작업·시작/종료·가동률·지연 등). 설비 15대, 8:2 분할.',
  },
  {
    id: 'ref-sched-2',
    name: '참조: 주문 우선순위·납기 반영 스케줄',
    recommendedFunctionIds: ['F004'],
    summary: '주문 우선순위·납기·자원 제약을 반영한 동적 스케줄 시뮬레이션 템플릿입니다.',
    modelName: 'XGBoost',
    modelPerformance: { accuracy: 0.901, f1Score: 0.889, precision: 0.895, recall: 0.883, trainingTime: '3m 05s' },
    preprocessingMethods: ['우선순위 스코어', '날짜/시간 인코딩', '제약 조건 플래그'],
    visualizationMethods: ['우선순위별 타임라인', '납기 준수율', '리소스 활용률'],
    dataUsageSummary: '주문 2,800건, 7개 변수(주문ID·납기·우선순위·수량·소요시간·설비 등). 지연 여부 라벨, 8:2 분할.',
  },
  // --- F005: Automated Traceability (1~2개) ---
  {
    id: 'ref-trace-1',
    name: '참조: 부품-완제품 일대일 이력 추적',
    recommendedFunctionIds: ['F005'],
    summary: '부품 Lot부터 완제품 시리얼까지 일대일 연결 이력 조회 및 시각화 템플릿입니다.',
    modelName: '-',
    modelPerformance: { trainingTime: '—' },
    preprocessingMethods: ['Lot/시리얼 매핑', '결측치 제거', '시간순 정렬'],
    visualizationMethods: ['이력 트리', '타임라인', '연결도 그래프'],
    dataUsageSummary: 'BOM·조립 이력 22,000건, 6개 변수(부품Lot·완제품 시리얼·작업장·시각 등). 품목 85종, 조회 기간 1년.',
  },
  {
    id: 'ref-trace-2',
    name: '참조: Lot/배치별 소급 조회',
    recommendedFunctionIds: ['F005'],
    summary: 'Lot·배치 단위로 원자재·공정·검사 이력을 역추적하는 소급(Recall) 조회 템플릿입니다.',
    modelName: '-',
    modelPerformance: { trainingTime: '—' },
    preprocessingMethods: ['Lot 키 조인', '날짜 필터', '집계'],
    visualizationMethods: ['소급 트리', '배치별 이력 테이블', '위험 Lot 하이라이트'],
    dataUsageSummary: 'Lot 이력 12,400건, 8개 변수(Lot·공정·검사결과·날짜·공급처 등). 배치 620개, 품목 45종.',
  },
  // --- F006: Non-Conformance Management (1~2개) ---
  {
    id: 'ref-ncm-1',
    name: '참조: 불량 유형별 집계 및 원인 분석',
    recommendedFunctionIds: ['F006'],
    summary: '불량 유형·공정별 집계 및 원인 코드 기반 패턴 분석 템플릿입니다.',
    modelName: 'LogisticRegression',
    modelPerformance: { accuracy: 0.876, f1Score: 0.861, precision: 0.868, recall: 0.854, trainingTime: '1m 22s' },
    preprocessingMethods: ['원인 코드 인코딩', '클래스 균형', 'StandardScaler'],
    visualizationMethods: ['파레토 차트', '원인별 히트맵', '공정별 불량률'],
    dataUsageSummary: '불량 이력 5,200건, 6개 변수(유형·공정·원인·날짜·Lot·수량). 불량 유형 12종, 8:2 분할.',
  },
  {
    id: 'ref-ncm-2',
    name: '참조: 편차 이력 및 시정조치 추적',
    recommendedFunctionIds: ['F006'],
    summary: '편차·불일치 이력과 시정조치(CAR) 연결 및 효과 검증 템플릿입니다.',
    modelName: 'RandomForest',
    modelPerformance: { accuracy: 0.893, f1Score: 0.878, precision: 0.885, recall: 0.871, trainingTime: '2m 48s' },
    preprocessingMethods: ['CAR 매핑', '날짜 인코딩', '결측치 제거'],
    visualizationMethods: ['편차-CAR 타임라인', '시정조치 완료율', '재발률 트렌드'],
    dataUsageSummary: '편차·CAR 3,800건, 7개 변수(편차ID·유형·발생일·CAR·완료일·담당 등). CAR 420건 연동.',
  },
  // --- F007: Production Order Management (1~2개) ---
  {
    id: 'ref-pom',
    name: '참조: 생산 오더 관리 분석',
    recommendedFunctionIds: ['F007'],
    summary: '생산 오더·작업 지시·실적 데이터 기반 일정 대비 달성률 및 병목 분석 템플릿입니다.',
    modelName: 'XGBoost',
    modelPerformance: { accuracy: 0.918, f1Score: 0.904, precision: 0.912, recall: 0.896, trainingTime: '2m 18s' },
    preprocessingMethods: ['StandardScaler', '결측치 보간', '이상치 제거', '시간 윈도우 집계'],
    visualizationMethods: ['간트 차트', '실적 vs 계획 대비', '산점도'],
    dataUsageSummary: '생산 오더 3,200건 (2024.03~2024.05), 6개 변수(오더ID·품목·수량·계획시작/종료·실적시작/종료). 작업장별 8:2 분할, 지연 여부 이진 라벨 포함.',
  },
  {
    id: 'ref-pom-2',
    name: '참조: 오더 달성률·지연 분석',
    recommendedFunctionIds: ['F007'],
    summary: '오더별 계획 대비 달성률·지연 요인 분석 및 예측 템플릿입니다.',
    modelName: 'LightGBM',
    modelPerformance: { accuracy: 0.885, f1Score: 0.871, precision: 0.879, recall: 0.863, trainingTime: '1m 55s' },
    preprocessingMethods: ['달성률/지연일 계산', 'StandardScaler', '카테고리 인코딩'],
    visualizationMethods: ['달성률 분포', '지연 원인 파레토', '실제 vs 예측'],
    dataUsageSummary: '오더 4,500건 (6개월), 8개 변수(오더·품목·계획/실적·지연일·원인 등). 지연 여부·지연일 라벨, 8:2 분할.',
  },
  // --- F008: Maintenance Scheduling (1~2개) ---
  {
    id: 'ref-maint',
    name: '참조: 보전 일정 분석',
    recommendedFunctionIds: ['F008'],
    summary: '보전 일정·설비 가동·점검 이력 데이터 기반 유지보수 효율 및 리소스 활용 분석 템플릿입니다.',
    modelName: 'LightGBM',
    modelPerformance: { accuracy: 0.862, f1Score: 0.848, precision: 0.855, recall: 0.841, trainingTime: '2m 02s' },
    preprocessingMethods: ['StandardScaler', '결측치 제거', '날짜/주기 인코딩', '카테고리 원핫'],
    visualizationMethods: ['캘린더 히트맵', '설비별 가동률', '막대/라인 차트'],
    dataUsageSummary: '보전 이력 5,800건 (약 6개월), 7개 변수(설비ID·일정·유형·소요시간·담당·부품·비용). 설비 42대, 정기/수시 구분 라벨.',
  },
  {
    id: 'ref-maint-2',
    name: '참조: 정기 점검 주기 최적화',
    recommendedFunctionIds: ['F008'],
    summary: '설비별 고장·점검 이력 기반 정기 점검 주기 추천 및 리스크 감소 효과 분석 템플릿입니다.',
    modelName: 'XGBoost',
    modelPerformance: { rmse: 2.1, trainingTime: '3m 12s' },
    preprocessingMethods: ['주기 집계', '고장 간격', 'StandardScaler', '결측치 제거'],
    visualizationMethods: ['주기별 고장률', '추천 주기 테이블', '리스크 스코어'],
    dataUsageSummary: '점검·고장 이력 7,200건 (1년), 6개 변수(설비·점검일·고장일·주기·유형 등). 설비 38대, 회귀 타깃 최적 주기.',
  },
  // --- F009: Material Consumption Tracking (1~2개) ---
  {
    id: 'ref-material',
    name: '참조: 자재 소비 추적 분석',
    recommendedFunctionIds: ['F009'],
    summary: '자재·에너지 소비 및 Lot 이력 데이터 기반 사용량 추세와 이상 탐지 분석 템플릿입니다.',
    modelName: 'RandomForest',
    modelPerformance: { accuracy: 0.904, f1Score: 0.891, precision: 0.898, recall: 0.884, trainingTime: '2m 35s' },
    preprocessingMethods: ['StandardScaler', '결측치 보간', '이상치 IQR', '롤링 평균'],
    visualizationMethods: ['시계열 추세', 'Lot별 소비량', '실제 vs 예측'],
    dataUsageSummary: '자재 소비 이력 18,200건 (2024.01~2024.04), 9개 변수(Lot·자재코드·수량·단위·작업장·시각 등). 품목 120종, 배치 단위 집계 적용.',
  },
  {
    id: 'ref-material-2',
    name: '참조: 에너지 사용량 추세 분석',
    recommendedFunctionIds: ['F009'],
    summary: '전력·가스 등 에너지 사용량 시계열 추세 및 절감 구간 탐지 템플릿입니다.',
    modelName: 'LightGBM',
    modelPerformance: { rmse: 8.5, trainingTime: '3m 40s' },
    preprocessingMethods: ['시간대 집계', 'StandardScaler', '이상치 제거', '계절성 분해'],
    visualizationMethods: ['에너지 추세 라인', '시간대별 히트맵', '절감 구간 하이라이트'],
    dataUsageSummary: '에너지 로그 43,200건 (1시간 간격, 5개월), 5개 변수(설비·전력·가스·온도·날짜). 설비 20대, 회귀 타깃 사용량.',
  },
];
