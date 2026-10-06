import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 자동 시험 설정: src 아래 *.test.ts 파일을 돌리고, "@/..." 경로 별칭을 Next.js와 똑같이 맞춘다.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
