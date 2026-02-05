"use client";

import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  createAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
} from "~/app/dashboard/addresses/actions";
import type { Address } from "~/db/schema/addresses/types";
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

const COUNTRY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Select country" },
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "ES", label: "Spain" },
  { value: "IT", label: "Italy" },
  { value: "NL", label: "Netherlands" },
  { value: "JP", label: "Japan" },
  { value: "NZ", label: "New Zealand" },
  { value: "HK", label: "Hong Kong" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "IL", label: "Israel" },
  { value: "KR", label: "South Korea" },
  { value: "MX", label: "Mexico" },
  { value: "BR", label: "Brazil" },
  { value: "IN", label: "India" },
  { value: "OTHER", label: "Other" },
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

export function AddressesPageClient({ addresses }: AddressesPageClientProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [pending, setPending] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
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
    setEditOpen(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
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
    if (res.error) return;
    setAddOpen(false);
    setForm(emptyForm);
    router.refresh();
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
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
    if (res.error) return;
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
    <div className="container mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-7 w-7" />
          <h1 className="text-2xl font-semibold tracking-tight">
            My Addresses
          </h1>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
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
                  <Input
                    id="add-address1"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address1: e.target.value }))
                    }
                    required
                    value={form.address1}
                  />
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
                  <Label htmlFor="add-phone">
                    Phone (optional, required for Printful shipping)
                  </Label>
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
                      id="add-countryCode"
                      required
                      value={form.countryCode}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, countryCode: e.target.value }))
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                  type="button"
                  variant="outline"
                  onClick={() => setAddOpen(false)}
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
          <CardContent className="flex flex-col items-center justify-center py-12">
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
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    {addr.label && (
                      <span className="text-sm font-medium text-muted-foreground">
                        {addr.label}
                      </span>
                    )}
                    {addr.isDefault && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!addr.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSetDefault(addr.id)}
                      >
                        Set default
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(addr)}
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(addr.id)}
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit address</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit}>
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
                <Label htmlFor="edit-phone">
                  Phone (optional, required for Printful shipping)
                </Label>
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
                    id="edit-countryCode"
                    required
                    value={form.countryCode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, countryCode: e.target.value }))
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
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
