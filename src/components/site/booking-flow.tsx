"use client";

import { useEffect, useRef, useState } from "react";
import { formatVnDateTime } from "@/lib/booking-time";
import type { IntakeQuestion, BookingThemeData } from "@/server/queries/bookings";
import type { BookingMessages } from "@/i18n/messages/vi";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { answerValueToPayload } from "./survey-question-field";
import { BookingSlotPicker } from "./booking-slot-picker";
import { BookingIntakeForm, type IntakeAnswers } from "./booking-intake-form";
import { BookingCompletion, type BookingConfirmation } from "./booking-completion";
import { resolveBookingBadge } from "./booking-intro";

type Step = "slot" | "contact" | "intake" | "review" | "done";

/**
 * Public booking wizard: slot picker (safe DTO — booked slots show only the
 * flower name) -> contact form (name + phone + email REQUIRED, notes
 * optional; contact is collected only so the consultant can reach the
 * visitor) -> intake survey (C's question renderer) -> review/confirm ->
 * completion screen with booking code + the visitor's own flower badge.
 */
export function BookingFlow({
  service,
  intake,
  theme,
  locale,
  messages,
}: {
  service: { slug: string; name: string; description: string; durationMinutes: number };
  intake: { title: string; questions: IntakeQuestion[] } | null;
  theme: BookingThemeData;
  locale: Locale;
  messages: BookingMessages;
}) {
  const surveyMessages = getDictionary(locale).survey;
  const [step, setStep] = useState<Step>("slot");
  const [slots, setSlots] = useState<import("@/server/queries/bookings").PublicSlotDto[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const startedAtRef = useRef(Date.now());

  async function loadSlots() {
    setSlotsError(null);
    try {
      const response = await fetch(
        `/api/booking/slots?service=${encodeURIComponent(service.slug)}&locale=${locale}`,
      );
      const body = (await response.json()) as {
        success: boolean;
        data?: import("@/server/queries/bookings").PublicSlotDto[];
      };
      if (!response.ok || !body.success || !Array.isArray(body.data)) {
        setSlotsError(messages.errorGeneric);
        return;
      }
      setSlots(body.data);
    } catch {
      setSlotsError(messages.errorGeneric);
    }
  }

  useEffect(() => {
    void loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSlot = slots?.find((slot) => slot.slotId === selectedSlotId) ?? null;
  const hasIntake = intake !== null && intake.questions.length > 0;
  const nextAfterContact: Step = hasIntake ? "intake" : "review";

  function intakeValid(): boolean {
    if (!intake) return true;
    return intake.questions.every((question) => {
      if (!question.required) return true;
      const answer = answers[question.id];
      return Boolean(answer && (answer.value.trim().length > 0 || answer.optionValues.length > 0));
    });
  }

  function contactValid(): boolean {
    return (
      name.trim().length >= 2 &&
      phone.trim().length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    );
  }

  async function submit() {
    if (!selectedSlot) {
      setError(messages.chooseSlotFirst);
      setStep("slot");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Omit unanswered questions from the payload (the server validator
      // treats an absent question as unanswered; empty answer objects for
      // optional choice questions are rejected by zod).
      const payloadAnswers = (intake?.questions ?? [])
        .map((question) => answerValueToPayload(question, answers[question.id] ?? { value: "", optionValues: [] }))
        .filter((item): item is NonNullable<typeof item> => item !== null);
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          notes: notes.trim(),
          slotId: selectedSlot.slotId,
          serviceSlug: service.slug,
          answers: payloadAnswers,
          website: "",
          startedAt: startedAtRef.current,
          locale,
        }),
      });
      const body = (await response.json()) as {
        success: boolean;
        data?: BookingConfirmation;
        error?: { code?: string; message?: string };
      };
      if (!response.ok || !body.success || !body.data) {
        const code = body.error?.code;
        if (code === "SLOT_TAKEN") {
          setError(messages.slotTaken);
          await loadSlots();
          setSelectedSlotId(null);
          setStep("slot");
        } else if (code === "FLOWERS_EXHAUSTED") {
          setError(messages.flowersExhausted);
        } else if (code === "SURVEY_CLOSED") {
          setError(messages.surveyClosed);
        } else if (code === "RATE_LIMITED") {
          setError(messages.rateLimited);
        } else {
          setError(messages.errorGeneric);
        }
        return;
      }
      setConfirmation(body.data);
      setStep("done");
    } catch {
      setError(messages.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done" && confirmation && selectedSlot) {
    const badge = resolveBookingBadge(theme);
    return (
      <BookingCompletion
        confirmation={confirmation}
        serviceName={service.name}
        startsAtLabel={formatVnDateTime(selectedSlot.startsAt, locale)}
        badgeFromColor={badge.fromColor}
        badgeToColor={badge.toColor}
        messages={messages}
        locale={locale}
      />
    );
  }

  return (
    <div
      className="border border-line bg-[var(--survey-surface)] p-6 sm:p-8"
      style={{ borderRadius: "var(--survey-radius)" }}
    >
      {error && (
        <p role="alert" className="mb-6 border-l-2 border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}

      {step === "slot" && (
        <section>
          <h2 className="text-xl tracking-tight">{messages.pickSlot}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{messages.pickSlotHint}</p>
          <div className="mt-6">
            {slots === null ? (
              <p className="text-sm text-muted">…</p>
            ) : slotsError ? (
              <p role="alert" className="text-[13px] text-danger">{slotsError}</p>
            ) : (
              <BookingSlotPicker
                slots={slots}
                selectedSlotId={selectedSlotId}
                onSelect={setSelectedSlotId}
                messages={messages}
                locale={locale}
              />
            )}
          </div>
          <div className="mt-7 flex justify-end">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedSlotId}
              onClick={() => setStep("contact")}
            >
              {messages.continue}
            </button>
          </div>
        </section>
      )}

      {step === "contact" && (
        <section>
          <h2 className="text-xl tracking-tight">{messages.contactTitle}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{messages.contactPurpose}</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="booking-name">{messages.name}</label>
              <input id="booking-name" type="text" required minLength={2} maxLength={80} autoComplete="name"
                placeholder={messages.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} className="field" />
            </div>
            <div>
              <label className="field-label" htmlFor="booking-phone">{messages.phone}</label>
              <input id="booking-phone" type="tel" required maxLength={40} autoComplete="tel"
                placeholder={messages.phonePlaceholder} value={phone} onChange={(e) => setPhone(e.target.value)} className="field" />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="booking-email">{messages.email}</label>
              <input id="booking-email" type="email" required maxLength={160} autoComplete="email"
                placeholder={messages.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="booking-notes">{messages.notes}</label>
              <textarea id="booking-notes" rows={3} maxLength={1000}
                placeholder={messages.notesPlaceholder} value={notes} onChange={(e) => setNotes(e.target.value)} className="field resize-y" />
            </div>
          </div>
          {!contactValid() && (
            <p className="mt-4 text-[12px] text-danger">{messages.contactRequiredNote}</p>
          )}
          <div className="mt-7 flex justify-between">
            <button type="button" className="btn btn-outline" onClick={() => setStep("slot")}>{messages.back}</button>
            <button type="button" className="btn btn-primary" disabled={!contactValid()} onClick={() => setStep(nextAfterContact)}>
              {messages.continue}
            </button>
          </div>
        </section>
      )}

      {step === "intake" && intake && (
        <section>
          <h2 className="text-xl tracking-tight">{messages.intakeTitle}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{intake.title} — {messages.intakeHint}</p>
          <div className="mt-6">
            <BookingIntakeForm questions={intake.questions} answers={answers} onChange={setAnswers} messages={surveyMessages} />
          </div>
          {!intakeValid() && (
            <p className="mt-4 text-[12px] text-danger">{messages.answerRequired}</p>
          )}
          <div className="mt-7 flex justify-between">
            <button type="button" className="btn btn-outline" onClick={() => setStep("contact")}>{messages.back}</button>
            <button type="button" className="btn btn-primary" disabled={!intakeValid()} onClick={() => setStep("review")}>
              {messages.continue}
            </button>
          </div>
        </section>
      )}

      {step === "review" && selectedSlot && (
        <section>
          <h2 className="text-xl tracking-tight">{messages.reviewTitle}</h2>
          <dl className="mt-6 space-y-3 border-t border-line pt-5 text-[14px]">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted">{messages.serviceLabel}</dt>
              <dd className="font-medium">{service.name}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted">{messages.timeLabel}</dt>
              <dd className="font-medium tabular-nums">{formatVnDateTime(selectedSlot.startsAt, locale)}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted">{messages.name}</dt>
              <dd className="font-medium">{name.trim()}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted">{messages.phone}</dt>
              <dd className="font-medium">{phone.trim()}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted">{messages.email}</dt>
              <dd className="font-medium">{email.trim()}</dd>
            </div>
            {intake && intake.questions.length > 0 && (
              <div className="border-t border-line pt-3">
                <dt className="text-muted">{messages.intakeTitle}</dt>
                <dd className="mt-2 space-y-1.5">
                  {intake.questions.map((question) => {
                    const answer = answers[question.id];
                    if (!answer) return null;
                    const display =
                      answer.optionValues.length > 0
                        ? answer.optionValues
                            .map((v) => question.options.find((o) => o.value === v)?.label ?? v)
                            .join(", ")
                        : answer.value;
                    if (!display) return null;
                    return (
                      <p key={question.id} className="text-[13px] leading-relaxed">
                        <span className="text-muted">{question.title}: </span>
                        {display}
                      </p>
                    );
                  })}
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-7 flex justify-between">
            <button type="button" className="btn btn-outline" onClick={() => setStep(hasIntake ? "intake" : "contact")}>
              {messages.back}
            </button>
            <button type="button" className="btn btn-primary" disabled={submitting} onClick={() => void submit()}>
              {submitting ? messages.submitting : messages.confirmBooking}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
