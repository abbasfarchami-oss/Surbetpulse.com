# ArbRadar collector — GoLogin edition
Reads public odds only (never bets) from bookmaker sites through GoLogin anti-detect profiles, and POSTs cross-book opportunities to the webhook.

## How it connects
- Puppeteer (`puppeteer-core`) connects to **GoLogin Cloud Browser**: `wss://cloudbrowser.gologin.com/connect?token=TOKEN&profile=PROFILE_ID`. No local Orbita/GUI needed → fits a headless Ubuntu 24.04 server.
  (Alternative: npm `gologin` package runs Orbita locally — needs more RAM/deps; not used.)
- Each book in `config.json > BOOKS` has `gologinProfileId`, `proxy` (null = keep profile's own proxy; or `{type,host,port,username,password,country}` → pushed to the profile via `PATCH /browser/{id}/proxy` at start), `type` (`1x` or `pinnacle`).
- 1xBet family: `/LiveFeed|LineFeed/Get1x2_VZip` JSON from inside the page.
- Pinnacle: not 1x-family; reads `guest.api.arcadia.pinnacle.com/0.1/sports/29/matchups` + `markets/straight` (American odds → decimal). Pinnacle blocks many countries/IPs; needs a proxy in an allowed country. Endpoint/key may change — verify on first run.

## Setup (server)
```
cd collector-gologin && npm install
export GOLOGIN_TOKEN_FILE=/path/.gologin_token   # or GOLOGIN_TOKEN=...
export WEBHOOK_SECRET=...
node collector.mjs   # or under pm2/systemd
```
Proxies must be **non-Finnish** (Melbet/888starz block Finnish IPs; server is in Finland).
Plan limit: 10 profiles → BetForward has no slot. Cloud browser minutes/concurrency depend on the GoLogin plan.
