"""Synthetic rasters are used exclusively in these offline unit tests."""
import json

import numpy as np
import pytest
import rasterio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from rasterio.transform import from_origin
from rasterio.windows import Window

from app.nasa_data.loader import load_elevation_data
from app.nasa_data.processor import process_elevation_data
from app.nasa_data.processor import process_orthoimage, create_alignment_preview
from app.nasa_data.repository import RegionRepository, create_router

MARS = rasterio.crs.CRS.from_string(
    '+proj=eqc +lat_ts=15 +lon_0=77.41 +R=3394839.8133163 +units=m +no_defs'
).to_wkt().replace('unknown', 'Mars_synthetic')


@pytest.fixture
def synthetic(tmp_path):
    path = tmp_path / 'synthetic.tif'
    values = np.arange(25, dtype='float32').reshape(5, 5)
    values[1, 1] = -9999
    values[2, 2] = np.nan
    with rasterio.open(path, 'w', driver='GTiff', height=5, width=5, count=1,
                       dtype='float32', crs=MARS, transform=from_origin(100, 200, 2, 3),
                       nodata=-9999) as dst:
        dst.write(values, 1)
        dst.set_band_unit(1, 'm')
    (tmp_path / 'sources.json').write_text(json.dumps({'sources':{'synthetic':{
        'vertical_units':'m', 'kind':'synthetic'}}}))
    return path, tmp_path


def test_load(synthetic):
    path, _ = synthetic
    region = load_elevation_data(path, region_id='synthetic', source_ids=('synthetic',))
    assert region.elevation_m.shape == (5, 5)
    assert region.valid_mask.sum() == 23
    assert np.isnan(region.elevation_m[1, 1])
    assert not region.valid_mask[2, 2]
    assert region.elevation_m[4, 4] == 24
    assert (region.pixel_size_x_m, region.pixel_size_y_m) == (2, 3)
    assert region.metadata['vertical_units'] == 'm'
    assert region.cell_center(0, 0) == (101, 198.5)
    assert region.map_to_cell(103, 195.5) == (1, 1)
    with pytest.raises(ValueError):
        region.map_to_cell(0, 0)


def test_roundtrip_and_api(synthetic):
    path, root = synthetic
    process_elevation_data(path, 'synthetic_crop', 'synthetic', Window(1, 1, 3, 3), root)
    repo = RegionRepository(root)
    region = repo.get_region('synthetic_crop')
    assert region.elevation_m.shape == (3, 3)
    assert region.cell_center(0, 0) == (103, 195.5)
    assert region.metadata['original_shape'] == [5, 5]
    assert region.metadata['resampling'] == 'none'
    assert repo.get_elevation_grid('synthetic_crop')[2, 2] == 18
    assert len(repo.list_regions()) == 1
    app = FastAPI()
    app.include_router(create_router(repo), prefix='/api')
    client = TestClient(app)
    assert client.get('/api/data/regions').status_code == 200
    assert client.get('/api/data/regions/synthetic_crop').json()['shape'] == [3, 3]
    assert client.get('/api/data/regions/synthetic_crop/layers').json()[0]['units'] == 'm'
    assert client.get('/api/data/regions/missing').status_code == 404
    with pytest.raises(FileExistsError):
        process_elevation_data(path, 'synthetic_crop', 'synthetic', Window(1, 1, 3, 3), root)


def test_missing(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_elevation_data(tmp_path / 'missing.tif', region_id='x', source_ids=())


@pytest.mark.parametrize('window', [Window(-1, 0, 2, 2), Window(0, 0, 6, 2),
                                    Window(0.5, 0, 2, 2), Window(0, 0, 0, 2)])
def test_bad_crop(synthetic, window):
    with pytest.raises(ValueError):
        load_elevation_data(synthetic[0], region_id='x', source_ids=(), window=window)


@pytest.mark.parametrize('crs,unit', [(None,'m'), ('EPSG:4326','m'),
                                    ('EPSG:3857','m'), (MARS,'ft'), (MARS,None)])
def test_invalid_units_crs(tmp_path, crs, unit):
    path = tmp_path / 'synthetic_bad.tif'
    with rasterio.open(path,'w', driver='GTiff', height=2, width=2, count=1,
                       dtype='float32', crs=crs, transform=from_origin(100,200,2,3)) as dst:
        dst.write(np.ones((2,2), dtype='float32'),1)
        if unit:
            dst.set_band_unit(1,unit)
    with pytest.raises(ValueError):
        load_elevation_data(path,region_id='x',source_ids=())


def test_metadata_tampering(synthetic):
    path, root = synthetic
    output = process_elevation_data(path,'synthetic','synthetic',Window(0,0,5,5),root)
    sidecar = output.with_suffix('.json')
    metadata = json.loads(sidecar.read_text())
    metadata['shape'] = [99,99]
    sidecar.write_text(json.dumps(metadata))
    with pytest.raises(ValueError, match='disagree'):
        RegionRepository(root).get_region('synthetic')


def test_empty_coverage(synthetic):
    with pytest.raises(ValueError, match='no valid'):
        load_elevation_data(synthetic[0], region_id='synthetic', source_ids=(),
                            window=Window(1,1,1,1))


def test_checksum(synthetic):
    path, root = synthetic
    output = process_elevation_data(path,'synthetic','synthetic',Window(0,0,5,5),root)
    with output.open('ab') as stream:
        stream.write(b'corruption')
    with pytest.raises(ValueError, match='checksum'):
        RegionRepository(root).get_region('synthetic')


@pytest.fixture
def synthetic_ortho(synthetic):
    path, root = synthetic
    process_elevation_data(path, 'synthetic', 'synthetic', Window(0,0,5,5), root)
    sidecar = root / 'processed/synthetic_elevation.json'
    meta = json.loads(sidecar.read_text())
    meta['source'].update(projection_center_latitude_deg=15,
                          projection_center_longitude_deg=77.41, sphere_radius_m=3394839.8133163)
    sidecar.write_text(json.dumps(meta))
    catalog = json.loads((root / 'sources.json').read_text())
    catalog['sources']['synthetic_ortho'] = {'kind':'synthetic'}
    (root / 'sources.json').write_text(json.dumps(catalog))
    # Square grid PDS needs same x/y scale. Fixture elevation is anisotropic;
    # use MAP_SCALE=2 and y pixel size=2 for the registration tests.
    with rasterio.open(root / 'processed/synthetic_elevation.tif','r+') as dst:
        dst.transform = from_origin(100,200,2,2)
    from app.nasa_data.processor import sha256
    meta.update(transform=list(from_origin(100,200,2,2))[:6],
                original_transform=list(from_origin(100,200,2,2))[:6], pixel_size_y_m=2,
                processed_sha256=sha256(root / 'processed/synthetic_elevation.tif'))
    sidecar.write_text(json.dumps(meta))
    ortho = root / 'synthetic_ortho.tif'
    with rasterio.open(ortho,'w',driver='GTiff',height=5,width=5,count=1,
                       dtype='uint8',crs=MARS,transform=from_origin(103,197,2,2)) as dst:
        values = np.full((5,5),100,dtype='uint8')
        values[0,:3] = [0,1,255]
        dst.write(values,1)
    label = root / 'synthetic.lbl'
    label.write_text('''PRODUCT_ID = "synthetic_ortho"
SOURCE_PRODUCT_ID = synthetic
TARGET_NAME = MARS
MAP_PROJECTION_TYPE = EQUIRECTANGULAR
POSITIVE_LONGITUDE_DIRECTION = EAST
COORDINATE_SYSTEM_NAME = PLANETOCENTRIC
CENTER_LATITUDE = 15 <DEG>
CENTER_LONGITUDE = 77.41 <DEG>
A_AXIS_RADIUS = 3394.8398133163 <KM>
B_AXIS_RADIUS = 3394.8398133163 <KM>
C_AXIS_RADIUS = 3394.8398133163 <KM>
MAP_PROJECTION_ROTATION = 0
MAP_SCALE = 2 <METERS/PIXEL>
SAMPLE_PROJECTION_OFFSET = -50.5
LINE_PROJECTION_OFFSET = 99.5
LINES = 5
LINE_SAMPLES = 5
SCALING_FACTOR = 0.01
OFFSET = 0
''')
    return root, ortho, label


def test_ortho_alignment_mask_and_layers(synthetic_ortho):
    root, ortho, label = synthetic_ortho
    output = process_orthoimage(ortho,label,'synthetic','synthetic_ortho',root)
    region = RegionRepository(root).get_region('synthetic')
    with rasterio.open(output) as dst:
        assert dst.transform == region.transform
        assert dst.crs.to_wkt() == region.crs_wkt
        assert dst.shape == region.elevation_m.shape
        assert list(dst.read_masks(1)[0,:3]) == [0,0,0]
        assert dst.read(1)[4,4] == 100
    meta = json.loads(output.with_suffix('.json').read_text())
    assert len(meta['grid_checkpoints']) == 3
    assert meta['original_jp2_georeferencing']['transform'] != meta['transform']
    assert RegionRepository(root).get_available_layers('synthetic')[1]['used_for_routing'] is False
    assert create_alignment_preview('synthetic',root).is_file()
    with pytest.raises(FileExistsError):
        process_orthoimage(ortho,label,'synthetic','synthetic_ortho',root)


@pytest.mark.parametrize('old,new', [('CENTER_LONGITUDE = 77.41','CENTER_LONGITUDE = 0'),
                                    ('SAMPLE_PROJECTION_OFFSET = -50.5','SAMPLE_PROJECTION_OFFSET = -49'),
                                    ('PRODUCT_ID = "synthetic_ortho"','PRODUCT_ID = "other"')])
def test_reject_ortho_mismatch(synthetic_ortho,old,new):
    root, ortho, label = synthetic_ortho
    label.write_text(label.read_text().replace(old,new))
    with pytest.raises(ValueError):
        process_orthoimage(ortho,label,'synthetic','synthetic_ortho',root)
    assert not (root/'processed/synthetic_orthoimage.tif').exists()
