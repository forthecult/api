import { redirect } from "next/navigation";

const ADMIN_APP_URL =
  process.env.NEXT_PUBLIC_ADMIN_APP_URL ?? "http://localhost:3001";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Customer details live in the admin app. Redirect so /customers/[id] on the
 * storefront opens the admin customer detail page.
 */
export default async function CustomerRedirectPage({ params }: PageProps) {
  const { id } = await params;
  const url = `${ADMIN_APP_URL.replace(/\/$/, "")}/customers/${encodeURIComponent(id)}`;
  redirect(url);
}
