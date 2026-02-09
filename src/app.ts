export const SEO_CONFIG = {
  description:
    "For the Cult is a lifestyle store for people who invest in themselves. Curated tech, premium apparel, wellness gear, and travel essentials. Pay with crypto or card. Hold 250,000 CULT for free shipping.",
  fullName: "For the Cult",
  name: "For the Culture",
  slogan: "Where smart living and technology meet.",
  /** Store logo URL. Shown in header and structured data. Omit to use site name in header and /logo.png in structured data. */
  brandLogoUrl: undefined as string | undefined,
  /** used in meta description and open graph; keep under ~160 chars for SEO */
  metaDescription:
    "Curated tech, apparel & wellness gear. Pay with Solana, $CULT or card. Hold CULT for free shipping, member discounts, and early access.",
  keywords:
    "For the Cult, lifestyle store, crypto store, Solana pay, pay with crypto, premium apparel, tech gear, wellness, travel essentials, curated essentials, member discounts, free shipping",
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
