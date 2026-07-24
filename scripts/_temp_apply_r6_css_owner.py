from pathlib import Path

reader_path = Path("js/reader-state.js")
reader = reader_path.read_text()
create_marker = "  function createState() {"
publish_block = """  function publishCssContract(next) {
    var ratio = clamp(next && next.progressRatio, 0, 1);
    var active = next && Number(next.progress) > 2 ? '1' : '0';
    try {
      if (document.documentElement && document.documentElement.style) {
        document.documentElement.style.setProperty('--gb-read-pct', String(ratio));
        document.documentElement.style.setProperty('--gb-read-active', active);
      }
      if (document.body && document.body.style) {
        document.body.style.setProperty('--gb-read-pct', String(ratio));
      }
    } catch (_) {}
  }

  function createState() {"""
if reader.count(create_marker) != 1:
    raise SystemExit("ReaderState createState marker drifted")
reader = reader.replace(create_marker, publish_block)
emit_old = "    state = next;\n    if (!force && sameState(previous, next)) return;"
emit_new = "    state = next;\n    publishCssContract(next);\n    if (!force && sameState(previous, next)) return;"
if reader.count(emit_old) != 1:
    raise SystemExit("ReaderState emit contract drifted")
reader_path.write_text(reader.replace(emit_old, emit_new))

controller_path = Path("js/floating-cluster-controller.js")
controller = controller_path.read_text()
controller_old = """      var pct = Math.max(0, Math.min(100, Math.round(Number(reader.progress) || 0)));
      var pctF = Math.max(0, Math.min(1, Number(reader.progressRatio) || 0));
      var phase = reader.phase || 'before-content';
      try {
        document.documentElement.style.setProperty('--gb-read-pct', String(pctF));
        document.documentElement.style.setProperty('--gb-read-active', pct > 2 ? '1' : '0');
        document.body.style.setProperty('--gb-read-pct', String(pctF));
      } catch (_) {}
"""
controller_new = """      var pct = Math.max(0, Math.min(100, Math.round(Number(reader.progress) || 0)));
      var phase = reader.phase || 'before-content';
"""
if controller.count(controller_old) != 1:
    raise SystemExit("series ReaderState renderer contract drifted")
controller_path.write_text(controller.replace(controller_old, controller_new))

test_path = Path("scripts/reader-state-regression-test.js")
test = test_path.read_text()
test_marker = "assert(source.includes(\"'gb:reader-state:v1:'\"));"
test_insert = test_marker + "\nassert(source.includes(\"style.setProperty('--gb-read-pct', String(ratio))\"), 'ReaderState must publish the shared CSS progress contract');"
if test.count(test_marker) != 1:
    raise SystemExit("ReaderState source assertion marker drifted")
test = test.replace(test_marker, test_insert)
series_marker = "assert(!seriesControllerSource.includes('gb-resume-offered:'), 'series/book chrome must not own a legacy resume-session key');"
series_insert = series_marker + "\nassert(!seriesControllerSource.includes(\"style.setProperty('--gb-read-pct'\"), 'series/book chrome must not own the shared CSS progress contract');"
if test.count(series_marker) != 1:
    raise SystemExit("series source assertion marker drifted")
test_path.write_text(test.replace(series_marker, series_insert))
