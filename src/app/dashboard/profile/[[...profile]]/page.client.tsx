"use client";

import { Camera, ChevronLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useCurrentUserOrRedirect } from "~/lib/auth-client";
import { isRealEmail } from "~/lib/is-real-email";
import { Button } from "~/ui/primitives/button";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

export function ProfilePageClient() {
  const { isPending, user } = useCurrentUserOrRedirect();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load profile data from API to get firstName/lastName separately
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const res = await fetch("/api/user/profile", {
          credentials: "include",
        });
        if (res.ok) {
          const data = (await res.json()) as {
            email?: string;
            firstName?: string;
            lastName?: string;
            phone?: string;
          };
          setFirstName(data.firstName ?? "");
          setLastName(data.lastName ?? "");
          setEmail(data.email ?? user.email ?? "");
          setPhone(data.phone ?? "");
        } else {
          // Fallback to session data
          setEmail(user.email ?? "");
        }
      } catch {
        // Fallback to session data
        setEmail(user.email ?? "");
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [user]);

  if (isPending || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || null,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to save");
      }

      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          aria-label="Back to profile"
          asChild
          className="shrink-0"
          size="icon"
          variant="ghost"
        >
          <Link href="/dashboard/profile">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Edit Profile</h1>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div
              className={`
              relative size-24 overflow-hidden rounded-full border-2
              border-border bg-muted
            `}
            >
              {user?.image ? (
                <Image
                  alt=""
                  className="object-cover"
                  fill
                  sizes="96px"
                  src={user.image}
                />
              ) : (
                <span
                  className={`
                  flex size-full items-center justify-center text-2xl
                  font-semibold text-muted-foreground
                `}
                >
                  {(
                    firstName?.[0] ??
                    lastName?.[0] ??
                    user?.name?.[0] ??
                    "?"
                  ).toUpperCase()}
                </span>
              )}
            </div>
            <button
              aria-label="Change profile photo"
              className={`
                absolute right-0 bottom-0 flex size-8 items-center
                justify-center rounded-full border-2 border-background
                bg-primary text-primary-foreground shadow
                hover:bg-primary/90
              `}
              type="button"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>

          <div
            className={`
            grid w-full gap-4
            sm:grid-cols-2
          `}
          >
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                value={firstName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                value={lastName}
              />
            </div>
            {isRealEmail(email) && (
              <div
                className={`
                space-y-2
                sm:col-span-2
              `}
              >
                <Label htmlFor="email">Email</Label>
                <Input
                  className="bg-muted"
                  disabled
                  id="email"
                  placeholder="Email"
                  readOnly
                  type="email"
                  value={email}
                />
                <p className="text-xs text-muted-foreground">
                  Email is read-only. Change it in Security settings.
                </p>
              </div>
            )}
            <div
              className={`
              space-y-2
              sm:col-span-2
            `}
            >
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone"
                type="tel"
                value={phone}
              />
            </div>
          </div>
        </div>

        <Button
          className={`
          w-full
          sm:w-auto
        `}
          disabled={saving}
          type="submit"
        >
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </form>
    </div>
  );
}
