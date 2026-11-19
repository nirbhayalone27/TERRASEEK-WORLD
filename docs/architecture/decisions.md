# Architecture decisions

## ADR 001 — Bounded public analysis, independent metadata gateway

React/TypeScript/Vite is a static frontend. FastAPI serves versioned metadata discovery and a tightly allowlisted COG byte-range proxy. Vercel hosts both. Heavy raster computation is not executed in Vercel functions. A bounded 128×128, 20 m analysis runs in the browser; a separate Rasterio implementation supports offline/dedicated-host reproducibility. This is intentionally smaller than a scalable job platform. No durable background queue is advertised.

The public user flow is place → scene search → two same-tile acquisitions → calibrated COG windows → joint SCL mask → NDVI/NDWI metrics → evidence JSON. Missing data fails visibly. No fake fallback scenes or metrics.

## ADR 002 — Supabase only for account storage

Use Supabase Auth and Postgres RLS for account projects. No Appwrite integration. RLS gates ownership at the database rather than trusting browser IDs. Organization tables are reserved; team sharing is not enabled. Results/audit/usage writes are denied to clients pending a trusted worker design. Private report bucket has owner-only read policy and no client upload policy. Frontend contains only public Supabase configuration; service-role credentials are never needed in the browser.

## ADR 003 — Real non-WebGL fallback

Cloud browser testing found WebGL disabled. MapLibre also needs WebGL, so it is unsuitable as the fallback. Leaflet supplies a raster-tile 2D map and a study-area rectangle without WebGL. A MapLibre dependency advisory also motivated removing the unused package. Three.js remains the primary globe implementation. No claim of successful globe rendering in that test environment.

## ADR 004 — Explicitly limited intelligence

Natural language is a deterministic pattern parser, not semantic image retrieval. Result explanations are deterministic and cite scene records. Sector selection is report context only, not a separate validated industry classifier. Arbitrary AOI polygons, image embeddings, billing, scheduled monitoring and enterprise compliance remain unimplemented.
