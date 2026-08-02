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
- **Rascunhos compartilhados no servidor**: salvos em SQLite (tabela `rascunhos`), visíveis para qualquer técnico/supervisor em qualquer aparelho; IndexedDB local vira apenas fila de saída (outbox) quando offline, sincronizada automaticamente ao reconectar
- **Página de busca de relatórios antigos** (`relatorios.html`): filtros por texto livre, OS, status, supervisor, técnico e intervalo de datas, com paginação
- **Pasta de PDFs com interface própria** (`relatorios/index.html`): substitui a listagem crua do servidor por uma UI com busca por nome e botão de volta à aplicação
- Entrada por voz (Web Speech API, pt-BR)
- Relatório fotográfico com compressão automática + foto obrigatória da PTS (página dedicada no PDF)
- Revisão de descrição por IA (OpenRouter/DeepSeek) sob demanda, com diálogo de confirmação (texto original vs. IA) antes de aplicar
- Toggles independentes para incluir/excluir a descrição-IA e as recomendações-IA no PDF final
- Recomendações técnicas condicionais geradas pela IA (vocabulário simples, formato de tópicos)
- Geração de PDF real no cliente (jsPDF + html2canvas), nome do arquivo `<resumo> - <OS(s)> <DD.MM.AA>.pdf`
- Diálogo de envio por e-mail pós-finalização, com seletor de remetente e anexo do PDF (SMTP via save-server)
- Integração n8n → OpenRouter (resumo IA) → SQLite (via save-server) + Telegram (PDF + texto, 3 chats)
- PDF salvo no servidor em `relatorios/` e servido publicamente
- Bot Telegram com `/relatorios` (últimos 5 PDFs), busca de relatórios antigos, teclado persistente e mensagem fixada com acessos rápidos
- Botões dedicados "PDFs" e "Relatórios" na barra de ações (layout em 2 linhas, otimizado para toque em Android)
- PWA instalável no celular (iOS e Android), Service Worker network-first para HTML/JS/CSS
- Modo offline com IndexedDB: rascunhos salvos localmente sincronizam automaticamente ao reconectar (PDF é gerado no momento do sync, não apenas no finalize)

## Stack
HTML5 · CSS · Vanilla JS · jsPDF · html2canvas · SQLite · n8n · OpenRouter (DeepSeek) · Caddy (reverse proxy) · Telegram Bot API · smtplib (Gmail)

## [WARN] Problema conhecido — HTTPS público indisponível
Desde 31/07 existe um **conflito de porta 443** entre dois Caddys distintos no servidor:
- `caddy.service` (systemd, nativo no host, `/etc/caddy/Caddyfile`) — serve só `/avs*` de outro projeto (AVS Soluções Elétricas), sem certificado explícito configurado.
- `n8n-tls-proxy` (Docker, `docker/n8n-tls-proxy/Caddyfile`) — é quem deveria servir `/ute-pe3-report/*`, `/ute-pe3-report/api/*` e `/webhook/*`.

O `caddy.service` nativo venceu o bind da porta 443 no último boot; o container Docker não consegue publicar a porta enquanto isso persistir. Resultado: `https://servidor-203.tail43f430.ts.net/*` retorna erro de TLS ("internal error") para **qualquer** rota, incluindo as do próprio `/avs*` nativo — não é algo específico do UTE-PE3.
**Não mexi no `caddy.service`** por afetar outro projeto sem contexto/autorização. Decisão necessária: desativar um dos dois Caddys ou migrar as rotas do UTE-PE3 para o Caddy que efetivamente vencer a porta 443.
**Contorno atual**: acessar via IP direto na rede Tailscale — `http://100.74.176.72:8086/` (app) e `http://100.74.176.72:8087/` (API) — funciona normalmente e foi o caminho usado para validar todas as mudanças desta rodada.

## Arquitetura / Roteamento (produção, quando o Caddy do Docker estiver servindo a porta 443)
```
https://servidor-203.tail43f430.ts.net/
├── /ute-pe3-report/*        → Caddy → 127.0.0.1:8086 (arquivos estáticos, PWA)
├── /ute-pe3-report/api/*    → Caddy → 127.0.0.1:8087 (save-server, prefixo removido)
└── /webhook/*                → Caddy → n8n:5678 (workflows principal + revisão IA)
```
- **Servidor estático (`:8086`)**: `python3 -m http.server`, gerenciado via **systemd** (`ute-pe3-static.service`, `Restart=always`).
- **save-server (`:8087`)**: `api/save-server.py` (stdlib puro, sem dependências), gerenciado via **systemd** (`ute-pe3-save-server.service`, `Restart=always`).
- **Bot Telegram**: `bot.py`, gerenciado via **systemd** (`ute-pe3-bot.service`, `Restart=always`) — antes rodava via `crontab @reboot` + `nohup`, sem reinício automático em caso de crash; foi essa lacuna que deixou o bot fora do ar sem detecção até esta rodada de correção.
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
# os 3 serviços rodam via systemd com Restart=always — reinicie o que mudou
sudo systemctl restart ute-pe3-static.service       # index.html/css/js/relatorios.html
sudo systemctl restart ute-pe3-save-server.service   # api/save-server.py
sudo systemctl restart ute-pe3-bot.service           # bot.py

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
