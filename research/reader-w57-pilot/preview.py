#!/usr/bin/env python3
"""Read-only localhost preview of the archived Reader W57 pilot on current Astro dist.
Not a production integration: pilot sources load ONLY when ?reader-pilot=1.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs, unquote
import os, json, mimetypes

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
DIST = Path(os.environ.get("READER_W57_DIST", REPO / "dist")).resolve()
PORT = int(os.environ.get("READER_W57_PORT", "19061"))
PREFIX = "/__reader_w57__/"
MANIFEST = json.loads((HERE / "MANIFEST.json").read_text(encoding="utf-8"))
APPROVED = {f["name"] for f in MANIFEST["files"]}
CSS = ["reader_universal_preview.css","reader_argon_first.css",
       "reader_editorial_refinement.css","reader_editorial_consolidation.css",
       "reader_editorial_w51.css","reader_w57.css"]
JS = ["reader_universal_contract.js","reader_universal_preview.js",
      "reader_editorial_refinement.js","reader_editorial_consolidation.js",
      "reader_w57.js","reader_w57_annotations.js"]
assert set(CSS + JS) == APPROVED, "W57 source manifest does not match runtime"
if not DIST.is_dir(): raise SystemExit(f"Build Astro first; missing {DIST}")

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kw):
        super().__init__(*args,directory=str(DIST),**kw)
    def end_headers(self):
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Robots-Tag","noindex,nofollow")
        super().end_headers()
    def reply(self,data:bytes,ctype:str):
        self.send_response(200)
        self.send_header("Content-Type",ctype)
        self.send_header("Content-Length",str(len(data)))
        self.end_headers()
        if self.command!="HEAD": self.wfile.write(data)
    def do_HEAD(self): self.do_GET()
    def do_GET(self):
        req=urlsplit(self.path)
        path=unquote(req.path)
        if path.startswith(PREFIX):
            name=path[len(PREFIX):]
            if name not in APPROVED or "/" in name or "\\" in name:
                return self.send_error(404,"Unknown W57 asset")
            file=HERE/"assets"/name
            if not file.is_file(): return self.send_error(404,"Missing W57 source")
            ctype=mimetypes.guess_type(name)[0] or "application/octet-stream"
            return self.reply(file.read_bytes(),ctype+"; charset=utf-8")
        # Explicit opt-in only. G3/News and Nagornaya have independent readers.
        allowed=("/articles/","/baptisty-rossii/","/biografii/",
                 "/pastor-series/","/biblioteka/","/books/")
        excluded=("/nagornaya/","/updates/","/news/","/novosti/")
        if (parse_qs(req.query).get("reader-pilot")==["1"]
                and path.startswith(allowed) and not path.startswith(excluded)
                and path.endswith("/")):
            file=(DIST/path.lstrip("/")/"index.html").resolve()
            if not file.is_relative_to(DIST) or not file.is_file():
                return self.send_error(404,"Built Reader page not found")
            html=file.read_text(encoding="utf-8")
            if html.count("</head>")!=1 or html.count("</body>")!=1:
                return self.send_error(422,"Unexpected Astro document")
            css="".join(f'<link rel="stylesheet" href="{PREFIX}{n}">' for n in CSS)
            js="".join(f'<script src="{PREFIX}{n}" defer></script>' for n in JS)
            html=html.replace("</head>",css+"</head>").replace("</body>",js+"</body>")
            return self.reply(html.encode("utf-8"),"text/html; charset=utf-8")
        return super().do_GET()

if __name__=="__main__":
    print(f"READER_W57_LOCAL http://127.0.0.1:{PORT}/",flush=True)
    print(f"ASTRO_DIST {DIST} | No production mutation",flush=True)
    ThreadingHTTPServer(("127.0.0.1",PORT),Handler).serve_forever()
