"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function Flash({
  message,
  tone = "success",
}: {
  message: string;
  tone?: "success" | "error";
}) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mb-6 flex items-start gap-2 border-l-2 px-4 py-2.5 ${
        tone === "error"
          ? "border-[#c0392b] bg-[#c0392b]/5 text-[#b03a2e]"
          : "border-[#2f7d5b] bg-[#2f7d5b]/5 text-[#256b4d]"
      }`}
    >
      <p className="flex-1 text-[12.5px] leading-relaxed">{message}</p>
      <button type="button" onClick={() => setVisible(false)} aria-label="Đóng thông báo" className="mt-0.5 opacity-70 hover:opacity-100">
        <X size={13} />
      </button>
    </div>
  );
}
