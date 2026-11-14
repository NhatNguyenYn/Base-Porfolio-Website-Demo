"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";
import { uploadMediaAction, type UploadState } from "@/server/actions/media";
import { useFocusTrap } from "@/lib/focus-trap";
import type { MediaView } from "@/server/queries/types";

/**
 * Single or multi image field backed by the media library, with inline upload.
 * The submitted value is the media id (or a comma separated list of ids).
 */
export function MediaPicker({
  name,
  label,
  help,
  initial,
  library,
  multiple = false,
  required = false,
  maxHeight = "aspect-[4/3]",
}: {
  name: string;
  label: string;
  help?: string;
  initial: MediaView[];
  library: MediaView[];
  multiple?: boolean;
  required?: boolean;
  maxHeight?: string;
}) {
  const [selected, setSelected] = useState<MediaView[]>(initial);
  const [items, setItems] = useState<MediaView[]>(library);
  const [open, setOpen] = useState(false);
  const [uploadState, uploadAction, uploading] = useActionState(uploadMediaAction, {
    ok: false,
    message: "",
  } satisfies UploadState);
  const processedRef = useRef("");
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Shared focus trap: Tab cycles inside the dialog, Escape closes it, and
  // focus returns to the trigger that opened it.
  useFocusTrap(dialogRef, open, { onEscape: () => setOpen(false) });

  useEffect(() => {
    const files = uploadState.files;
    if (!uploadState.ok || !files || files.length === 0) return;
    const signature = files.map((file) => file.id).join(",");
    if (processedRef.current === signature) return;
    processedRef.current = signature;

    setItems((previous) => [...files, ...previous.filter((item) => !files.some((file) => file.id === item.id))]);
    setSelected((previous) =>
      multiple
        ? [...previous, ...files.filter((file) => !previous.some((item) => item.id === file.id))]
        : [files[0]],
    );
  }, [uploadState, multiple]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function choose(item: MediaView) {
    setSelected((previous) => {
      if (!multiple) return [item];
      return previous.some((entry) => entry.id === item.id)
        ? previous.filter((entry) => entry.id !== item.id)
        : [...previous, item];
    });
    if (!multiple) setOpen(false);
  }

  function remove(id: string) {
    setSelected((previous) => previous.filter((item) => item.id !== id));
  }

  const value = multiple ? selected.map((item) => item.id).join(",") : selected[0]?.id ?? "";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="field-label mb-0">
          {label}
          {required && <span className="ml-1 text-danger">*</span>}
        </span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => setSelected([])}
            className="text-[10.5px] text-muted underline underline-offset-2 hover:text-ink"
          >
            Bỏ chọn
          </button>
        )}
      </div>

      <input type="hidden" name={name} value={value} />

      {selected.length === 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full flex-col items-center justify-center gap-2 border border-dashed border-line-strong bg-surface px-4 py-10 text-muted transition-colors hover:border-accent hover:text-ink"
        >
          <ImagePlus size={20} strokeWidth={1.4} />
          <span className="text-[12px]">Chọn ảnh từ thư viện</span>
          <span className="text-[10px]">hoặc tải ảnh mới lên</span>
        </button>
      ) : (
        <div className={multiple ? "grid grid-cols-3 gap-2 sm:grid-cols-4" : ""}>
          <div className={multiple ? "relative" : `relative w-full max-w-xs ${maxHeight}`}>
            {multiple ? (
              <div className="relative aspect-square overflow-hidden border border-line bg-surface-muted">
                <Image src={selected[0]!.url} alt={selected[0]!.alt} fill sizes="140px" className="object-cover" />
              </div>
            ) : (
              <div className={`relative overflow-hidden border border-line bg-surface-muted ${maxHeight}`}>
                <Image src={selected[0]!.url} alt={selected[0]!.alt} fill sizes="360px" className="object-cover" />
              </div>
            )}
            {!multiple && (
              <button
                type="button"
                onClick={() => remove(selected[0]!.id)}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/90 text-muted shadow-sm hover:text-ink"
                aria-label="Bỏ ảnh"
              >
                <X size={13} />
              </button>
            )}
            {!multiple && (
              <p className="mt-1.5 truncate text-[10.5px] text-muted">
                {selected[0]!.width && selected[0]!.height
                  ? `${selected[0]!.width} × ${selected[0]!.height}px`
                  : selected[0]!.title}
              </p>
            )}
            {multiple && (
              <button
                type="button"
                onClick={() => remove(selected[0]!.id)}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-background/90 text-muted hover:text-ink"
                aria-label="Bỏ ảnh"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {multiple &&
            selected.slice(1).map((item) => (
              <div key={item.id} className="relative aspect-square overflow-hidden border border-line bg-surface-muted">
                <Image src={item.url} alt={item.alt} fill sizes="140px" className="object-cover" />
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-background/90 text-muted hover:text-ink"
                  aria-label="Bỏ ảnh"
                >
                  <X size={11} />
                </button>
              </div>
            ))}

          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`grid place-items-center border border-dashed border-line-strong text-muted transition-colors hover:border-accent hover:text-ink ${
              multiple ? "aspect-square" : "mt-2 h-9 w-full max-w-xs"
            }`}
          >
            <span className="flex items-center gap-1.5 text-[10.5px]">
              <ImagePlus size={12} />
              {multiple ? "Thêm" : "Đổi ảnh"}
            </span>
          </button>
        </div>
      )}

      {help && <p className="mt-1.5 text-[10.5px] text-muted">{help}</p>}

      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => {
            if (event.target === dialogRef.current) setOpen(false);
          }}
        >
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col border border-line bg-background">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div>
                <p className="text-[13px] font-medium">{label}</p>
                <p className="text-[10.5px] text-muted">
                  {multiple ? "Chọn một hoặc nhiều ảnh" : "Chọn một ảnh"} · tải lên JPG, PNG, WebP, AVIF, GIF
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full border border-line text-muted hover:text-ink"
                aria-label="Đóng"
              >
                <X size={14} />
              </button>
            </div>

            <div className="border-b border-line p-4">
              <form action={uploadAction} className="flex flex-wrap items-end gap-2">
                <label className="flex-1">
                  <span className="field-label">Tải ảnh mới</span>
                  <input
                    type="file"
                    name="files"
                    accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                    multiple
                    required
                    className="block w-full text-[11px] text-muted file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-[11px] file:text-primary-fg"
                  />
                </label>
                <button type="submit" className="btn btn-primary btn-sm" disabled={uploading}>
                  <Upload size={12} aria-hidden="true" />
                  {uploading ? "Đang tải…" : "Tải lên"}
                </button>
              </form>
              {uploadState.message && (
                <p className={`mt-2 text-[11px] ${uploadState.ok ? "text-success" : "text-danger"}`}>
                  {uploadState.message}
                </p>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <p className="py-10 text-center text-[12px] text-muted">Thư viện chưa có ảnh. Hãy tải lên ảnh đầu tiên.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {items.map((item) => {
                    const active = selected.some((entry) => entry.id === item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => choose(item)}
                        className={`group relative aspect-square overflow-hidden border text-left ${
                          active ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-line-strong"
                        }`}
                      >
                        <Image src={item.url} alt={item.alt} fill sizes="180px" className="object-cover" />
                        <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                          {item.title || item.alt}
                        </span>
                        {active && (
                          <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-white">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
              <p className="text-[10.5px] text-muted">Đã chọn {selected.length} ảnh</p>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-outline btn-sm">
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
