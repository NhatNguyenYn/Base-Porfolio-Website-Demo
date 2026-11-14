import { listSlotsForAdmin, listServicesForAdmin } from "@/server/queries/bookings";
import { saveSlotAction, blockSlotAction, unblockSlotAction, deleteSlotAction } from "@/server/actions/bookings";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { ActionForm } from "@/components/admin/action-form";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { formatVnDateTime, utcToVnLocalParts } from "@/lib/booking-time";
import { flowerNameFor } from "@/lib/flowers";

const SLOT_STATUS_LABELS: Record<string, string> = {
  available: "Còn trống",
  booked: "Đã đặt",
  blocked: "Đã khoá",
};

export default async function AdminBookingSlotsPage({
  searchParams,
}: {
  searchParams: Promise<{ serviceId?: string }>;
}) {
  const query = await searchParams;
  const [slots, services] = await Promise.all([
    listSlotsForAdmin(query.serviceId || undefined),
    listServicesForAdmin(),
  ]);
  const selectedService = services.find((service) => service.id === query.serviceId);

  return (
    <>
      <PageHeader
        title="Khung giờ đặt lịch"
        description="Tạo khung giờ theo giờ Việt Nam (lưu vào DB dạng UTC). Khung đã có lịch hẹn thì không xoá được — hãy khoá lại thay vì xoá."
        back={{ href: "/admin/bookings", label: "Danh sách lịch hẹn" }}
      />

      <ActionForm
        action={saveSlotAction}
        submitLabel="Tạo khung giờ"
        resetOnSuccess
        className="mb-8 border border-line bg-surface p-6"
        hint="Giờ nhập là giờ Việt Nam. Giờ kết thúc = giờ bắt đầu + thời lượng, tính tự động ở server."
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="field-label" htmlFor="slot-service">Dịch vụ</label>
            <select id="slot-service" name="serviceId" defaultValue={query.serviceId ?? ""} className="field" required>
              <option value="">— Chọn dịch vụ —</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.translations.find((t) => t.locale === "vi")?.name ?? service.slug}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="slot-date">Ngày (giờ VN)</label>
            <input id="slot-date" type="date" name="date" required className="field" />
          </div>
          <div>
            <label className="field-label" htmlFor="slot-start">Giờ bắt đầu (giờ VN)</label>
            <input id="slot-start" type="time" name="startTime" required className="field" />
          </div>
          <div>
            <label className="field-label" htmlFor="slot-duration">Thời lượng (phút)</label>
            <select
              id="slot-duration"
              name="durationMinutes"
              defaultValue={selectedService?.durationMinutes ?? 30}
              className="field"
            >
              <option value="15">15 phút</option>
              <option value="30">30 phút</option>
              <option value="60">60 phút</option>
            </select>
          </div>
        </div>
      </ActionForm>

      <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
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
        <button type="submit" className="btn btn-outline btn-sm">Lọc</button>
      </form>

      <DataTable
        columns={[
          { key: "service", label: "Dịch vụ" },
          { key: "starts", label: "Bắt đầu (giờ VN)" },
          { key: "ends", label: "Kết thúc (giờ VN)" },
          { key: "status", label: "Trạng thái" },
          { key: "actions", label: "", className: "text-right" },
        ]}
        rows={slots.map((slot) => {
          const startParts = utcToVnLocalParts(slot.startsAt);
          return {
            id: slot.id,
            cells: {
              service: <span className="text-[12.5px]">{slot.serviceName}</span>,
              starts: (
                <span className="whitespace-nowrap text-[12px] tabular-nums">
                  {formatVnDateTime(slot.startsAt, "vi")}
                </span>
              ),
              ends: (
                <span className="whitespace-nowrap text-[12px] tabular-nums">
                  {formatVnDateTime(slot.endsAt, "vi")}
                </span>
              ),
              status: (
                <span className="inline-flex items-center gap-2">
                  <StatusBadge status={slot.status} label={SLOT_STATUS_LABELS[slot.status] ?? slot.status} />
                  {slot.flowerCode && <span className="chip">🌸 {flowerNameFor(slot.flowerCode, "vi")}</span>}
                </span>
              ),
              actions: (
                <div className="flex items-center justify-end gap-1.5">
                  {slot.status === "available" && (
                    <form action={blockSlotAction}>
                      <input type="hidden" name="id" value={slot.id} />
                      <button
                        type="submit"
                        className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-ink hover:text-ink"
                      >
                        Khoá
                      </button>
                    </form>
                  )}
                  {slot.status === "blocked" && (
                    <form action={unblockSlotAction}>
                      <input type="hidden" name="id" value={slot.id} />
                      <button
                        type="submit"
                        className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-ink hover:text-ink"
                      >
                        Mở lại
                      </button>
                    </form>
                  )}
                  {slot.status !== "booked" && (
                    <form action={deleteSlotAction}>
                      <input type="hidden" name="id" value={slot.id} />
                      <ConfirmSubmit
                        title={`Xoá khung giờ ${startParts.date} ${startParts.time}?`}
                        description="Chỉ xoá được khung chưa từng có lịch hẹn."
                        triggerLabel="Xoá"
                        confirmLabel="Xoá khung giờ"
                      />
                    </form>
                  )}
                </div>
              ),
            },
          };
        })}
        empty="Chưa có khung giờ nào."
      />
    </>
  );
}
