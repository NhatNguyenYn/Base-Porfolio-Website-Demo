import { listProjects, type ProjectFilters } from "@/server/queries/projects";
import { fail, ok, publicCache, readPagination, resolveLocale } from "@/lib/api";

export const dynamic = "force-dynamic";

const SORTS = new Set(["newest", "oldest", "title"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const locale = resolveLocale(params.get("locale"));
  if (!locale) return fail("INVALID_LOCALE", "locale must be one of vi, en.", 400);

  const { page, perPage } = readPagination(params, 9);
  const sortParam = params.get("sort");
  const filters: ProjectFilters = {
    q: params.get("q") ?? undefined,
    tech: params.get("tech") ?? undefined,
    category: params.get("category") ?? undefined,
    status: params.get("status") ?? undefined,
    sort: sortParam && SORTS.has(sortParam) ? (sortParam as ProjectFilters["sort"]) : undefined,
    page,
    perPage,
  };

  const result = await listProjects(locale, filters);

  return ok(
    result.items,
    {
      locale,
      page: result.page,
      perPage,
      total: result.total,
      pages: result.pages,
      technologies: result.technologies,
      categories: result.categories,
    },
    publicCache,
  );
}
