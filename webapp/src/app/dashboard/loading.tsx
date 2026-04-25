export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 py-10">
        <div
          className={`
            container mx-auto px-4
            md:px-6
          `}
        >
          <div className="mb-6 h-8 w-40 animate-pulse rounded bg-muted" />
          <div
            className={`
              grid gap-6
              sm:grid-cols-2
              lg:grid-cols-3
            `}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="rounded-lg border p-6" key={i}>
                <div className="mb-4 h-5 w-32 animate-pulse rounded bg-muted" />
                <div className="h-8 w-20 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
