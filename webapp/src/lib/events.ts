/**
 * Custom event names for cross-component communication (e.g. header ↔ settings).
 * Use window.dispatchEvent(new CustomEvent(NAME)) to fire; addEventListener(NAME, handler) to listen.
 */
export const NOTIFICATION_PREFS_UPDATED = "notification-prefs-updated";
