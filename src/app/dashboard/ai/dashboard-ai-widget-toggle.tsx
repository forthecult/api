"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useSession } from "~/lib/auth-client";
import { Label } from "~/ui/primitives/label";
import { Switch } from "~/ui/primitives/switch";

export function DashboardAiWidgetToggle() {
  const { data: session, isPending } = useSession();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [jsonSettings, setJsonSettings] = useState<Record<string, unknown>>({});

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/agent", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        agent?: { jsonSettings?: null | Record<string, unknown> };
      };
      const js = data.agent?.jsonSettings ?? {};
      setJsonSettings(js);
      if (typeof js.personalAiWidgetEnabled === "boolean") {
        setEnabled(js.personalAiWidgetEnabled);
      } else {
        setEnabled(true);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load settings");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCheckedChange = async (checked: boolean) => {
    if (!userId) return;
    setSaving(true);
    const next = { ...jsonSettings, personalAiWidgetEnabled: checked };
    try {
      const res = await fetch("/api/ai/agent", {
        body: JSON.stringify({ jsonSettings: next }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        agent?: { jsonSettings?: null | Record<string, unknown> };
      };
      const js = data.agent?.jsonSettings ?? next;
      setJsonSettings(js);
      setEnabled(checked);
      toast.success(
        checked
          ? "Personal AI will show in the site chat widget."
          : "Personal AI removed from the floating chat widget.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (isPending || !userId) return null;

  return (
    <div className="max-w-xl rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <Label className="text-base" htmlFor="personal-ai-widget">
            Personal AI in the floating chat
          </Label>
          <p className="text-sm text-muted-foreground">
            When on, the site chat bubble can include your Personal AI (when the
            store allows it). Turn off to hide it from the widget only—full chat
            on{" "}
            <a className="text-primary underline" href="/chat">
              /chat
            </a>{" "}
            is unchanged.
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={loading || saving}
          id="personal-ai-widget"
          onCheckedChange={(v) => void onCheckedChange(v)}
        />
      </div>
    </div>
  );
}
