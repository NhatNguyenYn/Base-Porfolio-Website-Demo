import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  published: "border-success/30 bg-success-soft text-success",
  draft: "border-line bg-surface-muted text-muted",
  scheduled: "border-accent/30 bg-accent-soft text-accent",
  archived: "border-line bg-surface-muted text-muted line-through",
  public: "border-success/30 bg-success-soft text-success",
  private: "border-line bg-surface-muted text-muted",
  completed: "border-success/30 bg-success-soft text-success",
  in_progress: "border-accent/30 bg-accent-soft text-accent",
  unread: "border-accent/30 bg-accent-soft text-accent",
  read: "border-line bg-surface-muted text-muted",
  featured: "border-warning/30 bg-warning-soft text-warning",
  active: "border-success/30 bg-success-soft text-success",
  inactive: "border-danger/30 bg-danger-soft text-danger",
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
