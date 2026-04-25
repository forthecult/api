"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getAdminApiBaseUrl } from "~/lib/env";
import {
  type EmailCatalogResponse,
  EmailPreviewSendForm,
} from "~/ui/email-preview-send-form";

const API_BASE = getAdminApiBaseUrl();

export default function AdminEmailSettingsPage() {
  const [catalog, setCatalog] = useState<null | EmailCatalogResponse>(null);
  const [err, setErr] = useState<null | string>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/email/catalog`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as EmailCatalogResponse;
        if (!cancelled) setCatalog(json);
      } catch (e) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Failed to load catalog");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold">Email settings</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Templates are grouped by <strong>transactional</strong> (order lifecycle,
        account, support) vs <strong>marketing</strong> (multi-step funnels and
        optional promos). Send history and suppression live under{" "}
        <Link className="text-primary underline" href="/notifications">
          Notifications
        </Link>
        .
      </p>

      {err && <p className="mt-4 text-sm text-destructive">{err}</p>}

      {catalog && (
        <div className="mt-10 grid gap-10 lg:grid-cols-2">
          <section>
            <h3 className="text-lg font-semibold">Transactional</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Triggered by user actions or operational events. Respects
              transactional email preferences when sent for real (preview sends
              bypass checks).
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              {catalog.transactional.map((row) => (
                <li
                  className="rounded-md border border-border bg-muted/20 px-3 py-2"
                  key={row.kind}
                >
                  <span className="font-medium">{row.label}</span>
                  <span className="ml-2 text-muted-foreground">({row.kind})</span>
                  {row.prefersOrderId ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Richer preview when an order id is supplied.
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold">Marketing funnels</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Each funnel is a top-level series; steps map to{" "}
              <code className="rounded bg-muted px-1">email_funnel_enrollment</code>{" "}
              rows processed by cron.
            </p>
            <div className="mt-4 space-y-6">
              {catalog.funnels.map((f) => (
                <div className="rounded-lg border bg-card p-4 shadow-sm" key={f.id}>
                  <h4 className="font-medium">{f.name}</h4>
                  <p className="mt-1 text-xs text-muted-foreground">{f.description}</p>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
                    {f.steps.map((s) => (
                      <li key={s.kind}>
                        <span className="font-medium">{s.label}</span>{" "}
                        <span className="text-muted-foreground">({s.kind})</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
            {catalog.marketingExtra.length > 0 ? (
              <div className="mt-8">
                <h4 className="text-base font-semibold">Other marketing</h4>
                <ul className="mt-2 space-y-2 text-sm">
                  {catalog.marketingExtra.map((m) => (
                    <li key={m.kind}>
                      {m.label}{" "}
                      <span className="text-muted-foreground">({m.kind})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {catalog.internalOnly.length > 0 ? (
              <div className="mt-8">
                <h4 className="text-base font-semibold">Internal (staff)</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Not for customers — digest layouts for ops.
                </p>
                <ul className="mt-2 space-y-2 text-sm">
                  {catalog.internalOnly.map((m) => (
                    <li key={m.kind}>
                      {m.label}{" "}
                      <span className="text-muted-foreground">({m.kind})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      )}

      <div className="mt-12 max-w-xl">
        <EmailPreviewSendForm
          catalog={catalog}
          defaultTo=""
          intro="Subject is prefixed with [PREVIEW]. Consent and suppression are bypassed for this admin-only path."
          title="Send a preview"
        />
      </div>
    </div>
  );
}
