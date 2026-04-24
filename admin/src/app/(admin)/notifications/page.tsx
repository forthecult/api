"use client";

import React from "react";

import { getAdminApiBaseUrl } from "~/lib/env";

const API_BASE = getAdminApiBaseUrl();

interface EmailEventRow {
  createdAt: string;
  id: string;
  kind: string;
  resendId: null | string;
  status: string;
  subject: null | string;
  toEmail: string;
  userId: null | string;
}

interface SuppressionRow {
  createdAt: string;
  email: string;
  notes: null | string;
  reason: string;
  source: null | string;
}

type TabId = "events" | "suppression" | "templates" | "testSend";

interface Template {
  body: string;
  emailBody?: string;
  emailSubject?: string;
  id: string;
  title: string;
  transactional: boolean;
}

interface TemplateResponse {
  all: Template[];
  marketing: Template[];
  transactional: Template[];
}

export default function AdminNotificationsPage() {
  const [tab, setTab] = React.useState<TabId>("templates");
  const [templates, setTemplates] = React.useState<null | TemplateResponse>(
    null,
  );
  const [events, setEvents] = React.useState<EmailEventRow[] | null>(null);
  const [suppression, setSuppression] = React.useState<null | SuppressionRow[]>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<null | string>(null);

  const [testTo, setTestTo] = React.useState("");
  const [testMsg, setTestMsg] = React.useState<null | string>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Defer setState so it is not synchronous in the effect body (eslint-react/set-state-in-effect).
      await Promise.resolve();
      if (cancelled) return;
      if (tab === "testSend") {
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      const p =
        tab === "templates"
          ? fetch(`${API_BASE}/api/admin/notification-templates`, {
              credentials: "include",
            }).then((r) => {
              if (!r.ok) throw new Error(r.statusText);
              return r.json() as Promise<TemplateResponse>;
            })
          : tab === "events"
            ? fetch(`${API_BASE}/api/admin/email/events?limit=60`, {
                credentials: "include",
              }).then((r) => {
                if (!r.ok) throw new Error(r.statusText);
                return r.json() as Promise<{ items: EmailEventRow[] }>;
              })
            : tab === "suppression"
              ? fetch(`${API_BASE}/api/admin/email/suppression?limit=100`, {
                  credentials: "include",
                }).then((r) => {
                  if (!r.ok) throw new Error(r.statusText);
                  return r.json() as Promise<{ items: SuppressionRow[] }>;
                })
              : Promise.resolve(null);

      try {
        const json = await p;
        if (cancelled) return;
        if (tab === "templates" && json) setTemplates(json as TemplateResponse);
        if (tab === "events" && json)
          setEvents((json as { items: EmailEventRow[] }).items);
        if (tab === "suppression" && json)
          setSuppression((json as { items: SuppressionRow[] }).items);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  async function sendTest() {
    setTestMsg(null);
    const to = testTo.trim();
    if (!to) {
      setTestMsg("Enter a recipient email.");
      return;
    }
    const res = await fetch(`${API_BASE}/api/admin/email/test-send`, {
      body: JSON.stringify({ to }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      resendId?: string;
    };
    if (!res.ok) {
      setTestMsg(json.error ?? res.statusText);
      return;
    }
    setTestMsg(`Sent. Resend id: ${json.resendId ?? "—"}`);
  }

  async function removeSuppressionRow(email: string) {
    if (!confirm(`Remove suppression for ${email}?`)) return;
    const res = await fetch(
      `${API_BASE}/api/admin/email/suppression?email=${encodeURIComponent(email)}`,
      { credentials: "include", method: "DELETE" },
    );
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    setTab("suppression");
    setSuppression(null);
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold">Emails & Notifications</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Templates (copy), recent sends, suppression list, and a test send.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-border pb-2">
        {(
          [
            ["templates", "Templates"],
            ["events", "Events"],
            ["suppression", "Suppression"],
            ["testSend", "Test send"],
          ] as const
        ).map(([id, label]) => (
          <button
            className={`
              rounded-md px-3 py-1.5 text-sm font-medium
              ${
                tab === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }
            `}
            key={id}
            onClick={() => setTab(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="mt-4 text-muted-foreground">Loading…</p>}
      {error && <p className="mt-4 text-destructive">{error}</p>}

      {!loading && !error && tab === "templates" && templates && (
        <TemplatesView data={templates} />
      )}
      {!loading && !error && tab === "events" && events && (
        <EventsView items={events} />
      )}
      {!loading && !error && tab === "suppression" && suppression && (
        <SuppressionView items={suppression} onRemove={removeSuppressionRow} />
      )}
      {!loading && !error && tab === "testSend" && (
        <div className="mt-6 max-w-md space-y-3">
          <label className="block text-sm font-medium" htmlFor="test-to">
            Recipient
          </label>
          <input
            className={`
              w-full rounded-md border border-input bg-background px-3 py-2
              text-sm
            `}
            id="test-to"
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@example.com"
            type="email"
            value={testTo}
          />
          <button
            className={`
              rounded-md bg-primary px-4 py-2 text-sm font-medium
              text-primary-foreground
            `}
            onClick={() => void sendTest()}
            type="button"
          >
            Send test email
          </button>
          {testMsg && (
            <p className="text-sm text-muted-foreground">{testMsg}</p>
          )}
        </div>
      )}
    </div>
  );
}

function EventsView({ items }: { items: EmailEventRow[] }) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 pr-2">When</th>
            <th className="py-2 pr-2">To</th>
            <th className="py-2 pr-2">Kind</th>
            <th className="py-2 pr-2">Status</th>
            <th className="py-2 pr-2">Subject</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr className="border-b border-border/60" key={r.id}>
              <td className="py-2 pr-2 text-muted-foreground">
                {new Date(r.createdAt).toLocaleString()}
              </td>
              <td className="py-2 pr-2">{r.toEmail}</td>
              <td className="py-2 pr-2">{r.kind}</td>
              <td className="py-2 pr-2">{r.status}</td>
              <td className="py-2 pr-2 text-muted-foreground">
                {r.subject ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SuppressionView({
  items,
  onRemove,
}: {
  items: SuppressionRow[];
  onRemove: (email: string) => void;
}) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 pr-2">Email</th>
            <th className="py-2 pr-2">Reason</th>
            <th className="py-2 pr-2">Source</th>
            <th className="py-2 pr-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr className="border-b border-border/60" key={r.email}>
              <td className="py-2 pr-2">{r.email}</td>
              <td className="py-2 pr-2">{r.reason}</td>
              <td className="py-2 pr-2 text-muted-foreground">
                {r.source ?? "—"}
              </td>
              <td className="py-2 pr-2 text-right">
                <button
                  className="text-xs text-primary underline"
                  onClick={() => onRemove(r.email)}
                  type="button"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
      <div className="mt-4 rounded-md border border-border/60 bg-muted/30 p-3">
        <p className="text-sm font-medium text-foreground">{template.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{template.body}</p>
      </div>
      {hasEmail && (
        <div className="mt-3 rounded-md border border-border/60 bg-muted/30 p-3">
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

function TemplatesView({ data }: { data: TemplateResponse }) {
  return (
    <div className="mt-6">
      <section>
        <h3 className="text-lg font-medium">Transactional</h3>
        <ul className="mt-4 space-y-6">
          {data.transactional.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </ul>
      </section>
      <section className="mt-10">
        <h3 className="text-lg font-medium">Marketing</h3>
        <ul className="mt-4 space-y-6">
          {data.marketing.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </ul>
      </section>
    </div>
  );
}
