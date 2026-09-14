#!/usr/bin/env python3
"""Keep the Abraham threads out of Kinneret (Sea of Galilee).

Why this exists
---------------
The live map draws its journeys from the authored Bezier strings in
``karty/avraam/route.json`` (``stages[].paths[].d``). Two of those threads ran
straight through the lake glyph:

* stage IV ("Война царей") left the Jordan valley and cut across the middle of
  Kinneret — 12.2 units deep into the water (the lake is 30 units wide);
* stage I ("Лех-леха", Дамаск → Сихем) grazed the same water with a 2.5 unit cut.

The Atlas sheets never had the defect: their single thread is built from
``routeStops`` + ``route_via`` supports, and the supports bend the line around
water on purpose (see ``route_via`` in route.json and ``scripts/lib/sheet-engine.js``).
This script gives the live paths the same kind of support: a short detour along
the western shore of the lake — the road that actually runs there — written as
one deterministic Catmull-Rom chain with C1 continuity at both joins, so the
rest of the authored curve is untouched.

Usage
-----
    python3 scripts/route-detour-kinneret.py           # rewrite the two threads
    python3 scripts/route-detour-kinneret.py --check   # fail if the file is stale
"""
import math
import re
import sys

ROUTE = 'karty/avraam/route.json'

# Kinneret contour as authored in karty/avraam/base.svg (lake + shore stroke).
KINNERET = ('M651,660 C655,655 662,653 667,657 C672,661 675,670 674,682 '
            'C673,692 670,700 664,704 C658,707 651,703 648,695 C645,687 645,672 651,660 Z')

# Detour supports: the Jordan valley corridor (x ≈ 640) runs west of the lake's
# west shore (x ≈ 645.5). Nodes are authored geography, not derived numbers.
DETOURS = [
    {
        'id': 'stage IV · Война царей · valley → Дан',
        'anchor': 'M610,829 C648,760 658,692 665,625',
        'nodes': [(610, 829), (644, 752), (640, 690), (641, 662), (649, 645), (665, 625)],
    },
    {
        'id': 'stage I · Лех-леха · Дан → Сихем',
        'anchor': 'C652,662 638,705 628,748',
        'nodes': [(665, 625), (649, 645), (641, 662), (640, 690), (628, 748)],
    },
]

MIN_CLEARANCE = 4.0  # units; the thread stroke is 2.6 *screen* px (non-scaling), so 4 units read as a clean gap
SAMPLE_STEP = 0.5


def fmt(n):
    return f'{n:g}'


def parse_cubics(d):
    """'M x,y C…' -> [(p0, c1, c2, p1), …] (L handled as a straight cubic)."""
    toks = re.findall(r'[MLC]|-?\d+\.?\d*', d)
    segs, i, last = [], 0, None
    while i < len(toks):
        t = toks[i]
        if t == 'M':
            i += 1
            last = (float(toks[i]), float(toks[i + 1]))
            i += 2
        elif t == 'L':
            i += 1
            p = (float(toks[i]), float(toks[i + 1]))
            i += 2
            segs.append((last, last, p, p))
            last = p
        else:
            i += 1
            c1 = (float(toks[i]), float(toks[i + 1]))
            c2 = (float(toks[i + 2]), float(toks[i + 3]))
            p = (float(toks[i + 4]), float(toks[i + 5]))
            i += 6
            segs.append((last, c1, c2, p))
            last = p
    return segs


def sample(segs, step=SAMPLE_STEP):
    pts = []
    for (p0, c1, c2, p1) in segs:
        n = max(2, int(max(math.dist(p0, c1), math.dist(c1, c2), math.dist(c2, p1)) / step))
        for k in range(n + 1):
            t = k / n
            pts.append(((1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * c1[0] + 3 * (1 - t) * t * t * c2[0] + t ** 3 * p1[0],
                        (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * c1[1] + 3 * (1 - t) * t * t * c2[1] + t ** 3 * p1[1]))
    return pts


LAKE_PTS = sample(parse_cubics(KINNERET), 0.2)
LB = (min(p[0] for p in LAKE_PTS), min(p[1] for p in LAKE_PTS),
      max(p[0] for p in LAKE_PTS), max(p[1] for p in LAKE_PTS))


def in_lake(x, y):
    if x < LB[0] or x > LB[2] or y < LB[1] or y > LB[3]:
        return False
    inside = False
    for i, (x1, y1) in enumerate(LAKE_PTS):
        x2, y2 = LAKE_PTS[(i + 1) % len(LAKE_PTS)]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            inside = not inside
    return inside


def clearance(pts):
    near = [p for p in pts if LB[0] - 40 < p[0] < LB[2] + 40 and LB[1] - 40 < p[1] < LB[3] + 40]
    return min(min(math.hypot(px - x, py - y) for (px, py) in LAKE_PTS) for (x, y) in near)


def catmull(nodes):
    """Cubic chain through the nodes; outer control points mirror the neighbours
    (uniform Catmull-Rom), which reproduces the authored tangent style."""
    out, n = [], len(nodes)
    for i in range(n - 1):
        p0, p1 = nodes[i], nodes[i + 1]
        d1 = (p1[0] - p0[0], p1[1] - p0[1]) if i == 0 else (nodes[i + 1][0] - nodes[i - 1][0], nodes[i + 1][1] - nodes[i - 1][1])
        d2 = (p1[0] - p0[0], p1[1] - p0[1]) if i == n - 2 else (nodes[i + 2][0] - nodes[i][0], nodes[i + 2][1] - nodes[i][1])
        c1 = (p0[0] + d1[0] / 6, p0[1] + d1[1] / 6)
        c2 = (p1[0] - d2[0] / 6, p1[1] - d2[1] / 6)
        out.append((c1, c2, p1))
    return out


def chain_text(nodes, with_moveto=True):
    segs = catmull(nodes)
    body = ' '.join(f'C{fmt(a[0])},{fmt(a[1])} {fmt(b[0])},{fmt(b[1])} {fmt(c[0])},{fmt(c[1])}' for a, b, c in segs)
    return (f'M{fmt(nodes[0][0])},{fmt(nodes[0][1])} ' if with_moveto else '') + body


def detour_text(det):
    """The authored chain for one detour, validated against the lake."""
    txt = chain_text(det['nodes'], with_moveto=det['anchor'].startswith('M'))
    pts = sample(parse_cubics(chain_text(det['nodes'])))  # validate the full chain (with moveto)
    wet = [(x, y) for (x, y) in pts if in_lake(x, y)]
    if wet:
        sys.exit(f"{det['id']}: detour still crosses Kinneret at {wet[0][0]:.0f},{wet[0][1]:.0f}")
    clr = clearance(pts)
    if clr < MIN_CLEARANCE:
        sys.exit(f"{det['id']}: clearance {clr:.2f} < {MIN_CLEARANCE} units")
    return txt


def rewrite(src):
    """Replace each crossing thread with its detour. Idempotent: a thread that
    already carries the detour is left alone."""
    for det in DETOURS:
        new = detour_text(det)
        if new in src:
            continue
        if src.count(det['anchor']) != 1:
            sys.exit(f"{det['id']}: neither the old crossing nor the detour found exactly once — "
                     f"route geometry changed, review scripts/route-detour-kinneret.py")
        src = src.replace(det['anchor'], new)
    return src


def main():
    src = open(ROUTE, encoding='utf-8').read()
    out = rewrite(src)
    if out == src:
        print(f'{ROUTE}: up to date')
        return
    if '--check' in sys.argv:
        sys.exit(f'{ROUTE}: live threads still cross Kinneret — run without --check')
    open(ROUTE, 'w', encoding='utf-8').write(out)
    print(f'{ROUTE}: threaded around Kinneret ({len(DETOURS)} detours, clearance ≥ {MIN_CLEARANCE:g} units)')


if __name__ == '__main__':
    main()
