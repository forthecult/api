import { Home, ShoppingBag } from "lucide-react";
import Link from "next/link";

import { Button } from "~/ui/primitives/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="text-6xl font-bold text-muted-foreground/30">404</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Page not found</h1>
          <p className="max-w-md text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved.
          </p>
        </div>
        <div
          className={`
          flex flex-col gap-3
          sm:flex-row
        `}
        >
          <Link href="/products">
            <Button variant="default">
              <ShoppingBag className="mr-2 h-4 w-4" />
              Browse products
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline">
              <Home className="mr-2 h-4 w-4" />
              Go home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
