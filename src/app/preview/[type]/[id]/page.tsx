import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPreviewData, isPreviewKind, type PreviewData } from "@/lib/services/preview";
import { renderMarkdown } from "@/lib/markdown";
import { assetUrl } from "@/lib/asset";
import { formatDate } from "@/lib/utils";
import { resolveLocale, type Locale } from "@/i18n/config";
import { normalizeArticleTemplate } from "@/lib/article-template";
import { ArticleBody as ArticleBodyContent } from "@/components/blog/article-body";
import { QUESTION_TYPE_LABELS } from "@/components/admin/status-badge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Xem trước nội dung",
  robots: { index: false, follow: false },
};

const TYPE_LABEL: Record<string, string> = {
  article: "Bài viết",
  project: "Dự án",
  artwork: "Tác phẩm",
  survey: "Khảo sát",
};

type ArticlePreview = Extract<PreviewData, { kind: "article" }>;
type ProjectPreview = Extract<PreviewData, { kind: "project" }>;
type ArtworkPreview = Extract<PreviewData, { kind: "artwork" }>;
type SurveyPreview = Extract<PreviewData, { kind: "survey" }>;

async function ArticleBody({ data, locale }: { data: ArticlePreview; locale: Locale }) {
  const translation = data.translation;
  if (!translation) return null;
  const template = normalizeArticleTemplate(data.template);
  const { html } = await renderMarkdown(translation.content, { editorial: template === "editorial" });
  const minutes = Math.max(1, Math.round((translation.content.split(/\s+/).length || 0) / 200));

  return (
    <article>
      {data.category && <p className="text-[10px] uppercase tracking-[0.16em] text-accent">{data.category}</p>}
      <h1 className="display mt-4 text-[clamp(2rem,5vw,3.4rem)] leading-[1.05]">{translation.title}</h1>
      {translation.subtitle && (
        <p className="serif-accent mt-4 text-[clamp(1.2rem,2.4vw,1.7rem)] text-slateblue">{translation.subtitle}</p>
      )}
      <p className="mt-5 text-[11px] uppercase tracking-[0.14em] text-muted">
        {data.author} · {data.publishedAt ? formatDate(data.publishedAt, locale) : "chưa xuất bản"} · {minutes} phút đọc
      </p>
      {data.cover && (
        <div className="relative mt-8 aspect-[16/9] overflow-hidden border border-line">
          <Image src={assetUrl(data.cover)} alt="" fill sizes="(min-width: 768px) 720px, 100vw" className="object-cover" />
        </div>
      )}
      <ArticleBodyContent html={html} template={template} className="mt-10" />
    </article>
  );
}

async function ProjectBody({ data }: { data: ProjectPreview }) {
  const translation = data.translation;
  if (!translation) return null;
  const { html } = await renderMarkdown(translation.fullDescription);

  return (
    <article>
      <p className="text-[10px] uppercase tracking-[0.16em] text-accent">Dự án</p>
      <h1 className="display mt-4 text-[clamp(2rem,5vw,3.4rem)] leading-[1.05]">{translation.name}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">{translation.shortDescription}</p>
      {data.technologies.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2">
          {data.technologies.map((tech) => (
            <li key={tech} className="border border-line px-2.5 py-1 text-[11px] tracking-[0.02em] text-muted">
              {tech}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex flex-wrap gap-4 text-[12px]">
        {data.githubUrl && (
          <a href={data.githubUrl} className="underline underline-offset-2" target="_blank" rel="noreferrer">
            GitHub
          </a>
        )}
        {data.demoUrl && (
          <a href={data.demoUrl} className="underline underline-offset-2" target="_blank" rel="noreferrer">
            Live demo
          </a>
        )}
      </div>
      {data.cover && (
        <div className="relative mt-8 aspect-[16/10] overflow-hidden border border-line">
          <Image src={assetUrl(data.cover)} alt="" fill sizes="(min-width: 768px) 720px, 100vw" className="object-cover" />
        </div>
      )}
      {translation.role && <p className="mt-6 text-[13px] text-muted">Vai trò: {translation.role}</p>}
      <div className="prose-editorial mt-8" dangerouslySetInnerHTML={{ __html: html }} />
      {data.gallery.length > 0 && (
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {data.gallery.map((url) => (
            <div key={url} className="relative aspect-[4/3] overflow-hidden border border-line">
              <Image src={assetUrl(url)} alt="" fill sizes="360px" className="object-cover" />
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function SurveyBody({ data, locale }: { data: SurveyPreview; locale: Locale }) {
  const translation = data.translation;
  if (!translation) return null;
  const pickTitle = (translations: { locale: string; title: string }[], fallback: string) =>
    translations.find((item) => item.locale === locale)?.title ||
    translations.find((item) => item.locale === "vi")?.title ||
    fallback;
  const pickLabel = (translations: { locale: string; label: string }[], fallback: string) =>
    translations.find((item) => item.locale === locale)?.label ||
    translations.find((item) => item.locale === "vi")?.label ||
    fallback;
  const ungrouped = data.questions.filter((question) => !question.sectionId);

  return (
    <article>
      <p className="text-[10px] uppercase tracking-[0.16em] text-accent">Khảo sát</p>
      <h1 className="display mt-4 text-[clamp(2rem,5vw,3.4rem)] leading-[1.05]">{translation.title}</h1>
      {translation.subtitle && (
        <p className="serif-accent mt-4 text-[clamp(1.2rem,2.4vw,1.7rem)] text-slateblue">{translation.subtitle}</p>
      )}
      <p className="mt-5 text-[11px] uppercase tracking-[0.14em] text-muted">
        /{data.slug} · {data.themePreset} · {data.layout}
        {data.estimatedMinutes ? ` · khoảng ${data.estimatedMinutes} phút` : ""} · {data.responseCount} câu trả lời
        {data.isBookingIntake ? " · khảo sát đầu vào đặt lịch" : ""}
      </p>
      {data.cover && (
        <div className="relative mt-8 aspect-[16/9] overflow-hidden border border-line">
          <Image src={assetUrl(data.cover)} alt="" fill sizes="(min-width: 768px) 720px, 100vw" className="object-cover" />
        </div>
      )}
      {translation.description && <p className="mt-6 text-[15px] leading-[1.8] text-muted">{translation.description}</p>}
      {translation.introduction && (
        <p className="mt-4 whitespace-pre-line text-[15px] leading-[1.8]">{translation.introduction}</p>
      )}
      {data.sections.map((section) => {
        const sectionQuestions = data.questions.filter((question) => question.sectionId === section.id);
        if (sectionQuestions.length === 0) return null;
        return (
          <section key={section.id} className="mt-10">
            <h2 className="text-[15px] font-medium">{pickTitle(section.translations, "Mục")}</h2>
            <ol className="mt-4 space-y-5">
              {sectionQuestions.map((question) => (
                <li key={question.id} className="border border-line bg-surface p-4">
                  <p className="text-[14px] font-medium">
                    {pickTitle(question.translations, question.id)}
                    {question.required && <span className="ml-2 text-[11px] text-accent">Bắt buộc</span>}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted">
                    {QUESTION_TYPE_LABELS[question.type] ?? question.type}
                  </p>
                  {question.options.length > 0 && (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-muted">
                      {question.options.map((option) => (
                        <li key={option.id}>{pickLabel(option.translations, option.value)}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
      {ungrouped.length > 0 && (
        <section className="mt-10">
          <ol className="space-y-5">
            {ungrouped.map((question) => (
              <li key={question.id} className="border border-line bg-surface p-4">
                <p className="text-[14px] font-medium">
                  {pickTitle(question.translations, question.id)}
                  {question.required && <span className="ml-2 text-[11px] text-accent">Bắt buộc</span>}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted">
                  {QUESTION_TYPE_LABELS[question.type] ?? question.type}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}
      {translation.completionMessage && (
        <p className="mt-10 border-t border-line pt-4 text-[13px] text-muted">
          Thông điệp hoàn thành: {translation.completionMessage}
        </p>
      )}
    </article>
  );
}

function ArtworkBody({ data, locale }: { data: ArtworkPreview; locale: Locale }) {
  const translation = data.translation;
  if (!translation) return null;

  return (
    <article>
      <p className="text-[10px] uppercase tracking-[0.16em] text-accent">Tác phẩm</p>
      <h1 className="display mt-4 text-[clamp(2rem,5vw,3.2rem)] leading-[1.05]">{translation.title}</h1>
      {data.image && (
        <div className="mt-7 border border-line bg-surface-muted">
          {data.dimensions.width && data.dimensions.height ? (
            <Image
              src={assetUrl(data.image)}
              alt={translation.title}
              width={data.dimensions.width}
              height={data.dimensions.height}
              sizes="(min-width: 768px) 720px, 100vw"
              className="h-auto w-full"
              priority
            />
          ) : (
            <div className="relative aspect-[4/5]">
              <Image src={assetUrl(data.image)} alt={translation.title} fill sizes="720px" className="object-contain" />
            </div>
          )}
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-muted">
        {data.collection && <span>{data.collection}</span>}
        {data.medium && <span>{data.medium}</span>}
        {data.createdDate && <span>{formatDate(data.createdDate, locale)}</span>}
        {data.dimensions.width && data.dimensions.height && (
          <span>
            {data.dimensions.width} × {data.dimensions.height}px
          </span>
        )}
      </div>
      {translation.description && (
        <p className="mt-5 whitespace-pre-line text-[15px] leading-[1.8] text-muted">{translation.description}</p>
      )}
    </article>
  );
}

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const [{ type, id }, query] = await Promise.all([params, searchParams]);
  if (!isPreviewKind(type)) notFound();

  const locale = resolveLocale(query.locale);
  const data = await getPreviewData(type, id, locale);
  if (!data) notFound();

  const editorHref: string = {
    article: `/admin/blog/${id}`,
    project: `/admin/projects/${id}`,
    artwork: `/admin/art/${id}`,
    survey: `/admin/surveys/${id}`,
  }[type];

  const otherLocale = data.locales.find((item) => item !== locale);

  return (
    <div className="min-h-screen bg-background text-ink">
      <div className="sticky top-0 z-50 border-b border-line bg-primary text-primary-fg">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-[11px]">
          <span className="flex items-center gap-2 font-medium">
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[9px]">PS</span>
            Bản xem trước
          </span>
          <span className="opacity-60">·</span>
          <span className="opacity-80">{TYPE_LABEL[type]}</span>
          <span className="rounded-full border border-white/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] opacity-90">
            {data.status}
          </span>
          {data.kind === "article" && (
            <span className="rounded-full border border-white/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] opacity-90">
              {normalizeArticleTemplate(data.template)}
            </span>
          )}
          <span className="ml-auto flex items-center gap-3">
            <Link href={editorHref} className="underline underline-offset-2 opacity-80 hover:opacity-100">
              Quay lại chỉnh sửa
            </Link>
            {otherLocale && (
              <Link
                href={`/preview/${type}/${id}?locale=${otherLocale}`}
                className="underline underline-offset-2 opacity-80 hover:opacity-100"
              >
                Xem bản {otherLocale.toUpperCase()}
              </Link>
            )}
          </span>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-16">
        {!data.translation ? (
          <div className="border border-dashed border-line p-8 text-center">
            <p className="text-lg tracking-tight">Nội dung này chưa có bản dịch {locale.toUpperCase()}.</p>
            <p className="mt-2 text-sm text-muted">
              Bản xem trước không tự lấy nội dung ngôn ngữ khác. Hãy thêm bản dịch trong trình soạn thảo.
            </p>
            {otherLocale && (
              <Link href={`/preview/${type}/${id}?locale=${otherLocale}`} className="btn btn-outline btn-sm mt-5">
                Xem bản {otherLocale.toUpperCase()}
              </Link>
            )}
          </div>
        ) : data.kind === "article" ? (
          <ArticleBody data={data} locale={locale} />
        ) : data.kind === "project" ? (
          <ProjectBody data={data} />
        ) : data.kind === "survey" ? (
          <SurveyBody data={data} locale={locale} />
        ) : (
          <ArtworkBody data={data} locale={locale} />
        )}

        <p className="mt-14 border-t border-line pt-4 text-[11px] text-muted">
          Trang xem trước yêu cầu đăng nhập quản trị. Nội dung chưa xuất bản không được lập chỉ mục và không có URL công khai
          cố định.
        </p>
      </main>
    </div>
  );
}
