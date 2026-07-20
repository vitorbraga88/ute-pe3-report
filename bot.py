#!/usr/bin/env python3
"""
UTE-PE3 Telegram Bot — @report_B_bot

- Mensagem "Acessos rápidos" com os 2 botões (Aplicação + Pasta de PDFs)
  FIXADA (pin) no topo do chat.
- Teclado persistente fixo na parte de baixo do Telegram com os mesmos
  atalhos (sempre visível, não some ao rolar).
- /relatorios lista os últimos 5 PDFs (via save-server /list-recent).

Setup:
  pip install python-telegram-bot
  TELEGRAM_BOT_TOKEN=... python3 bot.py
"""
import os
import json
import asyncio
import urllib.request
import urllib.error
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    ReplyKeyboardMarkup,
)
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8898990682:AAGyPDv4sFjBvT8Jdrl4pKhaki0ZYkwVmcY")
CHAT_ID = int(os.environ.get("TELEGRAM_CHAT_ID", "5118460498"))
PWA_URL = "https://servidor-203.tail43f430.ts.net/ute-pe3-report/"
SAVE_SERVER_URL = os.environ.get("SAVE_SERVER_URL", "http://127.0.0.1:8087")
RELATORIOS_URL = PWA_URL.rstrip("/") + "/relatorios/"

# Rótulos do teclado persistente (fixo embaixo)
BTN_APP = "🌐 Abrir Aplicação"
BTN_PDFS = "📁 Pasta de PDFs"
BTN_RELATORIOS = "📄 Últimos Relatórios"
BTN_STATUS = "ℹ️ Status"


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
    """Botões inline (URL) anexados às mensagens do bot."""
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(BTN_APP, url=PWA_URL)],
        [InlineKeyboardButton(BTN_PDFS, url=RELATORIOS_URL)],
    ])


def _persistent_keyboard():
    """Teclado fixo na parte de baixo do Telegram (não some)."""
    return ReplyKeyboardMarkup(
        [[BTN_APP, BTN_PDFS], [BTN_RELATORIOS, BTN_STATUS]],
        resize_keyboard=True,
        is_persistent=True,
    )


async def _pin_access_message(chat_id, bot):
    """Envia e FIXA a mensagem de acessos rápidos com os 2 botões."""
    msg = await bot.send_message(
        chat_id=chat_id,
        text="📌 *Acessos rápidos — UTE-PE3 Report*",
        parse_mode="Markdown",
        reply_markup=_main_keyboard(),
    )
    try:
        await bot.unpin_all_chat_messages(chat_id)
    except Exception:
        pass  # sem pins anteriores ou sem permissão de unpin
    await bot.pin_chat_message(chat_id, msg.message_id, disable_notification=True)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🤖 *UTE-PE3 Report Bot*\n\n"
        "Receba notificações de Ordens de Serviço finalizadas com o PDF anexado.\n\n"
        "Use os botões fixos abaixo ou os comandos:\n"
        "/status — Status do sistema\n"
        "/relatorios — Últimos 5 relatórios finalizados",
        parse_mode="Markdown",
        reply_markup=_persistent_keyboard(),
    )
    try:
        await _pin_access_message(update.effective_chat.id, context.bot)
    except Exception:
        pass  # pin pode falhar se o bot não tiver permissão no chat


async def status_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    items = await asyncio.to_thread(_fetch_recent, 1)
    save_server_ok = items is not None
    await update.message.reply_text(
        "✅ Bot operacional\n"
        f"🗄 save-server: {'conectado' if save_server_ok else 'indisponível'}\n"
        f"📡 PWA: {PWA_URL}",
        reply_markup=_persistent_keyboard(),
    )


async def relatorios_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    items = await asyncio.to_thread(_fetch_recent, 5)
    await update.message.reply_text(
        _format_relatorios(items),
        parse_mode="Markdown",
        disable_web_page_preview=True,
        reply_markup=_main_keyboard(),
    )


async def text_router(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Trata os toques no teclado persistente."""
    text = (update.message.text or "").strip()
    if text == BTN_APP:
        await update.message.reply_text(
            "🌐 Toque para abrir a aplicação:",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(BTN_APP, url=PWA_URL)]]),
        )
    elif text == BTN_PDFS:
        await update.message.reply_text(
            "📁 Toque para abrir a pasta de PDFs:",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton(BTN_PDFS, url=RELATORIOS_URL)]]),
        )
    elif text == BTN_RELATORIOS:
        await relatorios_cmd(update, context)
    elif text == BTN_STATUS:
        await status_cmd(update, context)


def main():
    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("status", status_cmd))
    app.add_handler(CommandHandler("relatorios", relatorios_cmd))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_router))

    print(f"Bot iniciado. Chat ID: {CHAT_ID}")
    app.run_polling()


if __name__ == "__main__":
    main()
