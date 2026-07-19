#!/usr/bin/env python3
"""
save-server.py — Minimal stdlib HTTP endpoint that persists finalized OS
records into the UTE-PE3 SQLite database. No third-party dependencies
(uses only http.server + sqlite3 from the standard library) so it runs
reliably inside the n8n Docker network without needing an n8n SQLite
node (which is not an existing n8n-nodes-base node type).

Setup:
  python3 save-server.py [port]   # default port 8087

Endpoint:
  POST /save  — JSON body matching the OS/PTS payload, inserts a row
                into ordens_servico and returns {"success": true, "id": N}
"""
import json
import sqlite3
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "database" / "ute-pe3.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

SCHEMA = """
CREATE TABLE IF NOT EXISTS ordens_servico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  os_number TEXT NOT NULL,
  pts TEXT,
  descricao TEXT,
  local TEXT,
  status TEXT DEFAULT 'Aberto',
  tecnicos TEXT,
  supervisor TEXT,
  data TEXT,
  hora_inicial TEXT,
  hora_final TEXT,
  horimetro TEXT,
  descricao_detalhada TEXT,
  descricao_resumida TEXT,
  observacoes TEXT,
  assinatura TEXT,
  fotos TEXT,
  foto_pts TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
"""


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute(SCHEMA)
    conn.commit()
    conn.close()


def insert_os(payload):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute(
        """INSERT INTO ordens_servico
           (os_number, pts, descricao, local, status, tecnicos, supervisor,
            data, hora_inicial, hora_final, horimetro, descricao_detalhada,
            descricao_resumida, observacoes, assinatura, fotos, foto_pts)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            payload.get("os_number", ""),
            payload.get("pts", ""),
            payload.get("descricao", ""),
            payload.get("local", ""),
            payload.get("status", "Finalizado"),
            json.dumps(payload.get("tecnicos", []), ensure_ascii=False),
            payload.get("supervisor", ""),
            payload.get("data", ""),
            payload.get("hora_inicial", ""),
            payload.get("hora_final", ""),
            str(payload.get("horimetro", "")),
            payload.get("descricao_detalhada", ""),
            payload.get("descricao_resumida", ""),
            payload.get("observacoes", ""),
            payload.get("assinatura", ""),
            json.dumps(payload.get("fotos", []), ensure_ascii=False),
            payload.get("foto_pts", ""),
        ),
    )
    conn.commit()
    row_id = cur.lastrowid
    conn.close()
    return row_id


class Handler(BaseHTTPRequestHandler):
    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/save":
            self._json(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as e:
            self._json(400, {"error": f"invalid json: {e}"})
            return
        if not payload.get("os_number"):
            self._json(400, {"error": "os_number is required"})
            return
        try:
            row_id = insert_os(payload)
        except Exception as e:  # noqa: BLE001 — surface DB errors to caller
            self._json(500, {"error": str(e)})
            return
        self._json(200, {"success": True, "id": row_id})

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"status": "ok", "db": str(DB_PATH)})
            return
        self._json(404, {"error": "not found"})

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8087
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"save-server listening on :{port}, db={DB_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    main()
