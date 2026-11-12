"use server";

import { headers } from "next/headers";
import { prisma } from "../db";
import { contactSchema, zodFieldErrors } from "@/lib/validation";
import { clientIp, hashedKey, rateLimit } from "@/lib/rate-limit";
import type { ActionState } from "@/lib/action-state";

export type ContactState = ActionState & { success?: boolean };

export async function submitContactMessage(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);

  // Honeypot + submit-timing checks. Bots get a silent success so they do not learn.
  const honeypot = formData.get("website");
  const startedAt = Number.parseInt(String(formData.get("startedAt") ?? "0"), 10);
  const tooFast = Number.isFinite(startedAt) && Date.now() - startedAt < 1800;
  if ((typeof honeypot === "string" && honeypot.length > 0) || tooFast) {
    return { ok: true, success: true, message: "ok" };
  }

  const limit = rateLimit(`contact:${hashedKey(ip)}`, 4, 10 * 60 * 1000);
  if (!limit.ok) {
    return { ok: false, message: "rate_limited" };
  }

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    website: "",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "invalid",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  await prisma.contactMessage.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      subject: parsed.data.subject,
      message: parsed.data.message,
      ip: ip.slice(0, 60),
      userAgent: requestHeaders.get("user-agent")?.slice(0, 250) ?? null,
    },
  });

  return { ok: true, success: true, message: "sent" };
}
