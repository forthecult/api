import { redirect } from "next/navigation";

/** Hosted ToS at /terms (linked from mobile app and elsewhere). */
export default function TermsRedirect() {
  redirect("/policies/terms");
}
