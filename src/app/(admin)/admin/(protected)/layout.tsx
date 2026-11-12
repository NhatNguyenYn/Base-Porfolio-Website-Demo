import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import { messageCounts } from "@/server/queries/messages";
import { getSettings } from "@/server/queries/settings";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");

  const [counts, settings] = await Promise.all([messageCounts(), getSettings()]);

  return (
    <AdminShell user={user} unread={counts.unread} siteName={settings.siteName}>
      {children}
    </AdminShell>
  );
}
