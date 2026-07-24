#!/usr/bin/env python3
from pathlib import Path

path = Path('js/floating-cluster-controller.js')
source = path.read_text(encoding='utf-8')

old_group = "        if (activeGrp !== _gbs2ActiveGrp) {"
new_group = "\n".join([
    "        var activeGroupChanged = activeGrp !== _gbs2ActiveGrp;",
    "        if (activeGroupChanged) {",
])
if source.count(old_group) != 1:
    raise SystemExit(f'active group block count={source.count(old_group)}')
source = source.replace(old_group, new_group)

old_visibility = "\n".join([
    "        var activeRow = activeIdx >= 0 ? represented[activeIdx] : null;",
    "        var scroller = qs('.gbs2-tocscroll');",
    "        if (activeRow && scroller) {",
    "          var ar = activeRow.a.getBoundingClientRect();",
    "          var sr = scroller.getBoundingClientRect();",
    "          if (ar.top < sr.top + 18 || ar.bottom > sr.bottom - 18) {",
    "            var desired = activeRow.a.offsetTop - scroller.clientHeight / 2 + activeRow.a.offsetHeight / 2;",
    "            scroller.scrollTo({ top: Math.max(0, desired), behavior: 'smooth' });",
    "          }",
    "        }",
])
new_visibility = "\n".join([
    "        var activeRow = activeIdx >= 0 ? represented[activeIdx] : null;",
    "        var scroller = qs('.gbs2-tocscroll');",
    "        function keepActiveRowVisible(behavior) {",
    "          if (!activeRow || !scroller) return;",
    "          var ar = activeRow.a.getBoundingClientRect();",
    "          var sr = scroller.getBoundingClientRect();",
    "          if (ar.top < sr.top + 18 || ar.bottom > sr.bottom - 18) {",
    "            var desired = activeRow.a.offsetTop - scroller.clientHeight / 2 + activeRow.a.offsetHeight / 2;",
    "            scroller.scrollTo({ top: Math.max(0, desired), behavior: behavior || 'auto' });",
    "          }",
    "        }",
    "        if (activeRow && scroller) {",
    "          keepActiveRowVisible('smooth');",
    "          // Expanding the new sub-group and collapsing the previous one can",
    "          // move the active row after the immediate scroll has completed.",
    "          // Re-check once the 560ms rail follow loop has settled, but only",
    "          // if this row is still the canonical active row.",
    "          if (activeGroupChanged) window.setTimeout(function () {",
    "            if (activeRow.a.classList.contains('gbs2-active')) keepActiveRowVisible('auto');",
    "          }, 620);",
    "        }",
])
if source.count(old_visibility) != 1:
    raise SystemExit(f'active visibility block count={source.count(old_visibility)}')
source = source.replace(old_visibility, new_visibility)
path.write_text(source, encoding='utf-8')
