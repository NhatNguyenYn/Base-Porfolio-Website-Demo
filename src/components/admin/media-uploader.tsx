"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { uploadMediaAction, type UploadState } from "@/server/actions/media";

export function MediaUploader() {
  const [state, action, pending] = useActionState(uploadMediaAction, {
    ok: false,
    message: "",
  } satisfies UploadState);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      setNames([]);
    }
  }, [state, router]);

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (!inputRef.current || files.length === 0) return;
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    inputRef.current.files = transfer.files;
    setNames(files.map((file) => file.name));
  }

  return (
    <form action={action} className="border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-medium">Tải ảnh lên thư viện</h2>
          <p className="mt-0.5 text-[11px] text-muted">JPG, PNG, WebP, AVIF, GIF · tối đa 10 MB mỗi ảnh</p>
        </div>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? "Đang tải…" : "Tải lên"}
        </button>
      </div>

      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-4 py-10 text-center transition-colors ${
          dragging ? "border-accent bg-accent-soft/40" : "border-line-strong hover:border-accent"
        }`}
      >
        <UploadCloud size={22} strokeWidth={1.4} className="text-muted" aria-hidden="true" />
        <span className="text-[12px]">Kéo ảnh vào đây hoặc bấm để chọn</span>
        <span className="text-[10.5px] text-muted">Có thể chọn nhiều ảnh cùng lúc</span>
        <input
          ref={inputRef}
          type="file"
          name="files"
          multiple
          required
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="sr-only"
          onChange={(event) => setNames(Array.from(event.target.files ?? []).map((file) => file.name))}
        />
      </label>

      {names.length > 0 && (
        <p className="mt-2 truncate text-[11px] text-muted">Đã chọn: {names.join(", ")}</p>
      )}

      {state.message && (
        <p className={`mt-3 text-[11.5px] ${state.ok ? "text-[#256b4d]" : "text-[#b03a2e]"}`} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
