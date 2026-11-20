# Upgrade checkpoint — 20 November 2026

Base: 14d7244f2a97418dfc3d1cd01ba8f1d2b54b3b96. Existing React/FastAPI/Supabase architecture and spectral processing retained.

## Implemented

- Session-once 1.4-second intro; reduced-motion bypass; underlying app loads concurrently.
- Slight upward globe adjustment, slow idle viewpoint rotation preserving Earth-fixed data alignment, interaction pause.
- Clickable GPU point cloud, selected marker, orbital metadata, name-based category filter, Earth-fixed trajectory and ground track, follow/exit, near-current playback controls.
- Reusable geometry; one-second worker updates interpolated in the render loop. Background tabs skip position requests. No frame-rate claim.
- Independent baseline and comparison search ranges; archive API accepts 12+ year intervals. Landsat visual pair uses identical 30 m UTM grid, 256 pixels across, with explicit no-quantitative-analysis labeling. Sentinel-2 measured workflow retained.
- Backend evidence Q&A validates counts, dates and source hosts and returns only bounded interpretations. This is **not a generative AI model**. Client-computed values are not server-attested. Unsupported construction/mining/cause questions are refused.
- Original How It Works section with accessible modal, source attribution and limitations.

## Verification at checkpoint

- Production TypeScript/Vite build passed.
- 9 Vitest tests passed, including captured CelesTrak ISS OMM propagation sanity checks.
- 17 Python tests passed, including real Sentinel fixture regression and evidence refusal/validation tests.
- Ruff correctness scan passed; secret heuristic scan passed.
- Live CelesTrak station catalog returned 17 objects; actual ISS OMM captured as test fixture.
- Live Planetary Computer Pune searches returned 9 acquisitions in Jan–Mar 2014 and 11 in Jan–Mar 2025.
- Browser suite attempted: Playwright browser download blocked (403); system Chromium launch blocked by runtime socket restrictions before any page test ran. These are **not passing browser tests**. Use available remote browser after deployment.

## Service audit and remaining work

Vercel existing project: `terraseek-world`, ID `prj_d8M6ktASISOpEOv6EbggknlvKCtX`. Supabase connector lists **zero projects**; no database mutations made. Auth, storage policies and cross-user isolation cannot be verified without project access.

Still incomplete: observation-linked historical orbit reconstruction, verified instrument footprints, NASA GIBS layer, arbitrary AOI polygon processing, synchronized pan/zoom, validated construction/mining/land-use classifiers, general AI provider integration, durable authenticated analysis workers, saved-project retrieval UI and cross-user integration tests. Catalog remains active objects only, not a complete debris catalog. Name-based categories are disclosed hints. Pass boundaries are sampled at 30 seconds, not independently precision-validated. No hardware performance benchmarks completed.

Do not represent this checkpoint as the complete production-ready mission. Continue from this repository; do not restart. Next: remote-browser verification and fixes, then polygon/worker pipeline and secure project-backed AI integration once Supabase access exists.

## Production verification follow-up

First upgrade commit `1bc2abda4e47b56f80c47ab7a9114628a6233b5e` deployed successfully through direct source upload after Vercel's Git ingestion returned a rate-limit error. Public alias: https://terraseek-world.vercel.app . Remote browser verified real Sentinel-2 discovery and Jan 3/13 2025 Pune comparison: 99% displayed overlap, 109.32 ha thresholded NDVI decrease (spectral screening, **not verified vegetation clearing**). Backend Q&A returned the matching measured area and acquisition source links. Testing also exposed a question-routing ambiguity for 'between these dates', now covered by regression testing.

Full active orbital feed failed in production, but station/resource feeds returned successfully. Added bounded concurrent fallback with a prominent partial-catalog disclosure and deduplication; no simulated data. Desktop historical controls previously exceeded the clipped main viewport; the study panel now scrolls, and redundant single-period controls are hidden in historical mode. Remote browser lacks working WebGL, so 3D visual interactions remain unverified despite compiled implementation and propagation tests.
