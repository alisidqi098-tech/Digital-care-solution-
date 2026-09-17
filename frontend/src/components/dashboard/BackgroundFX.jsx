import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

export default function BackgroundFX() {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 40, damping: 22 });
  const sy = useSpring(my, { stiffness: 40, damping: 22 });
  const orb1X = useTransform(sx, [0, 1], [-70, 70]);
  const orb1Y = useTransform(sy, [0, 1], [-45, 45]);
  const orb2X = useTransform(sx, [0, 1], [55, -55]);
  const orb2Y = useTransform(sy, [0, 1], [35, -35]);

  useEffect(() => {
    const onMove = (e) => {
      mx.set(e.clientX / window.innerWidth);
      my.set(e.clientY / window.innerHeight);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mx, my]);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[#080C14]" />
      <div
        className="absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,245,212,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,212,0.14) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse 90% 65% at 50% 0%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 65% at 50% 0%, black, transparent)",
        }}
      />
      <motion.div style={{ x: orb1X, y: orb1Y }} className="absolute -top-48 left-1/4 h-[500px] w-[500px] rounded-full bg-cyan-500/[0.13] blur-[150px]" />
      <motion.div style={{ x: orb2X, y: orb2Y }} className="absolute -bottom-24 right-0 h-[440px] w-[440px] rounded-full bg-emerald-500/[0.09] blur-[150px]" />
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: NOISE }} />
    </div>
  );
}
