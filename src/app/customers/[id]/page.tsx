import { notFound, redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Customer details live in the admin app. Redirect so /customers/[id] on the
 * storefront opens the admin customer detail page.
 * Uses runtime env so deploy without NEXT_PUBLIC_ADMIN_APP_URL doesn't redirect to localhost.
 */
export default async function CustomerRedirectPage({ params }: PageProps) {
  const { id } = await params;
  const adminBase =
    process.env.ADMIN_APP_URL ??
    process.env.NEXT_PUBLIC_ADMIN_APP_URL?.trim() ??
    (process.env.NODE_ENV === "development" ? "http://localhost:3001" : "");
  if (!adminBase) {
    notFound();
  }
  const url = `${adminBase.replace(/\/$/, "")}/customers/${encodeURIComponent(id)}`;
  redirect(url);
}
