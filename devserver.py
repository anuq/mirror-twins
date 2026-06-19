#!/usr/bin/env python3
"""Tiny static dev server that disables caching.

Plain `python -m http.server` lets the browser cache JS/CSS, which makes
edits appear to "not take". This serves the same files but with no-store
headers so every reload fetches fresh code.

Usage: python devserver.py [port] [directory]
"""
import sys
import os
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5193
DIRECTORY = sys.argv[2] if len(sys.argv) > 2 else "."


class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler)
    print(f"Serving {os.path.abspath(DIRECTORY)} at http://127.0.0.1:{PORT} (no-cache)")
    httpd.serve_forever()
