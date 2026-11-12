"use client";

import { saveProjectAction } from "@/server/actions/projects";
import type { MediaView } from "@/server/queries/types";
import { ActionForm } from "./action-form";
import { LocaleTabs } from "./locale-tabs";
import { MarkdownEditor } from "./markdown-editor";
import { MediaPicker } from "./media-picker";

export type ProjectFormInitial = {
  id?: string;
  slug: string;
  status: string;
  visibility: string;
  featured: boolean;
  order: number;
  startDate: string;
  completionDate: string;
  githubUrl: string;
  demoUrl: string;
  thumbnail: MediaView | null;
  gallery: MediaView[];
  technologies: string;
  vi: { name: string; shortDescription: string; fullDescription: string; role: string };
  en: { name: string; shortDescription: string; fullDescription: string; role: string };
};

export const emptyProject: ProjectFormInitial = {
  slug: "",
  status: "completed",
  visibility: "public",
  featured: false,
  order: 0,
  startDate: "",
  completionDate: "",
  githubUrl: "",
  demoUrl: "",
  thumbnail: null,
  gallery: [],
  technologies: "",
  vi: { name: "", shortDescription: "", fullDescription: "", role: "" },
  en: { name: "", shortDescription: "", fullDescription: "", role: "" },
};

export function ProjectForm({
  initial,
  library,
}: {
  initial: ProjectFormInitial;
  library: MediaView[];
}) {
  return (
    <ActionForm action={saveProjectAction} submitLabel="Lưu dự án" hint="Bắt buộc: tên dự án ở ít nhất một ngôn ngữ.">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-6">
          <LocaleTabs
            vi={
              <div className="space-y-4">
                <div>
                  <label className="field-label" htmlFor="vi-name">
                    Tên dự án (VI) *
                  </label>
                  <input
                    id="vi-name"
                    name="vi.name"
                    defaultValue={initial.vi.name}
                    maxLength={160}
                    className="field"
                    placeholder="Aurora Design System"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="vi-short">
                    Mô tả ngắn (VI)
                  </label>
                  <textarea
                    id="vi-short"
                    name="vi.shortDescription"
                    defaultValue={initial.vi.shortDescription}
                    rows={3}
                    maxLength={400}
                    className="field"
                    placeholder="Một hai câu về vấn đề và kết quả."
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="vi-role">
                    Vai trò của bạn (VI)
                  </label>
                  <input
                    id="vi-role"
                    name="vi.role"
                    defaultValue={initial.vi.role}
                    maxLength={160}
                    className="field"
                    placeholder="Design Engineer"
                  />
                </div>
                <MarkdownEditor
                  name="vi.fullDescription"
                  label="Nội dung chi tiết (VI)"
                  defaultValue={initial.vi.fullDescription}
                  rows={14}
                />
              </div>
            }
            en={
              <div className="space-y-4">
                <div>
                  <label className="field-label" htmlFor="en-name">
                    Project name (EN)
                  </label>
                  <input
                    id="en-name"
                    name="en.name"
                    defaultValue={initial.en.name}
                    maxLength={160}
                    className="field"
                    placeholder="Aurora Design System"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="en-short">
                    Short description (EN)
                  </label>
                  <textarea
                    id="en-short"
                    name="en.shortDescription"
                    defaultValue={initial.en.shortDescription}
                    rows={3}
                    maxLength={400}
                    className="field"
                    placeholder="One or two sentences about the problem and the outcome."
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="en-role">
                    Your role (EN)
                  </label>
                  <input
                    id="en-role"
                    name="en.role"
                    defaultValue={initial.en.role}
                    maxLength={160}
                    className="field"
                    placeholder="Design Engineer"
                  />
                </div>
                <MarkdownEditor
                  name="en.fullDescription"
                  label="Full description (EN)"
                  defaultValue={initial.en.fullDescription}
                  rows={14}
                />
              </div>
            }
          />
        </div>

        <div className="space-y-5">
          <div className="border border-line bg-surface p-4">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Xuất bản</p>
            <div className="space-y-4">
              <div>
                <label className="field-label" htmlFor="status">
                  Trạng thái dự án
                </label>
                <select id="status" name="status" defaultValue={initial.status} className="field">
                  <option value="completed">Đã hoàn thành</option>
                  <option value="in_progress">Đang thực hiện</option>
                  <option value="archived">Đã lưu trữ</option>
                </select>
              </div>

              <div>
                <label className="field-label" htmlFor="visibility">
                  Hiển thị
                </label>
                <select id="visibility" name="visibility" defaultValue={initial.visibility} className="field">
                  <option value="public">Công khai trên website</option>
                  <option value="private">Riêng tư (ẩn)</option>
                </select>
              </div>

              <label className="flex items-center gap-2.5 text-[12px]">
                <input
                  type="checkbox"
                  name="featured"
                  defaultChecked={initial.featured}
                  className="h-3.5 w-3.5 accent-[var(--accent)]"
                />
                Dự án nổi bật (hiện trên trang chủ)
              </label>

              <div>
                <label className="field-label" htmlFor="order">
                  Thứ tự hiển thị
                </label>
                <input
                  id="order"
                  name="order"
                  type="number"
                  min={0}
                  max={9999}
                  defaultValue={initial.order}
                  className="field"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="slug">
                  Slug (để trống sẽ tự tạo)
                </label>
                <input
                  id="slug"
                  name="slug"
                  defaultValue={initial.slug}
                  maxLength={90}
                  className="field font-mono text-[12px]"
                  placeholder="aurora-design-system"
                />
              </div>
            </div>
          </div>

          <div className="border border-line bg-surface p-4">
            <MediaPicker
              name="thumbnailMediaId"
              label="Ảnh đại diện dự án"
              initial={initial.thumbnail ? [initial.thumbnail] : []}
              library={library}
              help="Tỷ lệ đẹp nhất: 16:10 hoặc 4:3."
            />
            <div className="mt-5">
              <MediaPicker
                name="gallery"
                label="Thư viện ảnh dự án"
                initial={initial.gallery}
                library={library}
                multiple
                help="Có thể chọn nhiều ảnh; thứ tự theo lúc chọn."
              />
            </div>
          </div>

          <div className="border border-line bg-surface p-4">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Chi tiết</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label" htmlFor="startDate">
                    Bắt đầu
                  </label>
                  <input id="startDate" name="startDate" type="date" defaultValue={initial.startDate} className="field" />
                </div>
                <div>
                  <label className="field-label" htmlFor="completionDate">
                    Hoàn thành
                  </label>
                  <input
                    id="completionDate"
                    name="completionDate"
                    type="date"
                    defaultValue={initial.completionDate}
                    className="field"
                  />
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="technologies">
                  Công nghệ (phân cách bằng dấu phẩy)
                </label>
                <input
                  id="technologies"
                  name="technologies"
                  defaultValue={initial.technologies}
                  className="field"
                  placeholder="TypeScript, React, PostgreSQL"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="githubUrl">
                  GitHub URL
                </label>
                <input
                  id="githubUrl"
                  name="githubUrl"
                  type="url"
                  defaultValue={initial.githubUrl}
                  className="field"
                  placeholder="https://example.com/repository"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="demoUrl">
                  Live demo URL
                </label>
                <input
                  id="demoUrl"
                  name="demoUrl"
                  type="url"
                  defaultValue={initial.demoUrl}
                  className="field"
                  placeholder="https://example.com/demo"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ActionForm>
  );
}
