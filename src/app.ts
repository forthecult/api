export const SEO_CONFIG = {
  description:
    "Culture is a lifestyle brand for people who invest in themselves. Quality apparel, tech accessories, and curated essentials. Free shipping over $50.",
  fullName: "Culture Store",
  name: "Culture",
  slogan: "Where smart living and technology meet.",
  /** used in meta description and open graph; keep under ~160 chars for SEO */
  metaDescription:
    "Premium lifestyle gear for the life you're building. Curated quality apparel and tech. Free shipping over $100.",
  keywords:
    "lifestyle brand, curated essentials, quality apparel, tech accessories, Culture Store, premium merchandise, smart living",
};

export const SYSTEM_CONFIG = {
  redirectAfterSignIn: "/dashboard/orders",
  redirectAfterSignUp: "/dashboard/orders",
  repoName: "relivator",
  repoOwner: "blefnk",
  repoStars: true,
};

export const ADMIN_CONFIG = {
  displayEmails: false,
};

/** active payment method for checkout; stripe is integrated but disabled until you enable it in the UI. checkout is guest-friendly (auth optional). */
export const PAYMENT_CONFIG = {
  activeMethod: "solana" as "solana" | "stripe",
  stripeEnabled: false,
};

export const DB_DEV_LOGGER = false;
