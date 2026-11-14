"use client";

import { useState } from "react";
import Link from "next/link";
import { formatVnDateTime } from "@/lib/booking-time";
import { localeHref, type Locale } from "@/i18n/config";
import type { BookingMessages } from "@/i18n/messages/vi";

type LookupResult = {
  referenceCode: string;
  service: string;
  serviceSlug: string;
  startsAt: string;
  endsAt: string;
  startsAtLabel: string;
  name: string;
  email: string;
  phone: string;
  flowerCode: string;
  flowerName: string;
  status: string;
  createdAt: string;
  confirmationExpiresAt: string | null;
  canResendConfirmation: boolean;
};

type CancelResult = {
  referenceCode: string;
  service: string;
  startsAt: string;
  flowerCode: string;
  flowerName: string;
  status: string;
};

function statusLabel(status: string, messages: BookingMessages): string {
  switch (status) {
    case "pending":
      return messages.statusPending;
    case "confirmed":
      return messages.statusConfirmed;
    case "completed":
      return messages.statusCompleted;
    case "cancelled":
      return messages.statusCancelled;
    case "expired":
      return messages.statusExpired;
    default:
      return status;
  }
}

/**
 * Look up a booking by reference code + email, no login. Step 1 finds the
 * booking and shows its info card (service, time, contact, flower, current
 * status, confirmation deadline); step 2 offers the actions that fit the
 * status: resend the confirmation mail while pending, or cancel while
 * pending/confirmed. A wrong code OR a wrong email returns the same generic
 * message.
 */
export function BookingLookupForm({
  messages,
  locale,
}: {
  messages: BookingMessages;
  locale: Locale;
}) {
  const [referenceCode, setReferenceCode] = useState("");
  const [email, setEmail] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [cancelled, setCancelled] = useState<CancelResult | null>(null);
  const [resendPending, setResendPending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function submitLookup(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/bookings/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceCode: referenceCode.trim(), email: email.trim(), locale }),
      });
      const body = (await response.json()) as {
        success: boolean;
        data?: LookupResult;
        error?: { code?: string };
      };
      if (!response.ok || !body.success || !body.data) {
        setError(messages.cancelNotFound);
        return;
      }
      setLookup(body.data);
    } catch {
      setError(messages.errorGeneric);
    } finally {
      setPending(false);
    }
  }

  async function submitCancel() {
    if (!lookup) return;
    if (!confirmingCancel) {
      setError(null);
      setConfirmingCancel(true);
      return;
    }
    setError(null);
    setCancelPending(true);
    try {
      const response = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceCode: lookup.referenceCode, email: lookup.email, locale }),
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
        setConfirmingCancel(false);
        return;
      }
      setCancelled(body.data);
      setLookup(null);
    } catch {
      setError(messages.errorGeneric);
      setConfirmingCancel(false);
    } finally {
      setCancelPending(false);
    }
  }

  async function submitResend() {
    if (!lookup) return;
    setResendMessage(null);
    setError(null);
    setResendPending(true);
    try {
      const response = await fetch("/api/bookings/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceCode: lookup.referenceCode, email: lookup.email, locale }),
      });
      const body = (await response.json()) as { success: boolean; error?: { code?: string } };
      if (!response.ok || !body.success) {
        if (body.error?.code === "EXPIRED") setResendMessage(messages.resendExpired);
        else setResendMessage(messages.resendFailed);
        return;
      }
      setResendMessage(messages.resendSent);
    } catch {
      setResendMessage(messages.resendFailed);
    } finally {
      setResendPending(false);
    }
  }

  function reset() {
    setLookup(null);
    setCancelled(null);
    setError(null);
    setResendMessage(null);
    setConfirmingCancel(false);
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
        <div className="mt-8 flex flex-wrap gap-2">
          <Link href={localeHref(locale, "/dat-lich-khao-sat")} className="btn btn-primary btn-sm">
            {messages.bookAgain}
          </Link>
        </div>
      </div>
    );
  }

  if (lookup) {
    const cancellable = lookup.status === "pending" || lookup.status === "confirmed";
    return (
      <div className="border border-line bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl tracking-tight">{lookup.service}</h2>
          <span className="chip">{statusLabel(lookup.status, messages)}</span>
        </div>
        <dl className="mt-6 space-y-3 border-t border-line pt-5 text-[14px]">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">{messages.timeLabel}</dt>
            <dd className="font-medium tabular-nums">{lookup.startsAtLabel}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">{messages.name}</dt>
            <dd className="font-medium">{lookup.name}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">{messages.email}</dt>
            <dd className="font-medium">{lookup.email}</dd>
          </div>
          {lookup.phone && (
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted">{messages.phone}</dt>
              <dd className="font-medium tabular-nums">{lookup.phone}</dd>
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">{messages.referenceCodeLabel}</dt>
            <dd className="font-mono font-semibold tracking-[0.12em]">{lookup.referenceCode}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted">{messages.flowerLabel}</dt>
            <dd>
              <span className="chip">🌸 {lookup.flowerName}</span>
            </dd>
          </div>
          {lookup.status === "pending" && lookup.confirmationExpiresAt && (
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted">{messages.confirmDeadline}</dt>
              <dd className="font-medium tabular-nums">
                {formatVnDateTime(lookup.confirmationExpiresAt, locale)}
              </dd>
            </div>
          )}
        </dl>

        {error && (
          <p role="alert" className="mt-5 border-l-2 border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        )}
        {resendMessage && (
          <p role="status" className="mt-5 border-l-2 border-line bg-surface px-3 py-2 text-[13px]">
            {resendMessage}
          </p>
        )}
        {confirmingCancel && (
          <p role="status" className="mt-5 border-l-2 border-warning bg-warning-soft px-3 py-2 text-[13px] text-warning">
            {messages.cancelSubmit} — {lookup.referenceCode} ({lookup.email})
          </p>
        )}

        <div className="mt-7 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-outline" onClick={reset}>
            {messages.lookupAgain}
          </button>
          {lookup.canResendConfirmation && (
            <button type="button" className="btn btn-outline" onClick={submitResend} disabled={resendPending}>
              {resendPending ? messages.submitting : messages.resendConfirmation}
            </button>
          )}
          {cancellable && (
            <>
              {confirmingCancel && (
                <button type="button" className="btn btn-outline" onClick={() => setConfirmingCancel(false)}>
                  {messages.back}
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={submitCancel} disabled={cancelPending}>
                {cancelPending ? messages.submitting : messages.cancelBooking}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submitLookup} className="border border-line bg-surface p-6 sm:p-8">
      <p className="text-[13px] leading-relaxed text-muted">{messages.cancelDescription}</p>
      {error && (
        <p role="alert" className="mt-5 border-l-2 border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="lookup-code">{messages.referenceCodeLabel}</label>
          <input
            id="lookup-code"
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
          <label className="field-label" htmlFor="lookup-email">{messages.email}</label>
          <input
            id="lookup-email"
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
      <div className="mt-7 flex justify-end gap-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? messages.submitting : messages.cancelSubmit}
        </button>
      </div>
    </form>
  );
}
