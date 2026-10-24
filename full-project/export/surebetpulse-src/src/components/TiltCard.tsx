import { useRef, type ReactNode } from "react";

/** Mouse-driven 3D tilt with glass glare and gentle float; disabled for reduced motion via CSS. */
export function TiltCard({ children, className = "", max = 10, delay = 0 }: { children: ReactNode; className?: string; max?: number; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current; if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(0.5 - y) * max}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * max}deg`);
    el.style.setProperty("--gx", `${x * 100}%`);
    el.style.setProperty("--gy", `${y * 100}%`);
    el.dataset["active"] = "1";
  };
  const leave = () => { const el = ref.current; if (!el) return; el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); delete el.dataset["active"]; };
  return (
    <div className="tilt-wrap" style={{ animationDelay: `${delay}ms` }}>
      <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={`tilt-card ${className}`}>
        {children}
        <span aria-hidden className="tilt-glare" />
      </div>
    </div>
  );
}
