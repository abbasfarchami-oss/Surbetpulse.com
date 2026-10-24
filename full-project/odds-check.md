# ArbRadar server check — 2026-10-23 (Asia/Tehran)
## Server 65.109.199.19
- hostname vmabbasbghr7xxxtjd1vs4qpt, Ubuntu 24.04.4 LTS, up 1d15h, load ~0.0
- Listening: 22 sshd, 443 xray, 53 local resolver only
## Proxies
| Proxy | Type | Port | Running | Exit IP |
|---|---|---|---|---|
| xray.service | VLESS + REALITY (tcp, SNI www.microsoft.com), 1 client, outbound freedom | 443 | yes | 65.109.199.19 / 2a01:4f9:c010:5f61::1 |
No second proxy found (no 3proxy/squid/dante/gost/tinyproxy, no other listening port). xray is an inbound VPN-style proxy (needs a VLESS client), not a local HTTP/SOCKS proxy, so traffic through it exits from the same server IP as direct.
## Odds feed (direct from server, plain curl, browser UA)
| Site | Result |
|---|---|
| 1xbet.com | redirect -> 1xbet.fi, path lowercased -> 404; service-api path -> 406 NotAcceptable JSON |
| melbet.com | 203 -> /en/block (geo/bot block page) |
| betwinner.com | -> betwinner2.com, 404 / 406 |
| 22bet.com | 404 / 406 |
| megapari.com | -> 2457320mp.pro, 404 / 406 |
| 888starz.bet | 203 -> /en/block |
| paripesa.bet | -> paripesa.me homepage (HTML) / 406 |
| fairpari.com | -> fairpari-39771.top, 404 / 406 |
| winwin.bet | -> ww-bet.com, 404 / 406 |
| betforward.com | 200 -> www.betforward.com |
No JSON events returned from any site via plain HTTP. Feed needs a real browser session (cookies/headers set by site JS) as collector.mjs does with Puppeteer; melbet/888starz also block Finland IP.
