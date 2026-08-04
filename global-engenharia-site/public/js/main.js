// ---------------------------------------------------------------------------
// Menu mobile (hambúrguer)
// ---------------------------------------------------------------------------
(function () {
  const btn = document.querySelector('.hamburger');
  const nav = document.querySelector('.nav-mobile');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => {
    nav.classList.toggle('aberto');
    const aberto = nav.classList.contains('aberto');
    btn.setAttribute('aria-expanded', aberto ? 'true' : 'false');
  });
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('aberto')));
})();

// ---------------------------------------------------------------------------
// Wizard visual do formulário de cadastro (front-end apenas — o envio
// continua sendo um único POST para /cadastro, preservando o backend)
// ---------------------------------------------------------------------------
(function () {
  const form = document.querySelector('[data-wizard]');
  if (!form) return;

  const steps = Array.from(form.querySelectorAll('.wizard-fieldset'));
  const stepButtons = Array.from(form.querySelectorAll('.wizard-step'));
  let atual = 0;

  function mostrar(indice) {
    steps.forEach((el, i) => el.classList.toggle('ativo', i === indice));
    stepButtons.forEach((el, i) => {
      el.classList.toggle('ativo', i === indice);
      el.classList.toggle('concluido', i < indice);
    });
    atual = indice;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    montarRevisao();
  }

  form.querySelectorAll('[data-next]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!validarEtapaAtual()) return;
      if (atual < steps.length - 1) mostrar(atual + 1);
    })
  );
  form.querySelectorAll('[data-prev]').forEach((b) =>
    b.addEventListener('click', () => {
      if (atual > 0) mostrar(atual - 1);
    })
  );
  stepButtons.forEach((btnEl, i) =>
    btnEl.addEventListener('click', () => {
      if (i <= atual) mostrar(i);
    })
  );

  function validarEtapaAtual() {
    const campos = steps[atual].querySelectorAll('[required]');
    for (const campo of campos) {
      if (!campo.checkValidity()) {
        campo.reportValidity();
        return false;
      }
    }
    return true;
  }

  // Preenche a etapa de revisão com os dados digitados
  function montarRevisao() {
    if (atual !== steps.length - 1) return;
    const alvo = form.querySelector('[data-revisao]');
    if (!alvo) return;
    const pegar = (nome) => {
      const el = form.querySelector(`[name="${nome}"]`);
      if (!el) return '';
      if (el.tagName === 'SELECT') return el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '';
      return el.value;
    };
    const servicosMarcados = Array.from(form.querySelectorAll('input[name="servicos_ids[]"]:checked'))
      .map((c) => c.closest('.check-item').textContent.trim())
      .join(', ') || '—';

    alvo.innerHTML = `
      <div class="review-box">
        <h4>Dados cadastrais</h4>
        <dl>
          <div><dt>Nome / Razão social</dt><dd>${pegar('razao_social') || '—'}</dd></div>
          <div><dt>CPF/CNPJ</dt><dd>${pegar('cpf_cnpj') || '—'}</dd></div>
          <div><dt>Cidade/UF</dt><dd>${pegar('cidade') || '—'} / ${pegar('estado') || '—'}</dd></div>
          <div><dt>Telefone</dt><dd>${pegar('telefone') || '—'}</dd></div>
          <div><dt>E-mail</dt><dd>${pegar('email') || '—'}</dd></div>
        </dl>
      </div>
      <div class="review-box">
        <h4>Serviços oferecidos</h4>
        <dl><div><dt>Selecionados</dt><dd>${servicosMarcados}</dd></div></dl>
      </div>
      <div class="review-box">
        <h4>Experiência profissional</h4>
        <dl>
          <div><dt>Tempo de experiência</dt><dd>${pegar('tempo_experiencia') || '—'}</dd></div>
          <div><dt>Área de atuação</dt><dd>${pegar('area_atuacao') || '—'}</dd></div>
        </dl>
      </div>
    `;
  }

  mostrar(0);

  // ---------------------------------------------------------------------
  // Linhas dinâmicas de documentos (ETAPA 4)
  // ---------------------------------------------------------------------
  const listaDocs = form.querySelector('[data-doc-lista]');
  const botaoAddDoc = form.querySelector('[data-doc-add]');
  const tiposDocumentoEl = document.getElementById('tipos-documento-json');
  const tiposDocumento = tiposDocumentoEl ? JSON.parse(tiposDocumentoEl.textContent) : [];
  let contadorDoc = 0;

  function criarLinhaDocumento() {
    contadorDoc += 1;
    const idx = contadorDoc;
    const div = document.createElement('div');
    div.className = 'doc-row';
    div.innerHTML = `
      <div class="field" style="margin-bottom:0">
        <label>Tipo de documento</label>
        <select data-doc-tipo required>
          <option value="">Selecione...</option>
          ${tiposDocumento.map((t) => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
      <div class="field" style="margin-bottom:0">
        <label>Arquivo</label>
        <input type="file" name="doc_arquivo_${idx}" data-doc-campo />
      </div>
      <div class="field" style="margin-bottom:0">
        <label>Validade <span class="opt">(se houver)</span></label>
        <input type="date" data-doc-validade />
      </div>
      <button type="button" class="btn-remover" data-doc-remover>Remover</button>
    `;
    div.querySelector('[data-doc-remover]').addEventListener('click', () => {
      div.remove();
      atualizarMetaDocumentos();
    });
    div.querySelector('[data-doc-tipo]').addEventListener('change', atualizarMetaDocumentos);
    div.querySelector('[data-doc-validade]').addEventListener('change', atualizarMetaDocumentos);
    div.dataset.campo = `doc_arquivo_${idx}`;
    listaDocs.appendChild(div);
    atualizarMetaDocumentos();
  }

  function atualizarMetaDocumentos() {
    const meta = [];
    listaDocs.querySelectorAll('.doc-row').forEach((row) => {
      const tipo = row.querySelector('[data-doc-tipo]').value;
      const validade = row.querySelector('[data-doc-validade]').value;
      const campo = row.querySelector('[data-doc-campo]').getAttribute('name');
      if (tipo) meta.push({ tipo, validade: validade || null, campo });
    });
    const hidden = form.querySelector('input[name="documentos_meta"]');
    if (hidden) hidden.value = JSON.stringify(meta);
  }

  if (botaoAddDoc) {
    botaoAddDoc.addEventListener('click', criarLinhaDocumento);
    criarLinhaDocumento();
  }

  form.addEventListener('submit', atualizarMetaDocumentos);
})();
