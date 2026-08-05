# Relatório de OS/PTS — PWA

Sistema de registro e geração de relatórios de **Ordens de Serviço (OS)** e **Permissões de Trabalho (PTS)** para usinas termelétricas. Feito para o técnico registrar o serviço **no celular, na hora, mesmo sem sinal** — e entregar o relatório finalizado em PDF na mesma hora, via Telegram e e-mail.

## 🚀 Destaques

- **Mobile-first e PWA**: instala no celular (iOS/Android), otimizado para toque, funciona offline
- **Registro na hora do serviço**: formulário completo no aparelho — sem papel, sem "depois eu passo pro PC"
- **Offline-first real**: sem conexão, o rascunho fica no aparelho e sincroniza sozinho ao reconectar (o PDF pendente é gerado no momento do sync)
- **IA no relatório**: revisão de descrição + recomendações técnicas via IA (OpenRouter), com diálogo de confirmação antes de aplicar
- **Evidência fotográfica**: câmera com compressão automática (≤300KB), galeria com descrição por foto e **foto da PTS obrigatória**
- **Assinatura digital dupla**: 2 pads touch no próprio aparelho, sem imprimir e escanear
- **Entrega instantânea**: PDF gerado no cliente (A4), enviado para n8n → SQLite + **Telegram** (3 chats) e opcionalmente por **e-mail** com o PDF anexo

## ⚙️ Funcionalidades

### Formulário
- OS múltiplas via tags (validação de 6 dígitos), PTS com auto-formato `N-AA`
- Data e hora nativas (calendário/HH:mm), horímetro, local e status (segmentado)
- Técnicos e supervisores múltiplos, com **autocomplete que memoriza** (localStorage + SQLite, sincronizado entre dispositivos)
- **Entrada por voz** (Web Speech API, pt-BR) para a descrição detalhada
- Validação completa: data não futura, hora final > inicial, campos obrigatórios (1+ OS, 1+ técnico, 1+ supervisor)

### IA (via n8n → OpenRouter)
- Revisão da descrição detalhada: resumo técnico + **recomendações em formato de tópicos**
- Diálogo de confirmação: texto do técnico **ou** sugestão da IA — o profissional decide
- Toggles independentes para incluir/excluir descrição-IA e recomendações-IA no PDF final

### Relatório PDF
- Gerado no cliente (jsPDF + html2canvas), páginas A4: capa, detalhamento, galeria de fotos, anexo da PTS, assinaturas, recomendações e observações
- Nome padrão: `<resumo> - <OS(s)> <DD.MM.AA>.pdf`
- Salvo no servidor e servido publicamente; download automático no aparelho

### Colaboração e histórico
- **Rascunhos compartilhados no servidor** (SQLite): qualquer técnico/supervisor continua de onde o outro parou, em qualquer aparelho
- Fila local (IndexedDB) quando offline, com sync automático ao reconectar
- **Busca de relatórios antigos** (`relatorios.html`): filtros por texto livre, OS, status, supervisor, técnico e intervalo de datas, com paginação
- **Pasta de PDFs com UI própria** (`relatorios/index.html`): busca por nome em vez de listagem crua

### Bot Telegram
- `/relatorios` → últimos 5 PDFs
- Busca de relatórios antigos, teclado persistente e mensagem fixada com acessos rápidos

## 💰 Ganhos no registro

| Antes (papel/planilha) | Com o app |
|---|---|
| Anotava no papel, digitava depois no PC | Registro direto no celular, na hora do serviço |
| Foto solta no WhatsApp, sem vínculo com a OS | Fotos comprimidas e **vinculadas ao relatório**, com descrição |
| Descrição dependia da memória do técnico | Digitação por **voz** + **revisão IA** padroniza o texto |
| Relatório formatado "à mão" (Word) | **PDF A4 automático** com nome padrão e identidade visual |
| Entrega por e-mail manual / impressão | **Telegram + e-mail** com PDF em 1 clique |
| Sem sinal na usina = perdia o registro | **Offline-first**: preenche sem sinal, sincroniza sozinho |
| Relatório preso no PC de quem fez | **Rascunhos compartilhados** + histórico pesquisável |
| Assinatura impressa/escaneada | **Assinatura digital dupla** no próprio aparelho |

## 🧱 Stack

HTML5 · CSS · Vanilla JS · jsPDF · html2canvas · SQLite · n8n · OpenRouter (DeepSeek) · Caddy (reverse proxy) · Telegram Bot API · smtplib (Gmail)

## Arquitetura / Roteamento

```
https://<servidor>.ts.net/
├── /ute-pe3-report/*        → Caddy → 127.0.0.1:8086 (estáticos, PWA)
├── /ute-pe3-report/api/*    → Caddy → 127.0.0.1:8087 (save-server, prefixo removido)
└── /webhook/*                → Caddy → n8n:5678 (workflow principal + revisão IA)
```

Fluxo de finalização: formulário → PDF no cliente → webhook n8n → OpenRouter (resumo/recomendações) + SQLite (histórico) + Telegram (PDF + texto) → e-mail opcional com PDF anexo.

## 📌 Notas de deploy

- Acesso atual por IP direto na rede Tailscale: `http://100.74.176.72:8086/` (app) e `:8087` (API)
- Conflito conhecido de porta 443 entre dois Caddys no servidor (nativo vs. Docker) — o container que serve este app precisa vencer o bind da 443 para o HTTPS público funcionar
- Workflows do n8n: `ute-pe3-workflow.json` (principal) e `ute-pe3-ai-workflow.json` (revisão IA)
