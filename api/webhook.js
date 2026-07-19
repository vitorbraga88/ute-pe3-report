/**
 * webhook.js — Client-side webhook handler for n8n integration
 * This file can also be served as a server-side endpoint via Node.js if needed.
 * Currently embedded in app.js; provided here as documentation reference.
 */

// Webhook URL: http://100.74.176.72:5678/webhook/ute-pe3-os
// Payload format matches the spec.

const WEBHOOK_URL = 'http://100.74.176.72:5678/webhook/ute-pe3-os';

// --- Example Fetch ---
// fetch(WEBHOOK_URL, {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({
//     os_number: "202607",
//     pts: "830-26",
//     descricao: "Troca de filtro de óleo",
//     local: "DG-06",
//     status: "Finalizado",
//     tecnicos: ["João Silva", "Carlos Santos"],
//     supervisor: "Vitor Braga",
//     data: "30/06/2026",
//     hora_inicial: "17:30:00",
//     hora_final: "21:30:00",
//     horimetro: 45870,
//     descricao_detalhada: "Filtro apresentava saturação...",
//     observacoes: "Óleo com aspecto normal",
//     assinatura: "base64...",
//     fotos: [{"base64": "...", "descricao": "Antes"}],
//     foto_pts: "base64..."
//   })
// });
