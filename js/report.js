/**
 * report.js — PDF generation for UTE-PE3 Report
 */
window.UTE_PE3 = window.UTE_PE3 || {};

UTE_PE3.Report = {
  /** dd/mm/aaaa a partir do formato nativo yyyy-mm-dd */
  formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  },

  /**
   * Generates a print-optimized HTML report and triggers print/save-as-PDF.
   * Uses window.print() which on mobile allows "Save as PDF". Fallback method.
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

    const osList = esc((data.os_numbers || []).join(', '));
    const supervisorList = esc((data.supervisores || []).join(', '));
    const dataFormatada = esc(this.formatDate(data.data));

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>OS_${osList.replace(/, /g, '-')}_${dataFormatada.replace(/\//g, '-')}</title>
  <style>
    @page { margin: 12mm; size: A4; }
    body { font-family: 'Inter', Arial, sans-serif; color: #1f2937; font-size: 11px; line-height: 1.5; }
    .page { page-break-after: always; width: 100%; box-sizing: border-box; background: #fff; }
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
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <!-- Page 1: Dados da OS -->
  <div class="page" id="pdf-page-1">
    <div class="header">
      <img src="${window.location.origin}/ute-pe3-report/assets/logo-ute.png" alt="UTE PE3" crossorigin="anonymous">
      <div>
        <h1>UTE Pernambuco III</h1>
        <div class="sub">Relatório de Ordem de Serviço</div>
      </div>
    </div>

    <div class="grid">
      <div class="field"><label>OS Nº</label><div class="value">${osList || '—'}</div></div>
      <div class="field"><label>PTS Nº</label><div class="value">${esc(data.pts)}</div></div>
      <div class="field"><label>Data</label><div class="value">${dataFormatada}</div></div>
      <div class="field"><label>Status</label><div class="value"><span class="status-badge status-${esc(data.status)}">${esc(data.status)}</span></div></div>
      <div class="field"><label>Local / TAG</label><div class="value">${esc(data.local)}</div></div>
      <div class="field"><label>Supervisor(es)</label><div class="value">${supervisorList || '—'}</div></div>
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
  <div class="page" id="pdf-page-2">
    <div class="header">
      <div><h1>Relatório Fotográfico</h1></div>
    </div>
    <div class="photos-grid">${photosHTML}</div>
  </div>
  ` : ''}

  <!-- Page 3: Permissão de Trabalho -->
  ${data.foto_pts ? `
  <div class="page" id="pdf-page-3">
    <div class="header">
      <div><h1>Permissão de Trabalho — Anexo</h1></div>
    </div>
    <img src="${data.foto_pts}" style="max-width:100%;height:auto;border:1px solid #ddd;border-radius:4px" alt="PTS">
  </div>
  ` : ''}
</body>
</html>`;
  },

  /**
   * Gera um PDF real (base64, sem prefixo data:) renderizando o mesmo HTML
   * do relatório fora da tela com html2canvas e montando as páginas com jsPDF.
   * Usado para anexar/enviar o relatório (webhook → n8n → Telegram) e para
   * download local imediato.
   */
  async generatePDFBlob(data) {
    if (!window.html2canvas || !window.jspdf) {
      console.warn('html2canvas/jsPDF indisponíveis — pulando geração de PDF real');
      return null;
    }

    const html = this.buildHTML(data);

    // Renderiza o relatório fora da tela num iframe isolado
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-99999px';
    iframe.style.top = '0';
    iframe.style.width = '794px';   // ~ A4 a 96dpi
    iframe.style.height = '1123px';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    try {
      await new Promise((resolve) => {
        iframe.onload = resolve;
        iframe.srcdoc = html;
      });
      // Aguarda imagens (logo, fotos, assinatura) carregarem dentro do iframe
      const doc = iframe.contentDocument;
      const imgs = Array.from(doc.images);
      await Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise((res) => {
        img.onload = res;
        img.onerror = res;
      })));
      await new Promise((r) => setTimeout(r, 200));

      const pages = Array.from(doc.querySelectorAll('.page'));
      if (pages.length === 0) return null;

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageWidthMm = 210;
      const pageHeightMm = 297;

      for (let i = 0; i < pages.length; i++) {
        const canvas = await window.html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          windowWidth: 794,
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        const imgHeightMm = (canvas.height * pageWidthMm) / canvas.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, Math.min(imgHeightMm, pageHeightMm));
      }

      // dataUristring vem como "data:application/pdf;filename=...;base64,XXXX"
      const dataUri = pdf.output('datauristring');
      return dataUri.split(',')[1];
    } catch (e) {
      console.error('Erro ao gerar PDF real:', e);
      return null;
    } finally {
      document.body.removeChild(iframe);
    }
  },

  /** Dispara download local de um PDF base64 */
  downloadBase64(base64, filename) {
    try {
      const byteChars = atob(base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      console.warn('Erro ao baixar PDF localmente:', e.message);
    }
  }
};
