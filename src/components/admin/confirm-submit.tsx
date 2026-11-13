"use client";

import { useRef } from "react";
import { Trash2 } from "lucide-react";

/**
 * Submit button that asks for confirmation in a modal before the enclosing
 * form is actually submitted.
 */
export function ConfirmSubmit({
  title,
  description,
  confirmLabel = "Xoá",
  cancelLabel = "Huỷ",
  triggerLabel = "Xoá",
  tone = "danger",
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  triggerLabel?: string;
  tone?: "danger" | "neutral";
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function confirm() {
    const form = buttonRef.current?.closest("form");
    dialogRef.current?.close();
    form?.requestSubmit();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={open}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
          tone === "danger"
            ? "border-danger/30 text-danger hover:border-danger hover:bg-danger-soft"
            : "border-line text-muted hover:border-ink hover:text-ink"
        }`}
      >
        {tone === "danger" && <Trash2 size={11} aria-hidden="true" />}
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[min(420px,92vw)] border border-line bg-surface p-0 text-ink backdrop:bg-black/45"
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
      >
        <div className="p-6">
          <h2 className="text-[17px] tracking-tight">{title}</h2>
          {description && <p className="mt-2 text-[13px] leading-relaxed text-muted">{description}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={close} className="btn btn-outline btn-sm">
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={confirm}
              className={`btn btn-sm ${tone === "danger" ? "bg-danger text-white hover:bg-danger-hover" : "btn-primary"}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
