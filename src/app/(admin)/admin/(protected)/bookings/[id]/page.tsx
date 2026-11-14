import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookingDetail } from "@/server/queries/bookings";
import { setBookingStatusAction, adminCancelBookingAction } from "@/server/actions/bookings";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { formatVnDateTime } from "@/lib/booking-time";
import { formatShortDate } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  completed: "Hoàn thành",
  cancelled: "Đã huỷ",
};

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-line py-3 last:border-b-0">
      <dt className="w-36 shrink-0 text-[12px] text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-[13px]">{children}</dd>
    </div>
  );
}

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = await getBookingDetail(id);
  if (!booking) notFound();

  const isActive = booking.status === "pending" || booking.status === "confirmed";

  return (
    <>
      <PageHeader
        title={`${booking.name} — Hoa: ${booking.flowerName}`}
        description={`Mã đặt lịch ${booking.referenceCode} · ${booking.service.name} · ${formatVnDateTime(booking.slot.startsAt, "vi")}`}
        back={{ href: "/admin/bookings", label: "Danh sách lịch hẹn" }}
        actions={<StatusBadge status={booking.status} label={STATUS_LABELS[booking.status] ?? booking.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-line bg-surface p-6">
          <h2 className="text-[15px] font-semibold tracking-tight">Thông tin liên hệ</h2>
          <dl className="mt-2">
            <DetailRow label="Khách hàng">{booking.name}</DetailRow>
            <DetailRow label="Email">
              <a href={`mailto:${booking.email}`} className="hover:underline">{booking.email}</a>
            </DetailRow>
            <DetailRow label="Số điện thoại">{booking.phone || "—"}</DetailRow>
            <DetailRow label="Ghi chú">{booking.notes || "—"}</DetailRow>
            <DetailRow label="Đặt lúc">{formatShortDate(booking.createdAt, "vi")}</DetailRow>
            {booking.cancelledAt && (
              <DetailRow label="Đã huỷ lúc">{formatVnDateTime(booking.cancelledAt, "vi")}</DetailRow>
            )}
          </dl>
        </section>

        <section className="border border-line bg-surface p-6">
          <h2 className="text-[15px] font-semibold tracking-tight">Lịch hẹn & tên hoa</h2>
          <dl className="mt-2">
            <DetailRow label="Mã đặt lịch">
              <span className="font-mono font-semibold tracking-wide">{booking.referenceCode}</span>
            </DetailRow>
            <DetailRow label="Tên hoa">
              <span className="chip chip-active">🌸 {booking.flowerName}</span>
              <span className="ml-2 font-mono text-[11px] text-muted">{booking.flowerCode}</span>
            </DetailRow>
            <DetailRow label="Dịch vụ">{booking.service.name}</DetailRow>
            <DetailRow label="Bắt đầu">{formatVnDateTime(booking.slot.startsAt, "vi")}</DetailRow>
            <DetailRow label="Kết thúc">{formatVnDateTime(booking.slot.endsAt, "vi")}</DetailRow>
            <DetailRow label="Trạng thái khung giờ">{booking.slot.status}</DetailRow>
          </dl>

          {isActive && (
            <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
              {booking.status === "pending" && (
                <form action={setBookingStatusAction}>
                  <input type="hidden" name="id" value={booking.id} />
                  <input type="hidden" name="status" value="confirmed" />
                  <button type="submit" className="btn btn-primary btn-sm">Xác nhận</button>
                </form>
              )}
              <form action={setBookingStatusAction}>
                <input type="hidden" name="id" value={booking.id} />
                <input type="hidden" name="status" value="completed" />
                <button type="submit" className="btn btn-outline btn-sm">Hoàn thành</button>
              </form>
              <form action={adminCancelBookingAction}>
                <input type="hidden" name="id" value={booking.id} />
                <ConfirmSubmit
                  title={`Huỷ lịch hẹn ${booking.referenceCode}?`}
                  description="Lịch sẽ chuyển sang trạng thái đã huỷ và khung giờ được mở lại cho người khác đặt. Tên hoa được giải phóng."
                  triggerLabel="Huỷ lịch"
                  confirmLabel="Huỷ lịch hẹn"
                />
              </form>
            </div>
          )}
          {!isActive && (
            <p className="mt-6 border-t border-line pt-5 text-[12.5px] text-muted">
              Lịch hẹn này đã {booking.status === "cancelled" ? "bị huỷ" : "hoàn thành"} nên không còn thao tác nào.
            </p>
          )}
        </section>
      </div>

      <section className="mt-6 border border-line bg-surface p-6">
        <h2 className="text-[15px] font-semibold tracking-tight">Câu trả lời khảo sát đầu vào</h2>
        {!booking.survey ? (
          <p className="mt-3 text-[13px] text-muted">Dịch vụ này không có khảo sát đầu vào.</p>
        ) : (
          <>
            <p className="mt-2 text-[12.5px] text-muted">
              {booking.survey.title} · gửi lúc {formatVnDateTime(booking.survey.submittedAt, "vi")}
            </p>
            {booking.survey.answers.length === 0 ? (
              <p className="mt-3 text-[13px] text-muted">Khách không trả lời câu nào.</p>
            ) : (
              <dl className="mt-2">
                {booking.survey.answers.map((answer) => (
                  <DetailRow key={answer.id} label={answer.questionTitle}>
                    {answer.optionLabel ?? answer.value}
                    {answer.questionType === "rating" || answer.questionType === "nps" ? " / 10" : ""}
                  </DetailRow>
                ))}
              </dl>
            )}
          </>
        )}
      </section>

      <p className="mt-6 text-[12px] text-muted">
        <Link href="/admin/bookings" className="underline underline-offset-4 hover:text-ink">
          ← Quay lại danh sách lịch hẹn
        </Link>
      </p>
    </>
  );
}
