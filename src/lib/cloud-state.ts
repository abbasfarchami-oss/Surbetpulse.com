import { queryOptions, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCatalog, updateSetting, type SettingInput } from "./cloud.functions";

export const catalogOptions = queryOptions({ queryKey: ["catalog"], queryFn: () => getCatalog(), staleTime: 30_000 });
export function useCatalog() {
  const read = useServerFn(getCatalog);
  return useQuery({ ...catalogOptions, queryFn: () => read() });
}
export async function persistSetting(data: SettingInput) {
  await updateSetting({ data });
  window.dispatchEvent(new Event("catalog-changed"));
}