import { useMemo, useState } from "react";
import proj4 from "proj4";
import type { Observation, Place } from "./lib/api";
export function landsatCrop(scene: Observation, place: Place) {
  const zone = Math.floor((place.lon + 180) / 6) + 1;
  const crs = `+proj=utm +zone=${Math.min(60, zone)} ${place.lat < 0 ? "+south" : ""} +datum=WGS84 +units=m +no_defs`;
  const epsg = (place.lat < 0 ? 32700 : 32600) + Math.min(60, zone);
  const [x, y] = proj4("EPSG:4326", crs, [place.lon, place.lat]);
  const cx = Math.round(x / 30) * 30,
    cy = Math.round(y / 30) * 30;
  const bounds = [cx - 3840, cy - 3840, cx + 3840, cy + 3840];
  const q = new URLSearchParams({
    collection: "landsat-c2-l2",
    item: scene.id,
    coord_crs: `EPSG:${epsg}`,
    dst_crs: `EPSG:${epsg}`,
    asset_as_band: "true",
    expression: "red*0.0000275-0.2;green*0.0000275-0.2;blue*0.0000275-0.2",
    rescale: "0,0.3",
    reproject: "nearest",
  });
  for (const band of ["red", "green", "blue"]) q.append("assets", band);
  return {
    url: `https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/${bounds.join(",")}/256x256.png?${q}`,
    bounds,
    epsg,
  };
}
export default function HistoricalViewer({
  before,
  after,
  place,
}: {
  before: Observation;
  after: Observation;
  place: Place;
}) {
  const [split, setSplit] = useState(50),
    [side, setSide] = useState(false),
    [failed, setFailed] = useState(false),
    [loaded, setLoaded] = useState(0);
  const crops = useMemo(
    () => [landsatCrop(before, place), landsatCrop(after, place)],
    [before, after, place],
  );
  return (
    <section className="historical-viewer">
      <h3>Historical Landsat comparison</h3>
      <p className="micro">
        Aligned 30 m UTM grid · 7.68 km crop · display stretch 0–0.3
        reflectance. Visual inspection only; no measured change or cloud mask.
      </p>
      {failed ? (
        <p role="alert">
          The imagery provider could not render this pair. Try another
          acquisition. No replacement image has been substituted.
        </p>
      ) : (
        <>
          {loaded < 2 && <p role="status">Loading archived imagery…</p>}
          <div className={"images " + (side ? "side" : "swipe")}>
            {[before, after].map((s, i) => (
              <div
                key={s.id}
                className={"imagepane " + (i ? "after" : "")}
                style={
                  i && !side
                    ? { clipPath: `inset(0 0 0 ${split}%)` }
                    : undefined
                }
              >
                <img
                  src={crops[i].url}
                  alt={`${i ? "After" : "Before"} Landsat acquisition ${s.date}`}
                  onLoad={() => setLoaded((n) => n + 1)}
                  onError={() => setFailed(true)}
                />
                <b>{s.date.slice(0, 10)}</b>
              </div>
            ))}
          </div>
          <input
            aria-label="Historical comparison swipe"
            type="range"
            value={split}
            onChange={(e) => setSplit(+e.target.value)}
          />
          <button onClick={() => setSide(!side)}>
            {side ? "Swipe view" : "Side by side"}
          </button>
        </>
      )}
      <p className="micro">
        Acquisitions: {before.sensor} / {after.sensor}. Cloud cover:{" "}
        {before.cloud?.toFixed(1)}% / {after.cloud?.toFixed(1)}%. Seasonal and
        atmospheric differences may dominate. Missing pixels are not evidence of
        change.
      </p>
      <a href={before.source} target="_blank" rel="noreferrer">
        Baseline metadata ↗
      </a>{" "}
      ·{" "}
      <a href={after.source} target="_blank" rel="noreferrer">
        Comparison metadata ↗
      </a>
    </section>
  );
}
