"use client";

import { useRef, useState, type RefObject } from "react";
import { Music2, Pause } from "lucide-react";

export function useInvitationMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);

  function playMusic() {
    // Play inside the opening click so mobile browsers recognize the gesture.
    void audioRef.current?.play().catch(() => {});
  }

  return { audioRef, playMusic };
}

export default function InvitationMusic({
  src,
  audioRef,
  visible,
  themeClassName,
  align = "left",
}: {
  src?: string;
  audioRef: RefObject<HTMLAudioElement | null>;
  visible: boolean;
  themeClassName: string;
  align?: "left" | "right";
}) {
  const [playing, setPlaying] = useState(false);
  if (!src?.trim()) return null;

  const label = playing ? "Pausar música" : "Reproducir música";

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        loop
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setPlaying(false)}
      />
      {visible && (
        <button
          type="button"
          aria-label={label}
          title={label}
          onClick={() => {
            const audio = audioRef.current;
            if (!audio) return;
            if (audio.paused) void audio.play().catch(() => {});
            else audio.pause();
          }}
          className={`fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] ${align === "right" ? "right-5" : "left-5"} z-40 grid h-12 w-12 place-items-center rounded-full border shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${themeClassName}`}
        >
          {playing ? <Pause aria-hidden="true" size={19} /> : <Music2 aria-hidden="true" size={19} />}
        </button>
      )}
    </>
  );
}
