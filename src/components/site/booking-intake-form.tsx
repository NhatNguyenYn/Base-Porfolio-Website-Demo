"use client";

import type { IntakeQuestion } from "@/server/queries/bookings";
import type { SurveyMessages } from "@/i18n/messages/vi";
import {
  SurveyQuestionField,
  emptyAnswerValue,
  type SurveyAnswerValue,
} from "./survey-question-field";

export type IntakeAnswers = Record<string, SurveyAnswerValue>;

/**
 * Intake-survey step of the booking flow. Renders each question with Agent C's
 * SurveyQuestionField (read-only reuse) so the booking intake and the
 * standalone survey render identically. Answers are kept in one state object,
 * so going back never loses them.
 */
export function BookingIntakeForm({
  questions,
  answers,
  onChange,
  messages,
}: {
  questions: IntakeQuestion[];
  answers: IntakeAnswers;
  onChange: (next: IntakeAnswers) => void;
  messages: SurveyMessages;
}) {
  return (
    <div className="space-y-7">
      {questions.map((question) => {
        const value = answers[question.id] ?? emptyAnswerValue();
        return (
          <div key={question.id} className="border-t border-line pt-6 first:border-t-0 first:pt-0">
            <SurveyQuestionField
              question={question}
              value={value}
              onChange={(next) => onChange({ ...answers, [question.id]: next })}
              error={null}
              messages={messages}
              disabled={false}
            />
          </div>
        );
      })}
    </div>
  );
}
