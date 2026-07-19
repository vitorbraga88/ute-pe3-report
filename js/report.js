/**
 * report.js — PDF generation for UTE-PE3 Report
 */
window.UTE_PE3 = window.UTE_PE3 || {};

UTE_PE3.Report = {
  /**
   * Generates a print-optimized HTML report and triggers print/save-as-PDF.
   * Uses window.print() which on mobile allows "Save as PDF".
   */
  generate(data) {
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      UTE_PE3.UI.toast('Permita popups para gerar o relatório', 'error');
      return null;
    }

    const html = this.buildHTML(data);
    reportWindow.document.write(html);
    reportWindow.document.close();

    // Wait for images to load, then trigger print
    reportWindow.onload = () => {
      setTimeout(() => reportWindow.print(), 500);
    };

    return reportWindow;
  },

  buildHTML(data) {
    const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const photosHTML = (data.fotos || []).map((f, i) => `
      <div class="photo-entry">
        <img src="${f.base64}" style="max-width:100%;height:auto;border:1px solid #ddd;border-radius:4px">
        <p style="font-size:10px;color:#666;margin-top:4px">${esc(f.descricao) || 'Foto ' + (i + 1)}</p>
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>OS_${esc(data.os_number)}_${esc(data.data || '').replace(/\//g, '-')}</title>
  <style>
    @page { margin: 12mm; size: A4; }
    body { font-family: 'Inter', Arial, sans-serif; color: #1f2937; font-size: 11px; line-height: 1.5; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .header { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #1e40af; padding-bottom: 12px; margin-bottom: 16px; }
    .header img { width: 50px; height: 50px; }
    .header h1 { font-size: 16px; color: #1e40af; margin: 0; }
    .header .sub { font-size: 10px; color: #6b7280; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .field { margin-bottom: 10px; }
    .field label { font-size: 8px; color: #6b7280; text-transform: uppercase; font-weight: 600; display: block; }
    .field .value { font-size: 11px; font-weight: 500; }
    .section-title { font-size: 13px; color: #1e40af; font-weight: 700; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin: 16px 0 10px; }
    .signature-img { max-width: 250px; height: auto; border: 1px solid #ddd; border-radius: 4px; }
    .photos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .photo-entry img { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 9px; font-weight: 600; }
    .status-Finalizado { background: #dcfce7; color: #166534; }
    .checklist { margin-top: 12px; }
    .checklist-item { display: flex; align-items: center; gap: 6px; font-size: 10px; margin-bottom: 4px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <!-- Page 1: Dados da OS -->
  <div class="page">
    <div class="header">
      <img src="${window.location.origin}/ute-pe3-report/assets/logo-ute.png" alt="UTE PE3">
      <div>
        <h1>UTE Pernambuco III</h1>
        <div class="sub">Relatório de Ordem de Serviço</div>
      </div>
    </div>

    <div class="grid">
      <div class="field"><label>OS Nº</label><div class="value">${esc(data.os_number)}</div></div>
      <div class="field"><label>PTS Nº</label><div class="value">${esc(data.pts)}</div></div>
      <div class="field"><label>Data</label><div class="value">${esc(data.data)}</div></div>
      <div class="field"><label>Status</label><div class="value"><span class="status-badge status-${esc(data.status)}">${esc(data.status)}</span></div></div>
      <div class="field"><label>Local / TAG</label><div class="value">${esc(data.local)}</div></div>
      <div class="field"><label>Supervisor</label><div class="value">${esc(data.supervisor)}</div></div>
      <div class="field"><label>Horário Inicial</label><div class="value">${esc(data.hora_inicial)}</div></div>
      <div class="field"><label>Horário Final</label><div class="value">${esc(data.hora_final)}</div></div>
      <div class="field"><label>Horímetro</label><div class="value">${esc(data.horimetro) || '—'}</div></div>
    </div>

    <div class="field" style="margin-top:8px">
      <label>Técnicos</label>
      <div class="value">${esc((data.tecnicos || []).join(', '))}</div>
    </div>

    <div class="section-title">Descrição</div>
    <div class="field"><label>Resumo</label><div class="value">${esc(data.descricao)}</div></div>
    ${data.descricao_resumida ? `<div class="field"><label>Resumo Técnico (IA)</label><div class="value">${esc(data.descricao_resumida)}</div></div>` : ''}
    <div class="field"><label>Descrição Detalhada</label><div class="value" style="white-space:pre-wrap">${esc(data.descricao_detalhada)}</div></div>

    ${data.observacoes ? `<div class="field"><label>Observações</label><div class="value">${esc(data.observacoes)}</div></div>` : ''}

    ${data.assinatura ? `
    <div class="section-title">Assinatura</div>
    <img src="${data.assinatura}" class="signature-img" alt="Assinatura digital">
    ` : ''}
  </div>

  <!-- Page 2: Relatório Fotográfico -->
  ${photosHTML ? `
  <div class="page">
    <div class="header">
      <div><h1>Relatório Fotográfico</h1></div>
    </div>
    <div class="photos-grid">${photosHTML}</div>
  </div>
  ` : ''}

  <!-- Page 3: Permissão de Trabalho -->
  ${data.foto_pts ? `
  <div class="page">
    <div class="header">
      <div><h1>Permissão de Trabalho — Anexo</h1></div>
    </div>
    <img src="${data.foto_pts}" style="max-width:100%;height:auto;border:1px solid #ddd;border-radius:4px" alt="PTS">
  </div>
  ` : ''}
</body>
</html>`;
  },

  /** Generate base64 PDF via print (alternative method) */
  async generateBase64(data) {
    // Use the print window approach — the actual base64 PDF generation
    // would need a server-side component (wkhtmltopdf, puppeteer).
    // For client-side, we rely on the browser's Save as PDF via print().
    // The n8n workflow handles server-side PDF generation.
    this.generate(data);
    return null;
  }
};
