import { SEO_CONFIG } from "~/app";

import { WishlistLoader } from "./wishlist-loader";

export const metadata = {
  description: `View and manage your saved items at ${SEO_CONFIG.name}.`,
  title: `Wishlist | ${SEO_CONFIG.name}`,
};

export default function WishlistPage() {
  return <WishlistLoader />;
}
