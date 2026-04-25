export default function ProductsLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 py-10">
        <div
          className={`
            mx-auto w-full max-w-7xl px-4
            sm:px-6
            lg:px-8
          `}
        >
          {/* Header skeleton */}
          <div className="mb-6">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
          </div>

          {/* Filter bar skeleton */}
          <div className="mb-6 flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                className="h-9 w-24 animate-pulse rounded-full bg-muted"
                key={i}
              />
            ))}
          </div>

          {/* Product grid skeleton */}
          <div
            className={`
              grid grid-cols-1 gap-6
              sm:grid-cols-2
              md:grid-cols-3
              lg:grid-cols-4
            `}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                className="flex flex-col overflow-hidden rounded-lg border"
                key={i}
              >
                <div className="aspect-square animate-pulse bg-muted" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="h-8 w-full animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
