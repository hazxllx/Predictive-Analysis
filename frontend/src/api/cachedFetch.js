import { getCachedQuery, setCachedQuery } from "./queryCache";

const DEFAULT_STALE_TIME = 5 * 60 * 1000;

export async function fetchWithCache({
  key,
  fetcher,
  staleTime = DEFAULT_STALE_TIME,
  force = false,
}) {
  if (!force) {
    const cached = getCachedQuery(key, staleTime);
    if (cached !== null && cached !== undefined) {
      return { data: cached, fromCache: true };
    }
  }

  const freshData = await fetcher();
  setCachedQuery(key, freshData);
  return { data: freshData, fromCache: false };
}

export { DEFAULT_STALE_TIME };
