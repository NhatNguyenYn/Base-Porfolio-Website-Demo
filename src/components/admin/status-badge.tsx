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
  // Phase 10 — survey + booking statuses (unified here; the former
  // src/components/admin/survey-status-badge.tsx is deleted).
  closed: "border-warning/30 bg-warning-soft text-warning",
  pending: "border-warning/30 bg-warning-soft text-warning",
  confirmed: "border-success/30 bg-success-soft text-success",
  cancelled: "border-danger/30 bg-danger-soft text-danger",
  booked: "border-accent/30 bg-accent-soft text-accent",
  blocked: "border-danger/30 bg-danger-soft text-danger",
  available: "border-success/30 bg-success-soft text-success",
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
  // Phase 10 — survey + booking labels (admin UI is VI-only).
  closed: "Đã đóng",
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  cancelled: "Đã hủy",
  booked: "Đã đặt",
  blocked: "Đã chặn",
  available: "Còn trống",
};

/** Vietnamese labels for the 8 survey question types (admin UI). */
export const QUESTION_TYPE_LABELS: Record<string, string> = {
  short_text: "Văn bản ngắn",
  long_text: "Văn bản dài",
  single_choice: "Chọn một",
  multiple_choice: "Chọn nhiều",
  dropdown: "Danh sách chọn",
  rating: "Đánh giá",
  nps: "NPS (0–10)",
  yes_no: "Có / Không",
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
