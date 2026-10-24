import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

/** Animate numeric values, never formatted strings; locale changes do not restart counting. */
export function AnimatedNumber({ value, percent = false }: { value: number; percent?: boolean }) {
  const { number, percentage } = useI18n();
  const [display, setDisplay] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const startValue = current.current;
    const startTime = performance.now();
    const finish = () => {
      cancelAnimationFrame(frame);
      current.current = value;
      setDisplay(value);
    };
    const tick = (time: number) => {
      if (reduced.matches) { finish(); return; }
      const progress = Math.min((time - startTime) / 900, 1);
      current.current = startValue + (value - startValue) * (1 - Math.pow(1 - progress, 3));
      setDisplay(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    if (reduced.matches) finish();
    else frame = requestAnimationFrame(tick);
    reduced.addEventListener("change", finish);
    return () => {
      cancelAnimationFrame(frame);
      reduced.removeEventListener("change", finish);
    };
  }, [value]);

  const format = (n: number) => percent ? percentage(n) : number(Math.round(n));
  return <><span aria-hidden="true">{format(display)}</span><span className="sr-only">{format(value)}</span></>;
}