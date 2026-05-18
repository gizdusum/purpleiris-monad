"use client";

import { useState, useEffect } from "react";

interface Props {
  text: string;
  speed: number;
  active: boolean;
  onComplete?: () => void;
}

export default function Typewriter({ text, speed, active, onComplete }: Props) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (!active) return;
    setDisplayed("");
    let pos = 0;

    const id = setInterval(() => {
      pos++;
      setDisplayed(text.slice(0, pos));
      if (pos >= text.length) {
        clearInterval(id);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(id);
  }, [active, text, speed, onComplete]);

  const isDone = displayed.length >= text.length;

  // Render \n as <br> elements
  const parts = displayed.split("\n");

  return (
    <span>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && <br />}
        </span>
      ))}
      {!isDone && active && <span className="iris-cursor" aria-hidden="true" />}
    </span>
  );
}
