import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon3D } from "@/components/Icon3D";
import { useI18n } from "@/lib/i18n";

export function ThemeToggle() {
  const { t } = useI18n();
  const [light, setLight] = useState(false);
  useEffect(() => {
    setLight(localStorage.getItem("arbradar-theme") === "light");
  }, []);
  const toggle = () => {
    const next = !light;
    setLight(next);
    document.documentElement.dataset["theme"] = next ? "light" : "dark";
    localStorage.setItem("arbradar-theme", next ? "light" : "dark");
  };
  useEffect(() => {
    document.documentElement.dataset["theme"] = light ? "light" : "dark";
  }, [light]);
  const label = light ? t.nightTheme : t.dayTheme;
  return (
    <Button variant="outline" size="icon" onClick={toggle} title={label} aria-label={label} className="group shrink-0 rounded-full">
      <Icon3D name={light ? "moon" : "sun"} size={22} halo={false} />
    </Button>
  );
}
