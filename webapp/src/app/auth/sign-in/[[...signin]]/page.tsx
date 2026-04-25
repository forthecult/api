import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function AuthSignInPage({ searchParams }: PageProps) {
  const { callbackUrl } = await searchParams;

  // If there's a callbackUrl (e.g., from admin app), redirect to it after ensuring user is on the login page
  // The callbackUrl will be preserved for the actual login page to use
  const loginUrl = callbackUrl
    ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/login";
  redirect(loginUrl);
}
