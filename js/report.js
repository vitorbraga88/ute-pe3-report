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
    const esc = (s) => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const osList = esc((data.os_numbers || []).join(' · ') || '—');
    const dataFmt = esc(this.formatDate(data.data));
    const status = data.status || 'Aberto';
    const localTag = esc(data.local || '—');
    const pts = esc(data.pts || '—');
    const hIni = esc(data.hora_inicial || '—');
    const hFim = esc(data.hora_final || '—');
    const horim = esc(data.horimetro || '—');
    const supervisores = esc((data.supervisores || []).join(', ') || '—');
    const tecnicos = data.tecnicos || [];
    const resumo = esc(data.descricao || '');
    const texto = esc(data.descricao_ia || data.descricao_resumida || data.descricao_detalhada || '');
    const recomendacoes = Array.isArray(data.recomendacoes) ? data.recomendacoes.filter((r) => r && r.trim()) : [];
    const observacoes = esc(data.observacoes || '');
    const fotos = data.fotos || [];
    const fotoPts = data.foto_pts;
    const assinaturas = (data.assinaturas && data.assinaturas.length)
      ? data.assinaturas
      : [{ nome: data.supervisor || '', img: data.assinatura }];
    const logoSrc = new URL('assets/logo-ute.png', window.location.href).href;
    const logoReportSrc = new URL('assets/logo_report.png', window.location.href).href;

    // Assinaturas: garante 2 slots (esquerda = principal, direita = técnico/2ª)
    const sig1 = assinaturas[0] || { nome: '', img: null };
    const sig2 = assinaturas[1] || { nome: '', img: null };
    const sigHTML = `
      <section class="sec">
        <div class="sec-h"><h2>Assinaturas</h2></div>
        <div class="assin">
          <div class="sig">
            <div class="pad">${sig1.img ? `<img src="${sig1.img}" alt="Assinatura">` : ''}</div>
            <div class="ln"></div>
            <div class="nm">${esc(sig1.nome) || '&nbsp;'}</div>
          </div>
          <div class="sig">
            <div class="pad">${sig2.img ? `<img src="${sig2.img}" alt="Assinatura">` : ''}</div>
            <div class="ln"></div>
            <div class="nm">${esc(sig2.nome) || 'Técnico'}</div>
          </div>
        </div>
      </section>`;

    // Paginação de fotos: 4 por página (2x2); assinaturas vão na última página de fotos
    const PER = 4;
    const chunks = [];
    if (fotos.length === 0) {
      chunks.push([]);
    } else {
      for (let i = 0; i < fotos.length; i += PER) chunks.push(fotos.slice(i, i + PER));
    }
    const numFotoPages = chunks.length;
    const totalPages = 1 + numFotoPages + (fotoPts ? 1 : 0);

    const fotoPagesHTML = chunks.map((chunk, idx) => {
      const isLast = idx === chunks.length - 1;
      const boxes = chunk.length === 0
        ? `<p style="color:var(--muted);font-size:10pt;padding:4mm 0">Nenhum registro fotográfico.</p>`
        : chunk.map((f, j) => `
          <figure class="foto">
            <div class="ph"><img src="${f.base64}" alt="${esc(f.descricao || 'Foto')}"></div>
            <figcaption><span class="fn">${String(idx * PER + j + 1).padStart(2, '0')}</span>${esc(f.descricao || '')}</figcaption>
          </figure>`).join('');
      return `
  <section class="page">
    <header class="band band--slim">
      <div class="logo-box"><img src="${logoSrc}" alt="UTE PE3"></div>
      <div class="band-center">
        <span class="kicker">OS ${osList} — ${dataFmt}</span>
        <h1>Relatório Fotográfico</h1>
        <div class="count mono" style="margin-top:1.6mm">${String(fotos.length).padStart(2, '0')} registros</div>
      </div>
      <div class="logo-box"><img src="${logoReportSrc}" alt="Relatório"></div>
    </header>
    <div class="content">
      <div class="fotos">${boxes}</div>
      ${isLast ? sigHTML : ''}
    </div>
    <footer class="foot">
      <span>UTE Pernambuco III — Relatório de Ordem de Serviço</span>
      <span class="mono">OS ${osList}</span>
      <span>Página ${1 + idx + 1} de ${totalPages}</span>
    </footer>
  </section>`;
    }).join('');

    const ptsPageHTML = fotoPts ? `
  <section class="page page--fixa">
    <header class="band band--slim">
      <div class="logo-box"><img src="${logoSrc}" alt="UTE PE3"></div>
      <div class="band-center">
        <span class="kicker">OS ${osList} — ${dataFmt}</span>
        <h1>Permissão de Trabalho</h1>
        <div class="os-tag os-tag--sm"><span class="lbl">PTS Nº</span><span class="val mono">${pts}</span></div>
      </div>
      <div class="logo-box"><img src="${logoReportSrc}" alt="Relatório"></div>
    </header>
    <div class="content">
      <div class="pts-frame"><img src="${fotoPts}" alt="PTS ${pts}"></div>
      <p class="pts-cap">Anexo — registro da Permissão de Trabalho de Segurança Nº ${pts}</p>
    </div>
    <footer class="foot">
      <span>UTE Pernambuco III — Relatório de Ordem de Serviço</span>
      <span class="mono">OS ${osList}</span>
      <span>Página ${totalPages} de ${totalPages}</span>
    </footer>
  </section>` : '';

    const tecnicosChips = tecnicos.length
      ? tecnicos.map((t) => `<span class="chip">${esc(t)}</span>`).join('')
      : '<span class="chip">—</span>';

    const recomendacoesHTML = recomendacoes.length ? `
      <section class="sec">
        <div class="sec-h"><h2>Recomendações Técnicas</h2></div>
        <ul class="recomendacoes" style="list-style:none;padding:0">
          ${recomendacoes.map((r) => `
          <li style="display:flex;gap:3mm;align-items:flex-start;padding:2mm 0;border-bottom:1px solid var(--line)">
            <span style="color:var(--lime);font-weight:700;flex-shrink:0">→</span>
            <span style="font-size:9.5pt;line-height:1.5">${esc(r)}</span>
          </li>`).join('')}
        </ul>
      </section>` : '';

    const observacoesHTML = observacoes ? `
      <section class="sec">
        <div class="sec-h"><h2>Observações</h2></div>
        <p class="texto">${observacoes}</p>
      </section>` : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>OS ${osList} — Relatório de Ordem de Serviço</title>
<style>
  :root{
    --navy:#0B1D2E; --navy2:#143252; --lime:#A6CE26; --lime-ink:#5C7710;
    --ink:#1C2733; --muted:#5F6E7C; --line:#DFE5EA; --soft:#F4F7F9; --bg:#E7EBEE;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{background:var(--bg);font-family:'IBM Plex Sans',-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:var(--ink);font-size:10pt;line-height:1.55}
  .mono{font-family:'IBM Plex Mono',ui-monospace,Consolas,monospace}
  img{display:block}
  .page{width:210mm;min-height:297mm;background:#fff;margin:8mm auto;box-shadow:0 3px 26px rgba(11,29,46,.16);display:flex;flex-direction:column;overflow:hidden}
  .page--fixa{height:297mm}
  .band{background:linear-gradient(115deg,var(--navy) 0%,var(--navy2) 100%);color:#fff;padding:8mm 14mm;display:flex;align-items:center;gap:6mm;border-bottom:1.8mm solid var(--lime)}
  .band--slim{padding:5mm 14mm;border-bottom-width:1.2mm;gap:4.5mm}
  .brand{height:21mm;width:21mm;object-fit:contain}
  .band--slim .brand{height:13mm;width:13mm}
  .logo-box{background:#fff;border-radius:2mm;padding:1.5mm;height:23mm;width:23mm;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .logo-box img{max-height:100%;max-width:100%;object-fit:contain}
  .band--slim .logo-box{height:14mm;width:14mm}
  .band-center{flex:1;min-width:0;text-align:center}
  .band-center .os-tag{margin-top:2.2mm;display:inline-block}
  .kicker{display:block;font-size:7.2pt;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:var(--lime);margin-bottom:1.4mm}
  .band h1{font-family:'Saira','IBM Plex Sans',sans-serif;font-size:16pt;font-weight:700;letter-spacing:.015em;line-height:1.12}
  .band--slim h1{font-size:12.5pt}
  .band .right{margin-left:auto}
  .count{font-size:8.5pt;color:#C7D3DD;letter-spacing:.08em}
  .os-tag{border:1px solid rgba(166,206,38,.55);background:rgba(166,206,38,.10);border-radius:2mm;padding:2.4mm 4mm;text-align:center}
  .os-tag .lbl{display:block;font-size:6.6pt;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--lime);margin-bottom:.8mm}
  .os-tag .val{font-size:12pt;font-weight:600;color:#fff;white-space:nowrap}
  .os-tag--sm{padding:1.8mm 3.4mm}
  .os-tag--sm .val{font-size:10.5pt}
  .content{padding:8mm 14mm 0;flex:1;display:flex;flex-direction:column;min-height:0}
  .meta{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:2.5mm;overflow:hidden}
  .cell{padding:3.2mm 4mm;border-bottom:1px solid var(--line);border-right:1px solid var(--line)}
  .cell:nth-child(4n){border-right:0}
  .cell--wide{grid-column:1/-1;border-right:0;border-bottom:0}
  .lbl{display:block;font-size:6.6pt;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:1.1mm}
  .val{font-size:10.5pt;font-weight:600;color:var(--navy)}
  .pill{display:inline-flex;align-items:center;gap:1.8mm;background:var(--navy);color:#fff;font-size:7.8pt;font-weight:600;letter-spacing:.1em;text-transform:uppercase;padding:1.3mm 3.4mm;border-radius:99px}
  .pill i{width:2.1mm;height:2.1mm;border-radius:50%;background:var(--lime)}
  .chips{display:flex;flex-wrap:wrap;gap:2mm;margin-top:.4mm}
  .chip{background:var(--soft);border:1px solid var(--line);border-radius:99px;padding:1.1mm 3.6mm;font-size:9pt;font-weight:500}
  .sec{margin-top:7mm}
  .sec-h{display:flex;align-items:center;gap:3mm;border-bottom:1px solid var(--line);padding-bottom:2.2mm;margin-bottom:3.8mm}
  .sec-h::before{content:'';width:1.7mm;height:4.4mm;background:var(--lime);border-radius:.6mm}
  .sec-h h2{font-family:'Saira','IBM Plex Sans',sans-serif;font-size:10.5pt;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--navy)}
  .resumo{font-size:11.5pt;font-weight:600;color:var(--navy);margin-bottom:2.2mm}
  .texto{line-height:1.65;max-width:180mm;white-space:pre-wrap}
  .foot{margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:4mm;border-top:1px solid var(--line);padding:3.4mm 14mm 6.5mm;font-size:7.2pt;color:var(--muted);letter-spacing:.05em}
  .fotos{display:grid;grid-template-columns:1fr 1fr;gap:5mm}
  .foto{border:1px solid var(--line);border-radius:2.5mm;overflow:hidden;background:#fff;break-inside:avoid}
  .foto .ph{aspect-ratio:4/3;background:var(--soft)}
  .foto .ph img{width:100%;height:100%;object-fit:cover}
  .foto figcaption{display:flex;align-items:center;gap:2.6mm;border-top:1px solid var(--line);background:var(--soft);padding:2.2mm 3.2mm;font-size:8.8pt;font-weight:500}
  .fn{font-family:'IBM Plex Mono',monospace;font-size:7.6pt;font-weight:600;color:var(--lime-ink);background:#EEF5D4;border:1px solid #D4E39A;border-radius:1.2mm;padding:.3mm 1.8mm}
  .assin{display:grid;grid-template-columns:1fr 1fr;gap:10mm;padding:0 6mm}
  .sig .pad{height:24mm;display:flex;align-items:flex-end;justify-content:center;padding-bottom:1mm}
  .sig .pad img{max-height:22mm;max-width:75%;width:auto;object-fit:contain}
  .sig .ln{border-top:1px solid #9AA7B2;margin:0 4mm 2mm}
  .sig .nm{text-align:center;font-size:10pt;font-weight:600;color:var(--navy)}
  .pts-frame{flex:1;min-height:0;max-height:224mm;border:1px solid var(--line);border-radius:2.5mm;background:var(--soft);display:flex;align-items:center;justify-content:center;padding:5mm;overflow:hidden}
  .pts-frame img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;border-radius:1.5mm;box-shadow:0 1px 8px rgba(11,29,46,.18)}
  .pts-cap{text-align:center;font-size:8pt;color:var(--muted);margin:3mm 0 0}
  .recomendacoes li:last-child{border-bottom:none}
</style>
</head>
<body>
<section class="page">
  <header class="band">
    <div class="logo-box"><img src="${logoSrc}" alt="UTE PE3"></div>
    <div class="band-center">
      <span class="kicker">UTE Pernambuco III · Manutenção</span>
      <h1>Relatório de Ordem de Serviço</h1>
      <div class="os-tag"><span class="lbl">OS Nº</span><span class="val mono">${osList}</span></div>
    </div>
    <div class="logo-box"><img src="${logoReportSrc}" alt="Relatório"></div>
  </header>
  <div class="content">
    <div class="meta">
      <div class="cell"><span class="lbl">Data</span><span class="val mono">${dataFmt}</span></div>
      <div class="cell"><span class="lbl">Status</span><span class="pill"><i></i>${status}</span></div>
      <div class="cell"><span class="lbl">Local / TAG</span><span class="val">${localTag}</span></div>
      <div class="cell"><span class="lbl">PTS Nº</span><span class="val mono">${pts}</span></div>
      <div class="cell"><span class="lbl">Horário inicial</span><span class="val mono">${hIni}</span></div>
      <div class="cell"><span class="lbl">Horário final</span><span class="val mono">${hFim}</span></div>
      <div class="cell"><span class="lbl">Horímetro</span><span class="val mono">${horim}</span></div>
      <div class="cell"><span class="lbl">Supervisor</span><span class="val">${supervisores}</span></div>
      <div class="cell cell--wide"><span class="lbl">Técnicos executantes</span><div class="chips">${tecnicosChips}</div></div>
    </div>

    <section class="sec">
      <div class="sec-h"><h2>Descrição da Atividade</h2></div>
      <p class="resumo">${resumo}</p>
      <p class="texto">${texto}</p>
    </section>

    ${recomendacoesHTML}
    ${observacoesHTML}
  </div>
  <footer class="foot">
    <span>UTE Pernambuco III — Relatório de Ordem de Serviço</span>
    <span class="mono">OS ${osList}</span>
    <span>Página 1 de ${totalPages}</span>
  </footer>
</section>

<!-- ═══ PÁGINAS · RELATÓRIO FOTOGRÁFICO + ASSINATURAS ═══ -->
${fotoPagesHTML}

<!-- ═══ PÁGINA FINAL · ANEXO PTS ═══ -->
${ptsPageHTML}

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

        // Nova página física para cada seção (exceto a primeira)
        if (i > 0) pdf.addPage();

        // Uma página PDF por .page: se a seção ultrapassar A4, escala para caber
        // (preserva aspecto, centraliza). Nunca gera página em branco.
        if (imgHeightMm <= pageHeightMm) {
          pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, imgHeightMm);
        } else {
          const scale = pageHeightMm / imgHeightMm;
          const drawW = pageWidthMm * scale;
          pdf.addImage(imgData, 'JPEG', (pageWidthMm - drawW) / 2, 0, drawW, pageHeightMm);
        }
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
