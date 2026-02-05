import { AdminGuard } from "~/app/admin-guard";
import { AdminChatPopup } from "~/ui/admin-chat-popup";
import { AdminSidebar, BrowseWebsiteLink } from "~/ui/admin-sidebar";

export default function AdminSectionLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminChatPopup />
      <div className="flex min-h-screen">
        <AdminSidebar />
        <main className="flex-1 overflow-auto bg-background">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background px-4">
            <div className="flex items-center gap-4">
              <BrowseWebsiteLink />
            </div>
          </header>
          <div className="container mx-auto py-6">{children}</div>
        </main>
      </div>
    </AdminGuard>
  );
}
