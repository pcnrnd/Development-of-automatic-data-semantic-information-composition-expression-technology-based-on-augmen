export enum ServiceCategory {
  DATA_COLLECTION = "Data Collection & Management",
  ANALYSIS_MODELING = "Analysis & Modeling",
  STRUCTURE_VISUALIZATION = "Structuring & Visualization",
}

export interface Microservice {
  id: string;
  name: string;
  category: ServiceCategory;
  description: string;
  status: "healthy" | "degraded" | "down";
  metrics: {
    latency: number;
    throughput: number;
    errorRate: number;
  };
  // 네트워크 정보: 게이트웨이 라우팅에 필수
  host: string;
  port: number;
  protocol: string;
}

export interface InfraNode {
  id: string;
  name: string;
  type: "gateway" | "mesh" | "container" | "monitor" | "storage";
  description: string;
  details: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

