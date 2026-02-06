import { AdminGuard } from "~/app/admin-guard";
import { AdminChatPopup } from "~/ui/admin-chat-popup";
import { AdminHeader } from "~/ui/admin-header";
import { AdminSidebar } from "~/ui/admin-sidebar";

export default function AdminSectionLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminChatPopup />
      <div className="flex min-h-screen">
        <AdminSidebar />
        <main className="flex-1 overflow-auto bg-background">
          <AdminHeader />
          <div className="container mx-auto py-6">{children}</div>
        </main>
      </div>
    </AdminGuard>
  );
}
