import { createServerFn } from "@tanstack/react-start";

/** Dashboard-only read of ingested odds (not a public API). */
export const getIngestedFeed = createServerFn({ method: "GET" }).handler(async () => {
  const [{ feed }, { refreshOddsFeed }, { requestClient, viewerAccess }, { allowsOpportunity }, { isErrorRow }] = await Promise.all([import("./feed-store.server"), import("./oddsfeed.server"), import("./cloud.server"), import("./access"), import("./filters")]);
  const client = requestClient();
  const viewer = await viewerAccess(client);
  const { data: setting, error } = await client.from("app_settings").select("value").eq("key", "error_threshold").single();
  if (error) throw new Error("Settings unavailable");
  await refreshOddsFeed().catch(() => undefined);
  return feed().filter((row) => allowsOpportunity(viewer.current, row) && !isErrorRow(row, Number(setting.value)))
    .map((row) => viewer.current.dropping ? row : { ...row, outcomes: row.outcomes.map(({ prevOdds: _previous, ...outcome }) => outcome) }).slice(0, 100);
});

/** Big Odds of the Day: highest odds per event/market/outcome/bookmaker seen today (UTC). */
export const getBigOdds = createServerFn({ method: "GET" }).handler(async () => {
  const { listBigOdds } = await import("./bigodds.server");
  return listBigOdds();
});

