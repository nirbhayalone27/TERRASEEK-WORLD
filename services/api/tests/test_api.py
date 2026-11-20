from fastapi.testclient import TestClient
from services.api.app.main import app

c = TestClient(app)


def test_health_and_readiness_are_distinct():
    assert c.get("/api/v1/health").status_code == 200
    assert c.get("/api/v1/ready").json()["production_ready"] is False


def test_coordinate_validation():
    assert c.get("/api/v1/places", params={"q": "91,181"}).status_code == 422
    assert (
        c.get("/api/v1/places", params={"q": "18.52,73.85"}).json()[0]["lat"] == 18.52
    )


def test_search_rejects_dates_and_large_area():
    base = dict(lat=18, lon=73, start="2025-02-01", end="2025-01-01")
    assert c.post("/api/v1/imagery/search", json=base).status_code == 422
    base.update(end="2025-03-01", radius_km=100)
    assert c.post("/api/v1/imagery/search", json=base).status_code == 422


def test_ssrf_and_unbounded_reads_rejected():
    assert (
        c.get(
            "/api/raster", params={"url": "http://169.254.169.254/latest/meta-data"}
        ).status_code
        == 400
    )
    assert (
        c.get(
            "/api/raster",
            params={
                "url": "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/test.tif"
            },
        ).status_code
        == 416
    )


def test_orbit_groups_allowlisted():
    assert c.get("/api/v1/satellites?group=../../etc/passwd").status_code == 422


def test_malformed_proxy_port_is_client_error():
    assert c.get('/api/raster', params={'url':'https://sentinel-cogs.s3.us-west-2.amazonaws.com:invalid/sentinel-s2-l2a-cogs/a.tif'}).status_code == 400


def test_catalog_fallback_is_real_deduplicated_and_disclosed(monkeypatch):
    from services.api.app import main
    from fastapi import HTTPException

    async def fetch(url, params=None, ttl=300, timeout=25):
        if params['GROUP'] == 'active':
            raise HTTPException(502, 'Unavailable')
        return [{'NORAD_CAT_ID': 25544, 'OBJECT_NAME': 'ISS'}]

    monkeypatch.setattr(main, 'fetch', fetch)
    r = c.get('/api/v1/satellites')
    assert r.status_code == 200
    assert r.json()['partial'] is True
    assert len(r.json()['items']) == 1
    assert 'Partial catalog' in r.json()['note']
