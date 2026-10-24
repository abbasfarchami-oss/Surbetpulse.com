<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Inbound odds arrive only via POST /api/public/odds-webhook (header x-webhook-secret = WEBHOOK_SECRET); the dashboard reads them through a server function, never a public GET — the product has no public data API.
- Webhook environment lookup runs only inside the POST server handler across process, server import.meta, and Nitro request/global Worker bindings; request-scoped bindings avoid relying solely on Node compatibility. Temporary missing-secret diagnostics expose only source presence and matching key names, never values or lengths.
- Plans, admin-managed settings and subscriptions live in Lovable Cloud with RLS; browser storage is only for bookmaker accounts and non-authoritative UI preferences, never entitlements — keeps paid access and admin writes server-controlled.
- The authenticated layout gates the admin UI; its loader calls requireAdmin and each write/AI handler checks has_role through the authenticated client — UI hiding is not an authorization boundary.
- Cloud catalog reads project only display settings; roles and subscriptions are user-scoped and verified owner assignment requires email confirmation — prevents anonymous privilege escalation.
- AuthProvider owns the single auth listener and viewer query; sign-out cancels queries and clears cache before ending the session — prevents stale protected data and refetch storms.
- All UI text goes through src/lib/i18n.tsx (English is the fallback for missing keys); it sets html lang/dir so layouts must use logical (start/end) spacing.
- Display numeric values through the i18n locale formatters, keeping input/copy values machine-readable and currency restricted to USD — prevents localization from changing stake entry semantics.
- ThemeToggle stores a browser-only theme preference and applies data-theme to the document; SportTabs owns sport icon presentation without changing scanner filtering — keeps appearance separate from feed behavior.
- AnimatedNumber owns count-up presentation and honors reduced motion; opportunity striping and bet-slip pulse use semantic global tokens — keeps live updates accessible without changing feed or betting behavior.
- FeedPresentation renders initial-load skeletons and per-row freshness bars using the existing odds-age limit and shared clock, never claiming a bookmaker expiry — the feed supplies updatedAt but no closing deadline; background refreshes retain existing rows.
- Scanner polling reads only collector/API snapshots, never injects demo rows, and alerts only for newly received live opportunities after the initial snapshot — real-feed status must not be simulated by random data.
- Real odds reach the dashboard only through the feed store: the browser collector posts to the webhook and src/lib/oddsfeed.server.ts polls a licensed odds provider with ODDS_FEED_KEY. Bookmaker sites refuse direct server-side reads (verified: block page/403), so do not add a site scraper or a second data path.
