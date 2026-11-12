"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { hashPassword, requireSuperAdmin, type Role } from "../auth";
import { logActivity } from "../audit";
import { adminUserCreateSchema, userRoleSchema, zodFieldErrors } from "@/lib/validation";
import { getString } from "./helpers";
import type { ActionState } from "@/lib/action-state";

async function activeSuperAdmins(exceptId?: string): Promise<number> {
  return prisma.user.count({
    where: { role: "SUPER_ADMIN", isActive: true, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
  });
}

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireSuperAdmin();

  const parsed = adminUserCreateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: getString(formData, "role") || "ADMIN",
  });

  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return {
      ok: false,
      message: "That email is already registered.",
      fieldErrors: { email: ["Email already in use"] },
    };
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
    },
  });

  await logActivity({
    userId: actor.id,
    action: "create",
    entityType: "user",
    entityId: user.id,
    summary: `Created ${parsed.data.role} account ${email}`,
  });

  revalidatePath("/admin/users");
  return { ok: true, message: `Created ${email}. Share the password over a secure channel only.` };
}

export async function updateUserRoleAction(formData: FormData): Promise<void> {
  const actor = await requireSuperAdmin();
  const id = getString(formData, "id");
  const parsedRole = userRoleSchema.safeParse(getString(formData, "role"));
  if (!id || !parsedRole.success) redirect("/admin/users?error=invalid");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) redirect("/admin/users?error=missing");
  if (target.id === actor.id) redirect("/admin/users?error=self");

  if (target.role === "SUPER_ADMIN" && parsedRole.data !== "SUPER_ADMIN" && (await activeSuperAdmins(target.id)) === 0) {
    redirect("/admin/users?error=last-super");
  }

  await prisma.user.update({ where: { id }, data: { role: parsedRole.data as Role } });
  await logActivity({
    userId: actor.id,
    action: "update",
    entityType: "user",
    entityId: id,
    summary: `Role of ${target.email} changed to ${parsedRole.data}`,
  });

  revalidatePath("/admin/users");
  redirect("/admin/users?updated=1");
}

export async function toggleUserActiveAction(formData: FormData): Promise<void> {
  const actor = await requireSuperAdmin();
  const id = getString(formData, "id");
  if (!id) redirect("/admin/users?error=invalid");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) redirect("/admin/users?error=missing");
  if (target.id === actor.id) redirect("/admin/users?error=self");

  if (target.isActive && target.role === "SUPER_ADMIN" && (await activeSuperAdmins(target.id)) === 0) {
    redirect("/admin/users?error=last-super");
  }

  const next = !target.isActive;
  await prisma.user.update({ where: { id }, data: { isActive: next } });
  if (!next) {
    // Deactivating a user immediately revokes their sessions.
    await prisma.session.deleteMany({ where: { userId: id } });
  }
  await logActivity({
    userId: actor.id,
    action: "update",
    entityType: "user",
    entityId: id,
    summary: `${next ? "Reactivated" : "Deactivated"} ${target.email}`,
  });

  revalidatePath("/admin/users");
  redirect(`/admin/users?updated=1`);
}
