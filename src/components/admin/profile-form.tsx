"use client";

import { saveProfileAction } from "@/server/actions/profile";
import type { MediaView } from "@/server/queries/types";
import { ActionForm } from "./action-form";
import { LocaleTabs } from "./locale-tabs";
import { MarkdownEditor } from "./markdown-editor";
import { MediaPicker } from "./media-picker";

type Translation = {
  fullName: string;
  title: string;
  shortBio: string;
  longBio: string;
  interests: string;
  philosophy: string;
  futureGoals: string;
  seoTitle: string;
  seoDescription: string;
};

export type ProfileFormInitial = {
  email: string;
  phone: string;
  location: string;
  resumeUrl: string;
  availableForWork: boolean;
  avatar: MediaView | null;
  vi: Translation;
  en: Translation;
};

export const emptyProfile: ProfileFormInitial = {
  email: "",
  phone: "",
  location: "",
  resumeUrl: "",
  availableForWork: true,
  avatar: null,
  vi: {
    fullName: "",
    title: "",
    shortBio: "",
    longBio: "",
    interests: "",
    philosophy: "",
    futureGoals: "",
    seoTitle: "",
    seoDescription: "",
  },
  en: {
    fullName: "",
    title: "",
    shortBio: "",
    longBio: "",
    interests: "",
    philosophy: "",
    futureGoals: "",
    seoTitle: "",
    seoDescription: "",
  },
};

function translationFields(locale: "vi" | "en", initial: Translation) {
  const labels =
    locale === "vi"
      ? {
          name: "Họ và tên (VI) *",
          title: "Chức danh / định vị (VI) *",
          short: "Giới thiệu ngắn (VI) *",
          long: "Giới thiệu chi tiết (VI)",
          interests: "Lĩnh vực quan tâm (VI)",
          philosophy: "Triết lý làm việc (VI)",
          goals: "Mục tiêu tương lai (VI)",
        }
      : {
          name: "Full name (EN)",
          title: "Professional title (EN)",
          short: "Short bio (EN)",
          long: "Long bio (EN)",
          interests: "Interests (EN)",
          philosophy: "Philosophy (EN)",
          goals: "Future goals (EN)",
        };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor={`${locale}-fullName`}>
            {labels.name}
          </label>
          <input
            id={`${locale}-fullName`}
            name={`${locale}.fullName`}
            defaultValue={initial.fullName}
            maxLength={120}
            className="field"
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`${locale}-title`}>
            {labels.title}
          </label>
          <input
            id={`${locale}-title`}
            name={`${locale}.title`}
            defaultValue={initial.title}
            maxLength={160}
            className="field"
          />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor={`${locale}-shortBio`}>
          {labels.short}
        </label>
        <textarea
          id={`${locale}-shortBio`}
          name={`${locale}.shortBio`}
          defaultValue={initial.shortBio}
          rows={3}
          maxLength={400}
          className="field"
        />
      </div>

      <MarkdownEditor name={`${locale}.longBio`} label={labels.long} defaultValue={initial.longBio} rows={12} />

      <div>
        <label className="field-label" htmlFor={`${locale}-interests`}>
          {labels.interests}
        </label>
        <textarea
          id={`${locale}-interests`}
          name={`${locale}.interests`}
          defaultValue={initial.interests}
          rows={4}
          className="field font-mono text-[11.5px]"
          placeholder={"Kiến trúc sản phẩm | Hệ thống dễ hiểu, dễ bàn giao."}
        />
        <p className="mt-1 text-[10px] text-muted">Mỗi dòng một lĩnh vực, định dạng: Tiêu đề | Mô tả</p>
      </div>

      <MarkdownEditor name={`${locale}.philosophy`} label={labels.philosophy} defaultValue={initial.philosophy} rows={8} />
      <MarkdownEditor name={`${locale}.futureGoals`} label={labels.goals} defaultValue={initial.futureGoals} rows={8} />

      <details className="border border-line bg-surface-muted/40 p-3">
        <summary className="cursor-pointer text-[11px] font-medium text-muted">
          SEO mặc định cho {locale.toUpperCase()}
        </summary>
        <div className="mt-3 space-y-3">
          <input
            name={`${locale}.seoTitle`}
            defaultValue={initial.seoTitle}
            placeholder="SEO title"
            maxLength={180}
            className="field"
          />
          <textarea
            name={`${locale}.seoDescription`}
            defaultValue={initial.seoDescription}
            placeholder="SEO description"
            rows={2}
            maxLength={320}
            className="field"
          />
        </div>
      </details>
    </div>
  );
}

export function ProfileForm({
  initial,
  library,
}: {
  initial: ProfileFormInitial;
  library: MediaView[];
}) {
  return (
    <ActionForm action={saveProfileAction} submitLabel="Lưu hồ sơ" hint="Thông tin này hiển thị trên toàn website.">
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <LocaleTabs vi={translationFields("vi", initial.vi)} en={translationFields("en", initial.en)} />

        <div className="space-y-5">
          <div className="border border-line bg-surface p-4">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Liên hệ</p>
            <div className="space-y-4">
              <div>
                <label className="field-label" htmlFor="profile-email">
                  Email công khai *
                </label>
                <input
                  id="profile-email"
                  name="email"
                  type="email"
                  defaultValue={initial.email}
                  required
                  className="field"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="profile-phone">
                  Điện thoại
                </label>
                <input id="profile-phone" name="phone" defaultValue={initial.phone} className="field" />
              </div>
              <div>
                <label className="field-label" htmlFor="profile-location">
                  Địa điểm
                </label>
                <input id="profile-location" name="location" defaultValue={initial.location} className="field" />
              </div>
              <div>
                <label className="field-label" htmlFor="profile-resume">
                  Liên kết CV (PDF)
                </label>
                <input
                  id="profile-resume"
                  name="resumeUrl"
                  type="url"
                  defaultValue={initial.resumeUrl}
                  className="field"
                  placeholder="https://example.com/cv.pdf"
                />
              </div>
              <label className="flex items-center gap-2.5 text-[12px]">
                <input
                  type="checkbox"
                  name="availableForWork"
                  defaultChecked={initial.availableForWork}
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
                Đang nhận dự án mới
              </label>
            </div>
          </div>

          <div className="border border-line bg-surface p-4">
            <MediaPicker
              name="avatarMediaId"
              label="Ảnh đại diện"
              initial={initial.avatar ? [initial.avatar] : []}
              library={library}
              maxHeight="aspect-[4/5]"
              help="Nên dùng ảnh chân dung tỷ lệ 4:5, tối thiểu 900px chiều rộng."
            />
          </div>
        </div>
      </div>
    </ActionForm>
  );
}
