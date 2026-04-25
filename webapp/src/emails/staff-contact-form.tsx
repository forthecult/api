import { Text } from "@react-email/components";

import { EmailShell } from "~/emails/shell";

export function StaffContactFormEmail({
  htmlBody,
}: Readonly<{ htmlBody: string }>) {
  return (
    <EmailShell preview="Contact form" siteName="For the Culture — Contact">
      {/* Staff-only: htmlBody is server-rendered from our contact form, not user-controlled raw HTML in browser. */}
      <Text
        // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml -- internal staff digest
        dangerouslySetInnerHTML={{ __html: htmlBody }}
        style={{ fontSize: "14px", lineHeight: 1.5, margin: 0 }}
      />
    </EmailShell>
  );
}
