# UTE-PE3 Report

Sistema de gestão de Ordens de Serviço (OS) e Permissões de Trabalho (PTS) — UTE Pernambuco III.

## Acesso
- **PWA:** https://servidor-203.tail43f430.ts.net/ute-pe3-report/
- **n8n:** http://100.74.176.72:5678
- **Telegram Bot:** @report_B_bot

## Funcionalidades
- Formulário OS/PTS completo (16 campos)
- Assinatura digital na tela (touch)
- Entrada por voz (Web Speech API, pt-BR)
- Relatório fotográfico com compressão automática
- Geração de PDF automática
- Integração n8n → OpenRouter (resumo IA) → SQLite (via save-server) + Telegram (3 chats)
- PWA instalável no celular (iOS e Android)
- Modo offline com IndexedDB

## Stack
HTML5 · CSS · Vanilla JS · SQLite · n8n · Telegram Bot API

## Deploy
```bash
# No servidor (Tailscale)
rsync -avz . vitorbraga@100.74.176.72:/home/vitorbraga/ute-pe3-report/
```

## Desenvolvimento
```bash
git clone https://github.com/vitorbraga88/ute-pe3-report.git
cd ute-pe3-report
npx serve .        # Servir localmente
npx tailwindcss -i css/styles.css -o dist/output.css --watch
```
