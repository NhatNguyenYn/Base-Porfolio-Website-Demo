import Link from "next/link";
import { listBookingsForAdmin, countActiveFlowerUsage, flowerPoolSize, listServicesForAdmin } from "@/server/queries/bookings";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Flash } from "@/components/admin/flash";
import { Pagination } from "@/components/site/pagination";
import { formatVnDateTime } from "@/lib/booking-time";
import { paginate, totalPages } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  completed: "Hoàn thành",
  cancelled: "Đã huỷ",
};

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "pending", label: "Chờ xác nhận" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "completed", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã huỷ" },
];

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; serviceId?: string; from?: string; to?: string; page?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const [bookings, activeFlowers, services] = await Promise.all([
    listBookingsForAdmin({
      status: query.status || undefined,
      serviceId: query.serviceId || undefined,
      from: query.from || undefined,
      to: query.to || undefined,
    }),
    countActiveFlowerUsage(),
    listServicesForAdmin(),
  ]);

  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const pages = totalPages(bookings.length, 20);
  const items = paginate(bookings, Math.min(page, pages), 20);
  const poolSize = flowerPoolSize();

  return (
    <>
      <PageHeader
        title="Lịch hẹn"
        description="Các lịch tư vấn đã đặt: mã đặt lịch, tên hoa ẩn danh và thông tin liên hệ đầy đủ của khách (chỉ admin mới thấy)."
        actions={
          <>
            <Link href="/admin/bookings/slots" className="btn btn-outline btn-sm">
              Quản lý khung giờ
            </Link>
            <Link href="/admin/bookings/services" className="btn btn-outline btn-sm">
              Dịch vụ
            </Link>
          </>
        }
      />

      {query.saved && <Flash message="Đã lưu." />}

      <p className="mb-4 text-[12.5px] text-muted">
        Đang dùng <span className="font-semibold text-ink">{activeFlowers}/{poolSize} hoa</span> cho các lịch đang
        hoạt động (chờ xác nhận + đã xác nhận). Hết hoa thì không đặt được lịch mới.
      </p>

      <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="field-label" htmlFor="filter-status">Trạng thái</label>
          <select id="filter-status" name="status" defaultValue={query.status ?? ""} className="field w-auto">
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="filter-service">Dịch vụ</label>
          <select id="filter-service" name="serviceId" defaultValue={query.serviceId ?? ""} className="field w-auto">
            <option value="">Tất cả dịch vụ</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.translations.find((t) => t.locale === "vi")?.name ?? service.slug}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="filter-from">Từ ngày</label>
          <input id="filter-from" type="date" name="from" defaultValue={query.from ?? ""} className="field w-auto" />
        </div>
        <div>
          <label className="field-label" htmlFor="filter-to">Đến ngày</label>
          <input id="filter-to" type="date" name="to" defaultValue={query.to ?? ""} className="field w-auto" />
        </div>
        <button type="submit" className="btn btn-outline btn-sm">Lọc</button>
      </form>

      <DataTable
        columns={[
          { key: "when", label: "Ngày / giờ" },
          { key: "service", label: "Dịch vụ" },
          { key: "visitor", label: "Khách — Hoa" },
          { key: "code", label: "Mã đặt lịch" },
          { key: "status", label: "Trạng thái" },
          { key: "actions", label: "", className: "text-right" },
        ]}
        rows={items.map((booking) => ({
          id: booking.id,
          cells: {
            when: (
              <span className="whitespace-nowrap text-[12px] tabular-nums">
                {formatVnDateTime(booking.startsAt, "vi")}
              </span>
            ),
            service: <span className="text-[12.5px]">{booking.serviceName}</span>,
            visitor: (
              <div className="min-w-0 max-w-[260px]">
                <span className="block truncate text-[12.5px]">
                  {booking.name} — Hoa: {booking.flowerName}
                </span>
                <span className="block truncate text-[11px] text-muted">{booking.email}</span>
              </div>
            ),
            code: <span className="font-mono text-[12px] font-semibold tracking-wide">{booking.referenceCode}</span>,
            status: <StatusBadge status={booking.status} label={STATUS_LABELS[booking.status] ?? booking.status} />,
            actions: (
              <Link
                href={`/admin/bookings/${booking.id}`}
                className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-ink hover:text-ink"
              >
                Xem
              </Link>
            ),
          },
        }))}
        empty="Chưa có lịch hẹn nào."
      />

      <Pagination
        page={Math.min(page, pages)}
        pages={pages}
        basePath="/admin/bookings"
        params={{
          ...(query.status ? { status: query.status } : {}),
          ...(query.serviceId ? { serviceId: query.serviceId } : {}),
          ...(query.from ? { from: query.from } : {}),
          ...(query.to ? { to: query.to } : {}),
        }}
        labels={{ previous: "Trước", next: "Sau", page: "Trang", of: "/" }}
      />
    </>
  );
}
