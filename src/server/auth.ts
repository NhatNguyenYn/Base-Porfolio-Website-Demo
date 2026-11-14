import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { clientIp } from "@/lib/rate-limit";
import { prisma } from "./db";

export const SESSION_COOKIE = "ps_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export type Role = "SUPER_ADMIN" | "ADMIN";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

/**
 * Fixed bcrypt hash of a password nobody knows, used only as a timing
 * stand-in: comparing against it on the unknown-email login path makes that
 * path take the same time as a real password check, so an attacker cannot
 * tell whether an email exists from response time. It is never a real
 * credential and no password verifies against it.
 */
export const DUMMY_PASSWORD_HASH = "$2b$12$OZVzr7Ma2BTzgHhFvELCOuCF6zpX/ef4EcbImytPPVnQGy2BKLVMW";

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const requestHeaders = await headers();
  // Logging-only IP, resolved with the same trusted-proxy-hop logic as rate
  // limiting — never the raw left-most X-Forwarded-For entry, which any
  // client can forge. No decision is ever based on this value.
  const ip = clientIp(requestHeaders);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      userAgent: requestHeaders.get("user-agent")?.slice(0, 250) ?? null,
      ip: ip === "unknown" ? null : ip,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Terminates the current session and clears the cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** Revokes every session of a user except the caller's (used on password change). */
export async function revokeOtherSessions(userId: string): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  await prisma.session.deleteMany({
    where: {
      userId,
      ...(token ? { NOT: { tokenHash: hashToken(token) } } : {}),
    },
  });
}

/**
 * Revokes ALL sessions of a user. Used on login, before the new session is
 * created, so a stolen token from an earlier session stops working instead
 * of staying valid for up to 7 days. Deleting first (rather than revoking
 * "other" sessions after creating the new one) avoids depending on reading
 * back the just-set cookie in the same request.
 */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Resolves the signed-in administrator for the current request.
 * Cached per request so layouts and pages share one lookup.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (!session.user.isActive) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role as Role,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return user;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") redirect("/admin?denied=1");
  return user;
}

export async function userCount(): Promise<number> {
  return prisma.user.count();
}

export async function touchLastLogin(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
}
