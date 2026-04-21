export default function ProductDetailLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 py-10">
        <div
          className={`
            container mx-auto px-4
            md:px-6
          `}
        >
          {/* Breadcrumb skeleton */}
          <div className="mb-4 flex gap-2">
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>

          {/* Back button skeleton */}
          <div className="mb-6 h-9 w-36 animate-pulse rounded bg-muted" />

          {/* Main grid */}
          <div
            className={`
              grid grid-cols-1 gap-8
              md:grid-cols-2
            `}
          >
            {/* Image gallery skeleton */}
            <div className="aspect-square animate-pulse rounded-lg bg-muted" />

            {/* Product info skeleton */}
            <div className="flex flex-col space-y-4">
              <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-5 w-1/4 animate-pulse rounded bg-muted" />
              <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
              <div className="space-y-2">
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
                <div className="h-4 w-4/6 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-12 w-full animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
