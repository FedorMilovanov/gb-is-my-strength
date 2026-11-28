#!/usr/bin/env python3
"""Read-only localhost server for canonical Astro dist; no HTML rewriting."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
DIST = Path(os.environ.get("READER_W57_DIST", REPO / "dist")).resolve()
PORT = int(os.environ.get("READER_W57_PORT", "19061"))
if not DIST.is_dir(): raise SystemExit(f"Build Astro first; missing {DIST}")
if not (DIST / "reader-desktop" / "bootstrap.js").is_file():
    raise SystemExit("Canonical Reader desktop build required")

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kw):
        super().__init__(*args,directory=str(DIST),**kw)
    def end_headers(self):
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Robots-Tag","noindex,nofollow")
        super().end_headers()

if __name__=="__main__":
    print(f"READER_W57_LOCAL http://127.0.0.1:{PORT}/",flush=True)
    print(f"ASTRO_DIST {DIST} | No production mutation",flush=True)
    ThreadingHTTPServer(("127.0.0.1",PORT),Handler).serve_forever()
