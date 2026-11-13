"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import {
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  revokeOtherSessions,
  userCount,
  verifyPassword,
} from "../auth";
import { logActivity } from "../audit";
import {
  changePasswordSchema,
  loginSchema,
  setupSchema,
  zodFieldErrors,
} from "@/lib/validation";
import { clientIp, hashedKey, rateLimit } from "@/lib/rate-limit";
import { evaluateSetupAccess } from "@/lib/setup-guard";
import type { ActionState } from "@/lib/action-state";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  // Two buckets: one per account (stops targeted guessing) and one per address
  // (stops spraying one password across many accounts).
  const perAccount = rateLimit(`login:${hashedKey(ip)}:${parsed.data.email}`, 6, 10 * 60 * 1000);
  const perAddress = rateLimit(`login-ip:${hashedKey(ip)}`, 25, 10 * 60 * 1000);
  if (!perAccount.ok || !perAddress.ok) {
    const retry = Math.max(perAccount.retryAfterSeconds, perAddress.retryAfterSeconds);
    return { ok: false, message: `Too many attempts. Try again in ${Math.ceil(retry / 60)} minutes.` };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;

  if (!user || !valid || !user.isActive) {
    return { ok: false, message: "Email or password is incorrect." };
  }

  await createSession(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logActivity({
    userId: user.id,
    action: "login",
    entityType: "session",
    summary: `${user.name} signed in`,
  });

  const next = parsed.data.next;
  const target = next && next.startsWith("/admin") ? next : "/admin";
  redirect(target);
}

export async function logoutAction(): Promise<void> {
  const user = await getSessionUser();
  if (user) {
    await logActivity({
      userId: user.id,
      action: "logout",
      entityType: "session",
      summary: `${user.name} signed out`,
    });
  }
  await destroySession();
  redirect("/admin/login");
}

export async function setupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const requestHeaders = await headers();
  const providedToken = formData.get("setupToken");
  const access = evaluateSetupAccess({
    isProduction: process.env.NODE_ENV === "production",
    host: requestHeaders.get("host"),
    configuredToken: process.env.SETUP_TOKEN ?? "",
    providedToken: typeof providedToken === "string" ? providedToken : null,
  });

  if (!access.allowed) {
    if (access.reason === "token") return { ok: false, message: "Setup token is incorrect." };
    if (access.reason === "disabled") {
      return {
        ok: false,
        message: "First-run setup is disabled on this server. Set SETUP_TOKEN to enable it.",
      };
    }
    return {
      ok: false,
      message: "First-run setup is localhost-only. Set SETUP_TOKEN to enable remote setup.",
    };
  }

  if ((await userCount()) > 0) {
    return { ok: false, message: "An administrator account already exists. Sign in instead." };
  }

  const parsed = setupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (existing) return { ok: false, message: "That email is already registered." };

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password),
      role: "SUPER_ADMIN",
      lastLoginAt: new Date(),
    },
  });

  await createSession(user.id);
  await logActivity({
    userId: user.id,
    action: "create",
    entityType: "user",
    entityId: user.id,
    summary: `Initial administrator ${user.email} created`,
  });

  revalidatePath("/admin", "layout");
  redirect("/admin");
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Your session expired. Sign in again." };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row) return { ok: false, message: "Account not found." };

  const valid = await verifyPassword(parsed.data.currentPassword, row.passwordHash);
  if (!valid) {
    return {
      ok: false,
      message: "Current password is incorrect.",
      fieldErrors: { currentPassword: ["Current password is incorrect"] },
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });
  await revokeOtherSessions(user.id);
  await logActivity({
    userId: user.id,
    action: "update",
    entityType: "user",
    entityId: user.id,
    summary: "Password changed; other sessions revoked",
  });

  return { ok: true, message: "Password updated. Other sessions have been signed out." };
}
