# Real-data regression fixture

Contains modified Copernicus Sentinel data 2025, retrieved through Element 84 Earth Search. See provenance.json for the two scene IDs and source links. 16×16 pixels, 20 m common UTM grid, centered at 18.5204,73.8567. Bands were read with Rasterio and calibrated using provider scale/offset metadata, respecting earthsearch:boa_offset_applied. No personal or private data.

This is a numerical regression fixture, not ground-truth validation of vegetation loss. The 1.4 ha value is a thresholded NDVI-decrease area and must not be interpreted as confirmed clearing.
