import { ContactForm } from "@/components/site/contact-form";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

// Full-stack variant: renders the working contact form (posts to a Server Action).
// The GitHub Pages static export swaps this file for `contact-section.static.tsx`
// (see .github/workflows/pages.yml), because Server Actions cannot exist in a
// static export. `email`/`locale` are unused here but kept so both variants
// share the same props.
export function ContactSection({ dict }: { dict: Dictionary; email: string; locale: Locale }) {
  return <ContactForm dict={dict} startedAt={Date.now()} />;
}
