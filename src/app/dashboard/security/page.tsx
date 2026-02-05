import { SEO_CONFIG } from "~/app";

import { SecurityLoader } from "./security-loader";

export const metadata = {
  description: `Manage your ${SEO_CONFIG.name} account security settings.`,
  title: `Security | ${SEO_CONFIG.name}`,
};

export default function SecurityPage() {
  return <SecurityLoader />;
}
