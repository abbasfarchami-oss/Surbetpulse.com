import radar from "@/assets/icon-radar.png";
import shield from "@/assets/icon-shield.png";
import bolt from "@/assets/icon-bolt.png";
import star from "@/assets/icon-star.png";

const ICONS = { radar, shield, bolt, star } as const;
export type GlowIconName = keyof typeof ICONS;

/** Decorative glowing 3D emblem shown on top of cards. */
export function GlowIcon({ name, size = 64, className = "" }: { name: GlowIconName; size?: number; className?: string }) {
  return (
    <span className={`glow-icon ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <img src={ICONS[name]} alt="" width={size} height={size} loading="lazy" draggable={false} />
    </span>
  );
}
