# Security policy

This is an exploratory release, not an audited enterprise product. Do not upload sensitive or classified material. Report vulnerabilities privately through GitHub's private vulnerability reporting when enabled, or contact the repository owner privately. Do not put secrets or exploitable private data in public issues. Only the current main branch receives fixes; no response-time SLA is promised.

The public API accepts bounded metadata queries and allowlisted raster byte ranges. Browser keys must be Supabase publishable/anon keys only. Database access is enforced by RLS after the supplied migration has been applied and tested. The current deployment has no enabled account database.
