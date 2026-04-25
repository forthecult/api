"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useCurrentUserOrRedirect } from "~/lib/auth-client";
import { Button } from "~/ui/primitives/button";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";
import { Textarea } from "~/ui/primitives/textarea";

export type WriteReviewVisibility = "account" | "anonymous" | "custom";

/**
 * Post-purchase review: fields aligned with the public XML feed
 * (`/feeds/product-reviews.xml`) and Google’s product review feed (reviewer
 * name, title, body, rating, product URL, GTIN/MPN/brand from catalog).
 */
export function WriteReviewClient({
  initialProductSlug = "",
}: {
  initialProductSlug?: string;
}) {
  const { isPending, user } = useCurrentUserOrRedirect();
  const [productSlug, setProductSlug] = useState(initialProductSlug);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(5);
  const [visibility, setVisibility] =
    useState<WriteReviewVisibility>("account");
  const [customName, setCustomName] = useState("");
  const [location, setLocation] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (initialProductSlug.trim()) {
      setProductSlug((prev) =>
        prev.trim() ? prev : initialProductSlug.trim(),
      );
    }
  }, [initialProductSlug]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productSlug.trim() || !body.trim()) {
      toast.error("Product and review text are required.");
      return;
    }
    if (visibility === "custom" && !customName.trim()) {
      toast.error(
        "Enter the public name you want shown, or change visibility.",
      );
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/reviews/submit", {
        body: JSON.stringify({
          customName: customName.trim() || null,
          location: location.trim() || null,
          productSlug: productSlug.trim(),
          rating,
          text: body.trim(),
          title: title.trim() || null,
          visibility,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Could not send review");
      }
      toast.success(
        "Thanks — we’ll review and publish if it meets our guidelines.",
      );
      setTitle("");
      setBody("");
      setLocation("");
      setCustomName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send review");
    } finally {
      setSending(false);
    }
  };

  if (isPending || !user) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Write a review</h1>
      <p className="text-sm text-muted-foreground">
        We only accept reviews from verified purchases. After moderation, a
        review can appear on the product page and in our public feed.
      </p>

      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div>
          <Label className="text-sm" htmlFor="slug">
            Product (slug or full path)
          </Label>
          <Input
            className="mt-1.5"
            id="slug"
            onChange={(e) => setProductSlug(e.target.value)}
            placeholder="e.g. lions-mane-… or https://…/lions-…"
            value={productSlug}
          />
          {initialProductSlug && (
            <p className="mt-1 text-xs text-muted-foreground">
              Pre-filled from the link. You can still change it.
            </p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium" id="rating-stars">
            Overall rating
          </p>
          <div
            aria-labelledby="rating-stars"
            className="mt-2 flex gap-1"
            role="group"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                className={`
                  rounded p-0.5 text-amber-400 transition-opacity
                  hover:opacity-90
                `}
                key={n}
                onClick={() => setRating(n)}
                type="button"
              >
                <Star
                  className={`
                    h-7 w-7
                    ${
                      n <= rating
                        ? "fill-current"
                        : "fill-transparent text-muted-foreground/35"
                    }
                  `}
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-sm" htmlFor="title">
            Review title (optional, included in the feed)
          </Label>
          <Input
            className="mt-1.5"
            id="title"
            onChange={(e) => setTitle(e.target.value)}
            value={title}
          />
        </div>

        <div>
          <Label className="text-sm" htmlFor="text">
            Review
          </Label>
          <Textarea
            className="mt-1.5 min-h-[120px]"
            id="text"
            onChange={(e) => setBody(e.target.value)}
            value={body}
          />
        </div>

        <fieldset className="space-y-2 border border-border/60 p-3">
          <legend className="px-1 text-sm font-medium">
            Public name in feed
          </legend>
          <p className="text-xs text-muted-foreground">
            Google and our XML feed use the reviewer name you choose here (or
            “Anonymous” when selected).
          </p>
          <div className="space-y-2 text-sm">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                checked={visibility === "account"}
                className="mt-1"
                name="vis"
                onChange={() => setVisibility("account")}
                type="radio"
                value="account"
              />
              <span>
                Use my account name (first word shown if we only store a full
                name)
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                checked={visibility === "custom"}
                className="mt-1"
                name="vis"
                onChange={() => setVisibility("custom")}
                type="radio"
                value="custom"
              />
              <span>Custom public name (1–80 characters)</span>
            </label>
            {visibility === "custom" && (
              <Input
                className="mt-1"
                id="custom-name"
                maxLength={80}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Jordan"
                value={customName}
              />
            )}
            <label className="flex cursor-pointer items-start gap-2">
              <input
                checked={visibility === "anonymous"}
                className="mt-1"
                name="vis"
                onChange={() => setVisibility("anonymous")}
                type="radio"
                value="anonymous"
              />
              <span>Anonymous in the public feed and Google export</span>
            </label>
          </div>
        </fieldset>

        <div>
          <Label className="text-sm" htmlFor="location">
            Location (optional, e.g. city or region; included in the feed if
            provided)
          </Label>
          <Input
            className="mt-1.5"
            id="location"
            maxLength={200}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Austin, TX"
            value={location}
          />
        </div>

        <details className="rounded-md border border-border/60 p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Product IDs in the feed
          </summary>
          <p className="mt-2 text-muted-foreground">
            <strong>GTIN</strong>, <strong>MPN</strong>, and{" "}
            <strong>brand</strong> are taken from the product in our catalog
            when the review is approved — you do not need to enter them. The
            product page URL, review text, title, star rating, and timestamps
            are included in{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              /feeds/product-reviews.xml
            </code>
            .
          </p>
        </details>

        <div className="flex flex-wrap gap-2">
          <Button disabled={sending} type="submit">
            {sending ? "Sending…" : "Submit for moderation"}
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link href="/dashboard/orders">Your orders</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
