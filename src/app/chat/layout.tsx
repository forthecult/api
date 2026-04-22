/**
 * Lock /chat to the viewport below the site header so only in-panel regions
 * scroll (message list/sidebar), not the full page.
 */
export default function ChatLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className={`
        flex h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] min-h-0 w-full
        flex-col overflow-hidden
      `}
    >
      {children}
    </div>
  );
}
