import Link from "next/link";
import type { Locale } from "@/i18n/config";

/**
 * Rendered when essential site data cannot be read (database down).
 * It deliberately shows no portfolio content, no fake placeholders and no
 * "empty site": only an explicit, localized outage state with a retry path.
 */
export function ServiceUnavailable({ locale }: { locale: Locale }) {
  const vi = locale === "vi";
  const other: Locale = vi ? "en" : "vi";

  return (
    <main id="main" className="container-page flex min-h-screen max-w-2xl flex-col justify-center py-20">
      <p className="label">{vi ? "Tạm thời gián đoạn" : "Temporarily unavailable"}</p>
      <h1 className="display mt-5 text-[clamp(2.1rem,5vw,3.4rem)]">
        {vi ? "Website đang không tải được nội dung." : "The site cannot load its content right now."}
      </h1>
      <p className="mt-5 max-w-lg text-[0.95rem] leading-[1.8] text-muted">
        {vi
          ? "Cơ sở dữ liệu tạm thời không phản hồi. Đây là sự cố kết nối phía máy chủ, không phải nội dung bị xoá. Vui lòng thử lại sau ít phút."
          : "The database is not responding. This is a server connectivity problem, not deleted content. Please try again in a few minutes."}
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href={vi ? "/vi" : "/en"} className="btn btn-primary btn-sm">
          {vi ? "Thử lại" : "Retry"}
        </Link>
        <Link href={vi ? "/en" : "/vi"} className="btn btn-outline btn-sm">
          {vi ? "English" : "Tiếng Việt"}
        </Link>
        <span className="text-[11px] text-muted">{other.toUpperCase()}</span>
      </div>
      <p className="mt-10 border-t border-line pt-4 text-[11px] text-muted">
        {vi ? "Mã sự cố: SITE_DATA_UNAVAILABLE" : "Incident code: SITE_DATA_UNAVAILABLE"}
      </p>
    </main>
  );
}
