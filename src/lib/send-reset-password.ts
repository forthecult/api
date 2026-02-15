import { eq } from "drizzle-orm";

import { db } from "~/db";
import { userTable } from "~/db/schema";
import {
  createUserNotification,
  userWantsTransactionalWebsite,
} from "~/lib/create-user-notification";
import { getNotificationTemplate } from "~/lib/notification-templates";
import { notifyTransactionalTelegram } from "~/lib/telegram-notify";

/**
 * Sends the password reset email. Called by Better Auth when a user requests a password reset.
 * - With RESEND_API_KEY: sends via Resend (install the `resend` package).
 * - Otherwise in development: logs the link to the server console so you can open it.
 * - In production without RESEND_API_KEY: no email is sent (configure a provider for production).
 * Also sends transactional Telegram + website notification if user has them enabled.
 */
export async function sendResetPasswordEmail(params: {
  to: string;
  url: string;
  user: { email: string; id?: string; name?: null | string };
}): Promise<void> {
  const { to, url, user } = params;

  const userId = user?.id ?? null;
  if (userId) {
    void notifyTransactionalTelegram(userId, "password_reset");
    if (await userWantsTransactionalWebsite(userId)) {
      const t = getNotificationTemplate("password_reset");
      await createUserNotification({
        description: t.body,
        title: t.title,
        type: "password_reset",
        userId,
      });
    }
  } else {
    const [row] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, to))
      .limit(1);
    if (row?.id) {
      void notifyTransactionalTelegram(row.id, "password_reset");
      if (await userWantsTransactionalWebsite(row.id)) {
        const t = getNotificationTemplate("password_reset");
        await createUserNotification({
          description: t.body,
          title: t.title,
          type: "password_reset",
          userId: row.id,
        });
      }
    }
  }

  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from =
        typeof process.env.RESEND_FROM_EMAIL === "string" &&
        process.env.RESEND_FROM_EMAIL.length > 0
          ? process.env.RESEND_FROM_EMAIL
          : "onboarding@resend.dev";
      void resend.emails.send({
        from,
        html: `<!DOCTYPE html><html><body><p>Click the link below to set a new password:</p><p><a href="${url}">${url}</a></p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p></body></html>`,
        subject: "Change your password",
        text: `Click the link to set a new password: ${url}\n\nThis link expires in 1 hour.`,
        to,
      });
    } catch (err) {
      console.error("[sendResetPassword] Resend send failed:", err);
      if (process.env.NODE_ENV === "development") {
        console.log("[sendResetPassword] Dev fallback - use this link:", url);
      }
    }
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.log(
      "[sendResetPassword] No RESEND_API_KEY - use this link to reset password:",
      url,
    );
  }
}
