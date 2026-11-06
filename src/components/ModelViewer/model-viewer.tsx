"use client";

import { useEffect, useRef, useState } from "react";
import { startModelShow } from "@/render3d/model-show";

/** Debug-only turntable of the game's 3D models (?debug=1&viewer=1), used to record a review video. */
export const ModelViewer = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [caption, setCaption] = useState({ title: "", sub: "" });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let stop: (() => void) | null = null;
    startModelShow(canvas, (title, sub) => setCaption({ title, sub })).then((s) => {
      stop = s;
    });
    return () => stop?.();
  }, []);

  return (
    <div className="fixed inset-0 bg-black" data-testid="model-viewer">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-10 text-center">
        <p className="font-display text-4xl text-[#e9d6cc] text-glow-red">{caption.title}</p>
        <p className="mt-2 text-lg text-ash">{caption.sub}</p>
      </div>
      <p className="absolute top-4 left-1/2 -translate-x-1/2 text-sm tracking-[0.4em] text-ash uppercase">SHIKAAR · 3D models</p>
    </div>
  );
};
