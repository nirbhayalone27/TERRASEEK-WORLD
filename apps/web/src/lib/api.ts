import type { Scene } from "./catalog";
export type Place = { name: string; lat: number; lon: number };
export type Observation = Scene & {
  collection: string;
  geometry?: { type: string; coordinates: unknown };
};
const base = import.meta.env.VITE_API_URL || "";
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(base + "/api/v1/" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(35000),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({ detail: "Service unavailable" }));
    throw Error(
      typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail),
    );
  }
  return r.json();
}
export function interpret(q: string) {
  const years = q.match(/\b20\d{2}\b/g) || [];
  const match = q.match(
    /(?:near|around|of|in)\s+(.+?)(?:\s+between|\s+from|\s+during|$)/i,
  );
  return {
    place: match?.[1]?.trim() || q,
    mode: /water|flood/i.test(q) ? "water" : "vegetation",
    start: years[0] ? years[0] + "-01-01" : undefined,
    end: years[1] ? years[1] + "-12-31" : undefined,
  };
}
export function download(
  name: string,
  data: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
