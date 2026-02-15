"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

const Z_INDEX = 2_147_483_647;
const HOLE_WIDTH = 420;
const HOLE_HEIGHT = 650;

type SideshiftBackdropOverlayProps = {
  onClose: () => void;
};

/**
 * Invisible overlay with a "hole" over the Sideshift modal.
 * Clicks on the dark area (our overlay) call sideshift.hide() and onClose.
 * Clicks on the hole pass through to the modal. Sideshift has no native
 * "click backdrop to close", so we layer this on top of their iframe.
 */
export function SideshiftBackdropOverlay({ onClose }: SideshiftBackdropOverlayProps) {
  const handleBackdropClick = () => {
    (window as unknown as { sideshift?: { hide: () => void } }).sideshift?.hide();
    onClose();
  };

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let hasSeenIframe = false;
    const checkClosed = () => {
      const iframe = document.querySelector<HTMLIFrameElement>(
        'iframe[src*="sideshift.ai"]',
      );
      if (iframe) hasSeenIframe = true;
      if (!hasSeenIframe) return;
      const hidden = !iframe?.offsetParent;
      if (hidden) onClose();
    };
    intervalId = setInterval(checkClosed, 400);
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [onClose]);

  const overlay = (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-auto"
      style={{ zIndex: Z_INDEX }}
    >
      {/* Frame: 4 panels so the center (modal) is a "hole" — clicks there pass through */}
      <div
        className="absolute left-0 top-0 bottom-0 cursor-pointer"
        style={{ width: `calc(50vw - ${HOLE_WIDTH / 2}px)` }}
        onClick={handleBackdropClick}
        role="presentation"
      />
      <div
        className="absolute right-0 top-0 bottom-0 cursor-pointer"
        style={{ width: `calc(50vw - ${HOLE_WIDTH / 2}px)` }}
        onClick={handleBackdropClick}
        role="presentation"
      />
      <div
        className="absolute left-1/2 cursor-pointer"
        style={{
          marginLeft: -HOLE_WIDTH / 2,
          width: HOLE_WIDTH,
          top: 0,
          height: `calc(50vh - ${HOLE_HEIGHT / 2}px)`,
        }}
        onClick={handleBackdropClick}
        role="presentation"
      />
      <div
        className="absolute left-1/2 bottom-0 cursor-pointer"
        style={{
          marginLeft: -HOLE_WIDTH / 2,
          width: HOLE_WIDTH,
          height: `calc(50vh - ${HOLE_HEIGHT / 2}px)`,
        }}
        onClick={handleBackdropClick}
        role="presentation"
      />
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
