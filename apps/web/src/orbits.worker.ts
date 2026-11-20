import { position as point } from "./lib/orbit";
import {
  json2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  eciToEcf,
  ecfToLookAngles,
} from "satellite.js";
let catalog: any[] = [];
self.onmessage = ({ data }) => {
  try {
    if (data.type === "load") {
      catalog = data.items
        .map((s: any) => {
          try {
            return { meta: s, rec: json2satrec(s) };
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      return;
    }
    if (data.type === "positions") {
      const points = catalog
        .map((s) => {
          try {
            const p = point(s.rec, data.time);
            return p
              ? { ...p, id: s.meta.NORAD_CAT_ID, name: s.meta.OBJECT_NAME }
              : null;
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      self.postMessage({ type: "positions", points, time: data.time });
    }
    if (data.type === "track") {
      const s = catalog.find((x) => x.meta.NORAD_CAT_ID === data.id);
      if (!s) return;
      const track = [];
      const passes: any[] = [];
      let pass: any = null;
      const observer = {
        latitude: (data.lat * Math.PI) / 180,
        longitude: (data.lon * Math.PI) / 180,
        height: 0,
      };
      for (let t = data.time; t <= data.time + 86400000; t += 30000) {
        const p = point(s.rec, t);
        if (!p) continue;
        if (
          t <=
          data.time + Math.min(86400000, 86400000 / Number(s.meta.MEAN_MOTION))
        )
          track.push(p);
        const angle =
          (ecfToLookAngles(observer, eciToEcf(p.p, gstime(new Date(t))))
            .elevation *
            180) /
          Math.PI;
        if (angle >= 10) {
          if (!pass)
            pass = { start: new Date(t).toISOString(), maxElevation: angle };
          pass.maxElevation = Math.max(angle, pass.maxElevation);
        } else if (pass) {
          passes.push({ ...pass, end: new Date(t).toISOString() });
          pass = null;
        }
      }
      if (pass) passes.push({ ...pass, end: null });
      self.postMessage({
        type: "track",
        id: data.id,
        requestId: data.requestId,
        track,
        passes,
      });
    }
  } catch (e) {
    self.postMessage({ type: "error", message: String(e) });
  }
};
