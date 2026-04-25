import { Text } from "@react-email/components";

import { EmailShell } from "~/emails/shell";

/** Internal staff notification — no List-Unsubscribe (send with internal: true). */
export function StaffRefundAlertEmail({
  htmlBody,
}: Readonly<{ htmlBody: string }>) {
  return (
    <EmailShell preview="Refund request" siteName="For the Culture — Admin">
      {/* Staff-only: htmlBody is composed server-side for admin alerts. */}
      <Text
        // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml -- internal staff digest
        dangerouslySetInnerHTML={{ __html: htmlBody }}
        style={{ fontSize: "14px", lineHeight: 1.5, margin: 0 }}
      />
    </EmailShell>
  );
}
