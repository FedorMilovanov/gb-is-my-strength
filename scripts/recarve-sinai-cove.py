#!/usr/bin/env python3
"""Re-carve the Sinai cove in karty/_engine/base-geo.svg.

Why this exists
---------------
The basemap used to draw the Sinai peninsula silhouette and the Red Sea cut as
two independent hand-made shapes; they disagreed, so the Exodus stations (Мара,
Елим, Рефидим, Синай) and the route между ними stood in water, and an earlier
repair left a hairpin in the sea outline (down the gulf and back), which also
stroked a stray line across the water.

What it does
------------
The Red Sea outline and the peninsula silhouette are generated from ONE authored
coast (CARVE): the land path is the same cubic segments read in reverse with the
control points swapped, so the coastline cannot disagree with itself. The gulf
between the west bank (Egypt) and the peninsula keeps a readable width, and the
Gulf of Aqaba stays east of the peninsula.

The same authored coast is written into every consumer file, so the sheets and
the live maps cannot drift apart again.

Usage
-----
    python3 scripts/recarve-sinai-cove.py           # rewrite the geometry
    python3 scripts/recarve-sinai-cove.py --check   # verify every file is up to date
"""
import re
import sys

# Both copies of the shared geography must carry the same carve:
#   karty/_engine/base-geo.svg — base of the Atlas sheets (levant family)
#   karty/avraam/base.svg      — base of the live maps (avraam, and ishod through
#                                karty/ishod/base.svg, which inlines it)
FILES = ['karty/_engine/base-geo.svg', 'karty/avraam/base.svg']

# --- authored Red Sea outline (sheet units) ---------------------------------
# (current point, control 1, control 2, next point)
WEST_SOUTH = [  # Egypt bank of the Gulf of Suez, southward from the Med corner
    ((424, 1012), (418, 1024), (420, 1044), (428, 1070)),
    ((428, 1070), (440, 1112), (462, 1170), (490, 1230)),
    ((490, 1230), (504, 1258), (516, 1278), (526, 1292)),
    ((526, 1292), (548, 1340), (584, 1392), (622, 1430)),
    ((622, 1430), (660, 1490), (692, 1560), (714, 1640)),
    ((714, 1640), (730, 1702), (740, 1768), (744, 1830)),
]
BOTTOM = (1110, 1830)  # sheet-bottom edge of the sea wedge
EAST_NORTH = [  # Arabia bank, northward to the north-east corner of the cove
    ((1110, 1830), (1064, 1740), (1018, 1640), (974, 1546)),
    ((974, 1546), (946, 1486), (920, 1456), (900, 1430)),
    ((900, 1430), (860, 1402), (818, 1368), (762, 1318)),
    ((762, 1318), (740, 1298), (722, 1278), (708, 1258)),
    ((708, 1258), (692, 1190), (678, 1110), (670, 1044)),
    ((670, 1044), (668, 1030), (660, 1022), (652, 1028)),
]
CARVE = [  # peninsula outline: NE corner -> Gulf of Aqaba shore -> cape -> Suez shore
    ((652, 1028), (650, 1045), (646, 1072), (640, 1120)),
    ((640, 1120), (628, 1185), (620, 1240), (612, 1275)),
    ((612, 1275), (602, 1305), (596, 1316), (590, 1322)),
    ((590, 1322), (578, 1334), (562, 1336), (548, 1328)),
    ((548, 1328), (536, 1310), (528, 1280), (520, 1245)),
    ((520, 1245), (508, 1195), (490, 1140), (472, 1090)),
    ((472, 1090), (458, 1058), (442, 1030), (424, 1012)),
]
# northern closure of the peninsula (Gaza–Rafah–Arish side of the sheet)
NORTH_SEGS = [
    ((652, 1028), (640, 1004), (540, 996), (448, 1000)),
    ((448, 1000), (438, 1002), (430, 1006), (424, 1012)),
]
SEA_MARKER = 'M424,1012'  # start of the Red Sea outline (seaG + seaPattern copies)


def fmt(n):
    return f'{n:g}'


def seg(cur, c1, c2, nxt):
    return f'C{fmt(c1[0])},{fmt(c1[1])} {fmt(c2[0])},{fmt(c2[1])} {fmt(nxt[0])},{fmt(nxt[1])}'


def forward(segs):
    return ' '.join(seg(*s) for s in segs)


def reverse(segs):
    """Reverse a cubic chain: swap control points, keep the endpoints."""
    return [((nxt), c2, c1, cur) for cur, c1, c2, nxt in reversed(segs)]


def sea_d():
    """The complete Red Sea outline — one path, no leftovers."""
    return (f'M{fmt(WEST_SOUTH[0][0][0])},{fmt(WEST_SOUTH[0][0][1])} {forward(WEST_SOUTH)} '
            f'L{fmt(BOTTOM[0])},{fmt(BOTTOM[1])} {forward(EAST_NORTH)} {forward(CARVE)} Z')


def land_d():
    """The peninsula silhouette, derived from the same carve (shared coastline)."""
    return (f'M{fmt(CARVE[-1][3][0])},{fmt(CARVE[-1][3][1])} {forward(reverse(CARVE))} '
            f'{forward(NORTH_SEGS)} Z')


def rewrite(src):
    sea_new, land_new = sea_d(), land_d()

    sea_re = re.compile(r'(<(?:path)\b[^>]*fill="url\(#sea(?:G|Pattern)\)"[^>]*?\bd=")([^"]*)"', re.S)
    sea_hits = [m for m in sea_re.finditer(src) if m.group(2).startswith(SEA_MARKER)]
    if len(sea_hits) != 2:
        sys.exit(f'expected exactly 2 Red Sea copies (fill + waves), found {len(sea_hits)}')
    out = src
    for m in reversed(sea_hits):
        out = out[:m.start(2)] + sea_new + out[m.end(2):]

    land_re = re.compile(r'(<path fill="url\(#sinaiG\)"[^>]*?\bd=")([^"]*)"', re.S)
    land_hits = land_re.findall(out)
    if len(land_hits) != 1:
        sys.exit(f'expected exactly 1 peninsula silhouette, found {len(land_hits)}')
    out = land_re.sub(lambda m: m.group(1) + land_new + '"', out, count=1)
    return out, sea_new, land_new


def main():
    check = '--check' in sys.argv
    stale = []
    for path in FILES:
        src = open(path, encoding='utf-8').read()
        out, sea_new, land_new = rewrite(src)
        if out == src:
            print(f'{path}: up to date')
            continue
        if check:
            stale.append(path)
            continue
        open(path, 'w', encoding='utf-8').write(out)
        print(f'{path}: sea {sea_new.count("C")} segments, land {land_new.count("C")} '
              f'(same coast, reversed)')
    if stale:
        sys.exit(f'stale Sinai cove geometry: {", ".join(stale)} — run without --check')


if __name__ == '__main__':
    main()
