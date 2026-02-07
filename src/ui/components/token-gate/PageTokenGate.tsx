import { cookies } from "next/headers";

import { getPageTokenGates } from "~/lib/token-gate";
import { COOKIE_NAME, hasValidTokenGateCookie } from "~/lib/token-gate-cookie";
import { TokenGateGuard } from "~/ui/components/token-gate/TokenGateGuard";

/**
 * Central page token-gate wrapper. Gate config comes only from the admin
 * (Token Gates → Page token gates). Pages pass their slug and get either
 * the guard UI or children. No per-page token gate setup.
 */
export async function PageTokenGate({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const config = await getPageTokenGates(slug);
  if (!config.tokenGated) {
    return <>{children}</>;
  }
  const cookieStore = await cookies();
  const tgCookie = cookieStore.get(COOKIE_NAME)?.value;
  const passed = hasValidTokenGateCookie(tgCookie, "page", slug);
  if (!passed) {
    return <TokenGateGuard resourceType="page" resourceId={slug} />;
  }
  return <>{children}</>;
}
