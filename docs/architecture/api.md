# Public API additions

`POST /api/v1/imagery/search`: existing request contract, now accepts intervals up to 20,000 days. Provider result page is bounded; independent narrow date windows are recommended. Future dates and reversed intervals remain rejected. Returns actual acquisition timestamps; no nearest-date substitution.

`POST /api/v1/assistant`: question, location, two ordered acquisition dates, sensors, scene IDs, allowlisted source URLs, 20 m resolution, threshold and bounded pixel counts. Returns answer, limitations, sources, mode `deterministic_evidence` and provenance `client_computed_not_server_verified`. No provider/model costs or stored prompts. Does not attest client-supplied measurements. Unknown questions produce an explicit limitation. API is process-rate-limited by the existing gateway; distributed production limiting remains required.

Orbit calculations remain in the browser worker. UI replay is bounded around the current time; historical STAC acquisition dates never drive present-day OMM propagation.
