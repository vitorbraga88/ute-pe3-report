/**
 * relatorios.js — Página de busca/filtro de relatórios antigos (ordens_servico).
 * Consome GET /relatorios do save-server.py (paginado, filtros por querystring).
 */
window.UTE_PE3 = window.UTE_PE3 || {};

UTE_PE3.Relatorios = {
  PAGE_SIZE: 20,
  offset: 0,
  total: 0,

  get SAVE_BASE() {
    if (location.hostname.endsWith('.ts.net')) return '/ute-pe3-report/api';
    return `http://${location.hostname}:8087`;
  },

  escHtml(s) {
    return (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  collectFilters() {
    return {
      q: document.getElementById('f-q').value.trim(),
      os: document.getElementById('f-os').value.trim(),
      status: document.getElementById('f-status').value,
      supervisor: document.getElementById('f-supervisor').value.trim(),
      tecnico: document.getElementById('f-tecnico').value.trim(),
      data_de: document.getElementById('f-data-de').value,
      data_ate: document.getElementById('f-data-ate').value,
    };
  },

  limpar() {
    ['f-q', 'f-os', 'f-supervisor', 'f-tecnico', 'f-data-de', 'f-data-ate'].forEach((id) => {
      document.getElementById(id).value = '';
    });
    document.getElementById('f-status').value = '';
    this.buscar(true);
  },

  async buscar(reset) {
    if (reset) { this.offset = 0; document.getElementById('results-list').innerHTML = ''; }
    const filters = this.collectFilters();
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    params.set('limit', this.PAGE_SIZE);
    params.set('offset', this.offset);

    const loadMoreBtn = document.getElementById('load-more');
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Carregando...';

    try {
      const r = await fetch(`${this.SAVE_BASE}/relatorios?${params.toString()}`, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      this.total = j.total || 0;
      this.render(j.items || [], reset);
      this.offset += (j.items || []).length;

      document.getElementById('total-count').textContent =
        this.total > 0 ? `${this.total} relatório(s) encontrado(s)` : '';
      document.getElementById('empty-state').style.display = (this.offset === 0 && this.total === 0) ? 'block' : 'none';
      loadMoreBtn.style.display = this.offset < this.total ? 'block' : 'none';
    } catch (e) {
      UTE_PE3.UI.toast('Falha ao buscar relatórios: ' + e.message, 'error');
    } finally {
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = 'Carregar mais';
    }
  },

  formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  },

  render(items, reset) {
    const list = document.getElementById('results-list');
    if (reset) list.innerHTML = '';
    const html = items.map((r) => {
      const osTxt = (r.os_numbers || []).join(', ') || '—';
      const statusClass = r.status === 'Finalizado' ? 'status-finalizado'
        : r.status === 'Em Andamento' ? 'status-andamento' : 'status-aberto';
      const desc = r.descricao_resumida || r.descricao || '';
      return `
        <div class="result-item">
          <div class="result-top">
            <span class="result-os">OS ${this.escHtml(osTxt)}</span>
            <span class="status-badge ${statusClass}">${this.escHtml(r.status || '—')}</span>
          </div>
          <div class="result-meta">${this.formatDate(r.data)} · ${this.escHtml(r.local || '—')} · PTS ${this.escHtml(r.pts || '—')}</div>
          <div class="result-desc">${this.escHtml(desc)}</div>
          <div class="result-tags">Supervisor(es): ${this.escHtml((r.supervisores || []).join(', ') || '—')} · Técnico(s): ${this.escHtml((r.tecnicos || []).join(', ') || '—')}</div>
          <div class="result-actions">
            ${r.pdf_url ? `<a class="btn btn-primary btn-sm" href="${this.escHtml(r.pdf_url)}" target="_blank" rel="noopener">📄 Abrir PDF</a>` : ''}
          </div>
        </div>`;
    }).join('');
    list.insertAdjacentHTML('beforeend', html);
  },
};

UTE_PE3.UI = UTE_PE3.UI || {
  toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { el.remove(); }, 3500);
  }
};

document.addEventListener('DOMContentLoaded', () => UTE_PE3.Relatorios.buscar(true));
