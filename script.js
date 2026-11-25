const form = document.getElementById('login-form');
const email = document.getElementById('email');
const password = document.getElementById('password');
const status = document.getElementById('login-status');
const mfaSection = document.getElementById('mfa-section');
const dashboard = document.getElementById('dashboard');

document.getElementById('toggle-password').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const showing = password.type === 'text';
  password.type = showing ? 'password' : 'text';
  button.textContent = showing ? 'Mostrar' : 'Ocultar';
  button.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
  button.setAttribute('aria-pressed', String(!showing));
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  document.getElementById('email-error').textContent = '';
  document.getElementById('password-error').textContent = '';
  status.textContent = '';
  let valid = true;
  if (!email.value.trim() || !email.validity.valid) {
    document.getElementById('email-error').textContent = 'Informe um e-mail válido.';
    valid = false;
  }
  if (password.value.length < 6) {
    document.getElementById('password-error').textContent = 'A senha deve ter pelo menos 6 caracteres.';
    valid = false;
  }
  if (!valid) return;
  form.classList.add('hidden');
  mfaSection.classList.remove('hidden');
  document.getElementById('mfa-code').focus();
});

document.getElementById('verify-mfa').addEventListener('click', () => {
  const code = document.getElementById('mfa-code').value.trim();
  const error = document.getElementById('mfa-error');
  if (code !== '123456') {
    error.textContent = 'Código incorreto. Use 123456 nesta demonstração.';
    return;
  }
  error.textContent = '';
  mfaSection.classList.add('hidden');
  document.getElementById('welcome').textContent = `Olá, ${email.value.trim()}!`;
  dashboard.classList.remove('hidden');
});
document.getElementById('logout').addEventListener('click', () => {
  dashboard.classList.add('hidden');
  form.classList.remove('hidden');
  password.value = '';
  document.getElementById('mfa-code').value = '';
  status.textContent = '';
  email.focus();
});
document.getElementById('forgot').addEventListener('click', () => {
  status.textContent = 'A recuperação de senha será implementada em uma próxima etapa.';
});
document.getElementById('register').addEventListener('click', (event) => {
  event.preventDefault();
  status.textContent = 'O cadastro de novos usuários será implementado em uma próxima etapa.';
});
let fontSize = 16;
document.getElementById('font-increase').addEventListener('click', () => {
  fontSize = Math.min(22, fontSize + 1);
  document.documentElement.style.fontSize = `${fontSize}px`;
});
document.getElementById('font-decrease').addEventListener('click', () => {
  fontSize = Math.max(13, fontSize - 1);
  document.documentElement.style.fontSize = `${fontSize}px`;
});
document.getElementById('contrast-toggle').addEventListener('click', (event) => {
  const active = document.body.classList.toggle('high-contrast');
  event.currentTarget.setAttribute('aria-pressed', String(active));
});
