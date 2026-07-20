#!/usr/bin/env python3
"""
save-server.py — Minimal stdlib HTTP endpoint that persists finalized OS
records and their PDFs for the UTE-PE3 Report project. No third-party
dependencies (uses only http.server + sqlite3 from the standard library)
so it runs reliably regardless of what's installed in the n8n container
(which has no package manager) — there is no n8n-nodes-base.sqlite node.

Setup:
  python3 save-server.py [port]   # default port 8087

Endpoints:
  POST /save          — JSON body with the OS/PTS payload, inserts a row
                         into ordens_servico. Returns {"success": true, "id": N}
  POST /save-pdf       — {"filename": "...", "pdf_base64": "..."} writes the
                          PDF to ../relatorios/<filename> (served statically
                          by the same Caddy route as the rest of the app).
                          Returns {"success": true, "url": "https://.../relatorios/<filename>"}
  GET  /list-recent?limit=5 — last N finalized records (os_numbers, data, pdf url)
  GET  /health         — liveness probe
"""
import json
import re
import sqlite3
import sys
import base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "database" / "ute-pe3.db"
RELATORIOS_DIR = BASE_DIR / "relatorios"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
RELATORIOS_DIR.mkdir(parents=True, exist_ok=True)

PUBLIC_BASE_URL = "https://servidor-203.tail43f430.ts.net/ute-pe3-report"

SCHEMA = """
CREATE TABLE IF NOT EXISTS ordens_servico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  os_numbers TEXT NOT NULL,
  pts TEXT,
  descricao TEXT,
  local TEXT,
  status TEXT DEFAULT 'Aberto',
  tecnicos TEXT,
  supervisores TEXT,
  data TEXT,
  hora_inicial TEXT,
  hora_final TEXT,
  horimetro TEXT,
  descricao_detalhada TEXT,
  descricao_resumida TEXT,
  observacoes TEXT,
  recomendacoes TEXT,
  assinatura TEXT,
  fotos TEXT,
  foto_pts TEXT,
  pdf_path TEXT,
  pdf_url TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
"""
SAFE_FILENAME = re.compile(r"^[A-Za-z0-9._-]+\.pdf$")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute(SCHEMA)
    # migration: adiciona coluna recomendacoes em bases antigas
    cols = [r[1] for r in conn.execute("PRAGMA table_info(ordens_servico)")]
    if "recomendacoes" not in cols:
        conn.execute("ALTER TABLE ordens_servico ADD COLUMN recomendacoes TEXT")
    conn.commit()
    conn.close()

def as_json_array(value):
    """Accept either a JSON array or a plain string/number; always store as JSON array text."""
    if isinstance(value, list):
        return json.dumps(value, ensure_ascii=False)
    if value in (None, ""):
        return json.dumps([], ensure_ascii=False)
    return json.dumps([value], ensure_ascii=False)


def insert_os(payload):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute(
        """INSERT INTO ordens_servico
           (os_numbers, pts, descricao, local, status, tecnicos, supervisores,
            data, hora_inicial, hora_final, horimetro, descricao_detalhada,
            descricao_resumida, recomendacoes, observacoes, assinatura, fotos, foto_pts,
            pdf_path, pdf_url)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            as_json_array(payload.get("os_numbers") or payload.get("os_number")),
            payload.get("pts", ""),
            payload.get("descricao", ""),
            payload.get("local", ""),
            payload.get("status", "Finalizado"),
            json.dumps(payload.get("tecnicos", []), ensure_ascii=False),
            as_json_array(payload.get("supervisores") or payload.get("supervisor")),
            payload.get("data", ""),
            payload.get("hora_inicial", ""),
            payload.get("hora_final", ""),
            str(payload.get("horimetro", "")),
            payload.get("descricao_detalhada", ""),
            payload.get("descricao_resumida", ""),
            json.dumps(payload.get("recomendacoes", []), ensure_ascii=False),
            payload.get("observacoes", ""),
            payload.get("assinatura", ""),
            json.dumps(payload.get("fotos", []), ensure_ascii=False),
            payload.get("foto_pts", ""),
            payload.get("pdf_path", ""),
            payload.get("pdf_url", ""),
        ),
    )
    conn.commit()
    row_id = cur.lastrowid
    conn.close()
    return row_id


def save_pdf(filename, pdf_base64):
    if not SAFE_FILENAME.match(filename or ""):
        raise ValueError("filename invalido (esperado *.pdf sem caminho)")
    if not pdf_base64:
        raise ValueError("pdf_base64 vazio")
    data = base64.b64decode(pdf_base64)
    path = RELATORIOS_DIR / filename
    path.write_bytes(data)
    url = f"{PUBLIC_BASE_URL}/relatorios/{filename}"
    return str(path), url


def list_recent(limit=5):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """SELECT id, os_numbers, data, status, pdf_url, created_at
           FROM ordens_servico
           WHERE status = 'Finalizado'
           ORDER BY id DESC LIMIT ?""",
        (limit,),
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        try:
            os_nums = json.loads(r["os_numbers"] or "[]")
        except json.JSONDecodeError:
            os_nums = []
        result.append({
            "id": r["id"],
            "os_numbers": os_nums,
            "data": r["data"],
            "status": r["status"],
            "pdf_url": r["pdf_url"],
            "created_at": r["created_at"],
        })
    return result


class Handler(BaseHTTPRequestHandler):
    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw)

    def do_POST(self):
        try:
            if self.path == "/save":
                payload = self._read_json_body()
                if not (payload.get("os_numbers") or payload.get("os_number")):
                    return self._json(400, {"error": "os_numbers is required"})
                row_id = insert_os(payload)
                return self._json(200, {"success": True, "id": row_id})

            if self.path == "/save-pdf":
                payload = self._read_json_body()
                path, url = save_pdf(payload.get("filename"), payload.get("pdf_base64"))
                return self._json(200, {"success": True, "path": path, "url": url})

            return self._json(404, {"error": "not found"})
        except json.JSONDecodeError as e:
            self._json(400, {"error": f"invalid json: {e}"})
        except ValueError as e:
            self._json(400, {"error": str(e)})
        except Exception as e:  # noqa: BLE001 — surface errors to caller
            self._json(500, {"error": str(e)})

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            return self._json(200, {"status": "ok", "db": str(DB_PATH)})
        if parsed.path == "/list-recent":
            qs = parse_qs(parsed.query)
            try:
                limit = max(1, min(20, int(qs.get("limit", ["5"])[0])))
            except ValueError:
                limit = 5
            return self._json(200, {"success": True, "items": list_recent(limit)})
        self._json(404, {"error": "not found"})

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8087
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"save-server listening on :{port}, db={DB_PATH}, relatorios={RELATORIOS_DIR}")
    server.serve_forever()


if __name__ == "__main__":
    main()
