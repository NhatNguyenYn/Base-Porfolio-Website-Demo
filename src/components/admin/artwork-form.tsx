"use client";

import { saveArtworkAction } from "@/server/actions/artworks";
import type { MediaView } from "@/server/queries/types";
import { ActionForm } from "./action-form";
import { LocaleTabs } from "./locale-tabs";
import { MediaPicker } from "./media-picker";

export type ArtworkFormInitial = {
  id?: string;
  slug: string;
  image: MediaView | null;
  collectionId: string;
  categoryId: string;
  medium: string;
  createdDate: string;
  featured: boolean;
  visibility: string;
  order: number;
  tags: string;
  vi: { title: string; description: string };
  en: { title: string; description: string };
};

export const emptyArtwork: ArtworkFormInitial = {
  slug: "",
  image: null,
  collectionId: "",
  categoryId: "",
  medium: "",
  createdDate: "",
  featured: false,
  visibility: "public",
  order: 0,
  tags: "",
  vi: { title: "", description: "" },
  en: { title: "", description: "" },
};

export function ArtworkForm({
  initial,
  collections,
  categories,
  library,
}: {
  initial: ArtworkFormInitial;
  collections: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  library: MediaView[];
}) {
  return (
    <ActionForm
      action={saveArtworkAction}
      submitLabel="Lưu tác phẩm"
      hint="Bắt buộc: ảnh tác phẩm và tiêu đề ở ít nhất một ngôn ngữ."
    >
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-6">
          <LocaleTabs
            vi={
              <div className="space-y-4">
                <div>
                  <label className="field-label" htmlFor="vi-title">
                    Tên tác phẩm (VI) *
                  </label>
                  <input
                    id="vi-title"
                    name="vi.title"
                    defaultValue={initial.vi.title}
                    maxLength={160}
                    className="field text-[15px]"
                    placeholder="Sau cơn mưa"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="vi-description">
                    Mô tả (VI)
                  </label>
                  <textarea
                    id="vi-description"
                    name="vi.description"
                    defaultValue={initial.vi.description}
                    rows={6}
                    className="field"
                    placeholder="Câu chuyện hoặc cảm hứng của tác phẩm…"
                  />
                </div>
              </div>
            }
            en={
              <div className="space-y-4">
                <div>
                  <label className="field-label" htmlFor="en-title">
                    Artwork title (EN)
                  </label>
                  <input
                    id="en-title"
                    name="en.title"
                    defaultValue={initial.en.title}
                    maxLength={160}
                    className="field text-[15px]"
                    placeholder="After the Rain"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="en-description">
                    Description (EN)
                  </label>
                  <textarea
                    id="en-description"
                    name="en.description"
                    defaultValue={initial.en.description}
                    rows={6}
                    className="field"
                  />
                </div>
              </div>
            }
          />

          <div className="border border-line bg-surface p-4">
            <MediaPicker
              name="imageMediaId"
              label="Ảnh tác phẩm *"
              required
              initial={initial.image ? [initial.image] : []}
              library={library}
              maxHeight="aspect-[4/5]"
              help="Ảnh gốc càng lớn càng tốt. Tỷ lệ khác nhau tạo nhịp điệu cho phòng tranh."
            />
          </div>
        </div>

        <div className="space-y-5">
          <div className="border border-line bg-surface p-4">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Trưng bày</p>
            <div className="space-y-4">
              <div>
                <label className="field-label" htmlFor="collectionId">
                  Bộ sưu tập
                </label>
                <select id="collectionId" name="collectionId" defaultValue={initial.collectionId} className="field">
                  <option value="">— Không thuộc bộ sưu tập —</option>
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label" htmlFor="categoryId">
                  Phân loại
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
                  <option value="public">Công khai trong phòng tranh</option>
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
                Tác phẩm nổi bật
              </label>

              <div>
                <label className="field-label" htmlFor="order">
                  Thứ tự trưng bày
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
                  Slug
                </label>
                <input
                  id="slug"
                  name="slug"
                  defaultValue={initial.slug}
                  className="field font-mono text-[12px]"
                  placeholder="tu-dong-tao"
                />
              </div>
            </div>
          </div>

          <div className="border border-line bg-surface p-4">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Thông tin tác phẩm</p>
            <div className="space-y-4">
              <div>
                <label className="field-label" htmlFor="medium">
                  Chất liệu / công cụ
                </label>
                <input
                  id="medium"
                  name="medium"
                  defaultValue={initial.medium}
                  maxLength={200}
                  className="field"
                  placeholder="Digital — Procreate, 2025"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="createdDate">
                  Ngày sáng tác
                </label>
                <input
                  id="createdDate"
                  name="createdDate"
                  type="date"
                  defaultValue={initial.createdDate}
                  className="field"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="tags">
                  Thẻ (phân cách bằng dấu phẩy)
                </label>
                <input id="tags" name="tags" defaultValue={initial.tags} className="field" placeholder="abstract, light" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ActionForm>
  );
}
