import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { BookLogo } from "@/components/BookLogo";
import { Icon3D } from "@/components/Icon3D";
import { BOOK_FAMILIES, BOOK_GROUPS, bookSlug } from "@/lib/arb";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/bookmakers")({
  head: () => ({
    meta: [
      { title: "Bookmakers — ArbRadar" },
      { name: "description", content: "Every bookmaker covered by the ArbRadar surebet scanner, grouped by family with sharp/soft tags." },
      { property: "og:title", content: "Bookmakers — ArbRadar" },
      { property: "og:description", content: "Every bookmaker covered by the ArbRadar surebet scanner, grouped by family with sharp/soft tags." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookmakersPage,
});

function BookmakersPage() {
  const { t } = useI18n();
  const sharp = BOOK_GROUPS["sharp"] ?? [];
  return (
    <AppShell>
      <div className="flex items-center gap-4">
        <Icon3D name="shop" size={64} />
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">{t.bookmakersTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.bookmakersDesc}</p>
        </div>
      </div>
      <div className="mt-6 space-y-8">
        {BOOK_FAMILIES.map((f) => (
          <section key={f.name}>
            <h2 className="text-lg font-bold">{f.name}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {f.books.map((b) => (
                <Link key={b} to="/bookmakers/$slug" params={{ slug: bookSlug(b) }}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-row-hover">
                  <BookLogo name={b} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{b}</div>
                    <div className="text-xs text-muted-foreground">{f.name}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sharp.includes(b) ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
                    {sharp.includes(b) ? t.sharp : t.soft}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
