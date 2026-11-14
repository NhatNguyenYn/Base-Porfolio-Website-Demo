// Central limits for the Custom Survey System (Phase 10).
// Question/option counts are enforced in zod (src/lib/validation.ts) AND
// re-checked server-side before insert; answer length is enforced per answer
// row in the route handler, not just the UI.

export const MAX_SECTIONS_PER_SURVEY = 10;
export const MAX_QUESTIONS_PER_SURVEY = 100;
export const MAX_OPTIONS_PER_QUESTION = 20;
export const MAX_QUESTION_TITLE = 300;
export const MAX_OPTION_LABEL = 200;
export const MAX_SHORT_TEXT_ANSWER = 500;
export const MAX_LONG_TEXT_ANSWER = 5000;
export const MAX_SURVEY_RESPONSE_JSON_BYTES = 256 * 1024; // enforced by Content-Length check in the POST handler
export const MAX_RATING = 10; // rating scale 1–10
export const NPS_MIN = 0;
export const NPS_MAX = 10;
