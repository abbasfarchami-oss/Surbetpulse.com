# Cloud authentication and protected administration

## Changes
- Add `/login` with email/password sign-in and signup, confirmation-email state, and sign-out. Lovable Cloud is now connected.
- Hide Admin navigation unless the signed-in account has an admin role. Keep `/admin` at the same address, behind the authenticated layout, with a server-validated role check before the panel renders. Protect all admin writes separately on the server.
- Create `app_role`, `user_roles` and security-definer `has_role()`. Assign admin to **REDACTED_WEBHOOK_SECRET only after email verification**, on signup/verification and for an existing verified account. No browser flags or editable metadata determine roles.
- Move the six current plans, per-bookmaker pricing, error threshold (200%), regional keywords, and admin-managed display mode/custom bookmaker settings into database tables. Seed the existing defaults in the migration; keep prices and presentation unchanged. Only admins may write; public reads are limited to display/filter settings.
- Store subscriptions with owner-only reads and admin-only writes. Remove browser activation of plans; choosing a paid plan must not grant access. Admin receives a free unlimited entitlement independent of subscription state.
- Require a signed-in admin for `suggestBookmakers` before any AI request. Enforce scanner subscription entitlements on the server as well as the existing display filters, without changing the incoming webhook or its secret handling.

## Assumptions
- No display name/avatar profile table is needed unless you answer otherwise; roles and subscriptions are separate protected tables.
- Browser-local settings are not a trusted shared catalog. Seed the current code defaults; do not import visitor-controlled stored plans or subscriptions.
- No payment activation is added: subscription assignment stays with authorized admins/trusted server operations, not browser buttons or the unfinished wallet.

## Technical details
- Use generated Cloud clients, the managed authenticated route layout, bearer attachment, authenticated server functions and role checks; RLS independently protects every table.
- Preserve existing plan/pricing/filter interfaces where practical so pages remain visually unchanged. Server reads use narrow public projections or authenticated user-scoped clients, not privileged public reads.
- Add tests for verified owner role assignment, non-admin denial, subscription write restrictions, defaults and free/unlimited admin entitlement; run existing tests and browser checks. If no owner account exists, owner sign-in verification will wait for account creation/confirmation rather than creating personal credentials.

## Unchanged
Logo, site name, theme, top SBOBet × 1xBet card, bookmaker images/mappings, existing metadata, odds webhook and `WEBHOOK_SECRET` handling. No publishing.