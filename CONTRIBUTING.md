# Contributing

Run `npm ci`, `npm test`, `npm run build`, and `python -m pytest services/api/tests -q`. Python tests require pytest, rasterio, numpy and pyproj plus requirements.txt. Keep provider integrations separate from derived measurements. Add regression cases for changed numerical behavior. Never add demo measurements to live responses. Preserve data licenses and evidence IDs. Use a feature branch and a pull request; explain the observed problem and test results.

Owner: Nirbhay Alone (`nirbhayalone27`). Implementation was AI-assisted with Codex; this does not imply an additional human contributor or independent scientific review.
