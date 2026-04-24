import { eq } from "drizzle-orm";
import { createElement } from "react";

import { db } from "~/db";
import { userTable } from "~/db/schema";
import { PasswordResetEmail } from "~/emails/password-reset";
import {
  createUserNotification,
  userWantsTransactionalWebsite,
} from "~/lib/create-user-notification";
import { sendEmail } from "~/lib/email/send-email";
import { getNotificationTemplate } from "~/lib/notification-templates";
import { notifyTransactionalTelegram } from "~/lib/telegram-notify";

/**
 * Sends the password reset email. Called by Better Auth when a user requests a password reset.
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

  const t = getNotificationTemplate("password_reset");
  const subject = t.emailSubject ?? "Reset your password";

  try {
    await sendEmail({
      correlationId: userId ? `pwd-reset-${userId}` : `pwd-reset-${to}`,
      kind: "password_reset",
      react: createElement(PasswordResetEmail, { resetUrl: url }),
      subject,
      to,
    });
  } catch (err) {
    console.error("[sendResetPassword] send failed:", err);
    if (process.env.NODE_ENV === "development") {
      console.log("[sendResetPassword] Dev fallback - use this link:", url);
    }
  }

  if (process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY) {
    console.log(
      "[sendResetPassword] No RESEND_API_KEY - use this link to reset password:",
      url,
    );
  }
}
