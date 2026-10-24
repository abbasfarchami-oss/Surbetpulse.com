import { useState } from "react";
import { bookByName } from "@/lib/arb";
import { WORDMARK_LOGOS } from "@/lib/bookLogos";

/** Up to two letters from the brand name, e.g. "William Hill" -> "WH", "1xBet" -> "1X". */
const initials = (name: string) => {
  const parts = name.split(/[\s-]+/).filter(Boolean);
  return (parts.length > 1 ? (parts[0]![0] ?? "") + (parts[1]![0] ?? "") : name.slice(0, 2)).toUpperCase();
};

/** Readable text color on top of the brand color. */
const textOn = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? "#131722" : "#ffffff";
};

/** Brand-colored glossy 3D tile with the bookmaker's real logo on a white plate; falls back to initials. */
export function BookLogo({ name, size = 22 }: { name: string; size?: number }) {
  const book = bookByName(name);
  const color = book?.color ?? "#3a4356";
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = Boolean(book?.logo) && !imgFailed;
  const wordmark = Boolean(book && WORDMARK_LOGOS.has(book.slug));
  return (
    <span
      className="book-logo"
      aria-hidden={showImg ? undefined : true}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, color-mix(in srgb, ${color} 70%, white), ${color} 55%, color-mix(in srgb, ${color} 70%, black))`,
        color: textOn(color),
        fontSize: Math.max(9, Math.round(size * 0.34)),
      }}
    >
      {showImg ? (
        <span className={wordmark ? "book-logo-plate book-logo-plate--wordmark" : "book-logo-plate"}>
          <img src={book!.logo} alt={name} loading="lazy" onError={() => setImgFailed(true)} />
        </span>
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function BookName({ name, size = 22 }: { name: string; size?: number }) {
  return <span className="inline-flex min-w-0 items-center gap-2"><BookLogo name={name} size={size} /><span className="truncate">{name}</span></span>;
}
