"use client";

import { useActionState } from "react";
import { setupAction } from "@/server/actions/auth";
import type { ActionState } from "@/lib/action-state";

const initialState: ActionState = { ok: false, message: "" };

export function SetupForm({ requiresToken }: { requiresToken: boolean }) {
  const [state, action, pending] = useActionState(setupAction, initialState);

  return (
    <form action={action} className="space-y-4">
      {state.message && (
        <div role="alert" className="border-l-2 border-danger bg-danger-soft px-3 py-2 text-[12px] text-danger">
          <p>{state.message}</p>
          {state.fieldErrors && (
            <ul className="mt-1.5 space-y-0.5">
              {Object.entries(state.fieldErrors).map(([field, messages]) => (
                <li key={field}>
                  {field}: {messages.join(", ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <label htmlFor="name" className="field-label">
          Tên hiển thị
        </label>
        <input id="name" name="name" required minLength={2} maxLength={80} className="field" placeholder="Nguyễn Văn A" />
      </div>

      <div>
        <label htmlFor="admin-email" className="field-label">
          Email
        </label>
        <input id="admin-email" name="email" type="email" required className="field" placeholder="admin@example.com" />
      </div>

      <div>
        <label htmlFor="password" className="field-label">
          Mật khẩu
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="field"
          placeholder="Tối thiểu 10 ký tự, có chữ và số"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="field-label">
          Nhập lại mật khẩu
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="field"
        />
      </div>

      {requiresToken && (
        <div>
          <label htmlFor="setupToken" className="field-label">
            Setup token
          </label>
          <input id="setupToken" name="setupToken" type="password" required className="field" />
        </div>
      )}

      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Đang tạo…" : "Tạo tài khoản quản trị"}
      </button>
    </form>
  );
}
