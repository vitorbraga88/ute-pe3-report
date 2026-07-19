/**
 * app.js — Main orchestrator for UTE-PE3 Report
 */
window.UTE_PE3 = window.UTE_PE3 || {};

UTE_PE3.state = {
  os_numbers: [],
  tecnicos: [],
  supervisores: [],
  autocompleteCache: {
    local: [],
    tecnico: [],
    supervisor: []
  }
};

UTE_PE3.App = {
  /**
   * Base do webhook n8n, ciente da origem:
   * - via Caddy (ts.net): mesmo domínio → /webhook (sem CORS/cert)
   * - via :8086 direto (http): n8n direto na porta 5678 (sem TLS)
   */
  get WEBHOOK_BASE() {
    if (location.hostname.endsWith('.ts.net')) return '/webhook';
    return `http://${location.hostname}:5678/webhook`;
  },

  /** Initialize the application */
  init() {
    this.loadAutocompleteCache();
    this.setDefaultDate();
    this.setupMasks();
    this.initVoiceSupport();
    this.loadDrafts();
    this.monitorConnectivity();

    // Default supervisor
    UTE_PE3.state.supervisores = ['Vitor Braga'];
    this.renderSupervisores();

    // Init signature canvases (2 pads + memória)
    setTimeout(() => UTE_PE3.Signature.init(), 100);

    document.getElementById('os-form').addEventListener('submit', (e) => e.preventDefault());
  },

  // ─── Autocomplete ──────────────────────────

  loadAutocompleteCache() {
    try {
      const cache = JSON.parse(localStorage.getItem('ute-pe3-autocomplete') || '{}');
      UTE_PE3.state.autocompleteCache = {
        local: cache.local || [],
        tecnico: cache.tecnico || [],
        supervisor: cache.supervisor || ['Vitor Braga']
      };
    } catch (e) {
      // ignore corrupt cache
    }
  },

  saveAutocompleteCache() {
    localStorage.setItem('ute-pe3-autocomplete', JSON.stringify(UTE_PE3.state.autocompleteCache));
  },

  addToAutocomplete(field, value) {
    if (!value || !value.trim()) return;
    const list = UTE_PE3.state.autocompleteCache[field];
    if (!list.includes(value)) {
      list.unshift(value);
      if (list.length > 30) list.pop();
    }
    this.saveAutocompleteCache();
  },

  onAutocompleteInput(field) {
    const input = document.getElementById(field);
    const listEl = document.getElementById(`autocomplete-${field}`);
    if (!input || !listEl) return;

    const val = input.value.toLowerCase();
    const items = UTE_PE3.state.autocompleteCache[field] || [];
    const matches = items.filter((i) => i.toLowerCase().includes(val) && i !== val);

    if (matches.length === 0) {
      listEl.classList.remove('open');
      return;
    }

    listEl.innerHTML = matches.map((m) => `
      <div class="autocomplete-item" data-value="${this.escAttr(m)}">
        <span class="ac-value">${this.escHtml(m)}</span>
        <span class="ac-remove" title="Excluir sugestão">&times;</span>
      </div>`).join('');
    listEl.classList.add('open');

    listEl.querySelectorAll('.autocomplete-item').forEach((item) => {
      item.querySelector('.ac-value').addEventListener('click', () => {
        input.value = item.dataset.value;
        listEl.classList.remove('open');
      });
      item.querySelector('.ac-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeFromAutocomplete(field, item.dataset.value);
      });
    });
  },

  /** Exclui um valor memorizado (digitação errada) */
  removeFromAutocomplete(field, value) {
    const list = UTE_PE3.state.autocompleteCache[field] || [];
    const idx = list.indexOf(value);
    if (idx >= 0) list.splice(idx, 1);
    this.saveAutocompleteCache();
    this.onAutocompleteInput(field);
    UTE_PE3.UI.toast('Sugestão removida', 'info');
  },

  // ─── Técnicos ──────────────────────────

  addTecnico() {
    const input = document.getElementById('tecnico');
    const name = input.value.trim();
    if (!name) return;

    if (!UTE_PE3.state.tecnicos.includes(name)) {
      UTE_PE3.state.tecnicos.push(name);
      this.addToAutocomplete('tecnico', name);
    }
    input.value = '';
    UTE_PE3.Validation.clearError('tecnico');
    document.getElementById(`autocomplete-tecnico`).classList.remove('open');
    this.renderTecnicos();
  },

  removeTecnico(index) {
    UTE_PE3.state.tecnicos.splice(index, 1);
    this.renderTecnicos();
  },

  renderTecnicos() {
    const list = document.getElementById('tecnicos-list');
    if (!list) return;

    list.innerHTML = UTE_PE3.state.tecnicos.map((t, i) => `
      <span class="tag">${this.escHtml(t)} <span class="remove-tag" onclick="UTE_PE3.App.removeTecnico(${i})">&times;</span></span>
    `).join('');
  },

  // ─── OS (múltiplas, sem autocomplete/localStorage) ────

  addOS() {
    const input = document.getElementById('os_number');
    const num = input.value.trim();
    if (!/^\d{6}$/.test(num)) {
      UTE_PE3.Validation.showError('os_number', 'Exatamente 6 dígitos numéricos');
      return;
    }

    if (!UTE_PE3.state.os_numbers.includes(num)) {
      UTE_PE3.state.os_numbers.push(num);
    }
    input.value = '';
    UTE_PE3.Validation.clearError('os_number');
    this.renderOS();
  },

  removeOS(index) {
    UTE_PE3.state.os_numbers.splice(index, 1);
    this.renderOS();
  },

  renderOS() {
    const list = document.getElementById('os-list');
    if (!list) return;

    list.innerHTML = UTE_PE3.state.os_numbers.map((n, i) => `
      <span class="tag">${this.escHtml(n)} <span class="remove-tag" onclick="UTE_PE3.App.removeOS(${i})">&times;</span></span>
    `).join('');
  },

  // ─── Supervisor(es) (múltiplos, com autocomplete/localStorage) ────

  addSupervisor() {
    const input = document.getElementById('supervisor');
    const name = input.value.trim();
    if (!name) return;

    if (!UTE_PE3.state.supervisores.includes(name)) {
      UTE_PE3.state.supervisores.push(name);
      this.addToAutocomplete('supervisor', name);
    }
    input.value = '';
    UTE_PE3.Validation.clearError('supervisor');
    document.getElementById('autocomplete-supervisor').classList.remove('open');
    this.renderSupervisores();
  },

  removeSupervisor(index) {
    UTE_PE3.state.supervisores.splice(index, 1);
    this.renderSupervisores();
  },

  renderSupervisores() {
    const list = document.getElementById('supervisores-list');
    if (!list) return;

    list.innerHTML = UTE_PE3.state.supervisores.map((s, i) => `
      <span class="tag">${this.escHtml(s)} <span class="remove-tag" onclick="UTE_PE3.App.removeSupervisor(${i})">&times;</span></span>
    `).join('');
  },

  // ─── Masks ──────────────────────────────

  setDefaultDate() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    document.getElementById('data').value = `${yyyy}-${mm}-${dd}`;
  },

  setupMasks() {
    // OS number — digits only, max 6
    document.getElementById('os_number').addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
      UTE_PE3.Validation.clearError('os_number');
    });
    document.getElementById('os_number').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.addOS(); }
    });

    // PTS — auto-append -YY on blur (not input) to avoid double-append
    document.getElementById('pts').addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^\d-]/g, '');
      UTE_PE3.Validation.clearError('pts');
    });
    document.getElementById('pts').addEventListener('blur', (e) => {
      let v = e.target.value.trim();
      if (/^\d+$/.test(v) && v.length >= 3) {
        const yy = String(new Date().getFullYear()).slice(-2);
        e.target.value = v + '-' + yy;
      }
    });

    // Data/Hora — inputs nativos type=date/time cuidam do formato; só limpar erro
    document.getElementById('data').addEventListener('input', () => UTE_PE3.Validation.clearError('data'));
    document.getElementById('hora_inicial').addEventListener('input', () => UTE_PE3.Validation.clearError('hora_inicial'));
    document.getElementById('hora_final').addEventListener('input', () => UTE_PE3.Validation.clearError('hora_final'));

    // Close autocomplete on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-wrapper')) {
        document.querySelectorAll('.autocomplete-list').forEach((el) => el.classList.remove('open'));
      }
    });

    // Enter key on tecnico input → add
    document.getElementById('tecnico').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.addTecnico(); }
    });

    // Enter key on supervisor input → add
    document.getElementById('supervisor').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.addSupervisor(); }
    });
  },

  // ─── Voice Input ──────────────────────────

  initVoiceSupport() {
    const btn = document.getElementById('voice-btn');
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      if (btn) btn.style.display = 'none';
      return;
    }
    this.recognition = null;
  },

  toggleVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    if (this.recognition) {
      this.recognition.stop();
      return;
    }

    this.recognition = new SR();
    this.recognition.lang = 'pt-BR';
    this.recognition.interimResults = true;
    this.recognition.continuous = true;

    const btn = document.getElementById('voice-btn');
    const textarea = document.getElementById('descricao_detalhada');

    this.recognition.onstart = () => { btn.classList.add('recording'); btn.textContent = '⏹'; };
    this.recognition.onend = () => { btn.classList.remove('recording'); btn.textContent = '🎤'; this.recognition = null; };
    this.recognition.onerror = () => { btn.classList.remove('recording'); btn.textContent = '🎤'; this.recognition = null; };

    this.recognition.onresult = (e) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      textarea.value = transcript;
    };

    this.recognition.start();
  },

  // ─── Save Draft ──────────────────────────

  async saveDraft() {
    this.flushPendingInputs();
    const data = this.collectFormData();
    if (!data.os_numbers.length && !data.pts && !data.descricao) {
      UTE_PE3.UI.toast('Preencha ao menos um campo (OS, PTS ou descrição)', 'error');
      return;
    }

    try {
      await UTE_PE3.Offline.saveDraft(data);
      UTE_PE3.UI.toast('Rascunho salvo!', 'success');
      this.loadDrafts();
    } catch (e) {
      UTE_PE3.UI.toast('Erro ao salvar rascunho', 'error');
    }
  },

  /** Confirma valores digitados mas não adicionados com "+" */
  flushPendingInputs() {
    const os = document.getElementById('os_number').value.trim();
    if (/^\d{6}$/.test(os)) this.addOS();
    if (document.getElementById('tecnico').value.trim()) this.addTecnico();
    if (document.getElementById('supervisor').value.trim()) this.addSupervisor();
  },

  // ─── Load Drafts ─────────────────────────

  async loadDrafts() {
    try {
      const drafts = await UTE_PE3.Offline.getDrafts();
      const section = document.getElementById('drafts-section');
      const list = document.getElementById('drafts-list');

      if (drafts.length === 0) { section.style.display = 'none'; return; }

      section.style.display = 'block';
      list.innerHTML = drafts.map((d) => `
        <div class="draft-item" onclick="UTE_PE3.App.loadDraft(${d.id})">
          <div class="draft-info">
            <div class="draft-id">OS ${this.escHtml((d.os_numbers || []).join(', ') || d.os_number || '—')}${d.status === 'Enviado' ? ' ✅' : ''}</div>
            <div class="draft-date">${new Date(d.created_at).toLocaleDateString('pt-BR')} — ${this.escHtml(d.descricao || '')}</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();UTE_PE3.App.deleteDraft(${d.id})">🗑</button>
        </div>
      `).join('');
    } catch (e) {
      // IndexedDB may not be available
    }
  },

  async loadDraft(id) {
    try {
      const draft = await UTE_PE3.Offline.getDraft(id);
      if (!draft) return;

      this.populateForm(draft);
      UTE_PE3.UI.toast('Rascunho carregado', 'info');
    } catch (e) {
      UTE_PE3.UI.toast('Erro ao carregar rascunho', 'error');
    }
  },

  async deleteDraft(id) {
    try {
      await UTE_PE3.Offline.deleteDraft(id);
      this.loadDrafts();
      UTE_PE3.UI.toast('Rascunho removido', 'info');
    } catch (e) {
      UTE_PE3.UI.toast('Erro ao remover', 'error');
    }
  },

  // ─── Populate Form ────────────────────────

  populateForm(data) {
    const fields = ['pts', 'descricao', 'local', 'status',
                    'data', 'hora_inicial', 'hora_final', 'horimetro',
                    'descricao_detalhada', 'descricao_ia', 'observacoes'];
    fields.forEach((f) => {
      const el = document.getElementById(f);
      if (el && data[f] !== undefined) el.value = data[f] || '';
    });
    this.syncStatusButtons(data.status || 'Aberto');

    // OS múltiplas
    UTE_PE3.state.os_numbers = data.os_numbers || (data.os_number ? [data.os_number] : []);
    this.renderOS();

    // Técnicos
    UTE_PE3.state.tecnicos = data.tecnicos || [];
    this.renderTecnicos();

    // Supervisor(es)
    UTE_PE3.state.supervisores = data.supervisores || (data.supervisor ? [data.supervisor] : []);
    this.renderSupervisores();

    // Photos
    UTE_PE3.Camera.photos = data.fotos || [];
    UTE_PE3.Camera.renderPhotos();
    UTE_PE3.Camera.ptsPhoto = data.foto_pts || null;
    UTE_PE3.Camera.renderPTSPhoto();
  },

  // ─── Status (segmented control) ───────────

  setStatus(btn, value) {
    document.getElementById('status').value = value;
    btn.parentElement.querySelectorAll('.seg-option').forEach((b) => {
      b.setAttribute('aria-pressed', String(b === btn));
    });
  },

  syncStatusButtons(value) {
    const el = document.getElementById('status');
    if (el) el.value = value;
    document.querySelectorAll('.segmented .seg-option').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.textContent.trim() === value));
    });
  },

  // ─── Finalize ────────────────────────────

  async finalize() {
    this.flushPendingInputs();

    if (!UTE_PE3.Validation.validateAll()) {
      UTE_PE3.UI.toast('Corrija os campos com erro', 'error');
      return;
    }

    if (!UTE_PE3.Camera.ptsPhoto) {
      document.getElementById('error-foto_pts').textContent = 'Foto da PTS é obrigatória';
      document.getElementById('error-foto_pts').classList.add('visible');
      UTE_PE3.UI.toast('Foto da PTS é obrigatória', 'error');
      return;
    }

    if (!UTE_PE3.Signature.hasSignature()) {
      UTE_PE3.UI.toast('Assinatura 1 é obrigatória', 'error');
      return;
    }

    const data = this.collectFormData();

    const btn = document.getElementById('btn-finalize');
    btn.disabled = true;

    try {
      // Gerar PDF real (blob base64) via jsPDF + html2canvas
      btn.innerHTML = '<span class="spinner"></span> Gerando PDF...';
      const filename = `OS_${(data.os_numbers || []).join('-') || 'sem-numero'}_${(data.data || '').replace(/-/g, '')}.pdf`;
      const pdfBase64 = await UTE_PE3.Report.generatePDFBlob(data);
      data.pdf_base64 = pdfBase64;
      data.pdf_filename = filename;

      // Enviar ao n8n (inclui o PDF)
      btn.innerHTML = '<span class="spinner"></span> Enviando...';
      const result = await this.sendToWebhook(data);

      // Guarda o relatório como rascunho para edição futura
      data.status = result.ok ? 'Enviado' : 'Finalizado';
      this.syncStatusButtons(data.status === 'Enviado' ? 'Finalizado' : data.status);
      try { await UTE_PE3.Offline.saveDraft(data); } catch (e) { /* IndexedDB indisponível */ }

      if (result.ok) {
        UTE_PE3.UI.toast('✅ Relatório gerado e enviado!', 'success');
      } else if (result.error) {
        UTE_PE3.UI.toast(`Falha no envio (${result.error}) — salvo para reenvio automático`, 'error');
      } else {
        UTE_PE3.UI.toast('Sem conexão — salvo para envio automático', 'info');
      }

      // Download local do PDF gerado
      if (pdfBase64) UTE_PE3.Report.downloadBase64(pdfBase64, filename);

      // Memoriza valores para autocomplete
      this.addToAutocomplete('local', data.local);
      (data.supervisores || []).forEach((s) => this.addToAutocomplete('supervisor', s));
      this.saveAutocompleteCache();

      this.loadDrafts();

      // Sucesso: limpa o formulário para um novo relatório
      if (result.ok) this.resetForm();
    } catch (e) {
      UTE_PE3.UI.toast('Erro ao finalizar: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '✅ Finalizar';
    }
  },

  /** Limpa todas as entradas para um novo relatório */
  resetForm() {
    ['pts', 'descricao', 'local', 'horimetro', 'descricao_detalhada', 'descricao_ia',
     'observacoes', 'os_number', 'tecnico', 'supervisor', 'hora_inicial', 'hora_final'].forEach((f) => {
      const el = document.getElementById(f);
      if (el) el.value = '';
    });
    UTE_PE3.state.os_numbers = [];
    UTE_PE3.state.tecnicos = [];
    UTE_PE3.state.supervisores = [];
    this.renderOS();
    this.renderTecnicos();
    this.renderSupervisores();
    UTE_PE3.Camera.photos = [];
    UTE_PE3.Camera.renderPhotos();
    UTE_PE3.Camera.ptsPhoto = null;
    UTE_PE3.Camera.renderPTSPhoto();
    UTE_PE3.Signature.clearAll();
    this.setDefaultDate();
    this.syncStatusButtons('Aberto');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // ─── IA: revisar Descrição Detalhada ──────

  async aiReview() {
    const texto = document.getElementById('descricao_detalhada').value.trim();
    if (texto.length < 10) {
      UTE_PE3.UI.toast('Escreva a Descrição Detalhada primeiro (mín. 10 caracteres)', 'error');
      return;
    }
    const btn = document.getElementById('btn-ai');
    const prev = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Revisando...';
    try {
      const r = await fetch(`${this.WEBHOOK_BASE}/ute-pe3-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
        signal: AbortSignal.timeout(60000)
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (!j.texto) throw new Error('resposta vazia da IA');
      document.getElementById('descricao_ia').value = j.texto;
      UTE_PE3.UI.toast('Texto revisado pela IA — edite se necessário', 'success');
    } catch (e) {
      UTE_PE3.UI.toast('Falha na revisão IA: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = prev;
    }
  },

  // ─── Collect Form Data ────────────────────

  collectFormData() {
    return {
      os_numbers: [...UTE_PE3.state.os_numbers],
      pts: document.getElementById('pts').value.trim(),
      descricao: document.getElementById('descricao').value.trim(),
      local: document.getElementById('local').value.trim(),
      status: document.getElementById('status').value,
      tecnicos: [...UTE_PE3.state.tecnicos],
      supervisores: [...UTE_PE3.state.supervisores],
      data: document.getElementById('data').value.trim(),
      hora_inicial: document.getElementById('hora_inicial').value.trim(),
      hora_final: document.getElementById('hora_final').value.trim(),
      horimetro: document.getElementById('horimetro').value.trim(),
      descricao_detalhada: document.getElementById('descricao_detalhada').value.trim(),
      descricao_ia: document.getElementById('descricao_ia').value.trim(),
      observacoes: document.getElementById('observacoes').value.trim(),
      assinatura: UTE_PE3.Signature.getData(),
      assinaturas: UTE_PE3.Signature.getAll(),
      fotos: [...UTE_PE3.Camera.photos],
      foto_pts: UTE_PE3.Camera.ptsPhoto,
    };
  },

  // ─── Webhook (n8n) ────────────────────────

  async sendToWebhook(data) {
    const payload = {
      os_numbers: data.os_numbers,
      pts: data.pts,
      descricao: data.descricao,
      local: data.local,
      status: 'Finalizado',
      tecnicos: data.tecnicos,
      supervisores: data.supervisores,
      data: data.data,
      hora_inicial: data.hora_inicial,
      hora_final: data.hora_final,
      horimetro: data.horimetro,
      descricao_detalhada: data.descricao_detalhada,
      descricao_ia: data.descricao_ia || null,
      observacoes: data.observacoes,
      assinatura: data.assinatura,
      assinaturas: data.assinaturas || [],
      fotos: data.fotos,
      foto_pts: data.foto_pts,
      pdf_base64: data.pdf_base64 || null,
      pdf_filename: data.pdf_filename || null
    };

    try {
      const response = await fetch(`${this.WEBHOOK_BASE}/ute-pe3-os`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120000)
      });

      if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
      return { ok: true };
    } catch (e) {
      console.warn('Webhook unreachable (offline?):', e.message);
      return { ok: false };
    }
  },


  // ─── Connectivity ─────────────────────────

  monitorConnectivity() {
    const badge = document.getElementById('offline-badge');
    const update = () => {
      if (navigator.onLine) {
        badge.classList.remove('visible');
        this.syncPendingDrafts();
      } else {
        badge.classList.add('visible');
      }
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  },

  async syncPendingDrafts() {
    try {
      const drafts = await UTE_PE3.Offline.getDrafts();
      const pending = drafts.filter((d) => d.status === 'Finalizado');

      for (const draft of pending) {
        const sent = await this.sendToWebhook(draft);
        if (sent.ok) await UTE_PE3.Offline.deleteDraft(draft.id);
      }

      if (pending.length > 0) {
        UTE_PE3.UI.toast(`${pending.length} OS sincronizada(s)`, 'success');
        this.loadDrafts();
      }
    } catch (e) {
      // ignore sync errors
    }
  },

  // ─── Utilities ────────────────────────────

  escHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  escAttr(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
};

// ─── UI Helpers ──────────────────────────────

UTE_PE3.UI = {
  toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { el.remove(); }, 3500);
  }
};

// ─── Boot ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => UTE_PE3.App.init());
