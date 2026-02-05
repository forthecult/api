import { SEO_CONFIG } from "~/app";

import { SignupLoader } from "./signup-loader";

export const metadata = {
  description: `Create a new ${SEO_CONFIG.name} account.`,
  title: `Sign Up | ${SEO_CONFIG.name}`,
};

/**
 * Signup page - loads client component dynamically to avoid SSR overhead.
 * Session check and redirect handled client-side.
 */
export default function SignupPage() {
  return <SignupLoader />;
}
