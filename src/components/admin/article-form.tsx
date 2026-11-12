"use client";

import { saveArticleAction } from "@/server/actions/articles";
import type { MediaView } from "@/server/queries/types";
import { ActionForm } from "./action-form";
import { LocaleTabs } from "./locale-tabs";
import { MarkdownEditor } from "./markdown-editor";
import { MediaPicker } from "./media-picker";

export type ArticleFormInitial = {
  id?: string;
  slug: string;
  status: string;
  visibility: string;
  featured: boolean;
  scheduledFor: string;
  categoryId: string;
  tags: string;
  cover: MediaView | null;
  vi: { title: string; subtitle: string; excerpt: string; content: string; seoTitle: string; seoDescription: string };
  en: { title: string; subtitle: string; excerpt: string; content: string; seoTitle: string; seoDescription: string };
};

export const emptyArticle: ArticleFormInitial = {
  slug: "",
  status: "draft",
  visibility: "public",
  featured: false,
  scheduledFor: "",
  categoryId: "",
  tags: "",
  cover: null,
  vi: { title: "", subtitle: "", excerpt: "", content: "", seoTitle: "", seoDescription: "" },
  en: { title: "", subtitle: "", excerpt: "", content: "", seoTitle: "", seoDescription: "" },
};

function localeFields(
  locale: "vi" | "en",
  initial: ArticleFormInitial["vi"],
  labels: { title: string; subtitle: string; excerpt: string; content: string },
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
          className="field text-[15px]"
          placeholder={locale === "vi" ? "Tiêu đề bài viết" : "Article title"}
        />
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
        <label className="field-label" htmlFor={`${locale}-excerpt`}>
          {labels.excerpt}
        </label>
        <textarea
          id={`${locale}-excerpt`}
          name={`${locale}.excerpt`}
          defaultValue={initial.excerpt}
          rows={3}
          maxLength={400}
          className="field"
        />
      </div>
      <MarkdownEditor
        name={`${locale}.content`}
        label={labels.content}
        defaultValue={initial.content}
        rows={20}
      />
      <details className="border border-line bg-surface-muted/40 p-3">
        <summary className="cursor-pointer text-[11px] font-medium text-muted">SEO cho {locale.toUpperCase()}</summary>
        <div className="mt-3 space-y-3">
          <div>
            <label className="field-label" htmlFor={`${locale}-seoTitle`}>
              SEO title
            </label>
            <input
              id={`${locale}-seoTitle`}
              name={`${locale}.seoTitle`}
              defaultValue={initial.seoTitle}
              maxLength={180}
              className="field"
            />
          </div>
          <div>
            <label className="field-label" htmlFor={`${locale}-seoDescription`}>
              SEO description
            </label>
            <textarea
              id={`${locale}-seoDescription`}
              name={`${locale}.seoDescription`}
              defaultValue={initial.seoDescription}
              rows={2}
              maxLength={320}
              className="field"
            />
          </div>
        </div>
      </details>
    </div>
  );
}

export function ArticleForm({
  initial,
  categories,
  library,
}: {
  initial: ArticleFormInitial;
  categories: { id: string; name: string }[];
  library: MediaView[];
}) {
  return (
    <ActionForm
      action={saveArticleAction}
      submitLabel="Lưu bài viết"
      hint="Bắt buộc: tiêu đề ở ít nhất một ngôn ngữ. Bài nháp không hiển thị công khai."
    >
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div>
          <LocaleTabs
            vi={localeFields(
              "vi",
              initial.vi,
              { title: "Tiêu đề (VI) *", subtitle: "Phụ đề (VI)", excerpt: "Mô tả ngắn (VI)", content: "Nội dung bài viết (VI)" },
            )}
            en={localeFields(
              "en",
              initial.en,
              { title: "Title (EN)", subtitle: "Subtitle (EN)", excerpt: "Excerpt (EN)", content: "Article content (EN)" },
            )}
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
                  <option value="archived">Lưu trữ</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="scheduledFor">
                  Hẹn giờ xuất bản
                </label>
                <input
                  id="scheduledFor"
                  name="scheduledFor"
                  type="datetime-local"
                  defaultValue={initial.scheduledFor}
                  className="field"
                />
                <p className="mt-1 text-[10px] text-muted">
                  Chỉ áp dụng khi trạng thái là “Xuất bản”. Bài sẽ ẩn cho tới thời điểm này.
                </p>
              </div>
              <div>
                <label className="field-label" htmlFor="categoryId">
                  Danh mục
                </label>
                <select id="categoryId" name="categoryId" defaultValue={initial.categoryId} className="field">
                  <option value="">— Không chọn —</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="visibility">
                  Hiển thị
                </label>
                <select id="visibility" name="visibility" defaultValue={initial.visibility} className="field">
                  <option value="public">Công khai</option>
                  <option value="private">Riêng tư</option>
                </select>
              </div>
              <label className="flex items-center gap-2.5 text-[12px]">
                <input
                  type="checkbox"
                  name="featured"
                  defaultChecked={initial.featured}
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
                Bài viết nổi bật
              </label>
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
              </div>
              <div>
                <label className="field-label" htmlFor="tags">
                  Thẻ (phân cách bằng dấu phẩy)
                </label>
                <input
                  id="tags"
                  name="tags"
                  defaultValue={initial.tags}
                  className="field"
                  placeholder="design-systems, architecture"
                />
                <p className="mt-1 text-[10px] text-muted">Thẻ mới sẽ được tạo tự động.</p>
              </div>
            </div>
          </div>

          <div className="border border-line bg-surface p-4">
            <MediaPicker
              name="coverMediaId"
              label="Ảnh bìa"
              initial={initial.cover ? [initial.cover] : []}
              library={library}
              help="Tỷ lệ đẹp nhất 16:9."
            />
          </div>
        </div>
      </div>
    </ActionForm>
  );
}
