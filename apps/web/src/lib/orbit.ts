import { json2satrec, propagate, gstime, eciToGeodetic } from "satellite.js";
export function xyz(lat: number, lon: number, r = 1): [number, number, number] {
  const p = (lat * Math.PI) / 180,
    l = (lon * Math.PI) / 180;
  return [
    r * Math.cos(p) * Math.cos(l),
    r * Math.sin(p),
    -r * Math.cos(p) * Math.sin(l),
  ];
}
export function position(rec: ReturnType<typeof json2satrec>, time: number) {
  const pv = propagate(rec, new Date(time));
  if (!pv?.position || typeof pv.position === "boolean") return null;
  const g = eciToGeodetic(pv.position, gstime(new Date(time)));
  if (
    ![g.latitude, g.longitude, g.height].every(Number.isFinite) ||
    g.height < 0
  )
    return null;
  return {
    lat: (g.latitude * 180) / Math.PI,
    lon: (g.longitude * 180) / Math.PI,
    alt: g.height,
    p: pv.position,
  };
}
// These labels are name-based hints, not a verified payload/instrument database.
export function category(name: string): string {
  if (/DEB|R\/B/i.test(name)) return "Debris / rocket body";
  if (
    /SENTINEL|LANDSAT|CBERS|WORLDVIEW|PLEIADES|PLANET|FLOCK|SPOT|RESURS|CARTOSAT|RESOURCESAT/i.test(
      name,
    )
  )
    return "Earth observation";
  if (/STARLINK|ONEWEB|IRIDIUM|INTELSAT|SES-|EUTELSAT/i.test(name))
    return "Communications";
  if (/GPS|GALILEO|GLONASS|BEIDOU/i.test(name)) return "Navigation";
  if (/ISS|TIANHE|CSS/i.test(name)) return "Crewed station";
  return "Other / unclassified";
}
