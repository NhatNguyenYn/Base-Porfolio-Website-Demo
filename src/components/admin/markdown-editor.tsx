"use client";

import { marked } from "marked";
import { useMemo, useRef, useState } from "react";
import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Table,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Markdown editor with a formatting toolbar and a safe live preview.
 * Raw HTML is escaped before rendering, so the preview cannot execute markup.
 */
export function MarkdownEditor({
  name,
  label,
  defaultValue = "",
  rows = 18,
  help,
  required = false,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  rows?: number;
  help?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const preview = useMemo(() => {
    if (!value.trim()) return "";
    const escaped = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    try {
      return marked.parse(escaped, { async: false, gfm: true, breaks: false }) as string;
    } catch {
      return "";
    }
  }, [value]);

  function surround(prefix: string, suffix = prefix, placeholder = "nội dung") {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || placeholder;
    const next = `${value.slice(0, start)}${prefix}${selected}${suffix}${value.slice(end)}`;
    setValue(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  }

  function prefixLine(prefix: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const next = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`;
    setValue(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  }

  const tools = [
    { icon: Heading1, label: "Tiêu đề 1", run: () => prefixLine("# ") },
    { icon: Heading2, label: "Tiêu đề 2", run: () => prefixLine("## ") },
    { icon: Heading3, label: "Tiêu đề 3", run: () => prefixLine("### ") },
    { icon: Bold, label: "Đậm", run: () => surround("**") },
    { icon: Italic, label: "Nghiêng", run: () => surround("_") },
    { icon: Quote, label: "Trích dẫn", run: () => prefixLine("> ") },
    { icon: List, label: "Danh sách", run: () => prefixLine("- ") },
    { icon: ListOrdered, label: "Danh sách đánh số", run: () => prefixLine("1. ") },
    { icon: Link2, label: "Liên kết", run: () => surround("[", "](https://example.com)", "tiêu đề liên kết") },
    { icon: ImageIcon, label: "Hình ảnh", run: () => surround("![mô tả](", ")", "/media/…") },
    { icon: Code2, label: "Khối mã", run: () => surround("\n```\n", "\n```\n", "code") },
    { icon: Table, label: "Bảng", run: () => surround("\n| Cột 1 | Cột 2 |\n| --- | --- |\n| ", " |  |\n", "giá trị") },
    { icon: Minus, label: "Đường kẻ", run: () => surround("\n\n---\n\n", "", "") },
  ];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={`md-${name}`} className="field-label mb-0">
          {label}
          {required && <span className="ml-1 text-[#b03a2e]">*</span>}
        </label>
        <div className="flex items-center gap-1">
          {(["write", "preview"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10.5px] transition-colors",
                mode === item ? "bg-primary text-primary-fg" : "text-muted hover:text-ink",
              )}
            >
              {item === "write" ? "Soạn thảo" : "Xem trước"}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-line bg-surface">
        {mode === "write" ? (
          <>
            <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1.5">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.label}
                    type="button"
                    onClick={tool.run}
                    title={tool.label}
                    aria-label={tool.label}
                    className="grid h-7 w-7 place-items-center rounded-[2px] text-muted transition-colors hover:bg-surface-muted hover:text-ink"
                  >
                    <Icon size={13} strokeWidth={1.7} />
                  </button>
                );
              })}
              <span className="ml-auto text-[10px] text-muted">{value.length.toLocaleString("vi-VN")} ký tự</span>
            </div>
            <textarea
              id={`md-${name}`}
              ref={textareaRef}
              name={name}
              value={value}
              rows={rows}
              onChange={(event) => setValue(event.target.value)}
              className="w-full resize-y border-0 bg-transparent px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink outline-none"
              placeholder={"## Tiêu đề\n\nNội dung hỗ trợ **Markdown**: danh sách, trích dẫn, khối mã, liên kết…"}
            />
          </>
        ) : (
          <div className="max-h-[560px] min-h-[240px] overflow-y-auto px-5 py-4">
            {preview ? (
              <div className="prose-editorial max-w-none text-[14px]" dangerouslySetInnerHTML={{ __html: preview }} />
            ) : (
              <p className="text-[12.5px] text-muted">Chưa có nội dung để xem trước.</p>
            )}
            <input type="hidden" name={name} value={value} />
          </div>
        )}
      </div>

      <p className="mt-1.5 text-[10.5px] text-muted">
        {help ?? "Hỗ trợ Markdown: tiêu đề, danh sách, trích dẫn, khối mã, bảng và liên kết. Nội dung được lọc an toàn khi hiển thị."}
      </p>
    </div>
  );
}
