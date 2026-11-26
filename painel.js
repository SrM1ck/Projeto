/* =====================================================================
   painel.js – painel do usuário: agendar, minhas consultas e atendimento remoto.
   Depende de comum.js.
   ===================================================================== */

const TIPOS = {
  clinico: 'Atendimento clínico (teleconsulta)',
  suporte: 'Suporte técnico',
  rh: 'Atendimento de RH'
};
const HORAS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const TELAS = {
  inicio: 'Painel',
  agendar: 'Agendar consulta',
  consultas: 'Minhas consultas',
  atendimento: 'Atendimento remoto'
};

// ---------- Datas ----------
const doisDigitos = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
const deIso = (s) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
const hoje = () => iso(new Date());
const maisDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const diaUtil = (s) => { const d = deIso(s).getDay(); return d !== 0 && d !== 6; };
const formatarData = (s) => deIso(s).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

// ---------- Proteção da página: só entra quem fez login ----------
// (Autorização: cada usuário enxerga apenas a própria conta e as próprias consultas.)
const emailSessao = obterSessao();
const contaLogada = buscar('ar_contas', []).find((c) => c.email === emailSessao);

if (!contaLogada) {
  encerrarSessao();
  location.replace('index.html');
} else {
  iniciarPainel(contaLogada);
}

function iniciarPainel(conta) {
  // ---------- Dados das consultas (simulam o banco de dados) ----------
  const todasConsultas = () => buscar('ar_consultas', []);
  const passou = (data, hora) => (data === hoje() ? parseInt(hora, 10) <= new Date().getHours() : data < hoje());
  const minhasConsultas = () =>
    todasConsultas()
      .filter((c) => c.email === conta.email)
      .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  const estaAtiva = (c) => c.status === 'Agendado' && !passou(c.data, c.hora);

  // Alguns horários aparecem como ocupados (simulação de outros usuários)
  const ocupadoPorOutros = (data, indice) => (deIso(data).getDate() + indice) % 4 === 0;
  const horarioIndisponivel = (data, hora, indice) =>
    passou(data, hora) ||
    ocupadoPorOutros(data, indice) ||
    minhasConsultas().some((c) => c.status === 'Agendado' && c.data === data && c.hora === hora);

  // ---------- Topo ----------
  document.getElementById('usuario-nome').textContent = conta.nome;
  document.getElementById('btn-sair').addEventListener('click', () => {
    encerrarSessao();
    location.href = 'index.html';
  });

  // ---------- Navegação entre as telas ----------
  let salaAtual = null; // consulta escolhida para entrar na sala

  const mostrarTela = () => {
    let nome = location.hash.replace('#', '');
    if (!TELAS[nome]) nome = 'inicio';
    document.querySelectorAll('[data-tela]').forEach((s) => { s.hidden = s.id !== `tela-${nome}`; });
    document.querySelectorAll('.menu a').forEach((a) => {
      if (a.getAttribute('href') === `#${nome}`) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.title = `${TELAS[nome]} | AgendaRemota`;

    if (nome === 'inicio') desenharInicio();
    if (nome === 'agendar') prepararAgendar();
    if (nome === 'consultas') desenharConsultas();
    if (nome === 'atendimento') iniciarChamada();
    if (nome !== 'atendimento') parar();

    const h1 = document.querySelector(`#tela-${nome} h1`);
    h1.setAttribute('tabindex', '-1');
    h1.focus();
    window.scrollTo(0, 0);
    anunciar(`Tela: ${TELAS[nome]}`);
  };
  window.addEventListener('hashchange', mostrarTela);

  // ---------- PAINEL ----------
  function desenharInicio() {
    document.getElementById('ola').textContent = `Olá, ${conta.nome.split(' ')[0]}!`;
    const ativas = minhasConsultas().filter(estaAtiva);
    document.getElementById('total-agendadas').textContent = ativas.length;
    if (ativas.length) {
      document.getElementById('proxima-hora').textContent = ativas[0].hora;
      document.getElementById('proxima-detalhe').textContent = `${formatarData(ativas[0].data)} · ${TIPOS[ativas[0].tipo]}`;
    } else {
      document.getElementById('proxima-hora').textContent = '—';
      document.getElementById('proxima-detalhe').textContent = 'Você não tem consultas marcadas.';
    }
    document.getElementById('cad-nome').textContent = conta.nome;
    document.getElementById('cad-email').textContent = conta.email;
    const t = conta.telefone || '';
    document.getElementById('cad-telefone').textContent = t ? t.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') : 'não informado';
    document.getElementById('cad-data').textContent = new Date(conta.criadaEm).toLocaleDateString('pt-BR');
  }

  // ---------- AGENDAR ----------
  const formAgendar = document.getElementById('form-agendar');
  const campoTipo = document.getElementById('tipo');
  const campoData = document.getElementById('data');
  const campoHora = document.getElementById('hora');
  const botaoAgendar = document.getElementById('btn-agendar');
  const caixaConfirmacao = document.getElementById('confirmacao');

  const limparErros = () => {
    formAgendar.querySelectorAll('.error').forEach((e) => { e.textContent = ''; });
    formAgendar.querySelectorAll('[aria-invalid]').forEach((c) => c.removeAttribute('aria-invalid'));
  };
  const erroCampo = (campo, mensagem) => {
    document.getElementById(`${campo.id}-erro`).textContent = mensagem;
    campo.setAttribute('aria-invalid', 'true');
  };

  function prepararAgendar() {
    campoData.min = hoje();
    campoData.max = maisDias(30);
    formAgendar.reset();
    limparErros();
    caixaConfirmacao.hidden = true;
    atualizarHorarios();
  }

  // Preenche a lista de horários conforme a data escolhida
  function atualizarHorarios() {
    const d = campoData.value;
    campoHora.innerHTML = '';
    document.getElementById('hora-info').textContent = '';
    const opcao = (valor, texto, desabilitada) => {
      const o = document.createElement('option');
      o.value = valor;
      o.textContent = texto;
      o.disabled = !!desabilitada;
      campoHora.appendChild(o);
    };
    if (!d) {
      campoHora.disabled = true;
      opcao('', 'Escolha uma data primeiro');
      return;
    }
    if (d < hoje() || d > maisDias(30) || !diaUtil(d)) {
      campoHora.disabled = true;
      opcao('', 'Sem horários nesta data');
      document.getElementById('hora-info').textContent = 'Escolha um dia útil (segunda a sexta) nos próximos 30 dias.';
      return;
    }
    campoHora.disabled = false;
    opcao('', 'Selecione um horário');
    let livres = 0;
    HORAS.forEach((h, i) => {
      const indisponivel = horarioIndisponivel(d, h, i);
      if (!indisponivel) livres += 1;
      opcao(h, indisponivel ? `${h} (indisponível)` : h, indisponivel);
    });
    document.getElementById('hora-info').textContent = livres
      ? `${livres} horário(s) livre(s) em ${formatarData(d)}.`
      : 'Não há horários livres nesta data. Escolha outro dia.';
  }
  campoData.addEventListener('change', () => {
    document.getElementById('data-erro').textContent = '';
    campoData.removeAttribute('aria-invalid');
    atualizarHorarios();
  });

  formAgendar.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (ocupado(botaoAgendar)) return; // PREVENÇÃO DE CLIQUES REPETIDOS
    limparErros();
    caixaConfirmacao.hidden = true;

    let primeiroInvalido = null;
    const invalido = (campo, mensagem) => {
      erroCampo(campo, mensagem);
      primeiroInvalido = primeiroInvalido || campo;
    };
    if (!campoTipo.value) invalido(campoTipo, 'Escolha o tipo de atendimento.');
    let dataValida = true;
    if (!campoData.value) { dataValida = false; invalido(campoData, 'Escolha uma data.'); }
    else if (campoData.value < hoje() || campoData.value > maisDias(30) || !diaUtil(campoData.value)) { dataValida = false; invalido(campoData, 'Escolha um dia útil nos próximos 30 dias.'); }
    if (dataValida && !campoHora.value) invalido(campoHora, 'Escolha um horário.');
    if (primeiroInvalido) {
      primeiroInvalido.focus();
      return;
    }

    const terminar = iniciarCarga(botaoAgendar, 'Agendando…');
    await simularRede(900, 1500);

    // O "servidor" confere de novo se o horário ainda está livre
    const indice = HORAS.indexOf(campoHora.value);
    if (horarioIndisponivel(campoData.value, campoHora.value, indice)) {
      terminar();
      atualizarHorarios();
      erroCampo(campoHora, 'Esse horário acabou de ser ocupado. Escolha outro.');
      campoHora.focus();
      return;
    }
    const nova = {
      id: `AR-${Date.now().toString(36).toUpperCase()}`,
      email: conta.email,
      tipo: campoTipo.value,
      data: campoData.value,
      hora: campoHora.value,
      status: 'Agendado'
    };
    const lista = todasConsultas();
    lista.push(nova);
    guardar('ar_consultas', lista);
    terminar();

    // Mostra que a consulta foi agendada
    document.getElementById('conf-id').textContent = nova.id;
    document.getElementById('conf-tipo').textContent = TIPOS[nova.tipo];
    document.getElementById('conf-data').textContent = formatarData(nova.data);
    document.getElementById('conf-hora').textContent = nova.hora;
    document.getElementById('conf-email').textContent = `Enviamos a confirmação para ${conta.email} (e-mail simulado neste protótipo).`;
    formAgendar.reset();
    atualizarHorarios();
    caixaConfirmacao.hidden = false;
    caixaConfirmacao.focus();
    anunciar('Consulta agendada com sucesso.');
  });

  document.getElementById('agendar-outra').addEventListener('click', () => {
    caixaConfirmacao.hidden = true;
    campoTipo.focus();
  });

  // ---------- MINHAS CONSULTAS ----------
  const dlg = document.getElementById('dlg');
  const avisoConsultas = document.getElementById('aviso-consultas');
  let idParaCancelar = null;

  function desenharConsultas() {
    avisoConsultas.hidden = true;
    const lista = minhasConsultas();
    const caixa = document.getElementById('lista-consultas');
    if (!lista.length) {
      caixa.innerHTML = '<div class="cartao"><p>Você ainda não tem consultas. Que tal agendar a primeira?</p></div>';
      return;
    }
    const linhas = lista.map((c) => {
      const rotulo = `${formatarData(c.data)} às ${c.hora}`;
      const acoes = estaAtiva(c)
        ? `<div class="acoes" style="margin:0">
             <button type="button" class="botao sec pequeno" data-sala="${escapar(c.id)}" aria-label="Entrar na sala da consulta de ${escapar(rotulo)}">Entrar na sala</button>
             <button type="button" class="botao perigo pequeno" data-cancelar="${escapar(c.id)}" aria-label="Cancelar a consulta de ${escapar(rotulo)}">Cancelar</button>
           </div>`
        : '—';
      const situacao = c.status === 'Agendado' && passou(c.data, c.hora) ? 'Realizado' : c.status;
      return `<tr>
        <td>${escapar(formatarData(c.data))}</td><td>${escapar(c.hora)}</td><td>${escapar(TIPOS[c.tipo])}</td>
        <td><span class="selo ${escapar(situacao.toLowerCase())}">${escapar(situacao)}</span></td><td>${acoes}</td></tr>`;
    }).join('');
    caixa.innerHTML = `<div class="tabela-wrap"><table>
      <caption>Suas consultas</caption>
      <thead><tr><th scope="col">Data</th><th scope="col">Horário</th><th scope="col">Atendimento</th><th scope="col">Situação</th><th scope="col">Ações</th></tr></thead>
      <tbody>${linhas}</tbody></table></div>`;
  }

  document.getElementById('lista-consultas').addEventListener('click', (event) => {
    const botaoSala = event.target.closest('[data-sala]');
    const botaoCancelar = event.target.closest('[data-cancelar]');
    if (botaoSala) {
      salaAtual = minhasConsultas().find((c) => c.id === botaoSala.dataset.sala);
      location.hash = '#atendimento';
    }
    if (botaoCancelar) {
      const c = minhasConsultas().find((x) => x.id === botaoCancelar.dataset.cancelar);
      idParaCancelar = c.id;
      document.getElementById('dlg-texto').textContent =
        `Você vai cancelar ${TIPOS[c.tipo]} em ${formatarData(c.data)} às ${c.hora}. O horário será liberado para outras pessoas.`;
      dlg.showModal();
      document.getElementById('dlg-nao').focus();
    }
  });
  document.getElementById('dlg-nao').addEventListener('click', () => dlg.close());
  document.getElementById('dlg-sim').addEventListener('click', async (event) => {
    const botao = event.currentTarget;
    if (ocupado(botao)) return;
    const terminar = iniciarCarga(botao, 'Cancelando…');
    await simularRede(400, 800);
    const lista = todasConsultas();
    lista.forEach((c) => { if (c.id === idParaCancelar && c.email === conta.email) c.status = 'Cancelado'; });
    guardar('ar_consultas', lista);
    terminar();
    dlg.close();
    desenharConsultas();
    avisoConsultas.textContent = '✔ Consulta cancelada. O horário foi liberado.';
    avisoConsultas.hidden = false;
    avisoConsultas.focus();
  });

  // ---------- ATENDIMENTO REMOTO (demonstração de vídeo e chat) ----------
  const caixaMsgs = document.getElementById('mensagens');
  const campoMsg = document.getElementById('msg');
  const botaoEncerrar = document.getElementById('btn-encerrar');
  const textoQualidade = document.getElementById('qualidade');
  const respostas = [
    'Entendi. Pode me contar um pouco mais?',
    'Certo, vou registrar isso no seu atendimento.',
    'Obrigado pelas informações! Posso ajudar em mais alguma coisa?'
  ];
  let emChamada = false;
  let indiceResposta = 0;
  let temporizadores = [];

  const adicionarMensagem = (quem, texto) => {
    const p = document.createElement('p');
    p.className = `msg-chat ${quem === 'Você' ? 'eu' : 'atendente'}`;
    const nome = document.createElement('strong');
    nome.textContent = `${quem}: `;
    p.appendChild(nome);
    p.appendChild(document.createTextNode(texto));
    caixaMsgs.appendChild(p);
    caixaMsgs.scrollTop = caixaMsgs.scrollHeight;
  };
  const mostrarQualidade = () => {
    const congestionada = document.getElementById('btn-rede').getAttribute('aria-pressed') === 'true';
    textoQualidade.textContent = congestionada
      ? 'Rede congestionada (latência alta). Pela regra de QoS, voz e chat têm prioridade e o vídeo reduz a qualidade para manter a chamada.'
      : 'Qualidade da conexão: boa (latência de cerca de 40 ms). Regra de QoS: voz e vídeo têm prioridade sobre outros dados.';
  };
  const definirControles = (ativos) => {
    ['btn-mic', 'btn-cam', 'btn-rede', 'btn-enviar'].forEach((id) => { document.getElementById(id).disabled = !ativos; });
    campoMsg.disabled = !ativos;
  };
  function parar() {
    temporizadores.forEach(clearTimeout);
    temporizadores = [];
  }
  function iniciarChamada() {
    parar();
    emChamada = true;
    indiceResposta = 0;
    caixaMsgs.innerHTML = '';
    document.getElementById('avatar-eu').textContent = conta.nome.charAt(0).toUpperCase();
    document.getElementById('sala-info').textContent = salaAtual
      ? `Sala da consulta: ${TIPOS[salaAtual.tipo]}, ${formatarData(salaAtual.data)} às ${salaAtual.hora}.`
      : 'Sala de demonstração (sem consulta vinculada). Para entrar numa consulta, use "Entrar na sala" em Minhas consultas.';
    salaAtual = null;
    botaoEncerrar.textContent = 'Encerrar chamada';
    botaoEncerrar.className = 'botao perigo';
    [['btn-mic', 'Microfone: ligado'], ['btn-cam', 'Câmera: ligada'], ['btn-rede', 'Simular rede congestionada']].forEach(([id, texto]) => {
      const b = document.getElementById(id);
      b.textContent = texto;
      b.setAttribute('aria-pressed', 'false');
    });
    definirControles(true);
    mostrarQualidade();
    temporizadores.push(setTimeout(() => adicionarMensagem('Atendente', 'Olá! Sou o João. Como posso ajudar você hoje?'), 800));
  }

  const alternar = (id, ligado, desligado) => {
    const b = document.getElementById(id);
    const apagado = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(apagado));
    b.textContent = apagado ? desligado : ligado;
  };
  document.getElementById('btn-mic').addEventListener('click', () => alternar('btn-mic', 'Microfone: ligado', 'Microfone: desligado'));
  document.getElementById('btn-cam').addEventListener('click', () => alternar('btn-cam', 'Câmera: ligada', 'Câmera: desligada'));
  document.getElementById('btn-rede').addEventListener('click', () => {
    alternar('btn-rede', 'Simular rede congestionada', 'Voltar à rede normal');
    mostrarQualidade();
  });
  botaoEncerrar.addEventListener('click', () => {
    if (emChamada) {
      parar();
      emChamada = false;
      definirControles(false);
      textoQualidade.textContent = 'Chamada encerrada. Obrigado pelo atendimento!';
      botaoEncerrar.textContent = 'Iniciar nova chamada de demonstração';
      botaoEncerrar.className = 'botao';
      anunciar('Chamada encerrada.');
    } else {
      iniciarChamada();
    }
  });
  document.getElementById('form-chat').addEventListener('submit', (event) => {
    event.preventDefault();
    const texto = campoMsg.value.trim();
    if (!texto || !emChamada) return;
    adicionarMensagem('Você', texto);
    campoMsg.value = '';
    const resposta = respostas[indiceResposta % respostas.length];
    indiceResposta += 1;
    temporizadores.push(setTimeout(() => adicionarMensagem('Atendente', resposta), 1000));
  });

  mostrarTela();
}
