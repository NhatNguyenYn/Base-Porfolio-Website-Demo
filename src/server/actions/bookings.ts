"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireUser } from "../auth";
import { logActivity } from "../audit";
import { bookingServiceSchema, bookingSlotSchema, zodFieldErrors } from "@/lib/validation";
import { deriveEndsAt, vnLocalToUtc } from "@/lib/booking-time";
import { slugify } from "@/lib/utils";
import { getBool, getString, readLocaleBlock, uniqueSlug } from "./helpers";
import type { ActionState } from "@/lib/action-state";

/** Frees a slot when no other active booking still holds it. Runs inside the caller's transaction. */
async function freeSlotIfUnused(
  tx: Prisma.TransactionClient,
  slotId: string,
  excludeBookingId: string,
): Promise<void> {
  const other = await tx.booking.findFirst({
    where: { slotId, status: { in: ["pending", "confirmed"] }, id: { not: excludeBookingId } },
    select: { id: true },
  });
  if (!other) {
    await tx.bookingSlot.update({ where: { id: slotId }, data: { status: "available" } });
  }
}

export async function saveServiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = getString(formData, "id") || undefined;

  const parsed = bookingServiceSchema.safeParse({
    id,
    slug: getString(formData, "slug") || undefined,
    durationMinutes: getString(formData, "durationMinutes") || undefined,
    active: getBool(formData, "active"),
    intakeSurveyId: getString(formData, "intakeSurveyId") || undefined,
    order: getString(formData, "order") || undefined,
    vi: readLocaleBlock(formData, "vi", ["name", "description"]),
    en: readLocaleBlock(formData, "en", ["name", "description"]),
  });

  if (!parsed.success) {
    return { ok: false, message: "Vui lòng kiểm tra các trường đã đánh dấu.", fieldErrors: zodFieldErrors(parsed.error) };
  }
  const data = parsed.data;
  if (!data.vi.name && !data.en.name) {
    return {
      ok: false,
      message: "Nhập tên dịch vụ ở ít nhất một ngôn ngữ.",
      fieldErrors: { "vi.name": ["Tên dịch vụ là bắt buộc"] },
    };
  }

  const exists = async (candidate: string) => {
    const found = await prisma.bookingService.findFirst({
      where: { slug: candidate, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    return Boolean(found);
  };
  const slug = id
    ? data.slug
      ? await uniqueSlug(slugify(data.slug), exists)
      : (await prisma.bookingService.findUnique({ where: { id }, select: { slug: true } }))?.slug ??
        slugify(data.vi.name || data.en.name)
    : await uniqueSlug(slugify(data.slug || data.vi.name || data.en.name) || "service", exists);

  try {
    const service = await prisma.$transaction(async (tx) => {
      const record = id
        ? await tx.bookingService.update({
            where: { id },
            data: {
              slug,
              durationMinutes: data.durationMinutes,
              active: data.active,
              intakeSurveyId: data.intakeSurveyId ?? null,
              order: data.order,
            },
          })
        : await tx.bookingService.create({
            data: {
              slug,
              durationMinutes: data.durationMinutes,
              active: data.active,
              intakeSurveyId: data.intakeSurveyId ?? null,
              order: data.order,
            },
          });

      for (const locale of ["vi", "en"] as const) {
        const block = data[locale];
        if (block.name.trim()) {
          await tx.bookingServiceTranslation.upsert({
            where: { serviceId_locale: { serviceId: record.id, locale } },
            update: { name: block.name, description: block.description },
            create: { serviceId: record.id, locale, name: block.name, description: block.description },
          });
        } else {
          await tx.bookingServiceTranslation.deleteMany({ where: { serviceId: record.id, locale } });
        }
      }
      return record;
    });

    await logActivity({
      userId: user.id,
      action: id ? "update" : "create",
      entityType: "booking_service",
      entityId: service.id,
      summary: `${id ? "Updated" : "Created"} booking service “${data.vi.name || data.en.name}” (/${slug})`,
    });
    revalidatePath("/", "layout");
    redirect(`/admin/bookings/services/${service.id}?saved=1`);
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error) throw error;
    console.error("[booking] save service failed", error);
    return { ok: false, message: "Không lưu được dịch vụ. Vui lòng thử lại." };
  }
}

export async function saveSlotAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const serviceId = getString(formData, "serviceId");
  const date = getString(formData, "date");
  const startTime = getString(formData, "startTime");
  const durationRaw = Number.parseInt(getString(formData, "durationMinutes") || "", 10);

  const service = serviceId
    ? await prisma.bookingService.findUnique({ where: { id: serviceId }, select: { id: true, durationMinutes: true } })
    : null;
  if (!service) {
    return { ok: false, message: "Chọn dịch vụ cho khung giờ.", fieldErrors: { serviceId: ["Dịch vụ là bắt buộc"] } };
  }
  const durationMinutes = [15, 30, 60].includes(durationRaw) ? durationRaw : service.durationMinutes;

  // VN local input -> UTC storage (explicit conversion, unit-tested).
  const startsAt = vnLocalToUtc(date, startTime);
  if (!startsAt) {
    return {
      ok: false,
      message: "Ngày hoặc giờ bắt đầu không hợp lệ.",
      fieldErrors: { date: ["Ngày/giờ không hợp lệ"] },
    };
  }
  if (startsAt.getTime() <= Date.now()) {
    return { ok: false, message: "Khung giờ phải ở tương lai.", fieldErrors: { date: ["Khung giờ phải ở tương lai"] } };
  }
  // endsAt is derived server-side from startsAt + duration, never from the client.
  const endsAt = deriveEndsAt(startsAt, durationMinutes);

  const parsed = bookingSlotSchema.safeParse({
    serviceId,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  });
  if (!parsed.success) {
    return { ok: false, message: "Khung giờ không hợp lệ.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  try {
    const slot = await prisma.bookingSlot.create({
      data: { serviceId, startsAt, endsAt, status: "available" },
    });
    await logActivity({
      userId: user.id,
      action: "create",
      entityType: "booking_slot",
      entityId: slot.id,
      summary: `Created booking slot ${startsAt.toISOString()} (${durationMinutes} min) for service ${serviceId}`,
    });
    revalidatePath("/admin/bookings/slots");
    return { ok: true, message: "Đã tạo khung giờ." };
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      return { ok: false, message: "Khung giờ này đã tồn tại cho dịch vụ đã chọn." };
    }
    console.error("[booking] save slot failed", error);
    return { ok: false, message: "Không tạo được khung giờ. Vui lòng thử lại." };
  }
}

export async function blockSlotAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;
  await prisma.bookingSlot.updateMany({ where: { id, status: "available" }, data: { status: "blocked" } });
  await logActivity({ userId: user.id, action: "update", entityType: "booking_slot", entityId: id, summary: "Blocked booking slot" });
  revalidatePath("/admin/bookings/slots");
}

export async function unblockSlotAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;
  await prisma.bookingSlot.updateMany({ where: { id, status: "blocked" }, data: { status: "available" } });
  await logActivity({ userId: user.id, action: "update", entityType: "booking_slot", entityId: id, summary: "Unblocked booking slot" });
  revalidatePath("/admin/bookings/slots");
}

export async function deleteSlotAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;
  const hasBooking = await prisma.booking.findFirst({ where: { slotId: id }, select: { id: true } });
  if (hasBooking) return; // Slots with booking history are kept; block them instead.
  await prisma.bookingSlot.delete({ where: { id } });
  await logActivity({ userId: user.id, action: "delete", entityType: "booking_slot", entityId: id, summary: "Deleted booking slot" });
  revalidatePath("/admin/bookings/slots");
}

/** Confirm (pending -> confirmed) or complete (confirmed/pending -> completed). */
export async function setBookingStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  const status = getString(formData, "status");
  if (!id || !["confirmed", "completed"].includes(status)) return;

  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!booking) return;
    if (status === "confirmed" && booking.status !== "pending") return;
    if (status === "completed" && !["pending", "confirmed"].includes(booking.status)) return;
    // Completing frees the flower (partial index) but leaves the slot booked:
    // the slot is in the past. Nothing nulls flowerCode — history is kept.
    await tx.booking.update({ where: { id }, data: { status } });
  });
  await logActivity({
    userId: user.id,
    action: "update",
    entityType: "booking",
    entityId: id,
    summary: `Set booking status to ${status}`,
  });
  revalidatePath("/admin/bookings");
}

/** Admin cancel: booking -> cancelled + cancelledAt, slot freed in the SAME transaction. */
export async function adminCancelBookingAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = getString(formData, "id");
  if (!id) return;

  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id },
      select: { id: true, status: true, slotId: true },
    });
    if (!booking || !["pending", "confirmed"].includes(booking.status)) return;
    await tx.booking.update({
      where: { id },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
    // The flower is freed automatically by the partial unique index
    // (Booking_flowerCode_active_key) — flowerCode is NEVER nulled.
    await freeSlotIfUnused(tx, booking.slotId, id);
  });
  await logActivity({
    userId: user.id,
    action: "update",
    entityType: "booking",
    entityId: id,
    summary: "Cancelled booking (admin) and freed its slot",
  });
  revalidatePath("/admin/bookings");
}
