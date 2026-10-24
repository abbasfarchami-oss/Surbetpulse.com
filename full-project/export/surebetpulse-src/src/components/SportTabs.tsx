import { Button } from "@/components/ui/button";
import { Icon3D, type Icon3DName } from "@/components/Icon3D";
import { SPORTS } from "@/lib/arb";
import { sportKey, useI18n } from "@/lib/i18n";

const SPORT_ICONS: Record<string, Icon3DName> = {
  "": "trophy",
  Football: "football",
  Basketball: "basketball",
  Tennis: "tennis",
  Volleyball: "volleyball",
  "Ice Hockey": "hockey",
  Esports: "esports",
};

export function SportTabs({ value, onChange }: { value: string; onChange: (sport: string) => void }) {
  const { t } = useI18n();
  return (
    <div role="group" aria-label={t.sp_all} className="flex gap-1 overflow-x-auto border-b border-border pb-2">
      {["", ...SPORTS].map((sport) => (
        <Button key={sport} variant="ghost" aria-pressed={value === sport} onClick={() => onChange(sport)}
          className={`group h-24 min-w-24 flex-1 flex-col gap-2 rounded-lg px-3 text-xs transition-colors motion-reduce:transition-none ${value === sport ? "bg-selected/15 text-primary hover:bg-selected/20 hover:text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
          <span aria-hidden="true" className="sport-icon grid h-10 w-10 place-items-center text-3xl leading-none">
            <Icon3D name={SPORT_ICONS[sport] ?? "trophy"} size={40} halo={false} />
          </span>
          <span className="whitespace-nowrap">{sport ? String(t[sportKey(sport)]) : t.sp_all}</span>
          <span className={`h-0.5 w-5 rounded-full ${value === sport ? "bg-primary" : "bg-transparent"}`} aria-hidden="true" />
        </Button>
      ))}
    </div>
  );
}
