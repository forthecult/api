"use client";

import { Camera, ChevronLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useCurrentUserOrRedirect } from "~/lib/auth-client";
import { compressAvatarImage } from "~/lib/avatar-image-compress";
import {
  COUNTRY_OPTIONS_ALPHABETICAL,
  useCountryCurrency,
} from "~/lib/hooks/use-country-currency";
import { isRealEmail } from "~/lib/is-real-email";
import { getDialCodeForIso, parseE164ToForm } from "~/lib/phone-e164";
import { useUploadThing } from "~/lib/uploadthing";
import { Button } from "~/ui/primitives/button";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

const AVATAR_MAX_BYTES = 1024 * 1024; // 1MB
const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export function ProfilePageClient() {
  const { isPending, user } = useCurrentUserOrRedirect();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("US");
  const [birthDate, setBirthDate] = useState("");
  const [saving, setSaving] = useState(false);
  const { selectedCountry } = useCountryCurrency();
  const [loading, setLoading] = useState(true);
  const [avatarUrlOverride, setAvatarUrlOverride] = useState<null | string>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxBirthDateIso = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().slice(0, 10);
  }, []);

  const { isUploading, startUpload } = useUploadThing("avatarUploader", {
    onClientUploadComplete: (res) => {
      const first = Array.isArray(res) ? res[0] : res;
      let url: null | string = null;
      if (first && "fileUrl" in first && typeof first.fileUrl === "string")
        url = first.fileUrl;
      else if (
        first &&
        "url" in first &&
        typeof (first as { url: string }).url === "string"
      )
        url = (first as { url: string }).url;
      if (url) {
        setAvatarUrlOverride(url);
        void updateProfileImage(url);
      }
    },
    onUploadError: (e) => {
      toast.error(e?.message ?? "Upload failed");
    },
  });

  const updateProfileImage = async (url: string) => {
    try {
      const res = await fetch("/api/user/profile", {
        body: JSON.stringify({ image: url }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to update photo");
      }
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update photo",
      );
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Image must be 1 MB or smaller");
      return;
    }
    let toUpload = file;
    try {
      toUpload = await compressAvatarImage(file);
    } catch {
      // use original if compression fails (e.g. unsupported format)
    }
    void startUpload([toUpload]);
  };

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
            birthDate?: string;
            email?: string;
            firstName?: string;
            lastName?: string;
            phone?: string;
            phoneCountry?: string;
          };
          setFirstName(data.firstName ?? "");
          setLastName(data.lastName ?? "");
          setEmail(data.email ?? user.email ?? "");
          setBirthDate(
            (data.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(data.birthDate)
              ? data.birthDate
              : "") ?? "",
          );
          const pc = (data.phoneCountry ?? "").trim().toUpperCase().slice(0, 2);
          if (pc) {
            setPhoneCountry(pc);
          } else {
            setPhoneCountry((selectedCountry ?? "US") as string);
          }
          const parsed = parseE164ToForm(data.phone ?? "");
          setPhoneLocal(parsed.national);
          if (data.phone?.startsWith("+") && !pc) {
            setPhoneCountry(parsed.iso);
          }
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
  }, [user, selectedCountry]);

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
          birthDate: birthDate.trim() || null,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phoneCountry: phoneCountry.trim() || "US",
          phoneLocal: phoneLocal.trim() || null,
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
    <div className="flex flex-col gap-6">
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

      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <div className="flex flex-col items-center gap-6">
          <input
            accept={AVATAR_ACCEPT}
            className="hidden"
            onChange={handleAvatarFileChange}
            ref={fileInputRef}
            type="file"
          />
          <div className="relative">
            <div
              className={`
                relative size-24 overflow-hidden rounded-full border-2
                border-border bg-muted
              `}
            >
              {(avatarUrlOverride ?? user?.image) ? (
                <Image
                  alt=""
                  className="object-cover"
                  fill
                  sizes="96px"
                  src={avatarUrlOverride ?? user?.image ?? ""}
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
                disabled:opacity-50
              `}
              disabled={isUploading}
              onClick={handleAvatarClick}
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                value={firstName}
              />
            </div>
            <div className="flex flex-col gap-2">
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
                  flex flex-col gap-2
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
                flex flex-col gap-2
                sm:col-span-2
              `}
            >
              <Label htmlFor="birthDate">Birth date</Label>
              <Input
                id="birthDate"
                max={maxBirthDateIso}
                onChange={(e) => setBirthDate(e.target.value)}
                type="date"
                value={birthDate}
              />
            </div>
            <div
              className={`
                flex flex-col gap-2
                sm:col-span-2
              `}
            >
              <span className="text-sm font-medium">Phone</span>
              <div
                className={`
                  flex flex-col gap-2
                  sm:flex-row sm:items-end
                `}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Label className="text-xs" htmlFor="phoneCountry">
                    Country
                  </Label>
                  <select
                    className={`
                      flex h-9 w-full rounded-md border border-input
                      bg-background px-3 py-1 text-sm
                      focus-visible:ring-2 focus-visible:ring-ring
                      focus-visible:outline-none
                    `}
                    id="phoneCountry"
                    onChange={(e) => setPhoneCountry(e.target.value)}
                    value={phoneCountry}
                  >
                    {COUNTRY_OPTIONS_ALPHABETICAL.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.countryName} (+{getDialCodeForIso(c.code)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 flex-1">
                  <Label className="text-xs" htmlFor="phoneLocal">
                    Number
                  </Label>
                  <Input
                    className="mt-1.5"
                    id="phoneLocal"
                    inputMode="tel"
                    onChange={(e) => setPhoneLocal(e.target.value)}
                    placeholder="Phone number"
                    type="tel"
                    value={phoneLocal}
                  />
                </div>
              </div>
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
