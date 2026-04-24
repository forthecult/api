import { resolveMx } from "node:dns/promises";

/**
 * Best-effort MX lookup for the email domain. Fails open (returns true) on DNS errors.
 */
export async function domainLikelyAcceptsMail(email: string): Promise<boolean> {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return false;
  try {
    const records = await resolveMx(domain);
    return records.length > 0;
  } catch {
    return true;
  }
}
