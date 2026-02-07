"use client";

import { ChevronLeft, ChevronRight, Check, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  COUNTRY_OPTIONS_ALPHABETICAL,
  CURRENCY_OPTIONS,
  LANGUAGE_OPTIONS,
  type CountryCode,
  useCountryCurrency,
} from "~/lib/hooks/use-country-currency";
import { countryFlag } from "~/lib/country-flag";
import { Button } from "~/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/ui/primitives/dialog";
import { Input } from "~/ui/primitives/input";
import { cn } from "~/lib/cn";

type View = "main" | "country" | "currency";

export function FooterPreferencesModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { selectedCountry, currency, setPreferences } = useCountryCurrency();

  const [view, setView] = useState<View>("main");
  const [draftCountry, setDraftCountry] =
    useState<CountryCode>(selectedCountry);
  const [draftCurrency, setDraftCurrency] = useState(currency);
  const [countrySearch, setCountrySearch] = useState("");
  const [currencySearch, setCurrencySearch] = useState("");

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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
                  type="button"
                  onClick={openCountry}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border border-input bg-background px-4 py-3 text-left",
                    "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-xl" aria-hidden>
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
                  type="button"
                  onClick={openCurrency}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border border-input bg-background px-4 py-3 text-left",
                    "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  )}
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
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border border-input bg-background px-4 py-3",
                    "text-muted-foreground",
                  )}
                  aria-label="Language (English only for now)"
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
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Back"
                onClick={() => setView("main")}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <DialogTitle className="flex-1 text-center">Country</DialogTitle>
              <div className="w-10" />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search country"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <ul
              className="max-h-[60vh] overflow-auto rounded-md border border-input"
              role="listbox"
            >
              {filteredCountries.map((o) => (
                <li key={o.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={draftCountry === o.code}
                    onClick={() => selectCountry(o.code)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-4 py-3 text-left",
                      "hover:bg-muted/50 focus:bg-muted/50 focus:outline-none",
                      draftCountry === o.code && "bg-muted/50",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-xl" aria-hidden>
                        {countryFlag(o.code)}
                      </span>
                      <span>{o.countryName}</span>
                    </span>
                    {draftCountry === o.code && (
                      <Check className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
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
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Back"
                onClick={() => setView("main")}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <DialogTitle className="flex-1 text-center">
                Payment currency
              </DialogTitle>
              <div className="w-10" />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search currency"
                value={currencySearch}
                onChange={(e) => setCurrencySearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <ul
              className="max-h-[60vh] overflow-auto rounded-md border border-input"
              role="listbox"
            >
              {filteredCurrencies.map((o) => (
                <li key={o.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={draftCurrency === o.code}
                    onClick={() => selectCurrency(o.code)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-4 py-3 text-left",
                      "hover:bg-muted/50 focus:bg-muted/50 focus:outline-none",
                      draftCurrency === o.code && "bg-muted/50",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">{o.symbol}</span>
                      <span>
                        {o.code} - {o.label}
                      </span>
                    </span>
                    {draftCurrency === o.code && (
                      <Check className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
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
