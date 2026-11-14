"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Vietnamese / English tabs for side-by-side translation editing. */
export function LocaleTabs({
  vi,
  en,
  hint,
}: {
  vi: React.ReactNode;
  en: React.ReactNode;
  hint?: string;
}) {
  const [active, setActive] = useState<"vi" | "en">("vi");
  const id = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabs = [
    { key: "vi", label: "Tiếng Việt" },
    { key: "en", label: "English" },
  ] as const;

  // WAI-ARIA tabs pattern: arrow keys move focus between tabs and activate
  // the tab they land on; Home/End jump to the first/last tab.
  function onTabListKeyDown(event: React.KeyboardEvent) {
    const current = tabs.findIndex((tab) => tab.key === active);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    setActive(tabs[next].key);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div
          className="flex items-center gap-1"
          role="tablist"
          aria-label="Ngôn ngữ nội dung"
          onKeyDown={onTabListKeyDown}
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.key}
              type="button"
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              role="tab"
              id={`${id}-${tab.key}-tab`}
              aria-selected={active === tab.key}
              aria-controls={`${id}-${tab.key}-panel`}
              tabIndex={active === tab.key ? 0 : -1}
              onClick={() => setActive(tab.key)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
                active === tab.key ? "bg-primary text-primary-fg" : "text-muted hover:text-ink",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="text-[10.5px] text-muted">
          {hint ?? "Để trống một ngôn ngữ nếu chưa có bản dịch — nội dung đó sẽ bị ẩn thay vì hiển thị sai ngôn ngữ."}
        </p>
      </div>

      <div
        id={`${id}-vi-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-vi-tab`}
        hidden={active !== "vi"}
        className="p-4 sm:p-5"
      >
        {vi}
      </div>
      <div
        id={`${id}-en-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-en-tab`}
        hidden={active !== "en"}
        className="p-4 sm:p-5"
      >
        {en}
      </div>
    </div>
  );
}
