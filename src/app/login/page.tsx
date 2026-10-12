import type { Metadata } from "next";
import { connection } from "next/server";
import { isPasswordConfigured } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "접속 확인 | 인사나침반",
};

export default async function LoginPage() {
  // 비밀번호 설정 여부는 빌드 시점이 아니라 요청 시점에 확인한다.
  await connection();
  const configured = isPasswordConfigured();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 p-8 shadow-sm dark:border-white/15">
        <h1 className="text-2xl font-bold">인사나침반</h1>
        <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          테스트 버전입니다. 비밀번호를 입력해야 사용할 수 있습니다.
        </p>
        {configured ? (
          <LoginForm />
        ) : (
          <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            비밀번호가 설정되지 않았습니다. <code>.env</code> 파일에{" "}
            <code>APP_PASSWORD</code>(비밀번호)와 <code>AUTH_SECRET</code>(32자 이상
            무작위 값)을 입력한 뒤 개발 서버를 다시 시작하세요.
          </p>
        )}
      </div>
    </main>
  );
}
