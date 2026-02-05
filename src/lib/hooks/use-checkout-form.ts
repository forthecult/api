"use client";

import { useCallback, useState } from "react";

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

const defaultShippingForm: CheckoutFormState = {
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

const defaultBillingForm: BillingFormState = {
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

interface UseCheckoutFormOptions {
  initialEmail?: string;
}

export function useCheckoutForm(options: UseCheckoutFormOptions = {}) {
  const [shippingForm, setShippingForm] = useState<CheckoutFormState>(() => ({
    ...defaultShippingForm,
    email: options.initialEmail || "",
  }));

  const [billingForm, setBillingForm] =
    useState<BillingFormState>(defaultBillingForm);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const updateShipping = useCallback(
    (field: keyof CheckoutFormState, value: string) => {
      setShippingForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const updateBilling = useCallback(
    (field: keyof BillingFormState, value: string) => {
      setBillingForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const copyShippingToBilling = useCallback(() => {
    setBillingForm({
      apartment: shippingForm.apartment,
      city: shippingForm.city,
      company: shippingForm.company,
      country: shippingForm.country,
      firstName: shippingForm.firstName,
      lastName: shippingForm.lastName,
      phone: shippingForm.phone,
      state: shippingForm.state,
      street: shippingForm.street,
      zip: shippingForm.zip,
    });
  }, [shippingForm]);

  const getEffectiveBilling = useCallback((): BillingFormState => {
    if (billingSameAsShipping) {
      return {
        apartment: shippingForm.apartment,
        city: shippingForm.city,
        company: shippingForm.company,
        country: shippingForm.country,
        firstName: shippingForm.firstName,
        lastName: shippingForm.lastName,
        phone: shippingForm.phone,
        state: shippingForm.state,
        street: shippingForm.street,
        zip: shippingForm.zip,
      };
    }
    return billingForm;
  }, [billingSameAsShipping, shippingForm, billingForm]);

  const validateShipping = useCallback((): string | null => {
    if (!shippingForm.email.trim()) return "Email is required";
    if (!shippingForm.email.includes("@")) return "Invalid email address";
    if (!shippingForm.firstName.trim()) return "First name is required";
    if (!shippingForm.lastName.trim()) return "Last name is required";
    if (!shippingForm.street.trim()) return "Street address is required";
    if (!shippingForm.city.trim()) return "City is required";
    if (!shippingForm.zip.trim()) return "ZIP/postal code is required";
    if (!shippingForm.country.trim()) return "Country is required";
    return null;
  }, [shippingForm]);

  const validateBilling = useCallback((): string | null => {
    if (billingSameAsShipping) return null;
    if (!billingForm.firstName.trim()) return "Billing first name is required";
    if (!billingForm.lastName.trim()) return "Billing last name is required";
    if (!billingForm.street.trim()) return "Billing street address is required";
    if (!billingForm.city.trim()) return "Billing city is required";
    if (!billingForm.zip.trim()) return "Billing ZIP/postal code is required";
    if (!billingForm.country.trim()) return "Billing country is required";
    return null;
  }, [billingSameAsShipping, billingForm]);

  const reset = useCallback(() => {
    setShippingForm({
      ...defaultShippingForm,
      email: options.initialEmail || "",
    });
    setBillingForm(defaultBillingForm);
    setBillingSameAsShipping(true);
    setMarketingConsent(false);
  }, [options.initialEmail]);

  return {
    shippingForm,
    billingForm,
    billingSameAsShipping,
    marketingConsent,
    updateShipping,
    updateBilling,
    setBillingSameAsShipping,
    setMarketingConsent,
    copyShippingToBilling,
    getEffectiveBilling,
    validateShipping,
    validateBilling,
    reset,
  };
}
