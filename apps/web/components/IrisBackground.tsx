"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ─── Inner scene — must live inside <Canvas> ─── */
function IrisScene({ isMobile, prefersReduced }: { isMobile: boolean; prefersReduced: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (prefersReduced) return;
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [prefersReduced]);

  /* Procedural iris ring texture: radial gradient inner→outer */
  const irisTexture = useMemo(() => {
    const size = 512;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d")!;

    /* Radial gradient: bright center → dark outer */
    const cx = size / 2;
    const cy = size / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
    grad.addColorStop(0.0, "#9b80ff");
    grad.addColorStop(0.25, "#7c5cff");
    grad.addColorStop(0.6, "#5436d9");
    grad.addColorStop(1.0, "#2a1f5a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    /* Thin radial striations */
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.globalAlpha = 0.06 + Math.random() * 0.1;
      ctx.strokeStyle = i % 3 === 0 ? "#c4b5ff" : "#3d2a9e";
      ctx.lineWidth = 0.5 + Math.random() * 1.2;
      ctx.beginPath();
      ctx.moveTo(0, size * 0.12);
      ctx.lineTo(0, size * 0.5);
      ctx.stroke();
      ctx.restore();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }, []);

  useFrame((state) => {
    if (!groupRef.current || prefersReduced) return;
    const t = state.clock.elapsedTime;

    /* Smooth lerp to mouse */
    targetRef.current.x += (mouseRef.current.x * 0.2 - targetRef.current.x) * 0.05;
    targetRef.current.y += (mouseRef.current.y * 0.15 - targetRef.current.y) * 0.05;

    /* Idle drift + mouse tracking */
    groupRef.current.rotation.y = targetRef.current.x + Math.sin(t * 0.25) * 0.05;
    groupRef.current.rotation.x = targetRef.current.y + Math.sin(t * 0.15) * 0.03;
  });

  const eyeSegs = isMobile ? 48 : 96;
  const ringSegs = isMobile ? 64 : 96;

  return (
    <group ref={groupRef}>
      {/* Atmosphere — inside-out glow sphere */}
      <mesh>
        <sphereGeometry args={[2.0, 32, 32]} />
        <meshBasicMaterial color="#5436d9" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>

      {/* Eyeball */}
      <mesh>
        <sphereGeometry args={[1.4, eyeSegs, eyeSegs]} />
        <meshStandardMaterial color="#15103a" />
      </mesh>

      {/* Iris ring — just in front of sphere surface */}
      <mesh position={[0, 0, 1.41]}>
        <ringGeometry args={[0.38, 1.1, ringSegs]} />
        <meshBasicMaterial map={irisTexture} side={THREE.DoubleSide} transparent />
      </mesh>

      {/* Pupil */}
      <mesh position={[0, 0, 1.44]}>
        <circleGeometry args={[0.38, 48]} />
        <meshBasicMaterial color="#07061a" />
      </mesh>

      {/* Lights for eyeball shading */}
      <ambientLight intensity={0.4} color="#5436d9" />
      <pointLight position={[2, 2, 3]} intensity={1.2} color="#7c5cff" />
      <pointLight position={[-2, -1, 2]} intensity={0.6} color="#c4b5ff" />
    </group>
  );
}

/* ─── Exported container — dynamic-imported with ssr:false ─── */
export default function IrisBackground() {
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 4], fov: 50 }}
        dpr={[1, 2]}
        gl={{ alpha: true }}
        style={{ background: "transparent" }}
      >
        <IrisScene isMobile={isMobile} prefersReduced={prefersReduced} />
      </Canvas>
    </div>
  );
}
