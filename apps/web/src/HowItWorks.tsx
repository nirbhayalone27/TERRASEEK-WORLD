const sections = [
  [
    "Explore Earth",
    "Search a city, landmark or latitude and longitude. The globe flies to your study center. Drag to explore, scroll to zoom, or double-click to choose a location. The globe texture is an illustration, not a current observation.",
  ],
  [
    "Track spacecraft",
    "CelesTrak orbital elements are propagated with satellite.js SGP4 in a background worker. Select a dot or search its name or NORAD ID. The solid line is the predicted Earth-fixed trajectory; the dashed line is its ground track. Follow tracks its direction; dragging exits follow mode. Categories inferred from names are hints, not verified payload records.",
  ],
  [
    "Predict passes and replay",
    "A predicted pass means a spacecraft is above 10° elevation from the selected center. Times use 30-second sampling and depend on element age. Replay is limited to nearby times. It does not show historical acquisitions, instrument tasking, cloud-free visibility or a sensor footprint.",
  ],
  [
    "Find real observations",
    "Choose dates and a sensor, then search the archives. Sentinel-2 comes from Element 84 Earth Search; Landsat and Sentinel-1 discovery comes from Microsoft Planetary Computer. Scene dates are actual acquisition timestamps. A pass is never presented as proof that an image was taken.",
  ],
  [
    "Compare historical dates",
    "Search independent baseline and comparison date ranges. Landsat archives extend before 2014; Sentinel-2 begins later. Availability varies by place, product and cloud cover. Select actual acquisitions and read their dates. Current quantitative processing supports compatible Sentinel-2 scenes only; older Landsat discovery is not a validated cross-sensor comparison.",
  ],
  [
    "Measure change",
    "Sentinel-2 crops are sampled onto a common 20 m UTM grid. The joint scene-classification mask keeps vegetation, bare ground and water, excluding classified cloud, shadow and invalid pixels. NDVI and NDWI thresholds measure spectral change in valid overlap. Masking is imperfect; seasonal differences and registration errors can resemble change. Construction, land-use and mining attribution need additional validated models and human review.",
  ],
  [
    "Ask about evidence",
    "The comparison assistant answers supported questions from the measured result, acquisition metadata and source links. Its bounded evidence interpreter is explicitly labeled; it does not claim to be a general language model. Unmeasured causes and unsupported classifications receive a limitation rather than invented numbers.",
  ],
  [
    "Privacy and saved projects",
    "Public searches are sent to the metadata gateway and relevant providers. Raster analysis currently runs in your browser. Cloud saving requires configured Supabase authentication and owner-scoped access policies. Never put secret keys in frontend code. Downloaded evidence stays under your control.",
  ],
  [
    "Open source and credits",
    "TerraSeek World is MIT-licensed. Watched by Armaan Gupta informed the exploration design. Its branding and explanatory text are not reused. Earth texture: Solar System Scope, CC BY 4.0. Contains modified Copernicus Sentinel data; Landsat courtesy USGS; orbital elements from CelesTrak; maps © OpenStreetMap contributors.",
  ],
];
export default function HowItWorks() {
  return (
    <div className="how-it-works">
      <h2>How It Works</h2>
      <p>Explore the orbit. Inspect the acquisition. Measure the evidence.</p>
      <nav aria-label="How It Works sections">
        {sections.map(([title], i) => (
          <a key={title} href={"#how-" + i}>
            {title}
          </a>
        ))}
      </nav>
      {sections.map(([title, body], i) => (
        <section id={"how-" + i} key={title}>
          <h3>{title}</h3>
          <p>{body}</p>
        </section>
      ))}
      <a
        href="https://github.com/nirbhayalone27/TERRASEEK-WORLD"
        target="_blank"
        rel="noreferrer"
      >
        TerraSeek source and third-party notices ↗
      </a>
    </div>
  );
}
