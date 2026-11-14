import { notFound } from "next/navigation";
import { getServiceForAdmin, listPublishedSurveysForIntake } from "@/server/queries/bookings";
import { saveServiceAction } from "@/server/actions/bookings";
import { PageHeader } from "@/components/admin/page-header";
import { ActionForm } from "@/components/admin/action-form";
import { Flash } from "@/components/admin/flash";

export default async function AdminBookingServiceEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const isNew = id === "new";
  const [service, surveys] = await Promise.all([
    isNew ? Promise.resolve(null) : getServiceForAdmin(id),
    listPublishedSurveysForIntake(),
  ]);
  if (!isNew && !service) notFound();

  const vi = service?.translations.find((item) => item.locale === "vi");
  const en = service?.translations.find((item) => item.locale === "en");

  return (
    <>
      <PageHeader
        title={isNew ? "Dịch vụ mới" : (vi?.name ?? en?.name ?? service?.slug ?? "Dịch vụ")}
        description="Tên và mô tả có bản tiếng Việt và tiếng Anh riêng. Khảo sát đầu vào phải là khảo sát đã xuất bản; nếu khảo sát đóng hoặc lưu trữ, dịch vụ sẽ tạm ngừng nhận đặt lịch."
        back={{ href: "/admin/bookings/services", label: "Danh sách dịch vụ" }}
      />

      {query.saved && <Flash message="Đã lưu dịch vụ." />}

      <ActionForm action={saveServiceAction} className="max-w-2xl border border-line bg-surface p-6">
        <input type="hidden" name="id" value={service?.id ?? ""} />

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="service-slug">Slug</label>
            <input
              id="service-slug"
              name="slug"
              defaultValue={service?.slug ?? ""}
              maxLength={90}
              placeholder="tu-van-1-1"
              className="field font-mono text-[13px]"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="service-duration">Thời lượng (phút)</label>
            <select id="service-duration" name="durationMinutes" defaultValue={service?.durationMinutes ?? 30} className="field">
              <option value="15">15 phút</option>
              <option value="30">30 phút</option>
              <option value="60">60 phút</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="service-order">Thứ tự</label>
            <input
              id="service-order"
              name="order"
              type="number"
              min={0}
              max={9999}
              defaultValue={service?.order ?? 0}
              className="field"
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input type="checkbox" name="active" defaultChecked={service?.active ?? true} />
              Đang mở đặt lịch
            </label>
          </div>
        </div>

        <div className="mt-5">
          <label className="field-label" htmlFor="service-intake">Khảo sát đầu vào</label>
          <select
            id="service-intake"
            name="intakeSurveyId"
            defaultValue={service?.intakeSurveyId ?? ""}
            className="field"
          >
            <option value="">— Không có khảo sát đầu vào (tạm ngừng nhận đặt lịch) —</option>
            {surveys.map((survey) => (
              <option key={survey.id} value={survey.id}>
                {survey.title}
                {survey.isBookingIntake ? " · intake" : ""}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11.5px] text-muted">
            Chỉ hiện khảo sát đã xuất bản. Chọn khảo sát được đánh dấu intake khi có thể.
          </p>
        </div>

        <fieldset className="mt-7 border-t border-line pt-5">
          <legend className="text-[13px] font-semibold">Tiếng Việt</legend>
          <div className="mt-3 space-y-4">
            <div>
              <label className="field-label" htmlFor="vi-name">Tên dịch vụ</label>
              <input id="vi-name" name="vi.name" defaultValue={vi?.name ?? ""} maxLength={160} className="field" />
            </div>
            <div>
              <label className="field-label" htmlFor="vi-description">Mô tả</label>
              <textarea
                id="vi-description"
                name="vi.description"
                defaultValue={vi?.description ?? ""}
                maxLength={4000}
                rows={3}
                className="field resize-y"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="mt-7 border-t border-line pt-5">
          <legend className="text-[13px] font-semibold">English</legend>
          <div className="mt-3 space-y-4">
            <div>
              <label className="field-label" htmlFor="en-name">Service name</label>
              <input id="en-name" name="en.name" defaultValue={en?.name ?? ""} maxLength={160} className="field" />
            </div>
            <div>
              <label className="field-label" htmlFor="en-description">Description</label>
              <textarea
                id="en-description"
                name="en.description"
                defaultValue={en?.description ?? ""}
                maxLength={4000}
                rows={3}
                className="field resize-y"
              />
            </div>
          </div>
        </fieldset>
      </ActionForm>
    </>
  );
}
