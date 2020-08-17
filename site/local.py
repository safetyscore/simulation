#! /usr/bin/env python3

import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class SiteHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Expires", "0")
        self.send_header("Pragma", "no-cache")
        SimpleHTTPRequestHandler.end_headers(self)

if __name__ == "__main__":
    with ThreadingHTTPServer(("", 8000), SiteHandler) as httpd:
        print(">> Running simulation on http://localhost:8000")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n!! Keyboard interrupt received, exiting !!")
            sys.exit(0)
