"""Bounded metadata gateway. Raster computation is not run in hosting functions."""

from datetime import date, datetime, timezone
from collections import defaultdict, deque
import json
import os
import re
import time
from urllib.parse import urlparse
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field, model_validator

app = FastAPI(
    title="TerraSeek World API",
    version="0.2.0",
    docs_url="/api/v1/docs",
    openapi_url="/api/v1/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type", "Range"],
)
PC = "https://planetarycomputer.microsoft.com/api/stac/v1"
ES = "https://earth-search.aws.element84.com/v1"
cache = {}
requests = defaultdict(deque)


@app.middleware("http")
async def protection(request: Request, call_next):
    try:
        content_length = int(request.headers.get("content-length", "0"))
    except ValueError:
        return Response("Invalid Content-Length", 400)
    if content_length < 0 or content_length > 65536:
        return Response("Request too large", 413)
    # Process-local guard; shared edge limits required for multi-instance production.
    key = request.client.host if request.client else "unknown"
    now = time.monotonic()
    if len(requests) > 10000:
        requests.clear()
    q = requests[key]
    while q and q[0] < now - 60:
        q.popleft()
    if len(q) >= 120:
        return Response("Rate limit reached", 429, headers={"Retry-After": "60"})
    q.append(now)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


async def fetch(url, params=None, ttl=300):
    key = url + json.dumps(params, sort_keys=True)
    if key in cache and cache[key][0] > time.monotonic():
        return cache[key][1]
    try:
        async with httpx.AsyncClient(timeout=25, follow_redirects=False) as client:
            r = await client.get(
                url,
                params=params,
                headers={
                    "User-Agent": "TerraSeekWorld/0.2 (github.com/nirbhayalone27/TERRASEEK-WORLD)"
                },
            )
            r.raise_for_status()
            data = r.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            502, "External data provider unavailable; retry later"
        ) from exc
    if len(cache) > 256:
        cache.clear()
    cache[key] = (time.monotonic() + ttl, data)
    return data


class Search(BaseModel):
    lat: float = Field(ge=-80, le=80)
    lon: float = Field(ge=-180, le=180)
    start: date
    end: date
    cloud: float = Field(default=40, ge=0, le=100)
    collection: str = Field(
        default="sentinel-2-l2a",
        pattern="^(sentinel-2-l2a|landsat-c2-l2|sentinel-1-rtc)$",
    )
    radius_km: float = Field(default=1.28, ge=0.1, le=25)
    limit: int = Field(default=40, ge=1, le=100)

    @model_validator(mode="after")
    def dates(self):
        if self.start > self.end:
            raise ValueError("Start must precede end")
        if self.end > date.today():
            raise ValueError("Future acquisitions are unavailable")
        if (self.end - self.start).days > 20000:
            raise ValueError("Maximum interval is approximately 54 years")
        return self


@app.get("/api/v1/health")
async def health():
    return {
        "status": "ok",
        "version": "0.2.0",
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/v1/ready")
async def ready():
    return {
        "status": "exploration",
        "metadata_api": True,
        "analysis": "bounded browser processing; dedicated Python engine available for self hosting",
        "supabase_configured": bool(os.getenv("SUPABASE_URL")),
        "production_ready": False,
    }


@app.get("/api/v1/places")
async def places(q: str):
    if not 2 <= len(q) <= 150:
        raise HTTPException(422, "Enter 2–150 characters")
    match = re.fullmatch(r"\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*", q)
    if match:
        lat, lon = map(float, match.groups())
        if abs(lat) > 80 or abs(lon) > 180:
            raise HTTPException(422, "Coordinates out of range")
        return [{"name": q, "lat": lat, "lon": lon}]
    d = await fetch("https://photon.komoot.io/api/", {"q": q, "limit": 6}, 86400)
    return [
        {
            "name": ", ".join(
                dict.fromkeys(
                    str(f["properties"][k])
                    for k in ["name", "city", "state", "country"]
                    if f["properties"].get(k)
                )
            ),
            "lon": f["geometry"]["coordinates"][0],
            "lat": f["geometry"]["coordinates"][1],
        }
        for f in d.get("features", [])
    ]


@app.post("/api/v1/imagery/search")
async def imagery(s: Search):
    import math

    dy = s.radius_km / 111.32
    dx = dy / math.cos(math.radians(s.lat))
    bbox = [s.lon - dx, s.lat - dy, s.lon + dx, s.lat + dy]
    if bbox[0] < -180 or bbox[2] > 180:
        raise HTTPException(422, "AOI crosses antimeridian; split the area")
    provider = ES if s.collection == "sentinel-2-l2a" else PC
    params = {
        "collections": s.collection,
        "bbox": ",".join(map(str, bbox)),
        "datetime": f"{s.start}T00:00:00Z/{s.end}T23:59:59Z",
        "limit": s.limit,
    }
    if s.collection != "sentinel-1-rtc":
        params["query"] = json.dumps({"eo:cloud_cover": {"lte": s.cloud}})
    d = await fetch(provider + "/search", params)
    items = []
    for f in d.get("features", []):
        p = f["properties"]
        a = f.get("assets", {})
        epsg = p.get("proj:epsg") or next(
            (v.get("proj:epsg") for v in a.values() if v.get("proj:epsg")), 0
        )
        items.append(
            {
                "id": f["id"],
                "date": p.get("datetime"),
                "cloud": p.get("eo:cloud_cover"),
                "sensor": p.get("platform", s.collection),
                "instruments": p.get("instruments", []),
                "resolution": p.get("gsd"),
                "attribution": "USGS Landsat" if s.collection == "landsat-c2-l2" else "Copernicus Sentinel",
                "collection": s.collection,
                "thumbnail": a.get("thumbnail", a.get("rendered_preview", {})).get(
                    "href"
                ),
                "source": next(
                    (l["href"] for l in f.get("links", []) if l["rel"] == "self"),
                    provider + "/collections/" + s.collection + "/items/" + f["id"],
                ),
                "epsg": epsg,
                "tile": p.get(
                    "grid:code",
                    p.get(
                        "s2:mgrs_tile",
                        f["id"].split("_")[1] if "_" in f["id"] else f["id"],
                    ),
                ),
                "assets": {
                    k: v
                    for k, v in a.items()
                    if k in ["red", "green", "blue", "nir", "scl"]
                },
                "offsetApplied": p.get("earthsearch:boa_offset_applied") is True,
                "baseline": p.get("s2:processing_baseline", "unknown"),
                "geometry": f.get("geometry"),
            }
        )
    items.sort(key=lambda x: x["date"], reverse=True)
    return {
        "items": items,
        "provider": provider,
        "bbox": bbox,
        "limited": len(items) == s.limit,
        "retrieved": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/v1/satellites")
async def satellites(group: str = "active"):
    if group not in ["active", "stations", "resource", "science"]:
        raise HTTPException(422, "Unsupported satellite group")
    data = await fetch(
        "https://celestrak.org/NORAD/elements/gp.php",
        {"GROUP": group, "FORMAT": "json"},
        7200,
    )
    return {
        "source": "CelesTrak",
        "retrieved": datetime.now(timezone.utc).isoformat(),
        "items": data,
        "note": "Active catalog only. Pass predictions do not prove image acquisition.",
    }


@app.get("/api/raster")
async def raster(request: Request, url: str):
    try:
        u = urlparse(url)
        port = u.port
    except ValueError:
        raise HTTPException(400, "Malformed raster URL")
    if (
        u.scheme != "https"
        or u.hostname != "sentinel-cogs.s3.us-west-2.amazonaws.com"
        or port
        or u.username
        or u.password
        or not u.path.startswith("/sentinel-s2-l2a-cogs/")
        or not u.path.endswith(".tif")
        or u.query
    ):
        raise HTTPException(400, "Unsupported raster URL")
    value = request.headers.get("range", "")
    m = re.fullmatch(r"bytes=(\d+)-(\d+)", value)
    if not m or not 0 <= int(m[2]) - int(m[1]) < 4194304:
        raise HTTPException(416, "Bounded range under 4 MiB required")
    async with httpx.AsyncClient(timeout=30, follow_redirects=False) as c:
        try:
            async with c.stream(
                "GET", url, headers={"Range": value, "Accept-Encoding": "identity"}
            ) as r:
                if r.status_code != 206:
                    raise HTTPException(502, "Provider did not honor byte range")
                data = bytearray()
                async for part in r.aiter_bytes():
                    data.extend(part)
                    if len(data) > 4194304:
                        raise HTTPException(502, "Provider response too large")
                return Response(
                    bytes(data),
                    206,
                    headers={
                        "Content-Type": "image/tiff",
                        "Content-Range": r.headers.get("content-range", ""),
                        "Accept-Ranges": "bytes",
                        "Cache-Control": "public,max-age=86400",
                    },
                )
        except httpx.HTTPError as exc:
            raise HTTPException(502, "Raster provider unavailable") from exc


from services.api.app.assistant import EvidenceQuestion, answer


@app.post('/api/v1/assistant')
async def evidence_assistant(question: EvidenceQuestion):
    return answer(question)
