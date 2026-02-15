export default function CheckoutLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 py-10">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="mb-8 h-8 w-32 animate-pulse rounded bg-muted" />
          <div className="space-y-6">
            {/* Order summary skeleton */}
            <div className="rounded-lg border p-6">
              <div className="mb-4 h-6 w-40 animate-pulse rounded bg-muted" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div className="flex items-center gap-4 py-3" key={i}>
                  <div className="h-16 w-16 animate-pulse rounded bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
            {/* Payment section skeleton */}
            <div className="rounded-lg border p-6">
              <div className="mb-4 h-6 w-48 animate-pulse rounded bg-muted" />
              <div className="h-12 w-full animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
