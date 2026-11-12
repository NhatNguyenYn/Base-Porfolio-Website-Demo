import { requireSuperAdmin } from "@/server/auth";
import { getSettings } from "@/server/queries/settings";
import { getMediaLibrary } from "@/server/queries/media-library";
import { saveSettingsAction } from "@/server/actions/settings";
import { PageHeader } from "@/components/admin/page-header";
import { ActionForm } from "@/components/admin/action-form";
import { MediaPicker } from "@/components/admin/media-picker";

export default async function SettingsPage() {
  // Settings are SUPER_ADMIN only; hiding the nav link is not enough.
  await requireSuperAdmin();
  const [settings, library] = await Promise.all([getSettings(), getMediaLibrary()]);

  return (
    <>
      <PageHeader
        title="Cài đặt website"
        description="Tên site, nhận diện, SEO mặc định, thông tin liên hệ và nội dung footer."
      />

      <ActionForm action={saveSettingsAction} submitLabel="Lưu cài đặt" hint="Thay đổi áp dụng ngay trên website.">
        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <section className="border border-line bg-surface p-5">
              <h2 className="mb-4 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Chung</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="siteName">
                    Tên website *
                  </label>
                  <input id="siteName" name="siteName" defaultValue={settings.siteName} required className="field" />
                </div>
                <div>
                  <label className="field-label" htmlFor="siteTagline">
                    Tagline
                  </label>
                  <input id="siteTagline" name="siteTagline" defaultValue={settings.siteTagline} className="field" />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="footerText">
                    Nội dung footer
                  </label>
                  <textarea id="footerText" name="footerText" defaultValue={settings.footerText} rows={3} className="field" />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="footerTextEn">
                    Nội dung footer (tiếng Anh)
                  </label>
                  <textarea
                    id="footerTextEn"
                    name="footerTextEn"
                    defaultValue={settings.footerTextEn}
                    rows={3}
                    className="field"
                  />
                  <p className="mt-1.5 text-[11px] text-muted">
                    Để trống thì bản tiếng Anh dùng nội dung tiếng Việt ở trên.
                  </p>
                </div>
              </div>
            </section>

            <section className="border border-line bg-surface p-5">
              <h2 className="mb-4 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">SEO mặc định</h2>
              <div className="space-y-4">
                <div>
                  <label className="field-label" htmlFor="seoTitle">
                    SEO title
                  </label>
                  <input id="seoTitle" name="seoTitle" defaultValue={settings.seoTitle} maxLength={180} className="field" />
                </div>
                <div>
                  <label className="field-label" htmlFor="seoDescription">
                    SEO description
                  </label>
                  <textarea
                    id="seoDescription"
                    name="seoDescription"
                    defaultValue={settings.seoDescription}
                    rows={3}
                    maxLength={320}
                    className="field"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="seoKeywords">
                    Từ khóa (phân cách bằng dấu phẩy)
                  </label>
                  <input id="seoKeywords" name="seoKeywords" defaultValue={settings.seoKeywords} className="field" />
                </div>
              </div>
            </section>

            <section className="border border-line bg-surface p-5">
              <h2 className="mb-4 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Liên hệ</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="contactEmail">
                    Email *
                  </label>
                  <input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    defaultValue={settings.contactEmail}
                    required
                    className="field"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="contactPhone">
                    Điện thoại
                  </label>
                  <input id="contactPhone" name="contactPhone" defaultValue={settings.contactPhone} className="field" />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="contactLocation">
                    Địa điểm
                  </label>
                  <input
                    id="contactLocation"
                    name="contactLocation"
                    defaultValue={settings.contactLocation}
                    className="field"
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="border border-line bg-surface p-5">
              <h2 className="mb-4 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Nhận diện</h2>
              <div className="space-y-5">
                <MediaPicker
                  name="logoMediaId"
                  label="Logo"
                  initial={settings.logo ? [settings.logo] : []}
                  library={library}
                  maxHeight="aspect-[3/1]"
                  help="Tuỳ chọn. Nếu trống, website dùng monogram chữ."
                />
                <MediaPicker
                  name="faviconMediaId"
                  label="Favicon"
                  initial={settings.favicon ? [settings.favicon] : []}
                  library={library}
                  maxHeight="aspect-square"
                  help="Ảnh vuông, tối thiểu 128×128px."
                />
              </div>
            </section>

            <section className="border border-line bg-surface p-5">
              <h2 className="mb-4 text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Hiển thị</h2>
              <div className="space-y-4">
                <div>
                  <label className="field-label" htmlFor="postsPerPage">
                    Số bài viết mỗi trang
                  </label>
                  <input
                    id="postsPerPage"
                    name="postsPerPage"
                    type="number"
                    min={3}
                    max={48}
                    defaultValue={settings.postsPerPage}
                    className="field"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="defaultTheme">
                    Giao diện mặc định
                  </label>
                  <select id="defaultTheme" name="defaultTheme" defaultValue={settings.defaultTheme} className="field">
                    <option value="light">Sáng</option>
                    <option value="dark">Tối</option>
                    <option value="system">Theo hệ thống</option>
                  </select>
                </div>
                <label className="flex items-start gap-2.5 text-[12px] leading-relaxed">
                  <input
                    type="checkbox"
                    name="showDemoBadge"
                    defaultChecked={settings.showDemoBadge}
                    className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent)]"
                  />
                  <span>
                    Hiển thị nhãn “dữ liệu minh hoạ” ở footer và trang chủ. Nên tắt sau khi thay nội dung thật.
                  </span>
                </label>
              </div>
            </section>
          </div>
        </div>
      </ActionForm>
    </>
  );
}
