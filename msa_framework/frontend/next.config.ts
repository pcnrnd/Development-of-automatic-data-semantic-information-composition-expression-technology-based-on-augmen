import type { NextConfig } from "next";

/**
 * 환경 변수 검증 함수
 */
function validateEnv() {
  const env = process.env.NODE_ENV;
  const fastApiUrl = process.env.FASTAPI_BASE_URL;

  // 프로덕션 환경에서는 반드시 설정되어야 함
  if (env === "production" && !fastApiUrl) {
    throw new Error(
      "빌드 오류: 프로덕션 환경에서는 FASTAPI_BASE_URL 환경 변수가 반드시 설정되어야 합니다."
    );
  }

  // URL 형식 검증 (설정된 경우)
  if (fastApiUrl) {
    try {
      const url = new URL(fastApiUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error(`지원하지 않는 프로토콜: ${url.protocol}`);
      }
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(
          `빌드 오류: FASTAPI_BASE_URL이 유효한 URL 형식이 아닙니다: ${fastApiUrl}`
        );
      }
      throw error;
    }
  }
}

// 빌드 타임 환경 변수 검증
try {
  validateEnv();
} catch (error) {
  console.error("❌ 환경 변수 검증 실패:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const base = process.env.FASTAPI_BASE_URL ?? "http://localhost:8000";
    const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
    return [
      {
        source: "/api/:path*",
        destination: `${normalized}/:path*`,
      },
    ];
  },
};

export default nextConfig;
