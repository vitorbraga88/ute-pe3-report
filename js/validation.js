/**
 * validation.js — Field validation for UTE-PE3 Report
 */
window.UTE_PE3 = window.UTE_PE3 || {};

UTE_PE3.Validation = {
  rules: {
    pts:        { regex: /^\d{1,6}-\d{2}$/,       msg: 'Formato: 830-26 (número-hífen-ano)' },
    descricao:  { minLen: 10,                      msg: 'Mínimo 10 caracteres' },
    local:      { regex: /^[A-Za-z0-9 _-]{3,30}$/,msg: '3 a 30 caracteres (letras, números, espaço, _ ou -)' },
    data:       { isDate: true, notFuture: true,    msg: 'Data inválida ou futura' },
    hora_inicial:{ isTime: true,                    msg: 'Hora inválida' },
    hora_final: { isTime: true,                     msg: 'Hora inválida' },
    horimetro:  { range: [0, 999999],               msg: 'Valor entre 0 e 999.999' },
  },

  validateField(name, value) {
    const rule = this.rules[name];
    if (!rule) return null;

    if (rule.regex && !rule.regex.test(value)) return rule.msg;
    if (rule.minLen && value.length < rule.minLen) return rule.msg;
    if (rule.required && !value.trim()) return rule.msg;
    if (rule.isDate) {
      // Input nativo type="date" — formato yyyy-mm-dd garantido pelo navegador quando preenchido
      if (!value) return rule.msg;
      const d = new Date(value + 'T00:00:00');
      if (isNaN(d.getTime())) return rule.msg;
      if (rule.notFuture) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (d > today) return 'Data não pode ser futura';
      }
    }
    if (rule.isTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return rule.msg;
    if (rule.range) {
      const n = Number(value);
      if (value !== '' && (isNaN(n) || n < rule.range[0] || n > rule.range[1])) return rule.msg;
    }
    return null;
  },

  showError(name, msg) {
    const el = document.getElementById(`error-${name}`);
    if (el) { el.textContent = msg; el.classList.add('visible'); }
    const input = document.getElementById(name);
    if (input) input.classList.add('error');
  },

  clearError(name) {
    const el = document.getElementById(`error-${name}`);
    if (el) { el.textContent = ''; el.classList.remove('visible'); }
    const input = document.getElementById(name);
    if (input) input.classList.remove('error');
  },

  validateAll() {
    let valid = true;
    const fields = ['pts', 'descricao', 'local', 'data', 'hora_inicial', 'hora_final'];

    for (const name of fields) {
      const el = document.getElementById(name);
      if (!el) continue;
      const val = el.value.trim();
      this.clearError(name);
      const err = this.validateField(name, val);
      if (err) { this.showError(name, err); valid = false; }
    }

    // Validate hora_final > hora_inicial
    const hi = document.getElementById('hora_inicial')?.value;
    const hf = document.getElementById('hora_final')?.value;
    if (hi && hf && hi >= hf) {
      this.showError('hora_final', 'Hora final deve ser posterior à inicial');
      valid = false;
    }

    // Validate at least 1 OS number
    const osNumbers = UTE_PE3.state?.os_numbers || [];
    if (osNumbers.length === 0) {
      this.showError('os_number', 'Adicione pelo menos 1 número de OS');
      valid = false;
    }

    // Validate at least 1 technician
    const tecnicos = UTE_PE3.state?.tecnicos || [];
    if (tecnicos.length === 0) {
      this.showError('tecnico', 'Adicione pelo menos 1 técnico');
      valid = false;
    }

    // Validate at least 1 supervisor
    const supervisores = UTE_PE3.state?.supervisores || [];
    if (supervisores.length === 0) {
      this.showError('supervisor', 'Adicione pelo menos 1 supervisor');
      valid = false;
    }

    return valid;
  }
};
