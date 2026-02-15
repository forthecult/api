export const SEO_CONFIG = {
  /** Store logo URL. Shown in header and structured data. Omit to use site name in header and /logo.png in structured data. */
  brandLogoUrl: undefined as string | undefined,
  description:
    "For the Cult is a lifestyle store for people who invest in themselves. Curated tech, premium apparel, wellness gear, and travel essentials. Pay with crypto or card. Hold 250,000 CULT for free shipping.",
  fullName: "For the Cult",
  keywords:
    "For the Cult, lifestyle store, crypto store, Solana pay, pay with crypto, premium apparel, tech gear, wellness, travel essentials, curated essentials, member discounts, free shipping",
  /** used in meta description and open graph; keep under ~160 chars for SEO */
  metaDescription:
    "Curated tech, apparel & wellness gear. Pay with Solana, CULT or card. Hold CULT for free shipping, member discounts, and early access.",
  name: "For the Culture",
  slogan: "Where culture and technology converge.",
};

export const SYSTEM_CONFIG = {
  redirectAfterSignIn: "/dashboard/orders",
  redirectAfterSignUp: "/dashboard/orders",
  repoName: "ftc",
  repoOwner: "blefnk",
  repoStars: true,
};

export const ADMIN_CONFIG = {
  displayEmails: false,
};

/** active payment method for checkout; stripe is integrated but disabled until you enable it in the UI. checkout is guest-friendly (auth optional). */
export const PAYMENT_CONFIG = {
  activeMethod: "solana" as "solana" | "stripe",
  /** PayPal via Stripe Checkout. Enable after signing up for PayPal in Stripe Dashboard. */
  paypalEnabled: false,
  stripeEnabled: false,
};

export const DB_DEV_LOGGER = false;
