import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getViewer } from "./cloud.functions";
import { FREE_ACCESS } from "./access";

type AuthState = { user: { id: string; email?: string | undefined } | null; isAdmin: boolean; current: typeof FREE_ACCESS; ready: boolean };
const AuthContext = createContext<AuthState>({ user: null, isAdmin: false, current: FREE_ACCESS, ready: false });
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [identity, setIdentity] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [generation, setGeneration] = useState(0);
  const read = useServerFn(getViewer);
  const viewer = useQuery({ queryKey: ["viewer", identity, generation], queryFn: () => read(), enabled: !!identity, staleTime: 30_000 });
  useEffect(() => {
    let alive = true;
    let transition = 0;
    const syncIdentity = async () => {
      const started = transition;
      const { data: { user } } = await supabase.auth.getUser();
      if (alive && started === transition) { setIdentity(user?.id ?? null); setReady(true); }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED", "PASSWORD_RECOVERY"].includes(event)) return;
      transition += 1;
      setGeneration((n) => n + 1);
      setIdentity(session?.user.id ?? null);
      setReady(true);
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
      else void queryClient.cancelQueries().then(() => {
        queryClient.clear();
        void router.navigate({ to: "/login", replace: true });
      });
    });
    void syncIdentity();
    const catalogChanged = () => { void queryClient.invalidateQueries({ queryKey: ["catalog"] }); void queryClient.invalidateQueries({ queryKey: ["viewer"] }); };
    window.addEventListener("catalog-changed", catalogChanged);
    return () => { alive = false; subscription.unsubscribe(); window.removeEventListener("catalog-changed", catalogChanged); };
  }, [router, queryClient]);
  const data = identity ? viewer.data : undefined;
  return <AuthContext.Provider value={{ user: data?.user ?? null, isAdmin: data?.isAdmin ?? false, current: data?.current ?? FREE_ACCESS, ready: ready && (!identity || !viewer.isPending) }}>{children}</AuthContext.Provider>;
}