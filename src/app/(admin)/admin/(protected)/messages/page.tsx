import Link from "next/link";
import { Mail, MailOpen } from "lucide-react";
import { getMessage, listMessages, messageCounts, type MessageStatus } from "@/server/queries/messages";
import { deleteMessageAction, setMessageStatusAction } from "@/server/actions/messages";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { Flash } from "@/components/admin/flash";
import { Pagination } from "@/components/site/pagination";
import { formatDate, paginate, totalPages } from "@/lib/utils";

const TABS: { key: MessageStatus | "all"; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "unread", label: "Chưa đọc" },
  { key: "read", label: "Đã đọc" },
  { key: "archived", label: "Lưu trữ" },
];

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; focus?: string; page?: string; deleted?: string }>;
}) {
  const query = await searchParams;
  const status = TABS.some((tab) => tab.key === query.status) ? (query.status as MessageStatus | "all") : "all";
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);

  const [counts, messages, focused] = await Promise.all([
    messageCounts(),
    listMessages(status === "all" ? undefined : status, query.q),
    query.focus ? getMessage(query.focus) : Promise.resolve(null),
  ]);

  const pages = totalPages(messages.length, 15);
  const items = paginate(messages, Math.min(page, pages), 15);

  return (
    <>
      <PageHeader
        title="Tin nhắn liên hệ"
        description="Tin nhắn từ form liên hệ được lưu trong cơ sở dữ liệu. Chưa có email gửi đi tự động."
      />

      {query.deleted && <Flash message="Đã xoá tin nhắn (xoá mềm)." />}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {TABS.map((tab) => {
          const count =
            tab.key === "all" ? counts.total : tab.key === "unread" ? counts.unread : tab.key === "read" ? counts.read : counts.archived;
          return (
            <Link
              key={tab.key}
              href={tab.key === "all" ? "/admin/messages" : `/admin/messages?status=${tab.key}`}
              className={`chip transition-colors ${status === tab.key ? "chip-active" : ""}`}
            >
              {tab.label}
              <span className="tabular-nums opacity-60">{count}</span>
            </Link>
          );
        })}

        <form method="get" className="ml-auto flex items-center gap-2">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Tìm theo tên, email, tiêu đề…"
            className="field w-56 text-[12px]"
          />
          <button type="submit" className="btn btn-outline btn-sm">
            Tìm
          </button>
        </form>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="border border-line bg-surface">
          {items.length === 0 ? (
            <p className="px-4 py-14 text-center text-[12.5px] text-muted">Không có tin nhắn nào.</p>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((message) => (
                <li key={message.id}>
                  <Link
                    href={`/admin/messages?${status !== "all" ? `status=${status}&` : ""}focus=${message.id}`}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-muted/50 ${
                      focused?.id === message.id ? "bg-accent-soft/40" : ""
                    }`}
                  >
                    <span className="mt-0.5 text-muted">
                      {message.status === "unread" ? <Mail size={14} /> : <MailOpen size={14} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-[12.5px] ${message.status === "unread" ? "font-medium" : ""}`}>
                          {message.subject}
                        </span>
                        <StatusBadge status={message.status} />
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted">
                        {message.name} · {message.email}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-muted">
                        {formatDate(message.createdAt, "vi", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border border-line bg-surface">
          {!focused ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 p-8 text-center">
              <Mail size={20} strokeWidth={1.4} className="text-muted" aria-hidden="true" />
              <p className="text-[12.5px] text-muted">Chọn một tin nhắn để đọc nội dung.</p>
            </div>
          ) : (
            <div className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <StatusBadge status={focused.status} />
                <span className="text-[10.5px] text-muted">
                  {formatDate(focused.createdAt, "vi", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <h2 className="mt-4 text-[18px] leading-snug tracking-tight">{focused.subject}</h2>
              <p className="mt-2 text-[12px] text-muted">
                {focused.name} ·{" "}
                <a href={`mailto:${focused.email}`} className="text-ink underline underline-offset-2">
                  {focused.email}
                </a>
              </p>

              <p className="mt-5 whitespace-pre-line border-t border-line pt-4 text-[13px] leading-[1.75]">
                {focused.message}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <form action={setMessageStatusAction}>
                  <input type="hidden" name="id" value={focused.id} />
                  <input type="hidden" name="status" value={focused.status === "read" ? "unread" : "read"} />
                  <button type="submit" className="btn btn-outline btn-sm">
                    {focused.status === "read" ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"}
                  </button>
                </form>
                <form action={setMessageStatusAction}>
                  <input type="hidden" name="id" value={focused.id} />
                  <input type="hidden" name="status" value="archived" />
                  <button type="submit" className="btn btn-outline btn-sm">
                    Lưu trữ
                  </button>
                </form>
                <a href={`mailto:${focused.email}?subject=Re: ${encodeURIComponent(focused.subject)}`} className="btn btn-primary btn-sm">
                  Trả lời qua email
                </a>
                <form action={deleteMessageAction} className="ml-auto">
                  <input type="hidden" name="id" value={focused.id} />
                  <ConfirmSubmit
                    title="Xoá tin nhắn này?"
                    description="Tin nhắn sẽ bị xoá mềm khỏi hộp thư quản trị."
                    triggerLabel="Xoá"
                    confirmLabel="Xoá tin nhắn"
                  />
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      <Pagination
        page={Math.min(page, pages)}
        pages={pages}
        basePath="/admin/messages"
        params={{ status: status === "all" ? undefined : status, q: query.q, focus: query.focus }}
        labels={{ previous: "Trước", next: "Sau", page: "Trang", of: "/" }}
      />
    </>
  );
}
