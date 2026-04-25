import { redirect } from "next/navigation";

/** Hosted Privacy at /privacy (linked from mobile app and elsewhere). */
export default function PrivacyRedirect() {
  redirect("/policies/privacy");
}
