import { redirect } from "next/navigation";

/** Legacy route: crypto payment is now at /checkout/[invoiceId]. */
export default function CryptoPayRedirect() {
  redirect("/checkout");
}
