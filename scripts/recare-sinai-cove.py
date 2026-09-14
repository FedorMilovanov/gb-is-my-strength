#!/usr/bin/env python3
"""Re-carve the Sinai cove in karty/_engine/base-geo.svg.

The basemap drew the peninsula silhouette and the Red Sea cut as two separate
hand-made shapes; they disagreed, so the Exodus stations (Мара, Елим, Рефидим,
Синай) and the route between them ended up in water. Here the land silhouette is
DERIVED from the sea cut (reversed segment order, control points swapped), so the
coastline can no longer disagree with itself, and the Gulf of Suez keeps a
readable width west of the peninsula.
"""
import re
import sys

PATH = 'karty/_engine/base-geo.svg'

# --- authored coast geometry (sheet units, shared by both shapes) ------------
CARVE = [  # peninsula outline, north-east corner -> around the cape -> north-west corner
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


def fmt(n):
    return f'{n:g}'


def seg(cur, c1, c2, nxt):
    return f'C{fmt(c1[0])},{fmt(c1[1])} {fmt(c2[0])},{fmt(c2[1])} {fmt(nxt[0])},{fmt(nxt[1])}'


def forward(segs):
    return ' '.join(seg(*s) for s in segs)


def reverse(segs):
    """Reverse a cubic segment list: swap control points, keep the endpoints."""
    out = []
    for cur, c1, c2, nxt in reversed(segs):
        out.append(((nxt), c2, c1, cur))
    return out


def main():
    src = open(PATH, encoding='utf-8').read()

    old_cut = ('C610,1300 606,1320 598,1322 C520,1300 470,1185 458,1100 '
               'C450,1062 440,1030 432,1018 C428,1015 426,1013 424,1012 Z')
    new_cut = forward(CARVE) + ' Z'
    if src.count(old_cut) != 2:
        sys.exit(f'sea cut: expected 2 copies, found {src.count(old_cut)}')
    src = src.replace(old_cut, new_cut)

    land_d = f'M{fmt(CARVE[-1][3][0])},{fmt(CARVE[-1][3][1])} ' + forward(reverse(CARVE)) + ' ' + forward(NORTH_SEGS) + ' Z'
    land_re = re.compile(r'(<path fill="url\(#sinaiG\)" opacity="\.9"\n\s*d=")([^"]+)(")')
    if len(land_re.findall(src)) != 1:
        sys.exit('peninsula silhouette element not found exactly once')
    src = land_re.sub(lambda m: m.group(1) + land_d + m.group(3), src)

    open(PATH, 'w', encoding='utf-8').write(src)
    print('carve written:', new_cut[:70], '...')
    print('land written :', land_d[:70], '...')


if __name__ == '__main__':
    main()
