"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { submitContactMessage, type ContactState } from "@/server/actions/contact";
import type { Dictionary } from "@/i18n";

const initialState: ContactState = { ok: false, message: "" };

export function ContactForm({ dict }: { dict: Dictionary }) {
  const [state, action, pending] = useActionState(submitContactMessage, initialState);
  const [startedAt, setStartedAt] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    setStartedAt(String(Date.now()));
  }, []);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  if (state.success) {
    return (
      <div className="border border-line bg-surface p-8">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-accent-soft text-accent">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h2 className="mt-5 text-xl tracking-tight">{dict.contact.formTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{dict.contact.success}</p>
      </div>
    );
  }

  const globalError =
    state.message === "rate_limited"
      ? dict.contact.rateLimited
      : !state.ok && state.message
        ? dict.contact.error
        : null;

  const errorFor = (field: string) => {
    const errors = state.fieldErrors?.[field];
    if (!errors?.length) return null;
    if (field === "email") return dict.contact.invalidEmail;
    if (field === "message") return dict.contact.tooShort;
    return dict.contact.required;
  };

  return (
    <form ref={formRef} action={action} className="border border-line bg-surface p-6 sm:p-8" noValidate={false}>
      <h2 className="text-xl tracking-tight">{dict.contact.formTitle}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{dict.contact.privacy}</p>

      {globalError && (
        <p
          role="alert"
          className="mt-5 border-l-2 border-[#c0392b] bg-[#c0392b]/5 px-3 py-2 text-[13px] text-[#c0392b]"
        >
          {globalError}
        </p>
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="contact-name">
            {dict.contact.name}
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
            placeholder={dict.contact.namePlaceholder}
            className="field"
            aria-invalid={Boolean(errorFor("name"))}
            aria-describedby={errorFor("name") ? "contact-name-error" : undefined}
          />
          {errorFor("name") && (
            <p id="contact-name-error" className="mt-1.5 text-[11px] text-[#c0392b]">
              {errorFor("name")}
            </p>
          )}
        </div>

        <div>
          <label className="field-label" htmlFor="contact-email">
            {dict.contact.email}
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            maxLength={160}
            autoComplete="email"
            placeholder={dict.contact.emailPlaceholder}
            className="field"
            aria-invalid={Boolean(errorFor("email"))}
            aria-describedby={errorFor("email") ? "contact-email-error" : undefined}
          />
          {errorFor("email") && (
            <p id="contact-email-error" className="mt-1.5 text-[11px] text-[#c0392b]">
              {errorFor("email")}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="contact-subject">
            {dict.contact.subject}
          </label>
          <input
            id="contact-subject"
            name="subject"
            type="text"
            required
            minLength={3}
            maxLength={140}
            placeholder={dict.contact.subjectPlaceholder}
            className="field"
            aria-invalid={Boolean(errorFor("subject"))}
            aria-describedby={errorFor("subject") ? "contact-subject-error" : undefined}
          />
          {errorFor("subject") && (
            <p id="contact-subject-error" className="mt-1.5 text-[11px] text-[#c0392b]">
              {errorFor("subject")}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="contact-message">
            {dict.contact.message}
          </label>
          <textarea
            id="contact-message"
            name="message"
            required
            minLength={20}
            maxLength={4000}
            rows={6}
            placeholder={dict.contact.messagePlaceholder}
            className="field resize-y"
            aria-invalid={Boolean(errorFor("message"))}
            aria-describedby={errorFor("message") ? "contact-message-error" : undefined}
          />
          {errorFor("message") && (
            <p id="contact-message-error" className="mt-1.5 text-[11px] text-[#c0392b]">
              {errorFor("message")}
            </p>
          )}
        </div>
      </div>

      {/* Honeypot + timing signal for basic spam protection */}
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <input type="hidden" name="startedAt" value={startedAt} />

      <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-[24ch] text-[10px] uppercase tracking-[0.12em] text-muted">
          {dict.contact.availabilityLabel}: {dict.home.availability}
        </p>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? dict.contact.sending : dict.contact.submit}
          {!pending && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}
