/* =====================================================================
   comum.js – funções usadas por todas as páginas do AgendaRemota
   (armazenamento, sessão, senha protegida, rede simulada, acessibilidade)
   ===================================================================== */

// ---------- Armazenamento no navegador (simula o banco de dados) ----------
const buscar = (chave, padrao) => {
  try {
    const valor = localStorage.getItem(chave);
    return valor ? JSON.parse(valor) : padrao;
  } catch (erro) {
    return padrao;
  }
};

const guardar = (chave, valor) => {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch (erro) {
    return false;
  }
};

// ---------- Sessão de login ----------
// "Manter conectado" guarda no localStorage; sem marcar, a sessão acaba ao fechar a aba.
const salvarSessao = (email, lembrar) => {
  try {
    (lembrar ? localStorage : sessionStorage).setItem('ar_sessao', email);
  } catch (erro) { /* navegador sem armazenamento */ }
};

const obterSessao = () => {
  try {
    return sessionStorage.getItem('ar_sessao') || localStorage.getItem('ar_sessao');
  } catch (erro) {
    return null;
  }
};

const encerrarSessao = () => {
  try {
    sessionStorage.removeItem('ar_sessao');
    localStorage.removeItem('ar_sessao');
  } catch (erro) { /* ok */ }
};

// ---------- Segurança: a senha nunca é guardada em texto puro ----------
// Guardamos apenas o "hash" SHA-256 (uma impressão digital da senha).
// Num sistema real isso é feito no servidor, com bcrypt ou Argon2.
const hashSenha = async (email, senha) => {
  const texto = `${email.toLowerCase()}:${senha}`;
  if (window.crypto && crypto.subtle) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Reserva só para navegadores antigos (apenas demonstração, não é seguro)
  let h = 5381;
  for (const letra of texto) h = ((h << 5) + h + letra.charCodeAt(0)) >>> 0;
  return `simples-${h}`;
};

// Evita que texto digitado pelo usuário vire HTML (proteção contra injeção de código)
const escapar = (texto) =>
  String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Desempenho: rede simulada, tempo medido e botão protegido ----------
// Simula o tempo de resposta de um servidor e mostra o tempo no rodapé.
const simularRede = (minimo = 500, maximo = 900) =>
  new Promise((resolver) => {
    const inicio = performance.now();
    setTimeout(() => {
      const campo = document.getElementById('tempo-resposta');
      if (campo) campo.textContent = `Tempo da última operação: ${Math.round(performance.now() - inicio)} ms`;
      resolver();
    }, minimo + Math.random() * (maximo - minimo));
  });

// Troca o texto do botão por "carregando…" e bloqueia novos cliques (prevenção de cliques repetidos).
// Devolve uma função que restaura o botão.
const iniciarCarga = (botao, texto) => {
  const original = botao.textContent;
  botao.setAttribute('aria-disabled', 'true');
  botao.setAttribute('aria-busy', 'true');
  botao.innerHTML = `<span class="carregando" aria-hidden="true"></span>${texto}`;
  return () => {
    botao.removeAttribute('aria-disabled');
    botao.removeAttribute('aria-busy');
    botao.textContent = original;
  };
};

const ocupado = (botao) => botao.getAttribute('aria-disabled') === 'true';

// ---------- Acessibilidade: avisos, tamanho da fonte e alto contraste ----------
// Anuncia mensagens para leitores de tela (região #anuncio, quando existir na página)
const anunciar = (texto) => {
  const regiao = document.getElementById('anuncio');
  if (!regiao) return;
  regiao.textContent = '';
  setTimeout(() => { regiao.textContent = texto; }, 50);
};

let tamanhoFonte = buscar('ar_fonte', 16);

const aplicarPreferencias = () => {
  document.documentElement.style.fontSize = `${tamanhoFonte}px`;
  const alto = buscar('ar_contraste', false);
  document.body.classList.toggle('high-contrast', alto);
  const botao = document.getElementById('contrast-toggle');
  if (botao) botao.setAttribute('aria-pressed', String(alto));
};

const ligarFerramentas = () => {
  const mais = document.getElementById('font-increase');
  const menos = document.getElementById('font-decrease');
  const contraste = document.getElementById('contrast-toggle');
  if (mais) {
    mais.addEventListener('click', () => {
      tamanhoFonte = Math.min(22, tamanhoFonte + 1);
      guardar('ar_fonte', tamanhoFonte);
      aplicarPreferencias();
    });
  }
  if (menos) {
    menos.addEventListener('click', () => {
      tamanhoFonte = Math.max(13, tamanhoFonte - 1);
      guardar('ar_fonte', tamanhoFonte);
      aplicarPreferencias();
    });
  }
  if (contraste) {
    contraste.addEventListener('click', () => {
      guardar('ar_contraste', !buscar('ar_contraste', false));
      aplicarPreferencias();
      anunciar(buscar('ar_contraste', false) ? 'Alto contraste ligado' : 'Alto contraste desligado');
    });
  }
  aplicarPreferencias();
};

ligarFerramentas();
