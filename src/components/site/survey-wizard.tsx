// Public survey wizard (Phase 10, Agent C).
//
// Flow: intro → one step per section (questions validated before advancing)
// → submit → completion screen (only after the backend confirms storage).
// Answers are kept in a single state object, so going back never loses them.
// Per-step validation reuses the same pure validator as the server
// (src/lib/survey-response-validation.ts), so client and server agree on
// what "required" and "valid" mean.
//
// Anti-spam, copied from the contact form: a hidden honeypot field
// ("website", always empty for humans) and a `startedAt` timestamp set when
// the wizard mounts. Both travel in the JSON submit payload; the server
// silently fakes success for bots that trip either check.
"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { PublicSurvey } from "@/data/surveys";
import { assetUrl } from "@/lib/asset";
import { interpolate } from "@/lib/utils";
import type { SurveyMessages } from "@/i18n/messages/vi";
import { validateSurveyAnswers } from "@/lib/survey-response-validation";
import { SurveyTheme } from "./survey-theme";
import { SurveyIntro } from "./survey-intro";
import {
  answerValueToPayload,
  emptyAnswerValue,
  SurveyQuestionField,
  type SurveyAnswerValue,
} from "./survey-question-field";
import { SurveyCompletion } from "./survey-completion";

type WizardPhase = "intro" | "questions" | "done";

export function SurveyWizard({
  survey,
  messages,
  locale,
  homeHref,
  brand,
}: {
  survey: PublicSurvey;
  messages: SurveyMessages;
  locale: string;
  homeHref: string;
  /** Brand header: survey brand, or the site brand when the survey sets none. */
  brand: { name: string; logoUrl: string | null };
}) {
  const steps = survey.steps;
  const [phase, setPhase] = useState<WizardPhase>("intro");
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, SurveyAnswerValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Server timestamp at mount: a client clock offset must not look like a bot.
  const startedAtRef = useRef<number>(Date.now());

  const totalSteps = steps.length;
  const currentStep = steps[stepIndex];
  const progress = useMemo(() => {
    if (phase === "done") return 1;
    if (phase === "intro" || totalSteps === 0) return 0;
    return stepIndex / totalSteps;
  }, [phase, stepIndex, totalSteps]);

  const setAnswer = (questionId: string, next: SurveyAnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: next }));
    setErrors((prev) => {
      if (!prev[questionId]) return prev;
      const { [questionId]: _removed, ...rest } = prev;
      return rest;
    });
  };

  /** Validate only the questions of the current step. Returns true when the step may advance. */
  const validateStep = (index: number): boolean => {
    const step = steps[index];
    if (!step) return true;
    const payload = step.questions
      .map((question) =>
        answerValueToPayload(question, answers[question.id] ?? emptyAnswerValue()),
      )
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const result = validateSurveyAnswers(step.questions, payload);
    if (result.ok) {
      setErrors({});
      return true;
    }
    const nextErrors: Record<string, string> = {};
    for (const error of result.errors) {
      nextErrors[error.questionId] = error.message;
    }
    setErrors(nextErrors);
    return false;
  };

  const goNext = () => {
    if (!validateStep(stepIndex)) return;
    setGlobalError(null);
    if (stepIndex + 1 < totalSteps) {
      setStepIndex(stepIndex + 1);
    } else {
      void submit();
    }
  };

  const goBack = () => {
    setGlobalError(null);
    setErrors({});
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
    else setPhase("intro");
  };

  const submit = async () => {
    // Final client-side pass over every question before sending.
    const payload = survey.questions
      .map((question) =>
        answerValueToPayload(question, answers[question.id] ?? emptyAnswerValue()),
      )
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const check = validateSurveyAnswers(survey.questions, payload);
    if (!check.ok) {
      const nextErrors: Record<string, string> = {};
      for (const error of check.errors) nextErrors[error.questionId] = error.message;
      setErrors(nextErrors);
      // Jump to the first step containing an error so the respondent sees it.
      const badIndex = steps.findIndex((step) =>
        step.questions.some((question) => nextErrors[question.id]),
      );
      if (badIndex >= 0) setStepIndex(badIndex);
      setGlobalError(messages.invalidAnswer);
      return;
    }

    setSubmitting(true);
    setGlobalError(null);
    try {
      const response = await fetch(`/api/surveys/${encodeURIComponent(survey.slug)}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: survey.slug,
          locale,
          website: "",
          startedAt: startedAtRef.current,
          answers: payload,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: { code?: string; details?: { errors?: { questionId: string; message: string }[] } };
      } | null;
      if (!response.ok || !body?.success) {
        const code = body?.error?.code;
        if (code === "RATE_LIMITED") setGlobalError(messages.errorRateLimited);
        else if (code === "SURVEY_CLOSED") setGlobalError(messages.errorClosed);
        else if (code === "DUPLICATE_RESPONSE") setGlobalError(messages.errorDuplicate);
        else if (code === "INVALID_ANSWERS" && body?.error?.details?.errors) {
          const nextErrors: Record<string, string> = {};
          for (const error of body.error.details.errors) {
            if (error.questionId) nextErrors[error.questionId] = error.message;
          }
          setErrors(nextErrors);
          const badIndex = steps.findIndex((step) =>
            step.questions.some((question) => nextErrors[question.id]),
          );
          if (badIndex >= 0) setStepIndex(badIndex);
          setGlobalError(messages.invalidAnswer);
        } else {
          setGlobalError(messages.errorGeneric);
        }
        return;
      }
      setPhase("done");
    } catch {
      setGlobalError(messages.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  const progressPercent = Math.round(progress * 100);
  const theme = survey.theme;

  return (
    <SurveyTheme theme={theme}>
      <div
        className="border border-line bg-[var(--survey-background)] px-4 py-8 sm:px-8 sm:py-10"
        style={{ borderRadius: "var(--survey-radius)" }}
      >
        {phase !== "done" && (
          <SurveyProgress
            style={theme.progressStyle}
            current={phase === "intro" ? 0 : stepIndex + 1}
            total={totalSteps}
            percent={progressPercent}
            messages={messages}
            onGoToStep={(index) => {
              // Only allow jumping back to an already-visited step.
              if (index < stepIndex) {
                setStepIndex(index);
                setErrors({});
                setGlobalError(null);
              }
            }}
          />
        )}

        {phase === "intro" && (
          <div className="mt-2">
            <SurveyIntro
              survey={survey}
              messages={messages}
              brandName={brand.name}
              brandLogoUrl={brand.logoUrl}
              onStart={() => setPhase("questions")}
            />
            {theme.layout === "split" && survey.cover && (
              <div className="relative mt-8 min-h-56 overflow-hidden border border-line bg-surface-muted">
                <Image
                  src={assetUrl(survey.cover.url)}
                  alt={survey.cover.alt || survey.title}
                  fill
                  sizes="(min-width: 1024px) 480px, 92vw"
                  className="object-cover"
                />
              </div>
            )}
          </div>
        )}

        {phase === "questions" && currentStep && (
          <div className="mt-8 min-w-0">
            {(currentStep.title || currentStep.description) && (
              <div className="mb-6 border-b border-line pb-5">
                {currentStep.title && (
                  <h2 className="text-xl tracking-tight text-[var(--survey-text)]">{currentStep.title}</h2>
                )}
                {currentStep.description && (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                    {currentStep.description}
                  </p>
                )}
              </div>
            )}

            {globalError && (
              <p role="alert" className="mb-6 border-l-2 border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger">
                {globalError}
              </p>
            )}

            <div className="grid gap-8">
              {currentStep.questions.map((question) => (
                <SurveyQuestionField
                  key={question.id}
                  question={question}
                  value={answers[question.id] ?? emptyAnswerValue()}
                  onChange={(next) => setAnswer(question.id, next)}
                  error={errors[question.id] ?? null}
                  messages={messages}
                  disabled={submitting}
                />
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
              <button
                type="button"
                onClick={goBack}
                disabled={submitting}
                className="btn btn-outline"
              >
                {messages.back}
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={submitting}
                className="btn btn-primary"
              >
                {submitting
                  ? messages.submitting
                  : stepIndex + 1 < totalSteps
                    ? messages.next
                    : messages.submit}
              </button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="mt-8">
            <SurveyCompletion
              title={survey.title}
              completionMessage={survey.completionMessage}
              messages={messages}
              homeHref={homeHref}
              badgeText={survey.title}
              badgeFromColor={survey.theme.badgeFromColor}
              badgeToColor={survey.theme.badgeToColor}
            />
          </div>
        )}
      </div>
    </SurveyTheme>
  );
}

function SurveyProgress({
  style,
  current,
  total,
  percent,
  messages,
  onGoToStep,
}: {
  style: PublicSurvey["theme"]["progressStyle"];
  /** 1-based current step; 0 on the intro. */
  current: number;
  total: number;
  percent: number;
  messages: SurveyMessages;
  onGoToStep: (index: number) => void;
}) {
  if (total === 0) return null;
  return (
    <div aria-label={messages.progressLabel}>
      {style === "bar" && (
        <div
          className="h-1.5 w-full overflow-hidden bg-line"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={messages.progressLabel}
          style={{ borderRadius: "var(--survey-radius)" }}
        >
          <div
            className="h-full bg-[var(--survey-primary)] transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {style === "dots" && (
        <div className="flex items-center gap-2" role="list" aria-label={messages.progressLabel}>
          {Array.from({ length: total }, (_item, index) => {
            const done = index < current;
            const active = index === current - 1 || (current === 0 && index === 0);
            return (
              <button
                key={index}
                type="button"
                role="listitem"
                aria-label={interpolate(messages.stepOf, { current: index + 1, total })}
                aria-current={active ? "step" : undefined}
                onClick={() => onGoToStep(index)}
                className={`h-2.5 rounded-full transition-[width] duration-300 motion-reduce:transition-none ${
                  done || active ? "w-8 bg-[var(--survey-primary)]" : "w-2.5 bg-line"
                }`}
              />
            );
          })}
        </div>
      )}
      {style === "steps" && (
        <ol className="flex flex-wrap items-center gap-2">
          {Array.from({ length: total }, (_item, index) => {
            const done = index < current;
            const active = index === current - 1 || (current === 0 && index === 0);
            return (
              <li key={index} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onGoToStep(index)}
                  aria-current={active ? "step" : undefined}
                  aria-label={interpolate(messages.stepOf, { current: index + 1, total })}
                  className={`grid h-8 w-8 place-items-center border text-[13px] font-medium tabular-nums ${
                    done || active
                      ? "border-[var(--survey-primary)] bg-[var(--survey-primary)] text-white"
                      : "border-line bg-[var(--survey-surface)] text-muted"
                  }`}
                  style={{ borderRadius: "var(--survey-radius)" }}
                >
                  {done ? "✓" : index + 1}
                </button>
                {index + 1 < total && <span className="h-px w-4 bg-line sm:w-8" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-3 text-[12px] tabular-nums text-muted">
        {current === 0
          ? interpolate(messages.stepOf, { current: 1, total })
          : interpolate(messages.stepOf, { current, total })}
      </p>
    </div>
  );
}
