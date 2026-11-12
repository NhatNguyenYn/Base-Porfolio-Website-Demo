"use client";

import { saveCollectionAction } from "@/server/actions/artworks";
import type { MediaView } from "@/server/queries/types";
import { ActionForm } from "./action-form";
import { LocaleTabs } from "./locale-tabs";
import { MediaPicker } from "./media-picker";

export type CollectionFormInitial = {
  id?: string;
  slug: string;
  cover: MediaView | null;
  featured: boolean;
  visibility: string;
  order: number;
  vi: { name: string; description: string };
  en: { name: string; description: string };
};

export const emptyCollection: CollectionFormInitial = {
  slug: "",
  cover: null,
  featured: false,
  visibility: "public",
  order: 0,
  vi: { name: "", description: "" },
  en: { name: "", description: "" },
};

export function CollectionForm({
  initial,
  library,
  onCancelHref,
}: {
  initial: CollectionFormInitial;
  library: MediaView[];
  onCancelHref?: string;
}) {
  return (
    <ActionForm action={saveCollectionAction} submitLabel={initial.id ? "Lưu bộ sưu tập" : "Tạo bộ sưu tập"}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <LocaleTabs
          hint="Tên bộ sưu tập cần có ở ít nhất một ngôn ngữ."
          vi={
            <div className="space-y-4">
              <div>
                <label className="field-label" htmlFor="vi-name">
                  Tên bộ sưu tập (VI) *
                </label>
                <input id="vi-name" name="vi.name" defaultValue={initial.vi.name} maxLength={160} className="field" />
              </div>
              <div>
                <label className="field-label" htmlFor="vi-description">
                  Mô tả (VI)
                </label>
                <textarea
                  id="vi-description"
                  name="vi.description"
                  defaultValue={initial.vi.description}
                  rows={4}
                  className="field"
                />
              </div>
            </div>
          }
          en={
            <div className="space-y-4">
              <div>
                <label className="field-label" htmlFor="en-name">
                  Collection name (EN)
                </label>
                <input id="en-name" name="en.name" defaultValue={initial.en.name} maxLength={160} className="field" />
              </div>
              <div>
                <label className="field-label" htmlFor="en-description">
                  Description (EN)
                </label>
                <textarea
                  id="en-description"
                  name="en.description"
                  defaultValue={initial.en.description}
                  rows={4}
                  className="field"
                />
              </div>
            </div>
          }
        />

        <div className="space-y-5">
          <div className="border border-line bg-surface p-4">
            <MediaPicker
              name="coverMediaId"
              label="Ảnh bìa bộ sưu tập"
              initial={initial.cover ? [initial.cover] : []}
              library={library}
              maxHeight="aspect-[16/10]"
            />
          </div>
          <div className="border border-line bg-surface p-4">
            <div className="space-y-4">
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
                Bộ sưu tập nổi bật
              </label>
              <div>
                <label className="field-label" htmlFor="order">
                  Thứ tự
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
                <input id="slug" name="slug" defaultValue={initial.slug} className="field font-mono text-[12px]" />
              </div>
            </div>
          </div>
          {onCancelHref && (
            <a href={onCancelHref} className="text-[11px] text-muted underline underline-offset-4 hover:text-ink">
              Huỷ chỉnh sửa
            </a>
          )}
        </div>
      </div>
    </ActionForm>
  );
}
