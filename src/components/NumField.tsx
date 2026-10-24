import { useEffect, useRef, useState } from "react";
import { toLatinDigits } from "@/lib/i18n";

/**
 * Numeric text input that accepts Persian/Arabic-Indic digits and the Persian
 * decimal separator (٫), converting them to Latin before parsing.
 * Empty input reports null; callers decide the fallback.
 */
export function NumField({ value, onChange, ariaLabel, placeholder, className }: {
  value: number | null;
  onChange: (n: number | null) => void;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const committed = useRef(value);
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setText(value == null ? "" : String(value));
    }
  }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      dir="ltr"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const latin = toLatinDigits(e.target.value).replace(/[^0-9.\-]/g, "");
        setText(latin);
        if (latin === "" || latin === "-" || latin === "." || latin === "-.") {
          committed.current = null;
          onChange(null);
          return;
        }
        const n = parseFloat(latin);
        if (!Number.isFinite(n)) return;
        committed.current = n;
        onChange(n);
      }}
      className={className}
    />
  );
}
