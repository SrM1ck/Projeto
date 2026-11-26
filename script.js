/* =====================================================================
   script.js – página inicial: login, verificação em duas etapas (MFA) e cadastro.
   Depende de comum.js (armazenamento, hash da senha, rede simulada).
   ===================================================================== */

// Quem já está logado vai direto para o painel
if (obterSessao()) location.replace('painel.html');

const CODIGO_MFA = '123456'; // simulado: num sistema real chegaria por SMS ou aplicativo

const form = document.getElementById('login-form');
const email = document.getElementById('email');
const password = document.getElementById('password');
const statusLogin = document.getElementById('login-status');
const botaoEntrar = document.getElementById('btn-entrar');
const mfaSection = document.getElementById('mfa-section');
const cadastroSection = document.getElementById('cadastro-section');
const formCadastro = document.getElementById('cadastro-form');
const titulo = document.getElementById('page-title');
const subtitulo = document.querySelector('.subtitle');
const rodapeCadastro = document.getElementById('signup');

let contaPendente = null; // conta que passou na senha e aguarda o código MFA
let errosMfa = 0;

// ---------- Troca entre as telas (login, MFA e cadastro) ----------
const mostrarTela = (nome) => {
  form.classList.toggle('hidden', nome !== 'login');
  mfaSection.classList.toggle('hidden', nome !== 'mfa');
  cadastroSection.classList.toggle('hidden', nome !== 'cadastro');
  rodapeCadastro.classList.toggle('hidden', nome !== 'login');
  if (nome === 'cadastro') {
    titulo.textContent = 'Criar conta';
    subtitulo.textContent = 'Preencha seus dados para usar o AgendaRemota.';
  } else {
    titulo.textContent = 'Entrar';
    subtitulo.textContent = 'Acesse sua conta para gerenciar seus agendamentos.';
  }
  document.title = `${nome === 'cadastro' ? 'Criar conta' : 'Login'} | AgendaRemota`;
  const primeiro = { login: email, mfa: document.getElementById('mfa-code'), cadastro: document.getElementById('reg-nome') }[nome];
  primeiro.focus();
  anunciar(nome === 'cadastro' ? 'Tela de criar conta' : nome === 'mfa' ? 'Verificação adicional' : 'Tela de login');
};

// ---------- Mostrar / ocultar senha ----------
document.getElementById('toggle-password').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const showing = password.type === 'text';
  password.type = showing ? 'password' : 'text';
  button.textContent = showing ? 'Mostrar' : 'Ocultar';
  button.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
  button.setAttribute('aria-pressed', String(!showing));
});

// ---------- 1) Login ----------
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (ocupado(botaoEntrar)) return; // ignora cliques repetidos
  document.getElementById('email-error').textContent = '';
  document.getElementById('password-error').textContent = '';
  email.removeAttribute('aria-invalid');
  password.removeAttribute('aria-invalid');
  statusLogin.className = 'status';
  statusLogin.textContent = '';
  let primeiroInvalido = null;
  if (!email.value.trim() || !email.validity.valid) {
    document.getElementById('email-error').textContent = 'Informe um e-mail válido.';
    email.setAttribute('aria-invalid', 'true');
    primeiroInvalido = email;
  }
  if (password.value.length < 6) {
    document.getElementById('password-error').textContent = 'A senha deve ter pelo menos 6 caracteres.';
    password.setAttribute('aria-invalid', 'true');
    primeiroInvalido = primeiroInvalido || password;
  }
  if (primeiroInvalido) {
    primeiroInvalido.focus();
    return;
  }

  const terminar = iniciarCarga(botaoEntrar, 'Verificando…');
  const emailNormal = email.value.trim().toLowerCase();
  const hash = await hashSenha(emailNormal, password.value);
  await simularRede(500, 900);
  const conta = buscar('ar_contas', []).find((c) => c.email === emailNormal);
  terminar();

  // Mensagem única para e-mail ou senha errados: não revela qual dos dois falhou (segurança)
  if (!conta || conta.senhaHash !== hash) {
    statusLogin.textContent = 'E-mail ou senha incorretos. Se ainda não tem conta, clique em "Criar conta".';
    return;
  }
  contaPendente = conta;
  errosMfa = 0;
  mostrarTela('mfa');
});

// ---------- 2) Verificação em duas etapas (MFA) ----------
const verificarMfa = () => {
  const codigo = document.getElementById('mfa-code');
  const erro = document.getElementById('mfa-error');
  if (codigo.value.trim() !== CODIGO_MFA) {
    errosMfa += 1;
    if (errosMfa >= 3) {
      // 3 erros: volta ao início por segurança
      contaPendente = null;
      codigo.value = '';
      password.value = '';
      erro.textContent = '';
      mostrarTela('login');
      statusLogin.textContent = 'Código incorreto 3 vezes. Por segurança, entre novamente.';
      return;
    }
    erro.textContent = `Código incorreto. Use ${CODIGO_MFA} nesta demonstração. Restam ${3 - errosMfa} tentativa(s).`;
    codigo.setAttribute('aria-invalid', 'true');
    codigo.focus();
    return;
  }
  erro.textContent = '';
  salvarSessao(contaPendente.email, document.getElementById('remember').checked);
  location.href = 'painel.html';
};
document.getElementById('verify-mfa').addEventListener('click', verificarMfa);
document.getElementById('mfa-code').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') verificarMfa();
});
document.getElementById('mfa-back').addEventListener('click', () => {
  contaPendente = null;
  document.getElementById('mfa-code').value = '';
  document.getElementById('mfa-error').textContent = '';
  mostrarTela('login');
});

// ---------- 3) Cadastro (criar conta e guardar) ----------
document.getElementById('register').addEventListener('click', (event) => {
  event.preventDefault();
  statusLogin.textContent = '';
  mostrarTela('cadastro');
});
document.getElementById('voltar-login').addEventListener('click', () => mostrarTela('login'));

formCadastro.addEventListener('submit', async (event) => {
  event.preventDefault();
  const botao = document.getElementById('btn-cadastrar');
  if (ocupado(botao)) return;

  const nome = document.getElementById('reg-nome');
  const mail = document.getElementById('reg-email');
  const telefone = document.getElementById('reg-telefone');
  const senha = document.getElementById('reg-senha');
  const confirma = document.getElementById('reg-confirma');
  const aceite = document.getElementById('reg-aceite');
  const statusCadastro = document.getElementById('cadastro-status');

  formCadastro.querySelectorAll('.error').forEach((e) => { e.textContent = ''; });
  formCadastro.querySelectorAll('[aria-invalid]').forEach((c) => c.removeAttribute('aria-invalid'));
  statusCadastro.textContent = '';

  let primeiroInvalido = null;
  const invalido = (campo, mensagem) => {
    document.getElementById(`${campo.id}-error`).textContent = mensagem;
    campo.setAttribute('aria-invalid', 'true');
    primeiroInvalido = primeiroInvalido || campo;
  };
  const digitos = telefone.value.replace(/\D/g, '');

  if (nome.value.trim().length < 3) invalido(nome, 'Informe seu nome completo.');
  if (!mail.value.trim() || !mail.validity.valid) invalido(mail, 'Informe um e-mail válido.');
  if (telefone.value.trim() && (digitos.length < 10 || digitos.length > 11)) invalido(telefone, 'Informe o telefone com DDD (10 ou 11 números) ou deixe em branco.');
  if (senha.value.length < 6) invalido(senha, 'A senha deve ter pelo menos 6 caracteres.');
  if (confirma.value !== senha.value) invalido(confirma, 'As senhas não coincidem.');
  if (!aceite.checked) invalido(aceite, 'Marque a caixa para criar a conta.');
  if (primeiroInvalido) {
    primeiroInvalido.focus();
    return;
  }

  const terminar = iniciarCarga(botao, 'Criando conta…');
  const emailNormal = mail.value.trim().toLowerCase();
  const hash = await hashSenha(emailNormal, senha.value);
  await simularRede(600, 1000);

  const contas = buscar('ar_contas', []);
  if (contas.some((c) => c.email === emailNormal)) {
    terminar();
    invalido(mail, 'Já existe uma conta com este e-mail. Use "Já tenho conta, entrar".');
    mail.focus();
    return;
  }
  // A senha NÃO é guardada: só o hash dela
  contas.push({
    nome: nome.value.trim(),
    email: emailNormal,
    telefone: digitos,
    senhaHash: hash,
    criadaEm: new Date().toISOString()
  });
  if (!guardar('ar_contas', contas)) {
    terminar();
    statusCadastro.textContent = 'Não foi possível salvar a conta neste navegador. Verifique se o armazenamento está liberado.';
    return;
  }
  terminar();
  formCadastro.reset();
  mostrarTela('login');
  email.value = emailNormal;
  password.value = '';
  statusLogin.className = 'status ok';
  statusLogin.textContent = 'Conta criada com sucesso! Agora entre com seu e-mail e senha.';
  password.focus();
});

// ---------- Esqueci minha senha ----------
document.getElementById('forgot').addEventListener('click', () => {
  statusLogin.className = 'status';
  statusLogin.textContent = 'A recuperação de senha não faz parte desta demonstração. Crie uma nova conta para testar.';
});
