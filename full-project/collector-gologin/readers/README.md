# Standalone readers (one per bookmaker, no main reader)
- books/<key>.mjs — one file per book: own CONFIG (domain/mirrors/feed path), own parser, own error log + status (reader-state/<key>.err.log / .status.json).
- _shared/ — only tiny utils: http (GET), normalize (normLine), output (log/status/capture files).
- registry.json — list + enabled flags (new readers all disabled; 1xbet, sbobet unchanged = enabled).
- node readers/health.mjs [keys] — per-reader health report (light read-only public GETs; bet365/williamhill/sbobet not probed).
- node readers/run-readers.mjs — LOG-ONLY: writes reader-state/rows.json, never sends.
- node readers/test-readers.mjs — tests.
- bet365 + williamhill: EXPERIMENTAL passive sniffers (pairGroup bet365-williamhill). User opens the site in own profile; module only saves responses the page already loads. parse() = [] until a capture is analysed.
- gen-1x-readers.mjs + _1x-template.mjs: one-off generator used to create the 1x files; files are independent afterwards.
