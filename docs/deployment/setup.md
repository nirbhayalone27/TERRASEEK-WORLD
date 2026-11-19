# Setup and deployment

1. `npm ci` then `npm run dev` (Node 22+). Start API with `python -m uvicorn services.api.app.main:app --port 8000`. Install requirements.txt plus uvicorn. Development Vite proxies /api to localhost:8000.
2. For numerical Python tests/analysis: install pytest, rasterio, numpy, pyproj. `python -m pytest services/api/tests -q`.
3. Vercel project root is the monorepo root. Build `npm run build`, output `apps/web/dist`, API entry `api/index.py`. requirements.txt intentionally excludes heavy raster libraries. Python code imports analysis only in explicit offline tests/tools.
4. Supabase: apply `supabase/migrations/0001_workspace.sql` to a development project; configure auth site URL and allowed redirects to the deployed origin. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel, then rebuild. Never use a service_role key as a frontend variable.
5. Validate signup/signin and project saves with two separate users; verify cross-user reads/writes denied. Test private storage policy separately. Promote schema only after these pass. No fake authentication or localStorage substitute.
6. Optional standalone API container: `docker compose up --build`. It includes Rasterio for offline scripts but does not expose an unauthenticated heavy-processing endpoint. A durable authenticated job runner is future work.
7. Current Vercel account lacks a GitHub login connection. Direct source uploads work, but automatic deploy-on-push requires connecting GitHub within Vercel. No access token should be pasted into source/chat.

Offline limitation: local code and already downloaded fixtures run offline. New scenes, orbital elements, maps and geocoding require network access; complete offline data packaging is not implemented.
