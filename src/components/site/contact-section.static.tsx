import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

// Static-export variant of the contact section, used only by the GitHub Pages
// demo build (the workflow copies this file over `contact-section.tsx` before
// building). A static site has no server, so the form cannot submit — show a
// mailto block instead. Never imported directly; it must stay in sync with
// `contact-section.tsx` (same component name, same props).
export function ContactSection({ email, locale }: { dict: Dictionary; email: string; locale: Locale }) {
  return (
    <div className="border-t border-line pt-5">
      <p className="text-[15px]">
        {locale === "vi"
          ? "Bản demo tĩnh không gửi được form — liên hệ trực tiếp qua email:"
          : "The static demo cannot submit this form — please email directly:"}
      </p>
      <a href={`mailto:${email}`} className="btn btn-primary mt-6 inline-block">
        {email}
      </a>
    </div>
  );
}
