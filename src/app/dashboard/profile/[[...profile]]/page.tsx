import { SEO_CONFIG } from "~/app";

import { ProfileLoader } from "./profile-loader";

export const metadata = {
  description: `Manage your ${SEO_CONFIG.name} profile settings.`,
  title: `Profile | ${SEO_CONFIG.name}`,
};

export default function ProfilePage() {
  return <ProfileLoader />;
}
