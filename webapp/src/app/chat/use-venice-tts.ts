"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export function useVeniceTts() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<null | string>(null);
  const [loadingId, setLoadingId] = useState<null | string>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setLoadingId(null);
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const speak = useCallback(
    async (opts: { messageId: string; text: string }) => {
      const { messageId, text } = opts;
      const plain = text.trim().slice(0, 4096);
      if (!plain) return;

      stop();
      setLoadingId(messageId);

      try {
        const res = await fetch("/api/ai/tts", {
          body: JSON.stringify({ input: plain }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (res.status === 401) {
          toast.error("Sign in to use read aloud.");
          setLoadingId(null);
          return;
        }
        if (!res.ok) {
          toast.error("Could not generate speech.");
          setLoadingId(null);
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          stop();
        };
        audio.onerror = () => {
          toast.error("Playback failed.");
          stop();
        };
        await audio.play();
        setLoadingId(null);
      } catch {
        toast.error("Could not play audio.");
        stop();
      }
    },
    [stop],
  );

  return { loadingId, speak, stop };
}
