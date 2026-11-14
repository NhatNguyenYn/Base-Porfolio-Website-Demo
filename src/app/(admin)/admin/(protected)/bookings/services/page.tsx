import Link from "next/link";
import { Plus } from "lucide-react";
import { listServicesForAdmin } from "@/server/queries/bookings";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";

export default async function AdminBookingServicesPage() {
  const services = await listServicesForAdmin();

  return (
    <>
      <PageHeader
        title="Dịch vụ tư vấn"
        description="Các dịch vụ khách có thể đặt lịch. Mỗi dịch vụ có thời lượng riêng và một khảo sát đầu vào (đã xuất bản) để khách trả lời trước buổi tư vấn."
        back={{ href: "/admin/bookings", label: "Danh sách lịch hẹn" }}
        actions={
          <Link href="/admin/bookings/services/new" className="btn btn-primary btn-sm">
            <Plus size={12} aria-hidden="true" />
            Dịch vụ mới
          </Link>
        }
      />

      <DataTable
        columns={[
          { key: "name", label: "Dịch vụ" },
          { key: "duration", label: "Thời lượng" },
          { key: "intake", label: "Khảo sát đầu vào" },
          { key: "counts", label: "Khung giờ / Lịch hẹn" },
          { key: "active", label: "Trạng thái" },
          { key: "actions", label: "", className: "text-right" },
        ]}
        rows={services.map((service) => {
          const vi = service.translations.find((item) => item.locale === "vi");
          const en = service.translations.find((item) => item.locale === "en");
          const intakeTitle =
            service.intakeSurvey?.translations.find((item) => item.locale === "vi")?.title ??
            service.intakeSurvey?.slug;
          return {
            id: service.id,
            cells: {
              name: (
                <div className="min-w-0 max-w-[320px]">
                  <Link href={`/admin/bookings/services/${service.id}`} className="block truncate text-[12.5px] hover:underline">
                    {vi?.name ?? en?.name ?? "(chưa có tên)"}
                  </Link>
                  <p className="truncate font-mono text-[10px] text-muted">/{service.slug}</p>
                </div>
              ),
              duration: <span className="text-[12.5px] tabular-nums">{service.durationMinutes} phút</span>,
              intake: (
                <span className="text-[12px] text-muted">
                  {intakeTitle ?? "— chưa chọn —"}
                  {service.intakeSurvey && service.intakeSurvey.status !== "published" && (
                    <span className="text-danger"> (khảo sát {service.intakeSurvey.status})</span>
                  )}
                </span>
              ),
              counts: (
                <span className="text-[12px] text-muted tabular-nums">
                  {service._count.slots} / {service._count.bookings}
                </span>
              ),
              active: (
                <StatusBadge status={service.active ? "active" : "inactive"} />
              ),
              actions: (
                <Link
                  href={`/admin/bookings/services/${service.id}`}
                  className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-ink hover:text-ink"
                >
                  Sửa
                </Link>
              ),
            },
          };
        })}
        empty="Chưa có dịch vụ nào."
      />
    </>
  );
}
