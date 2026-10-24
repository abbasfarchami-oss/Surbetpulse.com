import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { getViewer } from "@/lib/cloud.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [
    { title: "Sign in — ArbRadar" }, { name: "description", content: "Sign in to your ArbRadar account." },
    { property: "og:title", content: "Sign in — ArbRadar" }, { property: "og:description", content: "Secure account sign-in for ArbRadar." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: LoginPage,
});
function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const readViewer = useServerFn(getViewer);
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage(""); setError(false);
    try {
      const result = signup
        ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) { setError(true); setMessage(result.error.message); return; }
      if (!result.data.session) { setMessage(t.authConfirmEmail); return; }
      const viewer = await readViewer();
      await navigate({ to: viewer.isAdmin ? "/admin" : "/" });
    } catch { setError(true); setMessage(t.authFailed); }
    finally { setBusy(false); }
  };
  return <AppShell><div className="mx-auto max-w-sm">
    <h1 className="text-2xl font-bold">{signup ? t.authCreateAccount : t.authSignIn}</h1>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block text-sm">{t.authEmail}<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" className="mt-1 w-full rounded-lg border border-input bg-secondary px-3 py-2" /></label>
      <label className="block text-sm">{t.agPass}<input type="password" required minLength={6} autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-secondary px-3 py-2" /></label>
      <Button type="submit" disabled={busy} className="w-full">{busy ? t.authWorking : signup ? t.authCreateAccount : t.authSignIn}</Button>
      {message && <p role={error ? "alert" : "status"} className={error ? "text-sm text-destructive" : "text-sm text-primary"}>{message}</p>}
    </form>
    <Button variant="ghost" className="mt-3 w-full" onClick={() => { setSignup(!signup); setMessage(""); }}>{signup ? t.authHaveAccount : t.authCreateAccount}</Button>
  </div></AppShell>;
}