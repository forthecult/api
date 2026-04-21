"use client";

import React from "react";

import { getMainAppUrl } from "~/lib/env";

const API_BASE = getMainAppUrl();

interface Response {
  all: Template[];
  marketing: Template[];
  transactional: Template[];
}

interface Template {
  body: string;
  emailBody?: string;
  emailSubject?: string;
  id: string;
  title: string;
  transactional: boolean;
}

export default function AdminNotificationsPage() {
  const [data, setData] = React.useState<null | Response>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<null | string>(null);

  React.useEffect(() => {
    fetch(`${API_BASE}/api/admin/notification-templates`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((json: Response) => {
        setData(json);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Emails & Notifications</h2>
        <p className="mt-2 text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Emails & Notifications</h2>
        <p className="mt-2 text-destructive">{error ?? "No data"}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold">Emails & Notifications</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Copy is separated by channel: <strong>Notifications</strong> (in-app
        widget, Telegram — short copy) and <strong>Email</strong> (subject +
        body — can be longer and richer). Consent: transactional vs marketing
        preferences.
      </p>

      <section className="mt-8">
        <h3 className="text-lg font-medium">Transactional</h3>
        <p className="text-sm text-muted-foreground">
          Triggered by user/system events (password reset, order placed,
          shipped, refund). Uses transactional consent.
        </p>
        <ul className="mt-4 space-y-6">
          {data.transactional.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h3 className="text-lg font-medium">Marketing</h3>
        <p className="text-sm text-muted-foreground">
          Promotional / re-engagement (welcome, abandon cart, order review).
          Uses marketing consent.
        </p>
        <ul className="mt-4 space-y-6">
          {data.marketing.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function TemplateCard({ template }: { template: Template }) {
  const hasEmail = template.emailSubject != null || template.emailBody != null;
  return (
    <li className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">{template.title}</span>
        <span className="text-sm text-muted-foreground">({template.id})</span>
      </div>

      {/* Notifications: widget + Telegram */}
      <div className="mt-4 rounded-md border border-border/60 bg-muted/30 p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <span
            className={`
              inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5
              text-xs font-medium text-primary
            `}
          >
            Notifications
          </span>
          <span className="text-xs text-muted-foreground">
            Widget & Telegram
          </span>
        </div>
        <p className="text-sm font-medium text-foreground">{template.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{template.body}</p>
      </div>

      {/* Email: subject + body (can be longer) */}
      {hasEmail && (
        <div className="mt-3 rounded-md border border-border/60 bg-muted/30 p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className={`
                inline-flex items-center rounded-md bg-blue-500/10 px-2 py-0.5
                text-xs font-medium text-blue-600
                dark:text-blue-400
              `}
            >
              Email
            </span>
            <span className="text-xs text-muted-foreground">
              Richer content, links, etc.
            </span>
          </div>
          {template.emailSubject != null && (
            <p className="text-sm">
              <span className="font-medium text-foreground">Subject: </span>
              <span className="text-muted-foreground">
                {template.emailSubject}
              </span>
            </p>
          )}
          {template.emailBody != null && (
            <p
              className={`
                mt-2 text-sm whitespace-pre-wrap text-muted-foreground
              `}
            >
              {template.emailBody}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
