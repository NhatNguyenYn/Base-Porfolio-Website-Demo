"use client";

import { useActionState } from "react";
import { loginAction } from "@/server/actions/auth";
import type { ActionState } from "@/lib/action-state";

const initialState: ActionState = { ok: false, message: "" };

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="space-y-4">
      {state.message && (
        <p role="alert" className="border-l-2 border-danger bg-danger-soft px-3 py-2 text-[12px] text-danger">
          {state.message}
        </p>
      )}

      <div>
        <label htmlFor="email" className="field-label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="field"
          placeholder="admin@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="field-label">
          Mật khẩu
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field"
          placeholder="••••••••"
        />
      </div>

      <input type="hidden" name="next" value={nextPath} />

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>

      <p className="text-[10.5px] leading-relaxed text-muted">
        Phiên đăng nhập được lưu trong cookie httpOnly và có hiệu lực 7 ngày.
      </p>
    </form>
  );
}
