import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  Search,
  Globe2,
  Layers,
  ArrowUpRight,
  ArrowRight,
  MapPin,
  Satellite,
  ScanLine,
  Download,
  X,
  Loader2,
  Info,
  LogIn,
  Leaf,
  Droplets,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import {
  api,
  interpret,
  download,
  type Place,
  type Observation,
} from "./lib/api";
import { pairIssues } from "./lib/catalog";
import "./style.css";
import Introduction from "./Introduction";
import ComparisonAssistant from "./ComparisonAssistant";
import HistoricalViewer from "./HistoricalViewer";
import HowItWorks from "./HowItWorks";
import { category } from "./lib/orbit";
const Globe = lazy(() => import("./Globe"));
const MapView = lazy(() => import("./Map"));
const supabase =
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    ? createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
      )
    : null;
const presets = [
  { name: "Pune, India", lat: 18.5204, lon: 73.8567 },
  { name: "Nagpur, India", lat: 21.1458, lon: 79.0882 },
  { name: "Mumbai, India", lat: 19.076, lon: 72.8777 },
];
const date = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
class Boundary extends React.Component<
  { children: React.ReactNode; fallback: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="fallback">
        <p>3D rendering is unavailable on this device.</p>
        <button onClick={this.props.fallback}>Open 2D map</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function initialView(): "3d" | "2d" {
  try {
    const canvas = document.createElement("canvas");
    return canvas.getContext("webgl2") ? "3d" : "2d";
  } catch {
    return "2d";
  }
}
function App() {
  const [place, setPlace] = useState<Place>(presets[0]),
    [query, setQuery] = useState(""),
    [places, setPlaces] = useState<Place[]>([]),
    [view, setView] = useState<"3d" | "2d">(initialView),
    [tab, setTab] = useState("explore");
  const [start, setStart] = useState("2025-01-01"),
    [end, setEnd] = useState("2025-03-31"),
    [cloud, setCloud] = useState(30),
    [collection, setCollection] = useState("sentinel-2-l2a"),
    [scenes, setScenes] = useState<Observation[]>([]),
    [before, setBefore] = useState<Observation>(),
    [after, setAfter] = useState<Observation>();
  const [archiveSlot, setArchiveSlot] = useState<"before" | "after">("before");
  const [baselineStart, setBaselineStart] = useState("2014-01-01");
  const [baselineEnd, setBaselineEnd] = useState("2014-03-31");
  const [comparisonStart, setComparisonStart] = useState("2025-01-01");
  const [comparisonEnd, setComparisonEnd] = useState("2025-03-31");
  const [historical, setHistorical] = useState(false);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [searched, setSearched] = useState(false),
    [result, setResult] = useState<any>(null),
    [mode, setMode] = useState("vegetation"),
    [split, setSplit] = useState(50),
    [side, setSide] = useState(false),
    [showMask, setShowMask] = useState(false),
    [threshold, setThreshold] = useState(0.2),
    [sector, setSector] = useState("Environment");
  const [catalog, setCatalog] = useState<any[]>([]),
    [points, setPoints] = useState<any[]>([]),
    [track, setTrack] = useState<any[]>([]),
    [passes, setPasses] = useState<any[]>([]),
    [selected, setSelected] = useState<number>(),
    [satFilter, setSatFilter] = useState("SENTINEL"),
    [satError, setSatError] = useState(""),
    [showSats, setShowSats] = useState(true),
    [offset, setOffset] = useState(0),
    [orbitLoading, setOrbitLoading] = useState(false);
  const [modal, setModal] = useState(""),
    [email, setEmail] = useState(""),
    [user, setUser] = useState<any>(null),
    [notice, setNotice] = useState("");
  const [following, setFollowing] = useState(false);
  const [satCategory, setSatCategory] = useState("All");
  const [speed, setSpeed] = useState(1);
  const [orbitTime, setOrbitTime] = useState(Date.now());
  const clock = useRef(Date.now());
  const trackRequest = useRef(0);
  const selectedMeta = catalog.find((s) => s.NORAD_CAT_ID === selected);
  const selectedPosition = points.find((s) => s.id === selected);
  const worker = useRef<Worker | null>(null),
    abort = useRef<AbortController | null>(null),
    requestVersion = useRef(0);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input,select,[tabindex="0"]',
        ) || [],
      );
    focusable()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal("");
      if (event.key === "Tab") {
        const nodes = focusable();
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [modal]);
  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setUser(data.user));
    const sub = supabase?.auth.onAuthStateChange((_, s) => setUser(s?.user));
    return () => sub?.data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    worker.current = new Worker(
      new URL("./orbits.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current.onmessage = ({ data }) => {
      if (data.type === "positions") setPoints(data.points);
      if (data.type === "track" && data.requestId === trackRequest.current) {
        setTrack(data.track);
        setPasses(data.passes);
        setOrbitLoading(false);
      }
      if (data.type === "error") {
        setSatError(data.message);
        setOrbitLoading(false);
      }
    };
    api<any>("satellites?group=active")
      .then((d) => {
        setCatalog(d.items);
        worker.current?.postMessage({ type: "load", items: d.items });
        worker.current?.postMessage({ type: "positions", time: Date.now() });
      })
      .catch((e) => setSatError(e.message));
    return () => worker.current?.terminate();
  }, []);
  useEffect(() => {
    clock.current = Date.now() + offset * 60000;
  }, [offset]);
  useEffect(() => {
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      clock.current += (now - last) * speed;
      last = now;
      // This is a near-epoch replay, never a historical orbit reconstruction.
      if (Math.abs(clock.current - Date.now()) > 7200000) {
        clock.current = Date.now();
        setSpeed(1);
        setOffset(0);
      }
      if (document.hidden) return;
      setOrbitTime(clock.current);
      worker.current?.postMessage({ type: "positions", time: clock.current });
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [speed, catalog]);
  useEffect(() => {
    const requestId = ++trackRequest.current;
    setTrack([]);
    setPasses([]);
    if (selected) {
      setOrbitLoading(true);
      worker.current?.postMessage({
        type: "track",
        id: selected,
        requestId,
        time: clock.current,
        lat: place.lat,
        lon: place.lon,
      });
    } else setOrbitLoading(false);
  }, [selected, place, offset]);
  function selectSatellite(id: number) {
    setSelected(id);
    setFollowing(false);
    setTab("satellites");
  }
  function selectPlace(p: Place) {
    requestVersion.current++;
    abort.current?.abort();
    setPlace(p);
    setPlaces([]);
    setQuery("");
    setScenes([]);
    setSearched(false);
    setBefore(undefined);
    setAfter(undefined);
    setResult(null);
    setError("");
    setBusy("");
  }
  async function searchPlace(e: React.FormEvent) {
    e.preventDefault();
    const version = ++requestVersion.current;
    setError("");
    setBusy("Finding location");
    try {
      const parsed = interpret(query);
      if (parsed.start) setStart(parsed.start);
      if (parsed.end) setEnd(parsed.end);
      setMode(parsed.mode);
      const d = await api<Place[]>(
        "places?q=" + encodeURIComponent(parsed.place),
      );
      if (version !== requestVersion.current) return;
      setPlaces(d);
      if (!d.length)
        setError("No matching place. Try a city or latitude, longitude.");
    } catch (e) {
      if (version === requestVersion.current) setError(String(e));
    } finally {
      if (version === requestVersion.current) setBusy("");
    }
  }
  async function findScenes(slot?: "before" | "after") {
    const version = ++requestVersion.current;
    setBusy("Searching satellite archives");
    setError("");
    setResult(null);
    if (!slot) {
      setBefore(undefined);
      setAfter(undefined);
    }
    if (slot) setArchiveSlot(slot);
    try {
      const d = await api<any>("imagery/search", {
        lat: place.lat,
        lon: place.lon,
        start: slot
          ? slot === "before"
            ? baselineStart
            : comparisonStart
          : start,
        end: slot ? (slot === "before" ? baselineEnd : comparisonEnd) : end,
        cloud,
        collection,
      });
      if (version !== requestVersion.current) return;
      setScenes(d.items);
      setSearched(true);
      setNotice(
        d.limited
          ? "Showing the first 40 scenes. Narrow dates to find older observations."
          : "",
      );
      setTab("imagery");
    } catch (e) {
      if (version === requestVersion.current) setError(String(e));
    } finally {
      if (version === requestVersion.current) setBusy("");
    }
  }
  async function analyze() {
    if (!before || !after) return;
    const issues = pairIssues(before, after);
    if (issues.length) {
      setError(issues.join(". "));
      return;
    }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setError("");
    setResult(null);
    try {
      const { analyzePair } = await import("./lib/raster");
      const r = await analyzePair(
        before,
        after,
        place.lat,
        place.lon,
        threshold,
        (s) => setBusy(s),
        controller.signal,
      );
      controller.signal.throwIfAborted();
      setResult({
        ...r,
        place,
        beforeScene: before.id,
        afterScene: after.id,
        dates: [before.date, after.date],
        sources: [before.source, after.source],
        sensors: [before.sensor, after.sensor],
        created: new Date().toISOString(),
      });
      setTab("compare");
    } catch (e) {
      if (!controller.signal.aborted) setError(String(e));
    } finally {
      setBusy("");
    }
  }
  function pickScene(s: Observation) {
    if (busy) return;
    setResult(null);
    if (historical) {
      if (archiveSlot === "before") setBefore(s);
      else setAfter(s);
      return;
    }
    if (!before || after) {
      setBefore(s);
      setAfter(undefined);
    } else {
      if (s.date < before.date) {
        setAfter(before);
        setBefore(s);
      } else setAfter(s);
    }
  }
  function report() {
    if (!result) return;
    const {
      before: a,
      after: b,
      mask,
      waterMask,
      ndviBefore,
      ndviAfter,
      falseBefore,
      falseAfter,
      ...data
    } = result;
    download(
      "terraseek-evidence.json",
      JSON.stringify(
        {
          ...data,
          sector,
          status: "exploratory spectral screening",
          areas_hectares: {
            valid: result.stats.valid * 0.04,
            ndvi_decrease: result.stats.loss * 0.04,
            ndvi_increase: result.stats.gain * 0.04,
            water_appeared: result.stats.waterAppeared * 0.04,
            water_disappeared: result.stats.waterDisappeared * 0.04,
          },
        },
        null,
        2,
      ),
    );
  }
  async function save() {
    if (!supabase || !user) {
      setModal("account");
      return;
    }
    setBusy("Saving project");
    try {
      const { error } = await supabase.from("projects").insert({
        owner_id: user.id,
        name: place.name,
        body: {
          place,
          before: before?.id,
          after: after?.id,
          start,
          end,
          sector,
          result: result
            ? {
                stats: result.stats,
                method: result.method,
                dates: result.dates,
                sources: result.sources,
              }
            : null,
        },
      });
      if (error) throw error;
      setNotice("Project saved to your account.");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy("");
    }
  }
  const pct = result
    ? Math.round((result.stats.valid / result.stats.total) * 100)
    : 0;
  return (
    <div className="app">
      <Introduction />
      <header>
        <a className="brand" href="/" aria-label="TerraSeek home">
          <span className="brand-icon">
            <Globe2 size={23} />
          </span>
          terra<span>seek</span>
          <sup>WORLD</sup>
        </a>
        <button className="how-button" onClick={() => setModal("how")}>
          How It Works
        </button>
        <nav>
          <button
            className={tab !== "satellites" ? "active" : ""}
            onClick={() => setTab("explore")}
          >
            Earth explorer
          </button>
          <button
            className={tab === "satellites" ? "active" : ""}
            onClick={() => setTab("satellites")}
          >
            Orbit explorer
          </button>
          <button onClick={() => setModal("method")}>
            Methodology <ArrowUpRight size={13} />
          </button>
        </nav>
        <button className="account" onClick={() => setModal("account")}>
          <LogIn size={15} />
          {user ? "My account" : "Save your workspace"}
        </button>
      </header>
      <main>
        <div className="world">
          <Boundary key={view} fallback={() => setView("2d")}>
            <Suspense
              fallback={<div className="loading-globe">Preparing Earth…</div>}
            >
              {view === "3d" ? (
                <Globe
                  place={place}
                  points={
                    showSats
                      ? points.filter(
                          (p) =>
                            satCategory === "All" ||
                            category(p.name) === satCategory,
                        )
                      : []
                  }
                  selected={selected}
                  following={following}
                  paused={!!busy || tab === "compare" || !!modal}
                  onSelect={selectSatellite}
                  onInteract={() => setFollowing(false)}
                  track={track}
                  onPick={(lat, lon) =>
                    selectPlace({ name: "Selected study area", lat, lon })
                  }
                />
              ) : (
                <MapView
                  place={place}
                  onPick={(lat, lon) =>
                    selectPlace({ name: "Selected study area", lat, lon })
                  }
                />
              )}
            </Suspense>
          </Boundary>
        </div>
        <div className="topline">
          <span>
            <i /> EARTH OBSERVATION WORKSPACE
          </span>
          <span>V 0.2 / EXPLORATORY RELEASE</span>
        </div>
        <aside className="left">
          <div className="intro">
            <span className="eyebrow">A DIFFERENT PERSPECTIVE</span>
            <h1>
              Every place.
              <br />A changing story.
            </h1>
            <p>
              Explore our planet. Compare observations.
              <br />
              Find the evidence behind the change.
            </p>
          </div>
          <form className="search" onSubmit={searchPlace}>
            <Search size={19} />
            <input
              aria-label="Search a place or ask a question"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a place or ask about change"
              required
            />
            <button aria-label="Find location" disabled={!!busy}>
              <ArrowRight size={19} />
            </button>
          </form>
          {places.length > 0 && (
            <div className="search-results glass">
              {places.map((p, i) => (
                <button key={i} onClick={() => selectPlace(p)}>
                  <MapPin size={15} />
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <div className="presets">
            {presets.map((p) => (
              <button key={p.name} onClick={() => selectPlace(p)}>
                {p.name.split(",")[0]} <ArrowUpRight size={11} />
              </button>
            ))}
          </div>
          <section className="study glass">
            <div className="section-heading">
              <span>
                <MapPin size={15} /> YOUR STUDY AREA
              </span>
              <button title="About study area" onClick={() => setModal("aoi")}>
                <Info size={15} />
              </button>
            </div>
            <h2>{place.name}</h2>
            <div className="coords">
              {place.lat.toFixed(4)}° N · {place.lon.toFixed(4)}° E{" "}
              <span>2.56 × 2.56 km</span>
            </div>
            <div className="rule" />
            <label>
              <input
                type="checkbox"
                checked={historical}
                onChange={(e) => {
                  setHistorical(e.target.checked);
                  setBefore(undefined);
                  setAfter(undefined);
                  setResult(null);
                }}
              />{" "}
              Independent historical periods
            </label>
            {historical && (
              <div className="historical-dates">
                <label>Baseline range</label>
                <div className="dates">
                  <input
                    aria-label="Baseline start"
                    type="date"
                    value={baselineStart}
                    onChange={(e) => setBaselineStart(e.target.value)}
                  />
                  <input
                    aria-label="Baseline end"
                    type="date"
                    value={baselineEnd}
                    onChange={(e) => setBaselineEnd(e.target.value)}
                  />
                </div>
                <button onClick={() => findScenes("before")} disabled={!!busy}>
                  Find baseline observations
                </button>
                <label>Comparison range</label>
                <div className="dates">
                  <input
                    aria-label="Comparison start"
                    type="date"
                    value={comparisonStart}
                    onChange={(e) => setComparisonStart(e.target.value)}
                  />
                  <input
                    aria-label="Comparison end"
                    type="date"
                    value={comparisonEnd}
                    onChange={(e) => setComparisonEnd(e.target.value)}
                  />
                </div>
                <button onClick={() => findScenes("after")} disabled={!!busy}>
                  Find comparison observations
                </button>
                <p className="micro">
                  Use Landsat for 2014 and earlier. Exact acquisition dates
                  appear in the results; dates are never silently substituted.
                </p>
              </div>
            )}
            <label>Observation period</label>
            <div className="dates">
              <input
                aria-label="Start date"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <span>→</span>
              <input
                aria-label="End date"
                type="date"
                value={end}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
            <div className="filter-row">
              <label>
                Imagery source
                <select
                  value={collection}
                  onChange={(e) => {
                    setCollection(e.target.value);
                    setBefore(undefined);
                    setAfter(undefined);
                    setResult(null);
                    setScenes([]);
                  }}
                >
                  <option value="sentinel-2-l2a">Sentinel-2 · optical</option>
                  <option value="landsat-c2-l2">Landsat · optical</option>
                  <option value="sentinel-1-rtc">Sentinel-1 · radar</option>
                </select>
              </label>
              <label>
                Cloud cover
                <select
                  aria-label="Cloud cover limit"
                  value={cloud}
                  onChange={(e) => setCloud(+e.target.value)}
                >
                  <option value={10}>≤ 10%</option>
                  <option value={30}>≤ 30%</option>
                  <option value={60}>≤ 60%</option>
                  <option value={100}>Any</option>
                </select>
              </label>
            </div>
            <button
              className="primary full"
              onClick={() => findScenes()}
              disabled={!!busy}
            >
              <ScanLine size={16} />
              Find observations <ArrowRight size={16} />
            </button>
            <p className="micro">
              Actual acquisitions. No synthetic satellite scenes.
            </p>
          </section>
          <div className="workflow">
            <span>REPORT CONTEXT</span>
            <select
              aria-label="Sector workflow"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
            >
              {[
                "Environment",
                "Real estate",
                "Mining",
                "Government",
                "Defence",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </aside>
        <div className="view-controls glass">
          <button
            className={view === "3d" ? "selected" : ""}
            onClick={() => setView("3d")}
          >
            <Globe2 size={15} />
            3D Earth
          </button>
          <button
            className={view === "2d" ? "selected" : ""}
            onClick={() => setView("2d")}
          >
            <Layers size={15} />
            2D map
          </button>
        </div>
        <div className="earth-caption">
          <div className="crosshair">+</div>
          <strong>{place.name.split(",")[0]}</strong>
          <span>
            {view === "3d"
              ? "Drag to orbit · scroll to zoom · double-click to select"
              : "Click map to choose study center"}
          </span>
        </div>
        <div className="right-actions">
          <button
            className="glass"
            onClick={() =>
              setTab(tab === "satellites" ? "explore" : "satellites")
            }
            title="Satellite catalog"
          >
            <Satellite size={19} />
          </button>
          <button
            className="glass"
            onClick={() => setShowSats(!showSats)}
            title="Toggle satellite visibility"
          >
            <Layers size={19} />
          </button>
          <button
            className="glass"
            onClick={() => setModal("method")}
            title="Evidence and limitations"
          >
            <Info size={19} />
          </button>
        </div>
        {tab === "satellites" && (
          <section className="drawer glass">
            <div className="section-heading">
              <span>ORBIT EXPLORER</span>
              <button
                onClick={() => setTab("explore")}
                aria-label="Close orbit explorer"
              >
                <X size={18} />
              </button>
            </div>
            <h2>A sky in motion.</h2>
            <p className="muted">
              {catalog.length
                ? `${catalog.length.toLocaleString()} active catalog objects`
                : "Loading CelesTrak catalog…"}{" "}
              · SGP4 propagation
            </p>
            {satError && <p className="error">{satError}</p>}
            <input
              className="field"
              aria-label="Search satellites"
              value={satFilter}
              onChange={(e) => setSatFilter(e.target.value)}
              placeholder="Search satellite name or NORAD ID"
            />
            <label>
              Category (name-based hint)
              <select
                aria-label="Satellite category"
                value={satCategory}
                onChange={(e) => setSatCategory(e.target.value)}
              >
                {[
                  "All",
                  "Earth observation",
                  "Communications",
                  "Navigation",
                  "Crewed station",
                  "Other / unclassified",
                  "Debris / rocket body",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            {selectedMeta && (
              <section
                className="satellite-detail"
                aria-label="Selected satellite"
              >
                <h3>{selectedMeta.OBJECT_NAME}</h3>
                <p>
                  NORAD {selected} · {category(selectedMeta.OBJECT_NAME)}
                </p>
                <dl>
                  <dt>Altitude</dt>
                  <dd>
                    {selectedPosition
                      ? selectedPosition.alt.toFixed(1) + " km"
                      : "Unavailable"}
                  </dd>
                  <dt>Inclination</dt>
                  <dd>{selectedMeta.INCLINATION}°</dd>
                  <dt>Element epoch</dt>
                  <dd>{selectedMeta.EPOCH} UTC</dd>
                </dl>
                <button onClick={() => setFollowing(!following)}>
                  {following ? "Exit follow" : "Follow satellite"}
                </button>
                <button
                  onClick={() => {
                    setSelected(undefined);
                    setFollowing(false);
                  }}
                >
                  Clear selection
                </button>
                <p className="micro">
                  Solid: predicted trajectory · dashed: ground track. No sensor
                  footprint is inferred.
                </p>
              </section>
            )}
            <div className="satlist">
              {catalog
                .filter(
                  (s) =>
                    satCategory === "All" ||
                    category(s.OBJECT_NAME) === satCategory,
                )
                .filter((s) =>
                  (s.OBJECT_NAME + " " + s.NORAD_CAT_ID)
                    .toLowerCase()
                    .includes(satFilter.toLowerCase()),
                )
                .slice(0, 60)
                .map((s) => (
                  <button
                    className={selected === s.NORAD_CAT_ID ? "selected" : ""}
                    key={s.NORAD_CAT_ID}
                    onClick={() => selectSatellite(s.NORAD_CAT_ID)}
                  >
                    <Satellite size={15} />
                    <span>
                      {s.OBJECT_NAME}
                      <small>
                        NORAD {s.NORAD_CAT_ID} · epoch{" "}
                        {date(s.EPOCH.endsWith("Z") ? s.EPOCH : s.EPOCH + "Z")}
                      </small>
                    </span>
                    <ArrowUpRight size={14} />
                  </button>
                ))}
            </div>
            <div className="replay-controls">
              <time>
                {new Date(orbitTime)
                  .toISOString()
                  .replace("T", " ")
                  .slice(0, 19)}{" "}
                UTC
              </time>
              <label>
                Playback speed
                <select
                  aria-label="Playback speed"
                  value={speed}
                  onChange={(e) => setSpeed(+e.target.value)}
                >
                  <option value={0}>Paused</option>
                  <option value={1}>Real time</option>
                  <option value={30}>30×</option>
                  <option value={60}>60×</option>
                </select>
              </label>
              <button
                onClick={() => {
                  clock.current = Date.now();
                  setOffset(0);
                  setSpeed(1);
                }}
              >
                Return to live
              </button>
            </div>
            <label>
              Replay offset: {offset} minutes
              <input
                type="range"
                min={-120}
                max={120}
                value={offset}
                onChange={(e) => setOffset(+e.target.value)}
              />
            </label>
            {selected && (
              <>
                <h3>Predicted passes · next 24 hours</h3>
                {orbitLoading ? (
                  <p>Calculating in background…</p>
                ) : passes.length ? (
                  passes.map((p, i) => (
                    <div className="pass" key={i}>
                      {new Date(p.start).toLocaleTimeString()}{" "}
                      <span>max {p.maxElevation.toFixed(1)}°</span>
                    </div>
                  ))
                ) : (
                  <p className="muted">
                    No sampled passes above 10° elevation.
                  </p>
                )}
              </>
            )}
            <p className="micro">
              30-second sampling. Orbital passes are predictions, not proof of
              imagery. Current elements are unsuitable for precise historical
              reconstruction.
            </p>
          </section>
        )}
        {tab === "imagery" && (
          <section className="drawer glass">
            <div className="section-heading">
              <span>OBSERVATION ARCHIVE</span>
              <button
                onClick={() => setTab("explore")}
                aria-label="Close imagery"
              >
                <X size={18} />
              </button>
            </div>
            <h2>{scenes.length} observations.</h2>
            <p className="muted">
              {historical
                ? `Selecting ${archiveSlot === "before" ? "baseline" : "comparison"} acquisition. Search the other period to complete the pair.`
                : "Select a baseline, then a later observation."}
            </p>
            {notice && <p className="micro">{notice}</p>}
            {!scenes.length && searched && (
              <p>
                No scenes match these filters. Expand the dates or cloud limit.
              </p>
            )}
            <div className="scenelist">
              {scenes.map((s) => (
                <button
                  className={
                    "scene " +
                    (before?.id === s.id || after?.id === s.id ? "chosen" : "")
                  }
                  key={s.id}
                  onClick={() => pickScene(s)}
                >
                  {s.thumbnail ? (
                    <img
                      src={s.thumbnail}
                      alt="Satellite scene overview"
                      loading="lazy"
                      onError={(e) =>
                        (e.currentTarget.style.visibility = "hidden")
                      }
                    />
                  ) : (
                    <span className="image-empty">
                      <Layers />
                    </span>
                  )}
                  <span>
                    <strong>{date(s.date)}</strong>
                    <small>
                      {s.sensor} ·{" "}
                      {s.cloud == null ? "SAR" : `${s.cloud.toFixed(1)}% cloud`}
                    </small>
                    <small>
                      {before?.id === s.id
                        ? "01 / BASELINE"
                        : after?.id === s.id
                          ? "02 / COMPARISON"
                          : s.tile}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            {before && (
              <div className="micro">
                Baseline: {before.sensor} · {before.date} ·{" "}
                <a href={before.source} target="_blank" rel="noreferrer">
                  Acquisition metadata ↗
                </a>
              </div>
            )}
            {after && (
              <div className="micro">
                Comparison: {after.sensor} · {after.date} ·{" "}
                <a href={after.source} target="_blank" rel="noreferrer">
                  Acquisition metadata ↗
                </a>
              </div>
            )}
            {before &&
              after &&
              before.collection === "landsat-c2-l2" &&
              after.collection === "landsat-c2-l2" &&
              before.date < after.date && (
                <HistoricalViewer
                  key={before.id + after.id + place.lat + place.lon}
                  before={before}
                  after={after}
                  place={place}
                />
              )}
            {before && (
              <div className="selection">
                <p>
                  01 <strong>{date(before.date)}</strong> → 02{" "}
                  <strong>
                    {after ? date(after.date) : "Select later scene"}
                  </strong>
                </p>
                <label>
                  ΔNDVI threshold
                  <input
                    type="number"
                    min="0.05"
                    max="1"
                    step="0.05"
                    value={threshold}
                    onChange={(e) => setThreshold(+e.target.value)}
                  />
                </label>
                <button
                  className="primary full"
                  disabled={!after || !!busy || collection !== "sentinel-2-l2a"}
                  onClick={analyze}
                >
                  <ScanLine size={16} />
                  Compare & measure
                </button>
                {collection !== "sentinel-2-l2a" && (
                  <p className="micro">
                    Landsat supports aligned visual comparison; Sentinel-1
                    supports discovery. Quantitative analysis currently requires
                    Sentinel-2.
                  </p>
                )}
              </div>
            )}
          </section>
        )}
        {tab === "compare" && result && (
          <section className="comparison glass">
            <div className="section-heading">
              <span>
                <ScanLine size={15} /> EVIDENCE WORKSPACE
              </span>
              <button
                onClick={() => setTab("explore")}
                aria-label="Close comparison"
              >
                <X size={19} />
              </button>
            </div>
            <div className="compare-heading">
              <div>
                <h2>Change, with context.</h2>
                <p>
                  {place.name} · 20 m analysis grid · {pct}% comparable pixels
                </p>
              </div>
              <div className="switch">
                <button
                  className={mode === "vegetation" ? "selected" : ""}
                  onClick={() => setMode("vegetation")}
                >
                  <Leaf size={14} />
                  Vegetation
                </button>
                <button
                  className={mode === "water" ? "selected" : ""}
                  onClick={() => setMode("water")}
                >
                  <Droplets size={14} />
                  Water
                </button>
              </div>
            </div>
            <div className={"images " + (side ? "side" : "swipe")}>
              <div className="imagepane">
                <img
                  src={result.before}
                  alt="Baseline calibrated satellite crop"
                />
                <b>{date(result.dates[0])}</b>
              </div>
              <div
                className="imagepane after"
                style={
                  !side ? { clipPath: `inset(0 0 0 ${split}%)` } : undefined
                }
              >
                <img
                  src={result.after}
                  alt="Comparison calibrated satellite crop"
                />
                <b>{date(result.dates[1])}</b>
              </div>
              {showMask && (
                <img
                  className="mask"
                  src={mode === "water" ? result.waterMask : result.mask}
                  alt="Spectral change overlay"
                />
              )}
              {!side && (
                <div className="divider" style={{ left: split + "%" }}>
                  <span>↔</span>
                </div>
              )}
            </div>
            {!side && (
              <input
                aria-label="Comparison swipe"
                type="range"
                value={split}
                onChange={(e) => setSplit(+e.target.value)}
              />
            )}
            <div className="compare-tools">
              <button onClick={() => setSide(!side)}>
                <Layers size={15} />
                {side ? "Swipe view" : "Side by side"}
              </button>
              <button onClick={() => setShowMask(!showMask)}>
                <ScanLine size={15} />
                {showMask ? "Hide change overlay" : "Show change overlay"}
              </button>
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = result.after;
                  a.download = "terraseek-after.png";
                  a.click();
                }}
              >
                <Download size={15} />
                PNG
              </button>
            </div>
            <div className="metrics">
              <div>
                <span>
                  {mode === "water" ? "Water appeared" : "NDVI decrease"}
                </span>
                <strong>
                  {(
                    (mode === "water"
                      ? result.stats.waterAppeared
                      : result.stats.loss) * 0.04
                  ).toFixed(2)}
                  <small> ha</small>
                </strong>
              </div>
              <div>
                <span>
                  {mode === "water" ? "Water disappeared" : "NDVI increase"}
                </span>
                <strong>
                  {(
                    (mode === "water"
                      ? result.stats.waterDisappeared
                      : result.stats.gain) * 0.04
                  ).toFixed(2)}
                  <small> ha</small>
                </strong>
              </div>
              <div>
                <span>Valid overlap</span>
                <strong>
                  {pct}
                  <small>%</small>
                </strong>
              </div>
            </div>
            <p className="caution">
              Exploratory spectral screening. Seasonality, moisture and
              alignment error can mimic change. No validated land-use or
              construction classification.
            </p>
            <ComparisonAssistant
              key={result.beforeScene + result.afterScene}
              result={result}
            />
            <div className="report-actions">
              <button className="primary" onClick={report}>
                <Download size={15} />
                Evidence report · JSON
              </button>
              <button onClick={save}>
                Save project <ArrowUpRight size={14} />
              </button>
              <button onClick={() => setModal("assistant")}>
                Explain results
              </button>
            </div>
          </section>
        )}
        <div className="bottom-strip glass">
          <div>
            <span className="status-dot" />
            <strong>Real observations. Traceable evidence.</strong>
            <small>Copernicus Sentinel · USGS Landsat · CelesTrak</small>
          </div>
          <div className="steps">
            <button onClick={() => setTab("explore")}>
              <span>01</span>Locate
            </button>
            <i />
            <button
              onClick={() => (scenes.length ? setTab("imagery") : findScenes())}
            >
              <span>02</span>Observe
            </button>
            <i />
            <button disabled={!result} onClick={() => setTab("compare")}>
              <span>03</span>Compare
            </button>
            <i />
            <button disabled={!result} onClick={report}>
              <span>04</span>Export
            </button>
          </div>
        </div>
        {busy && (
          <div className="busy glass">
            <Loader2 className="spin" size={17} />
            {busy}
            {abort.current && (
              <button
                onClick={() => {
                  abort.current?.abort();
                  setBusy("");
                }}
              >
                Cancel
              </button>
            )}
          </div>
        )}
        {error && (
          <div className="toast error">
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Dismiss error">
              <X size={16} />
            </button>
          </div>
        )}
      </main>
      <footer>
        <span>
          © TerraSeek World ·{" "}
          <a
            href="https://github.com/nirbhayalone27/TERRASEEK-WORLD"
            target="_blank"
            rel="noreferrer"
          >
            Open source <ArrowUpRight size={10} />
          </a>
        </span>
        <span>
          Earth texture: Solar System Scope · CC BY 4.0 · modified | Basemap
          illustration, not a dated observation
        </span>
      </footer>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal("")}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Workspace information"
            className="modal glass"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              onClick={() => setModal("")}
              aria-label="Close dialog"
            >
              <X />
            </button>
            {modal === "how" ? (
              <HowItWorks />
            ) : modal === "account" ? (
              <>
                <h2>Your evidence, saved.</h2>
                {!supabase ? (
                  <>
                    <p>
                      Account storage is not configured in this deployment yet.
                      Public exploration and local evidence export remain
                      available.
                    </p>
                    <p>
                      Supabase project connection and tested access policies are
                      required before cloud saves can be enabled.
                    </p>
                  </>
                ) : user ? (
                  <>
                    <p>Signed in as {user.email}</p>
                    <button onClick={() => supabase.auth.signOut()}>
                      Sign out
                    </button>
                  </>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const { error } = await supabase.auth.signInWithOtp({
                        email,
                        options: { emailRedirectTo: location.origin },
                      });
                      setNotice(
                        error
                          ? error.message
                          : "Check your email for the secure sign-in link.",
                      );
                    }}
                  >
                    <input
                      type="email"
                      className="field"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                    />
                    <button className="primary">Email sign-in link</button>
                    <p>{notice}</p>
                  </form>
                )}
              </>
            ) : modal === "aoi" ? (
              <>
                <h2>A bounded study area.</h2>
                <p>
                  Select a center on the globe or map. Analysis uses a 128 × 128
                  pixel crop on a shared 20 m UTM grid: 2.56 × 2.56 km.
                </p>
                <p>
                  This release does not support arbitrary polygons. Both
                  observations must cover the complete crop and share a tile and
                  projection.
                </p>
              </>
            ) : modal === "assistant" ? (
              <>
                <h2>What the evidence says.</h2>
                <p>
                  This is a deterministic explanation of the measured result,
                  not an AI-generated conclusion.
                </p>
                <p>
                  {pct}% of pixels passed the shared quality mask. NDVI
                  decreased by more than {result?.threshold} over{" "}
                  {((result?.stats.loss || 0) * 0.04).toFixed(2)} ha. This can
                  reflect vegetation loss, seasonal change, moisture or residual
                  image error.
                </p>
                <p>
                  Compare similar seasons and inspect the original observations
                  before making a decision.
                </p>
                {result?.sources.map((s: string) => (
                  <p key={s}>
                    <a href={s} target="_blank" rel="noreferrer">
                      Source STAC observation <ArrowUpRight size={13} />
                    </a>
                  </p>
                ))}
              </>
            ) : (
              <>
                <h2>Evidence before conclusions.</h2>
                <p>
                  Satellite positions are SGP4 predictions using CelesTrak
                  elements. They do not indicate that an image was taken.
                  Imagery comes separately from public STAC archives.
                </p>
                <p>
                  Sentinel-2 comparisons use calibrated reflectance on a common
                  20 m UTM grid. SCL classes 4, 5 and 6 are retained in both
                  dates; cloud, shadow, snow, saturated and unknown pixels are
                  excluded.
                </p>
                <p>
                  NDVI change uses your selected threshold. Water extent uses
                  NDWI &gt; 0.2. Neither is a validated land-cover classifier.
                  Haze restoration, sub-pixel registration and accuracy
                  estimates are not implemented.
                </p>
                <p>
                  Original Sentinel data is credited to Copernicus; Landsat to
                  USGS. No defence certification or regulatory compliance is
                  claimed.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
