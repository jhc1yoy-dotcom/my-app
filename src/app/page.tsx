import { logout } from "./login/actions";

// 메인 대시보드 (질문·답변 화면). 질문·답변 기능은 이후 단계에서 채운다.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 sm:px-6 dark:border-white/15">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-bold">인사나침반</h1>
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

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
        <section className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/15 p-8 text-center dark:border-white/20">
          <p className="text-lg font-medium">인사·복무 규정에 대해 질문해 보세요</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            예: &quot;육아휴직 중 승진할 수 있나요?&quot;
          </p>
        </section>

        <form className="mt-4 flex flex-col gap-2">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            이름·주민등록번호 등 개인정보나 내부 자료를 입력하지 마세요.
          </p>
          <div className="flex gap-2">
            <input
              name="question"
              maxLength={500}
              placeholder="질문 기능은 준비 중입니다"
              disabled
              className="h-11 flex-1 rounded-lg border border-black/15 bg-transparent px-3 dark:border-white/20"
            />
            <button
              type="submit"
              disabled
              className="h-11 rounded-lg bg-blue-700 px-5 font-medium text-white opacity-60"
            >
              질문
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
