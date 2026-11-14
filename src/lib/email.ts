import { Resend } from "resend";
import type { Locale } from "@/i18n/config";

/**
 * Outgoing mail for bookings (Resend — the same provider as Dan Platform).
 *
 * Env-gated: mail is sent only when BOTH are set, otherwise the caller skips
 * it and the booking stays `pending` for the admin to confirm manually.
 * - RESEND_API_KEY — the Resend API key (Nguyen already has one).
 * - EMAIL_FROM — the verified sender, e.g. `Portfolio Studio <noreply@your-domain>`.
 *   The domain must be verified in Resend; until then no mail can be sent.
 */
export function confirmationEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type BookingConfirmationMail = {
  to: string;
  locale: Locale;
  name: string;
  serviceName: string;
  startsAtLabel: string;
  referenceCode: string;
  confirmUrl: string;
  lookupUrl: string;
  expiresHours: number;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Confirmation mail: subject + text + html for one locale. */
export function bookingConfirmationMailContent(
  mail: BookingConfirmationMail,
): { subject: string; text: string; html: string } {
  const vi = mail.locale === "vi";
  const subject = vi
    ? `Xác nhận lịch tư vấn ${mail.serviceName} — ${mail.startsAtLabel}`
    : `Confirm your ${mail.serviceName} session — ${mail.startsAtLabel}`;
  const text = vi
    ? [
        `Chào ${mail.name},`,
        ``,
        `Bạn đã đặt lịch "${mail.serviceName}" lúc ${mail.startsAtLabel} (mã ${mail.referenceCode}).`,
        `Vui lòng bấm vào liên kết sau để xác nhận bạn sẽ tham gia buổi tư vấn:`,
        mail.confirmUrl,
        ``,
        `Liên kết này hết hạn sau ${mail.expiresHours} giờ. Nếu bạn không xác nhận, lịch hẹn sẽ tự động huỷ để nhường khung giờ cho người khác.`,
        `Bạn có thể tra cứu hoặc huỷ lịch tại: ${mail.lookupUrl}`,
        ``,
        `Cảm ơn bạn!`,
      ].join("\n")
    : [
        `Hi ${mail.name},`,
        ``,
        `You booked "${mail.serviceName}" at ${mail.startsAtLabel} (code ${mail.referenceCode}).`,
        `Please click the link below to confirm you will attend the session:`,
        mail.confirmUrl,
        ``,
        `This link expires in ${mail.expiresHours} hours. If you do not confirm, the booking will be released automatically so someone else can take the slot.`,
        `You can look up or cancel your booking at: ${mail.lookupUrl}`,
        ``,
        `Thank you!`,
      ].join("\n");
  const html = vi
    ? `<p>Chào ${escapeHtml(mail.name)},</p>
<p>Bạn đã đặt lịch <strong>${escapeHtml(mail.serviceName)}</strong> lúc <strong>${escapeHtml(mail.startsAtLabel)}</strong> (mã <strong>${escapeHtml(mail.referenceCode)}</strong>).</p>
<p>Vui lòng bấm nút dưới đây để xác nhận bạn sẽ tham gia buổi tư vấn:</p>
<p><a href="${escapeHtml(mail.confirmUrl)}" style="display:inline-block;padding:12px 24px;background:#a4133c;color:#fff;text-decoration:none;border-radius:8px;">Xác nhận tham gia</a></p>
<p>Liên kết này hết hạn sau ${mail.expiresHours} giờ. Nếu bạn không xác nhận, lịch hẹn sẽ tự động huỷ để nhường khung giờ cho người khác.</p>
<p>Bạn có thể tra cứu hoặc huỷ lịch tại: <a href="${escapeHtml(mail.lookupUrl)}">${escapeHtml(mail.lookupUrl)}</a></p>
<p>Cảm ơn bạn!</p>`
    : `<p>Hi ${escapeHtml(mail.name)},</p>
<p>You booked <strong>${escapeHtml(mail.serviceName)}</strong> at <strong>${escapeHtml(mail.startsAtLabel)}</strong> (code <strong>${escapeHtml(mail.referenceCode)}</strong>).</p>
<p>Please click the button below to confirm you will attend the session:</p>
<p><a href="${escapeHtml(mail.confirmUrl)}" style="display:inline-block;padding:12px 24px;background:#a4133c;color:#fff;text-decoration:none;border-radius:8px;">Confirm attendance</a></p>
<p>This link expires in ${mail.expiresHours} hours. If you do not confirm, the booking will be released automatically so someone else can take the slot.</p>
<p>You can look up or cancel your booking at: <a href="${escapeHtml(mail.lookupUrl)}">${escapeHtml(mail.lookupUrl)}</a></p>
<p>Thank you!</p>`;
  return { subject, text, html };
}

/**
 * Send the confirmation mail. Returns true only when Resend accepted it.
 * Never throws: a mail failure must not fail the booking itself.
 */
export async function sendBookingConfirmationEmail(mail: BookingConfirmationMail): Promise<boolean> {
  if (!confirmationEmailConfigured()) return false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { subject, text, html } = bookingConfirmationMailContent(mail);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM as string,
      to: mail.to,
      subject,
      text,
      html,
    });
    if (error) {
      console.error("booking confirmation email failed", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("booking confirmation email failed", error);
    return false;
  }
}
