"use client";

import { Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import type { Address } from "~/db/schema/addresses/types";
import type { MappedShippingAddress } from "~/lib/loqate";

import {
  createAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
} from "~/app/dashboard/addresses/actions";
import { useLoqateAutocomplete } from "~/hooks/use-loqate-autocomplete";
import { cn } from "~/lib/cn";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader } from "~/ui/primitives/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/ui/primitives/dialog";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

interface AddressesPageClientProps {
  addresses: Address[];
}

const COUNTRY_OPTIONS: { label: string; value: string }[] = [
  { label: "Select country", value: "" },
  { label: "United States", value: "US" },
  { label: "Canada", value: "CA" },
  { label: "United Kingdom", value: "GB" },
  { label: "Australia", value: "AU" },
  { label: "Germany", value: "DE" },
  { label: "France", value: "FR" },
  { label: "Spain", value: "ES" },
  { label: "Italy", value: "IT" },
  { label: "Netherlands", value: "NL" },
  { label: "Japan", value: "JP" },
  { label: "New Zealand", value: "NZ" },
  { label: "Hong Kong", value: "HK" },
  { label: "United Arab Emirates", value: "AE" },
  { label: "Israel", value: "IL" },
  { label: "South Korea", value: "KR" },
  { label: "Mexico", value: "MX" },
  { label: "Brazil", value: "BR" },
  { label: "India", value: "IN" },
  { label: "Other", value: "OTHER" },
];

const emptyForm = {
  address1: "",
  address2: "",
  city: "",
  countryCode: "",
  label: "",
  phone: "",
  stateCode: "",
  zip: "",
};

export function AddressesPageClient({ addresses }: AddressesPageClientProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");
  const onLoqateSelect = useCallback((mapped: MappedShippingAddress) => {
    setForm((prev) => ({
      ...prev,
      address1: mapped.street,
      address2: mapped.apartment || prev.address2,
      city: mapped.city,
      countryCode: mapped.country || prev.countryCode,
      stateCode: mapped.state,
      zip: mapped.zip,
    }));
  }, []);

  const loqate = useLoqateAutocomplete({
    country: form.countryCode,
    enabled: addOpen,
    onSelect: onLoqateSelect,
    text: form.address1 ?? "",
  });

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    loqate.reset();
    setAddOpen(true);
  };

  const openEdit = (addr: Address) => {
    setEditing(addr);
    const countryValue =
      COUNTRY_OPTIONS.find(
        (o) => o.value === addr.countryCode || o.label === addr.countryCode,
      )?.value ?? addr.countryCode;
    setForm({
      address1: addr.address1,
      address2: addr.address2 ?? "",
      city: addr.city,
      countryCode: countryValue,
      label: addr.label ?? "",
      phone: addr.phone ?? "",
      stateCode: addr.stateCode ?? "",
      zip: addr.zip,
    });
    setFormError("");
    setEditOpen(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setPending(true);
    const res = await createAddress({
      address1: form.address1,
      address2: form.address2 || undefined,
      city: form.city,
      countryCode: form.countryCode,
      label: form.label || undefined,
      phone: form.phone || undefined,
      stateCode: form.stateCode || undefined,
      zip: form.zip,
    });
    setPending(false);
    if (res.error) {
      setFormError(
        typeof res.error === "string"
          ? res.error
          : "Failed to add address. Please try again.",
      );
      return;
    }
    setAddOpen(false);
    setForm(emptyForm);
    router.refresh();
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setFormError("");
    setPending(true);
    const res = await updateAddress(editing.id, {
      address1: form.address1,
      address2: form.address2 || undefined,
      city: form.city,
      countryCode: form.countryCode,
      label: form.label || undefined,
      phone: form.phone || undefined,
      stateCode: form.stateCode || undefined,
      zip: form.zip,
    });
    setPending(false);
    if (res.error) {
      setFormError(
        typeof res.error === "string"
          ? res.error
          : "Failed to update address. Please try again.",
      );
      return;
    }
    setEditOpen(false);
    setEditing(null);
    setForm(emptyForm);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this address?")) return;
    const res = await deleteAddress(id);
    if (!res.error) router.refresh();
  };

  const handleSetDefault = async (id: string) => {
    const res = await setDefaultAddress(id);
    if (!res.error) router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-7 w-7" />
          <h1 className="text-2xl font-semibold tracking-tight">
            My Addresses
          </h1>
        </div>
        <Dialog onOpenChange={setAddOpen} open={addOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add address
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add address</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd}>
              {formError && (
                <div className="mb-2 text-sm font-medium text-destructive">
                  {formError}
                </div>
              )}
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="add-label">Label (optional)</Label>
                  <Input
                    id="add-label"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, label: e.target.value }))
                    }
                    placeholder="e.g. Home, Work"
                    value={form.label}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-address1">Address line 1 *</Label>
                  <div className="relative">
                    <Input
                      aria-autocomplete="list"
                      aria-expanded={loqate.open}
                      id="add-address1"
                      onBlur={() => {
                        loqate.inputFocusedRef.current = false;
                        setTimeout(() => loqate.setOpen(false), 200);
                      }}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, address1: e.target.value }))
                      }
                      onFocus={() => {
                        loqate.inputFocusedRef.current = true;
                        if (loqate.suggestions.length > 0) loqate.setOpen(true);
                      }}
                      placeholder="Start typing to search address"
                      required
                      value={form.address1}
                    />
                    {loqate.open &&
                      (loqate.suggestions.length > 0 || loqate.loading) && (
                        <div
                          className={`
                            absolute top-full right-0 left-0 z-50 mt-1 max-h-60
                            overflow-auto rounded-md border border-border
                            bg-background
                          `}
                          role="listbox"
                        >
                          {loqate.loading && loqate.suggestions.length === 0 ? (
                            <div
                              className={`
                                flex items-center gap-2 px-3 py-2 text-sm
                                text-muted-foreground
                              `}
                            >
                              <Loader2
                                aria-hidden
                                className="h-4 w-4 shrink-0 animate-spin"
                              />
                              Finding addresses…
                            </div>
                          ) : (
                            loqate.suggestions
                              .filter((item) => item.Type === "Address")
                              .map((item) => (
                                <button
                                  className={cn(
                                    `
                                      w-full cursor-pointer px-3 py-2 text-left
                                      text-sm
                                    `,
                                    `
                                      hover:bg-muted
                                      focus:bg-muted focus:outline-none
                                    `,
                                  )}
                                  key={item.Id}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    loqate.selectAddress(item.Id);
                                  }}
                                  role="option"
                                  type="button"
                                >
                                  <span className="font-medium">
                                    {item.Text}
                                  </span>
                                  {item.Description ? (
                                    <span className="ml-1 text-muted-foreground">
                                      {item.Description}
                                    </span>
                                  ) : null}
                                </button>
                              ))
                          )}
                        </div>
                      )}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-address2">
                    Address line 2 (optional)
                  </Label>
                  <Input
                    id="add-address2"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address2: e.target.value }))
                    }
                    value={form.address2}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-phone">Phone (optional)</Label>
                  <Input
                    id="add-phone"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    placeholder="+1 234 567 8900"
                    value={form.phone}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="add-city">City *</Label>
                    <Input
                      id="add-city"
                      onChange={(e) =>
                        setForm((f) => ({ ...f, city: e.target.value }))
                      }
                      required
                      value={form.city}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="add-stateCode">
                      State / Region (2-letter code)
                    </Label>
                    <Input
                      id="add-stateCode"
                      onChange={(e) =>
                        setForm((f) => ({ ...f, stateCode: e.target.value }))
                      }
                      placeholder="e.g. CA, NY"
                      value={form.stateCode}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="add-zip">Postal code *</Label>
                    <Input
                      id="add-zip"
                      onChange={(e) =>
                        setForm((f) => ({ ...f, zip: e.target.value }))
                      }
                      required
                      value={form.zip}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="add-countryCode">Country *</Label>
                    <select
                      className={`
                        flex h-9 w-full rounded-md border border-input
                        bg-transparent px-3 py-1 text-sm
                        transition-[color,box-shadow] outline-none
                        focus-visible:ring-2 focus-visible:ring-ring
                        disabled:cursor-not-allowed disabled:opacity-50
                      `}
                      id="add-countryCode"
                      onChange={(e) =>
                        setForm((f) => ({ ...f, countryCode: e.target.value }))
                      }
                      required
                      value={form.countryCode}
                    >
                      {COUNTRY_OPTIONS.map((opt) => (
                        <option key={opt.value || "empty"} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={pending}
                  onClick={() => setAddOpen(false)}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button disabled={pending} type="submit">
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {addresses.length === 0 ? (
        <Card>
          <CardContent
            className={`flex flex-col items-center justify-center py-12`}
          >
            <p className="text-muted-foreground">No saved addresses yet.</p>
            <Button className="mt-4" onClick={openAdd} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add your first address
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {addresses.map((addr) => (
            <li key={addr.id}>
              <Card>
                <CardHeader
                  className={`
                    flex flex-row items-start justify-between space-y-0 pb-2
                  `}
                >
                  <div>
                    {addr.label && (
                      <span
                        className={`text-sm font-medium text-muted-foreground`}
                      >
                        {addr.label}
                      </span>
                    )}
                    {addr.isDefault && (
                      <span
                        className={`
                          ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs
                          font-medium text-primary
                        `}
                      >
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!addr.isDefault && (
                      <Button
                        onClick={() => handleSetDefault(addr.id)}
                        size="sm"
                        variant="ghost"
                      >
                        Set default
                      </Button>
                    )}
                    <Button
                      onClick={() => openEdit(addr)}
                      size="icon"
                      variant="ghost"
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      onClick={() => handleDelete(addr.id)}
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{formatAddress(addr)}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog onOpenChange={setEditOpen} open={editOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit address</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            {formError && (
              <div className="mb-2 text-sm font-medium text-destructive">
                {formError}
              </div>
            )}
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-label">Label (optional)</Label>
                <Input
                  id="edit-label"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, label: e.target.value }))
                  }
                  placeholder="e.g. Home, Work"
                  value={form.label}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-address1">Address line 1 *</Label>
                <Input
                  id="edit-address1"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address1: e.target.value }))
                  }
                  required
                  value={form.address1}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-address2">Address line 2 (optional)</Label>
                <Input
                  id="edit-address2"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address2: e.target.value }))
                  }
                  value={form.address2}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Phone (optional)</Label>
                <Input
                  id="edit-phone"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+1 234 567 8900"
                  value={form.phone}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-city">City *</Label>
                  <Input
                    id="edit-city"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, city: e.target.value }))
                    }
                    required
                    value={form.city}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-stateCode">
                    State / Region (2-letter code)
                  </Label>
                  <Input
                    id="edit-stateCode"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, stateCode: e.target.value }))
                    }
                    placeholder="e.g. CA, NY"
                    value={form.stateCode}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-zip">Postal code *</Label>
                  <Input
                    id="edit-zip"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, zip: e.target.value }))
                    }
                    required
                    value={form.zip}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-countryCode">Country *</Label>
                  <select
                    className={`
                      flex h-9 w-full rounded-md border border-input
                      bg-transparent px-3 py-1 text-sm
                      transition-[color,box-shadow] outline-none
                      focus-visible:ring-2 focus-visible:ring-ring
                      disabled:cursor-not-allowed disabled:opacity-50
                    `}
                    id="edit-countryCode"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, countryCode: e.target.value }))
                    }
                    required
                    value={form.countryCode}
                  >
                    {COUNTRY_OPTIONS.map((opt) => (
                      <option key={opt.value || "empty"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={pending}
                onClick={() => setEditOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={pending} type="submit">
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function countryLabel(countryCode: string): string {
  const opt = COUNTRY_OPTIONS.find(
    (o) => o.value === countryCode || o.label === countryCode,
  );
  return opt?.label ?? countryCode;
}

function formatAddress(addr: Address): string {
  const parts = [
    addr.address1,
    addr.address2,
    [addr.city, addr.stateCode].filter(Boolean).join(", "),
    addr.zip,
    countryLabel(addr.countryCode),
  ].filter(Boolean);
  return parts.join(", ");
}
