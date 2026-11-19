# Reference audit — 13 November 2026

## Sources actually inspected

- https://github.com/dev-Armaan/satellites, commit `21331c8f21f4785d43e248cb1dcc4ed9f6ee3b18`: package.json, LICENSE, THIRD_PARTY_NOTICES.md, docs/ARCHITECTURE.md, src/engine/propagate.ts, passes.worker.ts, catalog.ts, src/globe/SatelliteField.tsx, src/imagery/stac.ts and endpoints.ts.
- https://www.watched.earth/ : public page requires JavaScript/WebGL; runtime behavior not independently tested. Source inspected separately as above.
- https://github.com/divyansh21V/TerraSeek, commit `dda3fbbef3530f21ad3a95567502fec1edb23d6d`: repository tree, terraseek/services.py, ingest/sentinel2_provider.py, license header. Its main investigation service imports DEMO_AOIS and DEMO_CANDIDATES; its Sentinel provider explicitly limits itself to discovery. Separate probe scripts exist; they are not proof of a deployed scientific workflow.
- Existing owned Site https://terraseek-earth-intelligence.awarebuddy256.chatgpt.site : source recovered through supported repository access, commit `7eff2a190639c6a35f0217b7e17789d39472da8a`. Reviewed lib/catalog.ts, raster.ts, spectral.ts, image-difference.ts and API routes for health/catalog/places/records/files/raster. Requires ChatGPT sign-in on data routes; uses D1/R2, not Supabase. Geocoding restricts country to India. It has real COG range access and bounded browser spectral analysis; RGB differencing is also present and must not be treated as land-cover classification.
- https://terraseek-demo-01.netlify.app/ : retrieval failed in research environment; no source/runtime claims made.
- Connected GitHub owner confirmed as nirbhayalone27. TERRASEEK-WORLD existed but was empty at start. Existing repositories were listed; unrelated repositories were not modified.

## Comparison

| Area | Original/demo TerraSeek | Friend's TerraSeek | Owned Sites version | World 0.2 implementation |
|---|---|---|---|---|
| Globe/orbits | Not verified | Not audited | No verified orbit pipeline | New R3F globe and SGP4 worker; WebGL visual QA unavailable in cloud browser |
| Imagery | Not verified | Real discovery provider; demo investigation path | Real Sentinel-2 STAC | Sentinel-2 Earth Search plus PC Landsat/Sentinel-1 discovery |
| Change | Not verified | Probe scripts separate from service | 20 m NDVI/NDWI + RGB differences | Bounded calibrated spectral comparison; no RGB change claims |
| Authentication | Not verified | Not tested | ChatGPT identity, D1/R2 | Supabase client/schema prepared; connection verification pending |
| Scope | Hackathon reference | Investigation workbench | India geocoding | Worldwide search within supported latitude bounds |
| License | Not established | Apache-2.0 file present; no reuse | User-owned source | MIT original code; texture CC BY attribution |

## Watched design lessons

The source separates public imagery from predicted passes, uses a worker pool for pass calculations, and GPU points with approximate Kepler/J2 rendering for the broad catalog. Exact selected-object propagation uses satellite.js SGP4. STAC imagery and NOAA/NASA weather products have independent evidence paths. It implements camera sequencing, lazy catalog names, archive budgets and retry logic, and many tests. These are source observations, not verified performance benchmarks.

World uses an independent smaller implementation: full active catalog propagated with SGP4 in one worker at a 5-second cadence, points in one GPU draw, lazy globe/map/analysis modules. Ground-track and pass sampling are experimental; active/inactive/debris classification and the original GPU propagation optimizations are not implemented. The public active feed is not a complete orbital-object census.

## Reuse decision

Reused the user's raster/catalog/spectral modules, modified and tested. Used a properly attributed 2k Earth texture from Watched's asset distribution. Did not copy Watched branding or its application source. No friend-repository source copied. Broad search/semantic models, large-area classifications and private-sector promises require separate implementation and validation.
