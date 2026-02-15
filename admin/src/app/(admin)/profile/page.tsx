"use client";

import { ChevronLeft, Save, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  image: string | null;
  email: string;
};

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/user/profile`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) {
          setError("Please sign in.");
          return;
        }
        setError("Failed to load profile.");
        return;
      }
      const data = (await res.json()) as Profile;
      setProfile(data);
      setFirstName(data.firstName ?? "");
      setLastName(data.lastName ?? "");
      setAvatarPreview(data.image ?? null);
    } catch {
      setError("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAvatarFile(null);
      setAvatarPreview(profile?.image ?? null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setSaveMessage({
        type: "error",
        text: "Please select an image (JPEG, PNG, WebP, or GIF).",
      });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setSaveMessage({ type: "error", text: "Image must be under 4MB." });
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setSaveMessage(null);
  };

  const handleSave = useCallback(async () => {
    setSaveMessage(null);
    setSaveLoading(true);
    try {
      let imageUrl: string | null | undefined;

      if (avatarFile) {
        const formData = new FormData();
        formData.append("file", avatarFile);
        const uploadRes = await fetch(`${API_BASE}/api/user/avatar`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (!uploadRes.ok) {
          const err = (await uploadRes.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(err.error ?? "Upload failed");
        }
        const uploadData = (await uploadRes.json()) as { url: string };
        imageUrl = uploadData.url ?? null;
      }

      const res = await fetch(`${API_BASE}/api/user/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          ...(imageUrl !== undefined ? { image: imageUrl } : {}),
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Failed to save");
      }

      setSaveMessage({
        type: "success",
        text: "Profile saved. Your name and photo will appear when you reply in chat and support tickets.",
      });
      setAvatarFile(null);
      void fetchProfile();
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save profile.",
      });
    } finally {
      setSaveLoading(false);
    }
  }, [firstName, lastName, avatarFile, profile?.image, fetchProfile]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{error}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          href="/dashboard"
          aria-label="Back to Dashboard"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <User className="h-6 w-6" />
        <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Name & photo</CardTitle>
          <p className="text-sm text-muted-foreground">
            This name and photo are shown when you reply in Support Chat and
            Support Tickets, so customers see who they’re talking to.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {saveMessage && (
            <p
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                saveMessage.type === "success"
                  ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200"
                  : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200",
              )}
            >
              {saveMessage.text}
            </p>
          )}

          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-2">
              <div className="relative h-24 w-24 overflow-hidden rounded-full border bg-muted">
                {avatarPreview ? (
                  <Image
                    src={avatarPreview}
                    alt="Profile"
                    fill
                    className="object-cover"
                    unoptimized={avatarPreview.startsWith("blob:")}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl text-muted-foreground">
                    <User className="h-12 w-12" />
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Change photo
              </Button>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <label
                  htmlFor="first-name"
                  className="mb-1.5 block text-sm font-medium"
                >
                  First name
                </label>
                <input
                  id="first-name"
                  type="text"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="e.g. Jane"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="last-name"
                  className="mb-1.5 block text-sm font-medium"
                >
                  Last name
                </label>
                <input
                  id="last-name"
                  type="text"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="e.g. Smith"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Button
            type="button"
            disabled={saveLoading}
            onClick={() => void handleSave()}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveLoading ? "Saving…" : "Save"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
