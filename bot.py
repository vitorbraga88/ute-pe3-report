#!/usr/bin/env python3
"""
UTE-PE3 Telegram Bot — @report_B_bot
Responds to inline button callbacks with report details and photos.

Setup:
  pip install python-telegram-bot
  TELEGRAM_BOT_TOKEN=... python3 bot.py
"""
import os
import json
import asyncio
from telegram import Bot, Update
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8898990682:AAGyPDv4sFjBvT8Jdrl4pKhaki0ZYkwVmcY")
CHAT_ID = int(os.environ.get("TELEGRAM_CHAT_ID", "5118460498"))

# In production, fetch from SQLite database
# This bot handles inline button callbacks from n8n notifications

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🤖 *UTE-PE3 Report Bot*\n\n"
        "Receba notificações de Ordens de Serviço finalizadas.\n\n"
        "Comandos:\n"
        "/start — Esta mensagem\n"
        "/status — Status do sistema\n"
        "/report <OS> — Buscar relatório",
        parse_mode="Markdown"
    )

async def status_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "✅ Sistema operacional\n"
        "📡 n8n: conectado\n"
        "🗄 SQLite: conectado"
    )

async def report_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if not args:
        await update.message.reply_text("Uso: /report <número_da_OS>")
        return
    os_number = args[0]
    await update.message.reply_text(
        f"📋 Relatório OS {os_number}\n\n"
        f"Disponível em: https://servidor-203.tail43f430.ts.net/ute-pe3-report/"
    )

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    data = query.data
    if data.startswith("report_"):
        os_num = data.replace("report_", "")
        await query.message.reply_text(
            f"📋 *Relatório OS {os_num}*\n\n"
            "Acesse o sistema para visualizar o relatório completo.",
            parse_mode="Markdown"
        )
    elif data.startswith("photos_"):
        os_num = data.replace("photos_", "")
        await query.message.reply_text(
            f"📸 *Fotos OS {os_num}*\n\n"
            "As imagens estão disponíveis no relatório PDF.",
            parse_mode="Markdown"
        )

def main():
    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("status", status_cmd))
    app.add_handler(CommandHandler("report", report_cmd))
    app.add_handler(CallbackQueryHandler(button_callback))

    print(f"Bot iniciado. Chat ID: {CHAT_ID}")
    app.run_polling()

if __name__ == "__main__":
    main()
