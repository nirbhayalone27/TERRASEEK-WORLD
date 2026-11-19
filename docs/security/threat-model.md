# Security boundaries and residual risks

- Input: strict coordinates, dates, collection/group allowlists and bounded query sizes.
- SSRF: raster URL must use HTTPS, exact Sentinel COG host, expected path prefix, .tif suffix, no credentials/query/port. Redirects disabled. Range must be explicit and under 4 MiB; response streaming enforces the cap.
- Auth: public exploration is anonymous. Account projects depend on Supabase JWT/RLS. Service credentials are absent from frontend. RLS SQL is prepared but not a verified live tenant boundary until applied and tested with two users.
- Rendering: React escapes provider strings. No untrusted HTML rendering. External links use noreferrer. Sensitive data should not be placed in report exports or public issues.
- Abuse: process-local 120-request/minute guard is basic protection, not a distributed quota. Multi-instance limits, trusted proxy IP semantics, persistent usage accounting and provider-wide circuit breakers are outstanding.
- Supply chain: lockfile and npm audit; Python ranges are not fully pinned yet. Heuristic secret checker is limited and does not substitute for a dedicated scanner or independent audit.
- Browser: texture and imagery providers see normal public data requests. Globe/analysis are resource-bound but mobile benchmarks remain pending. Report downloads remain on the user's device.
- Data integrity: provider scale/offset and SCL can have imperfections. Spatial grid alignment does not equal subpixel co-registration. No accuracy or confidence score is fabricated.

Threats not solved: DDoS, paid usage enforcement, private imagery ingestion, tamper-proof audit records, organization role escalation testing, backup/restore validation, observability/SLOs, defence compliance.
