"""Bounded evidence Q&A. No external model calls or ungrounded completions."""
import re
from pydantic import BaseModel, Field, model_validator


class Measurements(BaseModel):
    total: int = Field(ge=1, le=16384)
    valid: int = Field(ge=0, le=16384)
    loss: int = Field(ge=0, le=16384)
    gain: int = Field(ge=0, le=16384)
    waterAppeared: int = Field(ge=0, le=16384)
    waterDisappeared: int = Field(ge=0, le=16384)

    @model_validator(mode='after')
    def counts(self):
        if self.valid > self.total or self.loss + self.gain > self.valid or self.waterAppeared + self.waterDisappeared > self.valid:
            raise ValueError('Inconsistent pixel counts')
        return self


class EvidenceQuestion(BaseModel):
    question: str = Field(min_length=2, max_length=1000)
    location: str = Field(min_length=1, max_length=300)
    dates: list[str] = Field(min_length=2, max_length=2)
    sensors: list[str] = Field(min_length=2, max_length=2)
    scenes: list[str] = Field(min_length=2, max_length=2)
    sources: list[str] = Field(min_length=2, max_length=2)
    stats: Measurements
    threshold: float = Field(ge=0.05, le=1)
    resolution: int = Field(default=20, ge=20, le=20)

    @model_validator(mode='after')
    def evidence(self):
        from datetime import datetime
        from urllib.parse import urlparse
        a, b = [datetime.fromisoformat(d.replace('Z', '+00:00')) for d in self.dates]
        if a >= b:
            raise ValueError('Acquisition order invalid')
        for url in self.sources:
            if len(url) > 1000 or urlparse(url).scheme != 'https' or urlparse(url).hostname not in ('earth-search.aws.element84.com', 'planetarycomputer.microsoft.com'):
                raise ValueError('Unsupported evidence source')
        if any(len(v) > 300 for v in self.sensors + self.scenes):
            raise ValueError('Metadata too long')
        return self


def answer(q: EvidenceQuestion):
    text = q.question.lower()
    stats = q.stats
    area = lambda pixels: f'{pixels * q.resolution ** 2 / 10000:.2f} ha'
    scope = f'{q.location}: {q.dates[0]} versus {q.dates[1]}.'
    limitations = 'These are browser-computed spectral measurements, not independently verified land-use findings. Seasonality, moisture, cloud-mask errors and registration can mimic change.'
    if re.search(r'construction|mining|urban|building|land.use|cause|why', text):
        response = 'The available NDVI/NDWI screening cannot establish construction, mining expansion, land-use classes or the cause of a difference. Inspect acquisitions, match seasons and use a validated classifier or independent evidence.'
    elif re.search(r'satellite|sensor|capture|source|date', text):
        response = f'Baseline: {q.sensors[0]}, {q.dates[0]}, scene {q.scenes[0]}. Comparison: {q.sensors[1]}, {q.dates[1]}, scene {q.scenes[1]}. These are archive acquisitions, not inferred orbital passes.'
    elif re.search(r'cloud|mask|coverage|valid', text):
        response = f'{stats.valid} of {stats.total} pixels ({100 * stats.valid / stats.total:.1f}%) passed the joint SCL 4/5/6 mask: {area(stats.valid)} of comparable area. Excluded pixels are not counted as unchanged. SCL does not guarantee cloud-free or haze-free imagery.'
    elif re.search(r'water|flood', text):
        response = f'The water threshold changed to water over {area(stats.waterAppeared)} and away from water over {area(stats.waterDisappeared)}. This is a spectral proxy, not a confirmed flood or permanent water-body change.'
    elif re.search(r'vegetation|ndvi|disappear|summary|summar|change|result', text):
        response = f'NDVI decreased by more than {q.threshold:g} over {area(stats.loss)} and increased over {area(stats.gain)} within {area(stats.valid)} of valid overlap. Water appeared over {area(stats.waterAppeared)} and disappeared over {area(stats.waterDisappeared)}. NDVI decrease alone does not establish vegetation removal.'
    else:
        response = 'That answer cannot be determined by this bounded evidence interpreter. Ask about NDVI, water, valid coverage, acquisition dates or sensors. No general language model is configured.'
    return {'answer': scope + ' ' + response, 'limitations': limitations, 'sources': q.sources, 'mode': 'deterministic_evidence', 'provenance': 'client_computed_not_server_verified'}
