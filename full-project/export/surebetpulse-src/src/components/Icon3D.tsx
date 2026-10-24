import radar from "@/assets/icon-radar.png";
import shield from "@/assets/icon-shield.png";
import bolt from "@/assets/icon-bolt.png";
import star from "@/assets/icon-star.png";
import wallet from "@/assets/icon-wallet.png";
import shop from "@/assets/icon-shop.png";
import gear from "@/assets/icon-gear.png";
import crown from "@/assets/icon-crown.png";
import trophy from "@/assets/icon-trophy.png";
import football from "@/assets/icon-football.png";
import basketball from "@/assets/icon-basketball.png";
import tennis from "@/assets/icon-tennis.png";
import volleyball from "@/assets/icon-volleyball.png";
import hockey from "@/assets/icon-hockey.png";
import esports from "@/assets/icon-esports.png";
import target from "@/assets/icon-target.png";
import coins from "@/assets/icon-coins.png";
import chartDown from "@/assets/icon-chart-down.png";
import stopwatch from "@/assets/icon-stopwatch.png";
import close from "@/assets/icon-close.png";
import check from "@/assets/icon-check.png";
import sun from "@/assets/icon-sun.png";
import moon from "@/assets/icon-moon.png";
import calc from "@/assets/icon-calc.png";

const ICONS = {
  radar, shield, bolt, star, wallet, shop, gear, crown, trophy,
  football, basketball, tennis, volleyball, hockey, esports,
  target, coins, "chart-down": chartDown, stopwatch, close, check, sun, moon, calc,
} as const;
export type Icon3DName = keyof typeof ICONS;

/**
 * Colorful 3D icon with gentle float animation and hover pop.
 * `halo={false}` skips the glow backdrop for small inline usage.
 */
export function Icon3D({ name, size = 24, halo = true, className = "" }: { name: Icon3DName; size?: number; halo?: boolean; className?: string }) {
  if (!halo) {
    return <img src={ICONS[name]} alt="" width={size} height={size} loading="lazy" draggable={false} className={`icon3d-plain inline-block shrink-0 ${className}`} aria-hidden="true" />;
  }
  return (
    <span className={`glow-icon ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <img src={ICONS[name]} alt="" width={size} height={size} loading="lazy" draggable={false} />
    </span>
  );
}
