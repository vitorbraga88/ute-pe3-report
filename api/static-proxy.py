"""
static-proxy.py — Servidor estático + proxy reverso para API e webhooks.
MULTITHREAD: cada requisição numa thread própria (ThreadingHTTPServer).

Sirve arquivos estáticos do projeto (HTML/CSS/JS/PDFs/imagens) E encaminha:
  /api/*     →  http://localhost:8087/*   (save-server, sem o prefixo /api)
  /webhook/* →  http://localhost:5678/*   (n8n, path completo)

Uma única porta (8086) para tudo: sem CORS cross-origin, sem dependência de
múltiplas portas acessíveis pelo cliente. O PWA funciona de qualquer rede
que alcance esta porta.
"""
import os
import sys
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API_TARGET = "http://127.0.0.1:8087"
WEBHOOK_TARGET = "http://127.0.0.1:5678"
PROXY_TIMEOUT = 180  # 3 min — n8n pode levar tempo com IA + PDF + Telegram

HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade", "host", "content-length",
}


class ProxyHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PROJECT_DIR, **kwargs)

    # ─── Proxy helpers ────────────────────────────

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(length) if length else None

    def _proxy(self, target, strip_prefix):
        """Encaminha a requisição atual para *target*, opcionalmente removendo
        *strip_prefix* do path."""
        parsed = urlparse(self.path)
        proxy_path = parsed.path
        if strip_prefix and proxy_path.startswith(strip_prefix):
            proxy_path = proxy_path[len(strip_prefix):]
        url = target + proxy_path
        if parsed.query:
            url += "?" + parsed.query

        body = self._read_body()
        req = urllib.request.Request(url, data=body, method=self.command)
        for key in ("Content-Type", "Accept"):
            val = self.headers.get(key)
            if val:
                req.add_header(key, val)

        try:
            with urllib.request.urlopen(req, timeout=PROXY_TIMEOUT) as resp:
                resp_data = resp.read()
                self.send_response(resp.status)
                for h, v in resp.getheaders():
                    if h.lower() not in HOP_BY_HOP:
                        self.send_header(h, v)
                self.send_header("Content-Length", str(len(resp_data)))
                self.end_headers()
                self.wfile.write(resp_data)
        except urllib.error.HTTPError as exc:
            resp_data = exc.read()
            self.send_response(exc.code)
            for h, v in exc.headers.items():
                if h.lower() not in HOP_BY_HOP:
                    self.send_header(h, v)
            self.send_header("Content-Length", str(len(resp_data)))
            self.end_headers()
            self.wfile.write(resp_data)
        except Exception as exc:  # noqa: BLE001
            msg = f'{{"error": "proxy: {exc}"}}'.encode()
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)

    def _is_api(self):
        return urlparse(self.path).path.startswith("/api/")

    def _is_webhook(self):
        return urlparse(self.path).path.startswith("/webhook/")

    # ─── HTTP methods ─────────────────────────────

    def do_GET(self):
        if self._is_api():
            return self._proxy(API_TARGET, "/api")
        if self._is_webhook():
            return self._proxy(WEBHOOK_TARGET, None)
        return super().do_GET()

    def do_POST(self):
        if self._is_api():
            return self._proxy(API_TARGET, "/api")
        if self._is_webhook():
            return self._proxy(WEBHOOK_TARGET, None)
        self.send_error(405)

    def do_DELETE(self):
        if self._is_api():
            return self._proxy(API_TARGET, "/api")
        self.send_error(405)

    def do_PUT(self):
        if self._is_api():
            return self._proxy(API_TARGET, "/api")
        self.send_error(405)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def end_headers(self):
        # CORS em todas as respostas (estático + proxy)
        if "Access-Control-Allow-Origin" not in self.headers:
            self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8086
    server = ThreadingHTTPServer(("0.0.0.0", port), ProxyHandler)
    sys.stderr.write(f"static-proxy on :{port}  root={PROJECT_DIR}\n")
    server.serve_forever()


if __name__ == "__main__":
    main()
