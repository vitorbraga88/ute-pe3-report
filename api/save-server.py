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
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "database" / "ute-pe3.db"
RELATORIOS_DIR = BASE_DIR / "relatorios"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
RELATORIOS_DIR.mkdir(parents=True, exist_ok=True)

PUBLIC_BASE_URL = "https://servidor-203.tail43f430.ts.net/ute-pe3-report"
DEFAULT_SENDER = os.environ.get("SMTP_DEFAULT_SENDER", "vitor.braga@ht-hidrotermica.com.br")
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", DEFAULT_SENDER)
SMTP_PASS = os.environ.get("SMTP_PASS", "")

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
-- Sugestões compartilhadas entre dispositivos (sync via .db)
CREATE TABLE IF NOT EXISTS sugestoes (
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (field, value)
);

CREATE TABLE IF NOT EXISTS assinaturas (
  nome TEXT PRIMARY KEY,
  data_url TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);
"""
SAFE_FILENAME = re.compile(r"^[A-Za-z0-9._-]+\.pdf$")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)
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
def get_suggestions():
    """Returns {tecnico:[], supervisor:[], remetente:[]} shared across devices."""
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("SELECT field, value FROM sugestoes ORDER BY value").fetchall()
    conn.close()
    out = {"tecnico": [], "supervisor": [], "remetente": []}
    for field, value in rows:
        if field in out:
            out[field].append(value)
    # sempre garante o remetente padrão visível
    if DEFAULT_SENDER not in out["remetente"]:
        out["remetente"].insert(0, DEFAULT_SENDER)
    return out


def upsert_suggestion(field, value):
    if field not in ("tecnico", "supervisor", "remetente") or not value:
        raise ValueError("field/value invalido")
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO sugestoes(field,value) VALUES(?,?) "
        "ON CONFLICT(field,value) DO UPDATE SET updated_at=datetime('now','localtime')",
        (field, value),
    )
    conn.commit()
    conn.close()


def remove_suggestion(field, value):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM sugestoes WHERE field=? AND value=?", (field, value))
    conn.commit()
    conn.close()


def list_assinaturas():
    """Lista apenas nomes (leve) para sync de chips entre dispositivos."""
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("SELECT nome FROM assinaturas ORDER BY nome").fetchall()
    conn.close()
    return [r[0] for r in rows]


def get_assinatura(nome):
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute("SELECT data_url FROM assinaturas WHERE nome=?", (nome,)).fetchone()
    conn.close()
    return row[0] if row else None


def upsert_assinatura(nome, data_url):
    if not nome or not data_url:
        raise ValueError("nome/data_url obrigatorios")
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO assinaturas(nome,data_url) VALUES(?,?) "
        "ON CONFLICT(nome) DO UPDATE SET data_url=excluded.data_url, "
        "updated_at=datetime('now','localtime')",
        (nome, data_url),
    )
    conn.commit()
    conn.close()


def remove_assinatura(nome):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM assinaturas WHERE nome=?", (nome,))
    conn.commit()
    conn.close()


def send_email(to_addr, subject, body_text, pdf_base64, pdf_filename):
    """Envia e-mail com PDF anexo via SMTP configurado por env.
    Requer SMTP_PASS (app-password Gmail) para funcionar."""
    if not SMTP_PASS:
        raise RuntimeError("SMTP_PASS nao configurado no servidor")
    msg = MIMEMultipart()
    msg["From"] = SMTP_USER
    msg["To"] = to_addr
    msg["Subject"] = subject
    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    if pdf_base64 and pdf_filename:
        part = MIMEBase("application", "pdf")
        part.set_payload(base64.b64decode(pdf_base64))
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", "attachment", filename=("utf-8", "", pdf_filename))
        msg.attach(part)
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as srv:
        srv.ehlo()
        srv.starttls()
        srv.ehlo()
        srv.login(SMTP_USER, SMTP_PASS)
        srv.sendmail(SMTP_USER, [to_addr], msg.as_string())
    return True


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

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

            if self.path == "/suggestion":
                p = self._read_json_body()
                upsert_suggestion(p.get("field"), (p.get("value") or "").strip())
                return self._json(200, {"success": True})
            if self.path == "/assinatura":
                p = self._read_json_body()
                upsert_assinatura((p.get("nome") or "").strip(), p.get("data_url"))
                return self._json(200, {"success": True})
            if self.path == "/enviar-email":
                p = self._read_json_body()
                send_email(
                    p.get("to"), p.get("subject"), p.get("body"),
                    p.get("pdf_base64"), p.get("pdf_filename"),
                )
                return self._json(200, {"success": True, "to": p.get("to")})
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
        if parsed.path == "/suggestions":
            return self._json(200, {"success": True, **get_suggestions()})
        if parsed.path == "/assinaturas":
            return self._json(200, {"success": True, "nomes": list_assinaturas()})
        if parsed.path == "/assinatura":
            qs = parse_qs(parsed.query)
            nome = (qs.get("nome", [""])[0])
            data = get_assinatura(nome)
            if data is None:
                return self._json(404, {"error": "assinatura nao encontrada"})
            return self._json(200, {"success": True, "nome": nome, "data_url": data})
        self._json(404, {"error": "not found"})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        try:
            if parsed.path == "/suggestion":
                remove_suggestion(qs.get("field", [""])[0], qs.get("value", [""])[0])
                return self._json(200, {"success": True})
            if parsed.path == "/assinatura":
                remove_assinatura(qs.get("nome", [""])[0])
                return self._json(200, {"success": True})
            self._json(404, {"error": "not found"})
        except Exception as e:  # noqa: BLE001
            self._json(500, {"error": str(e)})

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
