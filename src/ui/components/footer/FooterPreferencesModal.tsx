"use client";

import { Check, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "~/lib/cn";
import { countryFlag } from "~/lib/country-flag";
import {
  COUNTRY_OPTIONS_ALPHABETICAL,
  type CountryCode,
  CURRENCY_OPTIONS,
  defaultCurrencyForCountry,
  LANGUAGE_OPTIONS,
  useCountryCurrency,
} from "~/lib/hooks/use-country-currency";
import { Button } from "~/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/ui/primitives/dialog";
import { Input } from "~/ui/primitives/input";

type View = "country" | "currency" | "main";

export function FooterPreferencesModal({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const { currency, selectedCountry, setPreferences } = useCountryCurrency();

  const [view, setView] = useState<View>("main");
  const [draftCountry, setDraftCountry] =
    useState<CountryCode>(selectedCountry);
  const [draftCurrency, setDraftCurrency] = useState(currency);
  const [countrySearch, setCountrySearch] = useState("");
  const [currencySearch, setCurrencySearch] = useState("");
  const countrySearchInputRef = useRef<HTMLInputElement>(null);

  const currentCountryOption = useMemo(
    () => COUNTRY_OPTIONS_ALPHABETICAL.find((o) => o.code === draftCountry),
    [draftCountry],
  );
  const currentCurrencyOption = useMemo(
    () => CURRENCY_OPTIONS.find((o) => o.code === draftCurrency),
    [draftCurrency],
  );

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return COUNTRY_OPTIONS_ALPHABETICAL;
    return COUNTRY_OPTIONS_ALPHABETICAL.filter(
      (o) =>
        o.countryName.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q) ||
        q.includes(o.code.toLowerCase()),
    );
  }, [countrySearch]);

  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.trim().toLowerCase();
    if (!q) return CURRENCY_OPTIONS;
    return CURRENCY_OPTIONS.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.code.toLowerCase().includes(q),
    );
  }, [currencySearch]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setView("main");
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const handleSave = useCallback(() => {
    setPreferences(draftCountry, draftCurrency);
    onOpenChange(false);
  }, [draftCountry, draftCurrency, setPreferences, onOpenChange]);

  const openCountry = useCallback(() => {
    setDraftCountry(selectedCountry);
    setCountrySearch("");
    setView("country");
  }, [selectedCountry]);

  const openCurrency = useCallback(() => {
    setDraftCurrency(currency);
    setCurrencySearch("");
    setView("currency");
  }, [currency]);

  const selectCountry = useCallback((code: CountryCode) => {
    setDraftCountry(code);
    setDraftCurrency(defaultCurrencyForCountry(code));
    setView("main");
  }, []);

  const selectCurrency = useCallback((code: string) => {
    setDraftCurrency(code);
    setView("main");
  }, []);

  useEffect(() => {
    if (open) {
      setDraftCountry(selectedCountry);
      setDraftCurrency(currency);
      setView("main");
    }
  }, [open, selectedCountry, currency]);

  useEffect(() => {
    if (view === "country") {
      countrySearchInputRef.current?.focus();
    }
  }, [view]);

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => view !== "main" && e.preventDefault()}
      >
        {view === "main" && (
          <>
            <DialogHeader>
              <DialogTitle>Preferences</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Country
                </span>
                <button
                  className={cn(
                    `
                      flex w-full items-center justify-between rounded-lg border
                      border-input bg-background px-4 py-3 text-left
                    `,
                    `
                      hover:bg-muted/50
                      focus:ring-2 focus:ring-ring focus:ring-offset-2
                      focus:outline-none
                    `,
                  )}
                  onClick={openCountry}
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="text-xl">
                      {currentCountryOption
                        ? countryFlag(currentCountryOption.code)
                        : "🌐"}
                    </span>
                    <span className="font-medium">
                      {currentCountryOption?.countryName ?? "Country"}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="grid gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Currency
                </span>
                <button
                  className={cn(
                    `
                      flex w-full items-center justify-between rounded-lg border
                      border-input bg-background px-4 py-3 text-left
                    `,
                    `
                      hover:bg-muted/50
                      focus:ring-2 focus:ring-ring focus:ring-offset-2
                      focus:outline-none
                    `,
                  )}
                  onClick={openCurrency}
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {currentCurrencyOption?.symbol ?? "$"}
                    </span>
                    <span className="font-medium">
                      {currentCurrencyOption
                        ? `${currentCurrencyOption.code} - ${currentCurrencyOption.label}`
                        : "Payment currency"}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="grid gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Language
                </span>
                <div
                  aria-label="Language (English only for now)"
                  className={cn(
                    `
                      flex w-full items-center justify-between rounded-lg border
                      border-input bg-background px-4 py-3
                    `,
                    "text-muted-foreground",
                  )}
                >
                  <span className="font-medium">
                    {LANGUAGE_OPTIONS[0]?.label ?? "English"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t pt-4">
              <Button onClick={handleSave}>Save</Button>
            </div>
          </>
        )}

        {view === "country" && (
          <>
            <div className="flex items-center gap-2">
              <Button
                aria-label="Back"
                onClick={() => setView("main")}
                size="icon"
                type="button"
                variant="ghost"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <DialogTitle className="flex-1 text-center">Country</DialogTitle>
              <div className="w-10" />
            </div>
            <div className="relative">
              <Search
                className={`
                  absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2
                  text-muted-foreground
                `}
              />
              <Input
                className="pl-9"
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder="Search country"
                ref={countrySearchInputRef}
                value={countrySearch}
              />
            </div>
            <ul
              className={`
                max-h-[60vh] overflow-auto rounded-md border border-input
              `}
            >
              {filteredCountries.map((o) => (
                <li key={o.code}>
                  <button
                    aria-selected={draftCountry === o.code}
                    className={cn(
                      `
                        flex w-full items-center justify-between gap-2 px-4 py-3
                        text-left
                      `,
                      `
                        hover:bg-muted/50
                        focus:bg-muted/50 focus:outline-none
                      `,
                      draftCountry === o.code && "bg-muted/50",
                    )}
                    onClick={() => selectCountry(o.code)}
                    role="option"
                    type="button"
                  >
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="text-xl">
                        {countryFlag(o.code)}
                      </span>
                      <span>{o.countryName}</span>
                    </span>
                    {draftCountry === o.code && (
                      <Check
                        className={`
                          h-5 w-5 shrink-0 text-green-600
                          dark:text-green-400
                        `}
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {view === "currency" && (
          <>
            <div className="flex items-center gap-2">
              <Button
                aria-label="Back"
                onClick={() => setView("main")}
                size="icon"
                type="button"
                variant="ghost"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <DialogTitle className="flex-1 text-center">
                Payment currency
              </DialogTitle>
              <div className="w-10" />
            </div>
            <div className="relative">
              <Search
                className={`
                  absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2
                  text-muted-foreground
                `}
              />
              <Input
                className="pl-9"
                onChange={(e) => setCurrencySearch(e.target.value)}
                placeholder="Search currency"
                value={currencySearch}
              />
            </div>
            <ul
              className={`
                max-h-[60vh] overflow-auto rounded-md border border-input
              `}
            >
              {filteredCurrencies.map((o) => (
                <li key={o.code}>
                  <button
                    aria-selected={draftCurrency === o.code}
                    className={cn(
                      `
                        flex w-full items-center justify-between gap-2 px-4 py-3
                        text-left
                      `,
                      `
                        hover:bg-muted/50
                        focus:bg-muted/50 focus:outline-none
                      `,
                      draftCurrency === o.code && "bg-muted/50",
                    )}
                    onClick={() => selectCurrency(o.code)}
                    role="option"
                    type="button"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">{o.symbol}</span>
                      <span>
                        {o.code} - {o.label}
                      </span>
                    </span>
                    {draftCurrency === o.code && (
                      <Check
                        className={`
                          h-5 w-5 shrink-0 text-green-600
                          dark:text-green-400
                        `}
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
