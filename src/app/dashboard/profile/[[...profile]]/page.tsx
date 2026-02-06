import { SEO_CONFIG } from "~/app";

import { ProfileLoader } from "./profile-loader";

export const metadata = {
  description: `Manage your ${SEO_CONFIG.name} profile settings.`,
  title: `Profile | ${SEO_CONFIG.name}`,
};

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ profile?: string[] }>;
}) {
  const { profile: segment } = await params;
  return <ProfileLoader segment={segment} />;
}
