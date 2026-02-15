/**
 * Shared types and constants for checkout. Used by CheckoutClient and extracted
 * checkout components to avoid duplication and keep a single source of truth.
 */

import { cn } from "~/lib/cn";
import { secureStorageSync } from "~/lib/secure-storage";

export interface BillingFormState {
  apartment: string;
  city: string;
  company: string;
  country: string;
  firstName: string;
  lastName: string;
  phone: string;
  state: string;
  street: string;
  zip: string;
}

export interface CheckoutFormState {
  apartment: string;
  city: string;
  company: string;
  country: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  state: string;
  street: string;
  zip: string;
}

export const defaultBillingForm: BillingFormState = {
  apartment: "",
  city: "",
  company: "",
  country: "",
  firstName: "",
  lastName: "",
  phone: "",
  state: "",
  street: "",
  zip: "",
};

export const defaultForm: CheckoutFormState = {
  apartment: "",
  city: "",
  company: "",
  country: "",
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  state: "",
  street: "",
  zip: "",
};

/** Countries that use state/province as a distinct required field. */
export const COUNTRIES_REQUIRING_STATE = new Set([
  "AU",
  "BR",
  "CA",
  "IN",
  "MX",
  "US",
]);
/** Countries that do not use postal/zip codes. */
export const COUNTRIES_WITHOUT_POSTAL = new Set<string>(["HK"]);

export const US_STATE_OPTIONS: { label: string; value: string }[] = [
  { label: "State", value: "" },
  { label: "Alabama", value: "AL" },
  { label: "Alaska", value: "AK" },
  { label: "Arizona", value: "AZ" },
  { label: "Arkansas", value: "AR" },
  { label: "California", value: "CA" },
  { label: "Colorado", value: "CO" },
  { label: "Connecticut", value: "CT" },
  { label: "Delaware", value: "DE" },
  { label: "District of Columbia", value: "DC" },
  { label: "Florida", value: "FL" },
  { label: "Georgia", value: "GA" },
  { label: "Hawaii", value: "HI" },
  { label: "Idaho", value: "ID" },
  { label: "Illinois", value: "IL" },
  { label: "Indiana", value: "IN" },
  { label: "Iowa", value: "IA" },
  { label: "Kansas", value: "KS" },
  { label: "Kentucky", value: "KY" },
  { label: "Louisiana", value: "LA" },
  { label: "Maine", value: "ME" },
  { label: "Maryland", value: "MD" },
  { label: "Massachusetts", value: "MA" },
  { label: "Michigan", value: "MI" },
  { label: "Minnesota", value: "MN" },
  { label: "Mississippi", value: "MS" },
  { label: "Missouri", value: "MO" },
  { label: "Montana", value: "MT" },
  { label: "Nebraska", value: "NE" },
  { label: "Nevada", value: "NV" },
  { label: "New Hampshire", value: "NH" },
  { label: "New Jersey", value: "NJ" },
  { label: "New Mexico", value: "NM" },
  { label: "New York", value: "NY" },
  { label: "North Carolina", value: "NC" },
  { label: "North Dakota", value: "ND" },
  { label: "Ohio", value: "OH" },
  { label: "Oklahoma", value: "OK" },
  { label: "Oregon", value: "OR" },
  { label: "Pennsylvania", value: "PA" },
  { label: "Rhode Island", value: "RI" },
  { label: "South Carolina", value: "SC" },
  { label: "South Dakota", value: "SD" },
  { label: "Tennessee", value: "TN" },
  { label: "Texas", value: "TX" },
  { label: "Utah", value: "UT" },
  { label: "Vermont", value: "VT" },
  { label: "Virginia", value: "VA" },
  { label: "Washington", value: "WA" },
  { label: "West Virginia", value: "WV" },
  { label: "Wisconsin", value: "WI" },
  { label: "Wyoming", value: "WY" },
  { label: "Armed Forces Americas", value: "AA" },
  { label: "Armed Forces Europe", value: "AE" },
  { label: "Armed Forces Pacific", value: "AP" },
  { label: "American Samoa", value: "AS" },
  { label: "Guam", value: "GU" },
  { label: "Northern Mariana Islands", value: "MP" },
  { label: "Puerto Rico", value: "PR" },
  { label: "U.S. Virgin Islands", value: "VI" },
];

export const CHECKOUT_SHIPPING_STORAGE_KEY = "checkout-shipping";

/**
 * Get persisted shipping form from encrypted storage (PII encrypted at rest).
 */
export function getPersistedShippingForm(): CheckoutFormState {
  if (typeof window === "undefined") return defaultForm;
  try {
    const raw = secureStorageSync.getItem(CHECKOUT_SHIPPING_STORAGE_KEY);
    if (!raw) return defaultForm;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      ...defaultForm,
      ...(typeof parsed.email === "string" && { email: parsed.email }),
      ...(typeof parsed.firstName === "string" && {
        firstName: parsed.firstName,
      }),
      ...(typeof parsed.lastName === "string" && { lastName: parsed.lastName }),
      ...(typeof parsed.country === "string" && { country: parsed.country }),
      ...(typeof parsed.street === "string" && { street: parsed.street }),
      ...(typeof parsed.apartment === "string" && {
        apartment: parsed.apartment,
      }),
      ...(typeof parsed.city === "string" && { city: parsed.city }),
      ...(typeof parsed.state === "string" && { state: parsed.state }),
      ...(typeof parsed.zip === "string" && { zip: parsed.zip }),
      ...(typeof parsed.phone === "string" && { phone: parsed.phone }),
      ...(typeof parsed.company === "string" && { company: parsed.company }),
    };
  } catch {
    return defaultForm;
  }
}

/**
 * Persist shipping form to encrypted storage.
 */
export function persistShippingForm(form: CheckoutFormState): void {
  try {
    secureStorageSync.setItem(
      CHECKOUT_SHIPPING_STORAGE_KEY,
      JSON.stringify(form),
    );
  } catch {
    // Ignore quota or private mode errors
  }
}

// Field and layout CSS
export const checkoutFieldHeight = "h-11";
export const paymentOptionRowClass =
  "min-h-12 flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-card p-3 transition-colors hover:bg-muted/30 dark:hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20";
export const paymentButtonClass = "h-[3.75rem] w-full";
export const selectInputClass = cn(
  `
    flex w-full rounded-md border border-input bg-background px-3 py-1 text-sm
    text-foreground
  `,
  checkoutFieldHeight,
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
  "disabled:pointer-events-none disabled:opacity-50",
);

// Policy content for popups
export const SHIPPING_POLICY_CONTENT =
  "We partner with a number of fulfillment partners in an effort to ship all orders as quickly as possible. Most orders ship within 1 business day, domestic order deliver within 2-4 business days, and international orders deliver within 2 weeks. During high-demand and peak seasons, shipping can sometimes take up to 2 weeks. Unfortunately we cannot ship to a P.O Box.";

export const REFUND_POLICY_SUMMARY =
  "We want you to be happy with your purchase. You have 30 days from delivery to request a return; items must be unworn/unused, with tags and original packaging. Contact us first for a return label. Refunds are processed within 10 business days after we receive and inspect your return. EU/UK: 14-day right to cancel for any reason.";

/** Short eSIM refund rules for checkout popup when cart contains eSIM. */
export const ESIM_REFUND_POPUP_ITEMS = [
  "Instant refund only for verified technical/install or carrier signal failure; eSIM must not be activated and have no data use.",
  "Once activated or any data used, eSIM is non-refundable.",
  "Unused eSIMs: refund request within 30 days of purchase only.",
  "No refund for carrier outages, country shutdowns, or local regulations.",
  "Vodafone & O2: valid only in supported countries; use outside = disabled, no refund.",
  "Plans with Voice and/or SMS: always non-refundable.",
] as const;

export const PRIVACY_POLICY_SUMMARY =
  "Your privacy matters to us. We collect only what we need—contact and account details, order and shipping info, and basic usage data for security. We do not sell your data or use it for targeted advertising. We use only essential cookies (sign-in, cart, security). You have rights to access, correct, delete, or port your data.";

export const TERMS_POLICY_SUMMARY =
  'By using Culture you agree to these terms and our Privacy, Refund, and Shipping policies. You must be the age of majority to use the service. We may refuse or cancel orders, limit quantities, and correct pricing errors. Products are provided "as is." We are not liable for indirect or consequential damages. We encourage contacting us first for disputes; governing law is the United States.';

/** Applied coupon as returned from validate/automatic APIs */
export interface AppliedCoupon {
  code: string;
  couponId: string;
  discountCents: number;
  discountKind: string;
  discountType: string;
  discountValue: number;
  freeShipping: boolean;
  source: "automatic" | "code";
  totalAfterDiscountCents: number;
}

/** Common order payload built by CheckoutClient and passed to PaymentMethodSection for create-order APIs */
export interface OrderPayload {
  commonBody: Record<string, unknown>;
  email: string;
  emailNewsVal: boolean;
  form: CheckoutFormState | undefined;
  orderItems: {
    name: string;
    priceCents: number;
    productId: string;
    productVariantId?: string;
    quantity: number;
  }[];
  orderTotalCents: number;
  shippingFeeCentsRounded: number;
  subtotalCents: number;
  taxCentsRounded: number;
  textNewsVal: boolean;
}
