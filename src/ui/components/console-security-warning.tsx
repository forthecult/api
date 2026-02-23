"use client";

import { useEffect } from "react";

/**
 * Logs a one-time security warning in the dev tools console to discourage
 * users from pasting untrusted code (common scam vector).
 */
export function ConsoleSecurityWarning() {
  useEffect(() => {
    const stopStyle =
      "color: white; background: #c00; font-size: 24px; font-weight: bold; padding: 6px 12px;";
    console.log("%cStop!", stopStyle);
    console.log(
      "This is a browser feature intended for developers. If someone told you to copy-paste something here, it is a scam and will give them access to your money."
    );
  }, []);
  return null;
}
