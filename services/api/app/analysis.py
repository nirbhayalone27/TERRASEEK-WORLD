"""Offline/dedicated-host raster engine. Never imported by the serverless gateway."""

import numpy as np
from rasterio.enums import Resampling
from rasterio.warp import reproject
from rasterio.transform import from_origin
import rasterio
from pyproj import Transformer

VALID_SCL = [4, 5, 6]


def analyze(before, after, pixel_size=20, threshold=0.2):
    if not 0 < threshold <= 2:
        raise ValueError("Threshold must be in (0,2]")
    if pixel_size <= 0:
        raise ValueError("Pixel size must be positive")
    shape = before["red"].shape
    if any(x.shape != shape for bands in (before, after) for x in bands.values()):
        raise ValueError("Band shapes differ")
    valid = np.isin(before["scl"], VALID_SCL) & np.isin(after["scl"], VALID_SCL)
    for bands in (before, after):
        for k in ["red", "nir", "green"]:
            valid &= np.isfinite(bands[k]) & (bands[k] >= 0) & (bands[k] <= 1.5)
        valid &= (bands["nir"] + bands["red"] > 0.01) & (
            bands["green"] + bands["nir"] > 0.01
        )

    def idx(b, a, c):
        return np.divide(
            b[a] - b[c],
            b[a] + b[c],
            out=np.zeros(shape, dtype=float),
            where=(b[a] + b[c]) > 0.01,
        )

    ndvi_a, ndvi_b = idx(before, "nir", "red"), idx(after, "nir", "red")
    water_a, water_b = (
        idx(before, "green", "nir") > 0.2,
        idx(after, "green", "nir") > 0.2,
    )
    masks = {
        "vegetation_loss": valid & (ndvi_b - ndvi_a < -threshold),
        "vegetation_gain": valid & (ndvi_b - ndvi_a > threshold),
        "water_appeared": valid & ~water_a & water_b,
        "water_disappeared": valid & water_a & ~water_b,
    }
    count = int(valid.sum())
    if not count:
        raise ValueError("No comparable valid pixels")
    return {
        "valid_pixels": count,
        "total_pixels": int(valid.size),
        "valid_percent": 100 * count / valid.size,
        "resolution_m": pixel_size,
        "threshold": threshold,
        "area_ha": {
            k: float(m.sum()) * pixel_size**2 / 10000 for k, m in masks.items()
        },
        "method": "Calibrated reflectance; common UTM grid; SCL 4/5/6 intersection; NDVI difference and NDWI>0.2; exploratory, no accuracy claim",
    }


def read_pair(a, b, lat, lon, n=128):
    if a["id"] == b["id"] or a["date"] >= b["date"]:
        raise ValueError("Require chronological distinct scenes")
    if a["epsg"] != b["epsg"] or a["tile"] != b["tile"]:
        raise ValueError("Require same UTM tile")
    epsg = a["epsg"]
    if not (32601 <= epsg <= 32660 or 32701 <= epsg <= 32760):
        raise ValueError("UTM required")
    if not 8 <= n <= 512:
        raise ValueError("Grid must be 8–512 pixels")
    x, y = Transformer.from_crs(4326, epsg, always_xy=True).transform(lon, lat)
    left = np.floor(x / 20) * 20 - n * 10
    top = np.floor(y / 20) * 20 + n * 10
    transform = from_origin(left, top, 20, 20)

    def read(s):
        out = {}
        for band in ["red", "green", "nir", "scl"]:
            asset = s["assets"][band]
            # Only provider metadata URLs, never arbitrary user-controlled raster paths.
            url = asset["href"]
            if not url.startswith(
                "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/"
            ) or not url.endswith(".tif"):
                raise ValueError("Unsupported source")
            with rasterio.open(url) as src:
                if src.crs.to_epsg() != epsg:
                    raise ValueError("Raster CRS contradicts metadata")
                if (
                    left < src.bounds.left
                    or top > src.bounds.top
                    or left + n * 20 > src.bounds.right
                    or top - n * 20 < src.bounds.bottom
                ):
                    raise ValueError("Crop exceeds tile")
                dest = np.full((n, n), np.nan, dtype=np.float32)
                reproject(
                    rasterio.band(src, 1),
                    dest,
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=transform,
                    dst_crs=f"EPSG:{epsg}",
                    resampling=Resampling.nearest,
                    src_nodata=0,
                    dst_nodata=np.nan,
                )
            if band != "scl":
                meta = asset["raster:bands"][0]
                dest = dest * meta["scale"] + (
                    0 if s["offsetApplied"] else meta["offset"]
                )
            out[band] = dest
        return out

    return read(a), read(b)
