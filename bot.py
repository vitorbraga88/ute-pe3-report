#!/usr/bin/env python3
"""
UTE-PE3 Telegram Bot — @report_B_bot
Responds to commands and inline button callbacks with the last finalized
reports (queried from save-server's SQLite-backed /list-recent endpoint).

Setup:
  pip install python-telegram-bot
  TELEGRAM_BOT_TOKEN=... python3 bot.py
"""
import os
import json
import asyncio
import urllib.request
import urllib.error
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8898990682:AAGyPDv4sFjBvT8Jdrl4pKhaki0ZYkwVmcY")
CHAT_ID = int(os.environ.get("TELEGRAM_CHAT_ID", "5118460498"))
PWA_URL = "https://servidor-203.tail43f430.ts.net/ute-pe3-report/"
SAVE_SERVER_URL = os.environ.get("SAVE_SERVER_URL", "http://127.0.0.1:8087")


def _fetch_recent(limit=5):
    """Blocking HTTP GET to save-server's /list-recent. Run in a thread."""
    url = f"{SAVE_SERVER_URL}/list-recent?limit={limit}"
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            data = json.loads(resp.read())
            return data.get("items", [])
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError):
        return None


def _format_relatorios(items):
    if items is None:
        return "⚠️ Não foi possível consultar os relatórios agora. Tente novamente em instantes."
    if not items:
        return "📭 Nenhum relatório finalizado ainda."

    lines = ["📄 *Últimos Relatórios*\n"]
    for it in items:
        os_str = ", ".join(it.get("os_numbers") or []) or "—"
        data_str = it.get("data") or "—"
        pdf_url = it.get("pdf_url")
        link = f"[Abrir PDF]({pdf_url})" if pdf_url else "_PDF indisponível_"
        lines.append(f"• OS {os_str} — {data_str} — {link}")
    return "\n".join(lines)


def _main_keyboard():
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("📋 Nova OS", url=PWA_URL),
        InlineKeyboardButton("📄 Últimos PDFs", callback_data="list_pdfs"),
    ]])


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🤖 *UTE-PE3 Report Bot*\n\n"
        "Receba notificações de Ordens de Serviço finalizadas com o PDF anexado.\n\n"
        "Comandos:\n"
        "/start — Esta mensagem\n"
        "/status — Status do sistema\n"
        "/relatorios — Últimos 5 relatórios finalizados",
        parse_mode="Markdown",
        reply_markup=_main_keyboard(),
    )


async def status_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    items = await asyncio.to_thread(_fetch_recent, 1)
    save_server_ok = items is not None
    await update.message.reply_text(
        "✅ Bot operacional\n"
        f"🗄 save-server: {'conectado' if save_server_ok else 'indisponível'}\n"
        f"📡 PWA: {PWA_URL}"
    )


async def relatorios_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    items = await asyncio.to_thread(_fetch_recent, 5)
    await update.message.reply_text(
        _format_relatorios(items),
        parse_mode="Markdown",
        disable_web_page_preview=True,
        reply_markup=_main_keyboard(),
    )


async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    if query.data == "list_pdfs":
        items = await asyncio.to_thread(_fetch_recent, 5)
        await query.message.reply_text(
            _format_relatorios(items),
            parse_mode="Markdown",
            disable_web_page_preview=True,
            reply_markup=_main_keyboard(),
        )


def main():
    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("status", status_cmd))
    app.add_handler(CommandHandler("relatorios", relatorios_cmd))
    app.add_handler(CallbackQueryHandler(button_callback))

    print(f"Bot iniciado. Chat ID: {CHAT_ID}")
    app.run_polling()


if __name__ == "__main__":
    main()
