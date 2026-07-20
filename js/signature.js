/**
 * signature.js — Assinaturas digitais (2 pads) com memória por nome.
 * Assinaturas salvas ficam em localStorage ('ute-pe3-assinaturas': {nome: dataURL}).
 * Digitar um nome já salvo insere a assinatura automaticamente no pad.
 */
window.UTE_PE3 = window.UTE_PE3 || {};

UTE_PE3.Signature = {
  pads: {},          // n -> { canvas, ctx, data }
  STORE_KEY: 'ute-pe3-assinaturas',

  init() {
    [1, 2].forEach((n) => this.initPad(n));
    this.renderStored();
    this.syncFromDB();   // sincroniza assinaturas salvas no .db (cross-device)
  },

  initPad(n) {
    const canvas = document.getElementById(`signature-canvas-${n}`);
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const pad = { canvas, ctx, data: null, drawing: false };
    this.pads[n] = pad;

    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: cx - r.left, y: cy - r.top };
    };
    const start = (e) => {
      e.preventDefault();
      pad.drawing = true;
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };
    const move = (e) => {
      if (!pad.drawing) return;
      e.preventDefault();
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    const end = () => {
      if (!pad.drawing) return;
      pad.drawing = false;
      pad.data = canvas.toDataURL('image/png');
    };

    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
  },

  clear(n) {
    const pad = this.pads[n];
    if (!pad) return;
    pad.ctx.clearRect(0, 0, pad.canvas.width, pad.canvas.height);
    pad.data = null;
  },

  getName(n) {
    return (document.getElementById(`sig-nome-${n}`)?.value || '').trim();
  },

  // ─── Memória de assinaturas ───────────────

  getStored() {
    try { return JSON.parse(localStorage.getItem(this.STORE_KEY) || '{}'); }
    catch (e) { return {}; }
  },

  setStored(map) {
    localStorage.setItem(this.STORE_KEY, JSON.stringify(map));
    this.renderStored();
  },

  saveStored(n) {
    const nome = this.getName(n);
    const pad = this.pads[n];
    if (!nome) { UTE_PE3.UI.toast('Digite o nome antes de salvar a assinatura', 'error'); return; }
    if (!pad || !pad.data) { UTE_PE3.UI.toast('Desenhe a assinatura antes de salvar', 'error'); return; }
    const map = this.getStored();
    map[nome] = pad.data;
    this.setStored(map);
    // persiste no .db para sincronizar entre dispositivos
    fetch(`${UTE_PE3.App.SAVE_BASE}/assinatura`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, data_url: pad.data })
    }).catch(() => {});
    UTE_PE3.UI.toast(`Assinatura de ${nome} salva`, 'success');
  },

  removeStored(nome) {
    const map = this.getStored();
    delete map[nome];
    this.setStored(map);
    fetch(`${UTE_PE3.App.SAVE_BASE}/assinatura?nome=${encodeURIComponent(nome)}`, {
      method: 'DELETE'
    }).catch(() => {});
    UTE_PE3.UI.toast('Assinatura excluída', 'info');
  },
  /** Sincroniza assinaturas do .db para este dispositivo (cross-device) */
  async syncFromDB() {
    try {
      const base = UTE_PE3.App?.SAVE_BASE;
      if (!base) return;
      const r = await fetch(`${base}/assinaturas`, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return;
      const j = await r.json();
      const nomesDB = j.nomes || [];
      const map = this.getStored();
      let changed = false;
      for (const nome of nomesDB) {
        if (!map[nome]) {
          // busca a data_url completa desta assinatura
          try {
            const rr = await fetch(`${base}/assinatura?nome=${encodeURIComponent(nome)}`);
            const jj = await rr.json();
            if (jj.data_url) { map[nome] = jj.data_url; changed = true; }
          } catch (e) { /* skip */ }
        }
      }
      if (changed) { localStorage.setItem(this.STORE_KEY, JSON.stringify(map)); this.renderStored(); }
    } catch (e) { /* offline — usa só localStorage */ }
  },

  /** Ao digitar o nome: se houver assinatura salva com esse nome, insere no pad */
  onNameInput(n) {
    const nome = this.getName(n);
    const map = this.getStored();
    const key = Object.keys(map).find((k) => k.toLowerCase() === nome.toLowerCase());
    if (key) this.loadIntoPad(n, key, map[key]);
  },

  loadIntoPad(n, nome, dataURL) {
    const pad = this.pads[n];
    if (!pad) return;
    const img = new Image();
    img.onload = () => {
      pad.ctx.clearRect(0, 0, pad.canvas.width, pad.canvas.height);
      const w = pad.canvas.width / window.devicePixelRatio;
      const h = pad.canvas.height / window.devicePixelRatio;
      pad.ctx.drawImage(img, 0, 0, w, h);
      pad.data = dataURL;
    };
    img.src = dataURL;
    const input = document.getElementById(`sig-nome-${n}`);
    if (input && input.value !== nome) input.value = nome;
  },

  renderStored() {
    const wrap = document.getElementById('saved-sigs-wrap');
    const list = document.getElementById('saved-sigs-list');
    if (!wrap || !list) return;
    const map = this.getStored();
    const nomes = Object.keys(map);
    wrap.style.display = nomes.length ? 'block' : 'none';
    const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    list.innerHTML = nomes.map((nome) => `
      <span class="tag">
        <span onclick="UTE_PE3.Signature.useStored('${esc(nome).replace(/'/g, '&#39;')}')">${esc(nome)}</span>
        <span class="remove-tag" onclick="UTE_PE3.Signature.removeStored('${esc(nome).replace(/'/g, '&#39;')}')">&times;</span>
      </span>
    `).join('');
  },

  /** Toque no chip: preenche o primeiro pad vazio (ou o 2º se o 1º já tem) */
  useStored(nome) {
    const map = this.getStored();
    if (!map[nome]) return;
    const target = (!this.pads[1] || !this.pads[1].data) ? 1 : 2;
    this.loadIntoPad(target, nome, map[nome]);
  },

  // ─── API usada pelo app/report ────────────

  /** Compat: primeira assinatura (vai para o banco/save-server) */
  getData() {
    return this.pads[1]?.data || null;
  },

  hasSignature() {
    return !!(this.pads[1] && this.pads[1].data);
  },

  /** Todas as assinaturas presentes, com nome */
  getAll() {
    return [1, 2]
      .filter((n) => this.pads[n]?.data)
      .map((n) => ({ nome: this.getName(n) || `Assinatura ${n}`, img: this.pads[n].data }));
  },

  clearAll() {
    [1, 2].forEach((n) => {
      this.clear(n);
      const input = document.getElementById(`sig-nome-${n}`);
      if (input) input.value = '';
    });
  }
};
