import { z } from "zod";

import { BOOKING_SLOT_DURATIONS_MINUTES, MAX_BOOKING_NOTES } from "@/lib/booking-limits";
import {
  MAX_LONG_TEXT_ANSWER,
  MAX_OPTIONS_PER_QUESTION,
  MAX_OPTION_LABEL,
  MAX_QUESTIONS_PER_SURVEY,
  MAX_QUESTION_TITLE,
  MAX_RATING,
  MAX_SHORT_TEXT_ANSWER,
  NPS_MAX,
  NPS_MIN,
} from "@/lib/survey-limits";

export type FieldErrors = Record<string, string[]>;

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    result[key] = [...(result[key] ?? []), issue.message];
  }
  return result;
}

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || /^https?:\/\/\S+$/i.test(value), {
    message: "Must be a valid http(s) URL",
  });

const slugField = z
  .string()
  .trim()
  .max(90)
  .optional()
  .transform((value) => (value ? value : undefined));

const idField = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.email("Enter a valid email address").max(160),
  subject: z.string().trim().min(3, "Add a short subject").max(140),
  message: z.string().trim().min(20, "Tell me a little more (20 characters minimum)").max(4000),
  // Honeypot: real visitors never fill this in.
  website: z.string().max(0).optional().or(z.literal("")),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email address").max(160),
  password: z.string().min(1, "Password is required").max(200),
  next: z.string().max(300).optional(),
});

export const setupSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.email().max(160),
    password: z
      .string()
      .min(10, "Use at least 10 characters")
      .max(200)
      .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
        message: "Include at least one letter and one number",
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(10, "Use at least 10 characters")
      .max(200)
      .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
        message: "Include at least one letter and one number",
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const projectTranslation = z.object({
  name: z.string().trim().max(160).optional().default(""),
  shortDescription: z.string().trim().max(400).optional().default(""),
  fullDescription: z.string().max(60000).optional().default(""),
  role: z.string().trim().max(160).optional().default(""),
});

export const projectSchema = z.object({
  id: idField,
  slug: slugField,
  status: z.enum(["completed", "in_progress", "archived"]).default("completed"),
  visibility: z.enum(["public", "private"]).default("public"),
  featured: z.boolean().default(false),
  order: z.coerce.number().int().min(0).max(9999).default(0),
  startDate: optionalDate,
  completionDate: optionalDate,
  githubUrl: optionalUrl,
  demoUrl: optionalUrl,
  thumbnailMediaId: idField,
  technologies: z.string().max(600).optional().default(""),
  gallery: z.string().max(4000).optional().default(""),
  vi: projectTranslation,
  en: projectTranslation,
});

export const articleSchema = z.object({
  id: idField,
  slug: slugField,
  categoryId: idField,
  coverMediaId: idField,
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  template: z.enum(["default", "editorial"]).default("default"),
  visibility: z.enum(["public", "private"]).default("public"),
  featured: z.boolean().default(false),
  scheduledFor: optionalDate,
  tags: z.string().max(600).optional().default(""),
  vi: z.object({
    title: z.string().trim().max(180).optional().default(""),
    subtitle: z.string().trim().max(220).optional().default(""),
    excerpt: z.string().trim().max(400).optional().default(""),
    content: z.string().max(120000).optional().default(""),
    seoTitle: z.string().trim().max(180).optional().default(""),
    seoDescription: z.string().trim().max(320).optional().default(""),
  }),
  en: z.object({
    title: z.string().trim().max(180).optional().default(""),
    subtitle: z.string().trim().max(220).optional().default(""),
    excerpt: z.string().trim().max(400).optional().default(""),
    content: z.string().max(120000).optional().default(""),
    seoTitle: z.string().trim().max(180).optional().default(""),
    seoDescription: z.string().trim().max(320).optional().default(""),
  }),
});

export const artworkSchema = z.object({
  id: idField,
  slug: slugField,
  imageMediaId: z.string().trim().min(1, "Select an image for the artwork"),
  collectionId: idField,
  categoryId: idField,
  medium: z.string().trim().max(200).optional().default(""),
  createdDate: optionalDate,
  featured: z.boolean().default(false),
  visibility: z.enum(["public", "private"]).default("public"),
  order: z.coerce.number().int().min(0).max(9999).default(0),
  tags: z.string().max(400).optional().default(""),
  vi: z.object({
    title: z.string().trim().max(160).optional().default(""),
    description: z.string().max(20000).optional().default(""),
  }),
  en: z.object({
    title: z.string().trim().max(160).optional().default(""),
    description: z.string().max(20000).optional().default(""),
  }),
});

export const collectionSchema = z.object({
  id: idField,
  slug: slugField,
  coverMediaId: idField,
  featured: z.boolean().default(false),
  visibility: z.enum(["public", "private"]).default("public"),
  order: z.coerce.number().int().min(0).max(9999).default(0),
  vi: z.object({ name: z.string().trim().max(160).optional().default(""), description: z.string().max(4000).optional().default("") }),
  en: z.object({ name: z.string().trim().max(160).optional().default(""), description: z.string().max(4000).optional().default("") }),
});

export const profileSchema = z.object({
  email: z.email("Enter a valid email address").max(160),
  phone: z.string().trim().max(40).optional().default(""),
  location: z.string().trim().max(120).optional().default(""),
  resumeUrl: optionalUrl,
  availableForWork: z.boolean().default(true),
  avatarMediaId: idField,
  vi: z.object({
    fullName: z.string().trim().min(1, "Name is required").max(120),
    title: z.string().trim().min(1, "Title is required").max(160),
    shortBio: z.string().trim().min(1, "Short bio is required").max(400),
    longBio: z.string().max(30000).optional().default(""),
    interests: z.string().max(4000).optional().default(""),
    philosophy: z.string().max(10000).optional().default(""),
    futureGoals: z.string().max(10000).optional().default(""),
    seoTitle: z.string().trim().max(180).optional().default(""),
    seoDescription: z.string().trim().max(320).optional().default(""),
  }),
  en: z.object({
    fullName: z.string().trim().max(120).optional().default(""),
    title: z.string().trim().max(160).optional().default(""),
    shortBio: z.string().trim().max(400).optional().default(""),
    longBio: z.string().max(30000).optional().default(""),
    interests: z.string().max(4000).optional().default(""),
    philosophy: z.string().max(10000).optional().default(""),
    futureGoals: z.string().max(10000).optional().default(""),
    seoTitle: z.string().trim().max(180).optional().default(""),
    seoDescription: z.string().trim().max(320).optional().default(""),
  }),
});

export const educationSchema = z.object({
  id: idField,
  institution: z.string().trim().min(1).max(160),
  location: z.string().trim().max(120).optional().default(""),
  startYear: z.coerce.number().int().min(1950).max(2100),
  endYear: z.string().trim().optional().default(""),
  isCurrent: z.boolean().default(false),
  order: z.coerce.number().int().min(0).max(999).default(0),
  visible: z.boolean().default(true),
  vi: z.object({ degree: z.string().trim().max(160).optional().default(""), field: z.string().trim().max(160).optional().default(""), description: z.string().max(2000).optional().default("") }),
  en: z.object({ degree: z.string().trim().max(160).optional().default(""), field: z.string().trim().max(160).optional().default(""), description: z.string().max(2000).optional().default("") }),
});

export const experienceSchema = z.object({
  id: idField,
  company: z.string().trim().min(1).max(160),
  location: z.string().trim().max(120).optional().default(""),
  startDate: z.string().trim().min(1, "Start date is required"),
  endDate: optionalDate,
  isCurrent: z.boolean().default(false),
  order: z.coerce.number().int().min(0).max(999).default(0),
  visible: z.boolean().default(true),
  vi: z.object({ role: z.string().trim().max(160).optional().default(""), summary: z.string().max(2000).optional().default(""), achievements: z.string().max(4000).optional().default("") }),
  en: z.object({ role: z.string().trim().max(160).optional().default(""), summary: z.string().max(2000).optional().default(""), achievements: z.string().max(4000).optional().default("") }),
});

export const skillSchema = z.object({
  id: idField,
  name: z.string().trim().min(1, "Name is required").max(80),
  category: z.enum(["engineering", "design", "art", "tools"]).default("engineering"),
  level: z.coerce.number().int().min(1).max(5).default(3),
  order: z.coerce.number().int().min(0).max(999).default(0),
  visible: z.boolean().default(true),
});

export const socialLinkSchema = z.object({
  id: idField,
  platform: z.enum(["github", "linkedin", "facebook", "instagram", "behance", "dribbble", "x", "email", "other"]).default("other"),
  url: z.string().trim().min(1, "URL is required").max(400),
  label: z.string().trim().max(80).optional().default(""),
  order: z.coerce.number().int().min(0).max(999).default(0),
  visible: z.boolean().default(true),
});

export const categorySchema = z.object({
  id: idField,
  slug: slugField,
  kind: z.enum(["article", "artwork"]).default("article"),
  vi: z.object({ name: z.string().trim().min(1, "Name is required").max(120), description: z.string().max(600).optional().default("") }),
  en: z.object({ name: z.string().trim().max(120).optional().default(""), description: z.string().max(600).optional().default("") }),
});

export const mediaMetaSchema = z.object({
  id: z.string().min(1),
  alt: z.string().trim().max(240).optional().default(""),
  title: z.string().trim().max(240).optional().default(""),
});

export const adminUserCreateSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  email: z.email("Enter a valid email address").max(160),
  password: z
    .string()
    .min(10, "Use at least 10 characters")
    .max(200)
    .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
      message: "Include at least one letter and one number",
    }),
  role: z.enum(["SUPER_ADMIN", "ADMIN"]).default("ADMIN"),
});

export const userRoleSchema = z.enum(["SUPER_ADMIN", "ADMIN"]);

export const settingsSchema = z.object({
  siteName: z.string().trim().min(1, "Site name is required").max(120),
  siteTagline: z.string().trim().max(200).optional().default(""),
  seoTitle: z.string().trim().max(180).optional().default(""),
  seoDescription: z.string().trim().max(320).optional().default(""),
  seoKeywords: z.string().trim().max(300).optional().default(""),
  footerText: z.string().trim().max(400).optional().default(""),
  footerTextEn: z.string().trim().max(400).optional().default(""),
  contactEmail: z.email("Enter a valid email").max(160),
  contactPhone: z.string().trim().max(40).optional().default(""),
  contactLocation: z.string().trim().max(160).optional().default(""),
  logoMediaId: idField,
  faviconMediaId: idField,
  postsPerPage: z.coerce.number().int().min(3).max(48).default(9),
  defaultTheme: z.enum(["light", "dark", "system"]).default("light"),
  showDemoBadge: z.boolean().default(true),
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type ArticleInput = z.infer<typeof articleSchema>;
export type ArtworkInput = z.infer<typeof artworkSchema>;

// ---------------------------------------------------------------------------
// Custom Survey System + Booking (Phase 10)
// ---------------------------------------------------------------------------

const hexColorField = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex colour like #17233a")
  .optional()
  .transform((value) => (value ? value : undefined));

// Like hexColorField but also accepts an empty string (treated as absent) —
// used for the completion-badge gradient colours, which are optional
// per-survey overrides (null = preset default).
const optionalHexColorField = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || /^#[0-9a-fA-F]{6}$/.test(value), {
    message: "Must be a hex colour like #17233a",
  });

export const surveyQuestionTypeSchema = z.enum([
  "short_text",
  "long_text",
  "single_choice",
  "multiple_choice",
  "dropdown",
  "rating",
  "nps",
  "yes_no",
]);

const surveyTranslation = z.object({
  title: z.string().trim().min(1, "Title is required").max(180),
  subtitle: z.string().trim().max(220).optional().default(""),
  description: z.string().max(4000).optional().default(""),
  introduction: z.string().max(10000).optional().default(""),
  completionMessage: z.string().max(2000).optional().default(""),
  privacyNotice: z.string().max(2000).optional().default(""),
  // Newline-separated custom bullet lines for the intro page; empty = no
  // custom bullets.
  highlights: z.string().max(2000).optional().default(""),
});

export const surveySchema = z.object({
  id: idField,
  slug: slugField,
  // draft | published | closed | archived
  status: z.enum(["draft", "published", "closed", "archived"]).default("draft"),
  coverMediaId: idField,
  themePreset: z.enum(["minimal", "editorial", "modern", "premium", "editorial-vn"]).default("minimal"),
  layout: z.enum(["centered", "split", "editorial"]).default("centered"),
  progressStyle: z.enum(["bar", "dots", "steps"]).default("bar"),
  // Validated hex colours only — never free-form CSS.
  primaryColor: hexColorField,
  accentColor: hexColorField,
  backgroundColor: hexColorField,
  surfaceColor: hexColorField,
  textColor: hexColorField,
  // Completion-badge gradient colours (hex or empty = preset default).
  badgeFromColor: optionalHexColorField,
  badgeToColor: optionalHexColorField,
  // Brand header for the public survey/booking pages (15:14 photo reference).
  brandName: z.string().trim().max(160).optional().transform((value) => (value ? value : undefined)),
  brandLogoMediaId: idField,
  buttonStyle: z.enum(["solid", "outline"]).default("solid"),
  borderRadius: z.enum(["sm", "md", "lg", "full"]).default("md"),
  estimatedMinutes: z.coerce.number().int().min(1).max(600).optional(),
  startsAt: optionalDate,
  endsAt: optionalDate,
  isBookingIntake: z.boolean().default(false),
  vi: surveyTranslation,
  en: surveyTranslation,
});

const surveyQuestionTranslation = z.object({
  title: z.string().trim().min(1, "Question title is required").max(MAX_QUESTION_TITLE),
  description: z.string().max(2000).optional().default(""),
  placeholder: z.string().trim().max(200).optional().default(""),
});

export const surveyQuestionSchema = z.object({
  id: idField,
  surveyId: z.string().trim().min(1).optional(),
  sectionId: idField,
  type: surveyQuestionTypeSchema,
  order: z.coerce.number().int().min(0).max(9999).default(0),
  required: z.boolean().default(false),
  minLength: z.coerce.number().int().min(0).max(5000).optional(),
  maxLength: z.coerce.number().int().min(0).max(5000).optional(),
  // Rating scales are 1–10; NPS is fixed 0–10 (enforced in surveyAnswerSchema).
  minRating: z.coerce.number().int().min(1).max(MAX_RATING).optional(),
  maxRating: z.coerce.number().int().min(1).max(MAX_RATING).optional(),
  vi: surveyQuestionTranslation,
  en: surveyQuestionTranslation,
});

const surveyOptionTranslation = z.object({
  label: z.string().trim().min(1, "Option label is required").max(MAX_OPTION_LABEL),
});

export const surveyOptionSchema = z.object({
  id: idField,
  questionId: z.string().trim().min(1).optional(),
  // Stable machine value (slugified label); the human label lives in translations.
  value: z
    .string()
    .trim()
    .min(1, "Option value is required")
    .max(90)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Option value must be a lowercase slug"),
  order: z.coerce.number().int().min(0).max(9999).default(0),
  vi: surveyOptionTranslation,
  en: surveyOptionTranslation,
});

// One answer row. Per-question bounds (the question's own min/max length or
// rating range, and choice ∈ declared options) are re-checked server-side
// against the stored question, because this schema does not carry the
// question definitions; the global bounds below are the first line of defence.
export const surveyAnswerSchema = z
  .object({
    questionId: z.string().trim().min(1, "Question is required"),
    type: surveyQuestionTypeSchema,
    // Text answer, or the rating/NPS number as text. Empty for pure-choice answers.
    value: z.string().max(MAX_LONG_TEXT_ANSWER).optional().default(""),
    // Selected option values (one for single_choice/dropdown, several for
    // multiple_choice). Duplicate selections are rejected below.
    optionValues: z.array(z.string().trim().min(1).max(90)).max(MAX_OPTIONS_PER_QUESTION).optional().default([]),
  })
  .superRefine((answer, ctx) => {
    const { type } = answer;
    if (type === "short_text") {
      if (answer.value.trim().length > MAX_SHORT_TEXT_ANSWER) {
        ctx.addIssue({ code: "custom", message: `Short text answers are at most ${MAX_SHORT_TEXT_ANSWER} characters`, path: ["value"] });
      }
    }
    if (type === "long_text" && answer.value.length > MAX_LONG_TEXT_ANSWER) {
      ctx.addIssue({ code: "custom", message: `Long text answers are at most ${MAX_LONG_TEXT_ANSWER} characters`, path: ["value"] });
    }
    if (type === "single_choice" || type === "dropdown") {
      if (answer.optionValues.length !== 1) {
        ctx.addIssue({ code: "custom", message: "Choose exactly one option", path: ["optionValues"] });
      }
    }
    if (type === "multiple_choice" && answer.optionValues.length < 1) {
      ctx.addIssue({ code: "custom", message: "Choose at least one option", path: ["optionValues"] });
    }
    if (new Set(answer.optionValues).size !== answer.optionValues.length) {
      ctx.addIssue({ code: "custom", message: "Duplicate options are not allowed", path: ["optionValues"] });
    }
    if (type === "rating") {
      const n = Number(answer.value);
      if (!Number.isInteger(n) || n < 1 || n > MAX_RATING) {
        ctx.addIssue({ code: "custom", message: `Rating must be a whole number from 1 to ${MAX_RATING}`, path: ["value"] });
      }
    }
    if (type === "nps") {
      const n = Number(answer.value);
      if (!Number.isInteger(n) || n < NPS_MIN || n > NPS_MAX) {
        ctx.addIssue({ code: "custom", message: `NPS must be a whole number from ${NPS_MIN} to ${NPS_MAX}`, path: ["value"] });
      }
    }
    if (type === "yes_no" && answer.value !== "yes" && answer.value !== "no") {
      ctx.addIssue({ code: "custom", message: "Answer must be yes or no", path: ["value"] });
    }
  });

export const surveyResponseSchema = z.object({
  surveyId: z.string().trim().min(1).optional(),
  slug: slugField,
  locale: z.enum(["vi", "en"]).default("vi"),
  // Hashed respondent key for identified surveys; absent for anonymous ones.
  respondentKey: z.string().trim().max(128).optional(),
  // Honeypot + timing check, copied from the contact submission pattern.
  website: z.string().max(0).optional().or(z.literal("")),
  startedAt: z.coerce.number().int().optional(),
  answers: z.array(surveyAnswerSchema).max(MAX_QUESTIONS_PER_SURVEY),
});

export const bookingServiceSchema = z.object({
  id: idField,
  slug: slugField,
  durationMinutes: z.coerce
    .number()
    .int()
    .refine((value) => (BOOKING_SLOT_DURATIONS_MINUTES as readonly number[]).includes(value), {
      message: "Duration must be 15, 30 or 60 minutes",
    })
    .default(30),
  active: z.boolean().default(true),
  intakeSurveyId: idField,
  order: z.coerce.number().int().min(0).max(9999).default(0),
  vi: z.object({
    name: z.string().trim().min(1, "Service name is required").max(160),
    description: z.string().max(4000).optional().default(""),
  }),
  en: z.object({
    name: z.string().trim().max(160).optional().default(""),
    description: z.string().max(4000).optional().default(""),
  }),
});

export const bookingSlotSchema = z
  .object({
    id: idField,
    serviceId: z.string().trim().min(1, "Service is required"),
    startsAt: z.iso.datetime({ message: "Start time must be an ISO date-time" }),
    endsAt: z.iso.datetime({ message: "End time must be an ISO date-time" }),
  })
  .refine((data) => new Date(data.endsAt).getTime() > new Date(data.startsAt).getTime(), {
    message: "End time must be after start time",
    path: ["endsAt"],
  });

export const bookingCreateSchema = z.object({
  // Contact is REQUIRED (15:17 correction — the 15:14 anonymity requirement
  // applies to the PUBLIC display only, via the flower pseudonym, not to
  // collection). Name 2–80, valid email ≤160, phone ≤40, notes ≤1000 optional.
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.email("Enter a valid email address").max(160),
  phone: z.string().trim().min(1, "Please enter your phone number").max(40),
  notes: z.string().max(MAX_BOOKING_NOTES).optional().default(""),
  slotId: z.string().trim().min(1, "Choose a time slot"),
  serviceSlug: z.string().trim().min(1, "Choose a service").max(90),
  // Intake-survey answers, validated per surveyResponseSchema. Empty when the
  // service has no intake survey.
  answers: z.array(surveyAnswerSchema).max(MAX_QUESTIONS_PER_SURVEY).optional().default([]),
  // Honeypot + timing check, copied from the contact submission pattern.
  website: z.string().max(0).optional().or(z.literal("")),
  startedAt: z.coerce.number().int().optional(),
});

export type SurveyInput = z.infer<typeof surveySchema>;
export type SurveyQuestionInput = z.infer<typeof surveyQuestionSchema>;
export type SurveyOptionInput = z.infer<typeof surveyOptionSchema>;
export type SurveyResponseInput = z.infer<typeof surveyResponseSchema>;
export type BookingServiceInput = z.infer<typeof bookingServiceSchema>;
export type BookingSlotInput = z.infer<typeof bookingSlotSchema>;
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
