import { type NextRequest, NextResponse } from "next/server";

/**
 * Set X-Robots-Tag: noindex, nofollow for dashboard (and any admin UI routes)
 * so crawlers that ignore robots.txt or meta tags still do not index these pages.
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isNoIndexPath =
    path.startsWith("/dashboard") || path.startsWith("/admin");

  if (isNoIndexPath) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
