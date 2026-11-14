"use client";

import { useState } from "react";
import { saveSurveyAction } from "@/server/actions/surveys";
import type { MediaView } from "@/server/queries/types";
import { ActionForm } from "./action-form";
import { LocaleTabs } from "./locale-tabs";
import { MediaPicker } from "./media-picker";

export type SurveyFormInitial = {
  id?: string;
  slug: string;
  status: string;
  cover: MediaView | null;
  // BỔ SUNG 15:14: brand band (dải đầu trang) + completion badge gradient.
  brandName: string;
  brandLogo: MediaView | null;
  badgeFromColor: string;
  badgeToColor: string;
  themePreset: string;
  layout: string;
  progressStyle: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  buttonStyle: string;
  borderRadius: string;
  estimatedMinutes: string;
  startsAt: string;
  endsAt: string;
  isBookingIntake: boolean;
  vi: {
    title: string;
    subtitle: string;
    description: string;
    introduction: string;
    completionMessage: string;
    privacyNotice: string;
    // BỔ SUNG 15:14: one bullet per line, shown on the survey intro page.
    highlights: string;
  };
  en: {
    title: string;
    subtitle: string;
    description: string;
    introduction: string;
    completionMessage: string;
    privacyNotice: string;
    highlights: string;
  };
};

export const emptySurvey: SurveyFormInitial = {
  slug: "",
  status: "draft",
  cover: null,
  brandName: "",
  brandLogo: null,
  badgeFromColor: "",
  badgeToColor: "",
  themePreset: "minimal",
  layout: "centered",
  progressStyle: "bar",
  primaryColor: "",
  accentColor: "",
  backgroundColor: "",
  surfaceColor: "",
  textColor: "",
  buttonStyle: "solid",
  borderRadius: "md",
  estimatedMinutes: "",
  startsAt: "",
  endsAt: "",
  isBookingIntake: false,
  vi: { title: "", subtitle: "", description: "", introduction: "", completionMessage: "", privacyNotice: "", highlights: "" },
  en: { title: "", subtitle: "", description: "", introduction: "", completionMessage: "", privacyNotice: "", highlights: "" },
};

function ColorField({
  name,
  label,
  initial,
  placeholder,
}: {
  name: string;
  label: string;
  initial: string;
  placeholder: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div>
      <label className="field-label" htmlFor={`${name}-text`}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} — chọn màu`}
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#17233a"}
          onChange={(event) => setValue(event.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer border border-line bg-surface p-0.5"
        />
        <input
          id={`${name}-text`}
          name={name}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={7}
          placeholder={placeholder}
          className="field font-mono text-[12px]"
        />
      </div>
      <p className="mt-1 text-[10px] text-muted">Để trống = dùng màu mặc định của preset. Chỉ nhận mã hex dạng #rrggbb.</p>
    </div>
  );
}

function localeFields(
  locale: "vi" | "en",
  initial: SurveyFormInitial["vi"],
  labels: {
    title: string;
    subtitle: string;
    description: string;
    introduction: string;
    completionMessage: string;
    privacyNotice: string;
    highlights: string;
  },
) {
  return (
    <div className="space-y-4">
      <div>
        <label className="field-label" htmlFor={`${locale}-title`}>
          {labels.title}
        </label>
        <input
          id={`${locale}-title`}
          name={`${locale}.title`}
          defaultValue={initial.title}
          maxLength={180}
          required
          className="field text-[15px]"
          placeholder={locale === "vi" ? "Tiêu đề khảo sát" : "Survey title"}
        />
        <p className="mt-1 text-[10px] text-muted">
          Đánh dấu từ khóa cần tô màu bằng **từ khóa** — ví dụ: “Thực trạng sử dụng **AI** trong công việc”.
          Trang công khai sẽ tô màu nhấn cho phần trong **...**.
        </p>
      </div>
      <div>
        <label className="field-label" htmlFor={`${locale}-subtitle`}>
          {labels.subtitle}
        </label>
        <input
          id={`${locale}-subtitle`}
          name={`${locale}.subtitle`}
          defaultValue={initial.subtitle}
          maxLength={220}
          className="field"
        />
      </div>
      <div>
        <label className="field-label" htmlFor={`${locale}-description`}>
          {labels.description}
        </label>
        <textarea
          id={`${locale}-description`}
          name={`${locale}.description`}
          defaultValue={initial.description}
          rows={3}
          maxLength={4000}
          className="field"
        />
      </div>
      <div>
        <label className="field-label" htmlFor={`${locale}-introduction`}>
          {labels.introduction}
        </label>
        <textarea
          id={`${locale}-introduction`}
          name={`${locale}.introduction`}
          defaultValue={initial.introduction}
          rows={4}
          maxLength={10000}
          className="field"
          placeholder={locale === "vi" ? "Lời mở đầu hiển thị trước khi người dùng bắt đầu trả lời." : ""}
        />
      </div>
      <div>
        <label className="field-label" htmlFor={`${locale}-completionMessage`}>
          {labels.completionMessage}
        </label>
        <textarea
          id={`${locale}-completionMessage`}
          name={`${locale}.completionMessage`}
          defaultValue={initial.completionMessage}
          rows={3}
          maxLength={2000}
          className="field"
          placeholder={locale === "vi" ? "Thông báo cảm ơn sau khi gửi xong." : ""}
        />
      </div>
      <div>
        <label className="field-label" htmlFor={`${locale}-privacyNotice`}>
          {labels.privacyNotice}
        </label>
        <textarea
          id={`${locale}-privacyNotice`}
          name={`${locale}.privacyNotice`}
          defaultValue={initial.privacyNotice}
          rows={3}
          maxLength={2000}
          className="field"
          placeholder={locale === "vi" ? "Thông báo quyền riêng tư: thu thập gì, dùng để làm gì." : ""}
        />
      </div>
      <div>
        <label className="field-label" htmlFor={`${locale}-highlights`}>
          {labels.highlights}
        </label>
        <textarea
          id={`${locale}-highlights`}
          name={`${locale}.highlights`}
          defaultValue={initial.highlights}
          rows={4}
          maxLength={2000}
          className="field"
          placeholder={
            locale === "vi"
              ? "Mỗi dòng một gạch đầu dòng, ví dụ:\n13–15 câu ngắn, khoảng 5 phút\nKhông thu thập thông tin cá nhân\nCó thể quay lại sửa câu trả lời"
              : "One bullet per line."
          }
        />
        <p className="mt-1 text-[10px] text-muted">
          Hiển thị thành danh sách gạch đầu dòng chấm màu ở trang giới thiệu. Để trống sẽ tự gợi ý số câu và thời
          gian ước tính.
        </p>
      </div>
    </div>
  );
}

/**
 * Survey settings + theme form, used by both /surveys/new and the builder
 * page. Saving is always explicit (the submit button): nothing here
 * auto-mutates a published survey, and the hint says so.
 */
export function SurveyForm({ initial, library }: { initial: SurveyFormInitial; library: MediaView[] }) {
  return (
    <ActionForm
      action={saveSurveyAction}
      submitLabel={initial.id ? "Lưu khảo sát" : "Tạo khảo sát"}
      hint="Thay đổi chỉ áp dụng khi bấm Lưu. Với khảo sát đã xuất bản, bấm Lưu sẽ cập nhật ngay bản đang chạy — hãy nhân bản trước nếu muốn giữ nguyên bản đang chạy."
    >
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div>
          <LocaleTabs
            vi={localeFields("vi", initial.vi, {
              title: "Tiêu đề (VI) *",
              subtitle: "Phụ đề (VI)",
              description: "Mô tả (VI)",
              introduction: "Lời mở đầu (VI)",
              completionMessage: "Thông báo hoàn thành (VI)",
              privacyNotice: "Thông báo quyền riêng tư (VI)",
              highlights: "Gạch đầu dòng giới thiệu (VI)",
            })}
            en={localeFields("en", initial.en, {
              title: "Title (EN) *",
              subtitle: "Subtitle (EN)",
              description: "Description (EN)",
              introduction: "Introduction (EN)",
              completionMessage: "Completion message (EN)",
              privacyNotice: "Privacy notice (EN)",
              highlights: "Intro bullets (EN)",
            })}
          />
        </div>

        <div className="space-y-5">
          <div className="border border-line bg-surface p-4">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Xuất bản</p>
            <div className="space-y-4">
              <div>
                <label className="field-label" htmlFor="status">
                  Trạng thái
                </label>
                <select id="status" name="status" defaultValue={initial.status} className="field">
                  <option value="draft">Bản nháp</option>
                  <option value="published">Xuất bản</option>
                  <option value="closed">Đã đóng</option>
                  <option value="archived">Lưu trữ</option>
                </select>
                <p className="mt-1 text-[10px] text-muted">
                  Bản nháp / đã đóng / lưu trữ đều không nhận câu trả lời. Chỉ “Xuất bản” mới nhận phản hồi công khai.
                </p>
              </div>
              <div>
                <label className="field-label" htmlFor="slug">
                  Slug
                </label>
                <input
                  id="slug"
                  name="slug"
                  defaultValue={initial.slug}
                  className="field font-mono text-[12px]"
                  placeholder="de-tu-dong-tao"
                />
                <p className="mt-1 text-[10px] text-muted">
                  Để trống sẽ tự tạo từ tiêu đề. Slug phải duy nhất — hệ thống kiểm tra trước khi xuất bản.
                </p>
              </div>
              <div>
                <label className="field-label" htmlFor="estimatedMinutes">
                  Thời gian ước tính (phút)
                </label>
                <input
                  id="estimatedMinutes"
                  name="estimatedMinutes"
                  type="number"
                  min={1}
                  max={600}
                  defaultValue={initial.estimatedMinutes}
                  className="field"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="startsAt">
                  Bắt đầu nhận phản hồi
                </label>
                <input id="startsAt" name="startsAt" type="datetime-local" defaultValue={initial.startsAt} className="field" />
              </div>
              <div>
                <label className="field-label" htmlFor="endsAt">
                  Kết thúc nhận phản hồi
                </label>
                <input id="endsAt" name="endsAt" type="datetime-local" defaultValue={initial.endsAt} className="field" />
              </div>
              <label className="flex items-start gap-2.5 text-[12px]">
                <input
                  type="checkbox"
                  name="isBookingIntake"
                  defaultChecked={initial.isBookingIntake}
                  className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent)]"
                />
                <span>
                  Dùng làm khảo sát đầu vào cho đặt lịch (booking intake)
                  <span className="block text-[10.5px] text-muted">
                    Chỉ khảo sát đã xuất bản mới được chọn làm intake cho dịch vụ đặt lịch.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="border border-line bg-surface p-4">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Giao diện (theme)</p>
            <div className="space-y-4">
              <div>
                <label className="field-label" htmlFor="themePreset">
                  Preset
                </label>
                <select id="themePreset" name="themePreset" defaultValue={initial.themePreset} className="field">
                  <option value="minimal">Minimal</option>
                  <option value="editorial">Editorial</option>
                  <option value="modern">Modern</option>
                  <option value="premium">Premium</option>
                  <option value="editorial-vn">Editorial VN — theo mẫu ảnh tham chiếu</option>
                </select>
                <p className="mt-1 text-[10px] text-muted">
                  Editorial VN lấy tinh thần từ ảnh tham chiếu: dải đầu trang logo + tên thương hiệu, tiêu đề
                  editorial lớn với từ khóa tô màu, phụ đề nghiêng, gạch đầu dòng chấm màu, thẻ trạng thái hồng
                  nhạt khi đã kết thúc, badge gradient viên thuốc ở màn hình hoàn thành. Preset chỉ quy định
                  cấu trúc/bố cục — màu sắc vẫn lấy từ các trường màu đã cấu hình, không dùng màu thương hiệu
                  trong ảnh.
                </p>
              </div>
              <div>
                <label className="field-label" htmlFor="layout">
                  Bố cục
                </label>
                <select id="layout" name="layout" defaultValue={initial.layout} className="field">
                  <option value="centered">Centered — căn giữa</option>
                  <option value="split">Split — chia đôi</option>
                  <option value="editorial">Editorial — toàn chiều rộng</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="progressStyle">
                  Thanh tiến trình
                </label>
                <select id="progressStyle" name="progressStyle" defaultValue={initial.progressStyle} className="field">
                  <option value="bar">Thanh (bar)</option>
                  <option value="dots">Chấm (dots)</option>
                  <option value="steps">Bước (steps)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label" htmlFor="buttonStyle">
                    Kiểu nút
                  </label>
                  <select id="buttonStyle" name="buttonStyle" defaultValue={initial.buttonStyle} className="field">
                    <option value="solid">Solid</option>
                    <option value="outline">Outline</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="borderRadius">
                    Bo góc
                  </label>
                  <select id="borderRadius" name="borderRadius" defaultValue={initial.borderRadius} className="field">
                    <option value="sm">Nhỏ</option>
                    <option value="md">Vừa</option>
                    <option value="lg">Lớn</option>
                    <option value="full">Tròn</option>
                  </select>
                </div>
              </div>
              <ColorField name="primaryColor" label="Màu chính" initial={initial.primaryColor} placeholder="#17233a" />
              <ColorField name="accentColor" label="Màu nhấn" initial={initial.accentColor} placeholder="#9b1c31" />
              <ColorField name="backgroundColor" label="Màu nền" initial={initial.backgroundColor} placeholder="#f8f8f6" />
              <ColorField name="surfaceColor" label="Màu bề mặt" initial={initial.surfaceColor} placeholder="#ffffff" />
              <ColorField name="textColor" label="Màu chữ" initial={initial.textColor} placeholder="#20242c" />
              <ColorField name="badgeFromColor" label="Badge gradient — màu bắt đầu" initial={initial.badgeFromColor} placeholder="#7c3aed" />
              <ColorField name="badgeToColor" label="Badge gradient — màu kết thúc" initial={initial.badgeToColor} placeholder="#9333ea" />
              <p className="text-[10px] text-muted">
                Hai màu badge tạo gradient cho huy hiệu viên thuốc ở màn hình hoàn thành (hiển thị tên hoa). Để
                trống = dùng màu mặc định theo preset.
              </p>
              <p className="text-[10px] text-muted">
                Không cho phép nhập CSS/JS/HTML tuỳ ý — chỉ preset và các mã màu hex được kiểm chứng ở server.
              </p>
            </div>
          </div>

          <div className="border border-line bg-surface p-4">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              Thương hiệu (dải đầu trang)
            </p>
            <div className="space-y-4">
              <div>
                <label className="field-label" htmlFor="brandName">
                  Tên thương hiệu
                </label>
                <input
                  id="brandName"
                  name="brandName"
                  defaultValue={initial.brandName}
                  maxLength={160}
                  className="field"
                  placeholder="Tên hiển thị ở dải đầu trang"
                />
                <p className="mt-1 text-[10px] text-muted">
                  Hiển thị cùng logo ở dải đầu trang của khảo sát. Dùng thương hiệu của khách hàng, không dùng tên
                  tổ chức trong ảnh tham chiếu.
                </p>
              </div>
              <MediaPicker
                name="brandLogoMediaId"
                label="Logo thương hiệu"
                initial={initial.brandLogo ? [initial.brandLogo] : []}
                library={library}
                help="Logo hiển thị ở dải đầu trang, bên trái tên thương hiệu."
              />
            </div>
          </div>

          <div className="border border-line bg-surface p-4">
            <MediaPicker
              name="coverMediaId"
              label="Ảnh bìa"
              initial={initial.cover ? [initial.cover] : []}
              library={library}
              help="Ảnh bìa hiển thị ở trang mở đầu của khảo sát."
            />
          </div>
        </div>
      </div>
    </ActionForm>
  );
}
