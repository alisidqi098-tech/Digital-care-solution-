import { useEffect, useState } from "react";

export const AIFace = ({ size = 36, className = "" }) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let alive = true;
    let timer;
    const wander = () => {
      if (!alive) return;
      const rx = size * 0.1;
      const ry = size * 0.07;
      setPos({
        x: (Math.random() * 2 - 1) * rx,
        y: (Math.random() * 2 - 1) * ry,
      });
      timer = setTimeout(wander, 700 + Math.random() * 2800);
    };
    wander();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [size]);

  const eyeW = Math.max(3, Math.round(size * 0.2));
  const eyeH = Math.max(6, Math.round(size * 0.36));
  const gap = Math.max(2, Math.round(size * 0.16));
  return (
    <span
      data-testid="ai-face"
      className={`relative inline-flex items-center justify-center rounded-full bg-[#04080F] ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow:
          "0 0 0 1.5px rgba(0,229,255,0.75), 0 0 20px rgba(0,229,255,0.4), inset 0 0 14px rgba(0,229,255,0.1)",
      }}
    >
      <span
        className="flex items-center transition-transform duration-700 ease-in-out"
        style={{ gap, transform: `translate(${pos.x}px, ${pos.y}px)` }}
      >
        <span className="ai-eye" style={{ width: eyeW, height: eyeH }} />
        <span className="ai-eye" style={{ width: eyeW, height: eyeH }} />
      </span>
    </span>
  );
};
