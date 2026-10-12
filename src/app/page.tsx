import ChatPanel from "@/components/ChatPanel";
import { logout } from "./login/actions";

// 메인 대시보드 (DESIGN 2.2): 머리글 + 대화 영역·입력창·결과물 패널(ChatPanel 안)
export default function Home() {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-5 sm:px-6 dark:border-white/15">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            인사나침반
          </h1>
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
            테스트 버전
          </span>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
          >
            나가기
          </button>
        </form>
      </header>

      <ChatPanel />
    </div>
  );
}
