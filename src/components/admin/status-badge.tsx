import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  published: "border-[#2f7d5b]/30 bg-[#2f7d5b]/8 text-[#256b4d]",
  draft: "border-line bg-surface-muted text-muted",
  scheduled: "border-accent/30 bg-accent-soft text-accent",
  archived: "border-line bg-surface-muted text-muted line-through",
  public: "border-[#2f7d5b]/30 bg-[#2f7d5b]/8 text-[#256b4d]",
  private: "border-line bg-surface-muted text-muted",
  completed: "border-[#2f7d5b]/30 bg-[#2f7d5b]/8 text-[#256b4d]",
  in_progress: "border-accent/30 bg-accent-soft text-accent",
  unread: "border-accent/30 bg-accent-soft text-accent",
  read: "border-line bg-surface-muted text-muted",
  featured: "border-[#a6791f]/30 bg-[#a6791f]/8 text-[#8a6416]",
  active: "border-[#2f7d5b]/30 bg-[#2f7d5b]/8 text-[#256b4d]",
  inactive: "border-[#c0392b]/30 bg-[#c0392b]/8 text-[#b03a2e]",
  SUPER_ADMIN: "border-accent/30 bg-accent-soft text-accent",
  ADMIN: "border-line bg-surface-muted text-muted",
};

const LABELS: Record<string, string> = {
  published: "Đã xuất bản",
  draft: "Bản nháp",
  scheduled: "Hẹn giờ",
  archived: "Lưu trữ",
  public: "Công khai",
  private: "Riêng tư",
  completed: "Hoàn thành",
  in_progress: "Đang làm",
  unread: "Chưa đọc",
  read: "Đã đọc",
  active: "Đang hoạt động",
  inactive: "Đã vô hiệu hoá",
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-[0.02em]",
        STYLES[status] ?? "border-line bg-surface-muted text-muted",
      )}
    >
      {label ?? LABELS[status] ?? status}
    </span>
  );
}
