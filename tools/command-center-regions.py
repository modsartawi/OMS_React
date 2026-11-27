# Builds src/features/analytics/command-center/regions/ksa-bh-regions.json (oms 947, BackOffice spec 4165): the five
# sales regions and Bahrain the command center map shades. Manual-run tool, not a gate; needs `pip install shapely`.
#
#   python tools/command-center-regions.py <geo dir> src/features/analytics/command-center/regions/ksa-bh-regions.json
#
# <geo dir> holds geoBoundaries' `sau_adm1.json` (Saudi Arabia's 13 provinces) and `bhr_adm0.json` (Bahrain), as
# `E:\Projects\SmartRetail\tools\geo` does (geoBoundaries, wmgeolab commit 9469f09, CC BY 4.0: the map credits it).
#
# ⚠ OPEN (ticket 947 Comments): the province -> sales region table below is provisional. The sales regions are the
# store dimension's `ksa_region`, not administrative regions; each province went to the region holding most of its
# stores in the 3515 mock (BackOffice .scratch/proto/3515-morning-brief-home/build.py). The owner rules it, and the
# borders must match the kingdom's official map.
import io
import json
import sys

from shapely.geometry import shape
from shapely.ops import unary_union

GEO, OUT = sys.argv[1], sys.argv[2]

REGION = {
    'SA-01': 'Center', 'SA-05': 'Center', 'SA-06': 'Center',  # Riyadh, Al-Qassim, Hail
    'SA-04': 'East',  # Eastern
    'SA-07': 'North', 'SA-08': 'North', 'SA-12': 'North',  # Tabuk, Northern Borders, Al Jawf
    'SA-09': 'South', 'SA-10': 'South', 'SA-11': 'South', 'SA-14': 'South',  # Jazan, Najran, Al Bahah, Asir
    'SA-02': 'West', 'SA-03': 'West',  # Makkah, Al Madinah
}

# Kingdom regions: ~3 km tolerance, 2 decimals (~1 km), islands under 0.02 square degrees left out. Bahrain is small:
# finer on every count.
KSA = {'tolerance': 0.03, 'digits': 2, 'min_area': 0.02}
BH = {'tolerance': 0.005, 'digits': 3, 'min_area': 0.001}

groups = {}
for f in json.load(io.open(GEO + '/sau_adm1.json', encoding='utf-8'))['features']:
    iso = f['properties']['shapeISO']
    groups.setdefault(REGION[iso], []).append((iso, shape(f['geometry']).buffer(0)))
bh = json.load(io.open(GEO + '/bhr_adm0.json', encoding='utf-8'))['features'][0]
groups['BH'] = [('BH', shape(bh['geometry']).buffer(0))]

regions = []
for key in ['Center', 'East', 'North', 'South', 'West', 'BH']:
    rule = BH if key == 'BH' else KSA
    # Dissolve the provinces (closing the slivers between them), then simplify.
    merged = unary_union([g for _, g in groups[key]]).buffer(0.01).buffer(-0.01)
    simple = merged.simplify(rule['tolerance'], preserve_topology=True)
    polys = list(simple.geoms) if simple.geom_type == 'MultiPolygon' else [simple]
    rings = [
        [[round(x, rule['digits']), round(y, rule['digits'])] for x, y in p.exterior.coords]
        for p in polys
        if p.area >= rule['min_area']
    ]
    regions.append({'region': key, 'provinces': sorted(i for i, _ in groups[key]), 'rings': rings})

doc = {
    'about': 'The five sales regions and Bahrain for the command center map (oms 947, BackOffice spec 4165), built by '
    'tools/command-center-regions.py. Provinces are assigned to sales regions provisionally (open question), dissolved '
    'per region and simplified. Coordinates are [lon, lat].',
    'source': 'geoBoundaries (wmgeolab, commit 9469f09): Saudi Arabia ADM1 and Bahrain ADM0. Runfola et al. (2020), PLoS ONE 15(4).',
    'licence': 'CC BY 4.0',
    'regions': regions,
}
io.open(OUT, 'w', encoding='utf-8', newline='\n').write(json.dumps(doc, separators=(',', ':'), ensure_ascii=False) + '\n')
print({r['region']: (len(r['rings']), sum(len(x) for x in r['rings'])) for r in regions})
