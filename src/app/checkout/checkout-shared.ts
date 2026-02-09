/**
 * Shared types and constants for checkout. Used by CheckoutClient and extracted
 * checkout components to avoid duplication and keep a single source of truth.
 */

import { cn } from "~/lib/cn";
import { secureStorageSync } from "~/lib/secure-storage";

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

export interface BillingFormState {
  country: string;
  firstName: string;
  lastName: string;
  company: string;
  street: string;
  apartment: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
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
  "US",
  "CA",
  "AU",
  "MX",
  "BR",
  "IN",
]);
/** Countries that do not use postal/zip codes. */
export const COUNTRIES_WITHOUT_POSTAL = new Set<string>(["HK"]);

export const US_STATE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "State" },
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "AA", label: "Armed Forces Americas" },
  { value: "AE", label: "Armed Forces Europe" },
  { value: "AP", label: "Armed Forces Pacific" },
  { value: "AS", label: "American Samoa" },
  { value: "GU", label: "Guam" },
  { value: "MP", label: "Northern Mariana Islands" },
  { value: "PR", label: "Puerto Rico" },
  { value: "VI", label: "U.S. Virgin Islands" },
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
  "flex w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground",
  checkoutFieldHeight,
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "disabled:pointer-events-none disabled:opacity-50",
);

// Policy content for popups
export const SHIPPING_POLICY_CONTENT =
  "We partner with a number of fulfillment partners in an effort to ship all orders as quickly as possible. Most orders ship within 1 business day, domestic order deliver within 2-4 business days, and international orders deliver within 2 weeks. During high-demand and peak seasons, shipping can sometimes take up to 2 weeks. Unfortunately we cannot ship to a P.O Box.";

export const REFUND_POLICY_SUMMARY =
  "We want you to be happy with your purchase. You have 30 days from delivery to request a return; items must be unworn/unused, with tags and original packaging. Contact us first for a return label. Refunds are processed within 10 business days after we receive and inspect your return. EU/UK: 14-day right to cancel for any reason.";

export const PRIVACY_POLICY_SUMMARY =
  "Your privacy matters to us. We collect only what we need—contact and account details, order and shipping info, and basic usage data for security. We do not sell your data or use it for targeted advertising. We use only essential cookies (sign-in, cart, security). You have rights to access, correct, delete, or port your data.";

export const TERMS_POLICY_SUMMARY =
  'By using Culture you agree to these terms and our Privacy, Refund, and Shipping policies. You must be the age of majority to use the service. We may refuse or cancel orders, limit quantities, and correct pricing errors. Products are provided "as is." We are not liable for indirect or consequential damages. We encourage contacting us first for disputes; governing law is the United States.';

/** Applied coupon as returned from validate/automatic APIs */
export interface AppliedCoupon {
  couponId: string;
  code: string;
  discountKind: string;
  discountType: string;
  discountValue: number;
  discountCents: number;
  freeShipping: boolean;
  totalAfterDiscountCents: number;
  source: "code" | "automatic";
}
