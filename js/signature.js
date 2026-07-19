/**
 * signature.js — Touch signature capture for UTE-PE3 Report
 */
window.UTE_PE3 = window.UTE_PE3 || {};

UTE_PE3.Signature = {
  canvas: null,
  ctx: null,
  drawing: false,
  signatureData: null,

  init(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    // Set canvas resolution to match display size
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.ctx.strokeStyle = '#1e40af';
    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.bindEvents();
  },

  bindEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const start = (e) => {
      e.preventDefault();
      this.drawing = true;
      const pos = getPos(e);
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, pos.y);
    };

    const move = (e) => {
      if (!this.drawing) return;
      e.preventDefault();
      const pos = getPos(e);
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();
    };

    const end = () => {
      if (!this.drawing) return;
      this.drawing = false;
      this.signatureData = this.canvas.toDataURL('image/png');
    };

    this.canvas.addEventListener('touchstart', start, { passive: false });
    this.canvas.addEventListener('touchmove', move, { passive: false });
    this.canvas.addEventListener('touchend', end);
    this.canvas.addEventListener('mousedown', start);
    this.canvas.addEventListener('mousemove', move);
    this.canvas.addEventListener('mouseup', end);
    this.canvas.addEventListener('mouseleave', end);
  },

  clear() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.signatureData = null;
  },

  getData() {
    return this.signatureData;
  },

  hasSignature() {
    return !!this.signatureData;
  }
};
