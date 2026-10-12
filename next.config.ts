import type { NextConfig } from "next";

// 모든 화면·API 응답에 붙이는 보안 헤더 (보안 점검 5번)
const securityHeaders = [
  // 다른 사이트가 이 화면을 몰래 틀(iframe) 안에 넣지 못하게 한다 (클릭재킹 방지)
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  // 브라우저가 파일 종류를 멋대로 추측하지 않게 한다
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 다른 사이트로 이동할 때 주소 전체(질문 등)가 넘어가지 않게 한다
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 쓰지 않는 기기 권한은 막는다
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // 응답에 "X-Powered-By: Next.js"를 붙이지 않는다 (사용 기술을 드러내지 않기)
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
