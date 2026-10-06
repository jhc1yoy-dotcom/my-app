"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="password" className="text-sm font-medium">
        접속 비밀번호
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoFocus
        autoComplete="current-password"
        className="h-11 rounded-lg border border-black/15 bg-transparent px-3 outline-none focus:border-blue-600 dark:border-white/20"
      />
      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-lg bg-blue-700 font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
      >
        {pending ? "확인 중…" : "들어가기"}
      </button>
    </form>
  );
}
