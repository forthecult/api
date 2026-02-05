"use client";

import { KeyRound, Mail } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "~/lib/cn";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

const inputClass =
  "flex min-h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 placeholder:text-muted-foreground disabled:opacity-50";

export function ContactPageClient({ pgpPublicKey }: { pgpPublicKey: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setStatus("sending");
      setErrorMessage("");
      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            subject: subject.trim(),
            message: message.trim(),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setStatus("error");
          setErrorMessage(
            data.error ?? "Something went wrong. Please try again.",
          );
          return;
        }
        setStatus("success");
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
      } catch {
        setStatus("error");
        setErrorMessage("Failed to send. Please try again.");
      }
    },
    [name, email, subject, message],
  );

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="size-5" />
            Send a message
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            We&apos;ll get back to you as soon as we can.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-name">Name</Label>
                <Input
                  id="contact-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className={inputClass}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-subject">Subject</Label>
              <Input
                id="contact-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What is this about?"
                className={inputClass}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-message">Message</Label>
              <textarea
                id="contact-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Your message…"
                rows={5}
                required
                className={cn(inputClass, "min-h-[120px] resize-y py-2")}
              />
            </div>
            {status === "success" && (
              <p className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-400">
                Message sent. We&apos;ll be in touch soon.
              </p>
            )}
            {status === "error" && errorMessage && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {errorMessage}
              </p>
            )}
            <Button type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : "Send message"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-lg border border-border bg-card/50 shadow-none">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
            <KeyRound className="size-5 shrink-0 text-primary" aria-hidden />
            PGP public key
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            For private or sensitive messages, encrypt your email with our PGP
            key. Only we can decrypt messages encrypted to this key.
          </p>
        </CardHeader>
        <CardContent>
          {pgpPublicKey ? (
            <div className="space-y-2">
              <Label className="text-muted-foreground">
                Public key (copy to encrypt)
              </Label>
              <pre
                className={cn(
                  "overflow-x-auto rounded-md border border-border bg-muted/30 p-4 text-xs font-mono leading-relaxed",
                  "select-all whitespace-pre-wrap break-all",
                )}
                aria-label="PGP public key"
              >
                {pgpPublicKey}
              </pre>
              <p className="text-xs text-muted-foreground">
                Use this key in your email client (e.g. Thunderbird, Outlook
                with add-in) or a tool like GPG to encrypt your message before
                sending to our support email.
              </p>
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              No PGP key is configured yet. Add{" "}
              <code className="rounded bg-muted px-1">
                CONTACT_PGP_PUBLIC_KEY
              </code>{" "}
              or{" "}
              <code className="rounded bg-muted px-1">
                NEXT_PUBLIC_CONTACT_PGP_PUBLIC_KEY
              </code>{" "}
              in your environment to display your public key here for encrypted
              contact.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
