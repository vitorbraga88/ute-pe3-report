/**
 * camera.js — Photo capture and compression for UTE-PE3 Report
 */
window.UTE_PE3 = window.UTE_PE3 || {};

UTE_PE3.Camera = {
  MAX_SIZE_KB: 300,
  MAX_WIDTH: 1280,
  photos: [],       // { base64, descricao }
  ptsPhoto: null,   // single photo base64

  /** Compress an image via canvas to target KB */
  compress(base64, maxKB) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > this.MAX_WIDTH) { h = Math.round(h * this.MAX_WIDTH / w); w = this.MAX_WIDTH; }

        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        let quality = 0.8;
        const tryCompress = () => {
          const data = canvas.toDataURL('image/jpeg', quality);
          const kb = data.length * 0.75 / 1024; // approx base64 → bytes
          if (kb <= maxKB || quality <= 0.1) { resolve(data); return; }
          quality -= 0.1;
          tryCompress();
        };
        tryCompress();
      };
      img.src = base64;
    });
  },

  /** Open file picker. source='camera' força a câmera; source='gallery' abre a galeria. */
  async capture(source = 'camera') {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (source === 'camera') input.setAttribute('capture', 'environment');
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return reject('Nenhum arquivo selecionado');
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const compressed = await this.compress(ev.target.result, this.MAX_SIZE_KB);
          resolve(compressed);
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });
  },

  /** Add a photo to the report gallery */
  async addPhoto(source = 'camera') {
    try {
      const base64 = await this.capture(source);
      this.photos.push({ base64, descricao: '' });
      this.renderPhotos();
    } catch (e) {
      if (e !== 'Nenhum arquivo selecionado') UTE_PE3.UI.toast('Erro ao capturar foto', 'error');
    }
  },

  /** Remove a photo by index */
  removePhoto(index) {
    this.photos.splice(index, 1);
    this.renderPhotos();
  },

  /** Capture PTS photo */
  async capturePTS(source = 'camera') {
    try {
      this.ptsPhoto = await this.capture(source);
      this.renderPTSPhoto();
    } catch (e) {
      if (e !== 'Nenhum arquivo selecionado') UTE_PE3.UI.toast('Erro ao capturar PTS', 'error');
    }
  },

  /** Remove PTS photo */
  removePTSPhoto() {
    this.ptsPhoto = null;
    this.renderPTSPhoto();
  },

  /** Render photo gallery */
  renderPhotos() {
    const grid = document.getElementById('photo-grid');
    if (!grid) return;

    grid.innerHTML = this.photos.map((p, i) => `
      <div class="photo-card">
        <img src="${p.base64}" alt="Foto ${i + 1}">
        <button class="photo-remove" onclick="UTE_PE3.Camera.removePhoto(${i})">&times;</button>
        <div class="photo-desc">
          <input type="text" placeholder="Descricao da foto"
                 value="${this.escapeHtml(p.descricao)}"
                 onchange="UTE_PE3.Camera.photos[${i}].descricao = this.value">
        </div>
      </div>
    `).join('');
  },

  /** Render PTS photo */
  renderPTSPhoto() {
    const container = document.getElementById('pts-photo-container');
    if (!container) return;
    container.innerHTML = this.ptsPhoto ? `
        <div class="photo-card" style="max-width:220px">
          <img src="${this.ptsPhoto}" alt="PTS">
          <button class="photo-remove" onclick="UTE_PE3.Camera.removePTSPhoto()">&times;</button>
        </div>
      ` : '';
  },

  escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
};
