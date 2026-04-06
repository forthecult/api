/**
 * Lock the chat route to the viewport below the site header (~4rem) so the
 * thread + composer stay in view without page-level scrolling (only the message
 * list scrolls inside the column).
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
