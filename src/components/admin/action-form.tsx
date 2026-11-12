"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/action-state";

export type SubmittableAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

const initialState: ActionState = { ok: false, message: "" };

/**
 * Shared admin form wrapper: server-action state, validation summary,
 * success banner, pending state and an unsaved-changes warning.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Lưu thay đổi",
  resetOnSuccess = false,
  className = "",
  footer,
  hint,
  id,
}: {
  action: SubmittableAction;
  children: React.ReactNode;
  submitLabel?: string;
  resetOnSuccess?: boolean;
  className?: string;
  footer?: React.ReactNode;
  hint?: string;
  id?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (state.ok && resetOnSuccess) {
      formRef.current?.reset();
      dirtyRef.current = false;
    }
  }, [state, resetOnSuccess]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const errorEntries = Object.entries(state.fieldErrors ?? {}).slice(0, 6);

  return (
    <form
      ref={formRef}
      id={id}
      action={formAction}
      className={className}
      onInput={() => {
        dirtyRef.current = true;
      }}
      onSubmit={() => {
        dirtyRef.current = false;
      }}
    >
      {!state.ok && state.message && (
        <div role="alert" className="mb-6 border-l-2 border-[#c0392b] bg-[#c0392b]/5 px-4 py-3">
          <p className="text-[13px] font-medium text-[#b03a2e]">{state.message}</p>
          {errorEntries.length > 0 && (
            <ul className="mt-2 space-y-1 text-[12px] text-[#b03a2e]">
              {errorEntries.map(([field, messages]) => (
                <li key={field}>
                  <span className="font-medium">{field}</span>: {messages.join(", ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state.ok && state.message && (
        <div role="status" className="mb-6 flex items-center gap-2 border-l-2 border-[#2f7d5b] bg-[#2f7d5b]/5 px-4 py-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2f7d5b" strokeWidth="2" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <p className="text-[13px] text-[#256b4d]">{state.message}</p>
        </div>
      )}

      {children}

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <div className="text-[11px] text-muted">{hint}</div>
        <div className="flex flex-wrap items-center gap-2">
          {footer}
          <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
            {pending ? "Đang lưu…" : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
