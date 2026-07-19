/**
 * offline.js — IndexedDB persistence for UTE-PE3 Report
 */
window.UTE_PE3 = window.UTE_PE3 || {};

UTE_PE3.Offline = {
  DB_NAME: 'ute-pe3-drafts',
  DB_VERSION: 1,
  db: null,

  async open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      req.onerror = () => reject(req.error);
    });
  },

  async saveDraft(data) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('drafts', 'readwrite');
      const store = tx.objectStore('drafts');
      const record = { ...data, created_at: new Date().toISOString(), status: 'Aberto' };
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async updateDraft(id, data) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('drafts', 'readwrite');
      const store = tx.objectStore('drafts');
      const req = store.get(id);
      req.onsuccess = () => {
        const record = req.result;
        if (!record) return reject('Draft not found');
        Object.assign(record, data, { updated_at: new Date().toISOString() });
        store.put(record).onsuccess = () => resolve();
      };
      req.onerror = () => reject(req.error);
    });
  },

  async getDrafts() {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('drafts', 'readonly');
      const store = tx.objectStore('drafts');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.reverse());
      req.onerror = () => reject(req.error);
    });
  },

  async getDraft(id) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('drafts', 'readonly');
      const store = tx.objectStore('drafts');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async deleteDraft(id) {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('drafts', 'readwrite');
      const store = tx.objectStore('drafts');
      store.delete(id).onsuccess = () => resolve();
    });
  },
};
