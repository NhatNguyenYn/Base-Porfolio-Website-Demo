import { Resend } from "resend";
import type { Locale } from "@/i18n/config";

/**
 * Outgoing mail for bookings (Resend — the same provider as Dan Platform).
 *
 * Env-gated: mail is sent only when BOTH are set, otherwise the caller skips
 * it and the booking stays `pending` for the admin to confirm manually.
 * - RESEND_API_KEY — the Resend API key (Nguyen already has one).
 * - EMAIL_FROM — the verified sender, e.g. `Thu Hà Ruby <noreply@your-domain>`.
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
  // Email-safe layout: single-column tables + inline styles only (no
  // external CSS, no webfonts). Same look as the site: cream background,
  // dark ink text, editorial serif title, crimson accent button.
  const accent = "#a4133c";
  const ink = "#1c1c1e";
  const muted = "#6b6b70";
  const line = "#e6e2dc";
  const card = "#ffffff";
  const page = "#f7f4ef";
  const esc = escapeHtml;
  const html = vi
    ? `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head><body style="margin:0;padding:0;background:${page};color:${ink};font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${page};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${card};border:1px solid ${line};border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${muted};">Thu Hà Ruby &middot; Xác nhận lịch hẹn</td></tr>
<tr><td style="padding:12px 32px 0;font-size:28px;line-height:1.25;font-weight:bold;">Xác nhận buổi tư vấn của bạn</td></tr>
<tr><td style="padding:16px 32px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;">Chào ${esc(mail.name)},<br><br>Bạn đã đặt lịch <strong>${esc(mail.serviceName)}</strong>. Vui lòng bấm nút dưới đây để xác nhận bạn sẽ tham gia buổi tư vấn.</td></tr>
<tr><td style="padding:20px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${page};border:1px solid ${line};border-radius:8px;"><tr><td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.9;">
<strong>Dịch vụ:</strong> ${esc(mail.serviceName)}<br>
<strong>Thời gian:</strong> ${esc(mail.startsAtLabel)}<br>
<strong>Mã đặt lịch:</strong> ${esc(mail.referenceCode)}
</td></tr></table></td></tr>
<tr><td align="center" style="padding:28px 32px 0;"><a href="${esc(mail.confirmUrl)}" style="display:inline-block;padding:14px 32px;background:${accent};color:#ffffff;text-decoration:none;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">Xác nhận tham gia</a></td></tr>
<tr><td style="padding:20px 32px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:${muted};">Liên kết này hết hạn sau ${mail.expiresHours} giờ. Nếu bạn không xác nhận, lịch hẹn sẽ tự động huỷ để nhường khung giờ cho người khác.</td></tr>
<tr><td style="padding:12px 32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:${muted};">Bạn có thể tra cứu hoặc huỷ lịch tại: <a href="${esc(mail.lookupUrl)}" style="color:${accent};">${esc(mail.lookupUrl)}</a><br><br>Email này được gửi tự động, vui lòng không trả lời.</td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${muted};">Thu Hà Ruby</p>
</td></tr></table>
</body></html>`
    : `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head><body style="margin:0;padding:0;background:${page};color:${ink};font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${page};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${card};border:1px solid ${line};border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${muted};">Thu Hà Ruby &middot; Booking confirmation</td></tr>
<tr><td style="padding:12px 32px 0;font-size:28px;line-height:1.25;font-weight:bold;">Confirm your consultation</td></tr>
<tr><td style="padding:16px 32px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;">Hi ${esc(mail.name)},<br><br>You booked <strong>${esc(mail.serviceName)}</strong>. Please click the button below to confirm you will attend the session.</td></tr>
<tr><td style="padding:20px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${page};border:1px solid ${line};border-radius:8px;"><tr><td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.9;">
<strong>Service:</strong> ${esc(mail.serviceName)}<br>
<strong>Time:</strong> ${esc(mail.startsAtLabel)}<br>
<strong>Booking code:</strong> ${esc(mail.referenceCode)}
</td></tr></table></td></tr>
<tr><td align="center" style="padding:28px 32px 0;"><a href="${esc(mail.confirmUrl)}" style="display:inline-block;padding:14px 32px;background:${accent};color:#ffffff;text-decoration:none;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">Confirm attendance</a></td></tr>
<tr><td style="padding:20px 32px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:${muted};">This link expires in ${mail.expiresHours} hours. If you do not confirm, the booking will be released automatically so someone else can take the slot.</td></tr>
<tr><td style="padding:12px 32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:${muted};">You can look up or cancel your booking at: <a href="${esc(mail.lookupUrl)}" style="color:${accent};">${esc(mail.lookupUrl)}</a><br><br>This email was sent automatically, please do not reply.</td></tr>
</table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${muted};">Thu Hà Ruby</p>
</td></tr></table>
</body></html>`;
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
