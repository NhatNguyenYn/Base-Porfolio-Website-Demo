import { Reveal } from "@/components/ui/reveal";

export function PageHero({
  label,
  title,
  description,
  meta,
}: {
  label: string;
  title: React.ReactNode;
  description?: string;
  meta?: { label: string; value: string }[];
}) {
  return (
    <section className="container-page pt-14 pb-12 lg:pt-20 lg:pb-16">
      <Reveal priority>
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-accent" aria-hidden="true" />
          <span className="label">{label}</span>
        </div>
        <div className="mt-7 grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-end">
          <h1 className="display text-[clamp(2.6rem,6vw,5.2rem)]">{title}</h1>
          <div className="max-w-md lg:pb-2">
            {description && <p className="text-[0.9375rem] leading-relaxed text-muted">{description}</p>}
            {meta && meta.length > 0 && (
              <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
                {meta.map((item) => (
                  <div key={item.label}>
                    <dt className="text-[10px] uppercase tracking-[0.16em] text-muted">{item.label}</dt>
                    <dd className="mt-1 text-sm tabular-nums">{item.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
