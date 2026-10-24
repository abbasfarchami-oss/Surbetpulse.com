CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL, UNIQUE(user_id, role));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_roles ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT (_user_id = auth.uid() OR auth.role() = 'service_role') AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
CREATE FUNCTION public.assign_verified_owner_admin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN IF NEW.email_confirmed_at IS NOT NULL AND lower(NEW.email) = 'REDACTED_WEBHOOK_SECRET' THEN INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT (user_id, role) DO NOTHING; END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.assign_verified_owner_admin() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER assign_owner_on_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.assign_verified_owner_admin();
CREATE TRIGGER assign_owner_on_verification AFTER UPDATE OF email_confirmed_at, email ON auth.users FOR EACH ROW EXECUTE FUNCTION public.assign_verified_owner_admin();
INSERT INTO public.user_roles(user_id, role) SELECT id, 'admin'::public.app_role FROM auth.users WHERE lower(email) = 'REDACTED_WEBHOOK_SECRET' AND email_confirmed_at IS NOT NULL ON CONFLICT (user_id, role) DO NOTHING;
CREATE TABLE public.plans (id text PRIMARY KEY, position integer NOT NULL, config jsonb NOT NULL);
GRANT SELECT ON public.plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_plan_display ON public.plans FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY admin_plan_writes ON public.plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.plans(id, position, config) SELECT id, position, config::jsonb FROM (VALUES
('p1',1,'{"id":"p1","title":"Basic","price":10,"period":"month","live":false,"prematch":true,"api":false,"dropping":true,"maxProfit":15,"active":true}'),
('p2',2,'{"id":"p2","title":"Pro","price":100,"period":"month","live":true,"prematch":true,"api":true,"dropping":true,"maxProfit":null,"active":true}'),
('p3',3,'{"id":"p3","title":"Live only","price":50,"period":"month","live":true,"prematch":false,"api":false,"dropping":true,"maxProfit":null,"active":false}'),
('p4',4,'{"id":"p4","title":"Prematch only","price":30,"period":"month","live":false,"prematch":true,"api":false,"dropping":true,"maxProfit":null,"active":false}'),
('p5',5,'{"id":"p5","title":"Live + Prematch","price":80,"period":"month","live":true,"prematch":true,"api":false,"dropping":true,"maxProfit":null,"active":false}'),
('p6',6,'{"id":"p6","title":"Yearly Pro","price":1000,"period":"year","live":true,"prematch":true,"api":true,"dropping":true,"maxProfit":null,"active":false}')
) AS defaults(id, position, config);
CREATE TABLE public.app_settings (key text PRIMARY KEY, value jsonb NOT NULL);
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY display_settings ON public.app_settings FOR SELECT TO anon, authenticated USING (key IN ('book_pricing', 'error_threshold', 'regional_keywords', 'bet_mode'));
CREATE POLICY admin_settings ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.app_settings(key,value) SELECT key, value::jsonb FROM (VALUES
('error_threshold','200'),
('regional_keywords','["Bangladesh","Vietnam","Indonesia","Thailand","Malaysia","India","Myanmar","Cambodia","Singapore","Hong Kong","China","Korea","Japan","Australia","Russia","Belarus","Kazakhstan","Uzbekistan","Armenia","U21","U23","Reserves","II","2nd Division","Division 2","Liga 2","Youth"]'),
('bet_mode','"odds"'),
('custom_books','[]'),
('book_pricing','{"base":20,"included":["1xBet","Pinnacle","Bet365"],"prices":{"1xBet":0,"Pinnacle":0,"Bet365":0,"William Hill":4,"Unibet":4,"SBOBet":4,"Marathonbet":3,"Betway":3,"bwin":3}}')
) AS defaults(key,value);
CREATE TABLE public.subscriptions (user_id uuid PRIMARY KEY, plan_id text REFERENCES public.plans(id), status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive')), expires_at timestamptz);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_subscription ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY admin_subscriptions ON public.subscriptions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX user_roles_user_idx ON public.user_roles(user_id);