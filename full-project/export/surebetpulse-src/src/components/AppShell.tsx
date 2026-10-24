import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { LANGS, useI18n, type Lang } from "@/lib/i18n";
import { usePlans } from "@/lib/plans";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Icon3D, type Icon3DName } from "@/components/Icon3D";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LogoBackground } from "@/components/LogoBackground";

/** Pages that keep a plain dark background (auth, payments, game pickers). */
const PLAIN_BG_PATHS = ["/login", "/auth", "/wallet", "/deposit", "/charge", "/payment", "/checkout"];

export function AppShell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const { current } = usePlans();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const plainBg = PLAIN_BG_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const signOut = async () => {
    await queryClient.cancelQueries(); queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/login", replace: true });
  };
  const [bannerOpen, setBannerOpen] = useState(true);
  const dots = Array.from({ length: 12 }, (_, i) => ({
    left: `${(i * 8.3 + 4) % 100}%`,
    size: 2 + ((i * 7) % 3),
    duration: 26 + ((i * 11) % 18),
    delay: -((i * 3.3) % 30),
  }));
  const nav: { to: string; label: string; icon: Icon3DName }[] = [
    { to: "/", label: t.navScanner, icon: "radar" },
    { to: "/accounts", label: t.navAccounts, icon: "wallet" },
    { to: "/plans", label: t.navPlans, icon: "crown" },
    { to: "/wallet", label: t.navWallet, icon: "coins" },
    { to: "/big-odds", label: t.navBigOdds, icon: "trophy" },
    { to: "/bookmakers", label: t.navBookmakers, icon: "shop" },
    { to: "/matcher", label: t.navMatcher, icon: "bolt" },
    ...(isAdmin ? [{ to: "/admin", label: t.navAdmin, icon: "gear" as const }] : []),
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <div className="ambient" aria-hidden="true">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
        <div className="ambient-orb ambient-orb-3" />
        <div className="ambient-grid" />
        {dots.map((d, i) => (
          <span key={i} className="ambient-dot" style={{
            left: d.left,
            width: `${d.size}px`,
            height: `${d.size}px`,
            animationDuration: `${d.duration}s`,
            animationDelay: `${d.delay}s`,
          }} />
        ))}
      </div>
      {!plainBg && <LogoBackground />}
      {bannerOpen && (
        <div className="relative z-10 border-b border-border/60 bg-background/60 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm">
            <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <Link to="/plans" className="promo-text shrink-0 font-extrabold tracking-tight">{t.promoTitle}</Link>
            <span className="hidden truncate text-muted-foreground sm:block">{t.promoNote}</span>
            <button type="button" onClick={() => setBannerOpen(false)} aria-label={t.closeBanner}
              className="group ms-auto grid shrink-0 place-items-center rounded-full bg-destructive/90 p-1 transition hover:bg-destructive">
              <Icon3D name="close" size={12} halo={false} />
            </button>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur relative">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="brand-logo grid h-12 w-12 place-items-center rounded-xl font-display text-xl font-extrabold text-primary-foreground">A</div>
            <div>
              <div className="font-display text-lg font-extrabold tracking-tight">ArbRadar</div>
              <div className="hidden text-xs text-muted-foreground sm:block">{t.tagline}</div>
            </div>
          </Link>
          <nav className="flex flex-wrap gap-1">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} activeOptions={{ exact: true }}
                className="group flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}>
                <Icon3D name={n.icon} size={20} halo={false} />
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <ThemeToggle />
            {user ? <Button variant="ghost" size="sm" onClick={() => void signOut()}>{t.agLogout}</Button> : <Button variant="ghost" size="sm" asChild><Link to="/login">{t.authSignIn}</Link></Button>}
            {right}
            <Link to="/plans" className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent">
              {t.currentPlan}: {current.title}
            </Link>
            <select aria-label={t.language} value={lang} onChange={(e) => setLang(e.target.value as Lang)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-sm">
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      <footer className="relative z-10 border-t border-border bg-background/60 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs leading-relaxed text-muted-foreground">
          <p>{t.disclaimer}</p>
          <p className="mt-1 font-medium text-foreground/70">{t.siteDisclaimer}</p>
          <p className="mt-1">© {new Date().getFullYear()} ArbRadar</p>
        </div>
      </footer>
    </div>
  );
}
