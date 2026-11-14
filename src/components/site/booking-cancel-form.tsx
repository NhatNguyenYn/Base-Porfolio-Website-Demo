"use client";

import { useState } from "react";
import { formatVnDateTime } from "@/lib/booking-time";
import type { BookingMessages } from "@/i18n/messages/vi";
import type { Locale } from "@/i18n/config";

type CancelResult = {
  referenceCode: string;
  service: string;
  startsAt: string;
  flowerCode: string;
  flowerName: string;
  status: string;
};

/**
 * Cancel by reference code + email, no login. Two steps: enter the
 * credentials, confirm the cancellation, then see the cancelled booking's own
 * summary. A wrong code OR a wrong email returns the same generic message.
 */
export function BookingCancelForm({
  messages,
  locale,
}: {
  messages: BookingMessages;
  locale: Locale;
}) {
  const [referenceCode, setReferenceCode] = useState("");
  const [email, setEmail] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cancelled, setCancelled] = useState<CancelResult | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!confirming) {
      setError(null);
      setConfirming(true);
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceCode: referenceCode.trim(), email: email.trim(), locale }),
      });
      const body = (await response.json()) as {
        success: boolean;
        data?: CancelResult;
        error?: { code?: string };
      };
      if (!response.ok || !body.success || !body.data) {
        if (body.error?.code === "ALREADY_CANCELLED") setError(messages.cancelAlreadyCancelled);
        else if (body.error?.code === "ALREADY_COMPLETED") setError(messages.cancelCompleted);
        else setError(messages.cancelNotFound);
        setConfirming(false);
        return;
      }
      setCancelled(body.data);
    } catch {
      setError(messages.errorGeneric);
      setConfirming(false);
    } finally {
      setPending(false);
    }
  }

  if (cancelled) {
    return (
      <div className="border border-line bg-surface p-6 sm:p-8">
        <h2 className="text-xl tracking-tight">{messages.cancelSuccess}</h2>
        <dl className="mt-6 space-y-3 border-t border-line pt-5 text-[14px]">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">{messages.serviceLabel}</dt>
            <dd className="font-medium">{cancelled.service}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">{messages.timeLabel}</dt>
            <dd className="font-medium tabular-nums">{formatVnDateTime(cancelled.startsAt, locale)}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">{messages.referenceCodeLabel}</dt>
            <dd className="font-mono font-semibold tracking-[0.12em]">{cancelled.referenceCode}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">{messages.flowerLabel}</dt>
            <dd>
              <span className="chip">🌸 {cancelled.flowerName}</span>
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border border-line bg-surface p-6 sm:p-8">
      <p className="text-[13px] leading-relaxed text-muted">{messages.cancelDescription}</p>
      {error && (
        <p role="alert" className="mt-5 border-l-2 border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="cancel-code">{messages.referenceCodeLabel}</label>
          <input
            id="cancel-code"
            type="text"
            required
            maxLength={16}
            autoComplete="off"
            placeholder="BK-7K2M9Q"
            value={referenceCode}
            onChange={(e) => setReferenceCode(e.target.value.toUpperCase())}
            className="field font-mono uppercase"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="cancel-email">{messages.email}</label>
          <input
            id="cancel-email"
            type="email"
            required
            maxLength={160}
            autoComplete="email"
            placeholder="ban@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
          />
        </div>
      </div>
      {confirming && (
        <p role="status" className="mt-5 border-l-2 border-warning bg-warning-soft px-3 py-2 text-[13px] text-warning">
          {messages.cancelSubmit} — {referenceCode.trim()} ({email.trim()})
        </p>
      )}
      <div className="mt-7 flex justify-end gap-2">
        {confirming && (
          <button type="button" className="btn btn-outline" onClick={() => setConfirming(false)}>
            {messages.back}
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? messages.submitting : confirming ? messages.cancelBooking : messages.cancelSubmit}
        </button>
      </div>
    </form>
  );
}
