"use client";

import * as React from "react";

import { getAdminApiBaseUrl } from "~/lib/env";

import { Button } from "~/ui/button";

const API_BASE = getAdminApiBaseUrl();

export interface EmailCatalogFunnel {
  description: string;
  id: string;
  name: string;
  steps: readonly { kind: string; label: string }[];
}

export interface EmailCatalogResponse {
  funnels: EmailCatalogFunnel[];
  internalOnly: readonly { kind: string; label: string }[];
  marketingExtra: readonly { kind: string; label: string }[];
  transactional: readonly {
    kind: string;
    label: string;
    prefersOrderId?: boolean;
  }[];
}

function flattenKinds(catalog: EmailCatalogResponse): { kind: string; label: string; group: string }[] {
  const rows: { group: string; kind: string; label: string }[] = [];
  for (const t of catalog.transactional) {
    rows.push({ group: "Transactional", kind: t.kind, label: t.label });
  }
  for (const f of catalog.funnels) {
    for (const s of f.steps) {
      rows.push({
        group: `Marketing · ${f.name}`,
        kind: s.kind,
        label: `${f.name}: ${s.label}`,
      });
    }
  }
  for (const m of catalog.marketingExtra) {
    rows.push({ group: "Marketing · Other", kind: m.kind, label: m.label });
  }
  for (const i of catalog.internalOnly) {
    rows.push({ group: "Internal (staff)", kind: i.kind, label: i.label });
  }
  return rows.sort((a, b) => a.label.localeCompare(b.label));
}

export function EmailPreviewSendForm({
  catalog: catalogProp,
  defaultTo,
  defaultUserId,
  intro,
  orders,
  title = "Send email preview",
}: Readonly<{
  /** When set, skips fetching catalog (e.g. parent already loaded it). */
  catalog?: EmailCatalogResponse | null;
  defaultTo: string;
  defaultUserId?: string;
  intro?: string;
  orders?: readonly { id: string }[];
  title?: string;
}>): React.ReactElement {
  const [catalog, setCatalog] = React.useState<null | EmailCatalogResponse>(
    null,
  );
  const [catalogError, setCatalogError] = React.useState<null | string>(null);
  const [kind, setKind] = React.useState("");
  const [to, setTo] = React.useState(defaultTo);
  const [userId, setUserId] = React.useState(defaultUserId ?? "");
  const [orderId, setOrderId] = React.useState("");
  const [msg, setMsg] = React.useState<null | string>(null);
  const [loadingCatalog, setLoadingCatalog] = React.useState(!catalogProp);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    setTo(defaultTo);
  }, [defaultTo]);

  React.useEffect(() => {
    if (defaultUserId) setUserId(defaultUserId);
  }, [defaultUserId]);

  React.useEffect(() => {
    if (catalogProp) {
      setCatalog(catalogProp);
      setCatalogError(null);
      setLoadingCatalog(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingCatalog(true);
      setCatalogError(null);
      try {
        const res = await fetch(`${API_BASE}/api/admin/email/catalog`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as EmailCatalogResponse;
        if (!cancelled) setCatalog(json);
      } catch (e) {
        if (!cancelled)
          setCatalogError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogProp]);

  const kindOptions = React.useMemo(() => {
    if (!catalog) return [];
    return flattenKinds(catalog);
  }, [catalog]);

  async function sendPreview() {
    setMsg(null);
    const k = kind.trim();
    if (!k) {
      setMsg("Choose an email type.");
      return;
    }
    const recipient = to.trim();
    if (!recipient) {
      setMsg("Recipient email is required.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/email/send-preview`, {
        body: JSON.stringify({
          kind: k,
          orderId: orderId.trim() || undefined,
          to: recipient,
          userId: userId.trim() || undefined,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        resendId?: string;
      };
      if (!res.ok) {
        setMsg(json.error ?? res.statusText);
        return;
      }
      setMsg(`Sent. Resend id: ${json.resendId ?? "—"}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <h3 className="text-lg font-medium">{title}</h3>
      {intro ? (
        <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
      ) : null}
      {loadingCatalog && (
        <p className="mt-3 text-sm text-muted-foreground">Loading catalog…</p>
      )}
      {catalogError && (
        <p className="mt-3 text-sm text-destructive">{catalogError}</p>
      )}
      {!loadingCatalog && catalog && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="ep-kind">
              Email type
            </label>
            <select
              className={`
                w-full rounded-md border border-input bg-background px-3 py-2
                text-sm
              `}
              id="ep-kind"
              onChange={(e) => setKind(e.target.value)}
              value={kind}
            >
              <option value="">Select…</option>
              {kindOptions.map((o) => (
                <option key={o.kind} value={o.kind}>
                  {o.label} ({o.kind})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="ep-to">
              Send to
            </label>
            <input
              className={`
                w-full rounded-md border border-input bg-background px-3 py-2
                text-sm
              `}
              id="ep-to"
              onChange={(e) => setTo(e.target.value)}
              type="email"
              value={to}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="ep-user">
              User ID (optional — improves product picks in previews)
            </label>
            <input
              className={`
                w-full rounded-md border border-input bg-background px-3 py-2
                text-sm
              `}
              id="ep-user"
              onChange={(e) => setUserId(e.target.value)}
              placeholder="cuid…"
              type="text"
              value={userId}
            />
          </div>
          {orders && orders.length > 0 ? (
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="ep-order"
              >
                Order (optional — order emails use real line context when set)
              </label>
              <select
                className={`
                  w-full rounded-md border border-input bg-background px-3 py-2
                  text-sm
                `}
                id="ep-order"
                onChange={(e) => setOrderId(e.target.value)}
                value={orderId}
              >
                <option value="">None</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="ep-order-free"
              >
                Order ID (optional)
              </label>
              <input
                className={`
                  w-full rounded-md border border-input bg-background px-3 py-2
                  text-sm
                `}
                id="ep-order-free"
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="Paste order id for richer preview"
                type="text"
                value={orderId}
              />
            </div>
          )}
          <Button
            disabled={sending || !kind}
            onClick={() => void sendPreview()}
            type="button"
          >
            {sending ? "Sending…" : "Send preview"}
          </Button>
          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        </div>
      )}
    </div>
  );
}
