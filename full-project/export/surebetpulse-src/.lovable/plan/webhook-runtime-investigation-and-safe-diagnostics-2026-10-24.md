# Webhook runtime investigation and safe diagnostics

- Report the published runtime, documented secret injection behavior, the exact configured secret names, and recent environment-reading changes. Distinguish confirmed evidence from unavailable production configuration.
- Preserve trimmed header/Bearer authentication and existing 401 reasons.
- Resolve the secret across available server-side environment sources, case-insensitively, without reading browser environment data.
- Temporarily include only matching environment key names and source-presence flags on `missing_server_secret` responses; never expose values or lengths.
- Add focused lookup and diagnostic tests, run existing tests, and verify the preview endpoint. Do not publish automatically.

## Technical details

- Inspect Nitro/Cloudflare integration before selecting runtime-binding access; use supported request context or Worker bindings without unsafe bundle configuration.
- Prefer `WEBHOOK_SECRET` within each source, then exact case-insensitive variants; continue through blank or absent sources.
- Keep diagnostics names-only, attach them only when the server secret is missing, and prevent response caching.

## Current evidence

- Production currently returns HTTP 401 with `missing_server_secret`.
- The project secret listing currently contains only `LOVABLE_API_KEY` and `LOVABLE_CRON_SECRET`; no case variant of `WEBHOOK_SECRET` is listed.
- The current resolver reads only `process.env`; the most recent edit added case-insensitive lookup but no alternate runtime source.