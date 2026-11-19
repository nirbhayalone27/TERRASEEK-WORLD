import numpy as np
import pytest
from services.api.app.analysis import analyze

def bands(red=.2,nir=.6,green=.2,scl=4):
    return {k:np.full((2,2),v,dtype=float) for k,v in dict(red=red,nir=nir,green=green,scl=scl).items()}

def test_measured_area_and_cloud_intersection():
    a,b=bands(),bands(nir=.2)
    b['scl'][0,0]=9
    r=analyze(a,b)
    assert r['valid_pixels']==3
    assert r['valid_percent']==75
    assert r['area_ha']['vegetation_loss']==pytest.approx(.12)

def test_water_transition():
    r=analyze(bands(),bands(nir=.05,green=.3))
    assert r['area_ha']['water_appeared']==pytest.approx(.16)

def test_all_cloud_is_not_zero_change():
    with pytest.raises(ValueError,match='No comparable'): analyze(bands(scl=9),bands())

def test_invalid_reflectance_excluded():
    a=bands(); a['nir'][0,0]=np.nan
    assert analyze(a,bands())['valid_pixels']==3

def test_misaligned_dimensions_rejected():
    a=bands();a['red']=np.zeros((1,2))
    with pytest.raises(ValueError,match='shapes'):analyze(a,bands())

def test_real_sentinel_fixture_regression():
    from pathlib import Path
    fixture=np.load(Path(__file__).parent/'fixtures'/'pune_sentinel2.npz')
    a={k:fixture['before_'+k] for k in ['red','green','nir','scl']}
    b={k:fixture['after_'+k] for k in ['red','green','nir','scl']}
    r=analyze(a,b)
    assert r['valid_pixels']==256
    assert r['area_ha']['vegetation_loss']==pytest.approx(1.4)
    # This checks deterministic processing, not ground-truth accuracy.
