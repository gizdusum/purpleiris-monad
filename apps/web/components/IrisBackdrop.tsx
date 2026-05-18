"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

type Props = { intensity: "hero" | "ghost" };

export default function IrisBackdrop({ intensity }: Props) {
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (intensity === "ghost") return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove);

    function tick() {
      const tx = mouseRef.current.x * 8;
      const ty = mouseRef.current.y * 4;
      currentRef.current.x += (tx - currentRef.current.x) * 0.06;
      currentRef.current.y += (ty - currentRef.current.y) * 0.06;
      if (imgWrapRef.current) {
        imgWrapRef.current.style.transform = `translate(${currentRef.current.x}px, ${currentRef.current.y}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    let scrollRaf = 0;
    const onScroll = () => {
      cancelAnimationFrame(scrollRaf);
      scrollRaf = requestAnimationFrame(() => {
        const alpha = Math.min(0.92, 0.5 + (window.scrollY / 600) * 0.42);
        document.documentElement.style.setProperty("--iris-scroll-alpha", String(alpha));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(scrollRaf);
      document.documentElement.style.removeProperty("--iris-scroll-alpha");
    };
  }, [intensity]);

  if (intensity === "ghost") {
    return (
      <div
        aria-hidden="true"
        style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}
      >
        <Image
          src="/hero/iris.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          style={{
            objectFit: "cover",
            objectPosition: "center",
            filter: "blur(2px) brightness(0.5)",
          }}
        />
        <div style={{ position: "absolute", inset: 0, background: "rgba(7,6,26,0.94)" }} />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}
    >
      <div
        ref={imgWrapRef}
        style={{ position: "absolute", inset: "-12px", willChange: "transform" }}
      >
        <Image
          src="/hero/iris.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="hero-image-zoom"
          style={{ objectFit: "cover", objectPosition: "center right" }}
        />
      </div>

      {/* Scroll-reactive full-page overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(7,6,26,var(--iris-scroll-alpha,0.5))",
        }}
      />

      {/* SVG grain */}
      <svg
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.05,
          pointerEvents: "none",
        }}
      >
        <filter id="iris-grain-fixed">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#iris-grain-fixed)" />
      </svg>
    </div>
  );
}
