import { z } from "zod";

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
