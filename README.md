# UTE-PE3 Report

Sistema de gestão de Ordens de Serviço (OS) e Permissões de Trabalho (PTS) — UTE Pernambuco III.

## Acesso
- **PWA:** https://servidor-203.tail43f430.ts.net/ute-pe3-report/
- **n8n:** http://100.74.176.72:5678
- **Telegram Bot:** @report_B_bot

## Funcionalidades
- Formulário OS/PTS completo (OS e Supervisor com múltiplos valores via tags)
- Data (calendário nativo) e Hora Inicial/Final (HH:mm nativo)
- Assinaturas digitais duplas (2 pads touch) com memória por nome e sincronização entre dispositivos
- Sincronização cross-device de técnicos/supervisores/remetentes de e-mail (SQLite via save-server, não só localStorage)
- Entrada por voz (Web Speech API, pt-BR)
- Relatório fotográfico com compressão automática + foto obrigatória da PTS (página dedicada no PDF)
- Revisão de descrição por IA (OpenRouter/DeepSeek) sob demanda, com diálogo de confirmação (texto original vs. IA) antes de aplicar
- Toggles independentes para incluir/excluir a descrição-IA e as recomendações-IA no PDF final
- Recomendações técnicas condicionais geradas pela IA (vocabulário simples, formato de tópicos)
- Geração de PDF real no cliente (jsPDF + html2canvas), nome do arquivo `<resumo> - <OS(s)> <DD.MM.AA>.pdf`
- Diálogo de envio por e-mail pós-finalização, com seletor de remetente e anexo do PDF (SMTP via save-server)
- Integração n8n → OpenRouter (resumo IA) → SQLite (via save-server) + Telegram (PDF + texto, 3 chats)
- PDF salvo no servidor em `relatorios/` e servido publicamente
- Bot Telegram com `/relatorios` (últimos 5 PDFs), teclado persistente e mensagem fixada com acessos rápidos
- Botão dedicado "Pasta PDF" na barra de ações
- PWA instalável no celular (iOS e Android), Service Worker network-first para HTML/JS/CSS
- Modo offline com IndexedDB: rascunhos salvos localmente sincronizam automaticamente ao reconectar (PDF é gerado no momento do sync, não apenas no finalize)

## Stack
HTML5 · CSS · Vanilla JS · jsPDF · html2canvas · SQLite · n8n · OpenRouter (DeepSeek) · Caddy (reverse proxy, TLS self-signed) · Telegram Bot API · smtplib (Gmail)

## Arquitetura / Roteamento (produção)
```
https://servidor-203.tail43f430.ts.net/
├── /ute-pe3-report/*        → Caddy → 127.0.0.1:8086 (arquivos estáticos, PWA)
├── /ute-pe3-report/api/*    → Caddy → 127.0.0.1:8087 (save-server, prefixo removido)
└── /webhook/*                → Caddy → n8n:5678 (workflows principal + revisão IA)
```
- **Servidor estático (`:8086`)**: `python3 -m http.server`, gerenciado via crontab `@reboot`.
- **save-server (`:8087`)**: `api/save-server.py` (stdlib puro, sem dependências), gerenciado via **systemd** (`ute-pe3-save-server.service`, `Restart=always`) — não usar `nohup` manual, conflita com a porta.
- **Bot Telegram**: `bot.py`, gerenciado via crontab `@reboot`.
- **n8n**: dois workflows — `ute-pe3-workflow.json` (principal: recebe OS finalizada, opcionalmente resume via IA, salva PDF, grava SQLite, dispara Telegram) e `ute-pe3-ai-workflow.json` (revisão de descrição sob demanda, chamada pelo botão "Revisar com IA").

## Configuração de e-mail (SMTP)
Variáveis lidas de `api/.env` (via `systemd EnvironmentFile=` ou dotenv-loader interno do `save-server.py`):
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<conta gmail>
SMTP_PASS=<senha de app do Gmail>
SMTP_DEFAULT_SENDER=UTE PE3 Report <endereco@dominio>
```

## Deploy
Este projeto roda diretamente no servidor (`100.74.176.72` / `servidor-203.tail43f430.ts.net`, mesma máquina do desenvolvimento) — não há passo de `rsync`/deploy remoto. Edite os arquivos em `/home/vitorbraga/ute-pe3-report/` e:
```bash
# save-server (systemd) — reinicia automaticamente após mudanças em api/save-server.py
sudo systemctl restart ute-pe3-save-server.service

# estático e bot — processos via crontab @reboot; para aplicar mudanças em runtime:
pkill -f "http.server 8086" && nohup python3 -m http.server 8086 --bind 0.0.0.0 >> /tmp/ute-pe3-static.log 2>&1 &
pkill -f "bot.py" && nohup python3 -u bot.py >> /tmp/ute-pe3-bot.log 2>&1 &

# workflows n8n — reimportar via API (deactivate → PUT sem id/versionId/active → activate)
```
Bump `CACHE_NAME` em `sw.js` sempre que houver mudança em HTML/CSS/JS para forçar atualização do Service Worker nos clientes.

## Desenvolvimento
```bash
git clone https://github.com/vitorbraga88/ute-pe3-report.git
cd ute-pe3-report
python3 -m http.server 8086       # servir o front localmente
python3 api/save-server.py 8087   # servidor de persistência local
```
