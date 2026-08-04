const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const db = require('../lib/db');
const config = require('../config');
const { exigirLogin } = require('../lib/auth');

// ---------------------------------------------------------------------------
// Login / logout
// ---------------------------------------------------------------------------
router.get('/login', (req, res) => {
  const aviso = req.session.avisoLogin;
  req.session.avisoLogin = null;
  res.render('interno/login', { titulo: 'Área interna', aviso, erro: null });
});

router.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const senha = req.body.senha || '';
  const usuario = db.prepare('SELECT * FROM usuarios WHERE LOWER(email) = ? AND ativo = 1').get(email);

  if (!usuario || !bcrypt.compareSync(senha, usuario.senha_hash)) {
    return res.status(401).render('interno/login', {
      titulo: 'Área interna',
      aviso: null,
      erro: 'E-mail ou senha inválidos.',
    });
  }

  req.session.usuario = { id: usuario.id, nome: usuario.nome, papel: usuario.papel };
  res.redirect('/interno');
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/interno/login'));
});

// Todas as rotas abaixo exigem login
router.use(exigirLogin);

function nomeEmpreendimento(slug) {
  if (!slug) return 'Geral (sem empreendimento)';
  const emp = config.EMPREENDIMENTOS.find((e) => e.slug === slug);
  return emp ? emp.nome : slug;
}

// ---------------------------------------------------------------------------
// Dashboard — lista de terceirizados com filtros
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  const { empreendimento, servico, cidade, situacao } = req.query;

  let sql = `
    SELECT DISTINCT t.*
    FROM terceirizados t
    LEFT JOIN terceirizado_servicos ts ON ts.terceirizado_id = t.id
    WHERE 1 = 1
  `;
  const params = {};

  if (empreendimento) {
    sql += ' AND t.empreendimento = @empreendimento';
    params.empreendimento = empreendimento;
  }
  if (servico) {
    sql += ' AND ts.servico_id = @servico';
    params.servico = Number(servico);
  }
  if (cidade) {
    sql += ' AND t.cidade LIKE @cidade';
    params.cidade = `%${cidade}%`;
  }
  if (situacao) {
    sql += ' AND t.situacao_cadastral = @situacao';
    params.situacao = situacao;
  }
  sql += ' ORDER BY t.criado_em DESC';

  const terceirizados = db.prepare(sql).all(params);

  // Serviços de cada terceirizado (para exibir como chips na tabela)
  const stmtServicos = db.prepare(`
    SELECT COALESCE(s.nome, ts.servico_outro) AS nome
    FROM terceirizado_servicos ts
    LEFT JOIN servicos s ON s.id = ts.servico_id
    WHERE ts.terceirizado_id = ?
  `);
  terceirizados.forEach((t) => {
    t.servicosNomes = stmtServicos.all(t.id).map((r) => r.nome).filter(Boolean);
    t.empreendimentoNome = nomeEmpreendimento(t.empreendimento);
  });

  const servicosCatalogo = db.prepare('SELECT * FROM servicos ORDER BY nome').all();

  res.render('interno/dashboard', {
    titulo: 'Painel interno',
    terceirizados,
    servicosCatalogo,
    empreendimentos: config.EMPREENDIMENTOS,
    situacoes: config.SITUACOES_CADASTRAIS,
    filtros: { empreendimento: empreendimento || '', servico: servico || '', cidade: cidade || '', situacao: situacao || '' },
    total: terceirizados.length,
  });
});

// ---------------------------------------------------------------------------
// Detalhes de um terceirizado (dados + experiência + documentos)
// ---------------------------------------------------------------------------
router.get('/terceirizados/:id', (req, res) => {
  const terceirizado = db.prepare('SELECT * FROM terceirizados WHERE id = ?').get(req.params.id);
  if (!terceirizado) {
    return res.status(404).render('erro', { titulo: 'Não encontrado', mensagem: 'Cadastro de terceirizado não encontrado.' });
  }
  terceirizado.empreendimentoNome = nomeEmpreendimento(terceirizado.empreendimento);

  const experiencia = db.prepare('SELECT * FROM experiencias WHERE terceirizado_id = ?').get(terceirizado.id);

  const servicos = db.prepare(`
    SELECT COALESCE(s.nome, ts.servico_outro) AS nome
    FROM terceirizado_servicos ts
    LEFT JOIN servicos s ON s.id = ts.servico_id
    WHERE ts.terceirizado_id = ?
  `).all(terceirizado.id).map((r) => r.nome).filter(Boolean);

  const documentos = db.prepare('SELECT * FROM documentos WHERE terceirizado_id = ? ORDER BY id').all(terceirizado.id);

  res.render('interno/detalhe', {
    titulo: `Terceirizado · ${terceirizado.nome_fantasia || terceirizado.razao_social}`,
    terceirizado,
    experiencia,
    servicos,
    documentos,
    situacoes: config.SITUACOES_CADASTRAIS,
  });
});

// ---------------------------------------------------------------------------
// Atualizar situação cadastral (Pendente / Ativo / Inativo / Bloqueado)
// ---------------------------------------------------------------------------
router.post('/terceirizados/:id/situacao', (req, res) => {
  const { situacao } = req.body;
  if (!config.SITUACOES_CADASTRAIS.includes(situacao)) {
    return res.redirect(`/interno/terceirizados/${req.params.id}`);
  }
  db.prepare(`UPDATE terceirizados SET situacao_cadastral = ?, atualizado_em = datetime('now') WHERE id = ?`)
    .run(situacao, req.params.id);
  res.redirect(`/interno/terceirizados/${req.params.id}`);
});

// ---------------------------------------------------------------------------
// Download de documento anexado
// ---------------------------------------------------------------------------
router.get('/documentos/:id/download', (req, res) => {
  const doc = db.prepare('SELECT * FROM documentos WHERE id = ?').get(req.params.id);
  if (!doc || !doc.caminho_arquivo) {
    return res.status(404).render('erro', { titulo: 'Arquivo não encontrado', mensagem: 'Este documento não possui arquivo anexado.' });
  }

  const caminhoAbsoluto = path.join(config.UPLOADS_PATH, doc.caminho_arquivo);

  // Garante que o caminho resolvido continua dentro da pasta de uploads (evita path traversal)
  if (!caminhoAbsoluto.startsWith(path.resolve(config.UPLOADS_PATH))) {
    return res.status(400).render('erro', { titulo: 'Caminho inválido', mensagem: 'Não foi possível acessar este arquivo.' });
  }
  if (!fs.existsSync(caminhoAbsoluto)) {
    return res.status(404).render('erro', { titulo: 'Arquivo não encontrado', mensagem: 'O arquivo não foi localizado no servidor.' });
  }

  res.download(caminhoAbsoluto, doc.nome_arquivo_original || path.basename(caminhoAbsoluto));
});

module.exports = router;
